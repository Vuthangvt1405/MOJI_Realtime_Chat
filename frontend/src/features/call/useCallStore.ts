import { create } from "zustand";

import type { CallRole, CallStatus, CallType } from "./types";

interface StartOutgoingCallInput {
  callId: string;
  conversationId: string;
  peerUserId: string;
  callType: CallType;
}

interface SetIncomingCallInput {
  callId: string;
  conversationId: string;
  fromUserId: string;
  callType: CallType;
}

interface EndedStatePayload {
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface CallState {
  status: CallStatus;
  role: CallRole | null;
  callId: string | null;
  conversationId: string | null;
  callType: CallType;
  peerUserId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  endedReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;

  startOutgoingCall: (input: StartOutgoingCallInput) => void;
  setIncomingCall: (input: SetIncomingCallInput) => void;
  setConnecting: () => void;
  setInCall: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setMicEnabled: (enabled: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setEnded: (payload?: EndedStatePayload) => void;
  resetCall: () => void;
}

const baseState = {
  status: "idle" as CallStatus,
  role: null,
  callId: null,
  conversationId: null,
  callType: "video" as CallType,
  peerUserId: null,
  localStream: null,
  remoteStream: null,
  micEnabled: true,
  cameraEnabled: true,
  endedReason: null,
  errorCode: null,
  errorMessage: null,
};

export const useCallStore = create<CallState>((set) => ({
  ...baseState,

  /**
   * Purpose:
   * Initializes state for an outgoing call (caller side).
   *
   * How it works:
   * Sets status to "calling", role to "caller", and stores call metadata.
   * Resets any previous ended/error state.
   *
   * Parameters:
   * - callId: generated unique call ID
   * - conversationId: the conversation to call in
   * - peerUserId: the user being called
   * - callType: "video" or "audio"
   *
   * Returns:
   * void
   */
  startOutgoingCall: ({ callId, conversationId, peerUserId, callType }) =>
    set({
      status: "calling",
      role: "caller",
      callId,
      conversationId,
      callType,
      peerUserId,
      endedReason: null,
      errorCode: null,
      errorMessage: null,
      localStream: null,
      remoteStream: null,
      micEnabled: true,
      cameraEnabled: callType === "video",
    }),

  /**
   * Purpose:
   * Initializes state for an incoming call (callee side).
   *
   * How it works:
   * Sets status to "incoming", role to "callee", and stores the caller's info.
   * The IncomingCallModal UI reads this state to show accept/reject UI.
   *
   * Parameters:
   * - callId: call ID from the server
   * - conversationId: conversation the call is in
   * - fromUserId: the calling user's ID
   * - callType: "video" or "audio"
   *
   * Returns:
   * void
   */
  setIncomingCall: ({ callId, conversationId, fromUserId, callType }) =>
    set({
      status: "incoming",
      role: "callee",
      callId,
      conversationId,
      callType,
      peerUserId: fromUserId,
      endedReason: null,
      errorCode: null,
      errorMessage: null,
      localStream: null,
      remoteStream: null,
      micEnabled: true,
      cameraEnabled: callType === "video",
    }),

  /**
   * Purpose:
   * Transitions call status to "connecting" while WebRTC setup runs.
   */
  setConnecting: () => set({ status: "connecting" }),

  /**
   * Purpose:
   * Transitions call status to "in-call" (media flowing).
   */
  setInCall: () => set({ status: "in-call" }),

  /**
   * Purpose:
   * Stores the local MediaStream for rendering local video preview.
   */
  setLocalStream: (stream) => set({ localStream: stream }),

  /**
   * Purpose:
   * Stores the remote MediaStream for rendering the peer's video.
   */
  setRemoteStream: (stream) => set({ remoteStream: stream }),

  /**
   * Purpose:
   * Enables or disables the local microphone.
   */
  setMicEnabled: (enabled) => set({ micEnabled: enabled }),

  /**
   * Purpose:
   * Enables or disables the local camera.
   */
  setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),

  /**
   * Purpose:
   * Transitions the call to "ended" and records the termination reason.
   *
   * How it works:
   * Resets to baseState and sets status to "ended" with optional error details.
   * The call window/UI reads endedReason/errorCode to show appropriate feedback.
   *
   * Parameters:
   * - payload.reason: termination reason string
   * - payload.errorCode: optional machine-readable error code
   * - payload.errorMessage: optional human-readable error message
   *
   * Returns:
   * void
   */
  setEnded: (payload = {}) =>
    set({
      ...baseState,
      status: "ended",
      endedReason: payload.reason || null,
      errorCode: payload.errorCode || null,
      errorMessage: payload.errorMessage || null,
    }),

  /**
   * Purpose:
   * Fully resets the call state to idle (no active or ended call).
   */
  resetCall: () => set({ ...baseState }),
}));
