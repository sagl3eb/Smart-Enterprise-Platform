import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ─── ATTRITION PREDICTIONS ─────────────────────────────────

async function ensureAttritionPredictions(organizationId: string) {
  // If the org has employees but zero attrition predictions, generate a
  // deterministic baseline so the dashboard renders something useful before
  // anyone runs `train`. Real predictions overwrite these once the ML
  // service runs.
  const existing = await prisma.attritionPrediction.count({
    where: { employee: { organizationId } },
  });
  if (existing > 0) return;

  const employees = await prisma.employee.findMany({
    where: { organizationId, status: "active" },
    select: {
      id: true, departmentId: true, hireDate: true, salary: true,
    },
  });
  if (employees.length === 0) return;

  const now = Date.now();
  for (const e of employees) {
    const tenureYears = (now - new Date(e.hireDate).getTime()) / (365 * 86400000);
    const salary = Number(e.salary || 0);
    // Heuristic baseline: shorter tenure + lower salary → higher risk.
    let raw = 0.45 - (tenureYears * 0.05);
    if (salary > 0 && salary < 60000) raw += 0.15;
    if (salary >= 100000) raw -= 0.1;
    raw += (Math.sin((e.id.charCodeAt(0) || 0) * 0.7) + 1) * 0.05; // small spread
    const score = clamp(raw, 0.05, 0.92);
    const level = score >= 0.6 ? "high" : score >= 0.35 ? "medium" : "low";
    try {
      await prisma.attritionPrediction.create({
        data: {
          employeeId: e.id,
          departmentId: e.departmentId,
          riskScore: new Prisma.Decimal(score.toFixed(4)),
          riskLevel: level,
          modelVersion: "baseline-1.0",
          topFactors: { tenureYears: Number(tenureYears.toFixed(2)), salary } as Prisma.InputJsonValue,
          predictedAt: new Date(),
        },
      });
    } catch { /* unique constraint or race — ignore */ }
  }
}

async function getAttritionPredictions(filters: {
  page: number;
  limit: number;
  skip: number;
  departmentId?: string;
  riskLevel?: string;
  employeeId?: string;
  organizationId?: string;
}) {
  if (filters.organizationId) await ensureAttritionPredictions(filters.organizationId);

  const where: Prisma.AttritionPredictionWhereInput = {};
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.riskLevel) where.riskLevel = filters.riskLevel;
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.organizationId) where.employee = { organizationId: filters.organizationId };

  const [predictions, total] = await Promise.all([
    prisma.attritionPrediction.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeCode: true,
            position: true, hireDate: true, salary: true,
          },
        },
        department: { select: { id: true, name: true } },
      },
      orderBy: { riskScore: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.attritionPrediction.count({ where }),
  ]);

  return { predictions, total };
}

async function getAttritionSummary(organizationId?: string) {
  if (organizationId) await ensureAttritionPredictions(organizationId);
  const predictions = await prisma.attritionPrediction.findMany({
    where: organizationId ? { employee: { organizationId } } : undefined,
    include: {
      department: { select: { id: true, name: true } },
    },
  });

  const totalEmployees = await prisma.employee.count({
    where: { status: "active", ...(organizationId ? { organizationId } : {}) },
  });

  const highRisk = predictions.filter((p) => p.riskLevel === "high").length;
  const mediumRisk = predictions.filter((p) => p.riskLevel === "medium").length;
  const lowRisk = predictions.filter((p) => p.riskLevel === "low").length;

  const avgRiskScore = predictions.length > 0
    ? predictions.reduce((sum, p) => sum + Number(p.riskScore), 0) / predictions.length
    : 0;

  const byDepartment: Record<string, { high: number; medium: number; low: number; avg: number; total: number }> = {};
  predictions.forEach((p) => {
    const deptName = p.department.name;
    if (!byDepartment[deptName]) {
      byDepartment[deptName] = { high: 0, medium: 0, low: 0, avg: 0, total: 0 };
    }
    byDepartment[deptName][p.riskLevel as "high" | "medium" | "low"]++;
    byDepartment[deptName].avg += Number(p.riskScore);
    byDepartment[deptName].total++;
  });

  const departmentBreakdown = Object.entries(byDepartment).map(([name, data]) => ({
    department: name,
    high: data.high,
    medium: data.medium,
    low: data.low,
    avgRiskScore: Math.round((data.avg / data.total) * 10000) / 10000,
    total: data.total,
  }));

  const topFactors: Record<string, number> = {};
  predictions.forEach((p) => {
    const factors = p.topFactors as Array<{ factor: string; importance: number }>;
    if (Array.isArray(factors)) {
      factors.forEach((f) => {
        topFactors[f.factor] = (topFactors[f.factor] || 0) + f.importance;
      });
    }
  });

  const sortedFactors = Object.entries(topFactors)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([factor, totalImportance]) => ({ factor, totalImportance: Math.round(totalImportance * 100) / 100 }));

  return {
    totalEmployees,
    totalPredictions: predictions.length,
    highRisk,
    mediumRisk,
    lowRisk,
    avgRiskScore: Math.round(avgRiskScore * 10000) / 10000,
    departmentBreakdown,
    topFactors: sortedFactors,
  };
}

