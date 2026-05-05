import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import logger from "../utils/logger";

const NEW_USER_DEFAULT_PASSWORD = "employee123";
const NEW_USER_BASIC_MODULES = ["dashboard", "hr", "alerts"];

async function provisionUserForEmployee(emp: {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  organizationId?: string | null;
}): Promise<string | undefined> {
  const existing = await prisma.user.findUnique({ where: { email: emp.email } });
  if (existing) return existing.id;

  const employeeRole = await prisma.role.findUnique({ where: { name: "employee" } });
  if (!employeeRole) return undefined;

  const isManagerRole = /manager|director|lead|head|chief/i.test(emp.position);
  const managerRole = isManagerRole ? await prisma.role.findUnique({ where: { name: "manager" } }) : null;
  const roleId = managerRole?.id || employeeRole.id;

  const passwordHash = await bcrypt.hash(NEW_USER_DEFAULT_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      email: emp.email,
      passwordHash,
      firstName: emp.firstName,
      lastName: emp.lastName,
      roleId,
      organizationId: emp.organizationId ?? undefined,
      isActive: true,
    },
  });

  for (const moduleName of NEW_USER_BASIC_MODULES) {
    await prisma.userModuleAccess.create({
      data: { userId: user.id, moduleName, hasAccess: true },
    });
  }

  return user.id;
}

// ─── DEPARTMENTS ───────────────────────────────────────────

