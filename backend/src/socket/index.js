import { Server } from "socket.io";
import http from "http";
import express from "express";
import { socketAuthMiddleware } from "../middlewares/socketMiddleware.js";
import { createCallSessionStore } from "./callSessionStore.js";
import { registerCallSocket } from "./registerCallSocket.js";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

const onlineUsers = new Map(); // {userId: socketId}
const callStore = createCallSessionStore();
let resolveUserConversationIds = async () => [];
let resolveCallEligibility = async () => ({ allowed: true });

export const setSocketConversationResolver = (resolver) => {
  if (typeof resolver === "function") {
    resolveUserConversationIds = resolver;
  }
};

export const setSocketCallEligibilityResolver = (resolver) => {
  if (typeof resolver === "function") {
    resolveCallEligibility = resolver;
  }
};

io.on("connection", async (socket) => {
  const user = socket.user;
  const userId = user._id.toString();

  // console.log(`${user.displayName} online với socket ${socket.id}`);

  onlineUsers.set(userId, socket.id);

  io.emit("online-users", Array.from(onlineUsers.keys()));

  const conversationIds = await resolveUserConversationIds(user._id);
  conversationIds.forEach((id) => {
    socket.join(id);
  });

  socket.on("join-conversation", (conversationId) => {
    socket.join(conversationId);
  });

  socket.join(userId);

  registerCallSocket({
    io,
    socket,
    onlineUsers,
    callStore,
    canStartCall: ({ calleeId, conversationId, callType }) =>
      resolveCallEligibility({
        callerId: userId,
        calleeId,
        conversationId,
        callType,
      }),
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    io.emit("online-users", Array.from(onlineUsers.keys()));
    /* console.log(`socket disconnected: ${socket.id}`); */
  });
});

export { io, app, server };
