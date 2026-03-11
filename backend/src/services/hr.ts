import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── DEPARTMENTS ───────────────────────────────────────────

async function getDepartments(filters: {
  isActive?: boolean;
  search?: string;
}) {
  const where: Prisma.DepartmentWhereInput = {};

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const departments = await prisma.department.findMany({
    where,
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });

  return departments;
}

async function getDepartmentById(id: string) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true, code: true } },
      employees: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          status: true,
          employeeCode: true,
        },
        where: { status: "active" },
        orderBy: { firstName: "asc" },
      },
      _count: { select: { employees: true } },
    },
  });

  return department;
}

async function createDepartment(data: {
  name: string;
  code: string;
  description?: string;
  managerId?: string;
  parentId?: string;
}) {
  const department = await prisma.department.create({
    data: {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      description: data.description?.trim(),
      managerId: data.managerId,
      parentId: data.parentId,
    },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
  });

  logger.info(`Department created: ${department.name}`);
  return department;
}

async function updateDepartment(
  id: string,
  data: {
    name?: string;
    code?: string;
    description?: string;
    managerId?: string;
    parentId?: string;
    isActive?: boolean;
  }
) {
  const department = await prisma.department.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.code && { code: data.code.toUpperCase().trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.managerId !== undefined && { managerId: data.managerId }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
  });

  return department;
}

async function deleteDepartment(id: string) {
  const employeeCount = await prisma.employee.count({
    where: { departmentId: id },
  });

  if (employeeCount > 0) {
    throw new HrError(
      `Cannot delete department with ${employeeCount} active employee(s). Reassign them first.`,
      400
    );
  }

  await prisma.department.delete({ where: { id } });
  logger.info(`Department deleted: ${id}`);
}

// ─── EMPLOYEES ─────────────────────────────────────────────

async function getEmployees(filters: {
  page: number;
  limit: number;
  skip: number;
  departmentId?: string;
  status?: string;
  employmentType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const where: Prisma.EmployeeWhereInput = {};

  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.employmentType) {
    where.employmentType = filters.employmentType;
  }

  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { employeeCode: { contains: filters.search, mode: "insensitive" } },
      { position: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const sortBy = filters.sortBy || "createdAt";
  const sortOrder = filters.sortOrder || "desc";
  const orderBy: Prisma.EmployeeOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy,
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return { employees, total };
}

async function getEmployeeById(id: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true, code: true } },
      manager: {
        select: { id: true, firstName: true, lastName: true, position: true },
      },
      subordinates: {
        select: { id: true, firstName: true, lastName: true, position: true },
        where: { status: "active" },
      },
      user: { select: { id: true, email: true, role: { select: { id: true, name: true } } } },
    },
  });

  return employee;
}

