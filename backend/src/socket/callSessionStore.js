const toUserKey = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return value.toString();
};

export const createCallSessionStore = () => {
  const callsById = new Map();
  const activeCallByUser = new Map();
  const timeoutsByCallId = new Map();

  const clearTimeoutForCall = (callId) => {
    const timeoutId = timeoutsByCallId.get(callId);

    if (!timeoutId) {
      return;
    }

    clearTimeout(timeoutId);
    timeoutsByCallId.delete(callId);
  };

  const createPendingCall = ({ callId, callerId, calleeId, conversationId, callType }) => {
    if (!callId || callsById.has(callId)) {
      return null;
    }

    const callerKey = toUserKey(callerId);
    const calleeKey = toUserKey(calleeId);

    if (!callerKey || !calleeKey) {
      return null;
    }

    if (activeCallByUser.has(callerKey) || activeCallByUser.has(calleeKey)) {
      return null;
    }

    const session = {
      callId,
      callerId: callerKey,
      calleeId: calleeKey,
      conversationId: conversationId?.toString?.() || conversationId || null,
      callType,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    callsById.set(callId, session);
    activeCallByUser.set(callerKey, callId);
    activeCallByUser.set(calleeKey, callId);

    return session;
  };

  const attachTimeout = (callId, timeoutId) => {
    clearTimeoutForCall(callId);
    timeoutsByCallId.set(callId, timeoutId);
  };

  const getCall = (callId) => callsById.get(callId) || null;

  const isParticipant = (callId, userId) => {
    const session = getCall(callId);

    if (!session) {
      return false;
    }

    const userKey = toUserKey(userId);
    return session.callerId === userKey || session.calleeId === userKey;
  };

  const getPeerUserId = (callId, userId) => {
    const session = getCall(callId);

    if (!session) {
      return null;
    }

    const userKey = toUserKey(userId);

    if (session.callerId === userKey) {
      return session.calleeId;
    }

    if (session.calleeId === userKey) {
      return session.callerId;
    }

    return null;
  };

  const markAccepted = (callId) => {
    const session = getCall(callId);

    if (!session) {
      return null;
    }

    session.status = "accepted";
    return session;
  };

  const endCall = (callId) => {
    const session = getCall(callId);

    if (!session) {
      return null;
    }

    clearTimeoutForCall(callId);
    callsById.delete(callId);

    if (activeCallByUser.get(session.callerId) === callId) {
      activeCallByUser.delete(session.callerId);
    }

    if (activeCallByUser.get(session.calleeId) === callId) {
      activeCallByUser.delete(session.calleeId);
    }

    return session;
  };

  const cleanupUserOnDisconnect = (userId) => {
    const userKey = toUserKey(userId);
    const callId = activeCallByUser.get(userKey);

    if (!callId) {
      return null;
    }

    return endCall(callId);
  };

  const isUserBusy = (userId) => {
    const userKey = toUserKey(userId);
    return activeCallByUser.has(userKey);
  };

  return {
    createPendingCall,
    attachTimeout,
    clearTimeoutForCall,
    getCall,
    isParticipant,
    getPeerUserId,
    markAccepted,
    endCall,
    cleanupUserOnDisconnect,
    isUserBusy,
  };
};
