import {
  assertAllowedReactionEmoji,
  assertMessageInput,
  normalizeMessageInput,
  updateConversationAfterMessage,
  updateConversationAfterReaction,
} from "../../domain/chat/policies/messagePolicy.js";
import { AppError } from "../../shared/errors/AppError.js";

/**
 * Purpose:
 * Converts ObjectId-like values, populated docs, and strings into comparable IDs.
 *
 * How it works:
 * It prefers a populated document's _id when present, otherwise uses the value's
 * own toString method.
 *
 * Parameters:
 * - value: ObjectId, string, populated document, or nullish value.
 *
 * Returns:
 * String ID, or undefined when no value exists.
 */
const toIdString = (value) => value?._id?.toString?.() || value?.toString?.();

/**
 * Purpose:
 * Enforces conversation membership and cleared-message visibility for reactions.
 *
 * How it works:
 * Finds the requesting user's participant row. Missing participants are rejected
 * with 403, while messages hidden by that user's clearedAt timestamp behave as
 * not found.
 *
 * Parameters:
 * - message: Message document being reacted to.
 * - conversation: Conversation document containing participant visibility data.
 * - userId: Current user's ID.
 *
 * Returns:
 * The participant subdocument for the current user.
 */
const assertMessageReactionAccess = ({ message, conversation, userId }) => {
  const currentUserId = userId.toString();
  const participant = conversation?.participants?.find(
    (item) => toIdString(item.userId) === currentUserId,
  );

  if (!participant) {
    throw new AppError(403, "Bạn không có quyền reaction tin nhắn này");
  }

  const clearedAt = participant.clearedAt ? new Date(participant.clearedAt) : null;

  if (clearedAt && new Date(message.createdAt) <= clearedAt) {
    throw new AppError(404, "Tin nhắn không tồn tại");
  }

  return participant;
};

/**
 * Purpose:
 * Keeps a message reaction array to one entry per user before saving.
 *
 * How it works:
 * It replaces the first matching reaction in place, drops duplicate rows for
 * that user, and appends the reaction only when the user had none before.
 *
 * Parameters:
 * - reactions: Existing reaction rows from the message document.
 * - currentUserId: User ID whose reaction is being replaced.
 * - replacement: New reaction row for the current user.
 *
 * Returns:
 * Reaction rows with at most one row for currentUserId.
 */
const replaceUserReaction = (reactions, currentUserId, replacement) => {
  let replaced = false;

  const nextReactions = reactions.flatMap((reaction) => {
    if (toIdString(reaction.userId) !== currentUserId) {
      return [reaction];
    }

    if (replaced) {
      return [];
    }

    replaced = true;
    return [replacement];
  });

  return replaced ? nextReactions : [...nextReactions, replacement];
};

/**
 * Purpose:
 * Creates message use cases: send direct/group messages, upload images.
 *
 * How it works:
 * Each method validates input via policies, persists via repositories,
 * updates conversation metadata, and emits realtime events via socketGateway.
 *
 * Parameters:
 * - repositories: Data access methods for messages and conversations.
 * - socketGateway: Realtime gateway for chat socket events.
 * - imageGateway: Image upload adapter.
 *
 * Returns:
 * Object containing message use case methods.
 */
