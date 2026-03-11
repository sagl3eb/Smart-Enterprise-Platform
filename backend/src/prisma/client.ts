import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";

const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" },
  ],
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
