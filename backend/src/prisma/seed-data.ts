// SEP — Comprehensive Seed Data
// All arrays used by seed.ts to populate every module with realistic data.

// ─── Helpers ──────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min: number, max: number, decimals = 2): number {
  return +(Math.random() * (max - min) + min).toFixed(decimals);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── 1a. Departments ──────────────────────────────────────────

export const departments = [
  { name: "Sales", code: "SALES", description: "Revenue generation through direct and channel sales" },
  { name: "Research & Development", code: "RND", description: "Product innovation, prototyping, and technical research" },
  { name: "Human Resources", code: "HR", description: "Talent acquisition, employee relations, and workforce management" },
  { name: "Finance", code: "FIN", description: "Financial planning, budgeting, and fiscal reporting" },
  { name: "Information Technology", code: "IT", description: "IT infrastructure, systems administration, and technical support" },
  { name: "Operations", code: "OPS", description: "Business operations, logistics, and process optimization" },
  { name: "Marketing", code: "MKT", description: "Brand management, digital marketing, and market analysis" },
  { name: "Legal", code: "LEGAL", description: "Corporate governance, contracts, and regulatory compliance" },
];

// ─── 1b. Employees (60) ──────────────────────────────────────

export interface EmployeeSeed {
  firstName: string;
  lastName: string;
  position: string;
  department: string; // code
  salary: number;
  hireDaysAgo: number;
  status: string;
  employmentType: string;
}

