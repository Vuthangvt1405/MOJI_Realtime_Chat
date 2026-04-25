import { assertCreateConversationInput } from "../../domain/chat/policies/messagePolicy.js";
import { AppError } from "../../shared/errors/AppError.js";

export const makeConversationUseCases = ({ repositories, socketGateway }) => ({
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

  async getConversations({ userId }) {
    const conversations = await repositories.listConversationsForUser(userId);
    return { conversations };
  },

  async getMessages({ conversationId, limit, cursor }) {
    return repositories.listMessages(conversationId, limit, cursor);
  },

  async getUserConversationsForSocketIO({ userId }) {
    return repositories.getUserConversationIds(userId);
  },

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
});
