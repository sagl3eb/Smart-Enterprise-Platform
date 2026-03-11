import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, DecodedToken } from "../utils/jwt";
import { sendUnauthorized } from "../utils/response";
import logger from "../utils/logger";

export interface AuthenticatedRequest extends Request {
  user?: DecodedToken;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      sendUnauthorized(res, "No authorization header provided");
      return;
    }

    if (!authHeader.startsWith("Bearer ")) {
      sendUnauthorized(res, "Invalid authorization format. Use: Bearer <token>");
      return;
    }

    const token = authHeader.substring(7);

    if (!token || token.trim().length === 0) {
      sendUnauthorized(res, "Token is empty");
      return;
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        sendUnauthorized(res, "Token has expired");
        return;
      }
      if (error.name === "JsonWebTokenError") {
        sendUnauthorized(res, "Invalid token");
        return;
      }
      logger.error(`Auth middleware error: ${error.message}`);
    }
    sendUnauthorized(res, "Authentication failed");
  }
}

export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    if (token && token.trim().length > 0) {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
    }

    next();
  } catch {
    next();
  }
}
