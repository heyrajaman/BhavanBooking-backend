import { getAuthCookieOptions } from "./cookieOptions.js";
import { getClearAuthCookieOptions } from "./cookieOptions.js";

export const sendLoginSuccess = (
  res,
  { token, user, message, statusCode = 200 },
) => {
  res.cookie("jwt", token, getAuthCookieOptions());

  return res.status(statusCode).json({
    success: true,
    message,
    data: { user },
  });
};

export const sendLogoutSuccess = (
  res,
  { message = "Logged out successfully", statusCode = 200 } = {},
) => {
  res.clearCookie("jwt", getClearAuthCookieOptions());

  return res.status(statusCode).json({
    success: true,
    message,
  });
};
