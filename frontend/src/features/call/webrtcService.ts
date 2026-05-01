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

/** Resets all event callbacks on the current peer connection without closing it. */
const clearPeerConnectionListeners = () => {
  if (!peerConnection) {
    return;
  }

  peerConnection.onicecandidate = null;
  peerConnection.ontrack = null;
  peerConnection.onconnectionstatechange = null;
};

/**
 * Purpose:
 * Adds any queued ICE candidates to the peer connection.
 *
 * How it works:
 * Candidates received before remote description was set are queued.
 * This drains the queue once setRemoteDescription has been called.
 *
 * Parameters:
 * none
 *
 * Returns:
 * Promise<void>
 */
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

/**
 * Purpose:
 * Creates a new RTCPeerConnection with ICE servers and event callbacks.
 *
 * How it works:
 * Closes any existing connection first, then creates a new RTCPeerConnection.
 * Wires onicecandidate (sends to peer via socket), ontrack (receives remote
 * stream), and onconnectionstatechange (monitors connection health).
 *
 * Parameters:
 * - onIceCandidate: callback when local ICE candidate is generated
 * - onRemoteStream: callback when remote media stream arrives
 * - onConnectionStateChange: callback for connection state transitions
 *
 * Returns:
 * The created RTCPeerConnection instance.
 */
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

/**
 * Purpose:
 * Gets (or creates) the local media stream (audio + optional video).
 *
 * How it works:
 * Returns cached stream if already acquired, otherwise calls
 * getUserMedia with audio:true and video based on callType.
 *
 * Parameters:
 * - callType: "video" (audio+video) or "audio" (audio only)
 *
 * Returns:
 * Promise<MediaStream>
 */
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

/**
 * Purpose:
 * Adds local media tracks to the peer connection for sending to remote peer.
 *
 * How it works:
 * Checks which track kinds already exist on the sender and only adds missing
 * kinds to avoid duplicate track errors.
 *
 * Parameters:
 * - stream: MediaStream (defaults to cached localStream)
 *
 * Returns:
 * void
 */
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

/**
 * Purpose:
 * Creates an SDP offer and sets it as the local description.
 *
 * How it works:
 * Calls createOffer on the peer connection, then setLocalDescription.
 *
 * Parameters:
 * none
 *
 * Returns:
 * Promise<RTCSessionDescriptionInit> the SDP offer.
 */
export const createOffer = async () => {
  if (!peerConnection) {
    throw new Error("PeerConnection chưa được khởi tạo");
  }

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  return offer;
};

/**
 * Purpose:
 * Creates an SDP answer in response to a received offer.
 *
 * How it works:
 * Calls createAnswer on the peer connection, then setLocalDescription.
 *
 * Parameters:
 * none
 *
 * Returns:
 * Promise<RTCSessionDescriptionInit> the SDP answer.
 */
export const createAnswer = async () => {
  if (!peerConnection) {
    throw new Error("PeerConnection chưa được khởi tạo");
  }

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
};

/**
 * Purpose:
 * Sets the remote SDP description (offer or answer) on the peer connection.
 *
 * How it works:
 * Calls setRemoteDescription, then flushes any queued ICE candidates.
 *
 * Parameters:
 * - description: SDP offer/answer from the remote peer
 *
 * Returns:
 * Promise<void>
 */
export const setRemoteDescription = async (description: RTCSessionDescriptionInit) => {
  if (!peerConnection) {
    throw new Error("PeerConnection chưa được khởi tạo");
  }

  await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
  await flushPendingCandidates();
};

/**
 * Purpose:
 * Adds a received ICE candidate from the remote peer.
 *
 * How it works:
 * If remote description is not yet set, queues the candidate;
 * otherwise adds it immediately to the peer connection.
 *
 * Parameters:
 * - candidate: ICE candidate from remote peer
 *
 * Returns:
 * Promise<void>
 */
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

/**
 * Purpose:
 * Enables or disables a local media track (mic or camera).
 *
 * How it works:
 * Finds all tracks of the given kind on the local stream and sets enabled.
 *
 * Parameters:
 * - kind: "audio" (mic) or "video" (camera)
 * - enabled: true to enable, false to disable
 *
 * Returns:
 * void
 */
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

/**
 * Purpose:
 * Fully cleans up all WebRTC resources and resets module state.
 *
 * How it works:
 * Clears pending ICE candidates, closes the peer connection,
 * stops all local media tracks, and nulls module-level references.
 *
 * Parameters:
 * none
 *
 * Returns:
 * void
 */
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
