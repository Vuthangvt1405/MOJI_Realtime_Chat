import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSocketStore } from "@/stores/useSocketStore";

import { CALL_FEATURE_ENABLED } from "../config";
import { useCallStore } from "../useCallStore";

interface CallButtonProps {
  conversationId: string;
  peerUserId: string;
  isOnline: boolean;
}

const CallButton = ({ conversationId, peerUserId, isOnline }: CallButtonProps) => {
  const { socket } = useSocketStore();
  const { status, startOutgoingCall } = useCallStore();

  if (!CALL_FEATURE_ENABLED) {
    return null;
  }

  const disabled = !socket || status !== "idle" || !isOnline;

  const handleStartCall = () => {
    if (disabled || !socket) {
      return;
    }

    const callId = crypto.randomUUID();

    startOutgoingCall({
      callId,
      conversationId,
      peerUserId,
      callType: "video",
    });

    socket.emit("call:request", {
      callId,
      toUserId: peerUserId,
      conversationId,
      callType: "video",
    });
  };

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      onClick={handleStartCall}
      disabled={disabled}
      title={isOnline ? "Gọi video" : "Bạn bè đang offline"}
      className={cn(
        "rounded-full",
        isOnline ? "text-primary hover:text-primary" : "text-muted-foreground",
      )}
    >
      <Phone className="size-4" />
    </Button>
  );
};

export default CallButton;
