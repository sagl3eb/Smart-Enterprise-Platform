import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Toast } from "../../components/ui/Modal";
import { BarChartWidget, DonutChartWidget } from "../../components/charts/Charts";
import { Users, Building, ClipboardCheck, Award, Briefcase, DollarSign, TrendingUp, Calendar, Check, X } from "lucide-react";
import { formatDate, formatCurrency } from "../../utils/formatters";
import api from "../../api/client";
import useAuthStore from "../../store/authStore";
import HRSubNav from "./HRSubNav";
import type { Department, LeaveRequest, Employee } from "../../types";

type AdminHRSection = "employees" | "departments" | "leave-approvals" | "job-roles";

function sectionFromPath(pathname: string): AdminHRSection {
  if (pathname.startsWith("/hr/departments")) return "departments";
  if (pathname.startsWith("/hr/leave-approvals")) return "leave-approvals";
  if (pathname.startsWith("/hr/job-roles")) return "job-roles";
  return "employees";
}

type JobRole = { id: string; name: string; description: string | null; level: string | null; isActive: boolean };

export default function AdminHR() {
  // canWrite no longer needed — admin HR is fully insights-only.
  void useAuthStore;
  const location = useLocation();
  const section = sectionFromPath(location.pathname);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, deptRes, leaveRes, rolesRes, empRes, allLeaveRes] = await Promise.allSettled([
        api.get("/hr/stats"),
        api.get("/hr/departments"),
        api.get("/hr/leave-requests?status=pending&limit=50"),
        api.get("/hr/job-roles"),
        api.get("/hr/employees?limit=500"),
        api.get("/hr/leave-requests?limit=200"),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data.data);
      if (deptRes.status === "fulfilled") setDepartments(deptRes.value.data.data || []);
      if (leaveRes.status === "fulfilled") setPendingLeaves(leaveRes.value.data.data || []);
      if (rolesRes.status === "fulfilled") setJobRoles(rolesRes.value.data.data || []);
      if (empRes.status === "fulfilled") setEmployees(empRes.value.data.data || []);
      if (allLeaveRes.status === "fulfilled") setAllLeaves(allLeaveRes.value.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const s = stats as { totalEmployees?: number; activeEmployees?: number; departmentCount?: number; pendingLeaves?: number; averageSalary?: number; employmentTypeBreakdown?: Array<{ type: string; count: number }> } | null;
  const deptChartData = departments.map((d) => ({ name: d.name, employees: d._count?.employees || 0 }));
  const activeRoles = jobRoles.filter((r) => r.isActive).length;

  // Cross-section aggregations memoized so they only recompute when source data changes.
  const employeesByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of employees) map[e.status] = (map[e.status] || 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const employmentTypeData = useMemo(() => {
    const breakdown = s?.employmentTypeBreakdown;
    if (breakdown && breakdown.length > 0) return breakdown.map((b) => ({ name: b.type, value: b.count }));
    const map: Record<string, number> = {};
    for (const e of employees) map[e.employmentType] = (map[e.employmentType] || 0) + 1;
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [s?.employmentTypeBreakdown, employees]);

  const tenureBuckets = useMemo(() => {
    const now = Date.now();
    const buckets = { "<1y": 0, "1-3y": 0, "3-5y": 0, "5y+": 0 };
    for (const e of employees) {
      const years = (now - new Date(e.hireDate).getTime()) / (365 * 86400000);
      if (years < 1) buckets["<1y"]++;
      else if (years < 3) buckets["1-3y"]++;
      else if (years < 5) buckets["3-5y"]++;
      else buckets["5y+"]++;
    }
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [employees]);

  const roleLevelData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of jobRoles) {
      const k = r.level || "—";
      map[k] = (map[k] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [jobRoles]);

  const leaveTypeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const lr of allLeaves) {
      const k = lr.leaveType?.name || "Unknown";
      map[k] = (map[k] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [allLeaves]);

  const leaveStatusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const lr of allLeaves) map[lr.status] = (map[lr.status] || 0) + 1;
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [allLeaves]);

  const recentHires = useMemo(() => {
    return [...employees]
      .sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime())
      .slice(0, 8);
  }, [employees]);

  const subtitle = section === "departments" ? "Admin View - Departments insights"
    : section === "leave-approvals" ? "Admin View - Leave activity & pending approvals"
    : section === "job-roles" ? "Admin View - Job role catalogue & level distribution"
    : "Admin View - Workforce overview";

  if (loading) return (
    <PageWrapper title="HR Administration" subtitle={subtitle}>
      <HRSubNav />
      <LoadingSpinner />
    </PageWrapper>
  );

  return (
    <PageWrapper title="HR Administration" subtitle={subtitle}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <HRSubNav />

      {section === "employees" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Employees" value={String(s?.totalEmployees || employees.length)} icon={<Users size={20} />} />
          <StatCard title="Active" value={String(s?.activeEmployees || employees.filter((e) => e.status === "active").length)} icon={<Users size={20} />} />
          <StatCard title="Average Salary" value={formatCurrency(s?.averageSalary || 0)} icon={<DollarSign size={20} />} />
          <StatCard title="Departments" value={String(s?.departmentCount || departments.length)} icon={<Building size={20} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Headcount by Department</h3></CardHeader>
            <CardBody>
              {deptChartData.length > 0 ? <BarChartWidget data={deptChartData} bars={[{ key: "employees", color: "#5B21B6" }]} xKey="name" height={260} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Employment Type</h3></CardHeader>
            <CardBody>
              {employmentTypeData.length > 0 ? <DonutChartWidget data={employmentTypeData} height={260} innerRadius={50} outerRadius={85} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Employees by Status</h3></CardHeader>
            <CardBody>
              {employeesByStatus.length > 0 ? <DonutChartWidget data={employeesByStatus} height={260} innerRadius={50} outerRadius={85} colors={["#10B981", "#F59E0B", "#9CA3AF", "#DC2626"]} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><TrendingUp size={14} className="inline mr-2" />Tenure Distribution</h3>
            </CardHeader>
            <CardBody>
              {tenureBuckets.some((b) => b.count > 0) ? <BarChartWidget data={tenureBuckets} bars={[{ key: "count", color: "#7C3AED" }]} xKey="name" height={240} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><Calendar size={14} className="inline mr-2" />Recent Hires</h3>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              {recentHires.length === 0 ? <div className="p-5"><EmptyState title="No employees yet" icon={<Users size={24} />} /></div> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                      {["Name", "Position", "Department", "Hired"].map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentHires.map((e) => (
                      <tr key={e.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                        <td className="px-4 py-2 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{e.firstName} {e.lastName}</td>
                        <td className="px-4 py-2 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{e.position}</td>
                        <td className="px-4 py-2 text-xs"><Badge variant="purple">{e.department?.name || "—"}</Badge></td>
                        <td className="px-4 py-2 text-xs text-[#9B93B8]">{formatDate(e.hireDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
      </>)}

      {section === "departments" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Departments" value={String(departments.length)} icon={<Building size={20} />} />
          <StatCard title="Active" value={String(departments.filter((d) => d.isActive).length)} icon={<Building size={20} />} />
          <StatCard title="Total Employees" value={String(departments.reduce((sum, d) => sum + (d._count?.employees || 0), 0))} icon={<Users size={20} />} />
          <StatCard title="Avg per Department" value={departments.length > 0 ? String(Math.round(departments.reduce((sum, d) => sum + (d._count?.employees || 0), 0) / departments.length)) : "0"} icon={<TrendingUp size={20} />} />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Headcount by Department</h3>
          </CardHeader>
          <CardBody>
            {deptChartData.length > 0 ? <BarChartWidget data={deptChartData} bars={[{ key: "employees", color: "#5B21B6" }]} xKey="name" height={300} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">All Departments</h3>
          </CardHeader>
          <CardBody className="overflow-x-auto p-0">
            {departments.length === 0 ? <div className="p-5"><EmptyState title="No departments yet" icon={<Building size={24} />} /></div> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                    {["Name", "Code", "Employees", "Status"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                      <td className="px-5 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{d.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[#5B21B6]">{d.code}</td>
                      <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{d._count?.employees || 0}</td>
                      <td className="px-5 py-3"><Badge variant={d.isActive ? "success" : "default"}>{d.isActive ? "Active" : "Inactive"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </>)}

      {section === "leave-approvals" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Pending" value={String(pendingLeaves.length)} icon={<ClipboardCheck size={20} />} />
          <StatCard title="Approved (recent)" value={String(allLeaves.filter((lr) => lr.status === "approved").length)} icon={<Check size={20} />} />
          <StatCard title="Rejected (recent)" value={String(allLeaves.filter((lr) => lr.status === "rejected").length)} icon={<X size={20} />} />
          <StatCard title="Total Tracked" value={String(allLeaves.length)} icon={<Calendar size={20} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Leave Status</h3></CardHeader>
            <CardBody>
              {leaveStatusBreakdown.some((b) => b.count > 0) ? <BarChartWidget data={leaveStatusBreakdown} bars={[{ key: "count", color: "#5B21B6" }]} xKey="name" height={240} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Leave Type Mix</h3></CardHeader>
            <CardBody>
              {leaveTypeBreakdown.length > 0 ? <DonutChartWidget data={leaveTypeBreakdown} height={240} innerRadius={50} outerRadius={85} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><ClipboardCheck size={16} className="inline mr-2" />Pending Leave Requests</h3></CardHeader>
          <CardBody>
            {pendingLeaves.length === 0 ? <EmptyState title="No pending leave requests" icon={<Award size={24} />} /> : (
              <table className="w-full text-sm"><thead><tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                {["Employee", "Type", "Dates", "Days", "Reason"].map((h) => <th key={h} className="text-left px-4 py-2 text-xs font-medium text-[#9B93B8]">{h}</th>)}
              </tr></thead><tbody>
                {pendingLeaves.map((lr) => (
                  <tr key={lr.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{lr.employee?.firstName} {lr.employee?.lastName}</td>
                    <td className="px-4 py-3"><Badge variant="purple">{lr.leaveType?.name}</Badge></td>
                    <td className="px-4 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(lr.startDate)} — {formatDate(lr.endDate)}</td>
                    <td className="px-4 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{lr.totalDays}</td>
                    <td className="px-4 py-3 text-xs text-[#9B93B8] max-w-[150px] truncate">{lr.reason || "—"}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </CardBody>
        </Card>
      </>)}

      {section === "job-roles" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Roles" value={String(jobRoles.length)} icon={<Briefcase size={20} />} />
          <StatCard title="Active" value={String(activeRoles)} icon={<Briefcase size={20} />} />
          <StatCard title="Inactive" value={String(jobRoles.length - activeRoles)} icon={<Briefcase size={20} />} />
          <StatCard title="Levels Used" value={String(roleLevelData.length)} icon={<TrendingUp size={20} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]"><Briefcase size={16} className="inline mr-2" />All Job Roles</h3>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              {jobRoles.length === 0 ? (
                <div className="p-5"><EmptyState title="No job roles yet" icon={<Briefcase size={24} />} /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                      {["Name", "Level", "Description", "Status"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobRoles.map((r) => (
                      <tr key={r.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                        <td className="px-5 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{r.name}</td>
                        <td className="px-5 py-3"><Badge variant="purple">{r.level || "—"}</Badge></td>
                        <td className="px-5 py-3 text-xs text-[#9B93B8] max-w-[280px] truncate">{r.description || "—"}</td>
                        <td className="px-5 py-3"><Badge variant={r.isActive ? "success" : "default"}>{r.isActive ? "Active" : "Inactive"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Roles by Level</h3></CardHeader>
            <CardBody>
              {roleLevelData.length > 0 ? <DonutChartWidget data={roleLevelData} height={300} innerRadius={55} outerRadius={95} /> : <p className="text-xs text-[#9B93B8] text-center py-8">No data</p>}
            </CardBody>
          </Card>
        </div>
      </>)}

    </PageWrapper>
  );
}
