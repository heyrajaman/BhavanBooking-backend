import { escapeHtml } from "../../utils/escapeHtml.js";

const baseEmailTemplate = (content) => `
  <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
    ${content}
  </div>
`;

export const buildProvisionalHoldTemplate = ({
  userName,
  bookingRef,
  amountDue,
  deadlineHours,
}) => {
  const safeUserName = escapeHtml(userName || "User");
  const safeBookingRef = escapeHtml(bookingRef || "N/A");
  const safeAmountDue = escapeHtml(amountDue);
  const safeDeadlineHours = escapeHtml(deadlineHours);

  return baseEmailTemplate(`
    <h2>Hello ${safeUserName},</h2>
    <p>Your provisional booking request (Ref: <strong>${safeBookingRef}</strong>) has been successfully created.</p>
    <p>To confirm your dates, a payment of <strong>₹${safeAmountDue}</strong> is required within ${safeDeadlineHours} hours.</p>
    <p>If payment is not received within ${safeDeadlineHours} hours, the hold will automatically expire and the dates will be released.</p>
    <br><br>
    <p>Thank you,<br>Maharashtra Mandal, Raipur</p>
  `);
};

export const buildBookingConfirmationTemplate = ({ userName, bookingRef }) => {
  const safeUserName = escapeHtml(userName || "User");
  const safeBookingRef = escapeHtml(bookingRef || "N/A");

  return baseEmailTemplate(`
    <h2>Hello ${safeUserName},</h2>
    <p>Your booking <strong>${safeBookingRef}</strong> is now CONFIRMED.</p>
    <p>Please remember to bring your Aadhaar Card for all room guests during check-in at 10:00 AM.</p>
  `);
};

export const buildBookingRejectionTemplate = ({
  userName,
  bookingRef,
  reason,
}) => {
  const safeUserName = escapeHtml(userName || "User");
  const safeBookingRef = escapeHtml(bookingRef || "N/A");
  const safeReason = escapeHtml(reason || "No reason provided.");

  return baseEmailTemplate(`
    <h2 style="color: #d9534f;">Booking Application Update</h2>
    <p>Dear ${safeUserName},</p>
    <p>We are sorry to inform you that your booking application (Ref: <strong>${safeBookingRef}</strong>) could not be approved at this time.</p>
    <p><strong>Reason for Rejection:</strong> ${safeReason}</p>
    <p>We sincerely apologize for the inconvenience. Please feel free to check our portal for other available dates or alternative facilities.</p>
    <br>
    <p>Best Regards,</p>
    <p><strong>Bhavan Booking Management Team</strong></p>
  `);
};