export const makeMessageUseCases = ({ repositories, socketGateway, imageGateway }) => ({
  /**
   * Purpose:
   * Uploads a message image to the cloud image service.
   *
   * How it works:
   * Validates file is an image, delegates to imageGateway for upload,
   * returns the secure URL from the provider.
   *
   * Parameters:
   * - file: Express Multer file object with buffer, mimetype, originalname
   *
   * Returns:
   * Object { imgUrl: string }
   */
  async uploadMessageImage({ file }) {
    if (!file) {
      throw new AppError(400, "Không tìm thấy file upload");
    }

    if (!file.mimetype?.startsWith("image/")) {
      throw new AppError(400, "File upload phải là ảnh");
    }

    const result = await imageGateway.uploadImageFromBuffer(file.buffer, {
      fileName: file.originalname || "chat-image",
      mimeType: file.mimetype,
    });

    if (!result?.secure_url) {
      throw new AppError(502, "Image host không trả về URL hợp lệ");
    }

    return { imgUrl: result.secure_url };
  },

  /**
   * Purpose:
   * Sends a direct message to another user, creating conversation if needed.
   *
   * How it works:
   * Normalizes/validates input, finds or creates direct conversation,
   * persists message, updates conversation metadata, emits new-message event.
   *
   * Parameters:
   * - recipientId: target user ID
   * - content: text content (optional)
   * - conversationId: existing conversation ID (optional, auto-creates if null)
   * - imgUrls: array of image URLs (optional)
   * - imgUrl: singular image URL (optional, legacy)
   * - senderId: sending user ID
   *
   * Returns:
   * Object { message: savedMessage }
   */
  async sendDirectMessage({ recipientId, content, conversationId, imgUrls, imgUrl, senderId }) {
    const input = normalizeMessageInput({ content, imgUrls, imgUrl });
    assertMessageInput(input);

    let conversation = null;

    if (conversationId) {
      conversation = await repositories.findConversationById(conversationId);
    }

    if (!conversation) {
      conversation = await repositories.createDirectConversation(senderId, recipientId);
    }

    const message = await repositories.createMessage({
      conversationId: conversation._id,
      senderId,
      content: input.content || null,
      imgUrl: input.imgUrl,
      imgUrls: input.imgUrls,
    });

    updateConversationAfterMessage(conversation, message, senderId);

    await repositories.saveConversation(conversation);

    socketGateway.emitNewMessage(conversation, message);

    return { message };
  },

  /**
   * Purpose:
   * Sends a message to a group conversation.
   *
   * How it works:
   * Normalizes/validates input, persists message to the existing group
   * conversation, updates metadata, emits new-message event to room.
   *
   * Parameters:
   * - conversationId: group conversation ID
   * - content: text content (optional)
   * - imgUrls: array of image URLs (optional)
   * - imgUrl: singular image URL (optional, legacy)
   * - senderId: sending user ID
   * - conversation: pre-loaded conversation document (mutated in-place)
   *
   * Returns:
   * Object { message: savedMessage }
   */
  async sendGroupMessage({ conversationId, content, imgUrls, imgUrl, senderId, conversation }) {
    const input = normalizeMessageInput({ content, imgUrls, imgUrl });
    assertMessageInput(input);

    const message = await repositories.createMessage({
      conversationId,
      senderId,
      content: input.content || null,
      imgUrl: input.imgUrl,
      imgUrls: input.imgUrls,
    });

    updateConversationAfterMessage(conversation, message, senderId);

    await repositories.saveConversation(conversation);

    socketGateway.emitNewMessage(conversation, message);

    return { message };
  },

  /**
   * Purpose:
   * Adds or replaces the current user's quick reaction on a message, and
   * updates the conversation sidebar preview so unread recipients see a
   * notification like "Liam reacted 👍".
   *
   * How it works:
   * Validates the emoji, loads the message and conversation, checks membership
   * and clearedAt visibility, replaces any existing reaction from the user,
   * saves the message, updates conversation metadata (unread counts, synthetic
   * lastMessage preview), saves the conversation, and emits an expanded
   * realtime update with conversation preview and unread counts.
   *
   * Parameters:
   * - messageId: Message receiving the reaction.
   * - userId: Current user's ID.
   * - emoji: Supported quick reaction emoji.
   *
   * Returns:
   * Object { messageId, conversationId, reactions, conversation, unreadCounts }.
   */
  async setMessageReaction({ messageId, userId, emoji }) {
    assertAllowedReactionEmoji(emoji);

    if (!messageId || !repositories.isValidObjectId(messageId)) {
      throw new AppError(404, "Tin nhắn không tồn tại");
    }

    const message = await repositories.findMessageById(messageId);

    if (!message) {
      throw new AppError(404, "Tin nhắn không tồn tại");
    }

    const conversation = await repositories.findConversationById(message.conversationId);

    if (!conversation) {
      throw new AppError(404, "Conversation không tồn tại");
    }

    assertMessageReactionAccess({ message, conversation, userId });

    const currentUserId = userId.toString();
    const now = new Date();
    const reactions = Array.from(message.reactions || []);
    const existingReactionIndex = reactions.findIndex(
      (reaction) => toIdString(reaction.userId) === currentUserId,
    );

    message.reactions = replaceUserReaction(reactions, currentUserId, {
      userId,
      emoji,
      createdAt: existingReactionIndex >= 0
        ? reactions[existingReactionIndex].createdAt || now
        : now,
      updatedAt: now,
    });

    const savedMessage = await repositories.saveMessage(message);

    const reactorUser = await repositories.findBasicUserById(userId);
    const reactorName = reactorUser?.displayName || reactorUser?.username || "Someone";

    updateConversationAfterReaction(
      conversation,
      savedMessage._id.toString(),
      userId,
      reactorName,
      emoji,
      now,
    );
    await repositories.saveConversation(conversation);

    const payload = {
      messageId: savedMessage._id.toString(),
      conversationId: savedMessage.conversationId.toString(),
      reactions: await repositories.formatMessageReactions(savedMessage, currentUserId),
      conversation: {
        _id: conversation._id.toString(),
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
      },
      unreadCounts: Object.fromEntries(conversation.unreadCounts),
    };

    socketGateway.emitMessageReactionUpdated(payload.conversationId, payload);

    return payload;
  },

  /**
   * Purpose:
   * Removes the current user's quick reaction from a message.
   *
   * How it works:
   * Loads the message and conversation, checks membership and clearedAt
   * visibility, filters out only the current user's reaction, saves when the
   * message changed, and emits a reaction-only realtime update.
   *
   * Parameters:
   * - messageId: Message whose reaction should be removed.
   * - userId: Current user's ID.
   *
   * Returns:
   * Object { messageId, conversationId, reactions } with formatted summaries.
   */
  async removeMessageReaction({ messageId, userId }) {
    if (!messageId || !repositories.isValidObjectId(messageId)) {
      throw new AppError(404, "Tin nhắn không tồn tại");
    }

    const message = await repositories.findMessageById(messageId);

    if (!message) {
      throw new AppError(404, "Tin nhắn không tồn tại");
    }

    const conversation = await repositories.findConversationById(message.conversationId);

    if (!conversation) {
      throw new AppError(404, "Conversation không tồn tại");
    }

    assertMessageReactionAccess({ message, conversation, userId });

    const currentUserId = userId.toString();
    const reactions = Array.from(message.reactions || []);
    const nextReactions = reactions.filter((reaction) => toIdString(reaction.userId) !== currentUserId);
    const changed = nextReactions.length !== reactions.length;

    if (changed) {
      message.reactions = nextReactions;
      await repositories.saveMessage(message);
    }

    const payload = {
      messageId: message._id.toString(),
      conversationId: message.conversationId.toString(),
      reactions: await repositories.formatMessageReactions(message, currentUserId),
    };

    if (changed) {
      socketGateway.emitMessageReactionUpdated(payload.conversationId, payload);
    }

    return payload;
  },
});
