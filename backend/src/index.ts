import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import logger from "./utils/logger";
import prisma from "./prisma/client";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// ── Middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("combined", {
    stream: { write: (message: string) => logger.info(message.trim()) },
  })
);

// ── Health check ───────────────────────────────────────────
app.get("/api/v1/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    message: "Smart Enterprise Platform API is running",
  });
});

// ── Routes ──────────────────────────────────────────────────
import authRoutes from "./routes/auth";
import hrRoutes from "./routes/hr";
// import financeRoutes from "./routes/finance";
// import accountingRoutes from "./routes/accounting";
// import ictRoutes from "./routes/ict";
// import constructionRoutes from "./routes/construction";
// import workforceRoutes from "./routes/workforce";
// import predictiveRoutes from "./routes/predictive";
// import alertRoutes from "./routes/alerts";
// import dashboardRoutes from "./routes/dashboard";
// import chatbotRoutes from "./routes/chatbot";

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/hr", hrRoutes);
// app.use("/api/v1/finance", financeRoutes);
// app.use("/api/v1/accounting", accountingRoutes);
// app.use("/api/v1/ict", ictRoutes);
// app.use("/api/v1/construction", constructionRoutes);
// app.use("/api/v1/workforce", workforceRoutes);
// app.use("/api/v1/predictive", predictiveRoutes);
// app.use("/api/v1/alerts", alertRoutes);
// app.use("/api/v1/dashboard", dashboardRoutes);
// app.use("/api/v1/chatbot", chatbotRoutes);

// ── 404 handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: "Route not found",
  });
});

// ── Global error handler ───────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
    res.status(500).json({
      success: false,
      data: null,
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    });
  }
);

// ── Start server ───────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

start();

export default app;
