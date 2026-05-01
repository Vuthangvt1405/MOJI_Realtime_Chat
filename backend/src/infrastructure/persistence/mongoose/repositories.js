import mongoose from "mongoose";
import { AppError } from "../../../shared/errors/AppError.js";

import Conversation from "../../../models/Conversation.js";
import Friend from "../../../models/Friend.js";
import FriendRequest from "../../../models/FriendRequest.js";
import Message from "../../../models/Message.js";
import PasswordResetToken from "../../../models/PasswordResetToken.js";
import Session from "../../../models/Session.js";
import User from "../../../models/User.js";

/**
 * Purpose:
 * Converts a Map unreadCounts value to a plain object for serialization.
 */
const normalizeUnreadCounts = (value) => {
  if (!value) {
    return {};
  }

  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  return value;
};

/**
 * Purpose:
 * Maps Mongoose participant subdocs to a plain object DTO with selected fields.
 */
const mapConversationParticipants = (conversation) =>
  (conversation.participants || []).map((participant) => ({
    _id: participant.userId?._id,
    displayName: participant.userId?.displayName,
    avatarUrl: participant.userId?.avatarUrl ?? null,
    joinedAt: participant.joinedAt,
    clearedAt: participant.clearedAt ?? null,
  }));

/**
 * Purpose:
 * Converts ObjectId-like values, populated docs, and strings into comparable IDs.
 *
 * How it works:
 * It prefers a populated document's _id when present, otherwise uses the value's
 * own toString method.
 *
 * Parameters:
 * - value: ObjectId, string, populated document, or nullish value.
 *
 * Returns:
 * String ID, or undefined when no value exists.
 */
const toEntityId = (value) => value?._id?.toString?.() || value?.toString?.();

/**
 * Purpose:
 * Maps a user document to the lightweight reaction user DTO.
 *
 * How it works:
 * It keeps public identity fields only and falls back to username when
 * displayName is not available.
 *
 * Parameters:
 * - user: Lean user document or fallback identity object.
 *
 * Returns:
 * Object { _id, username, displayName, avatarUrl }.
 */
const mapReactionUser = (user) => ({
  _id: user._id,
  username: user.username,
  displayName: user.displayName || user.username || "Unknown",
  avatarUrl: user.avatarUrl ?? null,
});

/**
 * Purpose:
 * Formats raw message reaction rows into grouped emoji summaries for one user.
 *
 * How it works:
 * Loads public user data for reaction user IDs, groups rows by emoji, counts
 * each group, and marks whether currentUserId appears in the group.
 *
 * Parameters:
 * - message: Message document containing raw reactions.
 * - currentUserId: User ID used to compute reactedByMe.
 *
 * Returns:
 * Array of reaction summaries with users and counts.
 */
const formatMessageReactionsForUser = async (message, currentUserId) => {
  const reactions = Array.from(message?.reactions || []);

  if (reactions.length === 0) {
    return [];
  }

  const userIds = [...new Set(reactions.map((reaction) => toEntityId(reaction.userId)).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id username displayName avatarUrl")
    .lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), mapReactionUser(user)]));
  const grouped = new Map();

  reactions.forEach((reaction) => {
    const reactionUserId = toEntityId(reaction.userId);

    if (!reaction.emoji || !reactionUserId) {
      return;
    }

    const current = grouped.get(reaction.emoji) || {
      emoji: reaction.emoji,
      count: 0,
      reactedByMe: false,
      users: [],
    };

    current.count += 1;
    current.reactedByMe = current.reactedByMe || reactionUserId === currentUserId.toString();
    current.users.push(
      usersById.get(reactionUserId) ||
        mapReactionUser({ _id: reactionUserId, displayName: "Unknown", avatarUrl: null }),
    );
    grouped.set(reaction.emoji, current);
  });

  return Array.from(grouped.values());
};

/**
 * Purpose:
 * Converts a message document into the API message DTO.
 *
 * How it works:
 * It converts Mongoose docs to plain objects when possible and replaces raw
 * reaction rows with grouped reaction summaries for the requesting user.
 *
 * Parameters:
 * - message: Message document or plain message object.
 * - currentUserId: User ID used to compute reaction ownership.
 *
 * Returns:
 * Message DTO with formatted reactions.
 */
const toMessageDto = async (message, currentUserId) => {
  const rawMessage = typeof message.toObject === "function" ? message.toObject() : { ...message };

  return {
    ...rawMessage,
    reactions: await formatMessageReactionsForUser(message, currentUserId),
  };
};

/**
 * Data access layer encapsulating all Mongoose model interactions.
 * Grouped by domain: conversation, message, user, session, password-reset, friend.
 */
