import { sendEmail } from "../../../utils/email.js";
import {
  buildBookingConfirmationTemplate,
  buildBookingRejectionTemplate,
  buildProvisionalHoldTemplate,
} from "../../../templates/email/notification.templates.js";
import { ADVANCE_PAYMENT_DEADLINE_HOURS } from "../../../constants/payment.constants.js";

export class NotificationService {
  /**
   * Sends an email when a user pays 20% to hold a date.
   */
  async sendHoldConfirmationEmail(
    toEmail,
    customerName,
    bookingId,
    holdAmountPaid,
    holdDeadline,
  ) {
    if (!toEmail) return;

    // Format the date nicely for the email
    const formattedDeadline = new Date(holdDeadline).toLocaleDateString(
      "en-IN",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    const subject = `Action Required: Your Booking is ON HOLD (Booking ID: ${bookingId})`;

    // You can move this HTML into your notification.templates.js file later for cleaner code
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #2563eb;">Dates Successfully Held!</h2>
        <p>Dear ${customerName},</p>
        <p>We have successfully received your 20% hold payment of <strong>₹${holdAmountPaid}</strong> for Booking ID: <strong>${bookingId}</strong>.</p>
        
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #b45309;">⚠️ Important Deadline</h3>
          <p style="margin-bottom: 0;">To confirm your booking, the remaining 80% balance must be paid by <strong>${formattedDeadline}</strong>.</p>
        </div>

        <p>If the remaining balance is not paid by this deadline, your booking will be automatically cancelled and the hold amount will be forfeited as per our cancellation policy.</p>
        
        <p>You can pay the remaining balance by logging into your dashboard.</p>
        <br/>
        <p>Thank you,<br/><strong>The Bhavan Booking Team</strong></p>
      </div>
    `;

    try {
      await sendEmail(toEmail, subject, htmlBody);
      console.log(`Hold confirmation email sent to ${toEmail}`);
    } catch (error) {
      console.error(`Failed to send hold email to ${toEmail}:`, error);
    }
  }

  /**
   * Sends an email when a 7-day provisional hold is created.
   */
  sendProvisionalHoldEmail(userEmail, userName, bookingRef, amountDue) {
    const subject = `Action Required: Payment Pending for Booking ${bookingRef}`;
    const html = buildProvisionalHoldTemplate({
      userName,
      bookingRef,
      amountDue,
      deadlineHours: ADVANCE_PAYMENT_DEADLINE_HOURS,
    });

    void sendEmail({ to: userEmail, subject, html }).catch((error) => {
      console.error("[Notification] Failed to send provisional hold email:", {
        to: userEmail,
        bookingRef,
        error: error?.message || error,
      });
    });
  }

  /**
   * Sends the final receipt and confirmation.
   */
  sendBookingConfirmationEmail(userEmail, userName, bookingRef) {
    const subject = `Booking Confirmed: ${bookingRef}`;
    const html = buildBookingConfirmationTemplate({ userName, bookingRef });

    void sendEmail({ to: userEmail, subject, html }).catch((error) => {
      console.error(
        "[Notification] Failed to send booking confirmation email:",
        {
          to: userEmail,
          bookingRef,
          error: error?.message || error,
        },
      );
    });
  }

  /**
   * Send Booking Rejection Email
   */
  sendBookingRejectionEmail(userEmail, userName, bookingRef, reason) {
    const subject = "Update on your Bhavan Booking Application";
    const html = buildBookingRejectionTemplate({
      userName,
      bookingRef,
      reason,
    });

    void sendEmail({ to: userEmail, subject, html }).catch((error) => {
      console.error("[Notification] Failed to send booking rejection email:", {
        to: userEmail,
        bookingRef,
        error: error?.message || error,
      });
    });
  }
}
