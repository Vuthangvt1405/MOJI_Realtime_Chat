import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";

import { cleanupWebRtc, setTrackEnabled } from "../webrtcService";
import { useCallStore } from "../useCallStore";

interface CallWindowProps {
  socket: Socket | null;
}

const CallWindow = ({ socket }: CallWindowProps) => {
  const {
    status,
    callId,
    callType,
    peerUserId,
    localStream,
    remoteStream,
    micEnabled,
    cameraEnabled,
    setMicEnabled,
    setCameraEnabled,
    setLocalStream,
    setRemoteStream,
    setEnded,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const visible = ["calling", "connecting", "in-call"].includes(status);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const statusLabel = useMemo(() => {
    if (status === "calling") {
      return "Dang do chuong...";
    }

    if (status === "connecting") {
      return "Dang ket noi...";
    }

    return "Dang trong cuoc goi";
  }, [status]);

  if (!visible) {
    return null;
  }

  const handleToggleMic = () => {
    const next = !micEnabled;
    setTrackEnabled("audio", next);
    setMicEnabled(next);
  };

  const handleToggleCamera = () => {
    const next = !cameraEnabled;
    setTrackEnabled("video", next);
    setCameraEnabled(next);
  };

  const handleEndCall = () => {
    if (socket && callId && peerUserId) {
      socket.emit("call:end", {
        callId,
        toUserId: peerUserId,
        reason: "hangup",
      });
    }

    cleanupWebRtc();
    setLocalStream(null);
    setRemoteStream(null);
    setEnded({ reason: "hangup" });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[340px] overflow-hidden rounded-lg border bg-card shadow-lg">
      <div className="relative aspect-video w-full bg-muted">
        {callType === "video" ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />

            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute bottom-2 right-2 h-20 w-28 rounded-md border bg-black object-cover"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Cuoc goi audio
          </div>
        )}
      </div>

      <div className="space-y-3 p-3">
        <p className="text-xs text-muted-foreground">{statusLabel}</p>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            onClick={handleToggleMic}
          >
            {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </Button>

          {callType === "video" && (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              onClick={handleToggleCamera}
            >
              {cameraEnabled ? (
                <Video className="size-4" />
              ) : (
                <VideoOff className="size-4" />
              )}
            </Button>
          )}

          <Button
            type="button"
            size="icon-sm"
            variant="destructive"
            onClick={handleEndCall}
          >
            <PhoneOff className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CallWindow;
