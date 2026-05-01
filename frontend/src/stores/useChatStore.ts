import { chatService } from "@/services/chatService";
import type { ChatState } from "@/types/store";
import type {
  Conversation,
  MessageReactionSummary,
  MessageReactionUpdate,
} from "@/types/chat";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "./useAuthStore";
import { useSocketStore } from "./useSocketStore";

/**
 * Purpose:
 * Builds reaction summaries that are correct for the current client.
 *
 * How it works:
 * It ignores the incoming reactedByMe flag from REST or socket payloads and
 * derives it from whether the current user's ID appears in each reaction user list.
 *
 * Parameters:
 * - update: reaction update payload from REST or Socket.IO
 * - currentUserId: authenticated user's ID, or undefined when logged out
 *
 * Returns:
 * A reaction summary array with client-specific reactedByMe values.
 */
function getClientReactionSummaries(
  update: MessageReactionUpdate,
  currentUserId?: string,
): MessageReactionSummary[] {
  return update.reactions.map((reaction) => ({
    ...reaction,
    reactedByMe: currentUserId
      ? reaction.users.some((user) => user._id === currentUserId)
      : false,
  }));
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      convoLoading: false, // convo loading
      messageLoading: false,
      loading: false,

      /**
       * Purpose:
       * Sets the currently active conversation ID.
       *
       * How it works:
       * Updates Zustand state to track which conversation is open.
       *
       * Parameters:
       * - id: conversation ID string
       *
       * Returns:
       * void
       */
      setActiveConversation: (id) => set({ activeConversationId: id }),
      /**
       * Purpose:
       * Resets the entire chat store to initial state.
       *
       * How it works:
       * Clears conversations, messages, activeConversationId, and loading flags.
       *
       * Parameters:
       * none
       *
       * Returns:
       * void
       */
      reset: () => {
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          convoLoading: false,
          messageLoading: false,
        });
      },
      /**
       * Purpose:
       * Loads the user's conversation list from the API.
       *
       * How it works:
       * Calls chatService.fetchConversations, stores result, and emits
       * socket join-conversation for each conversation to receive realtime updates.
       *
       * Parameters:
       * none
       *
       * Returns:
       * Promise<void>
       */
      fetchConversations: async () => {
        try {
          set({ convoLoading: true });
          const { conversations } = await chatService.fetchConversations();

          set({ conversations, convoLoading: false });

          const socket = useSocketStore.getState().socket;

          if (socket) {
            conversations.forEach((conversation) => {
              socket.emit("join-conversation", conversation._id);
            });
          }
        } catch (error) {
          console.error("Lỗi xảy ra khi fetchConversations:", error);
          set({ convoLoading: false });
        }
      },
      /**
       * Purpose:
       * Loads paginated messages for a conversation (with cursor support).
       *
       * How it works:
       * Gets nextCursor from existing state, calls chatService.fetchMessages,
       * merges fetched messages with existing ones, marking own messages.
       *
       * Parameters:
       * - conversationId: optional override; defaults to activeConversationId
       *
       * Returns:
       * Promise<void>
       */
      fetchMessages: async (conversationId) => {
        const { activeConversationId, messages } = get();
        const { user } = useAuthStore.getState();

        const convoId = conversationId ?? activeConversationId;

        if (!convoId) return;

        const current = messages?.[convoId];
        const nextCursor =
          current?.nextCursor === undefined ? "" : current?.nextCursor;

        if (nextCursor === null) return;

        set({ messageLoading: true });

        try {
          const { messages: fetched, cursor } = await chatService.fetchMessages(
            convoId,
            nextCursor,
          );

          const processed = fetched.map((m) => ({
            ...m,
            isOwn: m.senderId === user?._id,
          }));

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const merged =
              prev.length > 0 ? [...processed, ...prev] : processed;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: merged,
                  hasMore: !!cursor,
                  nextCursor: cursor ?? null,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy ra khi fetchMessages:", error);
        } finally {
          set({ messageLoading: false });
        }
      },
      /**
       * Purpose:
       * Sends a direct message to another user.
       *
       * How it works:
       * Calls chatService.sendDirectMessage with current recipient/content/images,
       * then optimistically clears seenBy for the active conversation.
       *
       * Parameters:
       * - recipientId: target user ID
       * - content: text content
       * - imgUrls: optional image URL array
       *
       * Returns:
       * Promise<void>
       */
      sendDirectMessage: async (recipientId, content, imgUrls) => {
        try {
          const { activeConversationId } = get();
          await chatService.sendDirectMessage(
            recipientId,
            content,
            imgUrls,
            activeConversationId || undefined,
          );
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId ? { ...c, seenBy: [] } : c,
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gửi direct message", error);
          throw error;
        }
      },
      /**
       * Purpose:
       * Sends a message to a group conversation.
       *
       * How it works:
       * Calls chatService.sendGroupMessage, then optimistically clears seenBy
       * for the active conversation in local state.
       *
       * Parameters:
       * - conversationId: group conversation ID
       * - content: text content
       * - imgUrls: optional image URL array
       *
       * Returns:
       * Promise<void>
       */
      sendGroupMessage: async (conversationId, content, imgUrls) => {
        try {
          await chatService.sendGroupMessage(conversationId, content, imgUrls);
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === get().activeConversationId ? { ...c, seenBy: [] } : c,
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra gửi group message", error);
          throw error;
        }
      },
      /**
       * Purpose:
       * Adds a received message to the local store (from socket event).
       *
       * How it works:
       * Marks isOwn based on current user, fetches conversation messages if
       * not yet loaded, appends message to the conversation's message array
       * while avoiding duplicates.
       *
       * Parameters:
       * - message: incoming message object from socket
       *
       * Returns:
       * Promise<void>
       */
      addMessage: async (message) => {
        try {
          const { user } = useAuthStore.getState();
          const { fetchMessages } = get();

          message.isOwn = message.senderId === user?._id;

          const convoId = message.conversationId;

          let prevItems = get().messages[convoId]?.items ?? [];

          if (prevItems.length === 0) {
            await fetchMessages(message.conversationId);
            prevItems = get().messages[convoId]?.items ?? [];
          }

          set((state) => {
            if (prevItems.some((m) => m._id === message._id)) {
              return state;
            }

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: [...prevItems, message],
                  hasMore: state.messages[convoId].hasMore,
                  nextCursor: state.messages[convoId].nextCursor ?? undefined,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy khi ra add message:", error);
        }
      },
      /**
       * Purpose:
       * Adds or replaces the current user's reaction on a message.
       *
       * How it works:
       * Calls the reaction API, then applies the returned reaction summary
       * (reactions + conversation preview/unread counts) to the store.
       *
       * Parameters:
       * - messageId: message receiving the reaction
       * - emoji: selected quick reaction emoji
       *
       * Returns:
       * Promise<void>
       */
      setMessageReaction: async (messageId, emoji) => {
        try {
          const update = await chatService.setMessageReaction(messageId, emoji);
          get().applyMessageReactionUpdate(update);
        } catch (error) {
          console.error("Lỗi xảy ra khi reaction message:", error);
          throw error;
        }
      },
      /**
       * Purpose:
       * Removes the current user's reaction from a message.
       *
       * How it works:
       * Calls the reaction removal API, then applies the returned reaction
       * summary to the matching loaded message only.
       *
       * Parameters:
       * - messageId: message whose reaction should be removed
       *
       * Returns:
       * Promise<void>
       */
      removeMessageReaction: async (messageId) => {
        try {
          const update = await chatService.removeMessageReaction(messageId);
          get().applyMessageReactionUpdate(update);
        } catch (error) {
          console.error("Lỗi xảy ra khi xóa reaction message:", error);
          throw error;
        }
      },
      /**
       * Purpose:
       * Applies a reaction summary update to one loaded message, and updates
       * sidebar conversation metadata (preview, unread counts, sort order).
       *
       * How it works:
       * Normalizes incoming raw lastMessage into frontend sender format, merges
       * unreadCounts, re-sorts conversations by lastMessageAt descending, and
       * updates the target message's reactions if messages are loaded.
       * Conversation metadata is always applied even when messages are not loaded,
       * so the sidebar badge/preview updates immediately.
       *
       * Parameters:
       * - update: reaction update payload from REST or Socket.IO
       *
       * Returns:
       * void
       */
      applyMessageReactionUpdate: (update) => {
        const { user } = useAuthStore.getState();
        const reactions = getClientReactionSummaries(update, user?._id);

        set((state) => {
          const conversations = [...state.conversations];
          const index = conversations.findIndex((c) => c._id === update.conversationId);
          if (index === -1) return state;

          const conversation = { ...conversations[index] };

          if (update.conversation?.lastMessage) {
            const raw = update.conversation.lastMessage;
            conversation.lastMessage = {
              _id: raw._id,
              content: raw.content ?? "",
              createdAt: raw.createdAt,
              sender: {
                _id: raw.senderId || "",
                displayName: "",
                avatarUrl: null,
              },
            };
            conversation.lastMessageAt = update.conversation.lastMessageAt;
          }

          if (update.unreadCounts) {
            conversation.unreadCounts = update.unreadCounts;
          }

          conversations[index] = conversation;

          conversations.sort(
            (a, b) =>
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              new Date(b.lastMessageAt).getTime() -
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              new Date(a.lastMessageAt).getTime(),
          );

          const messages = state.messages[update.conversationId];
          if (messages) {
            const msgIndex = messages.items.findIndex((m) => m._id === update.messageId);
            if (msgIndex !== -1) {
              const updatedItems = [...messages.items];
              updatedItems[msgIndex] = { ...updatedItems[msgIndex], reactions };

              return {
                conversations,
                messages: {
                  ...state.messages,
                  [update.conversationId]: {
                    ...messages,
                    items: updatedItems,
                  },
                },
              };
            }
          }

          return { conversations };
        });
      },
      /**
       * Purpose:
       * Merges updated conversation data into the local conversations list.
       *
       * How it works:
       * Finds conversation by _id and shallow-merges the partial update.
       *
       * Parameters:
       * - conversation: partial conversation with at least _id
       *
       * Returns:
       * void
       */
      updateConversation: (conversation: Partial<Conversation>) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversation._id ? { ...c, ...conversation } : c,
          ),
        }));
      },
      /**
       * Purpose:
       * Marks the active conversation as seen (resets unread count).
       *
       * How it works:
       * Checks activeConversationId and current unread count, skips if zero,
       * calls chatService.markAsSeen, then updates local unread count to 0.
       *
       * Parameters:
       * none (uses activeConversationId from store state)
       *
       * Returns:
       * Promise<void>
       */
      markAsSeen: async () => {
        try {
          const { user } = useAuthStore.getState();
          const { activeConversationId, conversations } = get();

          if (!activeConversationId || !user) {
            return;
          }

          const convo = conversations.find(
            (c) => c._id === activeConversationId,
          );

          if (!convo) {
            return;
          }

          if ((convo.unreadCounts?.[user._id] ?? 0) === 0) {
            return;
          }

          await chatService.markAsSeen(activeConversationId);

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId && c.lastMessage
                ? {
                    ...c,
                    unreadCounts: {
                      ...c.unreadCounts,
                      [user._id]: 0,
                    },
                  }
                : c,
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gọi markAsSeen trong store", error);
        }
      },
      /**
       * Purpose:
       * Soft-deletes a conversation from the user's view.
       *
       * How it works:
       * Calls chatService.clearConversation, removes messages from local store,
       * removes conversation from list, clears activeConversationId if it matches.
       *
       * Parameters:
       * - conversationId: conversation to remove
       *
       * Returns:
       * Promise<void>
       */
      clearConversation: async (conversationId) => {
        try {
          await chatService.clearConversation(conversationId);

          set((state) => {
            const nextMessages = { ...state.messages };
            delete nextMessages[conversationId];

            return {
              conversations: state.conversations.filter((c) => c._id !== conversationId),
              messages: nextMessages,
              activeConversationId:
                state.activeConversationId === conversationId
                  ? null
                  : state.activeConversationId,
            };
          });
        } catch (error) {
          console.error("Lỗi xảy ra khi clear conversation trong store", error);
          throw error;
        }
      },
      /**
       * Purpose:
       * Adds a new conversation to the local list (from socket or creation).
       *
       * How it works:
       * Checks for duplicates, prepends if new, then sets it as active.
       *
       * Parameters:
       * - convo: conversation object to add
       *
       * Returns:
       * void
       */
      addConvo: (convo) => {
        set((state) => {
          const exists = state.conversations.some(
            (c) => c._id.toString() === convo._id.toString(),
          );

          return {
            conversations: exists
              ? state.conversations
              : [convo, ...state.conversations],
            activeConversationId: convo._id,
          };
        });
      },
      /**
       * Purpose:
       * Creates a new conversation (direct or group) via API.
       *
       * How it works:
       * Calls chatService.createConversation, adds result to local list,
       * emits socket join-conversation for realtime updates.
       *
       * Parameters:
       * - type: "direct" or "group"
       * - name: group name (ignored for direct)
       * - memberIds: array of participant user IDs
       *
       * Returns:
       * Promise<void>
       */
      createConversation: async (type, name, memberIds) => {
        try {
          set({ loading: true });
          const conversation = await chatService.createConversation(
            type,
            name,
            memberIds,
          );

          get().addConvo(conversation);

          useSocketStore
            .getState()
            .socket?.emit("join-conversation", conversation._id);
        } catch (error) {
          console.error(
            "Lỗi xảy ra khi gọi createConversation trong store",
            error,
          );
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({ conversations: state.conversations }),
    },
  ),
);
