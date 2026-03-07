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
}
