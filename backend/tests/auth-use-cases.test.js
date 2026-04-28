import assert from "node:assert/strict";
import test from "node:test";

import { makeAuthUseCases } from "../src/application/auth/authUseCases.js";

const GENERIC_RESET_MESSAGE =
  "chúng tôi đã gửi liên kết đặt lại mật khẩu.";

const createAuthUseCases = (overrides = {}) => {
  const calls = {
    createdResetTokens: [],
    deletedResetTokensForUser: [],
    deletedSessionsForUser: [],
    incrementedTokenVersions: [],
    sentResetEmails: [],
    updatedPasswords: [],
  };

  const repositories = {
    findUserByUsername: async () => null,
    createUser: async () => null,
    createSession: async () => null,
    deleteSessionByRefreshToken: async () => null,
    findSessionByRefreshToken: async () => null,
    findUserByEmail: async () => null,
    deletePasswordResetTokensByUserId: async (userId) => {
      calls.deletedResetTokensForUser.push(userId);
    },
    createPasswordResetToken: async (payload) => {
      calls.createdResetTokens.push(payload);
      return payload;
    },
    findPasswordResetTokenByHash: async () => null,
    updateUserPasswordById: async (userId, hashedPassword) => {
      calls.updatedPasswords.push({ userId, hashedPassword });
    },
    deleteSessionsByUserId: async (userId) => {
      calls.deletedSessionsForUser.push(userId);
    },
    incrementUserTokenVersion: async (userId) => {
      calls.incrementedTokenVersions.push(userId);
    },
    ...overrides.repositories,
  };

  const securityServices = {
    hashPassword: async (password) => `hashed-password:${password}`,
    comparePassword: async () => true,
    signAccessToken: () => "access-token",
    generateRefreshToken: () => "refresh-token",
    generatePasswordResetToken: () => "raw-reset-token",
    hashPasswordResetToken: (token) => `hashed-token:${token}`,
    ...overrides.securityServices,
  };

  const mailGateway = {
    sendPasswordResetEmail: async (payload) => {
      calls.sentResetEmails.push(payload);
    },
    ...overrides.mailGateway,
  };

  return {
    calls,
    useCases: makeAuthUseCases({ repositories, securityServices, mailGateway }),
  };
};

test("forgotPassword returns warning for unknown email", async () => {
  const { calls, useCases } = createAuthUseCases();

  const result = await useCases.forgotPassword({ email: "missing@example.com" });

  assert.deepEqual(result, {
    status: "warning",
    message: "Tài khoản này hiện chưa tồn tại trên hệ thống vui lòng kiểm tra lại email.",
  });

  assert.equal(calls.createdResetTokens.length, 0);
  assert.equal(calls.sentResetEmails.length, 0);
});

test("forgotPassword stores hashed token and emails known user", async () => {
  const user = { _id: "user-1", email: "known@example.com", displayName: "Known User" };
  const { calls, useCases } = createAuthUseCases({
    repositories: {
      findUserByEmail: async () => user,
    },
  });

  const result = await useCases.forgotPassword({ email: " Known@Example.com " });

  assert.deepEqual(result, {
    status: "success",
    message: GENERIC_RESET_MESSAGE,
  });
  assert.deepEqual(calls.deletedResetTokensForUser, ["user-1"]);
  assert.equal(calls.createdResetTokens.length, 1);
  assert.equal(calls.createdResetTokens[0].userId, "user-1");
  assert.equal(calls.createdResetTokens[0].tokenHash, "hashed-token:raw-reset-token");
  assert.notEqual(calls.createdResetTokens[0].tokenHash, "raw-reset-token");
  assert.ok(calls.createdResetTokens[0].expiresAt instanceof Date);
  assert.equal(calls.sentResetEmails.length, 1);
  assert.equal(calls.sentResetEmails[0].to, "known@example.com");
  assert.match(calls.sentResetEmails[0].resetUrl, /\/reset-password\?token=raw-reset-token$/);
});

test("resetPassword rejects unknown reset token", async () => {
  const { useCases } = createAuthUseCases();

  await assert.rejects(
    () =>
      useCases.resetPassword({
        token: "missing-token",
        newPassword: "new-secret",
      }),
    /Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn/,
  );
});

test("resetPassword rejects expired reset token", async () => {
  const { useCases } = createAuthUseCases({
    repositories: {
      findPasswordResetTokenByHash: async () => ({
        userId: "user-1",
        tokenHash: "hashed-token:expired-token",
        expiresAt: new Date(Date.now() - 1000),
      }),
    },
  });

  await assert.rejects(
    () =>
      useCases.resetPassword({
        token: "expired-token",
        newPassword: "new-secret",
      }),
    /Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn/,
  );
});

test("resetPassword rejects used reset token", async () => {
  const { useCases } = createAuthUseCases({
    repositories: {
      findPasswordResetTokenByHash: async () => ({
        userId: "user-1",
        tokenHash: "hashed-token:used-token",
        expiresAt: new Date(Date.now() + 1000),
        usedAt: new Date(),
      }),
    },
  });

  await assert.rejects(
    () =>
      useCases.resetPassword({
        token: "used-token",
        newPassword: "new-secret",
      }),
    /Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn/,
  );
});

test("resetPassword updates password and revokes existing sessions", async () => {
  const { calls, useCases } = createAuthUseCases({
    repositories: {
      findPasswordResetTokenByHash: async () => ({
        userId: "user-1",
        tokenHash: "hashed-token:valid-token",
        expiresAt: new Date(Date.now() + 1000),
      }),
    },
  });

  const result = await useCases.resetPassword({
    token: "valid-token",
    newPassword: "new-secret",
  });

  assert.deepEqual(result, { message: "Đặt lại mật khẩu thành công." });
  assert.deepEqual(calls.updatedPasswords, [
    { userId: "user-1", hashedPassword: "hashed-password:new-secret" },
  ]);
  assert.deepEqual(calls.deletedResetTokensForUser, ["user-1"]);
  assert.deepEqual(calls.deletedSessionsForUser, ["user-1"]);
  assert.deepEqual(calls.incrementedTokenVersions, ["user-1"]);
});
