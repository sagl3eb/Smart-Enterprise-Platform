import { Router } from "express";
import authController from "../controllers/auth";
import { authenticate } from "../middleware/auth";
import { requireRole, requireMinRole } from "../middleware/rbac";

const router = Router();

// Public
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);

// Protected
router.post("/logout", authenticate, authController.logout);
router.post("/logout-all", authenticate, authController.logoutAll);
router.get("/profile", authenticate, authController.getProfile);
router.put("/profile", authenticate, authController.updateProfile);
router.put("/change-password", authenticate, authController.changePassword);

// Admin — User Management
router.get("/users", authenticate, requireMinRole("admin"), authController.listUsers);
router.post("/users", authenticate, requireMinRole("admin"), authController.createUser);
router.get("/users/:userId", authenticate, requireMinRole("admin"), authController.getUserById);
router.put("/users/:userId/modules", authenticate, requireMinRole("admin"), authController.updateUserModuleAccess);
router.put("/users/:userId/deactivate", authenticate, requireMinRole("admin"), authController.deactivateUser);
router.put("/users/:userId/activate", authenticate, requireMinRole("admin"), authController.activateUser);
router.delete("/users/:userId", authenticate, requireMinRole("admin"), authController.deleteUser);
router.get("/roles", authenticate, authController.getRoles);

// Admin — Organization Management
router.get("/organizations", authenticate, requireMinRole("admin"), authController.listOrganizations);
router.get("/organizations/:orgId", authenticate, requireMinRole("admin"), authController.getOrganizationById);
router.post("/organizations", authenticate, requireRole("super_admin"), authController.createOrganization);
router.put("/organizations/:orgId/modules", authenticate, requireMinRole("admin"), authController.updateOrgModules);
router.delete("/organizations/:orgId", authenticate, requireRole("super_admin"), authController.deleteOrganization);

export default router;
