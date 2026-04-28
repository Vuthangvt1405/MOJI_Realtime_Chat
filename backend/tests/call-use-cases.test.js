import assert from "node:assert/strict";
import test from "node:test";

import { makeCallUseCases } from "../src/application/call/callUseCases.js";

const createUseCases = (overrides = {}) => {
  const repositories = {
    existsUserById: async () => true,
    findFriendshipByPair: async () => ({ _id: "friendship-1" }),
    isDirectConversationBetweenUsers: async () => true,
    isValidObjectId: () => true,
    ...overrides,
  };

  return makeCallUseCases({ repositories });
};

test("validateCallRequest rejects invalid payload", async () => {
  const useCases = createUseCases();

  const result = await useCases.validateCallRequest({
    callerId: "u1",
    calleeId: "",
    conversationId: "conv-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "INVALID_PAYLOAD");
});

test("validateCallRequest rejects self call", async () => {
  const useCases = createUseCases();

  const result = await useCases.validateCallRequest({
    callerId: "u1",
    calleeId: "u1",
    conversationId: "conv-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "SELF_CALL");
});

test("validateCallRequest rejects when callee does not exist", async () => {
  const useCases = createUseCases({
    existsUserById: async () => false,
  });

  const result = await useCases.validateCallRequest({
    callerId: "u1",
    calleeId: "u2",
    conversationId: "conv-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "USER_NOT_FOUND");
});

test("validateCallRequest rejects non-friends", async () => {
  const useCases = createUseCases({
    findFriendshipByPair: async () => null,
  });

  const result = await useCases.validateCallRequest({
    callerId: "u1",
    calleeId: "u2",
    conversationId: "conv-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "FORBIDDEN_CALL");
});

test("validateCallRequest rejects when direct conversation is invalid", async () => {
  const useCases = createUseCases({
    isDirectConversationBetweenUsers: async () => false,
  });

  const result = await useCases.validateCallRequest({
    callerId: "u1",
    calleeId: "u2",
    conversationId: "conv-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "INVALID_CONVERSATION");
});

test("validateCallRequest allows valid friend direct call", async () => {
  const useCases = createUseCases();

  const result = await useCases.validateCallRequest({
    callerId: "u1",
    calleeId: "u2",
    conversationId: "conv-1",
  });

  assert.deepEqual(result, { allowed: true });
});
