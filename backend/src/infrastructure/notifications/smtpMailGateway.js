import nodemailer from "nodemailer";

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error("SMTP_HOST is required to send password reset email");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
};

export const smtpMailGateway = {
  async sendPasswordResetEmail({ to, displayName, resetUrl }) {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "Đặt lại mật khẩu Moji",
      text: `Xin chào ${displayName || "bạn"},\n\nMở liên kết sau để đặt lại mật khẩu Moji:\n${resetUrl}\n\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
      html: `
        <p>Xin chào ${displayName || "bạn"},</p>
        <p>Mở liên kết sau để đặt lại mật khẩu Moji:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
      `,
    });
  },
};
