import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import useThemeStore from "./store/themeStore";
import useAuthStore from "./store/authStore";
import useViewModeStore from "./store/viewModeStore";
import api from "./api/client";

// Auth
import Login from "./pages/auth/Login";

// Dashboard
import Dashboard from "./pages/dashboard/Dashboard";
import EmployeeDashboard from "./pages/dashboard/EmployeeDashboard";

// Employee views
import EmployeeList from "./pages/hr/EmployeeList";
import LeaveApprovals from "./pages/hr/LeaveApprovals";
import JobRoles from "./pages/hr/JobRoles";
import Departments from "./pages/hr/Departments";
import Budget from "./pages/finance/Budget";
import Transactions from "./pages/finance/Transactions";
import FinancialStatements from "./pages/finance/FinancialStatements";
import Invoices from "./pages/accounting/Invoices";
import ChartOfAccounts from "./pages/accounting/ChartOfAccounts";
import Assets from "./pages/ict/Assets";
import Tickets from "./pages/ict/Tickets";
import Licenses from "./pages/ict/Licenses";
import Projects from "./pages/construction/Projects";

// Admin views
import AdminHR from "./pages/hr/AdminHR";
import AdminFinance from "./pages/finance/AdminFinance";
import AdminAccounting from "./pages/accounting/AdminAccounting";
import AdminICT from "./pages/ict/AdminICT";
import AdminLicenses from "./pages/ict/AdminLicenses";
import AdminConstruction from "./pages/construction/AdminConstruction";

// My Space — self-service pages available to all employees
import MyLeaves from "./pages/me/MyLeaves";
import MyTickets from "./pages/me/MyTickets";
import MyAssets from "./pages/me/MyAssets";
import Directory from "./pages/me/Directory";

