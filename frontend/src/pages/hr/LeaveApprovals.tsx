import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Modal, FormTextarea, Button, Toast } from "../../components/ui/Modal";
import { ClipboardCheck, Check, X, Award, Clock, CalendarDays, Eye, Mail, Phone, Briefcase, Building2, User as UserIcon } from "lucide-react";
import { formatDate } from "../../utils/formatters";
import api from "../../api/client";
import HRSubNav from "./HRSubNav";
import type { LeaveRequest } from "../../types";

type EmployeeDetail = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  hireDate?: string | null;
  status?: string | null;
  department?: { name: string } | null;
  manager?: { firstName: string; lastName: string; position?: string | null } | null;
};

export default function LeaveApprovals() {
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Decision modal (approve/reject) with optional note
  const [decision, setDecision] = useState<{ request: LeaveRequest; action: "approve" | "reject" } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Employee details modal
  const [detailEmployee, setDetailEmployee] = useState<EmployeeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/leave-requests?status=pending&limit=50");
      setPending(res.data.data || []);
    } catch {
      setPending([]);
    } finally { setLoading(false); }
  };

  const openDecision = (request: LeaveRequest, action: "approve" | "reject") => {
    setDecision({ request, action });
    setDecisionNote("");
  };

  const submitDecision = async () => {
    if (!decision) return;
    setSubmittingDecision(true);
    try {
      await api.put(`/hr/leave-requests/${decision.request.id}/${decision.action}`, {
        decisionNote: decisionNote.trim() || undefined,
      });
      setToast({ message: `Leave ${decision.action}d`, type: "success" });
      setDecision(null);
      setDecisionNote("");
      fetchPending();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || `Failed to ${decision.action} leave`;
      setToast({ message: msg, type: "error" });
    } finally {
      setSubmittingDecision(false);
    }
  };

  const viewEmployee = async (employeeId: string) => {
    setLoadingDetail(true);
    setDetailEmployee({ id: employeeId, employeeCode: "", firstName: "", lastName: "" });
    try {
      const res = await api.get(`/hr/employees/${employeeId}`);
      setDetailEmployee(res.data.data);
    } catch {
      setToast({ message: "Failed to load employee details", type: "error" });
      setDetailEmployee(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const totalDays = pending.reduce((s, lr) => s + (lr.totalDays || 0), 0);
  const uniqueEmployees = new Set(pending.map((lr) => lr.employeeId)).size;

  return (
    <PageWrapper title="Leave Approvals" subtitle="HR - Pending leave requests">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <HRSubNav />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Pending Requests" value={String(pending.length)} icon={<ClipboardCheck size={20} />} />
        <StatCard title="Total Days Requested" value={String(totalDays)} icon={<CalendarDays size={20} />} />
        <StatCard title="Employees Waiting" value={String(uniqueEmployees)} icon={<Clock size={20} />} />
      </div>

      {loading ? <LoadingSpinner /> : pending.length === 0 ? (
        <EmptyState title="No pending leave requests" icon={<Award size={32} />} />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Employee", "Type", "Dates", "Days", "Reason", "Actions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((lr) => (
                  <tr key={lr.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-xs font-bold text-[#5B21B6]">
                          {lr.employee?.firstName?.charAt(0)}{lr.employee?.lastName?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{lr.employee?.firstName} {lr.employee?.lastName}</p>
                          <p className="text-[10px] text-[#9B93B8]">{lr.employee?.employeeCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge variant="purple">{lr.leaveType?.name}</Badge></td>
                    <td className="px-5 py-3 text-xs text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(lr.startDate)} — {formatDate(lr.endDate)}</td>
                    <td className="px-5 py-3 font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{lr.totalDays}</td>
                    <td className="px-5 py-3 text-xs text-[#9B93B8] max-w-[240px] truncate">{lr.reason || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => viewEmployee(lr.employeeId)} className="flex items-center gap-1 px-2 py-1.5 rounded-[6px] bg-[#EDE9FE] dark:bg-[#2D1F5E] text-[#5B21B6] hover:bg-[#DDD6F7] text-xs font-medium" title="View employee details"><Eye size={12} /> Details</button>
                        <button onClick={() => openDecision(lr, "approve")} className="flex items-center gap-1 px-2 py-1.5 rounded-[6px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 text-xs font-medium" title="Approve"><Check size={12} /> Approve</button>
                        <button onClick={() => openDecision(lr, "reject")} className="flex items-center gap-1 px-2 py-1.5 rounded-[6px] bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 text-xs font-medium" title="Reject"><X size={12} /> Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {/* Decision modal with optional note */}
      <Modal
        open={!!decision}
        onClose={() => { if (!submittingDecision) { setDecision(null); setDecisionNote(""); } }}
        title={decision?.action === "approve" ? "Approve Leave Request" : "Reject Leave Request"}
        size="md"
      >
        {decision && (
          <div className="space-y-4">
            <div className="p-3 rounded-[10px] bg-[#F8F7FF] dark:bg-[#0E0B1F] border border-[#E8E4F3] dark:border-[#2E2850]">
              <p className="text-sm font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{decision.request.employee?.firstName} {decision.request.employee?.lastName}</p>
              <p className="text-xs text-[#9B93B8] mt-1">{decision.request.leaveType?.name} · {formatDate(decision.request.startDate)} — {formatDate(decision.request.endDate)} · {decision.request.totalDays} days</p>
              {decision.request.reason && <p className="text-xs text-[#4C4566] dark:text-[#B8AEDD] mt-2 italic">&ldquo;{decision.request.reason}&rdquo;</p>}
            </div>
            <FormTextarea
              label="Decision note (optional)"
              value={decisionNote}
              onChange={setDecisionNote}
              placeholder={decision.action === "approve" ? "e.g. Approved — enjoy your break" : "e.g. Please reschedule — conflicts with project deadline"}
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setDecision(null); setDecisionNote(""); }} disabled={submittingDecision}>Cancel</Button>
              <Button
                variant={decision.action === "approve" ? "primary" : "danger"}
                onClick={submitDecision}
                loading={submittingDecision}
              >
                {decision.action === "approve" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Employee detail modal */}
      <Modal
        open={!!detailEmployee}
        onClose={() => setDetailEmployee(null)}
        title="Employee Details"
        size="md"
      >
        {loadingDetail ? <LoadingSpinner /> : detailEmployee && detailEmployee.firstName ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#EDE9FE] dark:bg-[#2D1F5E] flex items-center justify-center text-lg font-bold text-[#5B21B6]">
                {detailEmployee.firstName.charAt(0)}{detailEmployee.lastName.charAt(0)}
              </div>
              <div>
                <p className="text-base font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{detailEmployee.firstName} {detailEmployee.lastName}</p>
                <p className="text-xs text-[#9B93B8]">{detailEmployee.employeeCode}</p>
                {detailEmployee.status && <Badge variant={detailEmployee.status === "active" ? "success" : "default"}>{detailEmployee.status}</Badge>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {detailEmployee.position && (
                <div className="flex items-center gap-2 text-sm text-[#4C4566] dark:text-[#B8AEDD]"><Briefcase size={14} className="text-[#9B93B8]" />{detailEmployee.position}</div>
              )}
              {detailEmployee.department?.name && (
                <div className="flex items-center gap-2 text-sm text-[#4C4566] dark:text-[#B8AEDD]"><Building2 size={14} className="text-[#9B93B8]" />{detailEmployee.department.name}</div>
              )}
              {detailEmployee.email && (
                <div className="flex items-center gap-2 text-sm text-[#4C4566] dark:text-[#B8AEDD]"><Mail size={14} className="text-[#9B93B8]" />{detailEmployee.email}</div>
              )}
              {detailEmployee.phone && (
                <div className="flex items-center gap-2 text-sm text-[#4C4566] dark:text-[#B8AEDD]"><Phone size={14} className="text-[#9B93B8]" />{detailEmployee.phone}</div>
              )}
              {detailEmployee.hireDate && (
                <div className="flex items-center gap-2 text-sm text-[#4C4566] dark:text-[#B8AEDD]"><CalendarDays size={14} className="text-[#9B93B8]" />Hired {formatDate(detailEmployee.hireDate)}</div>
              )}
              {detailEmployee.manager && (
                <div className="flex items-center gap-2 text-sm text-[#4C4566] dark:text-[#B8AEDD]"><UserIcon size={14} className="text-[#9B93B8]" />Reports to {detailEmployee.manager.firstName} {detailEmployee.manager.lastName}</div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setDetailEmployee(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageWrapper>
  );
}
