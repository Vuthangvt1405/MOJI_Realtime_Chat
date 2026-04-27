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

  setConnecting: () => set({ status: "connecting" }),

  setInCall: () => set({ status: "in-call" }),

  setLocalStream: (stream) => set({ localStream: stream }),

  setRemoteStream: (stream) => set({ remoteStream: stream }),

  setMicEnabled: (enabled) => set({ micEnabled: enabled }),

  setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),

  setEnded: (payload = {}) =>
    set({
      ...baseState,
      status: "ended",
      endedReason: payload.reason || null,
      errorCode: payload.errorCode || null,
      errorMessage: payload.errorMessage || null,
    }),

  resetCall: () => set({ ...baseState }),
}));
