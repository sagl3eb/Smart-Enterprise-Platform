import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { convertDecimals } from "../utils/decimal";

const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" },
  ],
});

// Auto-convert all Prisma Decimal fields to plain numbers in query results
prisma.$use(async (params, next) => {
  const result = await next(params);
  return convertDecimals(result);
});

prisma.$on("error", (event) => {
  logger.error(`Prisma error: ${event.message}`);
});

prisma.$on("warn", (event) => {
  logger.warn(`Prisma warning: ${event.message}`);
});

if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (event) => {
    logger.debug(`Prisma query: ${event.query} (${event.duration}ms)`);
  });
}

export default prisma;
