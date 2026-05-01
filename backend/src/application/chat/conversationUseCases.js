import { assertCreateConversationInput } from "../../domain/chat/policies/messagePolicy.js";
import { AppError } from "../../shared/errors/AppError.js";

/**
 * Purpose:
 * Creates a new direct or group conversation.
 *
 * How it works:
 * For direct: checks if conversation already exists, creates if not.
 * For group: creates new group conversation with members.
 * Populates full conversation data and emits socket events to participants.
 *
 * Parameters:
 * - repositories: data access layer
 * - socketGateway: realtime event emitter
 *
 * Returns:
 * Object { repositories, socketGateway } with all conversation use case methods.
 */
export const makeConversationUseCases = ({ repositories, socketGateway }) => ({
  /**
   * Purpose:
   * Creates a new direct or group conversation with the given parameters.
   *
   * How it works:
   * Validates input, finds existing direct conversation (for direct type) or
   * creates new one, populates full data, emits realtime events to participants.
   *
   * Parameters:
   * - userId: Creator's user ID
   * - type: "direct" or "group"
   * - name: Group name (optional for direct)
   * - memberIds: Array of participant user IDs
   *
   * Returns:
   * Object { conversation: formattedConversationDto }
   */
  async createConversation({ userId, type, name, memberIds }) {
    assertCreateConversationInput({ type, name, memberIds });

    let conversation;

    if (type === "direct") {
      const participantId = memberIds[0];

      conversation = await repositories.findDirectConversation(userId, participantId);

      if (!conversation) {
        conversation = await repositories.createDirectConversation(userId, participantId);
      }
    }

    if (type === "group") {
      conversation = await repositories.createGroupConversation(userId, name, memberIds);
    }

    if (!conversation) {
      throw new AppError(400, "Conversation type không hợp lệ");
    }

    await repositories.populateConversation(conversation);

    const formattedConversation = repositories.toConversationDto(conversation);

    if (type === "group") {
      memberIds.forEach((memberId) => {
        socketGateway.emitNewGroup(memberId, formattedConversation);
      });
    }

    if (type === "direct") {
      socketGateway.emitNewGroup(userId, formattedConversation);
      socketGateway.emitNewGroup(memberIds[0], formattedConversation);
    }

    return { conversation: formattedConversation };
  },

  /**
   * Purpose:
   * Retrieves all conversations visible to the user (with unread metadata).
   *
   * How it works:
   * Delegates to repository to query conversations where user is a participant.
   *
   * Parameters:
   * - userId: Authenticated user's ID
   *
   * Returns:
   * Object { conversations: Conversation[] }
   */
  async getConversations({ userId }) {
    const conversations = await repositories.listConversationsForUser(userId);
    return { conversations };
  },

  /**
   * Purpose:
   * Returns paginated messages for a conversation, enforcing access control.
   *
   * How it works:
   * Delegates to repository for cursor-based pagination; throws 404 if
   * conversation not found or user lacks access.
   *
   * Parameters:
   * - conversationId: Target conversation ID
   * - userId: Requesting user's ID (for access check)
   * - limit: Max messages per page (default 50)
   * - cursor: Pagination cursor for next page
   *
   * Returns:
   * Object { messages: Message[], nextCursor: string|null }
   */
  async getMessages({ conversationId, userId, limit, cursor }) {
    const response = await repositories.listMessages({
      conversationId,
      userId,
      limit,
      cursor,
    });

    if (!response) {
      throw new AppError(404, "Conversation không tồn tại hoặc bạn không có quyền truy cập");
    }

    return response;
  },

  /**
   * Purpose:
   * Gets conversation IDs for socket room registration (internal).
   *
   * How it works:
   * Directly queries repository for conversation IDs the user belongs to,
   * used during socket handshake to join conversation rooms.
   *
   * Parameters:
   * - userId: User's ID
   *
   * Returns:
   * Array of conversation ID strings.
   */
  async getUserConversationsForSocketIO({ userId }) {
    return repositories.getUserConversationIds(userId);
  },

  /**
   * Purpose:
   * Marks the conversation as read by the user, resetting their unread count.
   *
   * How it works:
   * Finds conversation, checks lastMessage sender to skip self-messages,
   * updates DB via repository, emits read-message socket event to participants.
   *
   * Parameters:
   * - conversationId: Conversation to mark
   * - userId: Reading user's ID
   *
   * Returns:
   * Object { message, seenBy, myUnreadCount }
   */
  async markAsSeen({ conversationId, userId }) {
    const conversation = await repositories.findConversationLeanById(conversationId);

    if (!conversation) {
      throw new AppError(404, "Conversation không tồn tại");
    }

    const lastMessage = conversation.lastMessage;

    if (!lastMessage) {
      return {
        message: "Không có tin nhắn để mark as seen",
        seenBy: conversation.seenBy || [],
        myUnreadCount: 0,
      };
    }

    if (lastMessage.senderId.toString() === userId) {
      return {
        message: "Sender không cần mark as seen",
        seenBy: conversation.seenBy || [],
        myUnreadCount: 0,
      };
    }

    const updatedConversation = await repositories.markConversationSeen(conversationId, userId);

    socketGateway.emitReadMessage(conversationId, updatedConversation);

    const unreadCounts = updatedConversation?.unreadCounts;
    const myUnreadCount =
      unreadCounts instanceof Map
        ? unreadCounts.get(userId) || 0
        : unreadCounts?.[userId] || 0;

    return {
      message: "Marked as seen",
      seenBy: updatedConversation?.seenBy || [],
      myUnreadCount,
    };
  },

  /**
   * Purpose:
   * Soft-deletes a conversation from the user's view (sets clearedAt).
   *
   * How it works:
   * Updates the participant's clearedAt timestamp in the conversation document,
   * so messages before that date are hidden from this user.
   *
   * Parameters:
   * - conversationId: Conversation to clear
   * - userId: User requesting clear
   *
   * Returns:
   * Object { message, clearedAt: ISO timestamp }
   */
  async clearConversationForUser({ conversationId, userId }) {
    const clearedAt = new Date();
    const clearedConversation = await repositories.clearConversationForUser(
      conversationId,
      userId,
      clearedAt,
    );

    if (!clearedConversation) {
      throw new AppError(404, "Conversation không tồn tại hoặc bạn không có quyền truy cập");
    }

    return {
      message: "Conversation đã được xóa ở phía bạn",
      clearedAt: clearedAt.toISOString(),
    };
  },
});
