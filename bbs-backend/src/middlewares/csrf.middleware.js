import crypto from "crypto";
import { AppError } from "../utils/AppError.js";
import { getCsrfCookieOptions } from "../utils/cookieOptions.js";

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const AUTH_COOKIE_NAME = "jwt";

const isStateChangingMethod = (method) =>
  !["GET", "HEAD", "OPTIONS"].includes(method);

const hasBearerAuth = (req) => {
  const authHeader = req.headers?.authorization;
  return Boolean(authHeader && authHeader.startsWith("Bearer "));
};

const isAuthenticatedRequest = (req) =>
  Boolean(
    req.cookies?.[AUTH_COOKIE_NAME] &&
    req.cookies?.[AUTH_COOKIE_NAME] !== "loggedout",
  ) || hasBearerAuth(req);

const getAllowedOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    return [];
  }

  return frontendUrl
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const isAllowedOrigin = (originHeader) => {
  if (!originHeader) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.length) {
    return false;
  }

  try {
    const normalizedOrigin = new URL(originHeader).origin;
    return allowedOrigins.some((allowedOrigin) => {
      try {
        return new URL(allowedOrigin).origin === normalizedOrigin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

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

  // Apply CSRF checks to any authenticated write request.
  if (!isAuthenticatedRequest(req)) {
    return next();
  }

  // now skip for development mode
  if (
    process.env.NODE_ENV === "development" &&
    req.headers["x-postman-testing"] === "true"
  ) {
    console.log("⚠️ CSRF Bypassed for Postman Testing");
    return next();
  }

  const requestOrigin = req.get("origin");
  if (!isAllowedOrigin(requestOrigin)) {
    return next(new AppError("Invalid request origin.", 403));
  }

  const tokenFromHeader = req.get(CSRF_HEADER_NAME);
  if (!tokenFromHeader || tokenFromHeader !== csrfToken) {
    return next(
      new AppError(
        "Invalid CSRF token. Send x-csrf-token header for authenticated state-changing requests.",
        403,
      ),
    );
  }

  return next();
};
