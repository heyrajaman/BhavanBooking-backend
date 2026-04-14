const parsedDeadlineHours = Number(process.env.ADVANCE_PAYMENT_DEADLINE_HOURS);

export const ADVANCE_PAYMENT_DEADLINE_HOURS =
  Number.isFinite(parsedDeadlineHours) && parsedDeadlineHours > 0
    ? parsedDeadlineHours
    : 24;

export const HOLD_PAYMENT_PERCENTAGE = 0.2;
export const HOLD_THRESHOLD_MONTHS = 3;
export const HOLD_DEADLINE_LONG_DAYS = 30;
export const HOLD_DEADLINE_SHORT_DAYS = 7;
