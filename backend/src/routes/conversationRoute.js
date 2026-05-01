/**
 * Conversation routes.
 *
 * POST   /                        — create conversation (direct or group)
 * GET    /                        — list user conversations
 * GET    /:conversationId/messages — paginated message history
 * PATCH  /:conversationId/seen    — mark conversation as read
 * PATCH  /:conversationId/clear   — soft-delete conversation for user
 */
import express from "express";
import {
  clearConversationForUser,
  createConversation,
  getConversations,
  getMessages,
  markAsSeen,
} from "../controllers/conversationController.js";
import { checkFriendship } from "../middlewares/friendMiddleware.js";

const router = express.Router();

router.post("/", checkFriendship, createConversation);
router.get("/", getConversations);
router.get("/:conversationId/messages", getMessages);
router.patch("/:conversationId/seen", markAsSeen);
router.patch("/:conversationId/clear", clearConversationForUser);

export default router;