async function createAttritionPrediction(data: {
  employeeId: string;
  departmentId: string;
  riskScore: number;
  riskLevel: string;
  topFactors: Array<{ factor: string; importance: number }>;
  modelVersion?: string;
  organizationId?: string;
}) {
  if (data.organizationId) {
    const emp = await prisma.employee.findFirst({
      where: { id: data.employeeId, organizationId: data.organizationId },
      select: { id: true },
    });
    if (!emp) throw new WorkforceError("Employee not found", 404);
  }
  return prisma.attritionPrediction.create({
    data: {
      employeeId: data.employeeId,
      departmentId: data.departmentId,
      riskScore: new Prisma.Decimal(clamp(data.riskScore, 0, 9.9999)),
      riskLevel: data.riskLevel,
      topFactors: data.topFactors as unknown as Prisma.InputJsonValue,
      modelVersion: data.modelVersion,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      department: { select: { id: true, name: true } },
    },
  });
}

async function bulkCreateAttritionPredictions(
  predictions: Array<{
    employeeId: string;
    departmentId: string;
    riskScore: number;
    riskLevel: string;
    topFactors: Array<{ factor: string; importance: number }>;
    modelVersion?: string;
  }>,
  organizationId?: string
) {
  // Clear old predictions within scope
  if (organizationId) {
    await prisma.attritionPrediction.deleteMany({ where: { employee: { organizationId } } });
  } else {
    await prisma.attritionPrediction.deleteMany({});
  }

  const results = [];
  for (const pred of predictions) {
    const result = await createAttritionPrediction({ ...pred, organizationId });
    results.push(result);
  }

  logger.info(`Bulk attrition predictions created: ${results.length}`);
  return results;
}

// ─── WORKFORCE SNAPSHOTS ───────────────────────────────────

async function getWorkforceSnapshots(filters: {
  departmentId?: string;
  startDate?: string;
  endDate?: string;
  organizationId?: string;
}) {
  const where: Prisma.WorkforceSnapshotWhereInput = {};
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.organizationId) where.department = { organizationId: filters.organizationId };
  if (filters.startDate || filters.endDate) {
    where.snapshotDate = {};
    if (filters.startDate) where.snapshotDate.gte = new Date(filters.startDate);
    if (filters.endDate) where.snapshotDate.lte = new Date(filters.endDate);
  }

  return prisma.workforceSnapshot.findMany({
    where,
    include: { department: { select: { id: true, name: true } } },
    orderBy: [{ snapshotDate: "desc" }, { department: { name: "asc" } }],
  });
}

async function createWorkforceSnapshot(data: {
  departmentId: string;
  snapshotDate: string;
  headcount: number;
  avgSatisfaction?: number;
  avgPerformance?: number;
  turnoverRate?: number;
  avgTenure?: number;
  overtimeHours?: number;
  openPositions?: number;
  organizationId?: string;
}) {
  if (data.organizationId) {
    const dept = await prisma.department.findFirst({
      where: { id: data.departmentId, organizationId: data.organizationId },
      select: { id: true },
    });
    if (!dept) throw new WorkforceError("Department not found", 404);
  }
  return prisma.workforceSnapshot.upsert({
    where: {
      departmentId_snapshotDate: {
        departmentId: data.departmentId,
        snapshotDate: new Date(data.snapshotDate),
      },
    },
    update: {
      headcount: data.headcount,
      avgSatisfaction: data.avgSatisfaction !== undefined ? new Prisma.Decimal(clamp(data.avgSatisfaction, 0, 9.99)) : undefined,
      avgPerformance: data.avgPerformance !== undefined ? new Prisma.Decimal(clamp(data.avgPerformance, 0, 9.99)) : undefined,
      turnoverRate: data.turnoverRate !== undefined ? new Prisma.Decimal(clamp(data.turnoverRate, 0, 999.99)) : undefined,
      avgTenure: data.avgTenure !== undefined ? new Prisma.Decimal(clamp(data.avgTenure, 0, 9999.9)) : undefined,
      overtimeHours: data.overtimeHours !== undefined ? new Prisma.Decimal(clamp(data.overtimeHours, 0, 9999999.9)) : undefined,
      openPositions: data.openPositions,
    },
    create: {
      departmentId: data.departmentId,
      snapshotDate: new Date(data.snapshotDate),
      headcount: data.headcount,
      avgSatisfaction: data.avgSatisfaction !== undefined ? new Prisma.Decimal(clamp(data.avgSatisfaction, 0, 9.99)) : undefined,
      avgPerformance: data.avgPerformance !== undefined ? new Prisma.Decimal(clamp(data.avgPerformance, 0, 9.99)) : undefined,
      turnoverRate: data.turnoverRate !== undefined ? new Prisma.Decimal(clamp(data.turnoverRate, 0, 999.99)) : undefined,
      avgTenure: data.avgTenure !== undefined ? new Prisma.Decimal(clamp(data.avgTenure, 0, 9999.9)) : undefined,
      overtimeHours: data.overtimeHours !== undefined ? new Prisma.Decimal(clamp(data.overtimeHours, 0, 9999999.9)) : undefined,
      openPositions: data.openPositions,
    },
    include: { department: { select: { id: true, name: true } } },
  });
}

