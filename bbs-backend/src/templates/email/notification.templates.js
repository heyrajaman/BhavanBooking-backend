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
  return baseEmailTemplate(`
    <h2>Hello ${userName},</h2>
    <p>Your provisional booking request (Ref: <strong>${bookingRef}</strong>) has been successfully created.</p>
    <p>To confirm your dates, a payment of <strong>₹${amountDue}</strong> is required within ${deadlineHours} hours.</p>
    <p>If payment is not received within ${deadlineHours} hours, the hold will automatically expire and the dates will be released.</p>
    <br><br>
    <p>Thank you,<br>Maharashtra Mandal, Raipur</p>
  `);
};

export const buildBookingConfirmationTemplate = ({ userName, bookingRef }) => {
  return baseEmailTemplate(`
    <h2>Hello ${userName},</h2>
    <p>Your booking <strong>${bookingRef}</strong> is now CONFIRMED.</p>
    <p>Please remember to bring your Aadhaar Card for all room guests during check-in at 10:00 AM.</p>
  `);
};

export const buildBookingRejectionTemplate = ({
  userName,
  bookingRef,
  reason,
}) => {
  return baseEmailTemplate(`
    <h2 style="color: #d9534f;">Booking Application Update</h2>
    <p>Dear ${userName},</p>
    <p>We are sorry to inform you that your booking application (Ref: <strong>${bookingRef}</strong>) could not be approved at this time.</p>
    <p><strong>Reason for Rejection:</strong> ${reason}</p>
    <p>We sincerely apologize for the inconvenience. Please feel free to check our portal for other available dates or alternative facilities.</p>
    <br>
    <p>Best Regards,</p>
    <p><strong>Bhavan Booking Management Team</strong></p>
  `);
};
