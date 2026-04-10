import prisma from "./client";
import bcrypt from "bcrypt";
import { chatbotIntents } from "./chatbot-intents-seed";
import {
  departments, employees, leaveRequests, budgetCategories, annualBudgets,
  generateTransactions, generateInvoices, generateAssets, generateTickets,
  projects, alerts, surveys, kpiDefinitions, kpiSnapshots, chartOfAccounts,
} from "./seed-data";

const SALT_ROUNDS = 12;

const ALL_MODULES = [
  "dashboard", "hr", "finance", "accounting", "ict",
  "construction", "workforce", "predictive", "alerts",
];

async function main() {
  console.log("Seeding database...\n");

  // ── Roles ────────────────────────────────────────────────
  const roles = [
    { name: "super_admin", description: "Platform super administrator", permissions: { all: true, manage_orgs: true } },
    { name: "admin", description: "Organization administrator", permissions: { all: true } },
    { name: "manager", description: "Department manager with elevated access", permissions: { read: true, write: true, approve: true } },
    { name: "employee", description: "Regular employee with standard access", permissions: { read: true, write_own: true } },
    { name: "viewer", description: "Read-only access for stakeholders", permissions: { read: true } },
  ];

  const createdRoles: Record<string, string> = {};
  for (const role of roles) {
    const u = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, permissions: role.permissions },
      create: role,
    });
    createdRoles[role.name] = u.id;
  }
  console.log(`  ${roles.length} roles seeded`);

  // ── Organization ─────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Organization", slug: "default", description: "Default organization for the platform" },
  });
  for (const moduleName of ALL_MODULES) {
    await prisma.orgModule.upsert({
      where: { organizationId_moduleName: { organizationId: org.id, moduleName } },
      update: { isEnabled: true },
      create: { organizationId: org.id, moduleName, isEnabled: true },
    });
  }
  console.log(`  Organization + ${ALL_MODULES.length} modules`);

  // ── Admin User ───────────────────────────────────────────
  const adminEmail = "admin@sep.com";
  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    const hash = await bcrypt.hash("admin123456", SALT_ROUNDS);
    adminUser = await prisma.user.create({
      data: { email: adminEmail, passwordHash: hash, firstName: "System", lastName: "Admin", roleId: createdRoles["admin"], organizationId: org.id, isActive: true },
    });
    for (const moduleName of ALL_MODULES) {
      await prisma.userModuleAccess.upsert({
        where: { userId_moduleName: { userId: adminUser.id, moduleName } },
        update: { hasAccess: true },
        create: { userId: adminUser.id, moduleName, hasAccess: true },
      });
    }
    console.log(`  Admin user created: ${adminEmail} / admin123456`);
  } else {
    console.log(`  Admin user exists: ${adminEmail}`);
  }

  // ── Leave Types ──────────────────────────────────────────
  const leaveTypes = [
    { name: "Annual Leave", defaultDays: 21, isPaid: true, requiresApproval: true, description: "Standard annual vacation leave" },
    { name: "Sick Leave", defaultDays: 14, isPaid: true, requiresApproval: false, description: "Leave for medical reasons" },
    { name: "Personal Leave", defaultDays: 5, isPaid: true, requiresApproval: true, description: "Leave for personal matters" },
    { name: "Maternity Leave", defaultDays: 90, isPaid: true, requiresApproval: true, description: "Leave for maternity" },
    { name: "Paternity Leave", defaultDays: 14, isPaid: true, requiresApproval: true, description: "Leave for paternity" },
    { name: "Unpaid Leave", defaultDays: 0, isPaid: false, requiresApproval: true, description: "Leave without pay" },
  ];
  const leaveTypeMap: Record<string, string> = {};
  for (const lt of leaveTypes) {
    const u = await prisma.leaveType.upsert({ where: { name: lt.name }, update: {}, create: lt });
    leaveTypeMap[lt.name] = u.id;
  }
  console.log(`  ${leaveTypes.length} leave types`);

  // ── Chatbot Intents ──────────────────────────────────────
  for (const intent of chatbotIntents) {
    await prisma.chatbotIntent.upsert({
      where: { intentName: intent.intentName },
      update: { patterns: intent.patterns, responseType: intent.responseType, responseData: intent.responseData, priority: intent.priority, isActive: intent.isActive },
      create: { intentName: intent.intentName, patterns: intent.patterns, responseType: intent.responseType, responseData: intent.responseData, priority: intent.priority, isActive: intent.isActive },
    });
  }
  console.log(`  ${chatbotIntents.length} chatbot intents`);

  // ════════════════════════════════════════════════════════════
  //  COMPREHENSIVE DATA SEED
  // ════════════════════════════════════════════════════════════

  // ── 1a. Departments ──────────────────────────────────────
  const deptMap: Record<string, string> = {};
  for (const dept of departments) {
    const d = await prisma.department.upsert({
      where: { code: dept.code },
      update: { description: dept.description },
      create: { name: dept.name, code: dept.code, description: dept.description },
    });
    deptMap[dept.code] = d.id;
  }
  console.log(`  ${departments.length} departments`);

  // ── 1b. Employees ────────────────────────────────────────
  const employeeIds: string[] = [];
  const employeeNames: string[] = [];
  let empCounter = 1;

  for (const emp of employees) {
    const code = `EMP-${String(empCounter++).padStart(4, "0")}`;
    const email = `${emp.firstName.toLowerCase().replace(/\s+/g, "")}.${emp.lastName.toLowerCase().replace(/\s+/g, "")}@sep.com`;
    const deptId = deptMap[emp.department];
    if (!deptId) continue;

    const hireDate = new Date();
    hireDate.setDate(hireDate.getDate() - emp.hireDaysAgo);

    try {
      const e = await prisma.employee.upsert({
        where: { employeeCode: code },
        update: {},
        create: {
          employeeCode: code,
          departmentId: deptId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email,
          position: emp.position,
          hireDate,
          salary: emp.salary,
          employmentType: emp.employmentType,
          status: emp.status,
        },
      });
      employeeIds.push(e.id);
      employeeNames.push(`${emp.firstName} ${emp.lastName}`);
    } catch {
      // Skip duplicate emails
      const existing = await prisma.employee.findFirst({ where: { firstName: emp.firstName, lastName: emp.lastName } });
      if (existing) {
        employeeIds.push(existing.id);
        employeeNames.push(`${emp.firstName} ${emp.lastName}`);
      }
    }
  }
  console.log(`  ${employeeIds.length} employees`);

  // Assign department managers (first employee in each department)
  const deptDirectors: Record<string, string> = {};
  for (const emp of employees) {
    if (emp.position.includes("Director") && !deptDirectors[emp.department]) {
      const idx = employees.indexOf(emp);
      if (employeeIds[idx]) deptDirectors[emp.department] = employeeIds[idx];
    }
  }
  for (const [code, empId] of Object.entries(deptDirectors)) {
    if (deptMap[code]) {
      await prisma.department.update({ where: { id: deptMap[code] }, data: { managerId: empId } });
    }
  }

  // ── 1c. Leave Requests ───────────────────────────────────
  let leaveCount = 0;
  for (const lr of leaveRequests) {
    if (!employeeIds[lr.employeeIndex]) continue;
    const ltId = leaveTypeMap[lr.leaveType];
    if (!ltId) continue;

    const start = new Date();
    start.setDate(start.getDate() - lr.startDaysAgo);
    const end = new Date(start);
    end.setDate(end.getDate() + lr.totalDays);

    try {
      await prisma.leaveRequest.create({
        data: {
          employeeId: employeeIds[lr.employeeIndex],
          leaveTypeId: ltId,
          startDate: start,
          endDate: end,
          totalDays: lr.totalDays,
          reason: lr.reason,
          status: lr.status,
          approvedAt: lr.status === "approved" ? new Date() : undefined,
        },
      });
      leaveCount++;
    } catch { /* skip duplicates */ }
  }
  console.log(`  ${leaveCount} leave requests`);

  // ── 1d. Budget Categories & Annual Budgets ───────────────
  const budCatMap: Record<string, string> = {};
  for (const bc of budgetCategories) {
    const u = await prisma.budgetCategory.upsert({
      where: { code: bc.code },
      update: {},
      create: bc,
    });
    budCatMap[bc.code] = u.id;
  }
  for (const ab of annualBudgets) {
    const catId = budCatMap[ab.categoryCode];
    if (!catId) continue;
    const remaining = ab.allocated - ab.spent;
    await prisma.annualBudget.upsert({
      where: { categoryId_fiscalYear: { categoryId: catId, fiscalYear: 2025 } },
      update: { spentAmount: ab.spent, remainingAmount: remaining },
      create: { categoryId: catId, fiscalYear: 2025, allocatedAmount: ab.allocated, spentAmount: ab.spent, remainingAmount: remaining, status: ab.status },
    });
  }
  console.log(`  ${budgetCategories.length} budget categories + ${annualBudgets.length} annual budgets`);

  // ── Cost Centers (link to departments) ───────────────────
  const costCenterMap: Record<string, string> = {};
  const ccData = [
    { name: "Sales Operations", code: "CC-SALES", dept: "SALES" },
    { name: "R&D Lab", code: "CC-RND", dept: "RND" },
    { name: "HR Services", code: "CC-HR", dept: "HR" },
    { name: "Finance Operations", code: "CC-FIN", dept: "FIN" },
    { name: "IT Infrastructure", code: "CC-IT", dept: "IT" },
    { name: "General Operations", code: "CC-OPS", dept: "OPS" },
    { name: "Marketing Campaigns", code: "CC-MKT", dept: "MKT" },
    { name: "Legal Services", code: "CC-LEGAL", dept: "LEGAL" },
  ];
  for (const cc of ccData) {
    const u = await prisma.costCenter.upsert({
      where: { code: cc.code },
      update: {},
      create: { name: cc.name, code: cc.code, departmentId: deptMap[cc.dept] || undefined, budgetLimit: 200000 },
    });
    costCenterMap[cc.code] = u.id;
  }
  console.log(`  ${ccData.length} cost centers`);

  // ── 1e. Transactions ─────────────────────────────────────
  const txns = generateTransactions();
  const ccIds = Object.values(costCenterMap);
  let txnCount = 0;
  for (const txn of txns) {
    try {
      await prisma.transaction.create({
        data: {
          type: txn.type,
          category: txn.category,
          amount: txn.amount,
          description: txn.description,
          reference: txn.reference,
          costCenterId: ccIds[txnCount % ccIds.length],
          transactionDate: txn.transactionDate,
          status: txn.status,
        },
      });
      txnCount++;
    } catch { /* skip duplicates */ }
  }
  console.log(`  ${txnCount} transactions`);

  // ── 1f. Chart of Accounts ────────────────────────────────
  for (const acct of chartOfAccounts) {
    await prisma.chartOfAccount.upsert({
      where: { accountCode: acct.accountCode },
      update: { balance: acct.balance },
      create: { accountCode: acct.accountCode, name: acct.name, type: acct.type, balance: acct.balance },
    });
  }
  console.log(`  ${chartOfAccounts.length} chart of accounts`);

  // ── 1f. Invoices ─────────────────────────────────────────
  const invoices = generateInvoices();
  let invCount = 0;
  for (const inv of invoices) {
    try {
      await prisma.invoice.upsert({
        where: { invoiceNumber: inv.invoiceNumber },
        update: {},
        create: {
          invoiceNumber: inv.invoiceNumber,
          type: inv.type,
          clientName: inv.clientName,
          clientEmail: inv.clientEmail,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          subtotal: inv.subtotal,
          taxAmount: inv.taxAmount,
          totalAmount: inv.totalAmount,
          paidAmount: inv.paidAmount,
          status: inv.status,
          notes: inv.notes,
        },
      });
      invCount++;
    } catch { /* skip */ }
  }
  console.log(`  ${invCount} invoices`);

  // ── 1g. Assets ───────────────────────────────────────────
  const assetList = generateAssets(employeeNames);
  let assetCount = 0;
  for (const a of assetList) {
    try {
      await prisma.asset.upsert({
        where: { assetTag: a.assetTag },
        update: {},
        create: {
          assetTag: a.assetTag,
          name: a.name,
          category: a.category,
          manufacturer: a.manufacturer,
          model: a.model,
          serialNumber: a.serialNumber,
          purchaseDate: a.purchaseDate,
          purchasePrice: a.purchasePrice,
          warrantyExpiry: a.warrantyExpiry,
          status: a.status,
          assignedTo: a.assignedTo,
          location: a.location,
        },
      });
      assetCount++;
    } catch { /* skip */ }
  }
  console.log(`  ${assetCount} assets`);

  // ── 1h. IT Tickets ───────────────────────────────────────
  // IT staff names for assignment
  const itStaffNames = employees
    .filter((e) => e.department === "IT")
    .map((e) => `${e.firstName} ${e.lastName}`);

  const tickets = generateTickets(employeeNames, itStaffNames);
  let ticketCount = 0;
  for (const t of tickets) {
    try {
      await prisma.itTicket.upsert({
        where: { ticketNumber: t.ticketNumber },
        update: {},
        create: {
          ticketNumber: t.ticketNumber,
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          status: t.status,
          reportedBy: t.reportedBy,
          assignedTo: t.assignedTo,
          resolution: t.resolution,
          resolvedAt: t.resolvedAt,
        },
      });
      ticketCount++;
    } catch { /* skip */ }
  }
  console.log(`  ${ticketCount} IT tickets`);

  // ── 1i. Projects + Milestones ────────────────────────────
  let projCount = 0;
  for (const p of projects) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - p.startDaysAgo);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + p.endDaysFromNow);

    try {
      const proj = await prisma.project.upsert({
        where: { code: p.code },
        update: { progress: p.progress, status: p.status, actualBudget: p.actualBudget },
        create: {
          name: p.name,
          code: p.code,
          description: p.description,
          clientName: p.clientName,
          startDate,
          endDate,
          estimatedBudget: p.budget,
          actualBudget: p.actualBudget,
          status: p.status,
          progress: p.progress,
          location: p.location,
        },
      });

      // Add milestones
      const milestones = ["Requirements & Planning", "Design & Procurement", "Implementation", "Testing & QA", "Handover & Closeout"];
      for (let i = 0; i < milestones.length; i++) {
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + Math.floor(((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * ((i + 1) / milestones.length)));
        const msStatus = p.progress >= ((i + 1) / milestones.length) * 100 ? "completed" : p.progress >= (i / milestones.length) * 100 ? "in_progress" : "pending";
        try {
          await prisma.projectMilestone.create({
            data: {
              projectId: proj.id,
              name: milestones[i],
              dueDate,
              status: msStatus,
              sortOrder: i + 1,
              completedAt: msStatus === "completed" ? new Date() : undefined,
            },
          });
        } catch { /* skip */ }
      }
      projCount++;
    } catch { /* skip */ }
  }
  console.log(`  ${projCount} projects with milestones`);

  // ── 1j. Alerts ───────────────────────────────────────────
  let alertCount = 0;
  for (const a of alerts) {
    try {
      await prisma.alert.create({
        data: {
          title: a.title,
          message: a.message,
          severity: a.severity,
          module: a.module,
          isRead: a.isRead,
          isResolved: a.isRead,
        },
      });
      alertCount++;
    } catch { /* skip */ }
  }
  console.log(`  ${alertCount} alerts`);

  // ── 1k. Surveys ──────────────────────────────────────────
  let surveyCount = 0;
  for (const s of surveys) {
    try {
      const survey = await prisma.workforceSurvey.create({
        data: {
          title: s.title,
          description: s.description,
          status: s.status,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      for (let i = 0; i < s.questions.length; i++) {
        const q = s.questions[i];
        const question = await prisma.surveyQuestion.create({
          data: {
            surveyId: survey.id,
            questionText: q.text,
            type: q.type,
            options: q.options,
            sortOrder: i + 1,
          },
        });
        // Add some responses for completed surveys
        if (s.status === "completed" || s.status === "active") {
          const numResponses = Math.min(employeeIds.length, 15);
          for (let r = 0; r < numResponses; r++) {
            let answer: string;
            if (q.type === "rating") {
              const opts = q.options as number[];
              answer = String(opts[Math.floor(Math.random() * opts.length)]);
            } else if (q.type === "choice") {
              const opts = q.options as string[];
              answer = opts[Math.floor(Math.random() * opts.length)];
            } else {
              const freeText = ["Great workplace overall", "Need more flexible hours", "Better training programs please", "Happy with current setup", "Would like more team activities"];
              answer = freeText[r % freeText.length];
            }
            try {
              await prisma.surveyResponse.create({
                data: {
                  questionId: question.id,
                  respondentId: employeeIds[r],
                  answer,
                },
              });
            } catch { /* skip */ }
          }
        }
      }
      surveyCount++;
    } catch { /* skip */ }
  }
  console.log(`  ${surveyCount} surveys with questions & responses`);

  // ── 1l. KPI Definitions & Snapshots ──────────────────────
  for (const kpi of kpiDefinitions) {
    const def = await prisma.kpiDefinition.upsert({
      where: { name: kpi.name },
      update: {},
      create: { name: kpi.name, module: kpi.module, metric: kpi.metric, unit: kpi.unit, target: kpi.target, format: kpi.format },
    });

    const snap = kpiSnapshots.find((s) => s.name === kpi.name);
    if (snap) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.kpiSnapshot.upsert({
        where: { kpiId_snapshotDate: { kpiId: def.id, snapshotDate: today } },
        update: { value: snap.value, previousValue: snap.previous },
        create: { kpiId: def.id, value: snap.value, previousValue: snap.previous, snapshotDate: today },
      });
    }
  }
  console.log(`  ${kpiDefinitions.length} KPI definitions + snapshots`);

  // ── Workforce Snapshots ──────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const snapData = [
    { dept: "SALES", headcount: 8, satisfaction: 3.7, performance: 3.9, turnover: 5.0, tenure: 2.5, overtime: 120 },
    { dept: "RND", headcount: 8, satisfaction: 4.1, performance: 4.2, turnover: 3.0, tenure: 2.8, overtime: 180 },
    { dept: "HR", headcount: 6, satisfaction: 4.0, performance: 3.8, turnover: 2.0, tenure: 2.6, overtime: 40 },
    { dept: "FIN", headcount: 7, satisfaction: 3.6, performance: 3.7, turnover: 8.0, tenure: 2.4, overtime: 90 },
    { dept: "IT", headcount: 8, satisfaction: 3.9, performance: 4.0, turnover: 4.0, tenure: 2.3, overtime: 200 },
    { dept: "OPS", headcount: 7, satisfaction: 3.5, performance: 3.6, turnover: 6.0, tenure: 2.7, overtime: 150 },
    { dept: "MKT", headcount: 8, satisfaction: 3.8, performance: 3.9, turnover: 12.0, tenure: 2.1, overtime: 100 },
    { dept: "LEGAL", headcount: 5, satisfaction: 4.2, performance: 4.1, turnover: 10.0, tenure: 2.9, overtime: 60 },
  ];
  for (const s of snapData) {
    const deptId = deptMap[s.dept];
    if (!deptId) continue;
    await prisma.workforceSnapshot.upsert({
      where: { departmentId_snapshotDate: { departmentId: deptId, snapshotDate: today } },
      update: {},
      create: {
        departmentId: deptId,
        snapshotDate: today,
        headcount: s.headcount,
        avgSatisfaction: s.satisfaction,
        avgPerformance: s.performance,
        turnoverRate: s.turnover,
        avgTenure: s.tenure,
        overtimeHours: s.overtime,
        openPositions: Math.floor(Math.random() * 3),
      },
    });
  }
  console.log(`  ${snapData.length} workforce snapshots`);

  console.log("\n✅ Seed completed successfully!");
  console.log(`Default login: admin@sep.com / admin123456\n`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