async function getSatisfactionTrends(months: number = 12, organizationId?: string) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const snapshots = await prisma.workforceSnapshot.findMany({
    where: {
      snapshotDate: { gte: startDate },
      ...(organizationId ? { department: { organizationId } } : {}),
    },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { snapshotDate: "asc" },
  });

  const byMonth: Record<string, { satisfaction: number[]; performance: number[]; turnover: number[] }> = {};
  snapshots.forEach((s) => {
    const monthKey = s.snapshotDate.toISOString().slice(0, 7);
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { satisfaction: [], performance: [], turnover: [] };
    }
    if (s.avgSatisfaction) byMonth[monthKey].satisfaction.push(Number(s.avgSatisfaction));
    if (s.avgPerformance) byMonth[monthKey].performance.push(Number(s.avgPerformance));
    if (s.turnoverRate) byMonth[monthKey].turnover.push(Number(s.turnoverRate));
  });

  const trends = Object.entries(byMonth).map(([month, data]) => ({
    month,
    avgSatisfaction: data.satisfaction.length > 0
      ? Math.round((data.satisfaction.reduce((a, b) => a + b, 0) / data.satisfaction.length) * 100) / 100
      : null,
    avgPerformance: data.performance.length > 0
      ? Math.round((data.performance.reduce((a, b) => a + b, 0) / data.performance.length) * 100) / 100
      : null,
    avgTurnover: data.turnover.length > 0
      ? Math.round((data.turnover.reduce((a, b) => a + b, 0) / data.turnover.length) * 100) / 100
      : null,
  }));

  return trends;
}

async function getDepartmentComparison(organizationId?: string) {
  const departments = await prisma.department.findMany({
    where: { isActive: true, ...(organizationId ? { organizationId } : {}) },
    select: { id: true, name: true },
  });

  const comparisons = [];
  for (const dept of departments) {
    const latestSnapshot = await prisma.workforceSnapshot.findFirst({
      where: { departmentId: dept.id },
      orderBy: { snapshotDate: "desc" },
    });

    const employeeCount = await prisma.employee.count({
      where: { departmentId: dept.id, status: "active" },
    });

    const attritionStats = await prisma.attritionPrediction.aggregate({
      where: { departmentId: dept.id },
      _avg: { riskScore: true },
      _count: true,
    });

    const highRiskCount = await prisma.attritionPrediction.count({
      where: { departmentId: dept.id, riskLevel: "high" },
    });

    comparisons.push({
      department: dept.name,
      departmentId: dept.id,
      headcount: employeeCount,
      avgSatisfaction: latestSnapshot ? Number(latestSnapshot.avgSatisfaction || 0) : 0,
      avgPerformance: latestSnapshot ? Number(latestSnapshot.avgPerformance || 0) : 0,
      turnoverRate: latestSnapshot ? Number(latestSnapshot.turnoverRate || 0) : 0,
      avgAttritionRisk: Number(attritionStats._avg.riskScore || 0),
      highRiskEmployees: highRiskCount,
      overtimeHours: latestSnapshot ? Number(latestSnapshot.overtimeHours || 0) : 0,
    });
  }

  return comparisons;
}

// ─── SURVEYS ───────────────────────────────────────────────

async function getSurveys(filters: {
  page: number;
  limit: number;
  skip: number;
  status?: string;
  organizationId?: string;
}) {
  const where: Prisma.WorkforceSurveyWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.organizationId) where.organizationId = filters.organizationId;

  const [surveys, total] = await Promise.all([
    prisma.workforceSurvey.findMany({
      where,
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.limit,
    }),
    prisma.workforceSurvey.count({ where }),
  ]);

  return { surveys, total };
}

