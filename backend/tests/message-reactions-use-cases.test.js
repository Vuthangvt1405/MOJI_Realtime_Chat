import assert from "node:assert/strict";
import test from "node:test";

import { makeMessageUseCases } from "../src/application/chat/messageUseCases.js";

const reactionUsers = {
  u2: { _id: "u2", displayName: "Liam", avatarUrl: "https://avatar.test/liam.png" },
  u3: { _id: "u3", displayName: "Moji", avatarUrl: null },
};

/**
 * Purpose:
 * Builds the reaction summary shape returned by the repository in tests.
 *
 * How it works:
 * It groups raw reaction rows by emoji, maps user IDs to lightweight users,
 * and marks whether the current user used each emoji.
 *
 * Parameters:
 * - reactions: Raw reaction rows from the fake message document.
 * - currentUserId: User ID used to compute reactedByMe.
 *
 * Returns:
 * Array of formatted reaction summaries.
 */
const summarizeReactions = (reactions, currentUserId) => {
  const grouped = new Map();

  reactions.forEach((reaction) => {
    const userId = reaction.userId.toString();
    const current = grouped.get(reaction.emoji) || {
      emoji: reaction.emoji,
      count: 0,
      reactedByMe: false,
      users: [],
    };

    current.count += 1;
    current.reactedByMe = current.reactedByMe || userId === currentUserId;
    current.users.push(reactionUsers[userId] || { _id: userId, displayName: "Unknown", avatarUrl: null });
    grouped.set(reaction.emoji, current);
  });

  return Array.from(grouped.values());
};

/**
 * Purpose:
 * Creates message reaction use cases with in-memory repository fakes.
 *
 * How it works:
 * It wires makeMessageUseCases to fake message/conversation documents,
 * captures saved messages and socket emissions, and allows per-test overrides.
 *
 * Parameters:
 * - overrides: Optional repository, message, and conversation overrides.
 *
 * Returns:
 * Object containing useCases, fake documents, and captured calls.
 */
const createReactionUseCases = (overrides = {}) => {
  const calls = {
    emittedReactionUpdates: [],
    savedMessages: [],
    savedConversations: [],
  };

  const message = {
    _id: "m1",
    conversationId: "c1",
    senderId: "u1",
    content: "hello",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    reactions: [],
    ...overrides.message,
  };

  const conversation = {
    _id: "c1",
    lastMessage: { _id: "m1", content: "hello" },
    unreadCounts: new Map([
      ["u1", 0],
      ["u2", 3],
    ]),
    participants: [{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }],
    ...overrides.conversation,
  };

  const repositories = {
    isValidObjectId: () => true,
    findMessageById: async () => message,
    findConversationById: async () => conversation,
    saveMessage: async (updatedMessage) => {
      calls.savedMessages.push(updatedMessage);
      return updatedMessage;
    },
    saveConversation: async (conv) => {
      calls.savedConversations.push(conv);
      return conv;
    },
    findBasicUserById: async () => ({ _id: "u2", username: "liam99", displayName: "Liam" }),
    formatMessageReactions: async (updatedMessage, currentUserId) =>
      summarizeReactions(updatedMessage.reactions, currentUserId.toString()),
    ...overrides.repositories,
  };

  const socketGateway = {
    emitNewMessage: () => {},
    emitMessageReactionUpdated: (conversationId, payload) => {
      calls.emittedReactionUpdates.push({ conversationId, payload });
    },
  };

  return {
    calls,
    conversation,
    message,
    useCases: makeMessageUseCases({
      repositories,
      socketGateway,
      imageGateway: {},
    }),
  };
};

test("setMessageReaction adds a reaction and emits the formatted update", async () => {
  const { calls, message, useCases } = createReactionUseCases();

  const result = await useCases.setMessageReaction({
    messageId: "m1",
    userId: "u2",
    emoji: "👍",
  });

  assert.equal(message.reactions.length, 1);
  assert.equal(message.reactions[0].userId, "u2");
  assert.equal(message.reactions[0].emoji, "👍");
  assert.ok(message.reactions[0].createdAt instanceof Date);
  assert.ok(message.reactions[0].updatedAt instanceof Date);
  assert.equal(result.messageId, "m1");
  assert.equal(result.conversationId, "c1");
  assert.deepEqual(result.reactions, [
    {
      emoji: "👍",
      count: 1,
      reactedByMe: true,
      users: [reactionUsers.u2],
    },
  ]);
  assert.ok(result.conversation);
  assert.ok(result.unreadCounts);
  assert.equal(calls.savedMessages.length, 1);
  assert.equal(calls.emittedReactionUpdates.length, 1);
  assert.equal(calls.emittedReactionUpdates[0].conversationId, "c1");
  assert.deepEqual(calls.emittedReactionUpdates[0].payload, result);
});

test("setMessageReaction replaces the current user's previous reaction", async () => {
  const { message, useCases } = createReactionUseCases({
    message: {
      reactions: [
        { userId: "u2", emoji: "❤️", createdAt: new Date("2026-01-01T10:01:00.000Z") },
        { userId: "u3", emoji: "🔥", createdAt: new Date("2026-01-01T10:02:00.000Z") },
      ],
    },
  });

  const result = await useCases.setMessageReaction({
    messageId: "m1",
    userId: "u2",
    emoji: "😂",
  });

  assert.equal(message.reactions.length, 2);
  assert.equal(message.reactions.filter((reaction) => reaction.userId === "u2").length, 1);
  assert.equal(message.reactions.find((reaction) => reaction.userId === "u2")?.emoji, "😂");
  assert.equal(message.reactions.find((reaction) => reaction.userId === "u3")?.emoji, "🔥");
  assert.deepEqual(result.reactions.map((reaction) => reaction.emoji), ["😂", "🔥"]);
});

