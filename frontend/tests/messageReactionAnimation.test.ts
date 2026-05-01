import assert from "node:assert/strict";
import { test } from "node:test";
import type { MessageReactionSummary } from "../src/types/chat.ts";
import {
  getReactionAnimationEmoji,
  getReactionSignature,
} from "../src/components/chat/messageReactionAnimation.ts";

/**
 * Purpose:
 * Builds a compact reaction summary for helper tests.
 *
 * How it works:
 * It maps simple user IDs into the reaction user shape used by chat messages.
 *
 * Parameters:
 * - emoji: Reaction emoji for the summary.
 * - count: Number of users represented by this reaction.
 * - userIds: IDs to include in the reaction user list.
 * - reactedByMe: Whether this summary should represent the current user.
 *
 * Returns:
 * A MessageReactionSummary test fixture.
 */
const summary = (
  emoji: string,
  count: number,
  userIds: string[],
  reactedByMe = false,
): MessageReactionSummary => ({
  emoji,
  count,
  reactedByMe,
  users: userIds.map((userId) => ({
    _id: userId,
    displayName: userId,
  })),
});

test("reaction signature is stable when reaction order changes", () => {
  const first = [summary("🔥", 2, ["b", "a"]), summary("👍", 1, ["c"])];
  const second = [summary("👍", 1, ["c"]), summary("🔥", 2, ["a", "b"])];

  assert.equal(getReactionSignature(first), getReactionSignature(second));
});

test("reaction animation emoji prefers reactions with increased counts", () => {
  const previous = [summary("👍", 1, ["a"]), summary("🔥", 1, ["b"])];
  const next = [summary("👍", 1, ["a"]), summary("🔥", 2, ["b", "c"])];

  assert.equal(getReactionAnimationEmoji(previous, next), "🔥");
});

test("reaction animation emoji falls back to the new current-user reaction", () => {
  const previous = [summary("👍", 1, ["a"]), summary("❤️", 1, ["b"])];
  const next = [summary("👍", 1, ["a"]), summary("❤️", 1, ["b"], true)];

  assert.equal(getReactionAnimationEmoji(previous, next), "❤️");
});

test("reaction animation emoji returns null when no reactions remain", () => {
  const previous = [summary("👍", 1, ["a"], true)];

  assert.equal(getReactionAnimationEmoji(previous, []), null);
});
