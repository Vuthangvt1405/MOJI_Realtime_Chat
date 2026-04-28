import { AppError } from "../../shared/errors/AppError.js";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "30m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL_DAYS
  ? parseInt(process.env.REFRESH_TOKEN_TTL_DAYS) * 24 * 60 * 60 * 1000
  : 14 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL = process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES
  ? parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) * 60 * 1000
  : 15 * 60 * 1000;
const PASSWORD_RESET_SUCCESS_MESSAGE =
  "chúng tôi đã gửi liên kết đặt lại mật khẩu.";
const PASSWORD_RESET_WARNING_MESSAGE =
  "Tài khoản này hiện chưa tồn tại trên hệ thống vui lòng kiểm tra lại email.";
const INVALID_RESET_TOKEN_MESSAGE =
  "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.";

const buildResetUrl = (token) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  return `${clientUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
};

export const makeAuthUseCases = ({
  repositories,
  securityServices,
  mailGateway,
}) => ({
  async signUp({ username, password, email, firstName, lastName }) {
    if (!username || !password || !email || !firstName || !lastName) {
      throw new AppError(
        400,
        "Không thể thiếu username, password, email, firstName, và lastName",
      );
    }

    const duplicate = await repositories.findUserByUsername(username);

    if (duplicate) {
      throw new AppError(409, "username đã tồn tại");
    }

    const hashedPassword = await securityServices.hashPassword(password);

    await repositories.createUser({
      username,
      hashedPassword,
      email,
      displayName: `${lastName} ${firstName}`,
    });
  },

  async signIn({ username, password }) {
    if (!username || !password) {
      throw new AppError(400, "Thiếu username hoặc password.");
    }

    const user = await repositories.findUserByUsername(username);

    if (!user) {
      throw new AppError(401, "username hoặc password không chính xác");
    }

    const passwordCorrect = await securityServices.comparePassword(
      password,
      user.hashedPassword,
    );

    if (!passwordCorrect) {
      throw new AppError(401, "username hoặc password không chính xác");
    }

    const accessToken = securityServices.signAccessToken(
      { userId: user._id, tokenVersion: user.tokenVersion ?? 0 },
      ACCESS_TOKEN_TTL,
    );
    const refreshToken = securityServices.generateRefreshToken();

    await repositories.createSession({
      userId: user._id,
      refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
    });

    return {
      cookie: {
        name: "refreshToken",
        value: refreshToken,
        options: {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: REFRESH_TOKEN_TTL,
        },
      },
      body: {
        message: `User ${user.displayName} đã logged in!`,
        accessToken,
      },
    };
  },

  async signOut({ refreshToken }) {
    if (refreshToken) {
      await repositories.deleteSessionByRefreshToken(refreshToken);
    }
  },

  async refreshToken({ refreshToken }) {
    if (!refreshToken) {
      throw new AppError(401, "Token không tồn tại.");
    }

    const session = await repositories.findSessionByRefreshToken(refreshToken);

    if (!session) {
      throw new AppError(403, "Token không hợp lệ hoặc đã hết hạn");
    }

    if (session.expiresAt < new Date()) {
      throw new AppError(403, "Token đã hết hạn.");
    }

    const user = await repositories.findUserWithoutPasswordById(session.userId);

    if (!user) {
      throw new AppError(403, "Token không hợp lệ hoặc đã hết hạn");
    }

    const accessToken = securityServices.signAccessToken(
      { userId: session.userId, tokenVersion: user.tokenVersion ?? 0 },
      ACCESS_TOKEN_TTL,
    );

    return { accessToken };
  },

  async forgotPassword({ email }) {
    if (!email) {
      throw new AppError(400, "Email là bắt buộc.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await repositories.findUserByEmail(normalizedEmail);

    if (!user) {
      return {
        status: "warning",
        message: PASSWORD_RESET_WARNING_MESSAGE,
      };
    }

    const rawToken = securityServices.generatePasswordResetToken();
    const tokenHash = securityServices.hashPasswordResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL);

    await repositories.deletePasswordResetTokensByUserId(user._id);
    await repositories.createPasswordResetToken({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    try {
      await mailGateway.sendPasswordResetEmail({
        to: user.email,
        displayName: user.displayName,
        resetUrl: buildResetUrl(rawToken),
      });
    } catch (error) {
      console.error("Không thể gửi email đặt lại mật khẩu", error);
    }

    return {
      status: "success",
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    };
  },

  async resetPassword({ token, newPassword }) {
    if (!token || !newPassword) {
      throw new AppError(400, "Token và mật khẩu mới là bắt buộc.");
    }

    if (newPassword.length < 6) {
      throw new AppError(400, "Mật khẩu phải có ít nhất 6 ký tự.");
    }

    const tokenHash = securityServices.hashPasswordResetToken(token);
    const resetToken =
      await repositories.findPasswordResetTokenByHash(tokenHash);

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError(400, INVALID_RESET_TOKEN_MESSAGE);
    }

    const hashedPassword = await securityServices.hashPassword(newPassword);
    const userId = resetToken.userId;

    await repositories.updateUserPasswordById(userId, hashedPassword);
    await repositories.deletePasswordResetTokensByUserId(userId);
    await repositories.deleteSessionsByUserId(userId);
    await repositories.incrementUserTokenVersion(userId);

    return { message: "Đặt lại mật khẩu thành công." };
  },
});
