import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";

import { createCallSessionStore } from "../src/socket/callSessionStore.js";
import { registerCallSocket } from "../src/socket/registerCallSocket.js";

const createFakeSocket = (userId) => {
  const listeners = new Map();

  return {
    id: `socket-${userId}`,
    user: { _id: userId },
    emitted: [],
    joined: [],

    on(event, handler) {
      const handlers = listeners.get(event) || [];
      handlers.push(handler);
      listeners.set(event, handlers);
    },

    emit(event, payload) {
      this.emitted.push({ event, payload });
    },

    join(roomId) {
      this.joined.push(roomId);
    },

    async trigger(event, payload) {
      const handlers = listeners.get(event) || [];

      for (const handler of handlers) {
        await handler(payload);
      }
    },
  };
};

const createFakeIo = (socketsById) => ({
  to(target) {
    return {
      emit(event, payload) {
        const socket = socketsById.get(target);

        if (socket) {
          socket.emit(event, payload);
        }
      },
    };
  },
});

const findEvent = (socket, event) => socket.emitted.find((item) => item.event === event);

const register = ({ io, socket, onlineUsers, callStore, ringTimeoutMs = 30000 }) => {
  registerCallSocket({
    io,
    socket,
    onlineUsers,
    callStore,
    canStartCall: async () => ({ allowed: true }),
    getRingTimeoutMs: () => ringTimeoutMs,
  });
};

const registerWithEligibility = ({
  io,
  socket,
  onlineUsers,
  callStore,
  canStartCall,
  ringTimeoutMs = 30000,
}) => {
  registerCallSocket({
    io,
    socket,
    onlineUsers,
    callStore,
    canStartCall,
    getRingTimeoutMs: () => ringTimeoutMs,
  });
};

test("call:request emits call:user-offline when callee is offline", async () => {
  const callStore = createCallSessionStore();
  const caller = createFakeSocket("u1");
  const onlineUsers = new Map([["u1", caller.id]]);
  const socketsById = new Map([[caller.id, caller]]);
  const io = createFakeIo(socketsById);

  register({ io, socket: caller, onlineUsers, callStore });

  await caller.trigger("call:request", {
    callId: "call-1",
    toUserId: "u2",
    conversationId: "conv-1",
    callType: "video",
  });

  const event = findEvent(caller, "call:user-offline");
  assert.ok(event);
  assert.equal(event.payload.callId, "call-1");
  assert.equal(event.payload.toUserId, "u2");
});

test("call:request emits call:busy when either user is already in active call", async () => {
  const callStore = createCallSessionStore();
  callStore.createPendingCall({
    callId: "active-1",
    callerId: "u1",
    calleeId: "u3",
    conversationId: "conv-active",
    callType: "video",
  });

  const caller = createFakeSocket("u1");
  const callee = createFakeSocket("u2");
  const onlineUsers = new Map([
    ["u1", caller.id],
    ["u2", callee.id],
  ]);
  const socketsById = new Map([
    [caller.id, caller],
    [callee.id, callee],
  ]);
  const io = createFakeIo(socketsById);

  register({ io, socket: caller, onlineUsers, callStore });

  await caller.trigger("call:request", {
    callId: "call-2",
    toUserId: "u2",
    conversationId: "conv-2",
    callType: "video",
  });

  const event = findEvent(caller, "call:busy");
  assert.ok(event);
  assert.equal(event.payload.callId, "call-2");
  assert.equal(event.payload.toUserId, "u2");
});

test("call:request emits call:error when eligibility check blocks request", async () => {
  const callStore = createCallSessionStore();
  const caller = createFakeSocket("u1");
  const callee = createFakeSocket("u2");
  const onlineUsers = new Map([
    ["u1", caller.id],
    ["u2", callee.id],
  ]);
  const socketsById = new Map([
    [caller.id, caller],
    [callee.id, callee],
  ]);
  const io = createFakeIo(socketsById);

  registerWithEligibility({
    io,
    socket: caller,
    onlineUsers,
    callStore,
    canStartCall: async () => ({
      allowed: false,
      code: "FORBIDDEN_CALL",
      message: "blocked",
    }),
  });

  await caller.trigger("call:request", {
    callId: "call-2b",
    toUserId: "u2",
    conversationId: "conv-2",
    callType: "video",
  });

  const errorEvent = findEvent(caller, "call:error");
  assert.ok(errorEvent);
  assert.equal(errorEvent.payload.code, "FORBIDDEN_CALL");

  const incomingEvent = findEvent(callee, "call:incoming");
  assert.equal(incomingEvent, undefined);
});

