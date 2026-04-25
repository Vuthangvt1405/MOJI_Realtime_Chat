import { AppError } from "../errors/AppError.js";

export const handleError = (res, error, options = {}) => {
  const { logMessage = "Unhandled controller error", fallbackMessage = "Lỗi hệ thống" } =
    options;

  console.error(logMessage, error);

  if (error instanceof AppError) {
    const payload = { message: error.message };

    if (error.details) {
      payload.details = error.details;
    }

    return res.status(error.status).json(payload);
  }

  return res.status(500).json({ message: fallbackMessage });
};
