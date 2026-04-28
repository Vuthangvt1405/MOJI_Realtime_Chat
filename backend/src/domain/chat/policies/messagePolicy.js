import { AppError } from "../../../shared/errors/AppError.js";

export const normalizeMessageInput = ({ content, imgUrls, imgUrl }) => {
  const normalizedContent = typeof content === "string" ? content.trim() : "";

  let normalizedImgUrls = [];

  if (Array.isArray(imgUrls)) {
    normalizedImgUrls = imgUrls.filter(
      (url) => typeof url === "string" && url.trim() !== "",
    );
  } else if (typeof imgUrl === "string" && imgUrl.trim() !== "") {
    normalizedImgUrls = [imgUrl.trim()];
  }

  return {
    content: normalizedContent,
    imgUrls: normalizedImgUrls,
    imgUrl: normalizedImgUrls[0] || null,
  };
};

export const assertMessageInput = ({ content, imgUrls }) => {
  if (!content && (!Array.isArray(imgUrls) || imgUrls.length === 0)) {
    throw new AppError(400, "Thiếu nội dung hoặc hình ảnh");
  }
};

export const assertCreateConversationInput = ({ type, name, memberIds }) => {
  if (
    !type ||
    (type === "group" && !name) ||
    !Array.isArray(memberIds) ||
    memberIds.length === 0
  ) {
    throw new AppError(400, "Tên nhóm và danh sách thành viên là bắt buộc");
  }

  if (type !== "group" && type !== "direct") {
    throw new AppError(400, "Conversation type không hợp lệ");
  }
};

export const updateConversationAfterMessage = (conversation, message, senderId) => {
  const imageCount = Array.isArray(message.imgUrls)
    ? message.imgUrls.filter((url) => typeof url === "string" && url.trim() !== "").length
    : message.imgUrl
      ? 1
      : 0;

  const previewContent =
    message.content ||
    (imageCount > 1 ? `Hinh anh (${imageCount})` : imageCount === 1 ? "Hinh anh" : null);

  conversation.set({
    seenBy: [],
    lastMessageAt: message.createdAt,
    lastMessage: {
      _id: message._id,
      content: previewContent,
      senderId,
      createdAt: message.createdAt,
    },
  });

  conversation.participants.forEach((participant) => {
    const memberId = participant.userId.toString();
    const isSender = memberId === senderId.toString();
    const previousCount = conversation.unreadCounts.get(memberId) || 0;

    conversation.unreadCounts.set(memberId, isSender ? 0 : previousCount + 1);
  });
};