test("call:request times out and clears session", async () => {
  const callStore = createCallSessionStore();
  const caller = createFakeSocket("u1");
  const callee = createFakeSocket("u2");
  const onlineUsers = new Map([
    ["u1", caller.id],
    ["u2", callee.id],
  ]);
  const socketsById = new Map([
    [caller.id, caller],
    [callee.id, callee],
  ]);
  const io = createFakeIo(socketsById);

  register({ io, socket: caller, onlineUsers, callStore, ringTimeoutMs: 25 });
  register({ io, socket: callee, onlineUsers, callStore, ringTimeoutMs: 25 });

  await caller.trigger("call:request", {
    callId: "call-3",
    toUserId: "u2",
    conversationId: "conv-3",
    callType: "video",
  });

  await wait(60);

  const timeoutEvent = findEvent(caller, "call:timeout");
  assert.ok(timeoutEvent);
  assert.equal(timeoutEvent.payload.callId, "call-3");

  const endedEvent = findEvent(callee, "call:ended");
  assert.ok(endedEvent);
  assert.equal(endedEvent.payload.callId, "call-3");
  assert.equal(endedEvent.payload.reason, "timeout");

  assert.equal(callStore.getCall("call-3"), null);
});

test("call:accept notifies caller with call:accepted", async () => {
  const callStore = createCallSessionStore();
  const caller = createFakeSocket("u1");
  const callee = createFakeSocket("u2");
  const onlineUsers = new Map([
    ["u1", caller.id],
    ["u2", callee.id],
  ]);
  const socketsById = new Map([
    [caller.id, caller],
    [callee.id, callee],
  ]);
  const io = createFakeIo(socketsById);

  register({ io, socket: caller, onlineUsers, callStore });
  register({ io, socket: callee, onlineUsers, callStore });

  await caller.trigger("call:request", {
    callId: "call-4",
    toUserId: "u2",
    conversationId: "conv-4",
    callType: "video",
  });

  await callee.trigger("call:accept", {
    callId: "call-4",
    toUserId: "u1",
    conversationId: "conv-4",
  });

  const acceptedEvent = findEvent(caller, "call:accepted");
  assert.ok(acceptedEvent);
  assert.equal(acceptedEvent.payload.callId, "call-4");
  assert.equal(acceptedEvent.payload.fromUserId, "u2");
  assert.equal(callStore.getCall("call-4")?.status, "accepted");
});

test("call:offer relays only when sender belongs to call", async () => {
  const callStore = createCallSessionStore();
  const caller = createFakeSocket("u1");
  const callee = createFakeSocket("u2");
  const intruder = createFakeSocket("u9");
  const onlineUsers = new Map([
    ["u1", caller.id],
    ["u2", callee.id],
    ["u9", intruder.id],
  ]);
  const socketsById = new Map([
    [caller.id, caller],
    [callee.id, callee],
    [intruder.id, intruder],
  ]);
  const io = createFakeIo(socketsById);

  register({ io, socket: caller, onlineUsers, callStore });
  register({ io, socket: callee, onlineUsers, callStore });
  register({ io, socket: intruder, onlineUsers, callStore });

  await caller.trigger("call:request", {
    callId: "call-5",
    toUserId: "u2",
    conversationId: "conv-5",
    callType: "video",
  });

  await callee.trigger("call:accept", {
    callId: "call-5",
    toUserId: "u1",
    conversationId: "conv-5",
  });

  await caller.trigger("call:offer", {
    callId: "call-5",
    toUserId: "u2",
    offer: { type: "offer", sdp: "offer-sdp" },
  });

  const relayedOffer = findEvent(callee, "call:offer");
  assert.ok(relayedOffer);
  assert.equal(relayedOffer.payload.fromUserId, "u1");

  await intruder.trigger("call:offer", {
    callId: "call-5",
    toUserId: "u1",
    offer: { type: "offer", sdp: "hijack" },
  });

  const unauthorized = findEvent(intruder, "call:error");
  assert.ok(unauthorized);
  assert.equal(unauthorized.payload.code, "UNAUTHORIZED_SIGNAL");

  const offersToCaller = caller.emitted.filter((event) => event.event === "call:offer");
  assert.equal(offersToCaller.length, 0);
});

test("disconnect ends active call and notifies peer", async () => {
  const callStore = createCallSessionStore();
  const caller = createFakeSocket("u1");
  const callee = createFakeSocket("u2");
  const onlineUsers = new Map([
    ["u1", caller.id],
    ["u2", callee.id],
  ]);
  const socketsById = new Map([
    [caller.id, caller],
    [callee.id, callee],
  ]);
  const io = createFakeIo(socketsById);

  register({ io, socket: caller, onlineUsers, callStore });
  register({ io, socket: callee, onlineUsers, callStore });

  await caller.trigger("call:request", {
    callId: "call-6",
    toUserId: "u2",
    conversationId: "conv-6",
    callType: "video",
  });

  await callee.trigger("call:accept", {
    callId: "call-6",
    toUserId: "u1",
    conversationId: "conv-6",
  });

  await caller.trigger("disconnect");

  const endedEvent = findEvent(callee, "call:ended");
  assert.ok(endedEvent);
  assert.equal(endedEvent.payload.callId, "call-6");
  assert.equal(endedEvent.payload.reason, "disconnect");
  assert.equal(callStore.getCall("call-6"), null);
});
