// src/modules/facility/dto/facility.dto.js
import Joi from "joi";

export const CreateFacilityDto = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    "string.min": "Facility name must be at least 3 characters long.",
    "any.required": "Facility name is required.",
  }),
  description: Joi.string().trim().max(500).optional(),
  images: Joi.array()
    .items(Joi.string().uri())
    .optional()
    .default([])
    .messages({
      "string.uri": "Each image must be a valid URL.",
    }),
  facilityType: Joi.string()
    .valid("ROOM", "HALL", "LAWN", "CUSTOM")
    .required()
    .messages({
      "any.only": "Facility type must be ROOM, HALL, LAWN, or CUSTOM.",
    }),
  capacity: Joi.number().integer().min(1).required().messages({
    "number.min": "Capacity must be at least 1.",
  }),
  pricingType: Joi.string().valid("FIXED", "PER_PERSON", "MIXED").required(),
  pricePerDay: Joi.number().min(0).required().messages({
    "number.min": "Price cannot be negative.",
  }),
  securityDeposit: Joi.number().min(0).required().messages({
    "number.min": "Security deposit cannot be negative.",
  }),
  amenities: Joi.array().items(Joi.string()).optional().default([]),
}).options({ stripUnknown: true });

// For updates, we can make all fields optional since the Admin might only want to change the price
export const UpdateFacilityDto = CreateFacilityDto.fork(
  Object.keys(CreateFacilityDto.describe().keys),
  (schema) => schema.optional(),
);