test("removeMessageReaction removes only the current user's reaction", async () => {
  const { message, useCases } = createReactionUseCases({
    message: {
      reactions: [
        { userId: "u2", emoji: "❤️", createdAt: new Date("2026-01-01T10:01:00.000Z") },
        { userId: "u3", emoji: "❤️", createdAt: new Date("2026-01-01T10:02:00.000Z") },
      ],
    },
  });

  const result = await useCases.removeMessageReaction({
    messageId: "m1",
    userId: "u2",
  });

  assert.equal(message.reactions.length, 1);
  assert.equal(message.reactions[0].userId, "u3");
  assert.deepEqual(result, {
    messageId: "m1",
    conversationId: "c1",
    reactions: [
      {
        emoji: "❤️",
        count: 1,
        reactedByMe: false,
        users: [reactionUsers.u3],
      },
    ],
  });
});

test("setMessageReaction rejects unsupported emojis", async () => {
  const { useCases } = createReactionUseCases();

  await assert.rejects(
    () =>
      useCases.setMessageReaction({
        messageId: "m1",
        userId: "u2",
        emoji: "🚀",
      }),
    /Reaction emoji không được hỗ trợ/,
  );
});

test("setMessageReaction rejects users outside the conversation", async () => {
  const { useCases } = createReactionUseCases();

  await assert.rejects(
    () =>
      useCases.setMessageReaction({
        messageId: "m1",
        userId: "u9",
        emoji: "👍",
      }),
    /Bạn không có quyền reaction tin nhắn này/,
  );
});

test("setMessageReaction hides messages cleared from the current user's view", async () => {
  const { useCases } = createReactionUseCases({
    conversation: {
      participants: [
        { userId: "u1" },
        { userId: "u2", clearedAt: new Date("2026-01-01T11:00:00.000Z") },
      ],
    },
  });

  await assert.rejects(
    () =>
      useCases.setMessageReaction({
        messageId: "m1",
        userId: "u2",
        emoji: "👍",
      }),
    /Tin nhắn không tồn tại/,
  );
});

test("setMessageReaction updates conversation metadata with synthetic lastMessage preview", async () => {
  const { calls, conversation, useCases } = createReactionUseCases();

  await useCases.setMessageReaction({
    messageId: "m1",
    userId: "u2",
    emoji: "👍",
  });

  assert.equal(calls.savedConversations.length, 1);
  const savedConversation = calls.savedConversations[0];
  assert.ok(savedConversation.lastMessage._id.startsWith("reaction:"));
  assert.equal(savedConversation.lastMessage.content, "Liam reacted 👍");
  assert.equal(savedConversation.lastMessage.senderId, "u2");
  assert.ok(savedConversation.lastMessage.createdAt instanceof Date);
  assert.ok(savedConversation.lastMessageAt instanceof Date);
  assert.deepEqual(savedConversation.seenBy, []);
  assert.ok(conversation.lastMessageAt !== null);
});

test("setMessageReaction increments unreadCounts for non-reactors and resets reactor", async () => {
  const { calls, useCases } = createReactionUseCases();

  await useCases.setMessageReaction({
    messageId: "m1",
    userId: "u2",
    emoji: "❤️",
  });

  const savedConversation = calls.savedConversations[0];
  const counts = savedConversation.unreadCounts;

  assert.equal(counts.get("u2"), 0, "reactor unread must be 0");

  const prevU1 = 0;
  const prevU3 = 0;
  assert.equal(counts.get("u1"), prevU1 + 1, "non-reactor u1 unread incremented");
  assert.equal(counts.get("u3") ?? 0, prevU3 + 1, "non-reactor u3 unread incremented");
});

test("setMessageReaction emits payload with conversation metadata and unreadCounts", async () => {
  const { calls, useCases } = createReactionUseCases();

  const result = await useCases.setMessageReaction({
    messageId: "m1",
    userId: "u2",
    emoji: "😂",
  });

  assert.ok(result.conversation);
  assert.equal(typeof result.conversation._id, "string");
  assert.ok(result.conversation.lastMessage);
  assert.ok(result.conversation.lastMessageAt);
  assert.ok(result.unreadCounts);
  assert.equal(typeof result.unreadCounts.u2, "number");

  const emitted = calls.emittedReactionUpdates[0];
  assert.ok(emitted.payload.conversation);
  assert.ok(emitted.payload.unreadCounts);
});

test("removeMessageReaction does not update conversation metadata", async () => {
  const { calls, useCases } = createReactionUseCases({
    message: {
      reactions: [
        { userId: "u2", emoji: "❤️", createdAt: new Date("2026-01-01T10:01:00.000Z") },
        { userId: "u3", emoji: "🔥", createdAt: new Date("2026-01-01T10:02:00.000Z") },
      ],
    },
  });

  const result = await useCases.removeMessageReaction({
    messageId: "m1",
    userId: "u2",
  });

  assert.equal(calls.savedConversations.length, 0);
  assert.equal(result.conversation, undefined);
  assert.equal(result.unreadCounts, undefined);
});

test("removeMessageReaction still emits reaction-only payload", async () => {
  const { calls, useCases } = createReactionUseCases({
    message: {
      reactions: [
        { userId: "u2", emoji: "❤️", createdAt: new Date("2026-01-01T10:01:00.000Z") },
      ],
    },
  });

  const result = await useCases.removeMessageReaction({
    messageId: "m1",
    userId: "u2",
  });

  assert.deepEqual(result.messageId, "m1");
  assert.deepEqual(result.conversationId, "c1");
  assert.ok(Array.isArray(result.reactions));
  assert.ok(result.reactions.length === 0 || result.reactions.every(r => !r.reactedByMe));
});
