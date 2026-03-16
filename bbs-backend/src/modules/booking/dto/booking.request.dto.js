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