export const employees: EmployeeSeed[] = [
  // Sales (8)
  { firstName: "Ahmad", lastName: "Ibrahim", position: "Sales Director", department: "SALES", salary: 14500, hireDaysAgo: 1600, status: "active", employmentType: "full_time" },
  { firstName: "Mei Ling", lastName: "Tan", position: "Senior Sales Executive", department: "SALES", salary: 9200, hireDaysAgo: 1100, status: "active", employmentType: "full_time" },
  { firstName: "Rajesh", lastName: "Kumar", position: "Sales Executive", department: "SALES", salary: 6500, hireDaysAgo: 800, status: "active", employmentType: "full_time" },
  { firstName: "Nurul", lastName: "Huda", position: "Sales Executive", department: "SALES", salary: 6200, hireDaysAgo: 600, status: "active", employmentType: "full_time" },
  { firstName: "James", lastName: "Wong", position: "Business Development Manager", department: "SALES", salary: 10800, hireDaysAgo: 950, status: "active", employmentType: "full_time" },
  { firstName: "Priya", lastName: "Nair", position: "Sales Coordinator", department: "SALES", salary: 4800, hireDaysAgo: 300, status: "active", employmentType: "full_time" },
  { firstName: "Daniel", lastName: "Lee", position: "Account Manager", department: "SALES", salary: 7800, hireDaysAgo: 700, status: "active", employmentType: "full_time" },
  { firstName: "Siti", lastName: "Aminah", position: "Sales Intern", department: "SALES", salary: 3000, hireDaysAgo: 90, status: "active", employmentType: "contract" },

  // R&D (8)
  { firstName: "Wei Jie", lastName: "Chen", position: "R&D Director", department: "RND", salary: 15000, hireDaysAgo: 1800, status: "active", employmentType: "full_time" },
  { firstName: "Aisha", lastName: "Abdullah", position: "Senior Software Engineer", department: "RND", salary: 11500, hireDaysAgo: 1200, status: "active", employmentType: "full_time" },
  { firstName: "Vikram", lastName: "Singh", position: "Software Engineer", department: "RND", salary: 8500, hireDaysAgo: 700, status: "active", employmentType: "full_time" },
  { firstName: "Chong", lastName: "Wei", position: "Software Engineer", department: "RND", salary: 8200, hireDaysAgo: 500, status: "active", employmentType: "full_time" },
  { firstName: "Fatimah", lastName: "Zahra", position: "QA Engineer", department: "RND", salary: 7000, hireDaysAgo: 450, status: "active", employmentType: "full_time" },
  { firstName: "David", lastName: "Lim", position: "DevOps Engineer", department: "RND", salary: 9800, hireDaysAgo: 900, status: "active", employmentType: "full_time" },
  { firstName: "Kavitha", lastName: "Rajan", position: "Data Scientist", department: "RND", salary: 10200, hireDaysAgo: 600, status: "active", employmentType: "full_time" },
  { firstName: "Hafiz", lastName: "Rahman", position: "Junior Developer", department: "RND", salary: 5500, hireDaysAgo: 200, status: "active", employmentType: "full_time" },

  // HR (6)
  { firstName: "Sarah", lastName: "Tan", position: "HR Director", department: "HR", salary: 13000, hireDaysAgo: 1500, status: "active", employmentType: "full_time" },
  { firstName: "Muthu", lastName: "Krishnan", position: "HR Manager", department: "HR", salary: 9500, hireDaysAgo: 1000, status: "active", employmentType: "full_time" },
  { firstName: "Nur Aisyah", lastName: "Mohd", position: "Recruitment Specialist", department: "HR", salary: 6800, hireDaysAgo: 500, status: "active", employmentType: "full_time" },
  { firstName: "Kevin", lastName: "Ong", position: "Training Coordinator", department: "HR", salary: 6000, hireDaysAgo: 400, status: "active", employmentType: "full_time" },
  { firstName: "Anita", lastName: "Devi", position: "Payroll Specialist", department: "HR", salary: 6500, hireDaysAgo: 700, status: "active", employmentType: "full_time" },
  { firstName: "Zulkifli", lastName: "Hassan", position: "HR Assistant", department: "HR", salary: 4200, hireDaysAgo: 150, status: "active", employmentType: "full_time" },

  // Finance (7)
  { firstName: "Tan", lastName: "Boon Keat", position: "Finance Director", department: "FIN", salary: 14000, hireDaysAgo: 1700, status: "active", employmentType: "full_time" },
  { firstName: "Lakshmi", lastName: "Pillai", position: "Senior Accountant", department: "FIN", salary: 9000, hireDaysAgo: 1100, status: "active", employmentType: "full_time" },
  { firstName: "Azman", lastName: "Yusof", position: "Financial Analyst", department: "FIN", salary: 8000, hireDaysAgo: 600, status: "active", employmentType: "full_time" },
  { firstName: "Michelle", lastName: "Ng", position: "Accountant", department: "FIN", salary: 7200, hireDaysAgo: 800, status: "active", employmentType: "full_time" },
  { firstName: "Ravi", lastName: "Chandran", position: "Accounts Payable", department: "FIN", salary: 5800, hireDaysAgo: 400, status: "active", employmentType: "full_time" },
  { firstName: "Farah", lastName: "Amin", position: "Budget Analyst", department: "FIN", salary: 7500, hireDaysAgo: 350, status: "active", employmentType: "full_time" },
  { firstName: "Jason", lastName: "Teo", position: "Finance Intern", department: "FIN", salary: 3200, hireDaysAgo: 60, status: "active", employmentType: "contract" },

  // IT (8)
  { firstName: "Suresh", lastName: "Menon", position: "IT Director", department: "IT", salary: 14200, hireDaysAgo: 1600, status: "active", employmentType: "full_time" },
  { firstName: "Hui Wen", lastName: "Loh", position: "Systems Administrator", department: "IT", salary: 9500, hireDaysAgo: 1000, status: "active", employmentType: "full_time" },
  { firstName: "Abdul", lastName: "Malik", position: "Network Engineer", department: "IT", salary: 8800, hireDaysAgo: 800, status: "active", employmentType: "full_time" },
  { firstName: "Christina", lastName: "Yap", position: "IT Support Specialist", department: "IT", salary: 5500, hireDaysAgo: 400, status: "active", employmentType: "full_time" },
  { firstName: "Ganesh", lastName: "Rao", position: "Security Analyst", department: "IT", salary: 9200, hireDaysAgo: 600, status: "active", employmentType: "full_time" },
  { firstName: "Khairul", lastName: "Anwar", position: "Database Administrator", department: "IT", salary: 9000, hireDaysAgo: 750, status: "active", employmentType: "full_time" },
  { firstName: "Samantha", lastName: "Koh", position: "Help Desk Technician", department: "IT", salary: 4500, hireDaysAgo: 200, status: "active", employmentType: "full_time" },
  { firstName: "Ismail", lastName: "Bakar", position: "IT Intern", department: "IT", salary: 3000, hireDaysAgo: 45, status: "active", employmentType: "contract" },

  // Operations (7)
  { firstName: "Lim", lastName: "Kok Seng", position: "Operations Director", department: "OPS", salary: 13500, hireDaysAgo: 1400, status: "active", employmentType: "full_time" },
  { firstName: "Bala", lastName: "Subramaniam", position: "Operations Manager", department: "OPS", salary: 9800, hireDaysAgo: 900, status: "active", employmentType: "full_time" },
  { firstName: "Nadia", lastName: "Aziz", position: "Logistics Coordinator", department: "OPS", salary: 6200, hireDaysAgo: 500, status: "active", employmentType: "full_time" },
  { firstName: "Yong", lastName: "Chee Keong", position: "Procurement Officer", department: "OPS", salary: 7000, hireDaysAgo: 700, status: "on_leave", employmentType: "full_time" },
  { firstName: "Divya", lastName: "Sharma", position: "Supply Chain Analyst", department: "OPS", salary: 7500, hireDaysAgo: 450, status: "active", employmentType: "full_time" },
  { firstName: "Rizal", lastName: "Hakim", position: "Warehouse Supervisor", department: "OPS", salary: 5500, hireDaysAgo: 600, status: "active", employmentType: "full_time" },
  { firstName: "Pei Shan", lastName: "Goh", position: "Operations Assistant", department: "OPS", salary: 4000, hireDaysAgo: 250, status: "active", employmentType: "full_time" },

  // Marketing (8)
  { firstName: "Jessica", lastName: "Lau", position: "Marketing Director", department: "MKT", salary: 13000, hireDaysAgo: 1300, status: "active", employmentType: "full_time" },
  { firstName: "Arjun", lastName: "Patel", position: "Digital Marketing Manager", department: "MKT", salary: 9500, hireDaysAgo: 800, status: "active", employmentType: "full_time" },
  { firstName: "Syafiq", lastName: "Kamal", position: "Content Strategist", department: "MKT", salary: 7000, hireDaysAgo: 500, status: "active", employmentType: "full_time" },
  { firstName: "Yin Fong", lastName: "Ooi", position: "Graphic Designer", department: "MKT", salary: 6500, hireDaysAgo: 400, status: "active", employmentType: "full_time" },
  { firstName: "Deepak", lastName: "Menon", position: "SEO Specialist", department: "MKT", salary: 6800, hireDaysAgo: 350, status: "active", employmentType: "full_time" },
  { firstName: "Liyana", lastName: "Rosli", position: "Social Media Executive", department: "MKT", salary: 5200, hireDaysAgo: 250, status: "active", employmentType: "full_time" },
  { firstName: "Marcus", lastName: "Tan", position: "Marketing Analyst", department: "MKT", salary: 7200, hireDaysAgo: 600, status: "terminated", employmentType: "full_time" },
  { firstName: "Aminah", lastName: "Othman", position: "Marketing Intern", department: "MKT", salary: 3000, hireDaysAgo: 80, status: "active", employmentType: "contract" },

  // Legal (5)
  { firstName: "Philip", lastName: "Cheah", position: "Legal Director", department: "LEGAL", salary: 14800, hireDaysAgo: 1500, status: "active", employmentType: "full_time" },
  { firstName: "Sharifah", lastName: "Noor", position: "Senior Legal Counsel", department: "LEGAL", salary: 11000, hireDaysAgo: 1000, status: "active", employmentType: "full_time" },
  { firstName: "Kumar", lastName: "Samy", position: "Corporate Lawyer", department: "LEGAL", salary: 9500, hireDaysAgo: 700, status: "active", employmentType: "full_time" },
  { firstName: "Rachel", lastName: "Lim", position: "Compliance Officer", department: "LEGAL", salary: 8200, hireDaysAgo: 500, status: "on_leave", employmentType: "full_time" },
  { firstName: "Hakim", lastName: "Iskandar", position: "Legal Assistant", department: "LEGAL", salary: 4500, hireDaysAgo: 300, status: "terminated", employmentType: "full_time" },

  // Extra terminated
  { firstName: "Brian", lastName: "Chua", position: "Junior Analyst", department: "FIN", salary: 4800, hireDaysAgo: 400, status: "terminated", employmentType: "full_time" },
];