async function createEmployee(data: {
  employeeCode: string;
  departmentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  hireDate: string;
  salary: number;
  employmentType?: string;
  managerId?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: string;
  userId?: string;
}) {
  const existingCode = await prisma.employee.findUnique({
    where: { employeeCode: data.employeeCode },
  });
  if (existingCode) {
    throw new HrError("Employee code already exists", 409);
  }

  const existingEmail = await prisma.employee.findUnique({
    where: { email: data.email },
  });
  if (existingEmail) {
    throw new HrError("Employee email already exists", 409);
  }

  const department = await prisma.department.findUnique({
    where: { id: data.departmentId },
  });
  if (!department) {
    throw new HrError("Department not found", 404);
  }

  const employee = await prisma.employee.create({
    data: {
      employeeCode: data.employeeCode.toUpperCase().trim(),
      departmentId: data.departmentId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim(),
      position: data.position.trim(),
      hireDate: new Date(data.hireDate),
      salary: new Prisma.Decimal(data.salary),
      employmentType: data.employmentType || "full_time",
      managerId: data.managerId,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      address: data.address?.trim(),
      emergencyContact: data.emergencyContact?.trim(),
      userId: data.userId,
    },
    include: {
      department: { select: { id: true, name: true, code: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  logger.info(`Employee created: ${employee.employeeCode} - ${employee.firstName} ${employee.lastName}`);
  return employee;
}

async function updateEmployee(
  id: string,
  data: {
    departmentId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    position?: string;
    salary?: number;
    employmentType?: string;
    status?: string;
    managerId?: string;
    address?: string;
    emergencyContact?: string;
  }
) {
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) {
    throw new HrError("Employee not found", 404);
  }

  if (data.email && data.email !== existing.email) {
    const emailTaken = await prisma.employee.findUnique({
      where: { email: data.email },
    });
    if (emailTaken) {
      throw new HrError("Email already in use by another employee", 409);
    }
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(data.departmentId && { departmentId: data.departmentId }),
      ...(data.firstName && { firstName: data.firstName.trim() }),
      ...(data.lastName && { lastName: data.lastName.trim() }),
      ...(data.email && { email: data.email.toLowerCase().trim() }),
      ...(data.phone !== undefined && { phone: data.phone?.trim() }),
      ...(data.position && { position: data.position.trim() }),
      ...(data.salary !== undefined && { salary: new Prisma.Decimal(data.salary) }),
      ...(data.employmentType && { employmentType: data.employmentType }),
      ...(data.status && { status: data.status }),
      ...(data.managerId !== undefined && { managerId: data.managerId }),
      ...(data.address !== undefined && { address: data.address?.trim() }),
      ...(data.emergencyContact !== undefined && { emergencyContact: data.emergencyContact?.trim() }),
    },
    include: {
      department: { select: { id: true, name: true, code: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return employee;
}

async function deleteEmployee(id: string) {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    throw new HrError("Employee not found", 404);
  }

  await prisma.employee.update({
    where: { id },
    data: { status: "terminated" },
  });

  logger.info(`Employee terminated: ${employee.employeeCode}`);
}

// ─── ATTENDANCE ────────────────────────────────────────────

async function getAttendance(filters: {
  page: number;
  limit: number;
  skip: number;
  employeeId?: string;
  departmentId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  const where: Prisma.EmployeeAttendanceWhereInput = {};

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  if (filters.departmentId) {
    where.employee = { departmentId: filters.departmentId };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) {
      where.date.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.date.lte = new Date(filters.endDate);
    }
  }

  const [records, total] = await Promise.all([
    prisma.employeeAttendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.employeeAttendance.count({ where }),
  ]);

  return { records, total };
}

async function recordAttendance(data: {
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
  hoursWorked?: number;
  overtime?: number;
  notes?: string;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
  });
  if (!employee) {
    throw new HrError("Employee not found", 404);
  }

  const attendanceDate = new Date(data.date);

  const existing = await prisma.employeeAttendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: data.employeeId,
        date: attendanceDate,
      },
    },
  });

  if (existing) {
    const updated = await prisma.employeeAttendance.update({
      where: { id: existing.id },
      data: {
        checkIn: data.checkIn ? new Date(data.checkIn) : existing.checkIn,
        checkOut: data.checkOut ? new Date(data.checkOut) : existing.checkOut,
        status: data.status || existing.status,
        hoursWorked: data.hoursWorked !== undefined
          ? new Prisma.Decimal(data.hoursWorked)
          : existing.hoursWorked,
        overtime: data.overtime !== undefined
          ? new Prisma.Decimal(data.overtime)
          : existing.overtime,
        notes: data.notes !== undefined ? data.notes : existing.notes,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });
    return updated;
  }

  const record = await prisma.employeeAttendance.create({
    data: {
      employeeId: data.employeeId,
      date: attendanceDate,
      checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
      checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
      status: data.status || "present",
      hoursWorked: data.hoursWorked !== undefined
        ? new Prisma.Decimal(data.hoursWorked)
        : undefined,
      overtime: data.overtime !== undefined
        ? new Prisma.Decimal(data.overtime)
        : undefined,
      notes: data.notes,
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
    },
  });

  return record;
}

async function bulkRecordAttendance(
  records: Array<{
    employeeId: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    status?: string;
    hoursWorked?: number;
    overtime?: number;
  }>
) {
  const results = [];
  for (const record of records) {
    const result = await recordAttendance(record);
    results.push(result);
  }
  return results;
}

async function getAttendanceSummary(employeeId: string, month: number, year: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const records = await prisma.employeeAttendance.findMany({
    where: {
      employeeId,
      date: { gte: startDate, lte: endDate },
    },
  });

  const summary = {
    totalDays: endDate.getDate(),
    present: records.filter((r) => r.status === "present").length,
    absent: records.filter((r) => r.status === "absent").length,
    late: records.filter((r) => r.status === "late").length,
    halfDay: records.filter((r) => r.status === "half_day").length,
    leave: records.filter((r) => r.status === "on_leave").length,
    totalHoursWorked: records.reduce(
      (sum, r) => sum + (r.hoursWorked ? Number(r.hoursWorked) : 0),
      0
    ),
    totalOvertime: records.reduce(
      (sum, r) => sum + (r.overtime ? Number(r.overtime) : 0),
      0
    ),
  };

  return summary;
}

// ─── LEAVE ─────────────────────────────────────────────────

async function getLeaveTypes() {
  return prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

async function getLeaveRequests(filters: {
  page: number;
  limit: number;
  skip: number;
  employeeId?: string;
  status?: string;
  leaveTypeId?: string;
  departmentId?: string;
}) {
  const where: Prisma.LeaveRequestWhereInput = {};

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.leaveTypeId) {
    where.leaveTypeId = filters.leaveTypeId;
  }

  if (filters.departmentId) {
    where.employee = { departmentId: filters.departmentId };
  }

  const [requests, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
          },
        },
        leaveType: { select: { id: true, name: true, isPaid: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { requests, total };
}

async function createLeaveRequest(data: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
  });
  if (!employee) {
    throw new HrError("Employee not found", 404);
  }

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: data.leaveTypeId },
  });
  if (!leaveType) {
    throw new HrError("Leave type not found", 404);
  }

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  if (end < start) {
    throw new HrError("End date must be after start date", 400);
  }

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: data.employeeId,
      status: { in: ["pending", "approved"] },
      OR: [
        { startDate: { lte: end }, endDate: { gte: start } },
      ],
    },
  });

  if (overlapping) {
    throw new HrError("Leave request overlaps with an existing request", 400);
  }

  const request = await prisma.leaveRequest.create({
    data: {
      employeeId: data.employeeId,
      leaveTypeId: data.leaveTypeId,
      startDate: start,
      endDate: end,
      totalDays: new Prisma.Decimal(totalDays),
      reason: data.reason?.trim(),
      status: leaveType.requiresApproval ? "pending" : "approved",
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
      leaveType: { select: { id: true, name: true } },
    },
  });

  logger.info(`Leave request created: ${employee.employeeCode} - ${leaveType.name}`);
  return request;
}

