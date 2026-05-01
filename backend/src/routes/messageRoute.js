import express from "express";

import {
  removeMessageReaction,
  setMessageReaction,
  uploadMessageImage,
  sendDirectMessage,
  sendGroupMessage,
} from "../controllers/messageController.js";
import {
  checkFriendship,
  checkGroupMembership,
} from "../middlewares/friendMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post("/upload", upload.single("file"), uploadMessageImage);
router.put("/:messageId/reaction", setMessageReaction);
router.delete("/:messageId/reaction", removeMessageReaction);
router.post("/direct", checkFriendship, sendDirectMessage);
router.post("/group", checkGroupMembership, sendGroupMessage);

export default router;