// ─── 1c. Leave Requests ──────────────────────────────────────

export interface LeaveRequestSeed {
  employeeIndex: number;
  leaveType: string; // matches LeaveType.name
  startDaysAgo: number;
  totalDays: number;
  status: string;
  reason: string;
}

export const leaveRequests: LeaveRequestSeed[] = [
  // Pending (5)
  { employeeIndex: 3, leaveType: "Annual Leave", startDaysAgo: -5, totalDays: 3, status: "pending", reason: "Family vacation" },
  { employeeIndex: 10, leaveType: "Sick Leave", startDaysAgo: -2, totalDays: 2, status: "pending", reason: "Doctor appointment and recovery" },
  { employeeIndex: 22, leaveType: "Personal Leave", startDaysAgo: -7, totalDays: 1, status: "pending", reason: "Personal matters" },
  { employeeIndex: 35, leaveType: "Annual Leave", startDaysAgo: -10, totalDays: 5, status: "pending", reason: "Travel plans" },
  { employeeIndex: 44, leaveType: "Annual Leave", startDaysAgo: -3, totalDays: 2, status: "pending", reason: "Moving house" },

  // Approved (8)
  { employeeIndex: 5, leaveType: "Annual Leave", startDaysAgo: 20, totalDays: 5, status: "approved", reason: "Annual holiday trip" },
  { employeeIndex: 12, leaveType: "Sick Leave", startDaysAgo: 15, totalDays: 3, status: "approved", reason: "Flu and fever" },
  { employeeIndex: 18, leaveType: "Annual Leave", startDaysAgo: 30, totalDays: 10, status: "approved", reason: "Hari Raya celebration" },
  { employeeIndex: 25, leaveType: "Personal Leave", startDaysAgo: 10, totalDays: 1, status: "approved", reason: "Bank appointment" },
  { employeeIndex: 30, leaveType: "Maternity Leave", startDaysAgo: 45, totalDays: 60, status: "approved", reason: "Maternity leave" },
  { employeeIndex: 8, leaveType: "Annual Leave", startDaysAgo: 25, totalDays: 4, status: "approved", reason: "Chinese New Year" },
  { employeeIndex: 40, leaveType: "Sick Leave", startDaysAgo: 8, totalDays: 2, status: "approved", reason: "Food poisoning" },
  { employeeIndex: 48, leaveType: "Annual Leave", startDaysAgo: 35, totalDays: 7, status: "approved", reason: "Deepavali celebration" },

  // Rejected (4)
  { employeeIndex: 15, leaveType: "Annual Leave", startDaysAgo: 40, totalDays: 10, status: "rejected", reason: "Extended vacation — conflicts with project deadline" },
  { employeeIndex: 28, leaveType: "Personal Leave", startDaysAgo: 50, totalDays: 3, status: "rejected", reason: "Personal trip — team understaffed" },
  { employeeIndex: 33, leaveType: "Annual Leave", startDaysAgo: 55, totalDays: 5, status: "rejected", reason: "Holiday — too many concurrent leaves" },
  { employeeIndex: 42, leaveType: "Annual Leave", startDaysAgo: 60, totalDays: 7, status: "rejected", reason: "Travel — budget review period" },
];

// ─── 1d. Budget Categories & Annual Budgets ──────────────────