async function updateLeaveRequestStatus(
  id: string,
  status: "approved" | "rejected",
  approvedBy: string
) {
  const request = await prisma.leaveRequest.findUnique({ where: { id } });

  if (!request) {
    throw new HrError("Leave request not found", 404);
  }

  if (request.status !== "pending") {
    throw new HrError(`Cannot ${status} a request that is already ${request.status}`, 400);
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      approvedBy,
      approvedAt: new Date(),
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
      leaveType: { select: { id: true, name: true } },
    },
  });

  logger.info(`Leave request ${status}: ${id}`);
  return updated;
}

async function getLeaveBalance(employeeId: string, year: number) {
  const leaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true },
  });

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      status: "approved",
      startDate: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      },
    },
    include: { leaveType: true },
  });

  const balance = leaveTypes.map((lt) => {
    const used = approvedLeaves
      .filter((l) => l.leaveTypeId === lt.id)
      .reduce((sum, l) => sum + Number(l.totalDays), 0);

    return {
      leaveType: { id: lt.id, name: lt.name, isPaid: lt.isPaid },
      entitled: lt.defaultDays,
      used,
      remaining: Math.max(0, lt.defaultDays - used),
    };
  });

  return balance;
}

// ─── PERFORMANCE REVIEWS ───────────────────────────────────

async function getPerformanceReviews(filters: {
  page: number;
  limit: number;
  skip: number;
  employeeId?: string;
  reviewPeriod?: string;
  status?: string;
}) {
  const where: Prisma.PerformanceReviewWhereInput = {};

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  if (filters.reviewPeriod) {
    where.reviewPeriod = filters.reviewPeriod;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const [reviews, total] = await Promise.all([
    prisma.performanceReview.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            position: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { reviewDate: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.performanceReview.count({ where }),
  ]);

  return { reviews, total };
}

async function createPerformanceReview(data: {
  employeeId: string;
  reviewerId: string;
  reviewPeriod: string;
  overallScore: number;
  goals?: object;
  strengths?: string;
  improvements?: string;
  comments?: string;
  reviewDate: string;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
  });
  if (!employee) {
    throw new HrError("Employee not found", 404);
  }

  if (data.overallScore < 0 || data.overallScore > 5) {
    throw new HrError("Overall score must be between 0 and 5", 400);
  }

  const review = await prisma.performanceReview.create({
    data: {
      employeeId: data.employeeId,
      reviewerId: data.reviewerId,
      reviewPeriod: data.reviewPeriod,
      overallScore: new Prisma.Decimal(data.overallScore),
      goals: data.goals as Prisma.InputJsonValue,
      strengths: data.strengths?.trim(),
      improvements: data.improvements?.trim(),
      comments: data.comments?.trim(),
      reviewDate: new Date(data.reviewDate),
      status: "draft",
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
        },
      },
    },
  });

  logger.info(`Performance review created for employee: ${employee.employeeCode}`);
  return review;
}

async function updatePerformanceReview(
  id: string,
  data: {
    overallScore?: number;
    goals?: object;
    strengths?: string;
    improvements?: string;
    comments?: string;
    status?: string;
  }
) {
  const existing = await prisma.performanceReview.findUnique({ where: { id } });
  if (!existing) {
    throw new HrError("Performance review not found", 404);
  }

  const review = await prisma.performanceReview.update({
    where: { id },
    data: {
      ...(data.overallScore !== undefined && {
        overallScore: new Prisma.Decimal(data.overallScore),
      }),
      ...(data.goals !== undefined && { goals: data.goals as Prisma.InputJsonValue }),
      ...(data.strengths !== undefined && { strengths: data.strengths?.trim() }),
      ...(data.improvements !== undefined && { improvements: data.improvements?.trim() }),
      ...(data.comments !== undefined && { comments: data.comments?.trim() }),
      ...(data.status && { status: data.status }),
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
        },
      },
    },
  });

  return review;
}

