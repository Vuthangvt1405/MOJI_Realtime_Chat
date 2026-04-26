import { Card } from "@/components/ui/card";
import { formatOnlineTime, cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";

interface ChatCardProps {
  convoId: string;
  name: string;
  nameTag?: React.ReactNode;
  timestamp?: Date;
  isActive: boolean;
  onSelect: (id: string) => void;
  unreadCount?: number;
  leftSection: React.ReactNode;
  subtitle: React.ReactNode;
  onDelete?: (id: string) => Promise<void> | void;
}

const ChatCard = ({
  convoId,
  name,
  nameTag,
  timestamp,
  isActive,
  onSelect,
  unreadCount,
  leftSection,
  subtitle,
  onDelete,
}: ChatCardProps) => {
  return (
    <Card
      key={convoId}
      className={cn(
        "group border-none p-3 cursor-pointer transition-smooth glass hover:bg-muted/30",
        isActive &&
          "ring-2 ring-primary/50 bg-gradient-to-tr from-primary-glow/10 to-primary-foreground"
      )}
      onClick={() => onSelect(convoId)}
    >
      <div className="flex items-center gap-3">
        <div className="relative">{leftSection}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3
                className={cn(
                  "font-semibold text-sm truncate flex-1 min-w-0",
                  unreadCount && unreadCount > 0 && "text-foreground"
                )}
              >
                {name}
              </h3>
              {nameTag}
            </div>

            <span className="text-xs text-muted-foreground shrink-0">
              {timestamp ? formatOnlineTime(timestamp) : ""}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-1 min-w-0">{subtitle}</div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-sm p-1"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  aria-label={`Tùy chọn đoạn chat ${name}`}
                >
                  <MoreHorizontal className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 hover:size-5 transition-smooth" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <DropdownMenuItem
                  variant="destructive"
                  disabled={!onDelete}
                  onSelect={(event) => {
                    event.stopPropagation();

                    if (!onDelete) {
                      return;
                    }

                    void onDelete(convoId);
                  }}
                >
                  <Trash2 className="text-muted-foreground dark:group-focus:!text-accent-foreground" />
                  Xóa đoạn chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChatCard;