export const budgetCategories = [
  { name: "Sales & Marketing", code: "BUD-SM", type: "expense", description: "Sales campaigns, advertising, events" },
  { name: "Information Technology", code: "BUD-IT", type: "expense", description: "Software, hardware, cloud services" },
  { name: "Human Resources", code: "BUD-HR", type: "expense", description: "Recruitment, training, benefits" },
  { name: "Operations", code: "BUD-OPS", type: "expense", description: "Logistics, supplies, facilities" },
  { name: "Research & Development", code: "BUD-RND", type: "expense", description: "R&D projects, prototyping, testing" },
  { name: "General & Administrative", code: "BUD-GA", type: "expense", description: "Office expenses, legal, insurance" },
];

export const annualBudgets = [
  { categoryCode: "BUD-SM", allocated: 450000, spent: 520000, status: "active" },   // over budget
  { categoryCode: "BUD-IT", allocated: 380000, spent: 295000, status: "active" },
  { categoryCode: "BUD-HR", allocated: 280000, spent: 255000, status: "active" },
  { categoryCode: "BUD-OPS", allocated: 320000, spent: 340000, status: "active" },  // over budget
  { categoryCode: "BUD-RND", allocated: 500000, spent: 380000, status: "active" },
  { categoryCode: "BUD-GA", allocated: 200000, spent: 175000, status: "active" },
];

// ─── 1e. Transactions ────────────────────────────────────────

export function generateTransactions(): Array<{
  type: string; category: string; amount: number; description: string; reference: string; transactionDate: Date; status: string;
}> {
  const txns = [];
  const categories = [
    { type: "expense", category: "Salaries", amounts: [35000, 42000, 38000, 45000], descs: ["Monthly payroll — January", "Monthly payroll — February", "Monthly payroll — March", "Monthly payroll — April"] },
    { type: "expense", category: "Software Licenses", amounts: [12500, 8200, 15000, 4500, 22000], descs: ["Microsoft 365 renewal", "Jira annual license", "AWS monthly hosting", "Slack subscription", "Oracle DB license"] },
    { type: "expense", category: "Equipment", amounts: [28000, 15500, 8900, 3200], descs: ["Dell Latitude laptops (x10)", "HP monitors (x15)", "Cisco switch upgrade", "Keyboards and mice"] },
    { type: "expense", category: "Travel", amounts: [4500, 7800, 3200, 5600], descs: ["KL-Singapore business trip", "Client visit — Penang", "Conference attendance — Bangkok", "Team retreat — Langkawi"] },
    { type: "expense", category: "Marketing", amounts: [18000, 12000, 8500, 25000], descs: ["Google Ads Q1 campaign", "Trade show booth", "Social media advertising", "Brand redesign project"] },
    { type: "expense", category: "Office Supplies", amounts: [2200, 1800, 3100, 950], descs: ["Stationery and printing", "Cleaning supplies", "Pantry supplies Q1", "Printer cartridges"] },
    { type: "expense", category: "Consulting", amounts: [35000, 18000, 12000], descs: ["Deloitte audit fees", "Legal consulting — contract review", "HR consulting — policy update"] },
    { type: "expense", category: "Training", amounts: [8500, 6200, 4800, 11000], descs: ["AWS certification training", "Leadership workshop", "First aid certification", "Data analytics bootcamp"] },
    { type: "income", category: "Product Sales", amounts: [85000, 92000, 78000, 105000], descs: ["Q1 product revenue", "Enterprise license deal", "SME package sales", "Annual subscription renewals"] },
    { type: "income", category: "Consulting Revenue", amounts: [45000, 32000, 28000], descs: ["Implementation consulting", "Training services revenue", "Custom development project"] },
    { type: "income", category: "Service Revenue", amounts: [15000, 18000, 22000], descs: ["Maintenance contracts", "Support subscriptions", "Professional services"] },
  ];

  let refCounter = 1;
  for (const cat of categories) {
    for (let i = 0; i < cat.amounts.length; i++) {
      txns.push({
        type: cat.type,
        category: cat.category,
        amount: cat.amounts[i],
        description: cat.descs[i],
        reference: `TXN-2025-${String(refCounter++).padStart(4, "0")}`,
        transactionDate: daysAgo(randomBetween(5, 180)),
        status: "completed",
      });
    }
  }
  return txns;
}

// ─── 1f. Invoices ────────────────────────────────────────────

