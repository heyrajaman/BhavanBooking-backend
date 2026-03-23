// src/modules/booking/dto/booking.request.dto.js
import Joi from "joi";

export const CreateBookingDto = Joi.object({
  facilityId: Joi.string().uuid().optional().messages({
    "string.guid": "Facility ID must be a valid UUID.",
  }),

  customFacilities: Joi.array()
    .items(
      Joi.object({
        facilityId: Joi.string().uuid().required().messages({
          "any.required":
            "Each custom facility selection must include a facilityId.",
          "string.guid": "Facility ID must be a valid UUID.",
        }),
        quantity: Joi.number().integer().min(1).required().messages({
          "number.base": "Quantity must be a number.",
          "number.min":
            "Each custom facility selection must have a valid quantity greater than 0.",
          "any.required": "Quantity is required.",
        }),
      }),
    )
    .optional()
    .messages({
      "array.base": "Custom facilities must be an array.",
    }),

  startTime: Joi.date().iso().min("now").required().messages({
    "date.format": "Invalid date format. Use ISO 8601 format.",
    "date.min": "Booking start time cannot be in the past.",
    "any.required": "Start time is required.",
  }),

  endTime: Joi.date().iso().greater(Joi.ref("startTime")).required().messages({
    "date.format": "Invalid date format. Use ISO 8601 format.",
    "date.greater": "End time must be after the start time.",
    "any.required": "End time is required.",
  }),

  eventType: Joi.string().trim().required().messages({
    "any.required": "Event type (e.g., Marriage, Meeting) is required.",
    "string.empty": "Event type cannot be empty.",
  }),

  guestCount: Joi.number().integer().min(1).required().messages({
    "number.base": "Guest count must be a number.",
    "number.min": "A valid guest count is required.",
    "any.required": "A valid guest count is required.",
  }),
})
  // This ensures at least ONE of these two fields is provided in the payload
  .or("facilityId", "customFacilities")
  .messages({
    "object.missing":
      "Either a main Facility ID or custom facilities must be provided.",
  })
  .options({ stripUnknown: true });

export const generateReportDto = Joi.object({
  fromDate: Joi.date().iso().required().messages({
    "date.base": "fromDate must be a valid ISO date",
    "any.required": "fromDate is required to generate a report",
  }),
  toDate: Joi.date().iso().min(Joi.ref("fromDate")).required().messages({
    "date.base": "toDate must be a valid ISO date",
    "date.min": "toDate cannot be earlier than fromDate",
    "any.required": "toDate is required to generate a report",
  }),
});

export const CheckInDto = Joi.object({
  remainingAmountPaid: Joi.number().min(0).optional(),
  checkInPaymentMode: Joi.string().valid("ONLINE", "CASH", "QR").optional(), // <-- Added QR
});

// Add this at the bottom of booking.request.dto.js
export const CreateBookingOnBehalfDto = Joi.object({
  // --- USER DETAILS ---
  fullName: Joi.string().trim().required().messages({
    "any.required": "Customer's full name is required.",
  }),
  mobile: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      "string.pattern.base": "Must be a valid 10-digit Indian mobile number.",
      "any.required": "Customer's mobile number is required.",
    }),
  email: Joi.string().email().trim().lowercase().optional().allow(null, ""),
  address: Joi.string().trim().optional().allow(null, ""),

  // --- BOOKING DETAILS ---
  facilityId: Joi.string().uuid().optional(),
  customFacilities: Joi.array()
    .items(
      Joi.object({
        facilityId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .optional(),

  startTime: Joi.date().iso().min("now").required(),
  endTime: Joi.date().iso().greater(Joi.ref("startTime")).required(),
  eventType: Joi.string().trim().required(),
  guestCount: Joi.number().integer().min(1).required(),
})
  .or("facilityId", "customFacilities")
  .messages({
    "object.missing":
      "Either a main Facility ID or custom facilities must be provided.",
  })
  .options({ stripUnknown: true });

export const CancelBookingDto = Joi.object({
  cancellationReason: Joi.string().max(255).optional().allow(null, ""),
});

export const CompleteManualRefundDto = Joi.object({
  refundNote: Joi.string().max(255).optional().allow(null, ""),
});
