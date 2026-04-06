import prisma from "./client";
import bcrypt from "bcrypt";
import { chatbotIntents } from "./chatbot-intents-seed";

const SALT_ROUNDS = 12;

const ALL_MODULES = [
  "dashboard",
  "hr",
  "finance",
  "accounting",
  "ict",
  "construction",
  "workforce",
  "predictive",
  "alerts",
];

async function main() {
  console.log("Seeding database...");

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
    const upserted = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, permissions: role.permissions },
      create: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      },
    });
    createdRoles[role.name] = upserted.id;
    console.log(`  Role: ${role.name} (${upserted.id})`);
  }

  // ── Default Organization ─────────────────────────────────
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default",
      description: "Default organization for the platform",
    },
  });
  console.log(`  Organization: ${defaultOrg.name} (${defaultOrg.id})`);

  // ── Enable all modules for default org ───────────────────
  for (const moduleName of ALL_MODULES) {
    await prisma.orgModule.upsert({
      where: {
        organizationId_moduleName: {
          organizationId: defaultOrg.id,
          moduleName,
        },
      },
      update: { isEnabled: true },
      create: {
        organizationId: defaultOrg.id,
        moduleName,
        isEnabled: true,
      },
    });
  }
  console.log(`  Enabled ${ALL_MODULES.length} modules for default org`);

  // ── Default Admin User ───────────────────────────────────
  const adminEmail = "admin@sep.com";
  const adminPassword = "admin123456";

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: "System",
        lastName: "Admin",
        roleId: createdRoles["admin"],
        organizationId: defaultOrg.id,
        isActive: true,
      },
    });

    // Give admin access to all modules
    for (const moduleName of ALL_MODULES) {
      await prisma.userModuleAccess.upsert({
        where: {
          userId_moduleName: {
            userId: adminUser.id,
            moduleName,
          },
        },
        update: { hasAccess: true },
        create: {
          userId: adminUser.id,
          moduleName,
          hasAccess: true,
        },
      });
    }

    console.log(`  Admin user created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`  Admin user already exists: ${adminEmail}`);
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

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { name: lt.name },
      update: {},
      create: lt,
    });
  }
  console.log(`  ${leaveTypes.length} leave types seeded`);

  // ── Chatbot Intents ───────────────────────────────────────
  for (const intent of chatbotIntents) {
    await prisma.chatbotIntent.upsert({
      where: { intentName: intent.intentName },
      update: {
        patterns: intent.patterns,
        responseType: intent.responseType,
        responseData: intent.responseData,
        priority: intent.priority,
        isActive: intent.isActive,
      },
      create: {
        intentName: intent.intentName,
        patterns: intent.patterns,
        responseType: intent.responseType,
        responseData: intent.responseData,
        priority: intent.priority,
        isActive: intent.isActive,
      },
    });
  }
  console.log(`  ${chatbotIntents.length} chatbot intents seeded`);

  console.log("\nSeed completed successfully!");
  console.log(`\nDefault login: ${adminEmail} / admin123456`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
