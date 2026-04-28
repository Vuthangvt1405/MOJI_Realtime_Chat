import { useEffect } from "react";
import type { Socket } from "socket.io-client";

import {
  addLocalTracks,
  addRemoteIceCandidate,
  cleanupWebRtc,
  createAnswer,
  createOffer,
  createPeerConnection,
  ensureLocalStream,
  setRemoteDescription,
} from "./webrtcService";
import { useCallStore } from "./useCallStore";
import type {
  CallAcceptedPayload,
  CallAnswerPayload,
  CallBusyPayload,
  CallEndedPayload,
  CallErrorPayload,
  CallIceCandidatePayload,
  CallOfferPayload,
  CallRejectedPayload,
  CallTimeoutPayload,
  CallUserOfflinePayload,
  IncomingCallPayload,
} from "./types";

const isCurrentCall = (callId: string) => {
  const activeCallId = useCallStore.getState().callId;
  return Boolean(activeCallId && activeCallId === callId);
};

const endLocalCall = ({ reason, errorCode, errorMessage }: {
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
}) => {
  cleanupWebRtc();

  const { setLocalStream, setRemoteStream, setEnded } = useCallStore.getState();
  setLocalStream(null);
  setRemoteStream(null);
  setEnded({ reason, errorCode, errorMessage });
};

const setupPeerConnection = (socket: Socket, callId: string, peerUserId: string) => {
  createPeerConnection({
    onIceCandidate: (candidate) => {
      socket.emit("call:ice-candidate", {
        callId,
        toUserId: peerUserId,
        candidate,
      });
    },
    onRemoteStream: (stream) => {
      const { setRemoteStream, setInCall } = useCallStore.getState();
      setRemoteStream(stream);
      setInCall();
    },
    onConnectionStateChange: (state) => {
      if (state === "failed" || state === "disconnected" || state === "closed") {
        endLocalCall({ reason: state });
      }
    },
  });
};

export const useCallSocket = (socket: Socket | null) => {
  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleIncomingCall = (payload: IncomingCallPayload) => {
      const { status, setIncomingCall } = useCallStore.getState();

      if (status !== "idle") {
        socket.emit("call:reject", {
          callId: payload.callId,
          toUserId: payload.fromUserId,
          conversationId: payload.conversationId,
          reason: "busy",
        });
        return;
      }

      setIncomingCall({
        callId: payload.callId,
        conversationId: payload.conversationId,
        fromUserId: payload.fromUserId,
        callType: payload.callType,
      });
    };

    const handleCallAccepted = async (payload: CallAcceptedPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      const state = useCallStore.getState();

      if (!state.peerUserId) {
        return;
      }

      state.setConnecting();

      try {
        setupPeerConnection(socket, payload.callId, state.peerUserId);
        const stream = await ensureLocalStream(state.callType);
        state.setLocalStream(stream);
        state.setMicEnabled(true);
        state.setCameraEnabled(state.callType === "video");

        addLocalTracks(stream);

        const offer = await createOffer();
        socket.emit("call:offer", {
          callId: payload.callId,
          toUserId: state.peerUserId,
          offer,
        });
      } catch (error) {
        socket.emit("call:end", {
          callId: payload.callId,
          toUserId: state.peerUserId,
          reason: "failed",
        });

        endLocalCall({
          reason: "failed",
          errorCode: "LOCAL_MEDIA_ERROR",
          errorMessage:
            error instanceof Error ? error.message : "Không thể khởi tạo media call",
        });
      }
    };

    const handleOffer = async (payload: CallOfferPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      const state = useCallStore.getState();

      if (!state.peerUserId) {
        return;
      }

      state.setConnecting();

      try {
        setupPeerConnection(socket, payload.callId, payload.fromUserId);
        const stream = await ensureLocalStream(state.callType);
        state.setLocalStream(stream);
        state.setMicEnabled(true);
        state.setCameraEnabled(state.callType === "video");

        addLocalTracks(stream);
        await setRemoteDescription(payload.offer);

        const answer = await createAnswer();
        socket.emit("call:answer", {
          callId: payload.callId,
          toUserId: payload.fromUserId,
          answer,
        });
      } catch (error) {
        socket.emit("call:end", {
          callId: payload.callId,
          toUserId: payload.fromUserId,
          reason: "failed",
        });

        endLocalCall({
          reason: "failed",
          errorCode: "CALL_OFFER_ERROR",
          errorMessage: error instanceof Error ? error.message : "Không thể xử lý offer",
        });
      }
    };

    const handleAnswer = async (payload: CallAnswerPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      try {
        await setRemoteDescription(payload.answer);
      } catch (error) {
        endLocalCall({
          reason: "failed",
          errorCode: "CALL_ANSWER_ERROR",
          errorMessage: error instanceof Error ? error.message : "Không thể xử lý answer",
        });
      }
    };

    const handleCandidate = async (payload: CallIceCandidatePayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      try {
        await addRemoteIceCandidate(payload.candidate);
      } catch (error) {
        endLocalCall({
          reason: "failed",
          errorCode: "ICE_CANDIDATE_ERROR",
          errorMessage: error instanceof Error ? error.message : "Không thể thêm ICE candidate",
        });
      }
    };

    const handleRejected = (payload: CallRejectedPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: payload.reason || "declined" });
    };

    const handleBusy = (payload: CallBusyPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: "busy" });
    };

    const handleOffline = (payload: CallUserOfflinePayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: "user-offline" });
    };

    const handleTimeout = (payload: CallTimeoutPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: payload.reason || "no-answer" });
    };

    const handleEnded = (payload: CallEndedPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: payload.reason || "ended" });
    };

    const handleCallError = (payload: CallErrorPayload) => {
      const currentCallId = useCallStore.getState().callId;

      if (payload.callId && currentCallId !== payload.callId) {
        return;
      }

      endLocalCall({
        reason: "error",
        errorCode: payload.code,
        errorMessage: payload.message,
      });
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleCandidate);
    socket.on("call:rejected", handleRejected);
    socket.on("call:busy", handleBusy);
    socket.on("call:user-offline", handleOffline);
    socket.on("call:timeout", handleTimeout);
    socket.on("call:ended", handleEnded);
    socket.on("call:error", handleCallError);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleCandidate);
      socket.off("call:rejected", handleRejected);
      socket.off("call:busy", handleBusy);
      socket.off("call:user-offline", handleOffline);
      socket.off("call:timeout", handleTimeout);
      socket.off("call:ended", handleEnded);
      socket.off("call:error", handleCallError);
    };
  }, [socket]);
};
