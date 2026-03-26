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

  // Pricing - Renamed to baseRate to match the controller/service
  baseRate: Joi.number().min(0).required().messages({
    "number.min": "Base rate cannot be negative.",
  }),
  securityDeposit: Joi.number().min(0).required().messages({
    "number.min": "Security deposit cannot be negative.",
  }),

  // Pricing Details for packages
  pricingDetails: Joi.object({
    included_facilities: Joi.array().items(Joi.string()).optional(),
  }).optional(),

  amenities: Joi.array().items(Joi.string()).optional().default([]),

  // Active state toggle
  isActive: Joi.boolean().optional().default(true),
}).options({ stripUnknown: true });

// ------------------------------------------------------------------
// DTOs for Updates
// ------------------------------------------------------------------

// 1. General Update (Makes all fields from CreateFacilityDto optional)
export const UpdateFacilityDto = CreateFacilityDto.fork(
  Object.keys(CreateFacilityDto.describe().keys),
  (schema) => schema.optional(),
);

// 2. Specific DTO for the Update Pricing Endpoint
export const UpdateFacilityPricingDto = Joi.object({
  baseRate: Joi.number().min(0).optional().messages({
    "number.min": "Base rate cannot be negative.",
  }),
  securityDeposit: Joi.number().min(0).optional().messages({
    "number.min": "Security deposit cannot be negative.",
  }),
})
  .min(1)
  .messages({
    "object.min":
      "At least one pricing field (baseRate or securityDeposit) must be provided.",
  })
  .options({ stripUnknown: true });
