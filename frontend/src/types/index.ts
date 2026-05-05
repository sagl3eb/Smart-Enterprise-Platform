// ─── API Response ──────────────────────────────────────────

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  meta?: ApiMeta;
}

// ─── Auth ──────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

// ─── HR ────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  managerId: string | null;
  parentId: string | null;
  isActive: boolean;
  parent?: { id: string; name: string } | null;
  children?: { id: string; name: string }[];
  _count?: { employees: number };
}

export interface Employee {
  id: string;
  employeeCode: string;
  departmentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string;
  hireDate: string;
  salary: number;
  employmentType: string;
  status: string;
  managerId: string | null;
  dateOfBirth: string | null;
  address: string | null;
  emergencyContact: string | null;
  department?: { id: string; name: string; code: string };
  manager?: { id: string; firstName: string; lastName: string } | null;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  hoursWorked: number | null;
  overtime: number | null;
  notes: string | null;
  employee?: Pick<Employee, "id" | "firstName" | "lastName" | "employeeCode">;
}

export interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  isPaid: boolean;
  requiresApproval: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  approvedBy: string | null;
  employee?: Pick<Employee, "id" | "firstName" | "lastName" | "employeeCode"> & { department?: { id: string; name: string } };
  leaveType?: { id: string; name: string; isPaid: boolean };
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  reviewerId: string;
  reviewPeriod: string;
  overallScore: number;
  goals: Record<string, unknown> | null;
  strengths: string | null;
  improvements: string | null;
  comments: string | null;
  status: string;
  reviewDate: string;
  employee?: Pick<Employee, "id" | "firstName" | "lastName" | "employeeCode" | "position"> & { department?: { id: string; name: string } };
}

export interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
  provider: string | null;
  startDate: string;
  endDate: string;
  maxParticipants: number | null;
  cost: number | null;
  status: string;
  _count?: { enrollments: number };
}

// ─── Finance ───────────────────────────────────────────────

export interface BudgetCategory {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string | null;
  isActive: boolean;
}

export interface AnnualBudget {
  id: string;
  categoryId: string;
  fiscalYear: number;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  status: string;
  category?: BudgetCategory;
}

export interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  reference: string | null;
  costCenterId: string | null;
  transactionDate: string;
  status: string;
  costCenter?: { id: string; name: string; code: string } | null;
}

export interface FinancialReport {
  id: string;
  name: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  data: Record<string, unknown>;
  status: string;
}

export interface CostCenter {
  id: string;
  name: string;
  code: string;
  departmentId: string | null;
  budgetLimit: number | null;
  isActive: boolean;
  department?: { id: string; name: string } | null;
}

// ─── Accounting ────────────────────────────────────────────

export interface ChartOfAccount {
  id: string;
  accountCode: string;
  name: string;
  type: string;
  parentId: string | null;
  balance: number;
  isActive: boolean;
  description: string | null;
  parent?: { id: string; accountCode: string; name: string } | null;
  children?: { id: string; accountCode: string; name: string; balance: number }[];
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  account?: { id: string; accountCode: string; name: string; type: string };
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string | null;
  reference: string | null;
  status: string;
  totalDebit: number;
  totalCredit: number;
  lines?: JournalLine[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  clientName: string;
  clientEmail: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  notes?: string | null;
  budgetCategoryId?: string | null;
  lineItems?: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
}

export interface Payment {
  id: string;
  invoiceId: string | null;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  status: string;
  invoice?: { id: string; invoiceNumber: string; clientName: string } | null;
}

export interface TaxRecord {
  id: string;
  taxType: string;
  period: string;
  taxableAmount: number;
  taxAmount: number;
  status: string;
  filingDate: string | null;
  dueDate: string;
}

// ─── ICT ───────────────────────────────────────────────────

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  warrantyExpiry: string | null;
  status: string;
  assignedTo: string | null;
  location: string | null;
}

export interface SoftwareLicense {
  id: string;
  softwareName: string;
  vendor: string | null;
  licenseType: string;
  totalSeats: number;
  usedSeats: number;
  purchaseDate: string;
  expiryDate: string | null;
  annualCost: number | null;
  status: string;
}

export interface ItTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  reportedBy: string;
  assignedTo: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface NetworkDevice {
  id: string;
  name: string;
  type: string;
  ipAddress: string | null;
  macAddress: string | null;
  location: string | null;
  status: string;
  manufacturer: string | null;
  firmware: string | null;
  lastSeen: string | null;
}

