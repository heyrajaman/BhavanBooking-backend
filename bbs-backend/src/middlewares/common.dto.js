import Joi from "joi";

export const UuidParamDto = Joi.object({
  bookingId: Joi.string().uuid().required().messages({
    "string.guid": "The ID in the URL must be a valid UUID.",
    "any.required": "ID is required in the URL.",
  }),
}).options({ stripUnknown: true });
