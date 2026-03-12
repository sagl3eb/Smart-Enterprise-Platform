import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import logger from "../utils/logger";

// ─── ATTRITION PREDICTIONS ─────────────────────────────────

async function getAttritionPredictions(filters: {
  page: number;
  limit: number;
  skip: number;
  departmentId?: string;
  riskLevel?: string;
  employeeId?: string;
}) {
  const where: Prisma.AttritionPredictionWhereInput = {};
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.riskLevel) where.riskLevel = filters.riskLevel;
  if (filters.employeeId) where.employeeId = filters.employeeId;

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

async function getAttritionSummary() {
  const predictions = await prisma.attritionPrediction.findMany({
    include: {
      department: { select: { id: true, name: true } },
    },
  });

  const totalEmployees = await prisma.employee.count({ where: { status: "active" } });

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
}) {
  return prisma.attritionPrediction.create({
    data: {
      employeeId: data.employeeId,
      departmentId: data.departmentId,
      riskScore: new Prisma.Decimal(data.riskScore),
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
  }>
) {
  // Clear old predictions
  await prisma.attritionPrediction.deleteMany({});

  const results = [];
  for (const pred of predictions) {
    const result = await createAttritionPrediction(pred);
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
}) {
  const where: Prisma.WorkforceSnapshotWhereInput = {};
  if (filters.departmentId) where.departmentId = filters.departmentId;
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
}) {
  return prisma.workforceSnapshot.upsert({
    where: {
      departmentId_snapshotDate: {
        departmentId: data.departmentId,
        snapshotDate: new Date(data.snapshotDate),
      },
    },
    update: {
      headcount: data.headcount,
      avgSatisfaction: data.avgSatisfaction !== undefined ? new Prisma.Decimal(data.avgSatisfaction) : undefined,
      avgPerformance: data.avgPerformance !== undefined ? new Prisma.Decimal(data.avgPerformance) : undefined,
      turnoverRate: data.turnoverRate !== undefined ? new Prisma.Decimal(data.turnoverRate) : undefined,
      avgTenure: data.avgTenure !== undefined ? new Prisma.Decimal(data.avgTenure) : undefined,
      overtimeHours: data.overtimeHours !== undefined ? new Prisma.Decimal(data.overtimeHours) : undefined,
      openPositions: data.openPositions,
    },
    create: {
      departmentId: data.departmentId,
      snapshotDate: new Date(data.snapshotDate),
      headcount: data.headcount,
      avgSatisfaction: data.avgSatisfaction !== undefined ? new Prisma.Decimal(data.avgSatisfaction) : undefined,
      avgPerformance: data.avgPerformance !== undefined ? new Prisma.Decimal(data.avgPerformance) : undefined,
      turnoverRate: data.turnoverRate !== undefined ? new Prisma.Decimal(data.turnoverRate) : undefined,
      avgTenure: data.avgTenure !== undefined ? new Prisma.Decimal(data.avgTenure) : undefined,
      overtimeHours: data.overtimeHours !== undefined ? new Prisma.Decimal(data.overtimeHours) : undefined,
      openPositions: data.openPositions,
    },
    include: { department: { select: { id: true, name: true } } },
  });
}

async function getSatisfactionTrends(months: number = 12) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const snapshots = await prisma.workforceSnapshot.findMany({
    where: { snapshotDate: { gte: startDate } },
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

async function getDepartmentComparison() {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
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
}) {
  const where: Prisma.WorkforceSurveyWhereInput = {};
  if (filters.status) where.status = filters.status;

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

async function getSurveyById(id: string) {
  return prisma.workforceSurvey.findUnique({
    where: { id },
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
}) {
  const survey = await prisma.workforceSurvey.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim(),
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      createdBy: data.createdBy,
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

async function updateSurveyStatus(id: string, status: string) {
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
}) {
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

async function getSurveyResults(surveyId: string) {
  const survey = await prisma.workforceSurvey.findUnique({
    where: { id: surveyId },
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
