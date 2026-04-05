import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import chatbotService from "../services/chatbot";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response";
import logger from "../utils/logger";

async function sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { sessionId, message } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      sendBadRequest(res, "Message is required");
      return;
    }

    const userId = req.user?.userId || null;
    const accessToken = req.headers.authorization?.split(" ")[1];

    const result = await chatbotService.processMessage(
      sessionId || null,
      userId,
      message.trim(),
      accessToken
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

const chatbotController = {
  sendMessage,
  getHistory,
  getSessions,
};

export default chatbotController;
