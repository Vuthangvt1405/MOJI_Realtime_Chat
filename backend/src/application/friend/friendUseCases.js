import { pairUserIds } from "../../domain/friend/utils/pairUserIds.js";
import { AppError } from "../../shared/errors/AppError.js";

export const makeFriendUseCases = ({ repositories, socketGateway }) => ({
  async sendFriendRequest({ fromUser, to, message }) {
    const from = fromUser._id;

    if (from.toString() === to.toString()) {
      throw new AppError(400, "Không thể gửi lời mời kết bạn cho chính mình");
    }

    const userExists = await repositories.existsUserById(to);

    if (!userExists) {
      throw new AppError(404, "Người dùng không tồn tại");
    }

    const [userA, userB] = pairUserIds(from.toString(), to.toString());

    const [alreadyFriends, existingRequest] = await Promise.all([
      repositories.findFriendshipByPair(userA, userB),
      repositories.findFriendRequestBetweenUsers(from, to),
    ]);

    if (alreadyFriends) {
      throw new AppError(400, "Hai người đã là bạn bè");
    }

    if (existingRequest) {
      throw new AppError(400, "Đã có lời mời kết bạn đang chờ");
    }

    const request = await repositories.createFriendRequest({ from, to, message });

    socketGateway.emitFriendRequestNew(to.toString(), {
      request: {
        _id: request._id,
        from: {
          _id: fromUser._id,
          username: fromUser.username,
          displayName: fromUser.displayName,
          avatarUrl: fromUser.avatarUrl,
        },
        message: request.message ?? "",
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    });

    return {
      message: "Gửi lời mời kết bạn thành công",
      request,
    };
  },

  async acceptFriendRequest({ requestId, userId }) {
    const request = await repositories.findFriendRequestById(requestId);

    if (!request) {
      throw new AppError(404, "Không tìm thấy lời mời kết bạn");
    }

    if (request.to.toString() !== userId.toString()) {
      throw new AppError(403, "Bạn không có quyền chấp nhận lời mời này");
    }

    await repositories.createFriendship({
      userA: request.from,
      userB: request.to,
    });

    await repositories.deleteFriendRequestById(requestId);

    const from = await repositories.findBasicUserById(request.from);

    return {
      message: "Chấp nhận lời mời kết bạn thành công",
      newFriend: {
        _id: from?._id,
        username: from?.username,
        displayName: from?.displayName,
        avatarUrl: from?.avatarUrl,
      },
    };
  },

  async declineFriendRequest({ requestId, userId }) {
    const request = await repositories.findFriendRequestById(requestId);

    if (!request) {
      throw new AppError(404, "Không tìm thấy lời mời kết bạn");
    }

    if (request.to.toString() !== userId.toString()) {
      throw new AppError(403, "Bạn không có quyền từ chối lời mời này");
    }

    await repositories.deleteFriendRequestById(requestId);
  },

  async getAllFriends({ userId }) {
    const friendships = await repositories.listFriendshipsByUser(userId);

    if (!friendships.length) {
      return { friends: [] };
    }

    const friends = friendships.map((friendship) =>
      friendship.userA._id.toString() === userId.toString()
        ? friendship.userB
        : friendship.userA,
    );

    return { friends };
  },

  async getFriendRequests({ userId }) {
    return repositories.listFriendRequests(userId);
  },

  async deleteFriend({ userId, friendId }) {
    if (!friendId || !repositories.isValidObjectId(friendId)) {
      throw new AppError(400, "ID bạn bè không hợp lệ");
    }

    if (friendId === userId) {
      throw new AppError(400, "Không thể xóa chính mình");
    }

    const [userA, userB] = pairUserIds(userId, friendId);
    const removedFriend = await repositories.deleteFriendshipByPair(userA, userB);

    if (!removedFriend) {
      throw new AppError(404, "Không tìm thấy bạn bè để xóa");
    }

    await repositories.deleteFriendRequestsBetween(userId, friendId);

    return {
      message: "Đã xóa bạn bè thành công",
      removedFriendId: friendId,
    };
  },
});
