import { Response } from "express";
import hrService, { HrError } from "../services/hr";
import { ScopedRequest, readOrgFilter, writeOrgId } from "../middleware/callerScope";
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError,
  sendNotFound,
  sendBadRequest,
  parsePagination,
} from "../utils/response";
import logger from "../utils/logger";

// ─── DEPARTMENTS ───────────────────────────────────────────

async function getDepartments(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { isActive, search } = req.query;

    const departments = await hrService.getDepartments({
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      search: search as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendSuccess(res, departments, "Departments retrieved");
  } catch (error) {
    logger.error("Get departments error:", error);
    sendError(res, "Failed to retrieve departments");
  }
}

async function getDepartmentById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const department = await hrService.getDepartmentById(
      req.params.id,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );

    if (!department) {
      sendNotFound(res, "Department");
      return;
    }

    sendSuccess(res, department, "Department retrieved");
  } catch (error) {
    logger.error("Get department error:", error);
    sendError(res, "Failed to retrieve department");
  }
}

async function createDepartment(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, code, description, managerId, parentId, organizationId: bodyOrgId } = req.body;

    if (!name || !code) {
      sendBadRequest(res, "Name and code are required");
      return;
    }

    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;

    const department = await hrService.createDepartment({
      name,
      code,
      description,
      managerId,
      parentId,
      organizationId: orgId,
    });

    sendCreated(res, department, "Department created");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      sendError(res, "Department name or code already exists", 409);
      return;
    }
    logger.error("Create department error:", error);
    sendError(res, "Failed to create department");
  }
}

async function updateDepartment(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const department = await hrService.updateDepartment(
      req.params.id,
      req.body,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );
    sendSuccess(res, department, "Department updated");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Update department error:", error);
    sendError(res, "Failed to update department");
  }
}

async function deleteDepartment(req: ScopedRequest, res: Response): Promise<void> {
  try {
    await hrService.deleteDepartment(
      req.params.id,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );
    sendSuccess(res, null, "Department deleted");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Delete department error:", error);
    sendError(res, "Failed to delete department");
  }
}

// ─── EMPLOYEES ─────────────────────────────────────────────

async function getEmployees(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { departmentId, status, employmentType, search, sortBy, sortOrder } = req.query;

    const result = await hrService.getEmployees({
      page,
      limit,
      skip,
      departmentId: departmentId as string,
      status: status as string,
      employmentType: employmentType as string,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.employees, result.total, page, limit, "Employees retrieved");
  } catch (error) {
    logger.error("Get employees error:", error);
    sendError(res, "Failed to retrieve employees");
  }
}

async function getEmployeeById(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const employee = await hrService.getEmployeeById(
      req.params.id,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );

    if (!employee) {
      sendNotFound(res, "Employee");
      return;
    }

    sendSuccess(res, employee, "Employee retrieved");
  } catch (error) {
    logger.error("Get employee error:", error);
    sendError(res, "Failed to retrieve employee");
  }
}

async function createEmployee(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const {
      employeeCode, departmentId, firstName, lastName, email,
      phone, position, hireDate, salary, employmentType,
      managerId, dateOfBirth, address, emergencyContact, userId,
      organizationId: bodyOrgId,
    } = req.body;

    if (!departmentId || !firstName || !lastName || !email || !position || !hireDate || salary === undefined) {
      sendBadRequest(res, "Required fields: departmentId, firstName, lastName, email, position, hireDate, salary");
      return;
    }

    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;

    const employee = await hrService.createEmployee({
      employeeCode, departmentId, firstName, lastName, email,
      phone, position, hireDate, salary: Number(salary), employmentType,
      managerId, dateOfBirth, address, emergencyContact, userId,
      organizationId: orgId,
    });

    sendCreated(res, employee, "Employee created");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Create employee error:", error);
    sendError(res, "Failed to create employee");
  }
}

async function updateEmployee(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const employee = await hrService.updateEmployee(
      req.params.id,
      {
        ...req.body,
        salary: req.body.salary !== undefined ? Number(req.body.salary) : undefined,
      },
      req.scope ? readOrgFilter(req.scope) : undefined,
    );

    sendSuccess(res, employee, "Employee updated");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Update employee error:", error);
    sendError(res, "Failed to update employee");
  }
}

