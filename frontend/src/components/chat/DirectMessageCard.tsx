import type { Conversation } from "@/types/chat";
import ChatCard from "./ChatCard";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import UnreadCountBadge from "./UnreadCountBadge";
import { useSocketStore } from "@/stores/useSocketStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { Badge } from "../ui/badge";
import { toast } from "sonner";

const DirectMessageCard = ({
  convo,
  friendsReady,
}: {
  convo: Conversation;
  friendsReady: boolean;
}) => {
  const { user } = useAuthStore();
  const {
    activeConversationId,
    setActiveConversation,
    messages,
    fetchMessages,
    clearConversation,
  } = useChatStore();
  const { onlineUsers } = useSocketStore();
  const { friends } = useFriendStore();

  if (!user) return null;

  const otherUser = convo.participants.find((p) => p._id !== user._id);
  if (!otherUser) return null;

  const isFriend = friends.some((friend) => friend._id === otherUser._id);
  const showStrangerTag = friendsReady && !isFriend;

  const unreadCount = convo.unreadCounts[user._id] ?? 0;
  const lastMessage = convo.lastMessage?.content ?? "";

  const handleSelectConversation = async (id: string) => {
    setActiveConversation(id);
    if (!messages[id]) {
      await fetchMessages();
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const confirmed = window.confirm(
      `Xóa đoạn chat với ${otherUser.displayName} ở phía bạn?\n\nTin nhắn cũ sẽ bị ẩn cho bạn cho đến khi có tin nhắn mới.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await clearConversation(conversationId);
      toast.success("Đã xóa đoạn chat ở phía bạn");
    } catch (error) {
      const apiError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      const message =
        apiError.response?.data?.message ||
        apiError.message ||
        "Lỗi xảy ra khi xóa đoạn chat. Hãy thử lại";

      toast.error(message);
    }
  };

  return (
    <ChatCard
      convoId={convo._id}
      name={otherUser.displayName ?? ""}
      nameTag={
        showStrangerTag ? (
          <Badge className="shrink-0 border-amber-300/80 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200">
            stranger
          </Badge>
        ) : undefined
      }
      timestamp={
        convo.lastMessage?.createdAt
          ? new Date(convo.lastMessage.createdAt)
          : undefined
      }
      isActive={activeConversationId === convo._id}
      onSelect={handleSelectConversation}
      unreadCount={unreadCount}
      leftSection={
        <>
          <UserAvatar
            type="sidebar"
            name={otherUser.displayName ?? ""}
            avatarUrl={otherUser.avatarUrl ?? undefined}
          />
          <StatusBadge
            status={
              onlineUsers.includes(otherUser?._id ?? "") ? "online" : "offline"
            }
          />
          {unreadCount > 0 && <UnreadCountBadge unreadCount={unreadCount} />}
        </>
      }
      subtitle={
        <p
          className={cn(
            "text-sm truncate",
            unreadCount > 0
              ? "font-bold text-black dark:text-white"
              : "text-muted-foreground"
          )}
        >
          {lastMessage}
        </p>
      }
      onDelete={handleDeleteConversation}
    />
  );
};

export default DirectMessageCard;
