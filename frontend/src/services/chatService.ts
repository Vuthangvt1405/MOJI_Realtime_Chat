import api from "@/lib/axios";
import type { ConversationResponse, Message, MessageReactionUpdate } from "@/types/chat";

interface FetchMessageProps {
  messages: Message[];
  cursor?: string;
}

const pageLimit = 50;

/**
 * Chat API service for conversation and message HTTP requests.
 * Each method corresponds to a backend route.
 */
export const chatService = {
  /**
   * Purpose:
   * Fetches the authenticated user's full conversation list.
   *
   * How it works:
   * Sends GET /conversations, returns parsed response with unread metadata.
   *
   * Parameters:
   * none
   *
   * Returns:
   * Promise<ConversationResponse> with conversations array.
   */
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversations");
    return res.data;
  },

  /**
   * Purpose:
   * Fetches paginated messages for a conversation.
   *
   * How it works:
   * Sends GET /conversations/:id/messages with cursor for pagination.
   *
   * Parameters:
   * - id: conversation ID
   * - cursor: optional pagination cursor for next page
   *
   * Returns:
   * Promise<FetchMessageProps> with messages array and optional next cursor.
   */
  async fetchMessages(id: string, cursor?: string): Promise<FetchMessageProps> {
    const res = await api.get(
      `/conversations/${id}/messages?limit=${pageLimit}&cursor=${cursor}`
    );

    return { messages: res.data.messages, cursor: res.data.nextCursor };
  },

  /**
   * Purpose:
   * Uploads an image file to the server before sending a message.
   *
   * How it works:
   * Sends POST /messages/upload with multipart/form-data, returns the
   * image URL from the server response.
   *
   * Parameters:
   * - formData: FormData containing the image file
   *
   * Returns:
   * Object with imgUrl string.
   */
  async uploadMessageImage(formData: FormData) {
    const res = await api.post("/messages/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },

  /**
   * Purpose:
   * Sends a direct message to another user via API.
   *
   * How it works:
   * Sends POST /messages/direct with recipient, content, images, and
   * optional existing conversationId.
   *
   * Parameters:
   * - recipientId: target user ID
   * - content: text content (default "")
   * - imgUrls: optional image URL array
   * - conversationId: optional existing conversation ID
   *
   * Returns:
   * Promise with the saved message object.
   */
  async sendDirectMessage(
    recipientId: string,
    content: string = "",
    imgUrls?: string[],
    conversationId?: string
  ) {
    const res = await api.post("/messages/direct", {
      recipientId,
      content,
      imgUrls,
      conversationId,
    });

    return res.data.message;
  },

  /**
   * Purpose:
   * Sends a message to a group conversation via API.
   *
   * How it works:
   * Sends POST /messages/group with conversationId, content, and images.
   *
   * Parameters:
   * - conversationId: group conversation ID
   * - content: text content (default "")
   * - imgUrls: optional image URL array
   *
   * Returns:
   * Promise with the saved message object.
   */
  async sendGroupMessage(
    conversationId: string,
    content: string = "",
    imgUrls?: string[]
  ) {
    const res = await api.post("/messages/group", {
      conversationId,
      content,
      imgUrls,
    });
    return res.data.message;
  },

  /**
   * Purpose:
   * Adds or replaces the current user's reaction on a message.
   *
   * How it works:
   * Sends PUT /messages/:messageId/reaction with the selected emoji and returns
   * the backend's reaction summary update.
   *
   * Parameters:
   * - messageId: message receiving the reaction
   * - emoji: supported quick reaction emoji
   *
   * Returns:
   * Promise<MessageReactionUpdate> with formatted reaction summaries.
   */
  async setMessageReaction(
    messageId: string,
    emoji: string
  ): Promise<MessageReactionUpdate> {
    const res = await api.put(`/messages/${messageId}/reaction`, { emoji });
    return res.data;
  },

  /**
   * Purpose:
   * Removes the current user's reaction from a message.
   *
   * How it works:
   * Sends DELETE /messages/:messageId/reaction and returns the backend's updated
   * reaction summary payload.
   *
   * Parameters:
   * - messageId: message whose current-user reaction should be removed
   *
   * Returns:
   * Promise<MessageReactionUpdate> with formatted reaction summaries.
   */
  async removeMessageReaction(messageId: string): Promise<MessageReactionUpdate> {
    const res = await api.delete(`/messages/${messageId}/reaction`);
    return res.data;
  },

  /**
   * Purpose:
   * Marks a conversation as read (resets unread count for current user).
   *
   * How it works:
   * Sends PATCH /conversations/:conversationId/seen.
   *
   * Parameters:
   * - conversationId: conversation to mark as read
   *
   * Returns:
   * Promise with seen status and updated unread count.
   */
  async markAsSeen(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/seen`);
    return res.data;
  },

  /**
   * Purpose:
   * Soft-deletes a conversation from the current user's view.
   *
   * How it works:
   * Sends PATCH /conversations/:conversationId/clear.
   *
   * Parameters:
   * - conversationId: conversation to clear
   *
   * Returns:
   * Promise with success message and clearedAt timestamp.
   */
  async clearConversation(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/clear`);
    return res.data;
  },

  /**
   * Purpose:
   * Creates a new conversation (direct or group) via API.
   *
   * How it works:
   * Sends POST /conversations with type, name, and memberIds.
   *
   * Parameters:
   * - type: "direct" or "group"
   * - name: group name (ignored for direct)
   * - memberIds: array of participant user IDs
   *
   * Returns:
   * Promise with the created conversation object.
   */
  async createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[]
  ) {
    const res = await api.post("/conversations", { type, name, memberIds });
    return res.data.conversation;
  },
};
