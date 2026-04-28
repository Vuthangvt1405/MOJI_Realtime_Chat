// @ts-nocheck
import { getContainer } from "../app/container.js";
import { handleError } from "../shared/http/handleError.js";

export const signUp = async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    const { useCases } = getContainer();

    await useCases.signUp({
      username,
      password,
      email,
      firstName,
      lastName,
    });

    return res.sendStatus(204);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi gọi signUp",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const signIn = async (req, res) => {
  try {
    const { username, password } = req.body;
    const { useCases } = getContainer();
    const response = await useCases.signIn({ username, password });

    res.cookie(response.cookie.name, response.cookie.value, response.cookie.options);

    return res.status(200).json(response.body);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi gọi signIn",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const signOut = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const { useCases } = getContainer();
    await useCases.signOut({ refreshToken });

    if (refreshToken) {
      res.clearCookie("refreshToken");
    }

    return res.sendStatus(204);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi gọi signOut",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

// tạo access token mới từ refresh token
export const refreshToken = async (req, res) => {
  try {
    const { useCases } = getContainer();
    const response = await useCases.refreshToken({
      refreshToken: req.cookies?.refreshToken,
    });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi gọi refreshToken",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const { useCases } = getContainer();
    const response = await useCases.forgotPassword({ email });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi gọi forgotPassword",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const { useCases } = getContainer();
    const response = await useCases.resetPassword({ token, newPassword });

    return res.status(200).json(response);
  } catch (error) {
    return handleError(res, error, {
      logMessage: "Lỗi khi gọi resetPassword",
      fallbackMessage: "Lỗi hệ thống",
    });
  }
};
