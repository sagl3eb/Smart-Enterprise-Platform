import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sun, Moon, Bell, ChevronDown, ShieldCheck, UserCircle, Building2 } from "lucide-react";
import useThemeStore from "../../store/themeStore";
import useAuthStore from "../../store/authStore";
import useAlertStore from "../../store/alertStore";
import useViewModeStore from "../../store/viewModeStore";
import useOrgFilterStore from "../../store/orgFilterStore";
import { api } from "../../api/client";

interface OrgOption {
  id: string;
  name: string;
  slug: string;
}

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
  const isSuper = user?.role.name === "super_admin";
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { selectedOrgId, setSelectedOrgId } = useOrgFilterStore();
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  useEffect(() => {
    if (!isSuper) return;
    api.get("/auth/organizations")
      .then((res) => {
        const list: OrgOption[] = (res.data?.data || []).map((o: { id: string; name: string; slug: string }) => ({
          id: o.id, name: o.name, slug: o.slug,
        }));
        setOrgOptions(list);
      })
      .catch(() => setOrgOptions([]));
  }, [isSuper]);

  const currentOrgLabel = selectedOrgId
    ? orgOptions.find((o) => o.id === selectedOrgId)?.name || "Selected org"
    : "All organizations";

  const allPages = [
    { label: "Dashboard", module: "Dashboard", path: "/dashboard", keywords: "home overview kpi" },
    { label: "Employee Directory", module: "Directory", path: "/directory", keywords: "directory people find colleague org chart" },
    { label: "My Leaves", module: "My Space", path: "/me/leaves", keywords: "my leave vacation pto time off" },
    { label: "My Tickets", module: "My Space", path: "/me/tickets", keywords: "my ticket issue help report" },
    { label: "My Assets", module: "My Space", path: "/me/assets", keywords: "my asset laptop equipment device" },

    { label: "HR Management", module: "HR", path: "/hr", keywords: "hr human resources staff" },
    { label: "Employees", module: "HR", path: "/hr/employees", keywords: "employee staff people hire headcount" },
    { label: "Departments", module: "HR", path: "/hr/departments", keywords: "department division team" },
    { label: "Job Roles", module: "HR", path: "/hr/job-roles", keywords: "job role title position level" },
    { label: "Leave Approvals", module: "HR", path: "/hr/leave-approvals", keywords: "leave approval pending request" },

    { label: "Finance", module: "Finance", path: "/finance", keywords: "finance" },
    { label: "Budget", module: "Finance", path: "/finance/budget", keywords: "budget money allocation" },
    { label: "Transactions", module: "Finance", path: "/finance/transactions", keywords: "transaction payment income expense" },
    { label: "Financial Statements", module: "Finance", path: "/finance/statements", keywords: "income statement balance sheet p&l" },

    { label: "Accounting", module: "Accounting", path: "/accounting", keywords: "accounting" },
    { label: "Invoices", module: "Accounting", path: "/accounting/invoices", keywords: "invoice bill receipt accounts receivable" },
    { label: "Chart of Accounts", module: "Accounting", path: "/accounting/chart-of-accounts", keywords: "account ledger balance coa" },

    { label: "ICT Management", module: "ICT", path: "/ict", keywords: "ict it tech support" },
    { label: "IT Assets", module: "ICT", path: "/ict/assets", keywords: "asset hardware laptop computer monitor" },
    { label: "IT Tickets", module: "ICT", path: "/ict/tickets", keywords: "ticket support help issue bug" },
    { label: "Software Licenses", module: "ICT", path: "/ict/licenses", keywords: "license software subscription seat" },

    { label: "Projects", module: "Projects", path: "/projects", keywords: "project construction site build milestone" },

    { label: "Workforce Analytics", module: "Workforce", path: "/workforce", keywords: "workforce attrition turnover engagement" },
    { label: "Attrition Dashboard", module: "Workforce", path: "/workforce/attrition", keywords: "attrition risk turnover" },
    { label: "Satisfaction Trends", module: "Workforce", path: "/workforce/satisfaction", keywords: "satisfaction survey trend" },
    { label: "Surveys", module: "Workforce", path: "/workforce/surveys", keywords: "survey feedback" },

    { label: "Predictive Analytics", module: "Predictive", path: "/predictive", keywords: "ml model forecast predict lightgbm prophet" },
    { label: "Alert Center", module: "Alerts", path: "/alerts", keywords: "alert notification rule warning" },
    { label: "Chatbot", module: "Chatbot", path: "/chatbot", keywords: "chat bot ai assistant ollama" },

    { label: "Settings", module: "Settings", path: "/settings", keywords: "settings profile password theme appearance" },
    { label: "User Management", module: "Admin", path: "/settings?tab=users", keywords: "user manage role create admin panel" },
    { label: "Organizations", module: "Admin", path: "/settings?tab=organization", keywords: "organization org company tenant" },
    { label: "Module Access", module: "Admin", path: "/settings?tab=modules", keywords: "module access permission feature toggle" },
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
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-[#9B93B8] dark:text-[#6B5F8F] truncate">{subtitle}</p>
        )}
      </div>

      {/* Middle: Current Organization badge */}
      {user?.organization && (
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-[12px]
          bg-[#EDE9FE] dark:bg-[#2D1F5E] border border-[#5B21B6]/20 dark:border-[#5B21B6]/40 mx-4">
          <div className="w-6 h-6 rounded-md bg-[#5B21B6] text-white flex items-center justify-center text-[10px] font-bold">
            {user.organization.slug.slice(0, 2).toUpperCase()}
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-[#5B21B6] dark:text-[#C4B5FD]">
              {user.organization.name}
            </p>
            <p className="text-[10px] text-[#7C6FAD] dark:text-[#9B8FD4] uppercase tracking-wide">
              {user.role.name === "super_admin" ? "Platform Super Admin" : `Your Organization · ${user.role.name}`}
            </p>
          </div>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Super Admin Org Filter */}
        {isSuper && (
          <div className="relative">
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-medium border
                bg-[#FEF3C7] dark:bg-[#3F2A0A] text-[#92400E] dark:text-[#FBBF24]
                border-[#F59E0B]/40 hover:bg-[#FDE68A] dark:hover:bg-[#4F3511] transition-colors"
            >
              <Building2 size={14} />
              <span className="max-w-[140px] truncate">{currentOrgLabel}</span>
              <ChevronDown size={12} />
            </button>
            {orgMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOrgMenuOpen(false)} />
                <div className="absolute right-0 top-11 w-64 z-50 rounded-[12px] overflow-hidden
                  bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] shadow-xl max-h-80 overflow-y-auto">
                  <button
                    onClick={() => {
                      if (selectedOrgId !== null) {
                        setSelectedOrgId(null);
                        setOrgMenuOpen(false);
                        window.location.reload();
                      } else {
                        setOrgMenuOpen(false);
                      }
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm border-b border-[#E8E4F3] dark:border-[#2E2850]
                      hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] ${
                        !selectedOrgId ? "bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] dark:text-[#C4B5FD] font-semibold" : "text-[#1E1B2E] dark:text-[#EDE9FE]"
                      }`}
                  >
                    All organizations
                    <p className="text-[10px] text-[#9B93B8]">Platform-wide view</p>
                  </button>
                  {orgOptions.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        if (selectedOrgId !== o.id) {
                          setSelectedOrgId(o.id);
                          setOrgMenuOpen(false);
                          window.location.reload();
                        } else {
                          setOrgMenuOpen(false);
                        }
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm border-b last:border-0 border-[#E8E4F3] dark:border-[#2E2850]
                        hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] ${
                          selectedOrgId === o.id ? "bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] dark:text-[#C4B5FD] font-semibold" : "text-[#1E1B2E] dark:text-[#EDE9FE]"
                        }`}
                    >
                      {o.name}
                      <p className="text-[10px] text-[#9B93B8] uppercase tracking-wide">{o.slug}</p>
                    </button>
                  ))}
                  {orgOptions.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-[#9B93B8]">No organizations</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

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

        {/* View Mode Toggle — admins only; super admin is locked to insights view */}
        {isAdmin && !isSuper && (
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
