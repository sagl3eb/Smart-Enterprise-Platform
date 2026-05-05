import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── ASSETS ────────────────────────────────────────────────

async function getAssets(filters: {
  page: number;
  limit: number;
  skip: number;
  category?: string;
  status?: string;
  search?: string;
  assignedTo?: string;
  organizationId?: string;
}) {
  const where: Prisma.AssetWhereInput = {};
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.assignedTo) where.assignedTo = { contains: filters.assignedTo, mode: "insensitive" };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { assetTag: { contains: filters.search, mode: "insensitive" } },
      { serialNumber: { contains: filters.search, mode: "insensitive" } },
      { manufacturer: { contains: filters.search, mode: "insensitive" } },
      { assignedTo: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.asset.count({ where }),
  ]);

  return { assets, total };
}

async function getAssetById(id: string, organizationId?: string) {
  return prisma.asset.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
}

async function createAsset(data: {
  assetTag: string;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
  assignedTo?: string;
  location?: string;
  notes?: string;
  organizationId?: string | null;
}) {
  const existing = await prisma.asset.findFirst({
    where: {
      assetTag: data.assetTag,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
  if (existing) throw new IctError("Asset tag already exists", 409);

  if (data.serialNumber) {
    const serialExists = await prisma.asset.findFirst({
      where: {
        serialNumber: data.serialNumber,
        ...(data.organizationId ? { organizationId: data.organizationId } : {}),
      },
    });
    if (serialExists) throw new IctError("Serial number already exists", 409);
  }

  const asset = await prisma.asset.create({
    data: {
      assetTag: data.assetTag.toUpperCase().trim(),
      name: data.name.trim(),
      category: data.category.trim(),
      manufacturer: data.manufacturer?.trim(),
      model: data.model?.trim(),
      serialNumber: data.serialNumber?.trim(),
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      purchasePrice: data.purchasePrice !== undefined ? new Prisma.Decimal(data.purchasePrice) : undefined,
      warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : undefined,
      assignedTo: data.assignedTo?.trim(),
      location: data.location?.trim(),
      notes: data.notes?.trim(),
      organizationId: data.organizationId ?? undefined,
    },
  });

  logger.info(`Asset created: ${asset.assetTag} - ${asset.name}`);
  return asset;
}

async function updateAsset(id: string, data: {
  assetTag?: string;
  name?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  status?: string;
  assignedTo?: string;
  location?: string;
  warrantyExpiry?: string;
  notes?: string;
}, organizationId?: string) {
  const existing = await prisma.asset.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new IctError("Asset not found", 404);

  return prisma.asset.update({
    where: { id },
    data: {
      ...(data.assetTag && { assetTag: data.assetTag.trim() }),
      ...(data.name && { name: data.name.trim() }),
      ...(data.category && { category: data.category.trim() }),
      ...(data.manufacturer !== undefined && { manufacturer: data.manufacturer?.trim() }),
      ...(data.model !== undefined && { model: data.model?.trim() }),
      ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber?.trim() }),
      ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null }),
      ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
      ...(data.status && { status: data.status }),
      ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo?.trim() }),
      ...(data.location !== undefined && { location: data.location?.trim() }),
      ...(data.warrantyExpiry !== undefined && { warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() }),
    },
  });
}

async function deleteAsset(id: string, organizationId?: string) {
  const existing = await prisma.asset.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new IctError("Asset not found", 404);
  await prisma.asset.delete({ where: { id } });
  logger.info(`Asset deleted: ${existing.assetTag}`);
}

