export const makeSocketGateway = (io) => ({
  emitNewGroup(userId, payload) {
    io.to(userId.toString()).emit("new-group", payload);
  },

  emitNewMessage(conversation, message) {
    io.to(conversation._id.toString()).emit("new-message", {
      message,
      conversation: {
        _id: conversation._id,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
      },
      unreadCounts: Object.fromEntries(conversation.unreadCounts),
    });
  },

  emitReadMessage(conversationId, updatedConversation) {
    io.to(conversationId).emit("read-message", {
      conversation: updatedConversation,
      lastMessage: {
        _id: updatedConversation?.lastMessage?._id,
        content: updatedConversation?.lastMessage?.content,
        createdAt: updatedConversation?.lastMessage?.createdAt,
        sender: {
          _id: updatedConversation?.lastMessage?.senderId,
        },
      },
    });
  },

  emitFriendRequestNew(toUserId, payload) {
    io.to(toUserId.toString()).emit("friend-request:new", payload);
  },
});