// Shared (same for both views)
import AttritionDashboard from "./pages/workforce/AttritionDashboard";
import SatisfactionTrends from "./pages/workforce/SatisfactionTrends";
import Surveys from "./pages/workforce/Surveys";
import PredictiveAnalytics from "./pages/predictive/PredictiveAnalytics";
import AlertCenter from "./pages/alerts/AlertCenter";
import Chatbot from "./pages/chatbot/Chatbot";
import Settings from "./pages/settings/Settings";
import PlaceholderPage from "./pages/PlaceholderPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Switches between admin and employee page based on view mode
function ViewSwitch({ admin, employee }: { admin: React.ReactNode; employee: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const viewMode = useViewModeStore((s) => s.mode);
  const role = user?.role.name;
  const isAdmin = role === "admin" || role === "super_admin";

  // Super admin is locked to admin/insights view everywhere
  if (role === "super_admin") return <>{admin}</>;

  // Non-admins always see employee view
  if (!isAdmin) return <>{employee}</>;

  // Admins see based on toggle
  return <>{viewMode === "admin" ? admin : employee}</>;
}

// Remounts the entire routed tree when view mode changes so data re-fetches automatically
function ViewKeyedRoutes({ children }: { children: React.ReactNode }) {
  const viewMode = useViewModeStore((s) => s.mode);
  const user = useAuthStore((s) => s.user);
  const role = user?.role.name;
  const isAdmin = role === "admin" || role === "super_admin";
  // Super admin has no employee view — key stays constant
  const key = role === "super_admin" ? "admin" : isAdmin ? viewMode : "employee";
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

// Super admin has no personal workspace; redirect My Space routes to dashboard.
function BlockSuperAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role.name === "super_admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Super admin only has access to Dashboard, Directory, Chatbot, Settings.
// All operational module routes redirect them back to the dashboard.
function BlockSuperAdminModule({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role.name === "super_admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);
  return <>{children}</>;
}

// Refresh user profile on every app load so cached role/org stay in sync with the DB
function SessionRefresher({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  React.useEffect(() => {
    if (!isAuthenticated) return;
    api.get("/auth/profile").then((res) => {
      if (res.data?.data) setUser(res.data.data);
    }).catch(() => { /* silent — token refresh interceptor will handle 401 */ });
  }, [isAuthenticated, setUser]);
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <SessionRefresher>
      <BrowserRouter>
        <ViewKeyedRoutes>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          {/* Dashboard — admin sees executive overview, employee sees personal workspace */}
          <Route path="/dashboard" element={<ProtectedRoute><ViewSwitch admin={<Dashboard />} employee={<EmployeeDashboard />} /></ProtectedRoute>} />

          {/* My Space — self-service for every authenticated employee (no module required) */}
          <Route path="/me/leaves" element={<ProtectedRoute><BlockSuperAdmin><MyLeaves /></BlockSuperAdmin></ProtectedRoute>} />
          <Route path="/me/tickets" element={<ProtectedRoute><BlockSuperAdmin><MyTickets /></BlockSuperAdmin></ProtectedRoute>} />
          <Route path="/me/assets" element={<ProtectedRoute><BlockSuperAdmin><MyAssets /></BlockSuperAdmin></ProtectedRoute>} />
          <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />

          {/* HR */}
          <Route path="/hr" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminHR />} employee={<EmployeeList />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/hr/employees" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminHR />} employee={<EmployeeList />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/hr/leave-approvals" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminHR />} employee={<LeaveApprovals />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/hr/job-roles" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminHR />} employee={<JobRoles />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/hr/departments" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminHR />} employee={<Departments />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/hr/admin" element={<ProtectedRoute><BlockSuperAdminModule><AdminHR /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/hr/*" element={<ProtectedRoute><BlockSuperAdminModule><PlaceholderPage title="HR Management" module="HR" /></BlockSuperAdminModule></ProtectedRoute>} />

          {/* Finance */}
          <Route path="/finance" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminFinance />} employee={<Budget />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/finance/budget" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminFinance />} employee={<Budget />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/finance/transactions" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminFinance />} employee={<Transactions />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/finance/statements" element={<ProtectedRoute><BlockSuperAdminModule><FinancialStatements /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/finance/admin" element={<ProtectedRoute><BlockSuperAdminModule><AdminFinance /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/finance/*" element={<ProtectedRoute><BlockSuperAdminModule><PlaceholderPage title="Finance" module="Finance" /></BlockSuperAdminModule></ProtectedRoute>} />

          {/* Accounting */}
          <Route path="/accounting" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminAccounting />} employee={<Invoices />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/accounting/invoices" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminAccounting />} employee={<Invoices />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/accounting/chart-of-accounts" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminAccounting />} employee={<ChartOfAccounts />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/accounting/admin" element={<ProtectedRoute><BlockSuperAdminModule><AdminAccounting /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/accounting/*" element={<ProtectedRoute><BlockSuperAdminModule><PlaceholderPage title="Accounting" module="Accounting" /></BlockSuperAdminModule></ProtectedRoute>} />

          {/* ICT */}
          <Route path="/ict" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminICT />} employee={<Assets />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/ict/assets" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminICT />} employee={<Assets />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/ict/tickets" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminICT />} employee={<Tickets />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/ict/licenses" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminLicenses />} employee={<Licenses />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/ict/admin" element={<ProtectedRoute><BlockSuperAdminModule><AdminICT /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/ict/*" element={<ProtectedRoute><BlockSuperAdminModule><PlaceholderPage title="ICT Management" module="ICT" /></BlockSuperAdminModule></ProtectedRoute>} />

          {/* Projects */}
          <Route path="/projects" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminConstruction />} employee={<Projects />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/projects/list" element={<ProtectedRoute><BlockSuperAdminModule><ViewSwitch admin={<AdminConstruction />} employee={<Projects />} /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/projects/admin" element={<ProtectedRoute><BlockSuperAdminModule><AdminConstruction /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/projects/*" element={<ProtectedRoute><BlockSuperAdminModule><PlaceholderPage title="Projects" module="Projects" /></BlockSuperAdminModule></ProtectedRoute>} />

          {/* Workforce — shared (analytics pages are the same for both) */}
          <Route path="/workforce" element={<ProtectedRoute><BlockSuperAdminModule><AttritionDashboard /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/workforce/attrition" element={<ProtectedRoute><BlockSuperAdminModule><AttritionDashboard /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/workforce/satisfaction" element={<ProtectedRoute><BlockSuperAdminModule><SatisfactionTrends /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/workforce/surveys" element={<ProtectedRoute><BlockSuperAdminModule><Surveys /></BlockSuperAdminModule></ProtectedRoute>} />

          {/* Predictive — shared */}
          <Route path="/predictive" element={<ProtectedRoute><BlockSuperAdminModule><PredictiveAnalytics /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/predictive/*" element={<ProtectedRoute><BlockSuperAdminModule><PredictiveAnalytics /></BlockSuperAdminModule></ProtectedRoute>} />

          {/* Alerts — shared */}
          <Route path="/alerts" element={<ProtectedRoute><BlockSuperAdminModule><AlertCenter /></BlockSuperAdminModule></ProtectedRoute>} />
          <Route path="/alerts/*" element={<ProtectedRoute><BlockSuperAdminModule><AlertCenter /></BlockSuperAdminModule></ProtectedRoute>} />

          {/* Chatbot, Settings, Admin */}
          <Route path="/chatbot" element={<ProtectedRoute><Chatbot /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </ViewKeyedRoutes>
      </BrowserRouter>
      </SessionRefresher>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