async function getAssetStats(organizationId?: string) {
  const baseWhere: Prisma.AssetWhereInput = organizationId ? { organizationId } : {};
  const [total, byStatus, byCategory, expiringWarranty] = await Promise.all([
    prisma.asset.count({ where: baseWhere }),
    prisma.asset.groupBy({ by: ["status"], where: baseWhere, _count: true }),
    prisma.asset.groupBy({ by: ["category"], where: baseWhere, _count: true, orderBy: { _count: { category: "desc" } } }),
    prisma.asset.count({
      where: {
        ...baseWhere,
        warrantyExpiry: {
          gte: new Date(),
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const totalValue = await prisma.asset.aggregate({
    _sum: { purchasePrice: true },
    where: { ...baseWhere, status: { not: "disposed" } },
  });

  return {
    total,
    totalValue: Number(totalValue._sum.purchasePrice || 0),
    expiringWarrantyCount: expiringWarranty,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byCategory: byCategory.map((c) => ({ category: c.category, count: c._count })),
  };
}

// ─── SOFTWARE LICENSES ─────────────────────────────────────

async function getSoftwareLicenses(filters: {
  page: number;
  limit: number;
  skip: number;
  status?: string;
  search?: string;
  organizationId?: string;
}) {
  const where: Prisma.SoftwareLicenseWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.search) {
    where.OR = [
      { softwareName: { contains: filters.search, mode: "insensitive" } },
      { vendor: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [licenses, total] = await Promise.all([
    prisma.softwareLicense.findMany({
      where,
      orderBy: { softwareName: "asc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.softwareLicense.count({ where }),
  ]);

  return { licenses, total };
}

async function getSoftwareLicenseById(id: string, organizationId?: string) {
  return prisma.softwareLicense.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
}

async function createSoftwareLicense(data: {
  softwareName: string;
  vendor?: string;
  licenseKey?: string;
  licenseType: string;
  totalSeats: number;
  purchaseDate: string;
  expiryDate?: string;
  annualCost?: number;
  notes?: string;
  organizationId?: string | null;
}) {
  const license = await prisma.softwareLicense.create({
    data: {
      softwareName: data.softwareName.trim(),
      vendor: data.vendor?.trim(),
      licenseKey: data.licenseKey?.trim(),
      licenseType: data.licenseType,
      totalSeats: data.totalSeats,
      purchaseDate: new Date(data.purchaseDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      annualCost: data.annualCost !== undefined ? new Prisma.Decimal(data.annualCost) : undefined,
      notes: data.notes?.trim(),
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });

  logger.info(`Software license created: ${license.softwareName}`);
  return license;
}

async function updateSoftwareLicense(id: string, data: {
  vendor?: string;
  licenseKey?: string;
  totalSeats?: number;
  usedSeats?: number;
  expiryDate?: string;
  annualCost?: number;
  status?: string;
  notes?: string;
}, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.softwareLicense.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new IctError("Software license not found", 404);
  }
  return prisma.softwareLicense.update({
    where: { id },
    data: {
      ...(data.vendor !== undefined && { vendor: data.vendor?.trim() }),
      ...(data.licenseKey !== undefined && { licenseKey: data.licenseKey?.trim() }),
      ...(data.totalSeats !== undefined && { totalSeats: data.totalSeats }),
      ...(data.usedSeats !== undefined && { usedSeats: data.usedSeats }),
      ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate ? new Date(data.expiryDate) : null }),
      ...(data.annualCost !== undefined && { annualCost: new Prisma.Decimal(data.annualCost) }),
      ...(data.status && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() }),
    },
  });
}

async function deleteSoftwareLicense(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.softwareLicense.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new IctError("Software license not found", 404);
  }
  await prisma.softwareLicense.delete({ where: { id } });
  logger.info(`Software license deleted: ${id}`);
}

// ─── IT TICKETS ────────────────────────────────────────────

async function getItTickets(filters: {
  page: number;
  limit: number;
  skip: number;
  category?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
  search?: string;
  organizationId?: string;
}) {
  const where: Prisma.ItTicketWhereInput = {};
  if (filters.category) where.category = filters.category;
  if (filters.priority) where.priority = filters.priority;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.assignedTo) where.assignedTo = { contains: filters.assignedTo, mode: "insensitive" };
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { ticketNumber: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { reportedBy: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.itTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.itTicket.count({ where }),
  ]);

  return { tickets, total };
}

async function getItTicketById(id: string, organizationId?: string) {
  return prisma.itTicket.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
}

async function createItTicket(data: {
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  priority?: string;
  reportedBy: string;
  assignedTo?: string;
  organizationId?: string | null;
}) {
  const existing = await prisma.itTicket.findFirst({
    where: {
      ticketNumber: data.ticketNumber,
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });
  if (existing) throw new IctError("Ticket number already exists", 409);

  const ticket = await prisma.itTicket.create({
    data: {
      ticketNumber: data.ticketNumber.toUpperCase().trim(),
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category.trim(),
      priority: data.priority || "medium",
      reportedBy: data.reportedBy.trim(),
      assignedTo: data.assignedTo?.trim(),
      organizationId: data.organizationId ?? undefined,
    },
  });

  logger.info(`IT ticket created: ${ticket.ticketNumber} - ${ticket.title}`);
  return ticket;
}

async function updateItTicket(id: string, data: {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
  resolution?: string;
}, organizationId?: string) {
  const existing = await prisma.itTicket.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
  });
  if (!existing) throw new IctError("Ticket not found", 404);

  const isResolving = data.status && ["resolved", "closed"].includes(data.status) && !["resolved", "closed"].includes(existing.status);

  return prisma.itTicket.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title.trim() }),
      ...(data.description && { description: data.description.trim() }),
      ...(data.category && { category: data.category.trim() }),
      ...(data.priority && { priority: data.priority }),
      ...(data.status && { status: data.status }),
      ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo?.trim() }),
      ...(data.resolution !== undefined && { resolution: data.resolution?.trim() }),
      ...(isResolving && { resolvedAt: new Date() }),
    },
  });
}