export const repositories = {
  // ── Conversation ────────────────────────────────────────
  async findDirectConversation(userId, participantId) {
    return Conversation.findOne({
      type: "direct",
      "participants.userId": { $all: [userId, participantId] },
    });
  },

  async createDirectConversation(userId, participantId) {
    return Conversation.create({
      type: "direct",
      participants: [{ userId }, { userId: participantId }],
      lastMessageAt: new Date(),
      unreadCounts: new Map(),
    });
  },

  async createGroupConversation(userId, name, memberIds) {
    return Conversation.create({
      type: "group",
      participants: [{ userId }, ...memberIds.map((id) => ({ userId: id }))],
      group: {
        name,
        createdBy: userId,
      },
      lastMessageAt: new Date(),
    });
  },

  async populateConversation(conversation) {
    return conversation.populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      { path: "seenBy", select: "displayName avatarUrl" },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);
  },

  toConversationDto(conversation) {
    const rawConversation = conversation.toObject();

    return {
      ...rawConversation,
      participants: mapConversationParticipants(conversation),
      unreadCounts: normalizeUnreadCounts(rawConversation.unreadCounts),
    };
  },

  async listConversationsForUser(userId) {
    const currentUserId = userId.toString();
    const conversations = await Conversation.find({
      "participants.userId": userId,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate({
        path: "participants.userId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "lastMessage.senderId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "seenBy",
        select: "displayName avatarUrl",
      });

    return conversations
      .filter((conversation) => {
        const participant = conversation.participants.find((item) => {
          const participantId = item.userId?._id?.toString?.() || item.userId?.toString?.();
          return participantId === currentUserId;
        });

        const clearedAt = participant?.clearedAt ? new Date(participant.clearedAt) : null;

        if (!clearedAt) {
          return true;
        }

        if (!conversation.lastMessageAt) {
          return false;
        }

        return new Date(conversation.lastMessageAt) > clearedAt;
      })
      .map((conversation) => {
        const rawConversation = conversation.toJSON();

        return {
          ...rawConversation,
          unreadCounts: normalizeUnreadCounts(conversation.unreadCounts),
          participants: mapConversationParticipants(conversation),
        };
      });
  },

  async listMessages({ conversationId, userId, limit = 50, cursor = null }) {
    const conversation = await Conversation.findOne(
      {
        _id: conversationId,
        "participants.userId": userId,
      },
      {
        participants: 1,
      },
    );

    if (!conversation) {
      return null;
    }

    const participant = conversation.participants.find(
      (item) => item.userId.toString() === userId.toString(),
    );

    const clearedAt = participant?.clearedAt ? new Date(participant.clearedAt) : null;

    const query = { conversationId };
    const createdAtQuery = {};

    if (cursor) {
      createdAtQuery.$lt = new Date(cursor);
    }

    if (clearedAt) {
      createdAtQuery.$gt = clearedAt;
    }

    if (Object.keys(createdAtQuery).length > 0) {
      query.createdAt = createdAtQuery;
    }

    let messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1);

    let nextCursor = null;

    if (messages.length > Number(limit)) {
      const nextMessage = messages[messages.length - 1];
      nextCursor = nextMessage.createdAt.toISOString();
      messages.pop();
    }

    messages = messages.reverse();

    return {
      messages: await Promise.all(messages.map((message) => toMessageDto(message, userId))),
      nextCursor,
    };
  },

  async findConversationById(conversationId) {
    return Conversation.findById(conversationId);
  },

  async isDirectConversationBetweenUsers(conversationId, userAId, userBId) {
    return Conversation.exists({
      _id: conversationId,
      type: "direct",
      "participants.userId": { $all: [userAId, userBId] },
    });
  },

  async saveConversation(conversation) {
    return conversation.save();
  },

  async findConversationLeanById(conversationId) {
    return Conversation.findById(conversationId).lean();
  },

  async markConversationSeen(conversationId, userId) {
    return Conversation.findByIdAndUpdate(
      conversationId,
      {
        $addToSet: { seenBy: userId },
        $set: { [`unreadCounts.${userId}`]: 0 },
      },
      { new: true },
    );
  },

  async clearConversationForUser(conversationId, userId, clearedAt = new Date()) {
    return Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        "participants.userId": userId,
      },
      {
        $set: {
          "participants.$.clearedAt": clearedAt,
          [`unreadCounts.${userId}`]: 0,
        },
      },
      { new: true },
    );
  },

  async getUserConversationIds(userId) {
    const conversations = await Conversation.find(
      { "participants.userId": userId },
      { _id: 1 },
    );

    return conversations.map((conversation) => conversation._id.toString());
  },

  async createMessage(payload) {
    return Message.create(payload);
  },

  /**
   * Purpose:
   * Loads a single message by ID for reaction operations.
   *
   * How it works:
   * Delegates to Mongoose findById and returns the document for mutation.
   *
   * Parameters:
   * - messageId: ID of the message to load.
   *
   * Returns:
   * Message document or null.
   */
  async findMessageById(messageId) {
    return Message.findById(messageId);
  },

  /**
   * Purpose:
   * Persists a mutated message document.
   *
   * How it works:
   * Calls save on the provided Mongoose document and returns the saved result.
   *
   * Parameters:
   * - message: Message document with pending changes.
   *
   * Returns:
   * Saved message document.
   */
  async saveMessage(message) {
    return message.save();
  },

  /**
   * Purpose:
   * Formats raw message reactions for API and socket payloads.
   *
   * How it works:
   * Delegates to the shared formatter which groups reactions by emoji and adds
   * public user details plus reactedByMe for the current user.
   *
   * Parameters:
   * - message: Message document containing raw reactions.
   * - currentUserId: User ID used to compute reactedByMe.
   *
   * Returns:
   * Promise resolving to formatted reaction summaries.
   */
  formatMessageReactions(message, currentUserId) {
    return formatMessageReactionsForUser(message, currentUserId);
  },

  // ── User ───────────────────────────────────────────────
  async existsUserById(userId) {
    return User.exists({ _id: userId });
  },

  async findUserByUsername(username) {
    return User.findOne({ username });
  },

  async findUserByEmail(email) {
    return User.findOne({ email });
  },

  async createUser(payload) {
    return User.create(payload);
  },

  async findUserWithoutPasswordById(userId) {
    return User.findById(userId).select("-hashedPassword");
  },

  async findBasicUserById(userId) {
    return User.findById(userId).select("_id username displayName avatarUrl").lean();
  },

  async updateUserPasswordById(userId, hashedPassword) {
    return User.findByIdAndUpdate(userId, { hashedPassword });
  },

  async incrementUserTokenVersion(userId) {
    return User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  },

  async searchUsersByUsernamePrefix(username, currentUserId) {
    return User.find({
      _id: { $ne: currentUserId },
      username: {
        $regex: `^${username}`,
        $options: "i",
      },
    })
      .select("_id displayName username avatarUrl")
      .sort({ username: 1 })
      .limit(8)
      .lean();
  },

  async updateUserAvatarById(userId, avatarUrl, avatarId) {
    return User.findByIdAndUpdate(
      userId,
      { avatarUrl, avatarId },
      { new: true },
    ).select("avatarUrl");
  },

  async updateUserProfileById(userId, updates) {
    try {
      return await User.findByIdAndUpdate(userId, updates, {
        new: true,
        runValidators: true,
      }).select("-hashedPassword");
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError(409, "Email đã được sử dụng bởi tài khoản khác");
      }
      throw error;
    }
  },

  // ── Session ────────────────────────────────────────────
  async createSession(payload) {
    return Session.create(payload);
  },

  async deleteSessionByRefreshToken(refreshToken) {
    return Session.deleteOne({ refreshToken });
  },

  async findSessionByRefreshToken(refreshToken) {
    return Session.findOne({ refreshToken });
  },

  async deleteSessionsByUserId(userId) {
    return Session.deleteMany({ userId });
  },

  // ── Password Reset ─────────────────────────────────────
  async createPasswordResetToken(payload) {
    return PasswordResetToken.create(payload);
  },

  async findPasswordResetTokenByHash(tokenHash) {
    return PasswordResetToken.findOne({ tokenHash });
  },

  async deletePasswordResetTokensByUserId(userId) {
    return PasswordResetToken.deleteMany({ userId });
  },

  // ── Friend / FriendRequest ─────────────────────────────
  async findFriendshipByPair(userA, userB) {
    return Friend.findOne({ userA, userB });
  },

  async createFriendship(payload) {
    return Friend.create(payload);
  },

  async deleteFriendshipByPair(userA, userB) {
    return Friend.findOneAndDelete({ userA, userB });
  },

  async listFriendshipsByUser(userId) {
    return Friend.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .populate("userA", "_id displayName avatarUrl username")
      .populate("userB", "_id displayName avatarUrl username")
      .lean();
  },

  async findFriendRequestBetweenUsers(userIdA, userIdB) {
    return FriendRequest.findOne({
      $or: [
        { from: userIdA, to: userIdB },
        { from: userIdB, to: userIdA },
      ],
    });
  },

  async createFriendRequest(payload) {
    return FriendRequest.create(payload);
  },

  async findFriendRequestById(requestId) {
    return FriendRequest.findById(requestId);
  },

  async deleteFriendRequestById(requestId) {
    return FriendRequest.findByIdAndDelete(requestId);
  },

  async listFriendRequests(userId) {
    const populateFields = "_id username displayName avatarUrl";

    const [sent, received] = await Promise.all([
      FriendRequest.find({ from: userId }).populate("to", populateFields),
      FriendRequest.find({ to: userId }).populate("from", populateFields),
    ]);

    return { sent, received };
  },

  async deleteFriendRequestsBetween(userIdA, userIdB) {
    return FriendRequest.deleteMany({
      $or: [
        { from: userIdA, to: userIdB },
        { from: userIdB, to: userIdA },
      ],
    });
  },

  isValidObjectId(value) {
    return mongoose.Types.ObjectId.isValid(value);
  },
};
