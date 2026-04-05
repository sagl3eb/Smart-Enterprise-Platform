import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import useThemeStore from "./store/themeStore";
import useAuthStore from "./store/authStore";
import useViewModeStore from "./store/viewModeStore";

// Auth
import Login from "./pages/auth/Login";

// Dashboard
import Dashboard from "./pages/dashboard/Dashboard";

// Employee views
import EmployeeList from "./pages/hr/EmployeeList";
import Budget from "./pages/finance/Budget";
import Transactions from "./pages/finance/Transactions";
import Invoices from "./pages/accounting/Invoices";
import ChartOfAccounts from "./pages/accounting/ChartOfAccounts";
import Assets from "./pages/ict/Assets";
import Tickets from "./pages/ict/Tickets";
import Projects from "./pages/construction/Projects";

// Admin views
import AdminHR from "./pages/hr/AdminHR";
import AdminFinance from "./pages/finance/AdminFinance";
import AdminAccounting from "./pages/accounting/AdminAccounting";
import AdminICT from "./pages/ict/AdminICT";
import AdminConstruction from "./pages/construction/AdminConstruction";

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
  const isAdmin = user?.role.name === "admin" || user?.role.name === "super_admin";

  // Non-admins always see employee view
  if (!isAdmin) return <>{employee}</>;

  // Admins see based on toggle
  return <>{viewMode === "admin" ? admin : employee}</>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          {/* Dashboard — same for both */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* HR */}
          <Route path="/hr" element={<ProtectedRoute><ViewSwitch admin={<AdminHR />} employee={<EmployeeList />} /></ProtectedRoute>} />
          <Route path="/hr/employees" element={<ProtectedRoute><EmployeeList /></ProtectedRoute>} />
          <Route path="/hr/admin" element={<ProtectedRoute><AdminHR /></ProtectedRoute>} />
          <Route path="/hr/*" element={<ProtectedRoute><PlaceholderPage title="HR Management" module="HR" /></ProtectedRoute>} />

          {/* Finance */}
          <Route path="/finance" element={<ProtectedRoute><ViewSwitch admin={<AdminFinance />} employee={<Budget />} /></ProtectedRoute>} />
          <Route path="/finance/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
          <Route path="/finance/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/finance/admin" element={<ProtectedRoute><AdminFinance /></ProtectedRoute>} />
          <Route path="/finance/*" element={<ProtectedRoute><PlaceholderPage title="Finance" module="Finance" /></ProtectedRoute>} />

          {/* Accounting */}
          <Route path="/accounting" element={<ProtectedRoute><ViewSwitch admin={<AdminAccounting />} employee={<Invoices />} /></ProtectedRoute>} />
          <Route path="/accounting/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path="/accounting/chart-of-accounts" element={<ProtectedRoute><ChartOfAccounts /></ProtectedRoute>} />
          <Route path="/accounting/admin" element={<ProtectedRoute><AdminAccounting /></ProtectedRoute>} />
          <Route path="/accounting/*" element={<ProtectedRoute><PlaceholderPage title="Accounting" module="Accounting" /></ProtectedRoute>} />

          {/* ICT */}
          <Route path="/ict" element={<ProtectedRoute><ViewSwitch admin={<AdminICT />} employee={<Assets />} /></ProtectedRoute>} />
          <Route path="/ict/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
          <Route path="/ict/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
          <Route path="/ict/admin" element={<ProtectedRoute><AdminICT /></ProtectedRoute>} />
          <Route path="/ict/*" element={<ProtectedRoute><PlaceholderPage title="ICT Management" module="ICT" /></ProtectedRoute>} />

          {/* Projects */}
          <Route path="/projects" element={<ProtectedRoute><ViewSwitch admin={<AdminConstruction />} employee={<Projects />} /></ProtectedRoute>} />
          <Route path="/projects/list" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/projects/admin" element={<ProtectedRoute><AdminConstruction /></ProtectedRoute>} />
          <Route path="/projects/*" element={<ProtectedRoute><PlaceholderPage title="Projects" module="Construction" /></ProtectedRoute>} />

          {/* Workforce — shared (analytics pages are the same for both) */}
          <Route path="/workforce" element={<ProtectedRoute><AttritionDashboard /></ProtectedRoute>} />
          <Route path="/workforce/attrition" element={<ProtectedRoute><AttritionDashboard /></ProtectedRoute>} />
          <Route path="/workforce/satisfaction" element={<ProtectedRoute><SatisfactionTrends /></ProtectedRoute>} />
          <Route path="/workforce/surveys" element={<ProtectedRoute><Surveys /></ProtectedRoute>} />

          {/* Predictive — shared */}
          <Route path="/predictive" element={<ProtectedRoute><PredictiveAnalytics /></ProtectedRoute>} />
          <Route path="/predictive/*" element={<ProtectedRoute><PredictiveAnalytics /></ProtectedRoute>} />

          {/* Alerts — shared */}
          <Route path="/alerts" element={<ProtectedRoute><AlertCenter /></ProtectedRoute>} />
          <Route path="/alerts/*" element={<ProtectedRoute><AlertCenter /></ProtectedRoute>} />

          {/* Chatbot, Settings, Admin */}
          <Route path="/chatbot" element={<ProtectedRoute><Chatbot /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
