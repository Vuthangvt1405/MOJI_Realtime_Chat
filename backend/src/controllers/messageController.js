import { getContainer } from "../app/container.js";
import { handleError } from "../shared/http/handleError.js";

/**
 * Purpose:
 * Handles image upload for messages before sending.
 *
 * How it works:
 * Passes the uploaded file to useCases.uploadMessageImage,
 * returns the cloud image URL.
 *
 * Parameters:
 * - req: Express request with req.file (multer)
 * - res: Express response
 *
 * Returns:
 * 200 JSON with imgUrl, or error via handleError.
 */
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

/**
 * Purpose:
 * Handles direct message creation and persistence.
 *
 * How it works:
 * Extracts recipientId, content, conversationId, imgUrls from body,
 * delegates to sendDirectMessage use case with senderId from auth context.
 *
 * Parameters:
 * - req: Express request with body fields, auth user context
 * - res: Express response
 *
 * Returns:
 * 201 JSON with saved message object, or error via handleError.
 */
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

/**
 * Purpose:
 * Handles group message creation and persistence.
 *
 * How it works:
 * Extracts conversationId, content, imgUrls from body, delegates to
 * sendGroupMessage use case with the pre-loaded conversation (from middleware).
 *
 * Parameters:
 * - req: Express request with body fields and req.conversation
 * - res: Express response
 *
 * Returns:
 * 201 JSON with saved message object, or error via handleError.
 */
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

/**
 * Purpose:
 * Adds or replaces the current user's reaction on a message.
 *
 * How it works:
 * Reads messageId from params and emoji from body, delegates to the reaction
 * use case, and returns the updated reaction summary payload.
 *
 * Parameters:
 * - req: Express request with params.messageId, body.emoji, and auth user.
 * - res: Express response.
 *
 * Returns:
 * 200 JSON with { messageId, conversationId, reactions }, or error via handleError.
 */
export const setMessageReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const { useCases } = getContainer();
    const response = await useCases.setMessageReaction({
      messageId,
      userId: req.user._id,
      emoji,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi reaction tin nhắn",
      fallbackMessage: "Reaction tin nhắn thất bại",
    });
  }
};

/**
 * Purpose:
 * Removes the current user's reaction from a message.
 *
 * How it works:
 * Reads messageId from params, delegates to the reaction removal use case, and
 * returns the updated reaction summary payload.
 *
 * Parameters:
 * - req: Express request with params.messageId and auth user.
 * - res: Express response.
 *
 * Returns:
 * 200 JSON with { messageId, conversationId, reactions }, or error via handleError.
 */
export const removeMessageReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { useCases } = getContainer();
    const response = await useCases.removeMessageReaction({
      messageId,
      userId: req.user._id,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi xóa reaction tin nhắn",
      fallbackMessage: "Xóa reaction tin nhắn thất bại",
    });
  }
};
