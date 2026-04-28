import { type MouseEvent } from "react";
import { useFriendStore } from "@/stores/useFriendStore";
import { DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MessageCircleMore, Trash2, Users } from "lucide-react";
import { Card } from "../ui/card";
import UserAvatar from "../chat/UserAvatar";
import { useChatStore } from "@/stores/useChatStore";
import { Button } from "../ui/button";
import { toast } from "sonner";

const FriendListModal = () => {
  const { friends, deleteFriend, loading } = useFriendStore();
  const { createConversation } = useChatStore();

  const handleAddConversation = async (friendId: string) => {
    await createConversation("direct", "", [friendId]);
  };

  const handleDeleteFriend = async (
    e: MouseEvent<HTMLButtonElement>,
    friendId: string,
    displayName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa ${displayName} khỏi danh sách bạn bè không?`
    );

    if (!confirmed) return;

    try {
      await deleteFriend(friendId);
      toast.success("Đã xóa bạn bè thành công");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Lỗi xảy ra khi xóa bạn. Hãy thử lại";

      toast.error(message);
    }
  };

  return (
    <DialogContent className="glass max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl capitalize">
          <MessageCircleMore className="size-5" />
          bắt đầu hội thoại mới
        </DialogTitle>
      </DialogHeader>

      {/* friends list */}
      <div className="space-y-4">
        <h1 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          danh sách bạn bè
        </h1>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {friends.map((friend) => (
            <Card
              onClick={() => handleAddConversation(friend._id)}
              key={friend._id}
              className="p-3 cursor-pointer transition-smooth hover:shadow-soft glass hover:bg-muted/30 group/friendCard"
            >
              <div className="flex items-center gap-3">
                {/* avatar */}
                <div className="relative">
                  <UserAvatar
                    type="sidebar"
                    name={friend.displayName}
                    avatarUrl={friend.avatarUrl}
                  />
                </div>

                {/* info */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <h2 className="font-semibold text-sm truncate">
                    {friend.displayName}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    @{friend.username}
                  </span>
                </div>

                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  title="Xóa bạn"
                  aria-label={`Xóa bạn ${friend.displayName}`}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) =>
                    handleDeleteFriend(e, friend._id, friend.displayName)
                  }
                  disabled={loading}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}

          {friends.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-12 mx-auto mb-3 opacity-50" />
              Chưa có bạn bè. Thêm bạn vô để tám!
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
};

export default FriendListModal;