async function deleteItTicket(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.itTicket.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new IctError("Ticket not found", 404);
  }
  await prisma.itTicket.delete({ where: { id } });
  logger.info(`IT ticket deleted: ${id}`);
}

async function getTicketStats(organizationId?: string) {
  const baseWhere: Prisma.ItTicketWhereInput = organizationId ? { organizationId } : {};
  const [total, byStatus, byPriority, byCategory, avgResolutionTime] = await Promise.all([
    prisma.itTicket.count({ where: baseWhere }),
    prisma.itTicket.groupBy({ by: ["status"], where: baseWhere, _count: true }),
    prisma.itTicket.groupBy({ by: ["priority"], where: baseWhere, _count: true }),
    prisma.itTicket.groupBy({ by: ["category"], where: baseWhere, _count: true, orderBy: { _count: { category: "desc" } } }),
    prisma.itTicket.findMany({
      where: { ...baseWhere, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    }),
  ]);

  let avgHours = 0;
  if (avgResolutionTime.length > 0) {
    const totalMs = avgResolutionTime.reduce((sum, t) => {
      if (t.resolvedAt) {
        return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
      }
      return sum;
    }, 0);
    avgHours = Math.round((totalMs / avgResolutionTime.length / (1000 * 60 * 60)) * 10) / 10;
  }

  return {
    total,
    open: byStatus.find((s) => s.status === "open")?._count || 0,
    inProgress: byStatus.find((s) => s.status === "in_progress")?._count || 0,
    resolved: byStatus.find((s) => s.status === "resolved")?._count || 0,
    avgResolutionHours: avgHours,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
    byCategory: byCategory.map((c) => ({ category: c.category, count: c._count })),
  };
}

async function getTicketSummary(organizationId?: string) {
  return getTicketStats(organizationId);
}

// ─── NETWORK DEVICES ───────────────────────────────────────

async function getNetworkDevices(filters: {
  page: number;
  limit: number;
  skip: number;
  type?: string;
  status?: string;
  search?: string;
  organizationId?: string;
}) {
  const where: Prisma.NetworkDeviceWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { ipAddress: { contains: filters.search, mode: "insensitive" } },
      { location: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [devices, total] = await Promise.all([
    prisma.networkDevice.findMany({
      where,
      orderBy: { name: "asc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.networkDevice.count({ where }),
  ]);

  return { devices, total };
}

async function getNetworkDeviceById(id: string, organizationId?: string) {
  return prisma.networkDevice.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
    include: {
      healthLogs: {
        take: 50,
        orderBy: { recordedAt: "desc" },
      },
    },
  });
}

async function createNetworkDevice(data: {
  name: string;
  type: string;
  ipAddress?: string;
  macAddress?: string;
  location?: string;
  manufacturer?: string;
  firmware?: string;
  organizationId?: string | null;
}) {
  const device = await prisma.networkDevice.create({
    data: {
      name: data.name.trim(),
      type: data.type.trim(),
      ipAddress: data.ipAddress?.trim(),
      macAddress: data.macAddress?.trim(),
      location: data.location?.trim(),
      manufacturer: data.manufacturer?.trim(),
      firmware: data.firmware?.trim(),
      lastSeen: new Date(),
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
  });

  logger.info(`Network device created: ${device.name}`);
  return device;
}

async function updateNetworkDevice(id: string, data: {
  name?: string;
  type?: string;
  ipAddress?: string;
  macAddress?: string;
  location?: string;
  status?: string;
  firmware?: string;
}, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.networkDevice.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new IctError("Network device not found", 404);
  }
  return prisma.networkDevice.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.type && { type: data.type.trim() }),
      ...(data.ipAddress !== undefined && { ipAddress: data.ipAddress?.trim() }),
      ...(data.macAddress !== undefined && { macAddress: data.macAddress?.trim() }),
      ...(data.location !== undefined && { location: data.location?.trim() }),
      ...(data.status && { status: data.status }),
      ...(data.firmware !== undefined && { firmware: data.firmware?.trim() }),
    },
  });
}

