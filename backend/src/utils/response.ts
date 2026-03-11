import { Response } from "express";

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  meta?: ApiMeta;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message: string = "Success",
  statusCode: number = 200,
  meta?: ApiMeta
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  if (meta) {
    response.meta = meta;
  }
  return res.status(statusCode).json(response);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  message: string = "Created successfully"
): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message: string = "Success"
): Response {
  const totalPages = Math.ceil(total / limit);
  return sendSuccess(res, data, message, 200, {
    total,
    page,
    limit,
    totalPages,
  });
}

export function sendError(
  res: Response,
  message: string = "Internal server error",
  statusCode: number = 500,
  data: unknown = null
): Response {
  return res.status(statusCode).json({
    success: false,
    data,
    message,
  });
}

export function sendNotFound(
  res: Response,
  resource: string = "Resource"
): Response {
  return sendError(res, `${resource} not found`, 404);
}

export function sendBadRequest(
  res: Response,
  message: string = "Bad request"
): Response {
  return sendError(res, message, 400);
}

export function sendUnauthorized(
  res: Response,
  message: string = "Unauthorized"
): Response {
  return sendError(res, message, 401);
}

export function sendForbidden(
  res: Response,
  message: string = "Forbidden"
): Response {
  return sendError(res, message, 403);
}

export function sendConflict(
  res: Response,
  message: string = "Conflict"
): Response {
  return sendError(res, message, 409);
}

export function sendValidationError(
  res: Response,
  errors: Record<string, string[]> | string
): Response {
  const message =
    typeof errors === "string"
      ? errors
      : "Validation failed";
  return sendError(res, message, 422, typeof errors === "object" ? errors : null);
}

export function parsePagination(query: {
  page?: string;
  limit?: string;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
