import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import {
  emitNewMessage,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";
import { io } from "../socket/index.js";

const normalizeImageUrls = (imgUrls, imgUrl) => {
  if (Array.isArray(imgUrls)) {
    return imgUrls.filter((url) => typeof url === "string" && url.trim() !== "");
  }

  if (typeof imgUrl === "string" && imgUrl.trim() !== "") {
    return [imgUrl.trim()];
  }

  return [];
};

export const uploadMessageImage = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Không tìm thấy file upload" });
    }

    if (!file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ message: "File upload phải là ảnh" });
    }

    const result = await uploadImageFromBuffer(file.buffer, {
      fileName: file.originalname || "chat-image",
      mimeType: file.mimetype,
    });

    if (!result?.secure_url) {
      return res.status(502).json({ message: "Image host không trả về URL hợp lệ" });
    }

    return res.status(200).json({ imgUrl: result.secure_url });
  } catch (error) {
    console.error("Lỗi xảy ra khi upload image message", error);
    return res.status(500).json({ message: "Upload ảnh thất bại" });
  }
};

export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId, imgUrls, imgUrl } = req.body;
    const senderId = req.user._id;
    const normalizedContent = typeof content === "string" ? content.trim() : "";
    const normalizedImgUrls = normalizeImageUrls(imgUrls, imgUrl);

    let conversation;

    if (!normalizedContent && normalizedImgUrls.length === 0) {
      return res.status(400).json({ message: "Thiếu nội dung hoặc hình ảnh" });
    }

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [
          { userId: senderId, joinedAt: new Date() },
          { userId: recipientId, joinedAt: new Date() },
        ],
        lastMessageAt: new Date(),
        unreadCounts: new Map(),
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content: normalizedContent || null,
      imgUrl: normalizedImgUrls[0] || null,
      imgUrls: normalizedImgUrls,
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();

    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn trực tiếp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { conversationId, content, imgUrls, imgUrl } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;
    const normalizedContent = typeof content === "string" ? content.trim() : "";
    const normalizedImgUrls = normalizeImageUrls(imgUrls, imgUrl);

    if (!normalizedContent && normalizedImgUrls.length === 0) {
      return res.status(400).json({ message: "Thiếu nội dung hoặc hình ảnh" });
    }

    const message = await Message.create({
      conversationId,
      senderId,
      content: normalizedContent || null,
      imgUrl: normalizedImgUrls[0] || null,
      imgUrls: normalizedImgUrls,
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();
    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn nhóm", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
