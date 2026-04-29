import { getContainer } from "../app/container.js";
import { handleError } from "../shared/http/handleError.js";

export const authMe = async (req, res) => {
  try {
    const { useCases } = getContainer();
    const response = await useCases.authMe({ user: req.user });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi gọi authMe",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const searchUserByUsername = async (req, res) => {
  try {
    const { username } = req.query;
    const { useCases } = getContainer();
    const response = await useCases.searchUserByUsername({
      username,
      currentUserId: req.user._id,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi xảy ra khi searchUserByUsername",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const { useCases } = getContainer();
    const response = await useCases.uploadAvatar({
      file: req.file,
      userId: req.user._id,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi xảy ra khi upload avatar",
      fallbackMessage: "Upload failed",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { displayName, email, phone, bio } = req.body;
    const { useCases } = getContainer();

    const response = await useCases.updateProfile({
      userId: req.user._id,
      displayName,
      email,
      phone,
      bio,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi xảy ra khi updateProfile",
      fallbackMessage: "Cập nhật hồ sơ thất bại",
    });
  }
};
