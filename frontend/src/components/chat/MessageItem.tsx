import { cn, formatMessageTime } from "@/lib/utils";
import type {
  Conversation,
  Message,
  MessageReactionSummary,
  Participant,
} from "@/types/chat";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useChatStore } from "@/stores/useChatStore";
import {
  getReactionAnimationEmoji,
  getReactionSignature,
} from "./messageReactionAnimation";
import UserAvatar from "./UserAvatar";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const EMPTY_REACTION_SUMMARIES: MessageReactionSummary[] = [];
const REACTION_ANIMATION_DURATION_MS = 700;

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  selectedConvo: Conversation;
  lastMessageStatus: "delivered" | "seen";
}

/**
 * Purpose:
 * Renders one chat message with text, attachments, reactions, grouping, and status.
 *
 * How it works:
 * It derives display grouping and image URLs, opens a local image preview, shows
 * the quick reaction bar on hover/focus/long-press, renders a compact reaction
 * summary pill, animates reaction updates, lifts the active row above adjacent
 * animated rows, and delegates reaction mutations to the chat store.
 *
 * Parameters:
 * - message: Chat message to render.
 * - index: Position of this message in the displayed message list.
 * - messages: Displayed messages used to compare adjacent message grouping.
 * - selectedConvo: Active conversation containing participants and last message metadata.
 * - lastMessageStatus: Delivery state shown for the user's latest message.
 *
 * Returns:
 * JSX for the message row and optional image preview dialog.
 */
