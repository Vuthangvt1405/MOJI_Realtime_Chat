import { getContainer } from "../app/container.js";
import { handleError } from "../shared/http/handleError.js";

export const createConversation = async (req, res) => {
  try {
    const { type, name, memberIds } = req.body;
    const { useCases } = getContainer();
    const response = await useCases.createConversation({
      userId: req.user._id,
      type,
      name,
      memberIds,
    });

    return res.status(201).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi tạo conversation",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const getConversations = async (req, res) => {
  try {
    const { useCases } = getContainer();
    const response = await useCases.getConversations({
      userId: req.user._id,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi xảy ra khi lấy conversations",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, cursor } = req.query;
    const { useCases } = getContainer();
    const response = await useCases.getMessages({
      conversationId,
      userId: req.user._id,
      limit,
      cursor,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi xảy ra khi lấy messages",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const getUserConversationsForSocketIO = async (userId) => {
  try {
    const { useCases } = getContainer();
    return useCases.getUserConversationsForSocketIO({ userId });
  } catch (error) {
    console.error("Lỗi khi fetch conversations: ", error);
    return [];
  }
};

export const markAsSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();
    const { useCases } = getContainer();
    const response = await useCases.markAsSeen({
      conversationId,
      userId,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi mark as seen",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const clearConversationForUser = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { useCases } = getContainer();
    const response = await useCases.clearConversationForUser({
      conversationId,
      userId: req.user._id,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi clear conversation cho user",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};
