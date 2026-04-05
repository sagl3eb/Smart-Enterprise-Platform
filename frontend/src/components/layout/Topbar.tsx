import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sun, Moon, Bell, ChevronDown, ShieldCheck, UserCircle } from "lucide-react";
import useThemeStore from "../../store/themeStore";
import useAuthStore from "../../store/authStore";
import useAlertStore from "../../store/alertStore";
import useViewModeStore from "../../store/viewModeStore";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { mode, toggle } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const { mode: viewMode, toggle: toggleView } = useViewModeStore();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const isAdmin = user?.role.name === "admin" || user?.role.name === "super_admin";
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const allPages = [
    { label: "Dashboard", module: "Dashboard", path: "/dashboard", keywords: "home overview kpi" },
    { label: "Employees", module: "HR", path: "/hr", keywords: "employee staff people hire" },
    { label: "Budget", module: "Finance", path: "/finance", keywords: "budget money allocation" },
    { label: "Transactions", module: "Finance", path: "/finance/transactions", keywords: "transaction payment income expense" },
    { label: "Invoices", module: "Accounting", path: "/accounting", keywords: "invoice bill receipt" },
    { label: "Chart of Accounts", module: "Accounting", path: "/accounting/chart-of-accounts", keywords: "account ledger balance" },
    { label: "IT Assets", module: "ICT", path: "/ict", keywords: "asset hardware laptop computer" },
    { label: "IT Tickets", module: "ICT", path: "/ict/tickets", keywords: "ticket support help issue bug" },
    { label: "Projects", module: "Projects", path: "/projects", keywords: "project construction site build" },
    { label: "Attrition Dashboard", module: "Workforce", path: "/workforce", keywords: "attrition risk turnover" },
    { label: "Satisfaction Trends", module: "Workforce", path: "/workforce/satisfaction", keywords: "satisfaction survey trend" },
    { label: "Surveys", module: "Workforce", path: "/workforce/surveys", keywords: "survey feedback" },
    { label: "Predictive Analytics", module: "Predictive", path: "/predictive", keywords: "ml model forecast predict" },
    { label: "Alert Center", module: "Alerts", path: "/alerts", keywords: "alert notification rule warning" },
    { label: "Chatbot", module: "Chatbot", path: "/chatbot", keywords: "chat bot ai assistant" },
    { label: "Settings", module: "Settings", path: "/settings", keywords: "settings profile password theme" },
    { label: "User Management", module: "Admin", path: "/settings?tab=users", keywords: "user manage role create admin" },
    { label: "Organizations", module: "Admin", path: "/settings?tab=organization", keywords: "organization org company tenant" },
  ];

  const searchResults = searchQuery.trim().length > 0
    ? allPages.filter((p) => {
        const q = searchQuery.toLowerCase();
        return p.label.toLowerCase().includes(q) || p.module.toLowerCase().includes(q) || p.keywords.includes(q);
      }).slice(0, 8)
    : [];

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b
      bg-white dark:bg-[#16122E] border-[#E8E4F3] dark:border-[#2E2850]">

      {/* Left: Title */}
      <div>
        <h1 className="text-lg font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-[#9B93B8] dark:text-[#6B5F8F]">{subtitle}</p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Global Search */}
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            className="pl-9 pr-4 py-2 text-sm rounded-[10px] w-52
              bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
              text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8]
              focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30 focus:border-[#5B21B6]"
          />
          {searchOpen && searchQuery.trim().length > 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
              <div className="absolute right-0 top-11 w-72 z-50 rounded-[12px] overflow-hidden bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] shadow-xl max-h-80 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[#9B93B8]">No results for "{searchQuery}"</div>
                ) : (
                  searchResults.map((r) => (
                    <button key={r.path} onClick={() => { navigate(r.path); setSearchOpen(false); setSearchQuery(""); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                      <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{r.label}</p>
                      <p className="text-[10px] text-[#9B93B8]">{r.module} · {r.path}</p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* View Mode Toggle (Admin only) */}
        {isAdmin && (
          <button
            onClick={toggleView}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-medium transition-colors border ${
              viewMode === "admin"
                ? "bg-[#D97706] text-white border-[#D97706]"
                : "bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] border-[#E8E4F3] dark:border-[#2E2850]"
            }`}
          >
            {viewMode === "admin" ? <ShieldCheck size={14} /> : <UserCircle size={14} />}
            {viewMode === "admin" ? "Admin View" : "Employee View"}
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-[10px] flex items-center justify-center
            bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
            text-[#4C4566] dark:text-[#B8AEDD] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] transition-colors"
        >
          {mode === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Alerts */}
        <button
          onClick={() => navigate("/alerts")}
          className="relative w-9 h-9 rounded-[10px] flex items-center justify-center
            bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
            text-[#4C4566] dark:text-[#B8AEDD] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1F5E] transition-colors"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-[10px]
              hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] transition-colors"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
              bg-[#5B21B6] text-white">
              {user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : "?"}
            </div>
            <ChevronDown size={14} className="text-[#9B93B8]" />
          </button>

          {showProfile && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
              <div className="absolute right-0 top-12 w-56 z-50 rounded-[12px] overflow-hidden
                bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850]
                shadow-lg">
                {user && (
                  <div className="px-4 py-3 border-b border-[#E8E4F3] dark:border-[#2E2850]">
                    <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-[#9B93B8]">{user.email}</p>
                  </div>
                )}
                <div className="py-1">
                  <button
                    onClick={() => { navigate("/settings"); setShowProfile(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-[#4C4566] dark:text-[#B8AEDD]
                      hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]"
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => { logout(); navigate("/login"); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400
                      hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
