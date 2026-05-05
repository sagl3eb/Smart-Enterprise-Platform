import { useState, useEffect, useMemo } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, LoadingSpinner, EmptyState, Badge } from "../../components/ui/Card";
import { Search, Mail, Phone, Building2, User2, ChevronRight } from "lucide-react";
import { formatDate, statusColor } from "../../utils/formatters";
import useAuthStore from "../../store/authStore";
import api from "../../api/client";

interface Emp {
  id: string; employeeCode: string; firstName: string; lastName: string;
  email: string; phone: string | null; position: string; status: string; hireDate: string;
  managerId: string | null;
  department: { id: string; name: string; code: string } | null;
  manager: { id: string; firstName: string; lastName: string; position: string; email: string } | null;
  organization: { id: string; name: string; slug: string } | null;
}

export default function Directory() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role.name === "super_admin";
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [selected, setSelected] = useState<Emp | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/me/directory", { params: { organizationId: orgFilter } });
        setEmployees(res.data.data || []);
      } catch { setEmployees([]); }
      finally { setLoading(false); }
    })();
  }, [orgFilter]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      try {
        const res = await api.get("/auth/organizations");
        setOrgs(res.data.data || []);
      } catch { /* silent */ }
    })();
  }, [isSuperAdmin]);

  const departments = useMemo(() => {
    const set = new Map<string, string>();
    employees.forEach((e) => { if (e.department) set.set(e.department.id, e.department.name); });
    return Array.from(set, ([id, name]) => ({ id, name }));
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (dept && e.department?.id !== dept) return false;
      if (!q) return true;
      return `${e.firstName} ${e.lastName} ${e.email} ${e.position} ${e.department?.name || ""}`.toLowerCase().includes(q);
    });
  }, [employees, search, dept]);

  // Build reporting line for selected employee (walk up)
  const reportingLine = useMemo(() => {
    if (!selected) return [];
    const line: Emp[] = [];
    let current: Emp | null = selected;
    const byId = new Map(employees.map((e) => [e.id, e]));
    while (current?.managerId) {
      const mgr = byId.get(current.managerId);
      if (!mgr || line.includes(mgr)) break;
      line.unshift(mgr);
      current = mgr;
    }
    return line;
  }, [selected, employees]);

  // Direct reports for selected
  const directReports = useMemo(() => {
    if (!selected) return [];
    return employees.filter((e) => e.managerId === selected.id);
  }, [selected, employees]);

  return (
    <PageWrapper title="Employee Directory" subtitle="Browse everyone at the company">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardBody>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B5F8F]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, title, email…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E8E4F3] dark:border-[#2E2850]
                      bg-white dark:bg-[#1A1635] text-sm text-[#1E1B2E] dark:text-[#EDE9FE]
                      focus:outline-none focus:ring-2 focus:ring-[#5B21B6]" />
                </div>
                {isSuperAdmin && (
                  <select value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setSelected(null); }}
                    className="px-3 py-2 rounded-lg border border-[#E8E4F3] dark:border-[#2E2850]
                      bg-white dark:bg-[#1A1635] text-sm text-[#1E1B2E] dark:text-[#EDE9FE]">
                    <option value="">All organizations</option>
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                )}
                <select value={dept} onChange={(e) => setDept(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#E8E4F3] dark:border-[#2E2850]
                    bg-white dark:bg-[#1A1635] text-sm text-[#1E1B2E] dark:text-[#EDE9FE]">
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {loading ? <div className="py-16"><LoadingSpinner /></div> :
                filtered.length === 0 ? <EmptyState title="No matches" description="Try a different search." /> :
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map((e) => (
                    <button key={e.id} onClick={() => setSelected(e)}
                      className={`text-left p-4 rounded-xl border transition
                        ${selected?.id === e.id
                          ? "border-[#5B21B6] bg-[#F5F3FF] dark:bg-[#1F1A3F]"
                          : "border-[#E8E4F3] dark:border-[#2E2850] bg-white dark:bg-[#1A1635] hover:border-[#C4B5FD]"}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: "#EDE9FE", color: "#5B21B6" }}>
                          {e.firstName.charAt(0)}{e.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] truncate">
                            {e.firstName} {e.lastName}
                          </div>
                          <div className="text-xs text-[#6B5F8F] dark:text-[#C8BFE6] truncate">{e.position}</div>
                          <div className="text-[11px] text-[#6B5F8F] dark:text-[#B8AEDD] truncate mt-0.5">
                            {e.department?.name || "—"}
                          </div>
                          {isSuperAdmin && !orgFilter && e.organization && (
                            <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium
                              bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] dark:text-[#C4B5FD]">
                              {e.organization.slug.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              }
            </CardBody>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardBody>
              {!selected ? (
                <div className="py-10 text-center text-sm text-[#6B5F8F] dark:text-[#C8BFE6]">
                  Select someone to see their profile.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 pb-4 border-b border-[#E8E4F3] dark:border-[#2E2850] mb-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold"
                      style={{ background: "#EDE9FE", color: "#5B21B6" }}>
                      {selected.firstName.charAt(0)}{selected.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">
                        {selected.firstName} {selected.lastName}
                      </div>
                      <div className="text-sm text-[#6B5F8F] dark:text-[#C8BFE6]">{selected.position}</div>
                      <div className="mt-1"><Badge variant={statusColor(selected.status) as "default" | "success" | "warning" | "danger" | "info"}>{selected.status}</Badge></div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <InfoRow icon={<Mail size={13} />} value={selected.email} />
                    {selected.phone && <InfoRow icon={<Phone size={13} />} value={selected.phone} />}
                    {selected.department && <InfoRow icon={<Building2 size={13} />} value={selected.department.name} />}
                    <InfoRow icon={<User2 size={13} />} value={`Employee ${selected.employeeCode}`} />
                    <InfoRow icon={<User2 size={13} />} value={`Joined ${formatDate(selected.hireDate)}`} />
                  </div>

                  {(reportingLine.length > 0 || selected.manager) && (
                    <div className="mt-5 pt-5 border-t border-[#E8E4F3] dark:border-[#2E2850]">
                      <div className="text-[11px] uppercase tracking-wider text-[#6B5F8F] dark:text-[#C8BFE6] mb-2">
                        Reporting line
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-xs">
                        {reportingLine.map((m) => (
                          <span key={m.id} className="flex items-center gap-1">
                            <button onClick={() => setSelected(m)}
                              className="px-2 py-1 rounded-md bg-[#F5F3FF] dark:bg-[#1F1A3F] text-[#5B21B6] dark:text-[#C4B5FD] hover:underline">
                              {m.firstName} {m.lastName}
                            </button>
                            <ChevronRight size={12} className="text-[#6B5F8F]" />
                          </span>
                        ))}
                        <span className="px-2 py-1 rounded-md bg-[#5B21B6] text-white font-medium">
                          {selected.firstName} {selected.lastName}
                        </span>
                      </div>
                    </div>
                  )}

                  {directReports.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-[#E8E4F3] dark:border-[#2E2850]">
                      <div className="text-[11px] uppercase tracking-wider text-[#6B5F8F] dark:text-[#C8BFE6] mb-2">
                        Direct reports · {directReports.length}
                      </div>
                      <div className="space-y-1">
                        {directReports.map((r) => (
                          <button key={r.id} onClick={() => setSelected(r)}
                            className="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-[#F5F3FF] dark:hover:bg-[#1F1A3F]
                              text-[#1E1B2E] dark:text-[#EDE9FE]">
                            {r.firstName} {r.lastName}
                            <span className="text-[#6B5F8F] dark:text-[#B8AEDD]"> — {r.position}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[#1E1B2E] dark:text-[#EDE9FE]">
      <span className="text-[#5B21B6] dark:text-[#A89FC8]">{icon}</span>
      <span>{value}</span>
    </div>
  );
}
