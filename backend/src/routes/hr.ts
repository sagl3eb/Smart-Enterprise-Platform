import { Router } from "express";
import hrController from "../controllers/hr";
import { authenticate } from "../middleware/auth";
import { attachScope } from "../middleware/callerScope";
import { blockViewerWrites, blockSuperAdminModuleWrites } from "../middleware/rbac";

const router = Router();
router.use(authenticate);
router.use(attachScope);
router.use(blockViewerWrites);
router.use(blockSuperAdminModuleWrites);

router.get("/stats", hrController.getHrStats);
router.get("/org-chart", hrController.getOrgChart);

router.get("/departments", hrController.getDepartments);
router.get("/departments/:id", hrController.getDepartmentById);
router.post("/departments", hrController.createDepartment);
router.put("/departments/:id", hrController.updateDepartment);
router.delete("/departments/:id", hrController.deleteDepartment);

router.get("/employees", hrController.getEmployees);
router.get("/employees/:id", hrController.getEmployeeById);
router.post("/employees", hrController.createEmployee);
router.put("/employees/:id", hrController.updateEmployee);
router.delete("/employees/:id", hrController.deleteEmployee);

router.get("/employees/:employeeId/documents", hrController.getEmployeeDocuments);
router.post("/employees/:employeeId/documents", hrController.addEmployeeDocument);
router.delete("/employees/:employeeId/documents/:docId", hrController.deleteEmployeeDocument);

router.get("/attendance", hrController.getAttendance);
router.post("/attendance", hrController.recordAttendance);
router.post("/attendance/bulk", hrController.bulkRecordAttendance);
router.get("/attendance/summary/:employeeId", hrController.getAttendanceSummary);

router.get("/leave-types", hrController.getLeaveTypes);
router.get("/leave-requests", hrController.getLeaveRequests);
router.post("/leave-requests", hrController.createLeaveRequest);
router.put("/leave-requests/:id/approve", hrController.approveLeaveRequest);
router.put("/leave-requests/:id/reject", hrController.rejectLeaveRequest);
router.get("/leave-balance/:employeeId", hrController.getLeaveBalance);

router.get("/performance-reviews", hrController.getPerformanceReviews);
router.post("/performance-reviews", hrController.createPerformanceReview);
router.put("/performance-reviews/:id", hrController.updatePerformanceReview);

router.get("/job-roles", hrController.getJobRoles);
router.post("/job-roles", hrController.createJobRole);
router.put("/job-roles/:id", hrController.updateJobRole);
router.delete("/job-roles/:id", hrController.deleteJobRole);

router.get("/training-programs", hrController.getTrainingPrograms);
router.post("/training-programs", hrController.createTrainingProgram);
router.post("/training-enrollments", hrController.enrollInTraining);

export default router;