async function deleteEmployee(req: ScopedRequest, res: Response): Promise<void> {
  try {
    await hrService.deleteEmployee(
      req.params.id,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );
    sendSuccess(res, null, "Employee terminated");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Delete employee error:", error);
    sendError(res, "Failed to terminate employee");
  }
}

// ─── ATTENDANCE ────────────────────────────────────────────

async function getAttendance(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { employeeId, departmentId, startDate, endDate, status } = req.query;

    const result = await hrService.getAttendance({
      page,
      limit,
      skip,
      employeeId: employeeId as string,
      departmentId: departmentId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      status: status as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.records, result.total, page, limit, "Attendance retrieved");
  } catch (error) {
    logger.error("Get attendance error:", error);
    sendError(res, "Failed to retrieve attendance");
  }
}

async function recordAttendance(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, date, checkIn, checkOut, status, hoursWorked, overtime, notes } = req.body;

    if (!employeeId || !date) {
      sendBadRequest(res, "Employee ID and date are required");
      return;
    }

    const record = await hrService.recordAttendance({
      employeeId,
      date,
      checkIn,
      checkOut,
      status,
      hoursWorked: hoursWorked !== undefined ? Number(hoursWorked) : undefined,
      overtime: overtime !== undefined ? Number(overtime) : undefined,
      notes,
    }, req.scope ? readOrgFilter(req.scope) : undefined);

    sendCreated(res, record, "Attendance recorded");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Record attendance error:", error);
    sendError(res, "Failed to record attendance");
  }
}

async function bulkRecordAttendance(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      sendBadRequest(res, "Records array is required");
      return;
    }

    const results = await hrService.bulkRecordAttendance(
      records,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );
    sendCreated(res, results, `${results.length} attendance records processed`);
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Bulk attendance error:", error);
    sendError(res, "Failed to process bulk attendance");
  }
}

async function getAttendanceSummary(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      sendBadRequest(res, "Month and year query parameters are required");
      return;
    }

    const summary = await hrService.getAttendanceSummary(
      employeeId,
      parseInt(month as string, 10),
      parseInt(year as string, 10)
    );

    sendSuccess(res, summary, "Attendance summary retrieved");
  } catch (error) {
    logger.error("Attendance summary error:", error);
    sendError(res, "Failed to retrieve attendance summary");
  }
}

// ─── LEAVE ─────────────────────────────────────────────────

async function getLeaveTypes(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const types = await hrService.getLeaveTypes();
    sendSuccess(res, types, "Leave types retrieved");
  } catch (error) {
    logger.error("Get leave types error:", error);
    sendError(res, "Failed to retrieve leave types");
  }
}

async function getLeaveRequests(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { employeeId, status, leaveTypeId, departmentId } = req.query;

    const result = await hrService.getLeaveRequests({
      page,
      limit,
      skip,
      employeeId: employeeId as string,
      status: status as string,
      leaveTypeId: leaveTypeId as string,
      departmentId: departmentId as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.requests, result.total, page, limit, "Leave requests retrieved");
  } catch (error) {
    logger.error("Get leave requests error:", error);
    sendError(res, "Failed to retrieve leave requests");
  }
}

async function createLeaveRequest(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, reason } = req.body;

    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      sendBadRequest(res, "Employee ID, leave type, start date, and end date are required");
      return;
    }

    const request = await hrService.createLeaveRequest({
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
    }, req.scope ? readOrgFilter(req.scope) : undefined);

    sendCreated(res, request, "Leave request submitted");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Create leave request error:", error);
    sendError(res, "Failed to submit leave request");
  }
}

async function approveLeaveRequest(req: ScopedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const request = await hrService.updateLeaveRequestStatus(
      req.params.id,
      "approved",
      req.user.userId,
      typeof req.body?.decisionNote === "string" ? req.body.decisionNote : undefined,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );

    sendSuccess(res, request, "Leave request approved");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Approve leave error:", error);
    sendError(res, "Failed to approve leave request");
  }
}

async function rejectLeaveRequest(req: ScopedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const request = await hrService.updateLeaveRequestStatus(
      req.params.id,
      "rejected",
      req.user.userId,
      typeof req.body?.decisionNote === "string" ? req.body.decisionNote : undefined,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );

    sendSuccess(res, request, "Leave request rejected");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Reject leave error:", error);
    sendError(res, "Failed to reject leave request");
  }
}

