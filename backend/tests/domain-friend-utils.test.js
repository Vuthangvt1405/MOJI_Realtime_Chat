import assert from "node:assert/strict";
import test from "node:test";

import { pairUserIds } from "../src/domain/friend/utils/pairUserIds.js";

test("pairUserIds sorts user ids lexicographically", () => {
  assert.deepEqual(pairUserIds("z-user", "a-user"), ["a-user", "z-user"]);
  assert.deepEqual(pairUserIds("a-user", "z-user"), ["a-user", "z-user"]);
});
