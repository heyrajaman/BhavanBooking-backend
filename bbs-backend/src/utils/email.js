import nodemailer from "nodemailer";

// Create a reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT, // Usually 465 (secure) or 587
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generic email sender.
 * @param {Object} options - { to, subject, html }
 */
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Bhavan Booking System" <${process.env.SMTP_FROM}>`, // e.g., noreply@mandalraipur.org
      to,
      subject,
      html,
    });
    console.log(
      `[Email] Successfully sent to ${to}. Message ID: ${info.messageId}`,
    );
    return info;
  } catch (error) {
    console.error("[Email Error] Failed to send email:", error.message);
    // Depending on your strictness, you might not want to throw this error
    // so it doesn't crash the main business transaction.
  }
};