async function getSurveyById(id: string, organizationId?: string) {
  return prisma.workforceSurvey.findFirst({
    where: { id, ...(organizationId ? { organizationId } : {}) },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          responses: true,
          _count: { select: { responses: true } },
        },
      },
    },
  });
}

async function createSurvey(data: {
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  questions: Array<{
    questionText: string;
    type: string;
    options?: string[];
    isRequired?: boolean;
    sortOrder?: number;
  }>;
  organizationId?: string | null;
}) {
  const survey = await prisma.workforceSurvey.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim(),
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      createdBy: data.createdBy,
      organizationId: data.organizationId ?? undefined,
      questions: {
        create: data.questions.map((q, index) => ({
          questionText: q.questionText.trim(),
          type: q.type,
          options: q.options as Prisma.InputJsonValue,
          isRequired: q.isRequired !== undefined ? q.isRequired : true,
          sortOrder: q.sortOrder !== undefined ? q.sortOrder : index,
        })),
      },
    },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });

  logger.info(`Survey created: ${survey.title}`);
  return survey;
}

async function updateSurveyStatus(id: string, status: string, organizationId?: string) {
  if (organizationId) {
    const owned = await prisma.workforceSurvey.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) throw new WorkforceError("Survey not found", 404);
  }
  return prisma.workforceSurvey.update({
    where: { id },
    data: { status },
  });
}

async function submitSurveyResponse(data: {
  responses: Array<{
    questionId: string;
    answer: string;
  }>;
  respondentId?: string;
  organizationId?: string;
}) {
  if (data.organizationId && data.responses.length > 0) {
    const questionIds = data.responses.map((r) => r.questionId);
    const validQuestions = await prisma.surveyQuestion.findMany({
      where: {
        id: { in: questionIds },
        survey: { organizationId: data.organizationId },
      },
      select: { id: true },
    });
    if (validQuestions.length !== new Set(questionIds).size) {
      throw new WorkforceError("One or more questions not found", 404);
    }
  }

  const results = [];
  for (const response of data.responses) {
    const result = await prisma.surveyResponse.create({
      data: {
        questionId: response.questionId,
        answer: response.answer,
        respondentId: data.respondentId,
      },
    });
    results.push(result);
  }

  logger.info(`Survey response submitted: ${data.responses.length} answers`);
  return results;
}

async function getSurveyResults(surveyId: string, organizationId?: string) {
  const survey = await prisma.workforceSurvey.findFirst({
    where: { id: surveyId, ...(organizationId ? { organizationId } : {}) },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { responses: true },
      },
    },
  });

  if (!survey) throw new WorkforceError("Survey not found", 404);

  const results = survey.questions.map((q) => {
    const responseCount = q.responses.length;
    const answers = q.responses.map((r) => r.answer);

    if (q.type === "rating" || q.type === "scale") {
      const numericAnswers = answers.map(Number).filter((n) => !isNaN(n));
      const avg = numericAnswers.length > 0
        ? numericAnswers.reduce((a, b) => a + b, 0) / numericAnswers.length
        : 0;
      return {
        questionId: q.id,
        questionText: q.questionText,
        type: q.type,
        responseCount,
        average: Math.round(avg * 100) / 100,
        distribution: numericAnswers.reduce((acc: Record<string, number>, val) => {
          acc[val.toString()] = (acc[val.toString()] || 0) + 1;
          return acc;
        }, {}),
      };
    }

    if (q.type === "multiple_choice") {
      const distribution: Record<string, number> = {};
      answers.forEach((a) => { distribution[a] = (distribution[a] || 0) + 1; });
      return {
        questionId: q.id,
        questionText: q.questionText,
        type: q.type,
        responseCount,
        distribution,
      };
    }

    return {
      questionId: q.id,
      questionText: q.questionText,
      type: q.type,
      responseCount,
      answers: answers.slice(0, 50),
    };
  });

  const uniqueRespondents = new Set(
    survey.questions.flatMap((q) => q.responses.map((r) => r.respondentId)).filter(Boolean)
  ).size;

  return {
    surveyId: survey.id,
    title: survey.title,
    totalRespondents: uniqueRespondents,
    questions: results,
  };
}

export class WorkforceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "WorkforceError";
    this.statusCode = statusCode;
  }
}

const workforceService = {
  getAttritionPredictions, getAttritionSummary,
  createAttritionPrediction, bulkCreateAttritionPredictions,
  getWorkforceSnapshots, createWorkforceSnapshot,
  getSatisfactionTrends, getDepartmentComparison,
  getSurveys, getSurveyById, createSurvey, updateSurveyStatus,
  submitSurveyResponse, getSurveyResults,
};

export default workforceService;
