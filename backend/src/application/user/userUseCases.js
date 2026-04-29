import { AppError } from "../../shared/errors/AppError.js";

export const makeUserUseCases = ({ repositories, imageGateway }) => ({
  async authMe({ user }) {
    return { user };
  },

  async searchUserByUsername({ username, currentUserId }) {
    if (!username || username.trim() === "") {
      throw new AppError(400, "Cần cung cấp username trong query.");
    }

    const escapedUsername = username
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .toLowerCase();

    const users = await repositories.searchUsersByUsernamePrefix(escapedUsername, currentUserId);

    return { users };
  },

  async uploadAvatar({ file, userId }) {
    if (!file) {
      throw new AppError(400, "No file uploaded");
    }

    const result = await imageGateway.uploadImageFromBuffer(file.buffer, {
      fileName: file.originalname || "avatar",
      mimeType: file.mimetype,
    });

    const updatedUser = await repositories.updateUserAvatarById(
      userId,
      result.secure_url,
      result.public_id,
    );

    if (!updatedUser) {
      throw new AppError(404, "User not found");
    }

    if (!updatedUser.avatarUrl) {
      throw new AppError(502, "Avatar URL missing from image provider");
    }

    return { avatarUrl: updatedUser.avatarUrl };
  },

  async updateProfile({ userId, displayName, email, phone, bio }) {
    if (!displayName || typeof displayName !== "string" || displayName.trim() === "") {
      throw new AppError(400, "Tên hiển thị không được để trống");
    }
    if (!email || typeof email !== "string") {
      throw new AppError(400, "Email không được để trống");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(400, "Email không hợp lệ");
    }

    if (bio && typeof bio === "string" && bio.length > 500) {
      throw new AppError(400, "Giới thiệu không được vượt quá 500 ký tự");
    }

    const updates = {};
    updates.displayName = displayName.trim();
    updates.email = email.toLowerCase().trim();

    if (phone !== undefined) {
      updates.phone = phone;
    }
    if (bio !== undefined) {
      updates.bio = bio.trim();
    }

    const updatedUser = await repositories.updateUserProfileById(userId, updates);

    if (!updatedUser) {
      throw new AppError(404, "Không tìm thấy người dùng");
    }

    return { user: updatedUser };
  },
});