const MessageItem = ({
  message,
  index,
  messages,
  selectedConvo,
  lastMessageStatus,
}: MessageItemProps) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isReactionBarOpen, setIsReactionBarOpen] = useState(false);
  const [isReactionAnimating, setIsReactionAnimating] = useState(false);
  const [animatedReactionEmoji, setAnimatedReactionEmoji] = useState<
    string | null
  >(null);
  const [reactionAnimationKey, setReactionAnimationKey] = useState(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousReactionSignatureRef = useRef<string | null>(null);
  const previousReactionSummariesRef = useRef<MessageReactionSummary[]>([]);
  const reactionAnimationTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const reactionAnimationFrameRef = useRef<number | null>(null);
  const setMessageReaction = useChatStore((state) => state.setMessageReaction);
  const removeMessageReaction = useChatStore(
    (state) => state.removeMessageReaction,
  );
  const prev = index + 1 < messages.length ? messages[index + 1] : undefined;

  const isShowTime =
    index === 0 ||
    new Date(message.createdAt).getTime() -
      new Date(prev?.createdAt || 0).getTime() >
      300000; // 5 phút

  const isGroupBreak = isShowTime || message.senderId !== prev?.senderId;

  const participant = selectedConvo.participants.find(
    (p: Participant) => p._id.toString() === message.senderId.toString(),
  );

  const imageUrls = (
    Array.isArray(message.imgUrls) && message.imgUrls.length > 0
      ? message.imgUrls
      : message.imgUrl
        ? [message.imgUrl]
        : []
  ).filter(
    (url): url is string => typeof url === "string" && url.trim() !== "",
  );

  const reactionSummaries = message.reactions ?? EMPTY_REACTION_SUMMARIES;
  const totalReactionCount = reactionSummaries.reduce(
    (total, reaction) => total + reaction.count,
    0,
  );
  const topReactionEmojis = [...reactionSummaries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((reaction) => reaction.emoji);
  const reactionUsers = reactionSummaries.flatMap((reaction) =>
    reaction.users.map((user) => ({ ...user, emoji: reaction.emoji })),
  );
  const hasReactions = totalReactionCount > 0;
  const reactedByMe = reactionSummaries.find(
    (reaction) => reaction.reactedByMe,
  );
  const reactionSignature = getReactionSignature(reactionSummaries);

  useEffect(() => {
    const previousSignature = previousReactionSignatureRef.current;
    const previousSummaries = previousReactionSummariesRef.current;

    previousReactionSignatureRef.current = reactionSignature;
    previousReactionSummariesRef.current = reactionSummaries;

    if (previousSignature === null || previousSignature === reactionSignature) {
      return;
    }

    const nextAnimationEmoji = getReactionAnimationEmoji(
      previousSummaries,
      reactionSummaries,
    );

    if (reactionAnimationTimerRef.current) {
      clearTimeout(reactionAnimationTimerRef.current);
      reactionAnimationTimerRef.current = null;
    }

    if (reactionAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(reactionAnimationFrameRef.current);
      reactionAnimationFrameRef.current = null;
    }

    if (!hasReactions || !nextAnimationEmoji) {
      setIsReactionAnimating(false);
      setAnimatedReactionEmoji(null);
      return;
    }

    setAnimatedReactionEmoji(nextAnimationEmoji);
    setIsReactionAnimating(false);

    reactionAnimationFrameRef.current = window.requestAnimationFrame(() => {
      reactionAnimationFrameRef.current = null;
      setReactionAnimationKey((key) => key + 1);
      setIsReactionAnimating(true);

      reactionAnimationTimerRef.current = setTimeout(() => {
        setIsReactionAnimating(false);
        reactionAnimationTimerRef.current = null;
      }, REACTION_ANIMATION_DURATION_MS);
    });
  }, [hasReactions, reactionSignature, reactionSummaries]);

  useEffect(() => {
    return () => {
      if (reactionAnimationTimerRef.current) {
        clearTimeout(reactionAnimationTimerRef.current);
      }

      if (reactionAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(reactionAnimationFrameRef.current);
      }
    };
  }, []);

  /**
   * Purpose:
   * Applies the user's selected quick reaction for this message.
   *
   * How it works:
   * Tapping the same emoji removes the reaction; tapping a different emoji
   * replaces it through the store's API-backed reaction action.
   *
   * Parameters:
   * - emoji: Quick reaction emoji selected by the user.
   *
   * Returns:
   * Promise<void>
   */
  const handleReactionSelect = async (emoji: string) => {
    try {
      if (reactedByMe?.emoji === emoji) {
        await removeMessageReaction(message._id);
      } else {
        await setMessageReaction(message._id, emoji);
      }

      setIsReactionBarOpen(false);
    } catch (error) {
      console.error("Lỗi khi reaction message:", error);
      toast.error("Reaction tin nhắn thất bại");
    }
  };

  /**
   * Purpose:
   * Opens the reaction bar after a mobile long press.
   *
   * How it works:
   * Starts a short timer on touch start and reveals the bar if touch is held.
   *
   * Parameters:
   * none
   *
   * Returns:
   * void
   */
  const startReactionLongPress = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsReactionBarOpen(true);
      longPressTimerRef.current = null;
    }, 450);
  };

  /**
   * Purpose:
   * Cancels a pending mobile long-press reaction gesture.
   *
   * How it works:
   * Clears the stored timeout when the user releases or cancels touch before the
   * long-press delay completes.
   *
   * Parameters:
   * none
   *
   * Returns:
   * void
   */
  const clearReactionLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <>
      {/* time */}
      {isShowTime && (
        <span className="flex justify-center text-xs text-muted-foreground px-1">
          {formatMessageTime(new Date(message.createdAt))}
        </span>
      )}

      <div
        className={cn(
          "relative z-0 hover:z-20 focus-within:z-20 flex gap-2 message-bounce mt-1",
          message.isOwn ? "justify-end" : "justify-start",
        )}
      >
        {/* avatar */}
        {!message.isOwn && (
          <div className="w-8">
            {isGroupBreak && (
              <UserAvatar
                type="chat"
                name={participant?.displayName ?? "Moji"}
                avatarUrl={participant?.avatarUrl ?? undefined}
              />
            )}
          </div>
        )}

        {/* tin nhắn */}
        <div
          className={cn(
            "max-w-xs lg:max-w-md space-y-1 flex flex-col",
            message.isOwn ? "items-end" : "items-start",
          )}
        >
          <div
            className={cn(
              "relative group focus:outline-none",
              hasReactions && "mb-3",
            )}
            tabIndex={0}
            aria-label="Message reaction controls"
            onTouchStart={startReactionLongPress}
            onTouchEnd={clearReactionLongPress}
            onTouchCancel={clearReactionLongPress}
          >
            <div
              className={cn(
                "absolute -top-9 z-50 flex items-center gap-1 rounded-full border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur transition-opacity",
                message.isOwn ? "right-0" : "left-0",
                isReactionBarOpen
                  ? "opacity-100"
                  : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
              )}
            >
              {QUICK_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReactionSelect(emoji)}
                  className={cn(
                    "flex size-8 cursor-pointer items-center justify-center rounded-full text-lg transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/40",
                    reactedByMe?.emoji === emoji &&
                      "bg-primary/15 ring-1 ring-primary/30",
                  )}
                  aria-label={`${reactedByMe?.emoji === emoji ? "Remove" : "React with"} ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <Card
              className={cn(
                "p-3",
                message.isOwn
                  ? "chat-bubble-sent border-0"
                  : "chat-bubble-received",
              )}
            >
              <div className="space-y-2">
                {imageUrls.length > 0 && (
                  <div
                    className={cn(
                      "grid gap-1.5",
                      imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2",
                    )}
                  >
                    {imageUrls.map((url, imageIndex) => (
                      <button
                        key={`${message._id}-image-${imageIndex}`}
                        type="button"
                        onClick={() => setPreviewImage(url)}
                        className="block cursor-pointer overflow-hidden rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40"
                        aria-label={`Preview attachment ${imageIndex + 1}`}
                      >
                        <img
                          src={url}
                          alt={`attachment-${imageIndex + 1}`}
                          className="h-auto w-full"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {message.content && (
                  <p className="text-sm leading-relaxed break-words">
                    {message.content}
                  </p>
                )}
              </div>
            </Card>

            {hasReactions && (
              <div
                className={cn(
                  "absolute -bottom-4 z-10",
                  message.isOwn ? "right-2" : "left-2",
                )}
              >
                {isReactionAnimating && animatedReactionEmoji && (
                  <span
                    key={reactionAnimationKey}
                    className="reaction-floating-emoji pointer-events-none absolute bottom-2 left-1/2 z-20 text-base leading-none drop-shadow-sm"
                    aria-hidden="true"
                  >
                    {animatedReactionEmoji}
                  </span>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative z-10 flex h-7 min-w-7 cursor-pointer items-center gap-0.5 rounded-full border border-border/60 bg-white px-1.5 text-xs shadow-[0_8px_20px_rgba(15,23,42,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-orange-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1 data-[state=open]:-translate-y-0.5 data-[state=open]:border-primary/50 data-[state=open]:bg-orange-50 data-[state=open]:text-primary data-[state=open]:shadow-lg",
                        reactedByMe &&
                          "border-primary/50 text-primary shadow-primary/15 ring-1 ring-primary/30",
                        isReactionAnimating && "reaction-pill-pop",
                      )}
                      aria-label={`${totalReactionCount} message reactions`}
                    >
                      {topReactionEmojis.map((emoji) => (
                        <span
                          key={emoji}
                          className="text-[13px] leading-none drop-shadow-sm"
                        >
                          {emoji}
                        </span>
                      ))}
                      {totalReactionCount > 1 && (
                        <span className="ml-0.5 rounded-full bg-muted/70 px-1 text-[11px] font-semibold leading-none text-muted-foreground">
                          {totalReactionCount}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align={message.isOwn ? "end" : "start"}
                    side="top"
                    sideOffset={8}
                    className="w-64 rounded-2xl border-border/70 bg-popover/95 p-3 shadow-xl backdrop-blur-md"
                  >
                    <p className="mb-2 text-sm font-semibold">Reactions</p>
                    <div className="mb-2 space-y-1 border-b pb-2">
                      <div className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm font-medium">
                        <span>All</span>
                        <span>{totalReactionCount}</span>
                      </div>
                      {reactionSummaries.map((reaction) => (
                        <div
                          key={reaction.emoji}
                          className={cn(
                            "flex items-center justify-between rounded-md px-1.5 py-1 text-sm",
                            reaction.reactedByMe && "bg-primary/10 text-primary",
                          )}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="max-h-56 space-y-1 overflow-y-auto">
                      {reactionUsers.map((user) => (
                        <div
                          key={`${user._id}-${user.emoji}`}
                          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm"
                        >
                          <UserAvatar
                            type="chat"
                            name={user.displayName}
                            avatarUrl={user.avatarUrl ?? undefined}
                            className="size-6 text-xs"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {user.displayName}
                          </span>
                          <span className="text-base leading-none">
                            {user.emoji}
                          </span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* seen/ delivered */}
          {message.isOwn && message._id === selectedConvo.lastMessage?._id && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-1.5 py-0.5 h-4 border-0",
                lastMessageStatus === "seen"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {lastMessageStatus}
            </Badge>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(previewImage)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImage(null);
          }
        }}
      >
        <DialogContent className="border-none bg-transparent p-0 shadow-none sm:max-w-4xl">
          <DialogTitle className="sr-only">Image preview</DialogTitle>
          {previewImage && (
            <img
              src={previewImage}
              alt="Image preview"
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MessageItem;
