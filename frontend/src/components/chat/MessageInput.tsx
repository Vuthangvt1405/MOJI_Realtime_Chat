import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/chat";
import { ImagePlus, Loader2, RefreshCw, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";

const MAX_ATTACHMENTS = 6;

type AttachmentStatus = "uploading" | "uploaded" | "error";

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  status: AttachmentStatus;
  imgUrl: string | null;
}

const MessageInput = ({ selectedConvo }: { selectedConvo: Conversation }) => {
  const { user } = useAuthStore();
  const { sendDirectMessage, sendGroupMessage } = useChatStore();
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return;

  const clearAttachments = () => {
    setAttachments((prev) => {
      prev.forEach((attachment) => {
        URL.revokeObjectURL(attachment.previewUrl);
      });

      return [];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadAttachment = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await chatService.uploadMessageImage(formData);
      const uploadedUrl = typeof data?.imgUrl === "string" ? data.imgUrl : null;

      if (!uploadedUrl) {
        throw new Error("Image host không trả về URL hợp lệ");
      }

      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === id
            ? { ...attachment, status: "uploaded", imgUrl: uploadedUrl }
            : attachment,
        ),
      );
    } catch (error) {
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === id
            ? {
                ...attachment,
                status: "error",
                imgUrl: null,
              }
            : attachment,
        ),
      );

      const apiError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      const message =
        apiError.response?.data?.message ||
        apiError.message ||
        "Upload hình ảnh thất bại";

      toast.error(message);
    }
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) {
      return;
    }

    const remain = MAX_ATTACHMENTS - attachments.length;

    if (remain <= 0) {
      toast.warning(`Tối đa ${MAX_ATTACHMENTS} ảnh trong một tin nhắn`);
      e.target.value = "";
      return;
    }

    const selectedFiles = files.slice(0, remain);

    if (files.length > remain) {
      toast.warning(`Chỉ lấy ${remain} ảnh đầu tiên`);
    }

    for (const file of selectedFiles) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} không phải file ảnh`);
        continue;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);

      setAttachments((prev) => [
        ...prev,
        {
          id,
          file,
          previewUrl,
          status: "uploading",
          imgUrl: null,
        },
      ]);

      await uploadAttachment(id, file);
    }

    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((attachment) => attachment.id === id);

      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return prev.filter((attachment) => attachment.id !== id);
    });
  };

  const retryAttachment = async (id: string) => {
    const target = attachments.find((attachment) => attachment.id === id);

    if (!target) {
      return;
    }

    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === id
          ? { ...attachment, status: "uploading", imgUrl: null }
          : attachment,
      ),
    );

    await uploadAttachment(id, target.file);
  };

  const sendMessage = async () => {
    const trimmedValue = value.trim();
    const hasUploadingImage = attachments.some(
      (attachment) => attachment.status === "uploading",
    );
    const hasFailedImage = attachments.some(
      (attachment) => attachment.status === "error",
    );

    const imageUrls = attachments
      .filter(
        (attachment) => attachment.status === "uploaded" && attachment.imgUrl,
      )
      .map((attachment) => attachment.imgUrl as string);

    if (hasUploadingImage) {
      toast.info("Vui lòng chờ ảnh upload xong trước khi gửi");
      return;
    }

    if (hasFailedImage) {
      toast.error("Có ảnh upload thất bại. Hãy retry hoặc xóa ảnh lỗi");
      return;
    }

    if (!trimmedValue && imageUrls.length === 0) {
      return;
    }

    if (isSending) {
      return;
    }

    setIsSending(true);

    try {
      if (selectedConvo.type === "direct") {
        const participants = selectedConvo.participants;
        const otherUser = participants.filter((p) => p._id !== user._id)[0];

        if (!otherUser) {
          toast.error("Không xác định được người nhận");
          return;
        }

        await sendDirectMessage(otherUser._id, trimmedValue, imageUrls);
      } else {
        await sendGroupMessage(selectedConvo._id, trimmedValue, imageUrls);
      }

      setValue("");
      clearAttachments();
    } catch (error) {
      const apiError = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      const message =
        apiError.response?.data?.message ||
        apiError.message ||
        "Lỗi xảy ra khi gửi tin nhắn. Bạn hãy thử lại!";

      console.error(error);

      if (message === "Bạn chưa kết bạn với người này") {
        toast.warning("Người này hiện là stranger. Bạn chưa thể gửi tin nhắn.");
        return;
      }

      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasUploadingImage = attachments.some(
    (attachment) => attachment.status === "uploading",
  );
  const hasFailedImage = attachments.some(
    (attachment) => attachment.status === "error",
  );
  const hasUploadedImage = attachments.some(
    (attachment) => attachment.status === "uploaded" && attachment.imgUrl,
  );

  const disableSend =
    isSending ||
    hasUploadingImage ||
    hasFailedImage ||
    (!value.trim() && !hasUploadedImage);

  return (
    <div className="p-3 bg-background">
      {attachments.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {attachments.length}/{MAX_ATTACHMENTS} ảnh
            </span>
            {hasUploadingImage && (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                Đang upload
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/30"
              >
                <img
                  src={attachment.previewUrl}
                  alt="image-preview"
                  className="max-h-full max-w-full object-contain"
                />

                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute right-1 top-1 z-20 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <X className="size-3" />
                </button>

                {attachment.status === "error" && (
                  <button
                    type="button"
                    onClick={() => retryAttachment(attachment.id)}
                    className="absolute inset-0 z-10 flex items-center justify-center gap-1 bg-black/55 text-xs font-medium text-white"
                  >
                    <RefreshCw className="size-3" />
                    Retry
                  </button>
                )}

                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 px-1 py-0.5 text-[10px] text-white",
                    attachment.status === "uploaded"
                      ? "bg-emerald-600/90"
                      : attachment.status === "error"
                        ? "bg-destructive/90"
                        : "bg-black/70",
                  )}
                >
                  {attachment.status === "uploading" && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  {attachment.status === "uploaded" && "Uploaded"}
                  {attachment.status === "uploading" && "Uploading"}
                  {attachment.status === "error" && "Failed"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 min-h-[56px]">
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-smooth"
          onClick={handleOpenFilePicker}
          disabled={isSending || attachments.length >= MAX_ATTACHMENTS}
        >
          <ImagePlus className="size-4" />
        </Button>

        <div className="flex-1 relative">
          <Input
            onKeyPress={handleKeyPress}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Soạn tin nhắn..."
            className="pr-20 h-9 bg-white border-border/50 focus:border-primary/50 transition-smooth resize-none"
          ></Input>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-primary/10 transition-smooth"
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => setValue(`${value}${emoji}`)}
                />
              </div>
            </Button>
          </div>
        </div>

        <Button
          onClick={sendMessage}
          className="bg-gradient-chat hover:shadow-glow transition-smooth hover:scale-105"
          disabled={disableSend}
        >
          {isSending ? (
            <Loader2 className="size-4 text-white animate-spin" />
          ) : (
            <Send className="size-4 text-white" />
          )}
        </Button>
      </div>

      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/*"
        multiple
      />
    </div>
  );
};

export default MessageInput;