// ─── Construction ──────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  clientName: string | null;
  startDate: string;
  endDate: string | null;
  estimatedBudget: number | null;
  actualBudget: number | null;
  status: string;
  progress: number;
  managerId: string | null;
  location: string | null;
  budgetCategoryId?: string | null;
  teamMemberIds?: string[];
  _count?: { milestones: number; tasks: number; siteReports: number };
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  dueDate: string;
  completedAt: string | null;
  status: string;
  sortOrder: number;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  priority: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  project?: { id: string; name: string; code: string };
  subtasks?: { id: string; title: string; status: string }[];
}

export interface Material {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  unitPrice: number;
  stockQty: number;
  reorderLevel: number;
  supplier: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface EquipmentFleet {
  id: string;
  name: string;
  type: string;
  registrationNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  status: string;
  currentLocation: string | null;
  hourlyRate: number | null;
}

export interface SiteReport {
  id: string;
  projectId: string;
  reportDate: string;
  weather: string | null;
  workforceCount: number | null;
  summary: string;
  issues: string | null;
  safetyNotes: string | null;
  project?: { id: string; name: string; code: string };
}

// ─── Workforce Analytics ───────────────────────────────────

export interface AttritionPrediction {
  id: string;
  employeeId: string;
  departmentId: string;
  riskScore: number;
  riskLevel: string;
  topFactors: { factor: string; importance: number }[];
  predictedAt: string;
  employee?: Pick<Employee, "id" | "firstName" | "lastName" | "employeeCode" | "position">;
  department?: { id: string; name: string };
}

export interface WorkforceSnapshot {
  id: string;
  departmentId: string;
  snapshotDate: string;
  headcount: number;
  avgSatisfaction: number | null;
  avgPerformance: number | null;
  turnoverRate: number | null;
  avgTenure: number | null;
  overtimeHours: number | null;
  department?: { id: string; name: string };
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  questions?: SurveyQuestion[];
  _count?: { questions: number };
}

export interface SurveyQuestion {
  id: string;
  questionText: string;
  type: string;
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
}

// ─── Predictive Analytics ──────────────────────────────────

export interface MlModel {
  name: string;
  type: string;
  version: string;
  status: string;
  metrics: Record<string, number | null>;
  trained_at: string | null;
  description: string;
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower_bound: number;
  upper_bound: number;
}

export interface AnomalyResult {
  timestamp: string;
  value: number;
  is_anomaly: boolean;
  anomaly_score: number;
  expected_min: number;
  expected_max: number;
}

// ─── Alerts ────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  name: string;
  module: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: string;
  isActive: boolean;
  cooldownMin: number;
  lastTriggered: string | null;
}

export interface Alert {
  id: string;
  ruleId: string | null;
  title: string;
  message: string;
  severity: string;
  module: string;
  isRead: boolean;
  isResolved: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface OptimizationSuggestion {
  id: string;
  module: string;
  title: string;
  description: string;
  impact: string;
  effort: string;
  status: string;
}

// ─── Dashboard ─────────────────────────────────────────────

export interface KpiDefinition {
  id: string;
  name: string;
  module: string;
  metric: string;
  unit: string | null;
  target: number | null;
  format: string;
  isActive: boolean;
}

export interface KpiCard {
  id: string;
  name: string;
  module: string;
  metric: string;
  unit: string | null;
  format: string;
  currentValue: number;
  previousValue: number;
  change: number;
  target: number | null;
  targetProgress: number | null;
  lastUpdated: string | null;
  sparkline: number[];
}

export interface DashboardLayout {
  id: string;
  userId: string;
  name: string;
  layout: Record<string, unknown>;
  isDefault: boolean;
  widgets?: DashboardWidget[];
}

export interface DashboardWidget {
  id: string;
  layoutId: string;
  widgetType: string;
  title: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  size: Record<string, unknown>;
}

// ─── Chatbot ───────────────────────────────────────────────

export interface ChatNavigationLink {
  path: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent: string | null;
  timestamp: string;
  source?: "ai" | "rule-based";
  navigate?: ChatNavigationLink[];
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
}

// ─── Shared ────────────────────────────────────────────────

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";
export type StatusType = "active" | "inactive" | "pending" | "completed" | "cancelled";

export interface SelectOption {
  value: string;
  label: string;
}
