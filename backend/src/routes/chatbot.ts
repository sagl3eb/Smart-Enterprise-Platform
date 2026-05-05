import { Router } from "express";
import chatbotController from "../controllers/chatbot";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);

router.post("/message", chatbotController.sendMessage);
router.get("/status", chatbotController.getStatus);
router.get("/sessions", chatbotController.getSessions);
router.get("/sessions/:sessionId", chatbotController.getHistory);

export default router;
