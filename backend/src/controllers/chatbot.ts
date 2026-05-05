import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { ScopedRequest, readOrgFilter } from "../middleware/callerScope";
import chatbotService from "../services/chatbot";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response";
import logger from "../utils/logger";

async function sendMessage(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { sessionId, message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      sendBadRequest(res, "Message is required");
      return;
    }

    const userId = req.user?.userId || null;
    const accessToken = req.headers.authorization?.split(" ")[1];
    const organizationId = req.scope ? readOrgFilter(req.scope) : undefined;

    const result = await chatbotService.processMessage(
      sessionId || null,
      userId,
      message.trim(),
      accessToken,
      organizationId,
    );

    sendSuccess(res, result, "Message processed");
  } catch (error) {
    logger.error("Chatbot message error:", error);
    sendError(res, "Failed to process message");
  }
}

async function getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      sendBadRequest(res, "Session ID required");
      return;
    }

    const messages = await chatbotService.getSessionHistory(sessionId);
    sendSuccess(res, messages, "Session history retrieved");
  } catch (error) {
    logger.error("Chatbot history error:", error);
    sendError(res, "Failed to retrieve history");
  }
}

async function getSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const sessions = await chatbotService.getSessions(userId);
    sendSuccess(res, sessions, "Sessions retrieved");
  } catch (error) {
    logger.error("Chatbot sessions error:", error);
    sendError(res, "Failed to retrieve sessions");
  }
}

async function getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const status = await chatbotService.getOllamaStatus();
    sendSuccess(res, status, "Chatbot status");
  } catch (error) {
    logger.error("Chatbot status error:", error);
    sendSuccess(res, { available: false, model: "unknown", url: "unknown" }, "Chatbot status");
  }
}

const chatbotController = {
  sendMessage,
  getHistory,
  getSessions,
  getStatus,
};

export default chatbotController;
