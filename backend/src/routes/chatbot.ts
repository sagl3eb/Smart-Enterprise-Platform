import { Router } from "express";
import chatbotController from "../controllers/chatbot";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/message", authenticate, chatbotController.sendMessage);
router.get("/sessions", authenticate, chatbotController.getSessions);
router.get("/sessions/:sessionId", authenticate, chatbotController.getHistory);

export default router;
