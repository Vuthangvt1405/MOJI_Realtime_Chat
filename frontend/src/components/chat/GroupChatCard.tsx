import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import ChatCard from "./ChatCard";
import UnreadCountBadge from "./UnreadCountBadge";
import GroupChatAvatar from "./GroupChatAvatar";
import { toast } from "sonner";

const GroupChatCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const {
    activeConversationId,
    setActiveConversation,
    messages,
    fetchMessages,
    clearConversation,
  } = useChatStore();

  if (!user) return null;

  const unreadCount = convo.unreadCounts[user._id];
  const name = convo.group?.name ?? "";
  const lastMessageContent = convo.lastMessage?.content;
  const subtitleText = lastMessageContent || `${convo.participants.length} thành viên`;
  const handleSelectConversation = async (id: string) => {
    setActiveConversation(id);
    if (!messages[id]) {
      await fetchMessages();
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const confirmed = window.confirm(
      `Xóa đoạn chat nhóm "${name}" ở phía bạn?\n\nTin nhắn cũ sẽ bị ẩn cho bạn cho đến khi có tin nhắn mới.`,
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
      name={name}
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
          {unreadCount > 0 && <UnreadCountBadge unreadCount={unreadCount} />}
          <GroupChatAvatar
            participants={convo.participants}
            type="chat"
          />
        </>
      }
      subtitle={
        <p
          className={cn(
            "text-sm truncate",
            unreadCount > 0
              ? "font-bold text-black dark:text-white"
              : "text-muted-foreground",
          )}
        >
          {subtitleText}
        </p>
      }
      onDelete={handleDeleteConversation}
    />
  );
};

export default GroupChatCard;
