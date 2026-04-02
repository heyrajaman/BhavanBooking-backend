import { sendEmail } from "../../../utils/email.js";
import {
  buildBookingConfirmationTemplate,
  buildBookingRejectionTemplate,
  buildProvisionalHoldTemplate,
} from "../../../templates/email/notification.templates.js";
import { ADVANCE_PAYMENT_DEADLINE_HOURS } from "../../../constants/payment.constants.js";

export class NotificationService {
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
