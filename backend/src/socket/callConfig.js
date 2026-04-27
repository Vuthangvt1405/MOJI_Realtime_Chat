const DEFAULT_CALL_RING_TIMEOUT_MS = 30000;

export const getCallRingTimeoutMs = () => {
  const value = Number(process.env.CALL_RING_TIMEOUT_MS);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_CALL_RING_TIMEOUT_MS;
  }

  return value;
};
