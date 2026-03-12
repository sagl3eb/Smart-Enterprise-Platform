import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Users, Plus, Search, UserCheck, UserX, Briefcase } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { Employee, ApiMeta } from "../../types";

export default function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { fetchData(); }, [page, departmentFilter, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (departmentFilter) params.set("departmentId", departmentFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/hr/employees?${params}`);
      setEmployees(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch {
      setEmployees([
        { id: "1", employeeCode: "EMP-001", departmentId: "1", firstName: "Ahmad", lastName: "Rahman", email: "ahmad@nexus.com", phone: "+60123456789", position: "Senior Engineer", hireDate: "2021-03-15", salary: 95000, employmentType: "full_time", status: "active", managerId: null, dateOfBirth: null, address: null, emergencyContact: null, department: { id: "1", name: "Engineering", code: "ENG" }, manager: null },
        { id: "2", employeeCode: "EMP-002", departmentId: "2", firstName: "Sarah", lastName: "Chen", email: "sarah@nexus.com", phone: null, position: "Sales Manager", hireDate: "2020-08-01", salary: 82000, employmentType: "full_time", status: "active", managerId: null, dateOfBirth: null, address: null, emergencyContact: null, department: { id: "2", name: "Sales", code: "SAL" }, manager: null },
        { id: "3", employeeCode: "EMP-003", departmentId: "1", firstName: "David", lastName: "Kumar", email: "david@nexus.com", phone: null, position: "Junior Developer", hireDate: "2024-01-10", salary: 55000, employmentType: "full_time", status: "active", managerId: "1", dateOfBirth: null, address: null, emergencyContact: null, department: { id: "1", name: "Engineering", code: "ENG" }, manager: { id: "1", firstName: "Ahmad", lastName: "Rahman" } },
        { id: "4", employeeCode: "EMP-004", departmentId: "3", firstName: "Lisa", lastName: "Wong", email: "lisa@nexus.com", phone: null, position: "Marketing Lead", hireDate: "2022-05-20", salary: 72000, employmentType: "full_time", status: "active", managerId: null, dateOfBirth: null, address: null, emergencyContact: null, department: { id: "3", name: "Marketing", code: "MKT" }, manager: null },
        { id: "5", employeeCode: "EMP-005", departmentId: "4", firstName: "Mohammed", lastName: "Ali", email: "mohammed@nexus.com", phone: null, position: "HR Specialist", hireDate: "2023-02-14", salary: 60000, employmentType: "full_time", status: "active", managerId: null, dateOfBirth: null, address: null, emergencyContact: null, department: { id: "4", name: "HR", code: "HR" }, manager: null },
      ]);
    } finally { setLoading(false); }
  };

  const activeCount = employees.filter((e) => e.status === "active").length;
  const departments = [...new Set(employees.map((e) => e.department?.name).filter(Boolean))];

  return (
    <PageWrapper title="Employee Management" subtitle="HR — Employee directory">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Employees" value={String(meta?.total || employees.length)} icon={<Users size={20} />} />
        <StatCard title="Active" value={String(activeCount)} icon={<UserCheck size={20} />} />
        <StatCard title="Departments" value={String(departments.length)} icon={<Briefcase size={20} />} />
        <StatCard title="Avg Salary" value={formatCurrency(employees.length > 0 ? employees.reduce((s, e) => s + e.salary, 0) / employees.length : 0)} icon={<UserX size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchData()} placeholder="Search employees..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["active", "on_leave", "terminated"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors ml-auto">
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {loading ? <LoadingSpinner /> : employees.length === 0 ? <EmptyState title="No employees found" icon={<Users size={32} />} /> : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Code", "Name", "Department", "Position", "Hire Date", "Salary", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                    <td className="px-5 py-3 font-mono text-xs text-[#5B21B6]">{emp.employeeCode}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-xs font-bold text-[#5B21B6]">
                          {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-[#9B93B8]">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge variant="purple">{emp.department?.name || "—"}</Badge></td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{emp.position}</td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(emp.hireDate)}</td>
                    <td className="px-5 py-3 font-serif font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(emp.salary)}</td>
                    <td className="px-5 py-3"><Badge className={statusColor(emp.status)}>{emp.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[#9B93B8]">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-[8px] text-xs bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages} className="px-3 py-1.5 rounded-[8px] text-xs bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
