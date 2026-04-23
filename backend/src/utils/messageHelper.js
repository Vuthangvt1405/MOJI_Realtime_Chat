export const updateConversationAfterCreateMessage = (
  conversation,
  message,
  senderId
) => {
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

  conversation.participants.forEach((p) => {
    const memberId = p.userId.toString();
    const isSender = memberId === senderId.toString();
    const prevCount = conversation.unreadCounts.get(memberId) || 0;
    conversation.unreadCounts.set(memberId, isSender ? 0 : prevCount + 1);
  });
};

export const emitNewMessage = (io, conversation, message) => {
  io.to(conversation._id.toString()).emit("new-message", {
    message,
    conversation: {
      _id: conversation._id,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
    },
    unreadCounts: Object.fromEntries(conversation.unreadCounts),
  });
};
