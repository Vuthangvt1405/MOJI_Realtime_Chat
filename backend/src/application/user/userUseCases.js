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
});