export function generateInvoices(): Array<{
  invoiceNumber: string; type: string; clientName: string; clientEmail: string;
  issueDate: Date; dueDate: Date; subtotal: number; taxAmount: number; totalAmount: number;
  paidAmount: number; status: string; notes: string;
}> {
  const vendors = [
    { name: "Dell Technologies", email: "billing@dell.com" },
    { name: "Amazon Web Services", email: "invoices@aws.amazon.com" },
    { name: "Microsoft Corporation", email: "billing@microsoft.com" },
    { name: "Oracle Corporation", email: "accounts@oracle.com" },
    { name: "Cisco Systems", email: "ap@cisco.com" },
    { name: "FedEx Malaysia", email: "billing@fedex.com.my" },
    { name: "WeWork Southeast Asia", email: "invoices@wework.com" },
    { name: "Google Cloud", email: "billing@google.com" },
    { name: "Adobe Systems", email: "invoices@adobe.com" },
    { name: "Telekom Malaysia", email: "billing@tm.com.my" },
    { name: "Maxis Berhad", email: "corporate@maxis.com.my" },
    { name: "Samsung Electronics", email: "b2b@samsung.com" },
  ];

  const invoices = [];
  const statuses = ["paid", "paid", "paid", "paid", "paid", "paid", "paid", "paid",
    "pending", "pending", "pending", "pending", "pending",
    "overdue", "overdue", "overdue",
    "cancelled", "cancelled"];

  for (let i = 0; i < 25; i++) {
    const vendor = vendors[i % vendors.length];
    const status = statuses[i % statuses.length];
    const subtotal = randomBetween(1000, 95000);
    const taxAmount = Math.round(subtotal * 0.06); // 6% SST
    const totalAmount = subtotal + taxAmount;
    const issueDaysAgo = randomBetween(5, 120);
    const dueDaysAgo = issueDaysAgo - 30;

    invoices.push({
      invoiceNumber: `INV-2025-${String(i + 1).padStart(3, "0")}`,
      type: "payable",
      clientName: vendor.name,
      clientEmail: vendor.email,
      issueDate: daysAgo(issueDaysAgo),
      dueDate: daysAgo(dueDaysAgo),
      subtotal,
      taxAmount,
      totalAmount,
      paidAmount: status === "paid" ? totalAmount : status === "cancelled" ? 0 : 0,
      status,
      notes: `Invoice for ${vendor.name} services`,
    });
  }
  return invoices;
}

// ─── 1g. Assets ──────────────────────────────────────────────

export function generateAssets(employeeNames: string[]): Array<{
  assetTag: string; name: string; category: string; manufacturer: string; model: string;
  serialNumber: string; purchaseDate: Date; purchasePrice: number; warrantyExpiry: Date;
  status: string; assignedTo: string | null; location: string;
}> {
  const items = [
    { category: "Laptop", names: ["Latitude 5540", "EliteBook 840 G10", "ThinkPad X1 Carbon", "MacBook Pro 14"], brands: ["Dell", "HP", "Lenovo", "Apple"], prices: [4200, 4800, 5200, 7500] },
    { category: "Desktop", names: ["OptiPlex 7010", "ProDesk 400 G9", "ThinkCentre M70q"], brands: ["Dell", "HP", "Lenovo"], prices: [3200, 2800, 3000] },
    { category: "Server", names: ["PowerEdge R750", "ProLiant DL380 Gen10", "ThinkSystem SR650"], brands: ["Dell", "HP", "Lenovo"], prices: [15000, 18000, 16500] },
    { category: "Monitor", names: ["UltraSharp U2723QE", "E27 G4", "ThinkVision T27p-30"], brands: ["Dell", "HP", "Lenovo"], prices: [1800, 1200, 1500] },
    { category: "Printer", names: ["LaserJet Pro M404dn", "B2236dw"], brands: ["HP", "Lenovo"], prices: [1200, 900] },
    { category: "Network Switch", names: ["Catalyst 9200L", "Catalyst 9300"], brands: ["Cisco", "Cisco"], prices: [8500, 12000] },
    { category: "Router", names: ["ISR 4331", "ISR 1100"], brands: ["Cisco", "Cisco"], prices: [6500, 3800] },
    { category: "Phone", names: ["Galaxy S24", "Galaxy A54"], brands: ["Samsung", "Samsung"], prices: [3500, 1500] },
  ];

  const assets = [];
  let counter = 1;
  const statuses = ["active", "active", "active", "active", "active", "active", "maintenance", "retired", "in_storage"];
  const locations = ["HQ Floor 1", "HQ Floor 2", "HQ Floor 3", "Server Room", "Warehouse", "Branch — KL Sentral"];

  for (let i = 0; i < 30; i++) {
    const itemGroup = items[i % items.length];
    const idx = i % itemGroup.names.length;
    const purchaseDaysAgo = randomBetween(60, 1500);
    const warrantyYears = pick([1, 2, 3]);

    assets.push({
      assetTag: `SEP-AST-${String(counter++).padStart(4, "0")}`,
      name: `${itemGroup.brands[idx]} ${itemGroup.names[idx]}`,
      category: itemGroup.category,
      manufacturer: itemGroup.brands[idx],
      model: itemGroup.names[idx],
      serialNumber: `SN${Date.now().toString(36).toUpperCase()}${String(i).padStart(4, "0")}`,
      purchaseDate: daysAgo(purchaseDaysAgo),
      purchasePrice: itemGroup.prices[idx],
      warrantyExpiry: new Date(daysAgo(purchaseDaysAgo).getTime() + warrantyYears * 365 * 24 * 60 * 60 * 1000),
      status: statuses[i % statuses.length],
      assignedTo: statuses[i % statuses.length] === "active" && i < employeeNames.length ? employeeNames[i % employeeNames.length] : null,
      location: locations[i % locations.length],
    });
  }
  return assets;
}

// ─── 1h. IT Tickets ──────────────────────────────────────────

