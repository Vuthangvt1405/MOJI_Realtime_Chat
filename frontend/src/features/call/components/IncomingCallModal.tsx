import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChatStore } from "@/stores/useChatStore";

import { cleanupWebRtc } from "../webrtcService";
import { useCallStore } from "../useCallStore";

interface IncomingCallModalProps {
  socket: Socket | null;
}

const IncomingCallModal = ({ socket }: IncomingCallModalProps) => {
  const { conversations } = useChatStore();
  const {
    status,
    callId,
    conversationId,
    callType,
    peerUserId,
    setConnecting,
    setLocalStream,
    setRemoteStream,
    setEnded,
  } = useCallStore();

  const open = status === "incoming";

  const conversation =
    conversationId && conversations.length > 0
      ? conversations.find((item) => item._id === conversationId)
      : null;

  const callerName =
    conversation?.participants.find((participant) => participant._id === peerUserId)?.displayName ||
    "Cuộc gọi đến";

  const rejectCall = () => {
    if (socket && callId && peerUserId && conversationId) {
      socket.emit("call:reject", {
        callId,
        toUserId: peerUserId,
        conversationId,
        reason: "declined",
      });
    }

    cleanupWebRtc();
    setLocalStream(null);
    setRemoteStream(null);
    setEnded({ reason: "declined" });
  };

  const acceptCall = () => {
    if (!socket || !callId || !peerUserId || !conversationId) {
      return;
    }

    socket.emit("call:accept", {
      callId,
      toUserId: peerUserId,
      conversationId,
    });

    setConnecting();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          rejectCall();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cuộc gọi {callType === "video" ? "video" : "audio"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{callerName} đang gọi cho bạn.</p>

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={rejectCall}>
              Từ chối
            </Button>
            <Button onClick={acceptCall} disabled={!socket}>
              Chấp nhận
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IncomingCallModal;
