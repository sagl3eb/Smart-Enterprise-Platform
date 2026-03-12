import { Router } from "express";
import ictController from "../controllers/ict";
import { authenticate } from "../middleware/auth";
import { requireRole, requireMinRole } from "../middleware/rbac";

const router = Router();
router.use(authenticate);

// ─── Stats ─────────────────────────────────────────────────
router.get("/assets/stats", ictController.getAssetStats);
router.get("/tickets/stats", ictController.getTicketStats);
router.get("/tickets/summary", ictController.getTicketSummary);

// ─── Assets ────────────────────────────────────────────────
router.get("/assets", ictController.getAssets);
router.get("/assets/:id", ictController.getAssetById);
router.post("/assets", requireMinRole("manager"), ictController.createAsset);
router.put("/assets/:id", requireMinRole("manager"), ictController.updateAsset);
router.delete("/assets/:id", requireRole("admin"), ictController.deleteAsset);

// ─── Software Licenses ─────────────────────────────────────
router.get("/licenses", ictController.getSoftwareLicenses);
router.get("/licenses/:id", ictController.getSoftwareLicenseById);
router.post("/licenses", requireMinRole("manager"), ictController.createSoftwareLicense);
router.put("/licenses/:id", requireMinRole("manager"), ictController.updateSoftwareLicense);
router.delete("/licenses/:id", requireRole("admin"), ictController.deleteSoftwareLicense);

// ─── IT Tickets ────────────────────────────────────────────
router.get("/tickets", ictController.getItTickets);
router.get("/tickets/:id", ictController.getItTicketById);
router.post("/tickets", ictController.createItTicket);
router.put("/tickets/:id", requireMinRole("employee"), ictController.updateItTicket);
router.delete("/tickets/:id", requireRole("admin"), ictController.deleteItTicket);

// ─── Network Devices ───────────────────────────────────────
router.get("/network-devices", ictController.getNetworkDevices);
router.get("/network-devices/:id", ictController.getNetworkDeviceById);
router.post("/network-devices", requireMinRole("manager"), ictController.createNetworkDevice);
router.put("/network-devices/:id", requireMinRole("manager"), ictController.updateNetworkDevice);
router.delete("/network-devices/:id", requireRole("admin"), ictController.deleteNetworkDevice);

// ─── System Health ─────────────────────────────────────────
router.get("/health-logs", ictController.getSystemHealthLogs);
router.post("/health-logs", requireMinRole("employee"), ictController.createSystemHealthLog);

export default router;
