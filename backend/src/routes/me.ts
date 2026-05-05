import { Router } from "express";
import meController from "../controllers/me";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);

router.get("/profile", meController.getProfile);

router.get("/leave-types", meController.leaveTypes);
router.get("/leaves", meController.getLeaves);
router.post("/leaves", meController.applyLeave);
router.delete("/leaves/:id", meController.cancelLeave);

router.get("/tickets", meController.getTickets);
router.get("/tickets/:id", meController.getTicket);
router.post("/tickets", meController.createTicket);

router.get("/assets", meController.getAssets);

router.get("/directory", meController.getDirectory);

export default router;
