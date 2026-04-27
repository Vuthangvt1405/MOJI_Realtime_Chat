export const CALL_FEATURE_ENABLED =
  import.meta.env.VITE_CALL_FEATURE_ENABLED !== "false";

export const CALL_ICE_SERVERS: RTCIceServer[] = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];