export function generateTickets(employeeNames: string[], itStaffNames: string[]): Array<{
  ticketNumber: string; title: string; description: string; category: string;
  priority: string; status: string; reportedBy: string; assignedTo: string | null;
  resolution: string | null; resolvedAt: Date | null; createdAt: Date;
}> {
  const ticketData = [
    { title: "VPN not connecting from home", category: "Network", priority: "high", description: "Unable to establish VPN connection when working remotely. Error: Connection timed out." },
    { title: "Laptop running extremely slow", category: "Hardware", priority: "medium", description: "Laptop takes 10+ minutes to boot and applications freeze frequently." },
    { title: "Email sync failed on mobile", category: "Email", priority: "medium", description: "Outlook mobile app stopped syncing emails since yesterday." },
    { title: "Need Adobe Creative Suite license", category: "Software", priority: "low", description: "Requesting Adobe Creative Suite license for marketing design work." },
    { title: "Monitor flickering intermittently", category: "Hardware", priority: "medium", description: "Dell monitor flickers every few minutes, especially with dark backgrounds." },
    { title: "Cannot access shared drive (Z:)", category: "Access", priority: "high", description: "Getting 'Access Denied' when trying to map network drive Z: to shared folder." },
    { title: "Printer paper jam — Floor 2", category: "Printer", priority: "low", description: "HP LaserJet on Floor 2 keeps jamming. Paper tray may need replacement." },
    { title: "Password reset needed", category: "Access", priority: "high", description: "Account locked after multiple failed attempts. Need urgent password reset." },
    { title: "Zoom keeps disconnecting in meetings", category: "Software", priority: "medium", description: "Zoom drops connection every 15-20 minutes during video calls." },
    { title: "New employee laptop setup", category: "Hardware", priority: "medium", description: "Setup new Dell Latitude for incoming hire starting next Monday." },
    { title: "Wi-Fi dead zones in meeting room B", category: "Network", priority: "high", description: "No Wi-Fi signal in Meeting Room B on Floor 3. Need access point." },
    { title: "SAP module not loading", category: "Software", priority: "critical", description: "Finance team cannot access SAP. Module returns 500 error on login." },
    { title: "Request for dual monitor setup", category: "Hardware", priority: "low", description: "Requesting second monitor for improved productivity." },
    { title: "Suspicious email received", category: "Software", priority: "critical", description: "Received phishing email appearing to be from CEO requesting wire transfer." },
    { title: "Keyboard not working — spilled coffee", category: "Hardware", priority: "low", description: "Spilled coffee on keyboard, keys are sticking. Need replacement." },
    { title: "File server running low on disk space", category: "Network", priority: "high", description: "File server at 92% capacity. Need to archive old files or expand storage." },
    { title: "Cannot connect to office printer", category: "Printer", priority: "medium", description: "Printer shows offline even though it's powered on and connected." },
    { title: "Microsoft Teams crashes on startup", category: "Software", priority: "medium", description: "Teams crashes immediately on launch. Reinstall didn't help." },
    { title: "VPN access for new contractor", category: "Access", priority: "medium", description: "Need VPN credentials for contractor starting project next week." },
    { title: "Backup job failed overnight", category: "Network", priority: "critical", description: "Nightly backup to NAS failed with error. Last successful backup was 3 days ago." },
    { title: "Projector bulb replacement — Conference Room", category: "Hardware", priority: "low", description: "Projector in main conference room is dim. Bulb needs replacing." },
    { title: "Software update causing crashes", category: "Software", priority: "high", description: "Latest Windows update causing BSOD on several machines in R&D." },
    { title: "Guest Wi-Fi not working", category: "Network", priority: "medium", description: "Guest Wi-Fi network not broadcasting. Visitors cannot connect." },
    { title: "Need access to Jira project board", category: "Access", priority: "low", description: "Transferred to R&D team, need access to engineering Jira board." },
    { title: "UPS battery warning — Server Room", category: "Hardware", priority: "critical", description: "UPS in server room showing battery warning. Risk of data loss if power fails." },
  ];

  const statusDistribution = [
    "open", "open", "open", "open", "open", "open", "open", "open",
    "in_progress", "in_progress", "in_progress", "in_progress", "in_progress",
    "resolved", "resolved", "resolved", "resolved", "resolved", "resolved", "resolved", "resolved", "resolved", "resolved",
    "closed", "closed",
  ];

  return ticketData.map((t, i) => {
    const status = statusDistribution[i % statusDistribution.length];
    const createdDaysAgo = randomBetween(1, 60);
    return {
      ticketNumber: `TKT-2025-${String(i + 1).padStart(4, "0")}`,
      ...t,
      status,
      reportedBy: employeeNames[i % employeeNames.length],
      assignedTo: itStaffNames[i % itStaffNames.length],
      resolution: status === "resolved" || status === "closed" ? "Issue has been resolved." : null,
      resolvedAt: status === "resolved" || status === "closed" ? daysAgo(randomBetween(0, createdDaysAgo - 1)) : null,
      createdAt: daysAgo(createdDaysAgo),
    };
  });
}

// ─── 1i. Projects ────────────────────────────────────────────

