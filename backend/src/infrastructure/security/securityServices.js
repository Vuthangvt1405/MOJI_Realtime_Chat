import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

export const securityServices = {
  hashPassword(password) {
    return bcrypt.hash(password, 10);
  },

  comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  },

  signAccessToken(payload, expiresIn) {
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn });
  },

  generateRefreshToken() {
    return crypto.randomBytes(64).toString("hex");
  },

  generatePasswordResetToken() {
    return crypto.randomBytes(32).toString("hex");
  },

  hashPasswordResetToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  },
};