async function getDepartments(filters: {
  isActive?: boolean;
  search?: string;
  organizationId?: string;
}) {
  const where: Prisma.DepartmentWhereInput = {};

  if (filters.organizationId) {
    where.organizationId = filters.organizationId;
  }

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

async function getDepartmentById(id: string, organizationId?: string) {
  const department = await prisma.department.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
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
  organizationId?: string | null;
}) {
  const department = await prisma.department.create({
    data: {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      description: data.description?.trim(),
      managerId: data.managerId,
      parentId: data.parentId,
      organizationId: data.organizationId ?? undefined,
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
  },
  organizationId?: string
) {
  if (organizationId) {
    const owned = await prisma.department.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!owned) throw new HrError("Department not found", 404);
  }
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

async function deleteDepartment(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.department.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!owned) throw new HrError("Department not found", 404);
  }
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
  organizationId?: string;
}) {
  const where: Prisma.EmployeeWhereInput = {};

  if (filters.organizationId) {
    where.organizationId = filters.organizationId;
  }

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

async function getEmployeeById(id: string, organizationId?: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
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

async function nextEmployeeCode(organizationId?: string | null) {
  const prefix = "EMP-";
  const last = await prisma.employee.findFirst({
    where: {
      employeeCode: { startsWith: prefix },
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });
  const lastSeq = last ? Number(last.employeeCode.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

async function createEmployee(data: {
  employeeCode?: string;
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
  organizationId?: string | null;
}) {
  const employeeCode = data.employeeCode?.trim()
    ? data.employeeCode.toUpperCase().trim()
    : await nextEmployeeCode(data.organizationId);

  const existingCode = await prisma.employee.findFirst({
    where: { employeeCode, ...(data.organizationId ? { organizationId: data.organizationId } : {}) },
  });
  if (existingCode) {
    throw new HrError("Employee code already exists", 409);
  }

  const existingEmail = await prisma.employee.findFirst({
    where: { email: data.email, ...(data.organizationId ? { organizationId: data.organizationId } : {}) },
  });
  if (existingEmail) {
    throw new HrError("Employee email already exists", 409);
  }

  const department = await prisma.department.findFirst({
    where: { id: data.departmentId, ...(data.organizationId ? { organizationId: data.organizationId } : {}) },
  });
  if (!department) {
    throw new HrError("Department not found", 404);
  }

  const normalizedEmail = data.email.toLowerCase().trim();
  const linkedUserId = data.userId ?? await provisionUserForEmployee({
    email: normalizedEmail,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    position: data.position.trim(),
    organizationId: data.organizationId,
  });

  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      departmentId: data.departmentId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: normalizedEmail,
      phone: data.phone?.trim(),
      position: data.position.trim(),
      hireDate: new Date(data.hireDate),
      salary: new Prisma.Decimal(data.salary),
      employmentType: data.employmentType || "full_time",
      managerId: data.managerId,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      address: data.address?.trim(),
      emergencyContact: data.emergencyContact?.trim(),
      userId: linkedUserId,
      organizationId: data.organizationId ?? undefined,
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
  },
  organizationId?: string
) {
  const existing = await prisma.employee.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) {
    throw new HrError("Employee not found", 404);
  }

  if (data.email && data.email !== existing.email) {
    const emailTaken = await prisma.employee.findFirst({
      where: { email: data.email, ...(existing.organizationId ? { organizationId: existing.organizationId } : {}) },
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

async function deleteEmployee(id: string, organizationId?: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
    select: { id: true, employeeCode: true, userId: true },
  });
  if (!employee) {
    throw new HrError("Employee not found", 404);
  }

  await prisma.$transaction([
    prisma.employeeAttendance.deleteMany({ where: { employeeId: id } }),
    prisma.leaveRequest.deleteMany({ where: { employeeId: id } }),
    prisma.performanceReview.deleteMany({ where: { employeeId: id } }),
    prisma.employeeTraining.deleteMany({ where: { employeeId: id } }),
    prisma.employeeDocument.deleteMany({ where: { employeeId: id } }),
  ]);
  await prisma.employee.updateMany({ where: { managerId: id }, data: { managerId: null } });
  await prisma.employee.delete({ where: { id } });
  if (employee.userId) {
    await prisma.user.delete({ where: { id: employee.userId } }).catch(() => undefined);
  }

  logger.info(`Employee deleted: ${employee.employeeCode}`);
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
  organizationId?: string;
}) {
  const where: Prisma.EmployeeAttendanceWhereInput = {};

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  if (filters.departmentId || filters.organizationId) {
    where.employee = {
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
    };
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
}, organizationId?: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: data.employeeId, ...(organizationId ? { organizationId } : {}) },
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
  }>,
  organizationId?: string
) {
  const results = [];
  for (const record of records) {
    const result = await recordAttendance(record, organizationId);
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
  organizationId?: string;
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

  if (filters.departmentId || filters.organizationId) {
    where.employee = {
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
    };
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
}, organizationId?: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: data.employeeId, ...(organizationId ? { organizationId } : {}) },
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
  approvedBy: string,
  decisionNote?: string,
  organizationId?: string
) {
  const request = await prisma.leaveRequest.findFirst({
    where: {
      id,
      ...(organizationId ? { employee: { organizationId } } : {}),
    },
  });

  if (!request) {
    throw new HrError("Leave request not found", 404);
  }

  if (request.status !== "pending") {
    throw new HrError(`Cannot ${status} a request that is already ${request.status}`, 400);
  }

  const noteText = decisionNote?.trim();
  const nextReason = noteText
    ? `${request.reason ? `${request.reason}\n\n` : ""}[${status === "approved" ? "Approved" : "Rejected"}] ${noteText}`
    : request.reason;

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      approvedBy,
      approvedAt: new Date(),
      reason: nextReason,
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
  organizationId?: string;
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

  if (filters.organizationId) {
    where.employee = { organizationId: filters.organizationId };
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
}, organizationId?: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: data.employeeId, ...(organizationId ? { organizationId } : {}) },
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
  },
  organizationId?: string
) {
  const existing = await prisma.performanceReview.findFirst({
    where: { id, ...(organizationId ? { employee: { organizationId } } : {}) },
  });
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
  organizationId?: string;
}) {
  const where: Prisma.TrainingProgramWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.organizationId) {
    where.organizationId = filters.organizationId;
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
  organizationId?: string | null;
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
      organizationId: data.organizationId ?? undefined,
    },
    include: {
      _count: { select: { enrollments: true } },
    },
  });

  logger.info(`Training program created: ${program.name}`);
  return program;
}

