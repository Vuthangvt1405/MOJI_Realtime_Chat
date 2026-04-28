export type CallType = "video" | "audio";

export type CallRole = "caller" | "callee";

export type CallStatus =
  | "idle"
  | "calling"
  | "incoming"
  | "connecting"
  | "in-call"
  | "ended";

export interface IncomingCallPayload {
  callId: string;
  fromUserId: string;
  conversationId: string;
  callType: CallType;
}

export interface CallAcceptedPayload {
  callId: string;
  fromUserId: string;
}

export interface CallRejectedPayload {
  callId: string;
  fromUserId: string;
  reason?: string;
}

export interface CallOfferPayload {
  callId: string;
  fromUserId: string;
  offer: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
  callId: string;
  fromUserId: string;
  answer: RTCSessionDescriptionInit;
}

export interface CallIceCandidatePayload {
  callId: string;
  fromUserId: string;
  candidate: RTCIceCandidateInit;
}

export interface CallEndedPayload {
  callId: string;
  fromUserId: string;
  reason?: string;
}

export interface CallTimeoutPayload {
  callId: string;
  reason: string;
}

export interface CallBusyPayload {
  callId: string;
  toUserId: string;
}

export interface CallUserOfflinePayload {
  callId: string;
  toUserId: string;
}

export interface CallErrorPayload {
  callId: string | null;
  code: string;
  message: string;
}