// ─── TRAINING ──────────────────────────────────────────────

async function getTrainingPrograms(filters: {
  page: number;
  limit: number;
  skip: number;
  status?: string;
}) {
  const where: Prisma.TrainingProgramWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  const [programs, total] = await Promise.all([
    prisma.trainingProgram.findMany({
      where,
      include: {
        _count: { select: { enrollments: true } },
      },
      orderBy: { startDate: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.trainingProgram.count({ where }),
  ]);

  return { programs, total };
}

async function createTrainingProgram(data: {
  name: string;
  description?: string;
  provider?: string;
  startDate: string;
  endDate: string;
  maxParticipants?: number;
  cost?: number;
}) {
  const program = await prisma.trainingProgram.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim(),
      provider: data.provider?.trim(),
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      maxParticipants: data.maxParticipants,
      cost: data.cost !== undefined ? new Prisma.Decimal(data.cost) : undefined,
    },
    include: {
      _count: { select: { enrollments: true } },
    },
  });

  logger.info(`Training program created: ${program.name}`);
  return program;
}

async function enrollInTraining(data: { employeeId: string; trainingProgramId: string }) {
  const program = await prisma.trainingProgram.findUnique({
    where: { id: data.trainingProgramId },
    include: { _count: { select: { enrollments: true } } },
  });

  if (!program) {
    throw new HrError("Training program not found", 404);
  }

  if (program.maxParticipants && program._count.enrollments >= program.maxParticipants) {
    throw new HrError("Training program is full", 400);
  }

  const existing = await prisma.employeeTraining.findUnique({
    where: {
      employeeId_trainingProgramId: {
        employeeId: data.employeeId,
        trainingProgramId: data.trainingProgramId,
      },
    },
  });

  if (existing) {
    throw new HrError("Employee is already enrolled in this program", 409);
  }

  const enrollment = await prisma.employeeTraining.create({
    data: {
      employeeId: data.employeeId,
      trainingProgramId: data.trainingProgramId,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      trainingProgram: { select: { id: true, name: true } },
    },
  });

  return enrollment;
}

// ─── EMPLOYEE DOCUMENTS ────────────────────────────────────

async function getEmployeeDocuments(employeeId: string) {
  return prisma.employeeDocument.findMany({
    where: { employeeId },
    orderBy: { uploadedAt: "desc" },
  });
}

async function addEmployeeDocument(data: {
  employeeId: string;
  name: string;
  type: string;
  filePath: string;
  fileSize?: number;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
  });
  if (!employee) {
    throw new HrError("Employee not found", 404);
  }

  const doc = await prisma.employeeDocument.create({
    data: {
      employeeId: data.employeeId,
      name: data.name.trim(),
      type: data.type.trim(),
      filePath: data.filePath,
      fileSize: data.fileSize,
    },
  });

  return doc;
}

async function deleteEmployeeDocument(id: string) {
  await prisma.employeeDocument.delete({ where: { id } });
}

// ─── ORG CHART ─────────────────────────────────────────────

async function getOrgChart() {
  const employees = await prisma.employee.findMany({
    where: { status: "active" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      employeeCode: true,
      managerId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { firstName: "asc" },
  });

  return employees;
}

// ─── STATS ─────────────────────────────────────────────────

async function getHrStats() {
  const [
    totalEmployees,
    activeEmployees,
    departmentCount,
    pendingLeaves,
    avgSalary,
    employmentTypeBreakdown,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "active" } }),
    prisma.department.count({ where: { isActive: true } }),
    prisma.leaveRequest.count({ where: { status: "pending" } }),
    prisma.employee.aggregate({
      _avg: { salary: true },
      where: { status: "active" },
    }),
    prisma.employee.groupBy({
      by: ["employmentType"],
      _count: true,
      where: { status: "active" },
    }),
  ]);

  return {
    totalEmployees,
    activeEmployees,
    terminatedEmployees: totalEmployees - activeEmployees,
    departmentCount,
    pendingLeaves,
    averageSalary: avgSalary._avg.salary ? Number(avgSalary._avg.salary) : 0,
    employmentTypeBreakdown: employmentTypeBreakdown.map((item) => ({
      type: item.employmentType,
      count: item._count,
    })),
  };
}

export class HrError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "HrError";
    this.statusCode = statusCode;
  }
}

const hrService = {
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
  updateLeaveRequestStatus,
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
};

export default hrService;
