import { CALL_ICE_SERVERS } from "./config";
import type { CallType } from "./types";

interface CreatePeerConnectionInput {
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
const pendingCandidates: RTCIceCandidateInit[] = [];

const clearPeerConnectionListeners = () => {
  if (!peerConnection) {
    return;
  }

  peerConnection.onicecandidate = null;
  peerConnection.ontrack = null;
  peerConnection.onconnectionstatechange = null;
};

const flushPendingCandidates = async () => {
  if (!peerConnection || !peerConnection.remoteDescription) {
    return;
  }

  while (pendingCandidates.length > 0) {
    const candidate = pendingCandidates.shift();

    if (!candidate) {
      continue;
    }

    await peerConnection.addIceCandidate(candidate);
  }
};

export const createPeerConnection = ({
  onIceCandidate,
  onRemoteStream,
  onConnectionStateChange,
}: CreatePeerConnectionInput = {}) => {
  if (peerConnection) {
    clearPeerConnectionListeners();
    peerConnection.close();
    peerConnection = null;
  }

  peerConnection = new RTCPeerConnection({
    iceServers: CALL_ICE_SERVERS,
  });

  peerConnection.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    onIceCandidate?.(event.candidate.toJSON());
  };

  peerConnection.ontrack = (event) => {
    const [stream] = event.streams;

    if (stream) {
      onRemoteStream?.(stream);
    }
  };

  peerConnection.onconnectionstatechange = () => {
    if (!peerConnection) {
      return;
    }

    onConnectionStateChange?.(peerConnection.connectionState);
  };

  return peerConnection;
};

export const ensureLocalStream = async (callType: CallType) => {
  if (localStream) {
    return localStream;
  }

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: callType === "video",
  });

  return localStream;
};

export const addLocalTracks = (stream = localStream) => {
  if (!peerConnection || !stream) {
    return;
  }

  const senderKinds = new Set(
    peerConnection
      .getSenders()
      .map((sender) => sender.track?.kind)
      .filter((kind): kind is "audio" | "video" => Boolean(kind)),
  );

  stream.getTracks().forEach((track) => {
    if (!senderKinds.has(track.kind as "audio" | "video")) {
      peerConnection?.addTrack(track, stream);
    }
  });
};

export const createOffer = async () => {
  if (!peerConnection) {
    throw new Error("PeerConnection chưa được khởi tạo");
  }

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  return offer;
};

export const createAnswer = async () => {
  if (!peerConnection) {
    throw new Error("PeerConnection chưa được khởi tạo");
  }

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
};

export const setRemoteDescription = async (description: RTCSessionDescriptionInit) => {
  if (!peerConnection) {
    throw new Error("PeerConnection chưa được khởi tạo");
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
  await flushPendingCandidates();
};

export const addRemoteIceCandidate = async (candidate: RTCIceCandidateInit) => {
  if (!candidate) {
    return;
  }

  if (!peerConnection || !peerConnection.remoteDescription) {
    pendingCandidates.push(candidate);
    return;
  }

  await peerConnection.addIceCandidate(candidate);
};

export const setTrackEnabled = (kind: "audio" | "video", enabled: boolean) => {
  if (!localStream) {
    return;
  }

  localStream.getTracks().forEach((track) => {
    if (track.kind === kind) {
      track.enabled = enabled;
    }
  });
};

export const cleanupWebRtc = () => {
  pendingCandidates.length = 0;

  if (peerConnection) {
    clearPeerConnectionListeners();
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
};