export const projects = [
  { name: "Office Renovation Phase 2", code: "PRJ-001", description: "Complete renovation of floors 2 and 3 including new workstations and meeting rooms", clientName: "Internal", startDaysAgo: 180, endDaysFromNow: 60, budget: 250000, actualBudget: 220000, status: "in_progress", progress: 65, location: "HQ Building" },
  { name: "Server Room Expansion", code: "PRJ-002", description: "Expand server room capacity with new racks, cooling, and UPS systems", clientName: "Internal", startDaysAgo: 120, endDaysFromNow: 30, budget: 180000, actualBudget: 165000, status: "in_progress", progress: 78, location: "HQ Basement" },
  { name: "New Branch Setup — KL Sentral", code: "PRJ-003", description: "Setup new satellite office at KL Sentral including furniture, IT infrastructure, and signage", clientName: "Internal", startDaysAgo: 60, endDaysFromNow: 150, budget: 350000, actualBudget: 95000, status: "in_progress", progress: 25, location: "KL Sentral Tower" },
  { name: "Warehouse Construction", code: "PRJ-004", description: "Build new warehouse facility for inventory and logistics operations", clientName: "Internal", startDaysAgo: 300, endDaysFromNow: -30, budget: 800000, actualBudget: 785000, status: "completed", progress: 100, location: "Shah Alam Industrial Zone" },
  { name: "Parking Lot Extension", code: "PRJ-005", description: "Extend employee parking lot with 50 additional covered spaces", clientName: "Internal", startDaysAgo: 200, endDaysFromNow: -60, budget: 120000, actualBudget: 118000, status: "completed", progress: 100, location: "HQ Compound" },
  { name: "Data Center Build", code: "PRJ-006", description: "Build dedicated data center with redundant power, cooling, and network connectivity", clientName: "Internal", startDaysAgo: 30, endDaysFromNow: 300, budget: 1200000, actualBudget: 80000, status: "planning", progress: 5, location: "Cyberjaya Tech Park" },
  { name: "Security System Upgrade", code: "PRJ-007", description: "Upgrade CCTV, access control, and fire alarm systems across all floors", clientName: "Internal", startDaysAgo: 90, endDaysFromNow: 45, budget: 95000, actualBudget: 72000, status: "in_progress", progress: 55, location: "HQ Building" },
  { name: "Solar Panel Installation", code: "PRJ-008", description: "Install rooftop solar panels to reduce energy costs and carbon footprint", clientName: "GreenTech Solutions", startDaysAgo: 15, endDaysFromNow: 200, budget: 450000, actualBudget: 22000, status: "planning", progress: 3, location: "HQ Rooftop" },
  { name: "Cafeteria Renovation", code: "PRJ-009", description: "Renovate employee cafeteria with modern kitchen and seating for 200", clientName: "Internal", startDaysAgo: 100, endDaysFromNow: 90, budget: 175000, actualBudget: 140000, status: "on_hold", progress: 40, location: "HQ Ground Floor" },
];

// ─── 1j. Alerts ──────────────────────────────────────────────

export const alerts = [
  { title: "Budget exceeded for Sales & Marketing", message: "The Sales & Marketing budget has exceeded its allocated amount by RM70,000 (15.6% over). Immediate review recommended.", severity: "critical", module: "finance", isRead: false },
  { title: "3 employees at high attrition risk", message: "Predictive model identified 3 employees with risk scores above 0.8. Departments: Sales (1), Marketing (2).", severity: "warning", module: "workforce", isRead: false },
  { title: "Server CPU usage above 90%", message: "Production server PROD-SRV-01 has sustained CPU usage above 90% for the past 2 hours.", severity: "critical", module: "ict", isRead: false },
  { title: "5 overdue invoices totalling RM125,000", message: "There are 5 invoices past their due date. Total outstanding: RM125,000. Oldest: 45 days overdue.", severity: "warning", module: "accounting", isRead: false },
  { title: "Project deadline approaching — Server Room", message: "Server Room Expansion (PRJ-002) is due in 30 days with 78% completion. Risk of delay.", severity: "warning", module: "construction", isRead: false },
  { title: "Unusual transaction detected", message: "Transaction TXN-2025-0042 for RM45,000 flagged — amount exceeds 3x the category average for Consulting.", severity: "critical", module: "finance", isRead: false },
  { title: "IT ticket backlog growing", message: "Open IT tickets increased from 5 to 8 this week. Average resolution time: 3.2 days.", severity: "info", module: "ict", isRead: true },
  { title: "Employee satisfaction survey due", message: "Q1 2025 employee satisfaction survey deadline is approaching. 23 of 60 employees have not responded.", severity: "info", module: "workforce", isRead: true },
  { title: "Backup job completed successfully", message: "Nightly backup to NAS completed at 03:45 AM. Total backup size: 2.4TB. No errors.", severity: "info", module: "ict", isRead: true },
  { title: "New employee onboarding pending", message: "2 new hires starting next Monday. IT setup and HR orientation not yet scheduled.", severity: "warning", module: "hr", isRead: true },
  { title: "Software license expiring — Oracle DB", message: "Oracle Database license expires in 15 days. Renewal quote: RM22,000/year.", severity: "warning", module: "ict", isRead: true },
  { title: "Operations budget near limit", message: "Operations budget utilization at 106%. RM20,000 over allocated amount.", severity: "warning", module: "finance", isRead: true },
  { title: "Monthly KPI report generated", message: "January 2025 KPI report is ready. Overall performance: 87.3%. Revenue target: 95% achieved.", severity: "info", module: "dashboard", isRead: true },
  { title: "Cafeteria project on hold", message: "Cafeteria Renovation (PRJ-009) placed on hold due to contractor availability issues.", severity: "info", module: "construction", isRead: true },
];

// ─── 1k. Surveys ─────────────────────────────────────────────

