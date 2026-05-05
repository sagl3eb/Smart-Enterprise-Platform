import { Router } from "express";
import ictController from "../controllers/ict";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites, blockSuperAdminModuleWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);
router.use(blockSuperAdminModuleWrites);

// Module access is the gate. Any authenticated user whose admin granted them
// ICT module access can perform any ICT operation within their org.

router.get("/assets/stats", ictController.getAssetStats);
router.get("/tickets/stats", ictController.getTicketStats);
router.get("/tickets/summary", ictController.getTicketSummary);

router.get("/assets", ictController.getAssets);
router.get("/assets/:id", ictController.getAssetById);
router.post("/assets", ictController.createAsset);
router.put("/assets/:id", ictController.updateAsset);
router.delete("/assets/:id", ictController.deleteAsset);

router.get("/licenses", ictController.getSoftwareLicenses);
router.get("/licenses/:id", ictController.getSoftwareLicenseById);
router.post("/licenses", ictController.createSoftwareLicense);
router.put("/licenses/:id", ictController.updateSoftwareLicense);
router.delete("/licenses/:id", ictController.deleteSoftwareLicense);

router.get("/tickets", ictController.getItTickets);
router.get("/tickets/:id", ictController.getItTicketById);
router.post("/tickets", ictController.createItTicket);
router.put("/tickets/:id", ictController.updateItTicket);
router.delete("/tickets/:id", ictController.deleteItTicket);

router.get("/network-devices", ictController.getNetworkDevices);
router.get("/network-devices/:id", ictController.getNetworkDeviceById);
router.post("/network-devices", ictController.createNetworkDevice);
router.put("/network-devices/:id", ictController.updateNetworkDevice);
router.delete("/network-devices/:id", ictController.deleteNetworkDevice);

router.get("/health-logs", ictController.getSystemHealthLogs);
router.post("/health-logs", ictController.createSystemHealthLog);

export default router;
