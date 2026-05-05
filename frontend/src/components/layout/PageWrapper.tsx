import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Eye } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import useAuthStore from "../../store/authStore";

interface PageWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

// Module paths where super_admin is view-only. /settings and /chatbot remain editable.
const MODULE_PREFIXES = ["/hr", "/finance", "/accounting", "/ict", "/projects", "/workforce", "/predictive", "/alerts"];

export default function PageWrapper({ title, subtitle, children }: PageWrapperProps) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const isSuperAdmin = user?.role.name === "super_admin";
  const onModulePage = MODULE_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));
  const showBanner = isSuperAdmin && onModulePage;

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0E0B1F]">
      <Sidebar />
      <div className="ml-[230px] min-h-screen">
        <Topbar title={title} subtitle={subtitle} />
        <main className="p-6">
          {showBanner && (
            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-xs bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] dark:text-[#C4B5FD] border border-[#D8CFF0] dark:border-[#3E2F7A]">
              <Eye size={14} />
              <span><strong>Super Admin view-only.</strong> You can browse every organization's data but not modify module records. Use the Admin Panel for user and organization management.</span>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
