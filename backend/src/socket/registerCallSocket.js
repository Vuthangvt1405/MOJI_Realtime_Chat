import { getCallRingTimeoutMs } from "./callConfig.js";

const VALID_CALL_TYPES = new Set(["video", "audio"]);

const toUserKey = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return value.toString();
};

const emitError = (socket, callId, code, message) => {
  socket.emit("call:error", {
    callId,
    code,
    message,
  });
};

const emitToUser = (io, onlineUsers, userId, event, payload) => {
  const targetSocketId = onlineUsers.get(toUserKey(userId));

  if (!targetSocketId) {
    return false;
  }

  io.to(targetSocketId).emit(event, payload);
  return true;
};

const isValidSignalPayload = (payload, fieldName) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (!payload.callId || !payload.toUserId) {
    return false;
  }

  return payload[fieldName] !== undefined;
};

export const registerCallSocket = ({
  io,
  socket,
  onlineUsers,
  callStore,
  canStartCall = async () => ({ allowed: true }),
  getRingTimeoutMs = getCallRingTimeoutMs,
}) => {
  const currentUserId = toUserKey(socket.user?._id);

  if (!currentUserId) {
    return;
  }

  socket.on("call:request", async (payload = {}) => {
    const callId = payload.callId?.toString?.() || payload.callId;
    const toUserId = toUserKey(payload.toUserId);
    const conversationId = payload.conversationId?.toString?.() || payload.conversationId;
    const callType = payload.callType;

    if (!callId || !toUserId || !conversationId || !VALID_CALL_TYPES.has(callType)) {
      emitError(socket, callId || null, "INVALID_PAYLOAD", "Dữ liệu gọi không hợp lệ");
      return;
    }

    if (toUserId === currentUserId) {
      emitError(socket, callId, "SELF_CALL", "Không thể tự gọi chính mình");
      return;
    }

    let eligibilityResult;

    try {
      eligibilityResult = await canStartCall({
        callId,
        callerId: currentUserId,
        calleeId: toUserId,
        conversationId,
        callType,
      });
    } catch (error) {
      console.error("Lỗi khi validate call request", error);
      emitError(socket, callId, "CALL_VALIDATION_ERROR", "Không thể xác minh cuộc gọi");
      return;
    }

    if (!eligibilityResult?.allowed) {
      emitError(
        socket,
        callId,
        eligibilityResult?.code || "FORBIDDEN_CALL",
        eligibilityResult?.message || "Không thể bắt đầu cuộc gọi",
      );
      return;
    }

    if (!onlineUsers.has(toUserId)) {
      socket.emit("call:user-offline", {
        callId,
        toUserId,
      });
      return;
    }

    if (callStore.isUserBusy(currentUserId) || callStore.isUserBusy(toUserId)) {
      socket.emit("call:busy", {
        callId,
        toUserId,
      });
      return;
    }

    const session = callStore.createPendingCall({
      callId,
      callerId: currentUserId,
      calleeId: toUserId,
      conversationId,
      callType,
    });

    if (!session) {
      socket.emit("call:busy", {
        callId,
        toUserId,
      });
      return;
    }

    emitToUser(io, onlineUsers, toUserId, "call:incoming", {
      callId,
      fromUserId: currentUserId,
      conversationId,
      callType,
    });

    const ringTimeoutId = setTimeout(() => {
      const timeoutSession = callStore.getCall(callId);

      if (!timeoutSession || timeoutSession.status !== "pending") {
        return;
      }

      callStore.endCall(callId);
      socket.emit("call:timeout", {
        callId,
        reason: "no-answer",
      });

      emitToUser(io, onlineUsers, toUserId, "call:ended", {
        callId,
        fromUserId: currentUserId,
        reason: "timeout",
      });
    }, getRingTimeoutMs());

    callStore.attachTimeout(callId, ringTimeoutId);
  });

  socket.on("call:accept", (payload = {}) => {
    const callId = payload.callId?.toString?.() || payload.callId;
    const toUserId = toUserKey(payload.toUserId);

    const session = callStore.getCall(callId);

    if (!session) {
      emitError(socket, callId || null, "CALL_NOT_FOUND", "Không tìm thấy cuộc gọi");
      return;
    }

    if (session.calleeId !== currentUserId || session.callerId !== toUserId) {
      emitError(socket, callId, "UNAUTHORIZED_SIGNAL", "Không có quyền xử lý cuộc gọi này");
      return;
    }

    if (session.status !== "pending") {
      return;
    }

    callStore.clearTimeoutForCall(callId);
    callStore.markAccepted(callId);

    emitToUser(io, onlineUsers, session.callerId, "call:accepted", {
      callId,
      fromUserId: currentUserId,
    });
  });

  socket.on("call:reject", (payload = {}) => {
    const callId = payload.callId?.toString?.() || payload.callId;
    const toUserId = toUserKey(payload.toUserId);
    const reason = payload.reason || "declined";
    const session = callStore.getCall(callId);

    if (!session) {
      emitError(socket, callId || null, "CALL_NOT_FOUND", "Không tìm thấy cuộc gọi");
      return;
    }

    if (session.calleeId !== currentUserId || session.callerId !== toUserId) {
      emitError(socket, callId, "UNAUTHORIZED_SIGNAL", "Không có quyền xử lý cuộc gọi này");
      return;
    }

    callStore.endCall(callId);

    emitToUser(io, onlineUsers, session.callerId, "call:rejected", {
      callId,
      fromUserId: currentUserId,
      reason,
    });
  });

  const relaySignal = (eventName, fieldName) => {
    socket.on(eventName, (payload = {}) => {
      if (!isValidSignalPayload(payload, fieldName)) {
        emitError(socket, payload?.callId || null, "INVALID_PAYLOAD", "Dữ liệu gọi không hợp lệ");
        return;
      }

      const callId = payload.callId?.toString?.() || payload.callId;
      const toUserId = toUserKey(payload.toUserId);
      const session = callStore.getCall(callId);

      if (!session) {
        emitError(socket, callId, "CALL_NOT_FOUND", "Không tìm thấy cuộc gọi");
        return;
      }

      const peerUserId = callStore.getPeerUserId(callId, currentUserId);

      if (!peerUserId || peerUserId !== toUserId) {
        emitError(socket, callId, "UNAUTHORIZED_SIGNAL", "Không có quyền gửi tín hiệu cuộc gọi");
        return;
      }

      emitToUser(io, onlineUsers, peerUserId, eventName, {
        callId,
        fromUserId: currentUserId,
        [fieldName]: payload[fieldName],
      });
    });
  };

  relaySignal("call:offer", "offer");
  relaySignal("call:answer", "answer");
  relaySignal("call:ice-candidate", "candidate");

  socket.on("call:end", (payload = {}) => {
    const callId = payload.callId?.toString?.() || payload.callId;
    const session = callStore.getCall(callId);

    if (!session) {
      emitError(socket, callId || null, "CALL_NOT_FOUND", "Không tìm thấy cuộc gọi");
      return;
    }

    if (!callStore.isParticipant(callId, currentUserId)) {
      emitError(socket, callId, "UNAUTHORIZED_SIGNAL", "Không có quyền kết thúc cuộc gọi này");
      return;
    }

    const peerUserId = callStore.getPeerUserId(callId, currentUserId);
    const reason = payload.reason || "hangup";

    callStore.endCall(callId);

    if (peerUserId) {
      emitToUser(io, onlineUsers, peerUserId, "call:ended", {
        callId,
        fromUserId: currentUserId,
        reason,
      });
    }
  });

  socket.on("disconnect", () => {
    const endedSession = callStore.cleanupUserOnDisconnect(currentUserId);

    if (!endedSession) {
      return;
    }

    const peerUserId =
      endedSession.callerId === currentUserId
        ? endedSession.calleeId
        : endedSession.callerId;

    emitToUser(io, onlineUsers, peerUserId, "call:ended", {
      callId: endedSession.callId,
      fromUserId: currentUserId,
      reason: "disconnect",
    });
  });
};
