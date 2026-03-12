import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sun, Moon, Bell, ChevronDown } from "lucide-react";
import useThemeStore from "../../store/themeStore";
import useAuthStore from "../../store/authStore";
import useAlertStore from "../../store/alertStore";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { mode, toggle } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

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
        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm rounded-[10px] w-52
              bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]
              text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8]
              focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30 focus:border-[#5B21B6]"
          />
        </div>

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
