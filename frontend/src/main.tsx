import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import useThemeStore from "./store/themeStore";
import useAuthStore from "./store/authStore";

// Auth pages
import Login from "./pages/auth/Login";

// Dashboard
import Dashboard from "./pages/dashboard/Dashboard";

// Finance
import Budget from "./pages/finance/Budget";
import Transactions from "./pages/finance/Transactions";

// Accounting
import Invoices from "./pages/accounting/Invoices";
import ChartOfAccounts from "./pages/accounting/ChartOfAccounts";

// ICT Management
import Assets from "./pages/ict/Assets";
import Tickets from "./pages/ict/Tickets";

// HR
import EmployeeList from "./pages/hr/EmployeeList";

// Construction
import Projects from "./pages/construction/Projects";

// Predictive Analytics
import PredictiveAnalytics from "./pages/predictive/PredictiveAnalytics";

// Alerts
import AlertCenter from "./pages/alerts/AlertCenter";

// Chatbot
import Chatbot from "./pages/chatbot/Chatbot";

// Settings
import Settings from "./pages/settings/Settings";

// Workforce Analytics
import AttritionDashboard from "./pages/workforce/AttritionDashboard";
import SatisfactionTrends from "./pages/workforce/SatisfactionTrends";
import Surveys from "./pages/workforce/Surveys";

// Placeholder for unbuilt pages
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
          {/* Public routes */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          <Route path="/hr" element={<ProtectedRoute><EmployeeList /></ProtectedRoute>} />
          <Route path="/hr/employees" element={<ProtectedRoute><EmployeeList /></ProtectedRoute>} />
          <Route path="/hr/*" element={<ProtectedRoute><PlaceholderPage title="HR Management" module="HR" /></ProtectedRoute>} />

          <Route path="/finance" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
          <Route path="/finance/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
          <Route path="/finance/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/finance/*" element={<ProtectedRoute><PlaceholderPage title="Finance" module="Finance" /></ProtectedRoute>} />

          <Route path="/accounting" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path="/accounting/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
          <Route path="/accounting/chart-of-accounts" element={<ProtectedRoute><ChartOfAccounts /></ProtectedRoute>} />
          <Route path="/accounting/*" element={<ProtectedRoute><PlaceholderPage title="Accounting" module="Accounting" /></ProtectedRoute>} />

          <Route path="/ict" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
          <Route path="/ict/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
          <Route path="/ict/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
          <Route path="/ict/*" element={<ProtectedRoute><PlaceholderPage title="ICT Management" module="ICT" /></ProtectedRoute>} />

          <Route path="/construction" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/construction/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/construction/*" element={<ProtectedRoute><PlaceholderPage title="Construction" module="Construction" /></ProtectedRoute>} />

          <Route path="/workforce" element={<ProtectedRoute><AttritionDashboard /></ProtectedRoute>} />
          <Route path="/workforce/attrition" element={<ProtectedRoute><AttritionDashboard /></ProtectedRoute>} />
          <Route path="/workforce/satisfaction" element={<ProtectedRoute><SatisfactionTrends /></ProtectedRoute>} />
          <Route path="/workforce/surveys" element={<ProtectedRoute><Surveys /></ProtectedRoute>} />

          <Route path="/predictive" element={<ProtectedRoute><PredictiveAnalytics /></ProtectedRoute>} />
          <Route path="/predictive/*" element={<ProtectedRoute><PredictiveAnalytics /></ProtectedRoute>} />

          <Route path="/alerts" element={<ProtectedRoute><AlertCenter /></ProtectedRoute>} />
          <Route path="/alerts/*" element={<ProtectedRoute><AlertCenter /></ProtectedRoute>} />

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
