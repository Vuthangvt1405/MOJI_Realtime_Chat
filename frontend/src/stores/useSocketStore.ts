import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "./useAuthStore";
import type { SocketState } from "@/types/store";
import { useChatStore } from "./useChatStore";

const baseURL = import.meta.env.VITE_SOCKET_URL;

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    if (existingSocket) return; // tránh tạo nhiều socket

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    let syncMissingConversationPromise: Promise<void> | null = null;

    const ensureConversationInStore = async (conversationId: string) => {
      const conversationExists = useChatStore
        .getState()
        .conversations.some((conversation) => conversation._id === conversationId);

      if (conversationExists) {
        return;
      }

      if (!syncMissingConversationPromise) {
        syncMissingConversationPromise = useChatStore
          .getState()
          .fetchConversations()
          .finally(() => {
            syncMissingConversationPromise = null;
          });
      }

      await syncMissingConversationPromise;
    };

    set({ socket });

    socket.on("connect", () => {
      console.log("Đã kết nối với socket");

      useChatStore
        .getState()
        .fetchConversations()
        .catch((error) => {
          console.error("Lỗi đồng bộ conversations khi socket kết nối", error);
        });
    });

    // online users
    socket.on("online-users", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // new message
    socket.on("new-message", async ({ message, conversation, unreadCounts }) => {
      const conversationId =
        typeof conversation?._id === "string"
          ? conversation._id
          : conversation?._id?.toString();

      if (conversationId) {
        try {
          await ensureConversationInStore(conversationId);
        } catch (error) {
          console.error("Lỗi đồng bộ conversation bị thiếu", error);
        }
      }

      useChatStore.getState().addMessage(message);

      const lastMessage = {
        _id: conversation.lastMessage._id,
        content: conversation.lastMessage.content,
        createdAt: conversation.lastMessage.createdAt,
        sender: {
          _id: conversation.lastMessage.senderId,
          displayName: "",
          avatarUrl: null,
        },
      };

      const updatedConversation = {
        ...conversation,
        lastMessage,
        unreadCounts,
      };

      if (useChatStore.getState().activeConversationId === message.conversationId) {
        useChatStore.getState().markAsSeen();
      }

      useChatStore.getState().updateConversation(updatedConversation);
    });

    // read message
    socket.on("read-message", ({ conversation, lastMessage }) => {
      const updated = {
        _id: conversation._id,
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
      };

      useChatStore.getState().updateConversation(updated);
    });

    // new group chat
    socket.on("new-group", (conversation) => {
      useChatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });
  },
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
