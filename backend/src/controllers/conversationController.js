import { getContainer } from "../app/container.js";
import { handleError } from "../shared/http/handleError.js";

/**
 * Purpose:
 * Creates a new conversation (direct or group) between users.
 *
 * How it works:
 * Reads type/name/memberIds from request body, delegates to createConversation
 * use case, returns created conversation with 201 status.
 *
 * Parameters:
 * - req: Express request with body { type, name, memberIds }
 * - res: Express response
 *
 * Returns:
 * 201 JSON with conversation object, or error via handleError.
 */
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

/**
 * Purpose:
 * Retrieves the authenticated user's conversation list (with unread counts).
 *
 * How it works:
 * Calls getConversations use case with userId from auth context,
 * returns the full conversation list.
 *
 * Parameters:
 * - req: Express request with auth user context
 * - res: Express response
 *
 * Returns:
 * 200 JSON with conversations array, or error via handleError.
 */
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

/**
 * Purpose:
 * Fetches paginated messages for a conversation.
 *
 * How it works:
 * Extracts conversationId from route params, limit/cursor from query,
 * delegates to getMessages use case which enforces access control.
 *
 * Parameters:
 * - req: Express request with params.conversationId, query.limit, query.cursor
 * - res: Express response
 *
 * Returns:
 * 200 JSON with messages array and pagination cursor, or error via handleError.
 */
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

/**
 * Purpose:
 * Loads conversation IDs for socket registration (internal use, not HTTP).
 *
 * How it works:
 * Called during Socket.IO connection to join user to their conversation rooms.
 * Silently returns empty array on error.
 *
 * Parameters:
 * - userId: String ID of the user
 *
 * Returns:
 * Array of conversation IDs the user belongs to.
 */
export const getUserConversationsForSocketIO = async (userId) => {
  try {
    const { useCases } = getContainer();
    return useCases.getUserConversationsForSocketIO({ userId });
  } catch (error) {
    console.error("Lỗi khi fetch conversations: ", error);
    return [];
  }
};

/**
 * Purpose:
 * Marks a conversation as read by the current user (resets unread count).
 *
 * How it works:
 * Extracts conversationId from params and userId from auth context,
 * delegates to markAsSeen use case which updates DB and emits socket event.
 *
 * Parameters:
 * - req: Express request with params.conversationId, auth user context
 * - res: Express response
 *
 * Returns:
 * 200 JSON with seen status, seenBy list, and myUnreadCount.
 */
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

/**
 * Purpose:
 * Soft-deletes a conversation from the user's perspective (sets clearedAt).
 *
 * How it works:
 * Delegates to clearConversationForUser use case which updates the user's
 * clearedAt timestamp in the participant subdocument.
 *
 * Parameters:
 * - req: Express request with params.conversationId, auth user context
 * - res: Express response
 *
 * Returns:
 * 200 JSON with success message and clearedAt timestamp.
 */
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
