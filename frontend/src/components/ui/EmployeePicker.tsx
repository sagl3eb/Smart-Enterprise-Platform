import { useEffect, useState } from "react";
import api from "../../api/client";

interface EmployeeOption {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  position: string;
  department?: { name?: string };
}

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  placeholder?: string;
  allowUnassigned?: boolean;
}

export function formatEmployeeLabel(e: EmployeeOption) {
  return `${e.employeeCode} — ${e.firstName} ${e.lastName} (${e.position})`;
}

export default function EmployeePicker({ label, value, onChange, required, placeholder = "Select employee", allowUnassigned = true }: Props) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/hr/employees?limit=500&status=active");
        if (!alive) return;
        setEmployees(res.data.data || []);
      } catch { setEmployees([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <label className="block text-xs font-medium text-[#4C4566] dark:text-[#B8AEDD] mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30"
      >
        {allowUnassigned && <option value="">{loading ? "Loading..." : placeholder}</option>}
        {employees.map((e) => {
          const lab = formatEmployeeLabel(e);
          return <option key={e.id} value={lab}>{lab}</option>;
        })}
        {value && !employees.some((e) => formatEmployeeLabel(e) === value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    </div>
  );
}
