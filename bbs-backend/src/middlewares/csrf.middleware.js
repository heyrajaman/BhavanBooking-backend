import crypto from "crypto";
import { AppError } from "../utils/AppError.js";
import { getCsrfCookieOptions } from "../utils/cookieOptions.js";

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";

const isStateChangingMethod = (method) =>
  !["GET", "HEAD", "OPTIONS"].includes(method);

export const csrfProtection = (req, res, next) => {
  const csrfCookieOptions = getCsrfCookieOptions();
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!csrfToken) {
    csrfToken = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions);
  }

  if (!isStateChangingMethod(req.method)) {
    return next();
  }

  // Enforce CSRF checks only for cookie-authenticated requests.
  if (!req.cookies?.jwt) {
    return next();
  }

  const tokenFromHeader = req.get(CSRF_HEADER_NAME);
  if (!tokenFromHeader || tokenFromHeader !== csrfToken) {
    return next(
      new AppError(
        "Invalid CSRF token. Send x-csrf-token header for state-changing requests.",
        403,
      ),
    );
  }

  return next();
};
