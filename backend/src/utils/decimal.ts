import { Prisma } from "@prisma/client";

export function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : Number(val.toString());
}

/**
 * Recursively convert all Prisma Decimal fields in an object/array to plain numbers.
 * This prevents the JSON serialization overflow issue.
 */
export function convertDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Prisma.Decimal) return Number(obj.toString()) as unknown as T;
  if (typeof obj === "bigint") return Number(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map(convertDecimals) as unknown as T;
  if (typeof obj === "object" && obj.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertDecimals(value);
    }
    return result as T;
  }
  if (typeof obj === "object" && obj !== null && !(obj instanceof Date)) {
    // Handle Prisma model instances (plain objects with prototype)
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = convertDecimals(value);
    }
    return result as T;
  }
  return obj;
}
