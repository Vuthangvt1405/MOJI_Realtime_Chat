/**
 * Purpose:
 * Creates the socket event gateway for broadcasting realtime events.
 *
 * How it works:
 * Takes the Socket.IO server instance, returns methods that emit typed
 * events to specific rooms (conversation rooms, user rooms).
 */
export const makeSocketGateway = (io) => ({
  /**
   * Purpose:
   * Notifies a user that they were added to a new conversation.
   *
   * How it works:
   * Emits "new-group" event to the user's personal room with conversation payload.
   *
   * Parameters:
   * - userId: recipient user ID (room name)
   * - payload: formatted conversation data
   *
   * Returns:
   * void
   */
  emitNewGroup(userId, payload) {
    io.to(userId.toString()).emit("new-group", payload);
  },

  /**
   * Purpose:
   * Broadcasts a newly sent message to the conversation room.
   *
   * How it works:
   * Emits "new-message" to the conversation's socket room with message,
   * updated conversation preview, and per-user unread counts.
   *
   * Parameters:
   * - conversation: conversation document (with unreadCounts)
   * - message: the saved message document
   *
   * Returns:
   * void
   */
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

  /**
   * Purpose:
   * Broadcasts a read-acknowledgment to the conversation room.
   *
   * How it works:
   * Emits "read-message" event to the conversation socket room with
   * updated conversation state and lastMessage metadata.
   *
   * Parameters:
   * - conversationId: conversation room ID
   * - updatedConversation: conversation after markAsSeen update
   *
   * Returns:
   * void
   */
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

  /**
   * Purpose:
   * Broadcasts updated reaction summaries for a single message.
   *
   * How it works:
   * Emits "message-reaction-updated" to the conversation room. When the
   * reaction triggers a sidebar notification, the payload also includes
   * conversation metadata (lastMessage preview) and unreadCounts.
   *
   * Parameters:
   * - conversationId: Conversation room ID.
   * - payload: Object { messageId, conversationId, reactions, conversation?, unreadCounts? }.
   *
   * Returns:
   * void
   */
  emitMessageReactionUpdated(conversationId, payload) {
    io.to(conversationId.toString()).emit("message-reaction-updated", payload);
  },

  /**
   * Purpose:
   * Notifies a user of a new incoming friend request.
   *
   * How it works:
   * Emits "friend-request:new" to the user's personal room.
   *
   * Parameters:
   * - toUserId: recipient user ID
   * - payload: friend request data
   *
   * Returns:
   * void
   */
  emitFriendRequestNew(toUserId, payload) {
    io.to(toUserId.toString()).emit("friend-request:new", payload);
  },
});
