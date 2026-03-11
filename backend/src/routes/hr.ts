import { Router } from "express";
import hrController from "../controllers/hr";
import { authenticate } from "../middleware/auth";
import { requireRole, requireMinRole } from "../middleware/rbac";

const router = Router();

// All HR routes require authentication
router.use(authenticate);

// ─── Stats ─────────────────────────────────────────────────
router.get("/stats", hrController.getHrStats);

// ─── Org Chart ─────────────────────────────────────────────
router.get("/org-chart", hrController.getOrgChart);

// ─── Departments ───────────────────────────────────────────
router.get("/departments", hrController.getDepartments);
router.get("/departments/:id", hrController.getDepartmentById);
router.post("/departments", requireMinRole("manager"), hrController.createDepartment);
router.put("/departments/:id", requireMinRole("manager"), hrController.updateDepartment);
router.delete("/departments/:id", requireRole("admin"), hrController.deleteDepartment);

// ─── Employees ─────────────────────────────────────────────
router.get("/employees", hrController.getEmployees);
router.get("/employees/:id", hrController.getEmployeeById);
router.post("/employees", requireMinRole("manager"), hrController.createEmployee);
router.put("/employees/:id", requireMinRole("manager"), hrController.updateEmployee);
router.delete("/employees/:id", requireRole("admin"), hrController.deleteEmployee);

// ─── Employee Documents ────────────────────────────────────
router.get("/employees/:employeeId/documents", hrController.getEmployeeDocuments);
router.post("/employees/:employeeId/documents", requireMinRole("manager"), hrController.addEmployeeDocument);
router.delete("/employees/:employeeId/documents/:docId", requireMinRole("manager"), hrController.deleteEmployeeDocument);

// ─── Attendance ────────────────────────────────────────────
router.get("/attendance", hrController.getAttendance);
router.post("/attendance", requireMinRole("manager"), hrController.recordAttendance);
router.post("/attendance/bulk", requireMinRole("manager"), hrController.bulkRecordAttendance);
router.get("/attendance/summary/:employeeId", hrController.getAttendanceSummary);

// ─── Leave ─────────────────────────────────────────────────
router.get("/leave-types", hrController.getLeaveTypes);
router.get("/leave-requests", hrController.getLeaveRequests);
router.post("/leave-requests", hrController.createLeaveRequest);
router.put("/leave-requests/:id/approve", requireMinRole("manager"), hrController.approveLeaveRequest);
router.put("/leave-requests/:id/reject", requireMinRole("manager"), hrController.rejectLeaveRequest);
router.get("/leave-balance/:employeeId", hrController.getLeaveBalance);

// ─── Performance Reviews ───────────────────────────────────
router.get("/performance-reviews", hrController.getPerformanceReviews);
router.post("/performance-reviews", requireMinRole("manager"), hrController.createPerformanceReview);
router.put("/performance-reviews/:id", requireMinRole("manager"), hrController.updatePerformanceReview);

// ─── Training ──────────────────────────────────────────────
router.get("/training-programs", hrController.getTrainingPrograms);
router.post("/training-programs", requireMinRole("manager"), hrController.createTrainingProgram);
router.post("/training-enrollments", requireMinRole("manager"), hrController.enrollInTraining);

export default router;
