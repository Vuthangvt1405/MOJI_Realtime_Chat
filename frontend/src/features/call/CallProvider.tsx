import { useEffect } from "react";

import { useSocketStore } from "@/stores/useSocketStore";

import IncomingCallModal from "./components/IncomingCallModal";
import CallWindow from "./components/CallWindow";
import { CALL_FEATURE_ENABLED } from "./config";
import { useCallSocket } from "./useCallSocket";
import { useCallStore } from "./useCallStore";
import { cleanupWebRtc } from "./webrtcService";

const CallProvider = () => {
  const { socket } = useSocketStore();
  const { status, setLocalStream, setRemoteStream, setEnded, resetCall } = useCallStore();

  useCallSocket(socket);

  useEffect(() => {
    if (socket || status === "idle") {
      return;
    }

    cleanupWebRtc();
    setLocalStream(null);
    setRemoteStream(null);
    setEnded({ reason: "socket-disconnected" });
  }, [socket, status, setLocalStream, setRemoteStream, setEnded]);

  useEffect(() => {
    if (status !== "ended") {
      return;
    }

    const timerId = window.setTimeout(() => {
      resetCall();
    }, 1200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [status, resetCall]);

  if (!CALL_FEATURE_ENABLED) {
    return null;
  }

  return (
    <>
      <IncomingCallModal socket={socket} />
      <CallWindow socket={socket} />
    </>
  );
};

export default CallProvider;
