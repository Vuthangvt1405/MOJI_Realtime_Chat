import { getContainer } from "../app/container.js";
import { handleError } from "../shared/http/handleError.js";

export const uploadMessageImage = async (req, res) => {
  try {
    const { useCases } = getContainer();
    const response = await useCases.uploadMessageImage({
      file: req.file,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi xảy ra khi upload image message",
      fallbackMessage: "Upload ảnh thất bại",
    });
  }
};

export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId, imgUrls, imgUrl } = req.body;
    const { useCases } = getContainer();
    const response = await useCases.sendDirectMessage({
      recipientId,
      content,
      conversationId,
      imgUrls,
      imgUrl,
      senderId: req.user._id,
    });

    return res.status(201).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi xảy ra khi gửi tin nhắn trực tiếp",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { conversationId, content, imgUrls, imgUrl } = req.body;
    const { useCases } = getContainer();
    const response = await useCases.sendGroupMessage({
      conversationId,
      content,
      imgUrls,
      imgUrl,
      senderId: req.user._id,
      conversation: req.conversation,
    });

    return res.status(201).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi xảy ra khi gửi tin nhắn nhóm",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};
