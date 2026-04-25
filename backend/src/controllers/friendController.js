import { getContainer } from "../app/container.js";
import { handleError } from "../shared/http/handleError.js";

export const sendFriendRequest = async (req, res) => {
  try {
    const { to, message } = req.body;
    const { useCases } = getContainer();
    const response = await useCases.sendFriendRequest({
      fromUser: req.user,
      to,
      message,
    });

    return res.status(201).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi gửi yêu cầu kết bạn",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { useCases } = getContainer();
    const response = await useCases.acceptFriendRequest({
      requestId,
      userId: req.user._id,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi chấp nhận lời mời kết bạn",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const declineFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { useCases } = getContainer();
    await useCases.declineFriendRequest({
      requestId,
      userId: req.user._id,
    });

    return res.sendStatus(204);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi từ chối lời mời kết bạn",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const getAllFriends = async (req, res) => {
  try {
    const { useCases } = getContainer();
    const response = await useCases.getAllFriends({
      userId: req.user._id,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi lấy danh sách bạn bè",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    const { useCases } = getContainer();
    const response = await useCases.getFriendRequests({
      userId: req.user._id,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi lấy danh sách yêu cầu kết bạn",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const deleteFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const { useCases } = getContainer();
    const response = await useCases.deleteFriend({
      userId: req.user._id.toString(),
      friendId,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi xóa bạn bè",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};