async function enrollInTraining(data: { employeeId: string; trainingProgramId: string }, organizationId?: string) {
  const program = await prisma.trainingProgram.findFirst({
    where: { id: data.trainingProgramId, ...(organizationId ? { organizationId } : {}) },
    include: { _count: { select: { enrollments: true } } },
  });

  if (!program) {
    throw new HrError("Training program not found", 404);
  }

  if (organizationId) {
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new HrError("Employee not found", 404);
    }
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

async function getEmployeeDocuments(employeeId: string, organizationId?: string) {
  return prisma.employeeDocument.findMany({
    where: {
      employeeId,
      ...(organizationId ? { employee: { organizationId } } : {}),
    },
    orderBy: { uploadedAt: "desc" },
  });
}

async function addEmployeeDocument(data: {
  employeeId: string;
  name: string;
  type: string;
  filePath: string;
  fileSize?: number;
}, organizationId?: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: data.employeeId, ...(organizationId ? { organizationId } : {}) },
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

async function deleteEmployeeDocument(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.employeeDocument.findFirst({
      where: { id, employee: { organizationId } },
      select: { id: true },
    });
    if (!owned) throw new HrError("Document not found", 404);
  }
  await prisma.employeeDocument.delete({ where: { id } });
}

// ─── ORG CHART ─────────────────────────────────────────────

async function getOrgChart(organizationId?: string) {
  const employees = await prisma.employee.findMany({
    where: {
      status: "active",
      ...(organizationId ? { organizationId } : {}),
    },
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

async function getHrStats(organizationId?: string) {
  const orgFilter = organizationId ? { organizationId } : {};
  const empOrgFilter = organizationId ? { employee: { organizationId } } : {};
  const [
    totalEmployees,
    activeEmployees,
    departmentCount,
    pendingLeaves,
    avgSalary,
    employmentTypeBreakdown,
  ] = await Promise.all([
    prisma.employee.count({ where: { ...orgFilter } }),
    prisma.employee.count({ where: { status: "active", ...orgFilter } }),
    prisma.department.count({ where: { isActive: true, ...orgFilter } }),
    prisma.leaveRequest.count({ where: { status: "pending", ...empOrgFilter } }),
    prisma.employee.aggregate({
      _avg: { salary: true },
      where: { status: "active", ...orgFilter },
    }),
    prisma.employee.groupBy({
      by: ["employmentType"],
      _count: true,
      where: { status: "active", ...orgFilter },
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

// ─── JOB ROLES ─────────────────────────────────────────────

async function getJobRoles(filters: { isActive?: boolean; search?: string; organizationId?: string } = {}) {
  const where: Prisma.JobRoleWhereInput = {};
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return prisma.jobRole.findMany({ where, orderBy: { name: "asc" } });
}

async function createJobRole(data: { name: string; description?: string; level?: string; organizationId?: string | null }) {
  const name = data.name.trim();
  if (!name) throw new HrError("Name is required", 400);
  const existing = await prisma.jobRole.findFirst({
    where: { name, ...(data.organizationId ? { organizationId: data.organizationId } : {}) },
  });
  if (existing) throw new HrError("Job role already exists", 409);
  const role = await prisma.jobRole.create({
    data: {
      name,
      description: data.description?.trim(),
      level: data.level?.trim(),
      organizationId: data.organizationId ?? undefined,
    },
  });
  logger.info(`Job role created: ${role.name}`);
  return role;
}

async function updateJobRole(id: string, data: { name?: string; description?: string; level?: string; isActive?: boolean }, organizationId?: string) {
  const existing = await prisma.jobRole.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new HrError("Job role not found", 404);

  if (data.name && data.name.trim() !== existing.name) {
    const dup = await prisma.jobRole.findFirst({
      where: {
        name: data.name.trim(),
        ...(existing.organizationId ? { organizationId: existing.organizationId } : {}),
      },
    });
    if (dup) throw new HrError("Job role name already in use", 409);
  }

  const updated = await prisma.jobRole.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      description: data.description?.trim(),
      level: data.level?.trim(),
      isActive: data.isActive,
    },
  });
  logger.info(`Job role updated: ${updated.name}`);
  return updated;
}

async function deleteJobRole(id: string, organizationId?: string) {
  const existing = await prisma.jobRole.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new HrError("Job role not found", 404);

  const inUse = await prisma.employee.count({ where: { position: existing.name } });
  if (inUse > 0) {
    await prisma.jobRole.update({ where: { id }, data: { isActive: false } });
    logger.info(`Job role deactivated (in use): ${existing.name}`);
    return { deactivated: true, usedBy: inUse };
  }
  await prisma.jobRole.delete({ where: { id } });
  logger.info(`Job role deleted: ${existing.name}`);
  return { deactivated: false, usedBy: 0 };
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
  getJobRoles,
  createJobRole,
  updateJobRole,
  deleteJobRole,
};

export default hrService;
