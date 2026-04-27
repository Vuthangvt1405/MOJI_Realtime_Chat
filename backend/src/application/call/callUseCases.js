import { pairUserIds } from "../../domain/friend/utils/pairUserIds.js";

const invalidPayload = {
  allowed: false,
  code: "INVALID_PAYLOAD",
  message: "Dữ liệu gọi không hợp lệ",
};

export const makeCallUseCases = ({ repositories }) => ({
  async validateCallRequest({ callerId, calleeId, conversationId }) {
    const callerKey = callerId?.toString?.() || "";
    const calleeKey = calleeId?.toString?.() || "";
    const conversationKey = conversationId?.toString?.() || "";

    if (!callerKey || !calleeKey || !conversationKey) {
      return invalidPayload;
    }

    if (callerKey === calleeKey) {
      return {
        allowed: false,
        code: "SELF_CALL",
        message: "Không thể tự gọi chính mình",
      };
    }

    if (
      (repositories.isValidObjectId && !repositories.isValidObjectId(calleeKey)) ||
      (repositories.isValidObjectId && !repositories.isValidObjectId(conversationKey))
    ) {
      return invalidPayload;
    }

    const calleeExists = await repositories.existsUserById(calleeKey);

    if (!calleeExists) {
      return {
        allowed: false,
        code: "USER_NOT_FOUND",
        message: "Người nhận không tồn tại",
      };
    }

    const [userA, userB] = pairUserIds(callerKey, calleeKey);
    const friendship = await repositories.findFriendshipByPair(userA, userB);

    if (!friendship) {
      return {
        allowed: false,
        code: "FORBIDDEN_CALL",
        message: "Bạn chỉ có thể gọi người đã kết bạn",
      };
    }

    const isDirectConversation = await repositories.isDirectConversationBetweenUsers(
      conversationKey,
      callerKey,
      calleeKey,
    );

    if (!isDirectConversation) {
      return {
        allowed: false,
        code: "INVALID_CONVERSATION",
        message: "Cuộc trò chuyện không hợp lệ cho cuộc gọi trực tiếp",
      };
    }

    return { allowed: true };
  },
});
