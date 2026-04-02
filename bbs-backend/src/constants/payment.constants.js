const parsedDeadlineHours = Number(process.env.ADVANCE_PAYMENT_DEADLINE_HOURS);

export const ADVANCE_PAYMENT_DEADLINE_HOURS =
  Number.isFinite(parsedDeadlineHours) && parsedDeadlineHours > 0
    ? parsedDeadlineHours
    : 24;
