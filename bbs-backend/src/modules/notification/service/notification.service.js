import { sendEmail } from "../../../utils/email.js";

export class NotificationService {
  /**
   * Sends an email when a 7-day provisional hold is created.
   */
  async sendProvisionalHoldEmail(userEmail, userName, bookingRef, amountDue) {
    const subject = `Action Required: Pay 20% Advance for Booking ${bookingRef}`;

    // In a production app, you might use a template engine like EJS, Pug, or Handlebars here
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Hello ${userName},</h2>
        <p>Your provisional booking request (Ref: <strong>${bookingRef}</strong>) has been successfully created.</p>
        <p>To confirm your dates, a 20% advance payment of <strong>₹${amountDue}</strong> is required within the next 7 days.</p>
        <p>If payment is not received, the hold will automatically expire and the dates will be released.</p>
        <br>
        <a href="${process.env.FRONTEND_URL}/pay/${bookingRef}" style="padding: 10px 20px; background-color: #0044cc; color: white; text-decoration: none; border-radius: 5px;">Pay Now</a>
        <br><br>
        <p>Thank you,<br>Maharashtra Mandal, Raipur</p>
      </div>
    `;

    // Fire and forget (notice we don't necessarily need to return the await if we don't want to block)
    await sendEmail({ to: userEmail, subject, html });
  }

  /**
   * Sends the final receipt and confirmation.
   */
  async sendBookingConfirmationEmail(userEmail, userName, bookingRef) {
    const subject = `Booking Confirmed: ${bookingRef}`;
    const html = `
      <h2>Hello ${userName},</h2>
      <p>Your booking <strong>${bookingRef}</strong> is now CONFIRMED.</p>
      <p>Please remember to bring your Aadhaar Card for all room guests during check-in at 10:00 AM.</p>
    `;

    await sendEmail({ to: userEmail, subject, html });
  }

  /**
   * Send Booking Rejection Email
   */
  async sendBookingRejectionEmail(toEmail, userName, bookingId, reason) {
    const subject = "Update on your Bhavan Booking Application";

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;">
        <h2 style="color: #d9534f;">Booking Application Update</h2>
        <p>Dear ${userName},</p>
        <p>We are sorry to inform you that your booking application (ID: <strong>${bookingId}</strong>) could not be approved at this time.</p>
        <p><strong>Reason for Rejection:</strong> ${reason}</p>
        <p>We sincerely apologize for the inconvenience. Please feel free to check our portal for other available dates or alternative facilities.</p>
        <br>
        <p>Best Regards,</p>
        <p><strong>Bhavan Booking Management Team</strong></p>
      </div>
    `;

    // sendEmail is your utility wrapper from utils/email.js
    return sendEmail({ to: toEmail, subject, html });
  }
}
