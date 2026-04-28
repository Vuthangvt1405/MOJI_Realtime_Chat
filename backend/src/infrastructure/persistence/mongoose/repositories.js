import mongoose from "mongoose";

import Conversation from "../../../models/Conversation.js";
import Friend from "../../../models/Friend.js";
import FriendRequest from "../../../models/FriendRequest.js";
import Message from "../../../models/Message.js";
import PasswordResetToken from "../../../models/PasswordResetToken.js";
import Session from "../../../models/Session.js";
import User from "../../../models/User.js";

const normalizeUnreadCounts = (value) => {
  if (!value) {
    return {};
  }

  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  return value;
};

const mapConversationParticipants = (conversation) =>
  (conversation.participants || []).map((participant) => ({
    _id: participant.userId?._id,
    displayName: participant.userId?.displayName,
    avatarUrl: participant.userId?.avatarUrl ?? null,
    joinedAt: participant.joinedAt,
    clearedAt: participant.clearedAt ?? null,
  }));

export const repositories = {
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

    return {
      messages: messages.reverse(),
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

  async createPasswordResetToken(payload) {
    return PasswordResetToken.create(payload);
  },

  async findPasswordResetTokenByHash(tokenHash) {
    return PasswordResetToken.findOne({ tokenHash });
  },

  async deletePasswordResetTokensByUserId(userId) {
    return PasswordResetToken.deleteMany({ userId });
  },

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