async function getLeaveBalance(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { employeeId } = req.params;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const balance = await hrService.getLeaveBalance(employeeId, year);

    sendSuccess(res, balance, "Leave balance retrieved");
  } catch (error) {
    logger.error("Leave balance error:", error);
    sendError(res, "Failed to retrieve leave balance");
  }
}

// ─── PERFORMANCE REVIEWS ───────────────────────────────────

async function getPerformanceReviews(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { employeeId, reviewPeriod, status } = req.query;

    const result = await hrService.getPerformanceReviews({
      page,
      limit,
      skip,
      employeeId: employeeId as string,
      reviewPeriod: reviewPeriod as string,
      status: status as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.reviews, result.total, page, limit, "Reviews retrieved");
  } catch (error) {
    logger.error("Get reviews error:", error);
    sendError(res, "Failed to retrieve performance reviews");
  }
}

async function createPerformanceReview(req: ScopedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const {
      employeeId, reviewPeriod, overallScore,
      goals, strengths, improvements, comments, reviewDate,
    } = req.body;

    if (!employeeId || !reviewPeriod || overallScore === undefined || !reviewDate) {
      sendBadRequest(res, "Required: employeeId, reviewPeriod, overallScore, reviewDate");
      return;
    }

    const review = await hrService.createPerformanceReview({
      employeeId,
      reviewerId: req.user.userId,
      reviewPeriod,
      overallScore: Number(overallScore),
      goals,
      strengths,
      improvements,
      comments,
      reviewDate,
    }, req.scope ? readOrgFilter(req.scope) : undefined);

    sendCreated(res, review, "Performance review created");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Create review error:", error);
    sendError(res, "Failed to create performance review");
  }
}

async function updatePerformanceReview(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const review = await hrService.updatePerformanceReview(
      req.params.id,
      {
        ...req.body,
        overallScore: req.body.overallScore !== undefined ? Number(req.body.overallScore) : undefined,
      },
      req.scope ? readOrgFilter(req.scope) : undefined,
    );

    sendSuccess(res, review, "Performance review updated");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Update review error:", error);
    sendError(res, "Failed to update performance review");
  }
}

// ─── TRAINING ──────────────────────────────────────────────

async function getTrainingPrograms(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const { status } = req.query;

    const result = await hrService.getTrainingPrograms({
      page,
      limit,
      skip,
      status: status as string,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });

    sendPaginated(res, result.programs, result.total, page, limit, "Training programs retrieved");
  } catch (error) {
    logger.error("Get training programs error:", error);
    sendError(res, "Failed to retrieve training programs");
  }
}

async function createTrainingProgram(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, description, provider, startDate, endDate, maxParticipants, cost, organizationId: bodyOrgId } = req.body;

    if (!name || !startDate || !endDate) {
      sendBadRequest(res, "Name, start date, and end date are required");
      return;
    }

    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;

    const program = await hrService.createTrainingProgram({
      name,
      description,
      provider,
      startDate,
      endDate,
      maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
      cost: cost !== undefined ? Number(cost) : undefined,
      organizationId: orgId,
    });

    sendCreated(res, program, "Training program created");
  } catch (error) {
    logger.error("Create training program error:", error);
    sendError(res, "Failed to create training program");
  }
}

async function enrollInTraining(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { employeeId, trainingProgramId } = req.body;

    if (!employeeId || !trainingProgramId) {
      sendBadRequest(res, "Employee ID and training program ID are required");
      return;
    }

    const enrollment = await hrService.enrollInTraining(
      { employeeId, trainingProgramId },
      req.scope ? readOrgFilter(req.scope) : undefined,
    );

    sendCreated(res, enrollment, "Employee enrolled in training");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Enroll in training error:", error);
    sendError(res, "Failed to enroll in training");
  }
}

// ─── DOCUMENTS ─────────────────────────────────────────────

async function getEmployeeDocuments(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const docs = await hrService.getEmployeeDocuments(
      req.params.employeeId,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );
    sendSuccess(res, docs, "Documents retrieved");
  } catch (error) {
    logger.error("Get documents error:", error);
    sendError(res, "Failed to retrieve documents");
  }
}

