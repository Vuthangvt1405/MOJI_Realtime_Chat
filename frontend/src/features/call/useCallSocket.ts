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

/**
 * Checks if an incoming event matches the currently active call.
 * Prevents stale events from affecting a different call.
 */
const isCurrentCall = (callId: string) => {
  const activeCallId = useCallStore.getState().callId;
  return Boolean(activeCallId && activeCallId === callId);
};

/**
 * Purpose:
 * Cleans up WebRTC resources and transitions the call to ended state.
 *
 * How it works:
 * Calls cleanupWebRtc to close peer connection and stop media tracks,
 * then resets local/remote streams and records the end reason.
 *
 * Parameters:
 * - reason: string description (e.g. "busy", "declined", "failed")
 * - errorCode: optional machine-readable error code
 * - errorMessage: optional human-readable error message
 *
 * Returns:
 * void
 */
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

/**
 * Purpose:
 * Creates a WebRTC peer connection and wires socket-based signaling.
 *
 * How it works:
 * Creates RTCPeerConnection with ICE config, registers callbacks for
 * local ICE candidates (sent via socket to peer), remote stream
 * arrival, and connection state changes (failure triggers endLocalCall).
 *
 * Parameters:
 * - socket: Socket.IO instance for signaling
 * - callId: current call ID
 * - peerUserId: remote user ID for signaling events
 *
 * Returns:
 * void
 */
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

/**
 * Purpose:
 * Registers all call-related Socket.IO event listeners for WebRTC signaling.
 *
 * How it works:
 * In a useEffect, subscribes to 11 socket events (incoming, accepted, offer,
 * answer, ice-candidate, rejected, busy, user-offline, timeout, ended, error).
 * Each handler checks isCurrentCall to ignore stale events, then drives the
 * WebRTC flow (create/answer offers, add ICE candidates, handle failures).
 * Cleanup unregisters all listeners on unmount or socket change.
 *
 * Parameters:
 * - socket: Socket.IO instance (null disables all listeners)
 *
 * Returns:
 * void
 */
export const useCallSocket = (socket: Socket | null) => {
  useEffect(() => {
    if (!socket) {
      return;
    }

    /**
     * Handles call:incoming — remote user is calling.
     * If local user is not idle, auto-rejects with "busy".
     * Otherwise, stores incoming call data for the IncomingCallModal.
     */
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

    /**
     * Handles call:accepted — callee answered; proceed with WebRTC offer.
     * Creates peer connection, gets local media stream, creates and
     * sends SDP offer to the remote peer via socket.
     */
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

    /**
     * Handles call:offer — received SDP offer from caller.
     * Creates peer connection, sets remote description (offer),
     * creates and sends SDP answer back to caller.
     */
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

    /**
     * Handles call:answer — received SDP answer from callee.
     * Sets it as remote description so media starts flowing.
     */
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

    /**
     * Handles call:ice-candidate — received remote ICE candidate.
     * Adds candidate to peer connection (queued if remote desc not set yet).
     */
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

    /**
     * Handles call:rejected — remote user declined the call.
     */
    const handleRejected = (payload: CallRejectedPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: payload.reason || "declined" });
    };

    /**
     * Handles call:busy — remote user is already in a call.
     */
    const handleBusy = (payload: CallBusyPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: "busy" });
    };

    /**
     * Handles call:user-offline — remote user is not connected.
     */
    const handleOffline = (payload: CallUserOfflinePayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: "user-offline" });
    };

    /**
     * Handles call:timeout — callee did not answer in time.
     */
    const handleTimeout = (payload: CallTimeoutPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: payload.reason || "no-answer" });
    };

    /**
     * Handles call:ended — remote user ended the call.
     */
    const handleEnded = (payload: CallEndedPayload) => {
      if (!isCurrentCall(payload.callId)) {
        return;
      }

      endLocalCall({ reason: payload.reason || "ended" });
    };

    /**
     * Handles call:error — server-side error during call setup.
     */
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
