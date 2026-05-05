import prisma from "../prisma/client";

export class MeError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

async function resolveEmployee(userId: string) {
  const emp = await prisma.employee.findUnique({
    where: { userId },
    include: {
      department: { select: { id: true, name: true, code: true } },
      manager: { select: { id: true, firstName: true, lastName: true, position: true, email: true } },
    },
  });
  return emp;
}

async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
  });
  if (!user) throw new MeError("User not found", 404);
  const emp = await resolveEmployee(userId);
  return {
    user,
    employee: emp
      ? {
          id: emp.id,
          employeeCode: emp.employeeCode,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          position: emp.position,
          hireDate: emp.hireDate,
          status: emp.status,
          department: emp.department,
          manager: emp.manager,
        }
      : null,
  };
}

async function listLeaves(userId: string) {
  const emp = await resolveEmployee(userId);
  if (!emp) throw new MeError("No employee record linked to this user", 404);
  const leaves = await prisma.leaveRequest.findMany({
    where: { employeeId: emp.id },
    include: { leaveType: { select: { id: true, name: true, isPaid: true } } },
    orderBy: { createdAt: "desc" },
  });
  return leaves;
}

async function createLeave(
  userId: string,
  input: { leaveTypeId: string; startDate: string; endDate: string; reason?: string },
) {
  const emp = await resolveEmployee(userId);
  if (!emp) throw new MeError("No employee record linked to this user", 404);
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new MeError("Invalid start or end date", 400);
  }
  if (end < start) throw new MeError("End date must be after start date", 400);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

  const type = await prisma.leaveType.findUnique({ where: { id: input.leaveTypeId } });
  if (!type) throw new MeError("Leave type not found", 404);

  const created = await prisma.leaveRequest.create({
    data: {
      employeeId: emp.id,
      leaveTypeId: input.leaveTypeId,
      startDate: start,
      endDate: end,
      totalDays,
      reason: input.reason?.trim() || null,
      status: "pending",
    },
    include: { leaveType: { select: { id: true, name: true, isPaid: true } } },
  });
  return created;
}

async function cancelLeave(userId: string, leaveId: string) {
  const emp = await resolveEmployee(userId);
  if (!emp) throw new MeError("No employee record linked to this user", 404);
  const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
  if (!leave) throw new MeError("Leave not found", 404);
  if (leave.employeeId !== emp.id) throw new MeError("Not your leave request", 403);
  if (leave.status !== "pending") throw new MeError("Only pending requests can be cancelled", 400);
  await prisma.leaveRequest.delete({ where: { id: leaveId } });
  return { id: leaveId };
}

async function listLeaveTypes() {
  return prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, defaultDays: true, isPaid: true, description: true },
  });
}

function displayNameFor(user: { firstName: string; lastName: string; email: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}

async function nextTicketNumber() {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;
  const last = await prisma.itTicket.findFirst({
    where: { ticketNumber: { startsWith: prefix } },
    orderBy: { ticketNumber: "desc" },
    select: { ticketNumber: true },
  });
  const lastSeq = last ? Number(last.ticketNumber.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

async function listTickets(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
  if (!user) throw new MeError("User not found", 404);
  const name = displayNameFor(user);
  const tickets = await prisma.itTicket.findMany({
    where: { OR: [{ reportedBy: name }, { reportedBy: user.email }] },
    orderBy: { createdAt: "desc" },
  });
  return tickets.map((t) => ({ ...t, timeline: buildTicketTimeline(t) }));
}

async function getTicket(userId: string, ticketId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
  if (!user) throw new MeError("User not found", 404);
  const t = await prisma.itTicket.findUnique({ where: { id: ticketId } });
  if (!t) throw new MeError("Ticket not found", 404);
  const name = displayNameFor(user);
  if (t.reportedBy !== name && t.reportedBy !== user.email) {
    throw new MeError("Not your ticket", 403);
  }
  return { ...t, timeline: buildTicketTimeline(t) };
}

function buildTicketTimeline(t: {
  createdAt: Date;
  updatedAt: Date;
  status: string;
  priority: string;
  assignedTo: string | null;
  resolution: string | null;
  resolvedAt: Date | null;
}) {
  const events: { at: Date; kind: string; text: string }[] = [];
  events.push({ at: t.createdAt, kind: "created", text: "Ticket opened" });
  if (t.assignedTo) events.push({ at: t.updatedAt, kind: "assigned", text: `Assigned to ${t.assignedTo}` });
  if (t.status && t.status !== "open") {
    events.push({ at: t.updatedAt, kind: "status", text: `Status set to ${t.status}` });
  }
  if (t.resolvedAt) {
    events.push({
      at: t.resolvedAt,
      kind: "resolved",
      text: t.resolution ? `Resolved — ${t.resolution}` : "Resolved",
    });
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

async function createTicket(
  userId: string,
  input: { title: string; description: string; category: string; priority?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
  if (!user) throw new MeError("User not found", 404);
  if (!input.title?.trim() || !input.description?.trim() || !input.category?.trim()) {
    throw new MeError("title, description and category are required", 400);
  }
  const ticketNumber = await nextTicketNumber();
  const created = await prisma.itTicket.create({
    data: {
      ticketNumber,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      priority: (input.priority || "medium").trim(),
      status: "open",
      reportedBy: displayNameFor(user),
    },
  });
  return { ...created, timeline: buildTicketTimeline(created) };
}

async function listAssets(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
  if (!user) throw new MeError("User not found", 404);
  const name = displayNameFor(user);
  const assets = await prisma.asset.findMany({
    where: { OR: [{ assignedTo: name }, { assignedTo: user.email }] },
    orderBy: { name: "asc" },
  });
  return assets;
}

async function listDirectory(scopeOrgId?: string | null) {
  const where = scopeOrgId ? { organizationId: scopeOrgId } : {};
  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      position: true,
      status: true,
      hireDate: true,
      managerId: true,
      department: { select: { id: true, name: true, code: true } },
      manager: {
        select: { id: true, firstName: true, lastName: true, position: true, email: true },
      },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
  return employees;
}

export default {
  getProfile,
  listLeaves,
  createLeave,
  cancelLeave,
  listLeaveTypes,
  listTickets,
  getTicket,
  createTicket,
  listAssets,
  listDirectory,
};