async function deleteNetworkDevice(id: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.networkDevice.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new IctError("Network device not found", 404);
  }
  await prisma.systemHealthLog.deleteMany({ where: { deviceId: id } });
  await prisma.networkDevice.delete({ where: { id } });
  logger.info(`Network device deleted: ${id}`);
}

// ─── SYSTEM HEALTH LOGS ────────────────────────────────────

async function getSystemHealthLogs(filters: {
  page: number;
  limit: number;
  skip: number;
  deviceId?: string;
  metricName?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  organizationId?: string;
}) {
  const where: Prisma.SystemHealthLogWhereInput = {};
  if (filters.deviceId) where.deviceId = filters.deviceId;
  if (filters.metricName) where.metricName = filters.metricName;
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.device = { organizationId: filters.organizationId };
  if (filters.startDate || filters.endDate) {
    where.recordedAt = {};
    if (filters.startDate) where.recordedAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.recordedAt.lte = new Date(filters.endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.systemHealthLog.findMany({
      where,
      include: { device: { select: { id: true, name: true, type: true } } },
      orderBy: { recordedAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.systemHealthLog.count({ where }),
  ]);

  return { logs, total };
}

async function createSystemHealthLog(data: {
  deviceId?: string;
  metricName: string;
  metricValue: number;
  unit?: string;
  status?: string;
  organizationId?: string;
}) {
  // Verify device ownership if scope is supplied
  if (data.deviceId && data.organizationId) {
    const device = await prisma.networkDevice.findFirst({
      where: { id: data.deviceId, organizationId: data.organizationId },
      select: { id: true },
    });
    if (!device) throw new IctError("Network device not found", 404);
  }

  const log = await prisma.systemHealthLog.create({
    data: {
      deviceId: data.deviceId,
      metricName: data.metricName.trim(),
      metricValue: new Prisma.Decimal(data.metricValue),
      unit: data.unit?.trim(),
      status: data.status || "normal",
    },
    include: { device: { select: { id: true, name: true } } },
  });

  if (data.deviceId) {
    await prisma.networkDevice.update({
      where: { id: data.deviceId },
      data: { lastSeen: new Date() },
    });
  }

  return log;
}

export class IctError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "IctError";
    this.statusCode = statusCode;
  }
}

const ictService = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetStats,
  getSoftwareLicenses,
  getSoftwareLicenseById,
  createSoftwareLicense,
  updateSoftwareLicense,
  deleteSoftwareLicense,
  getItTickets,
  getItTicketById,
  createItTicket,
  updateItTicket,
  deleteItTicket,
  getTicketStats,
  getTicketSummary,
  getNetworkDevices,
  getNetworkDeviceById,
  createNetworkDevice,
  updateNetworkDevice,
  deleteNetworkDevice,
  getSystemHealthLogs,
  createSystemHealthLog,
};

export default ictService;
