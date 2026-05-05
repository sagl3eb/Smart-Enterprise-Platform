import { useNavigate, useLocation } from "react-router-dom";
import { Users, ClipboardCheck, Briefcase, Building2 } from "lucide-react";

const tabs = [
  { label: "Employees", path: "/hr/employees", icon: Users, match: ["/hr", "/hr/employees"] },
  { label: "Departments", path: "/hr/departments", icon: Building2, match: ["/hr/departments"] },
  { label: "Leave Approvals", path: "/hr/leave-approvals", icon: ClipboardCheck, match: ["/hr/leave-approvals"] },
  { label: "Job Roles", path: "/hr/job-roles", icon: Briefcase, match: ["/hr/job-roles"] },
];

export default function HRSubNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex gap-1 mb-6 border-b border-[#E8E4F3] dark:border-[#2E2850]">
      {tabs.map((tab) => {
        const active = tab.match.includes(location.pathname);
        const Icon = tab.icon;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active
                ? "border-[#5B21B6] text-[#5B21B6] dark:text-[#C4B5FD]"
                : "border-transparent text-[#9B93B8] hover:text-[#4C4566] dark:hover:text-[#B8AEDD]"
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
