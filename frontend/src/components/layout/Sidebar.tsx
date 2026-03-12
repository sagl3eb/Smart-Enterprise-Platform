import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, DollarSign, Calculator, Monitor,
  HardHat, BarChart3, TrendingUp, Bell, MessageSquare, Settings, LogOut, Shield,
} from "lucide-react";
import useAuthStore from "../../store/authStore";
import { cn } from "../../utils/formatters";

const allNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/hr", label: "HR Management", icon: Users, module: "hr" },
  { to: "/finance", label: "Finance", icon: DollarSign, module: "finance" },
  { to: "/accounting", label: "Accounting", icon: Calculator, module: "accounting" },
  { to: "/ict", label: "ICT Management", icon: Monitor, module: "ict" },
  { to: "/construction", label: "Construction", icon: HardHat, module: "construction" },
  { to: "/workforce", label: "Workforce Analytics", icon: BarChart3, module: "workforce" },
  { to: "/predictive", label: "Predictive Analytics", icon: TrendingUp, module: "predictive" },
  { to: "/alerts", label: "Alerts", icon: Bell, module: "alerts" },
  { to: "/chatbot", label: "Chatbot", icon: MessageSquare, module: null },
];

export default function Sidebar() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  // Filter nav items based on user's module access
  const userModules = (user as unknown as { moduleAccess?: string[] })?.moduleAccess || [];
  const isAdmin = user?.role.name === "admin" || user?.role.name === "super_admin";

  const navItems = allNavItems.filter((item) => {
    if (item.module === null) return true; // chatbot always visible
    if (isAdmin) return true; // admins see everything
    return userModules.includes(item.module);
  });

  return (
    <aside className="fixed left-0 top-0 h-screen w-[230px] flex flex-col z-40"
      style={{ background: "#13102A", borderRight: "1px solid #2A2550" }}>

      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b" style={{ borderColor: "#2A2550" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#5B21B6" }}>
          <span className="text-white font-bold text-sm font-serif">S</span>
        </div>
        <div>
          <span className="text-lg font-bold font-serif" style={{ color: "#F1EEFF" }}>SEP</span>
          <span className="text-[9px] ml-1.5" style={{ color: "#6B5F8F" }}>Enterprise</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-150",
                isActive ? "text-white" : "hover:text-white"
              )}
              style={{
                color: isActive ? "#F1EEFF" : "#A89FC8",
                background: isActive ? "#1A1635" : "transparent",
                ...(isActive ? { boxShadow: "inset 3px 0 0 0 #7C3AED" } : {}),
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-1 border-t pt-3" style={{ borderColor: "#2A2550" }}>
        {isAdmin && (
          <NavLink
            to="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all"
            style={{ color: "#D97706" }}
          >
            <Shield size={18} strokeWidth={1.5} />
            Admin Panel
          </NavLink>
        )}

        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all"
          style={{ color: "#A89FC8" }}
        >
          <Settings size={18} strokeWidth={1.5} />
          Settings
        </NavLink>

        <button
          onClick={() => { logout(); window.location.href = "/login"; }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13px] font-medium w-full transition-all hover:opacity-80"
          style={{ color: "#6B5F8F" }}
        >
          <LogOut size={18} strokeWidth={1.5} />
          Sign Out
        </button>

        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mt-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "#2A2550", color: "#A89FC8" }}>
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "#F1EEFF" }}>
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] truncate" style={{ color: "#6B5F8F" }}>
                {user.role.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