async function addEmployeeDocument(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, type, filePath, fileSize } = req.body;
    const { employeeId } = req.params;

    if (!name || !type || !filePath) {
      sendBadRequest(res, "Name, type, and file path are required");
      return;
    }

    const doc = await hrService.addEmployeeDocument({
      employeeId,
      name,
      type,
      filePath,
      fileSize: fileSize ? Number(fileSize) : undefined,
    }, req.scope ? readOrgFilter(req.scope) : undefined);

    sendCreated(res, doc, "Document uploaded");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Add document error:", error);
    sendError(res, "Failed to upload document");
  }
}

async function deleteEmployeeDocument(req: ScopedRequest, res: Response): Promise<void> {
  try {
    await hrService.deleteEmployeeDocument(
      req.params.docId,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );
    sendSuccess(res, null, "Document deleted");
  } catch (error) {
    if (error instanceof HrError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    logger.error("Delete document error:", error);
    sendError(res, "Failed to delete document");
  }
}

// ─── ORG CHART & STATS ────────────────────────────────────

async function getOrgChart(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const chart = await hrService.getOrgChart(req.scope ? readOrgFilter(req.scope) : undefined);
    sendSuccess(res, chart, "Org chart retrieved");
  } catch (error) {
    logger.error("Org chart error:", error);
    sendError(res, "Failed to retrieve org chart");
  }
}

async function getHrStats(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const stats = await hrService.getHrStats(req.scope ? readOrgFilter(req.scope) : undefined);
    sendSuccess(res, stats, "HR statistics retrieved");
  } catch (error) {
    logger.error("HR stats error:", error);
    sendError(res, "Failed to retrieve HR statistics");
  }
}

// ─── JOB ROLES ─────────────────────────────────────────────

async function getJobRoles(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { isActive, search } = req.query;
    const roles = await hrService.getJobRoles({
      isActive: isActive === undefined ? undefined : isActive === "true",
      search: search as string | undefined,
      organizationId: req.scope ? readOrgFilter(req.scope) : undefined,
    });
    sendSuccess(res, roles, "Job roles retrieved");
  } catch (error) {
    logger.error("Job roles error:", error);
    sendError(res, "Failed to retrieve job roles");
  }
}

async function createJobRole(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { name, description, level, organizationId: bodyOrgId } = req.body;
    if (!name) { sendBadRequest(res, "Name is required"); return; }
    const orgId = req.scope ? writeOrgId(req.scope, bodyOrgId) : undefined;
    const role = await hrService.createJobRole({ name, description, level, organizationId: orgId });
    sendCreated(res, role, "Job role created");
  } catch (error) {
    if (error instanceof HrError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Create job role error:", error);
    sendError(res, "Failed to create job role");
  }
}

async function updateJobRole(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const role = await hrService.updateJobRole(
      id,
      req.body,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );
    sendSuccess(res, role, "Job role updated");
  } catch (error) {
    if (error instanceof HrError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Update job role error:", error);
    sendError(res, "Failed to update job role");
  }
}

async function deleteJobRole(req: ScopedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await hrService.deleteJobRole(
      id,
      req.scope ? readOrgFilter(req.scope) : undefined,
    );
    sendSuccess(res, result, result.deactivated ? "Job role deactivated (in use)" : "Job role deleted");
  } catch (error) {
    if (error instanceof HrError) { sendError(res, error.message, error.statusCode); return; }
    logger.error("Delete job role error:", error);
    sendError(res, "Failed to delete job role");
  }
}

const hrController = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getAttendance,
  recordAttendance,
  bulkRecordAttendance,
  getAttendanceSummary,
  getLeaveTypes,
  getLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  getLeaveBalance,
  getPerformanceReviews,
  createPerformanceReview,
  updatePerformanceReview,
  getTrainingPrograms,
  createTrainingProgram,
  enrollInTraining,
  getEmployeeDocuments,
  addEmployeeDocument,
  deleteEmployeeDocument,
  getOrgChart,
  getHrStats,
  getJobRoles,
  createJobRole,
  updateJobRole,
  deleteJobRole,
};

export default hrController;
