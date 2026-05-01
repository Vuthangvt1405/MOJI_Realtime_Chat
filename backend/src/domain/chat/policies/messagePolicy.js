import { AppError } from "../../../shared/errors/AppError.js";

export const MESSAGE_REACTION_EMOJIS = Object.freeze(["👍", "❤️", "😂", "😮", "😢", "🔥"]);

/**
 * Purpose:
 * Validates that a message reaction emoji is supported by the quick bar.
 *
 * How it works:
 * Checks the provided emoji against the fixed reaction whitelist and throws a
 * validation error when the emoji is missing or unsupported.
 *
 * Parameters:
 * - emoji: Reaction emoji requested by the current user.
 *
 * Returns:
 * void — throws AppError(400) on invalid input.
 */
export const assertAllowedReactionEmoji = (emoji) => {
  if (!MESSAGE_REACTION_EMOJIS.includes(emoji)) {
    throw new AppError(400, "Reaction emoji không được hỗ trợ");
  }
};

/**
 * Purpose:
 * Normalizes message input fields (trims text, filters empty image URLs).
 *
 * How it works:
 * Trims content string, filters out empty imgUrls entries, merges singular
 * imgUrl into imgUrls array for unified handling.
 *
 * Parameters:
 * - content: raw message text
 * - imgUrls: array of uploaded image URLs
 * - imgUrl: singular image URL (legacy field)
 *
 * Returns:
 * Object { content: string, imgUrls: string[], imgUrl: string|null }
 */
export const normalizeMessageInput = ({ content, imgUrls, imgUrl }) => {
  const normalizedContent = typeof content === "string" ? content.trim() : "";

  let normalizedImgUrls = [];

  if (Array.isArray(imgUrls)) {
    normalizedImgUrls = imgUrls.filter(
      (url) => typeof url === "string" && url.trim() !== "",
    );
  } else if (typeof imgUrl === "string" && imgUrl.trim() !== "") {
    normalizedImgUrls = [imgUrl.trim()];
  }

  return {
    content: normalizedContent,
    imgUrls: normalizedImgUrls,
    imgUrl: normalizedImgUrls[0] || null,
  };
};

/**
 * Purpose:
 * Validates that a message has at least text or image content.
 *
 * How it works:
 * Throws 400 if both content string is empty and imgUrls array is empty.
 *
 * Parameters:
 * - content: trimmed text content
 * - imgUrls: normalized image URL array
 *
 * Returns:
 * void — throws AppError if validation fails.
 */
export const assertMessageInput = ({ content, imgUrls }) => {
  if (!content && (!Array.isArray(imgUrls) || imgUrls.length === 0)) {
    throw new AppError(400, "Thiếu nội dung hoặc hình ảnh");
  }
};

/**
 * Purpose:
 * Validates conversation creation parameters.
 *
 * How it works:
 * Checks type presence, group name requirement, memberIds non-empty,
 * and type must be "direct" or "group".
 *
 * Parameters:
 * - type: "direct" or "group"
 * - name: group name (required when type=group)
 * - memberIds: array of participant user IDs
 *
 * Returns:
 * void — throws AppError(400) on invalid input.
 */
export const assertCreateConversationInput = ({ type, name, memberIds }) => {
  if (
    !type ||
    (type === "group" && !name) ||
    !Array.isArray(memberIds) ||
    memberIds.length === 0
  ) {
    throw new AppError(400, "Tên nhóm và danh sách thành viên là bắt buộc");
  }

  if (type !== "group" && type !== "direct") {
    throw new AppError(400, "Conversation type không hợp lệ");
  }
};

/**
 * Purpose:
 * Updates conversation metadata and unread counts after a message is sent.
 *
 * How it works:
 * Sets lastMessage/lastMessageAt, clears seenBy, and increments unreadCounts
 * for all participants except the sender (sender's count reset to 0).
 *
 * Parameters:
 * - conversation: Mongoose conversation document (mutated in-place)
 * - message: saved message document
 * - senderId: ID of the sending user
 *
 * Returns:
 * void — mutates conversation document directly.
 */
export const updateConversationAfterMessage = (conversation, message, senderId) => {
  const imageCount = Array.isArray(message.imgUrls)
    ? message.imgUrls.filter((url) => typeof url === "string" && url.trim() !== "").length
    : message.imgUrl
      ? 1
      : 0;

  const previewContent =
    message.content ||
    (imageCount > 1 ? `Hinh anh (${imageCount})` : imageCount === 1 ? "Hinh anh" : null);

  conversation.set({
    seenBy: [],
    lastMessageAt: message.createdAt,
    lastMessage: {
      _id: message._id,
      content: previewContent,
      senderId,
      createdAt: message.createdAt,
    },
  });

  conversation.participants.forEach((participant) => {
    const memberId = participant.userId.toString();
    const isSender = memberId === senderId.toString();
    const previousCount = conversation.unreadCounts.get(memberId) || 0;

    conversation.unreadCounts.set(memberId, isSender ? 0 : previousCount + 1);
  });
};

/**
 * Purpose:
 * Updates conversation metadata after a reaction event, mirroring
 * updateConversationAfterMessage but without creating a Message document.
 *
 * How it works:
 * Resets seenBy to force unread tracking, sets lastMessageAt to the reaction
 * timestamp, creates a synthetic lastMessage preview (e.g. "Liam reacted 👍"),
 * and increments unreadCounts for all participants except the reactor.
 *
 * Parameters:
 * - conversation: Mongoose conversation document (mutated in place).
 * - messageId: The ID of the message that was reacted to.
 * - reactorId: The ID of the user who reacted.
 * - reactorName: Display name for the preview text.
 * - emoji: The reaction emoji.
 * - reactedAt: Date object — timestamp of the reaction.
 *
 * Returns:
 * void — mutates the conversation object in place.
 */
export const updateConversationAfterReaction = (conversation, messageId, reactorId, reactorName, emoji, reactedAt) => {
  conversation.seenBy = [];
  conversation.lastMessageAt = reactedAt;
  conversation.lastMessage = {
    _id: `reaction:${messageId}:${reactorId}:${reactedAt.getTime()}`,
    content: `${reactorName} reacted ${emoji}`,
    senderId: reactorId,
    createdAt: reactedAt,
  };

  conversation.participants.forEach((participant) => {
    const memberId = participant.userId.toString();
    const isReactor = memberId === reactorId.toString();
    const previousCount = conversation.unreadCounts.get(memberId) || 0;

    conversation.unreadCounts.set(memberId, isReactor ? 0 : previousCount + 1);
  });
};
