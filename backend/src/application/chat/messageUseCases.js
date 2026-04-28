import {
  assertMessageInput,
  normalizeMessageInput,
  updateConversationAfterMessage,
} from "../../domain/chat/policies/messagePolicy.js";
import { AppError } from "../../shared/errors/AppError.js";

export const makeMessageUseCases = ({ repositories, socketGateway, imageGateway }) => ({
  async uploadMessageImage({ file }) {
    if (!file) {
      throw new AppError(400, "Không tìm thấy file upload");
    }

    if (!file.mimetype?.startsWith("image/")) {
      throw new AppError(400, "File upload phải là ảnh");
    }

    const result = await imageGateway.uploadImageFromBuffer(file.buffer, {
      fileName: file.originalname || "chat-image",
      mimeType: file.mimetype,
    });

    if (!result?.secure_url) {
      throw new AppError(502, "Image host không trả về URL hợp lệ");
    }

    return { imgUrl: result.secure_url };
  },

  async sendDirectMessage({ recipientId, content, conversationId, imgUrls, imgUrl, senderId }) {
    const input = normalizeMessageInput({ content, imgUrls, imgUrl });
    assertMessageInput(input);

    let conversation = null;

    if (conversationId) {
      conversation = await repositories.findConversationById(conversationId);
    }

    if (!conversation) {
      conversation = await repositories.createDirectConversation(senderId, recipientId);
    }

    const message = await repositories.createMessage({
      conversationId: conversation._id,
      senderId,
      content: input.content || null,
      imgUrl: input.imgUrl,
      imgUrls: input.imgUrls,
    });

    updateConversationAfterMessage(conversation, message, senderId);

    await repositories.saveConversation(conversation);

    socketGateway.emitNewMessage(conversation, message);

    return { message };
  },

  async sendGroupMessage({ conversationId, content, imgUrls, imgUrl, senderId, conversation }) {
    const input = normalizeMessageInput({ content, imgUrls, imgUrl });
    assertMessageInput(input);

    const message = await repositories.createMessage({
      conversationId,
      senderId,
      content: input.content || null,
      imgUrl: input.imgUrl,
      imgUrls: input.imgUrls,
    });

    updateConversationAfterMessage(conversation, message, senderId);

    await repositories.saveConversation(conversation);

    socketGateway.emitNewMessage(conversation, message);

    return { message };
  },
});
