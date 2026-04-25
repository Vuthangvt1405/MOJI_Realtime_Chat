import { AppError } from "../../shared/errors/AppError.js";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "30m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL_DAYS
  ? parseInt(process.env.REFRESH_TOKEN_TTL_DAYS) * 24 * 60 * 60 * 1000
  : 14 * 24 * 60 * 60 * 1000;

export const makeAuthUseCases = ({ repositories, securityServices }) => ({
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

    const passwordCorrect = await securityServices.comparePassword(password, user.hashedPassword);

    if (!passwordCorrect) {
      throw new AppError(401, "username hoặc password không chính xác");
    }

    const accessToken = securityServices.signAccessToken({ userId: user._id }, ACCESS_TOKEN_TTL);
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

    const accessToken = securityServices.signAccessToken(
      { userId: session.userId },
      ACCESS_TOKEN_TTL,
    );

    return { accessToken };
  },
});
