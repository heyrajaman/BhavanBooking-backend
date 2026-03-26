// src/utils/timeValidator.js
import { AppError } from "./AppError.js";

/**
 * Validates if the requested start and end times match the facility's slot rules.
 * Extracts hours and minutes from JS Date objects to compare with "HH:mm" strings.
 */
export const validateFacilitySlots = (
  facility,
  requestedStartTime,
  requestedEndTime,
) => {
  // If it's not a SLOT pricing type, skip this specific validation
  if (facility.pricingType !== "SLOT" || !facility.pricingDetails) return;

  const { slotType, slots, durationHours } = facility.pricingDetails;

  // --- 1. Validate FLEXIBLE Slots (e.g., exactly 6 hours) ---
  if (slotType === "FLEXIBLE" && durationHours) {
    // Calculate difference in hours
    const diffInMs = new Date(requestedEndTime) - new Date(requestedStartTime);
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours !== durationHours) {
      throw new AppError(
        `This package requires exactly ${durationHours} continuous hours. You selected ${diffInHours} hours.`,
        400,
      );
    }
    return; // Passed flexible validation
  }

  // --- 2. Validate FIXED Slots (e.g., exactly 08:00 to 15:00) ---
  if (slotType === "FIXED" && slots && slots.length > 0) {
    // Extract HH:mm from the user's requested Date objects
    const reqStartStr = new Date(requestedStartTime).toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata", // Forces it to read the time in IST!
      },
    );
    const reqEndStr = new Date(requestedEndTime).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    // Check if the requested times exactly match ANY of the predefined slots
    const isValidSlot = slots.some(
      (slot) => slot.startTime === reqStartStr && slot.endTime === reqEndStr,
    );

    if (!isValidSlot) {
      const validOptions = slots.map((s) => s.label).join(", ");
      throw new AppError(
        `Invalid time slot. Allowed slots are: ${validOptions}`,
        400,
      );
    }
  }
};