export const surveys = [
  {
    title: "Q1 2025 Employee Satisfaction Survey",
    description: "Quarterly survey to assess employee satisfaction, engagement, and work-life balance.",
    status: "active",
    questions: [
      { text: "How satisfied are you with your current role and responsibilities?", type: "rating", options: [1, 2, 3, 4, 5] },
      { text: "How would you rate your work-life balance?", type: "rating", options: [1, 2, 3, 4, 5] },
      { text: "How supportive is your direct manager?", type: "rating", options: [1, 2, 3, 4, 5] },
      { text: "Do you feel you have adequate growth opportunities?", type: "rating", options: [1, 2, 3, 4, 5] },
      { text: "How likely are you to recommend this company as a workplace?", type: "rating", options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { text: "What is one thing we could improve?", type: "text", options: null },
    ],
  },
  {
    title: "Remote Work Effectiveness Survey",
    description: "Evaluating the effectiveness and challenges of our hybrid work arrangement.",
    status: "completed",
    questions: [
      { text: "How productive do you feel when working remotely?", type: "rating", options: [1, 2, 3, 4, 5] },
      { text: "Are the tools and technology adequate for remote work?", type: "rating", options: [1, 2, 3, 4, 5] },
      { text: "How often do you prefer to work from the office per week?", type: "choice", options: ["1 day", "2 days", "3 days", "4 days", "5 days"] },
      { text: "What challenges do you face with remote work?", type: "text", options: null },
    ],
  },
  {
    title: "Training Needs Assessment 2025",
    description: "Identifying training and development priorities for the year ahead.",
    status: "draft",
    questions: [
      { text: "Which area would you most like training in?", type: "choice", options: ["Technical Skills", "Leadership", "Communication", "Project Management", "Data Analytics"] },
      { text: "How many training days would you dedicate this year?", type: "rating", options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { text: "Would you prefer online or in-person training?", type: "choice", options: ["Online", "In-person", "Hybrid"] },
    ],
  },
];

// ─── 1l. KPI Definitions ────────────────────────────────────

export const kpiDefinitions = [
  { name: "Total Revenue", module: "finance", metric: "total_revenue", unit: "USD", target: 2000000, format: "currency" },
  { name: "Total Expenses", module: "finance", metric: "total_expenses", unit: "USD", target: 1500000, format: "currency" },
  { name: "Employee Count", module: "hr", metric: "employee_count", unit: null, target: 65, format: "number" },
  { name: "Project Completion Rate", module: "construction", metric: "project_completion_rate", unit: "%", target: 85, format: "percent" },
  { name: "Ticket Resolution Rate", module: "ict", metric: "ticket_resolution_rate", unit: "%", target: 90, format: "percent" },
  { name: "Budget Utilization", module: "finance", metric: "budget_utilization", unit: "%", target: 80, format: "percent" },
  { name: "Avg Satisfaction Score", module: "workforce", metric: "avg_satisfaction", unit: null, target: 4.0, format: "number" },
  { name: "Attrition Rate", module: "workforce", metric: "attrition_rate", unit: "%", target: 10, format: "percent" },
];

export const kpiSnapshots = [
  { name: "Total Revenue", value: 1850000, previous: 1720000 },
  { name: "Total Expenses", value: 1365000, previous: 1280000 },
  { name: "Employee Count", value: 57, previous: 55 },
  { name: "Project Completion Rate", value: 78, previous: 72 },
  { name: "Ticket Resolution Rate", value: 88, previous: 85 },
  { name: "Budget Utilization", value: 82, previous: 79 },
  { name: "Avg Satisfaction Score", value: 3.8, previous: 3.6 },
  { name: "Attrition Rate", value: 8.5, previous: 9.2 },
];

// ─── Chart of Accounts ───────────────────────────────────────

export const chartOfAccounts = [
  { accountCode: "1000", name: "Cash and Bank", type: "asset", balance: 1250000 },
  { accountCode: "1100", name: "Accounts Receivable", type: "asset", balance: 320000 },
  { accountCode: "1200", name: "Prepaid Expenses", type: "asset", balance: 45000 },
  { accountCode: "1500", name: "Fixed Assets", type: "asset", balance: 890000 },
  { accountCode: "1510", name: "Accumulated Depreciation", type: "asset", balance: -210000 },
  { accountCode: "2000", name: "Accounts Payable", type: "liability", balance: 185000 },
  { accountCode: "2100", name: "Accrued Expenses", type: "liability", balance: 62000 },
  { accountCode: "2500", name: "Long-term Loans", type: "liability", balance: 500000 },
  { accountCode: "3000", name: "Share Capital", type: "equity", balance: 1000000 },
  { accountCode: "3100", name: "Retained Earnings", type: "equity", balance: 548000 },
  { accountCode: "4000", name: "Sales Revenue", type: "revenue", balance: 1850000 },
  { accountCode: "4100", name: "Service Revenue", type: "revenue", balance: 280000 },
  { accountCode: "5000", name: "Cost of Goods Sold", type: "expense", balance: 720000 },
  { accountCode: "5100", name: "Salary Expense", type: "expense", balance: 480000 },
  { accountCode: "5200", name: "Rent Expense", type: "expense", balance: 96000 },
  { accountCode: "5300", name: "Utilities Expense", type: "expense", balance: 24000 },
  { accountCode: "5400", name: "Marketing Expense", type: "expense", balance: 85000 },
  { accountCode: "5500", name: "IT Expense", type: "expense", balance: 65000 },
];
