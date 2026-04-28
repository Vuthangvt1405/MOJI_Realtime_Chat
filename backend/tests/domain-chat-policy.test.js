import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCreateConversationInput,
  assertMessageInput,
  normalizeMessageInput,
  updateConversationAfterMessage,
} from "../src/domain/chat/policies/messagePolicy.js";

test("normalizeMessageInput trims content and filters empty imgUrls", () => {
  const input = normalizeMessageInput({
    content: "  hello  ",
    imgUrls: ["https://a.png", "", "   ", "https://b.png"],
  });

  assert.equal(input.content, "hello");
  assert.deepEqual(input.imgUrls, ["https://a.png", "https://b.png"]);
  assert.equal(input.imgUrl, "https://a.png");
});

test("normalizeMessageInput falls back to imgUrl", () => {
  const input = normalizeMessageInput({
    content: "",
    imgUrl: "  https://single.png ",
  });

  assert.equal(input.content, "");
  assert.deepEqual(input.imgUrls, ["https://single.png"]);
  assert.equal(input.imgUrl, "https://single.png");
});

test("assertMessageInput throws when both content and images are missing", () => {
  assert.throws(
    () => assertMessageInput({ content: "", imgUrls: [] }),
    /Thiếu nội dung hoặc hình ảnh/
  );
});

test("assertCreateConversationInput validates direct and group payloads", () => {
  assert.throws(
    () =>
      assertCreateConversationInput({
        type: "group",
        name: "",
        memberIds: ["u2"],
      }),
    /Tên nhóm và danh sách thành viên là bắt buộc/
  );

  assert.doesNotThrow(() =>
    assertCreateConversationInput({
      type: "direct",
      memberIds: ["u2"],
    })
  );
});

test("updateConversationAfterMessage updates preview and unread counts", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const conversation = {
    participants: [{ userId: "u1" }, { userId: "u2" }],
    unreadCounts: new Map([
      ["u1", 7],
      ["u2", 1],
    ]),
    set(payload) {
      Object.assign(this, payload);
    },
  };

  const message = {
    _id: "m1",
    content: "",
    imgUrl: null,
    imgUrls: ["https://img-1.png", "https://img-2.png"],
    createdAt: now,
  };

  updateConversationAfterMessage(conversation, message, "u1");

  assert.equal(conversation.lastMessage.content, "Hinh anh (2)");
  assert.equal(conversation.lastMessage.createdAt, now);
  assert.equal(conversation.unreadCounts.get("u1"), 0);
  assert.equal(conversation.unreadCounts.get("u2"), 2);
});
