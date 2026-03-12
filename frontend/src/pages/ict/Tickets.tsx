import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, StatCard, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Ticket, Plus, Search, Clock, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { formatRelativeTime, statusColor, severityColor } from "../../utils/formatters";
import api from "../../api/client";
import type { ItTicket } from "../../types";

export default function Tickets() {
  const [tickets, setTickets] = useState<ItTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => { fetchData(); }, [statusFilter, priorityFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/ict/tickets?${params}`);
      setTickets(res.data.data || []);
    } catch {
      setTickets([
        { id: "1", ticketNumber: "TKT-001", title: "VPN connection drops frequently", description: "Users reporting VPN disconnects every 30 mins", category: "Network", priority: "high", status: "open", reportedBy: "John Doe", assignedTo: "IT Support", resolution: null, resolvedAt: null, createdAt: "2024-12-14T10:30:00Z" },
        { id: "2", ticketNumber: "TKT-002", title: "Email not syncing on mobile", description: "Outlook mobile app not receiving new emails", category: "Software", priority: "medium", status: "in_progress", reportedBy: "Jane Smith", assignedTo: "Mike Chen", resolution: null, resolvedAt: null, createdAt: "2024-12-14T09:15:00Z" },
        { id: "3", ticketNumber: "TKT-003", title: "New laptop setup request", description: "New hire starting Monday needs laptop configured", category: "Hardware", priority: "medium", status: "open", reportedBy: "HR Team", assignedTo: null, resolution: null, resolvedAt: null, createdAt: "2024-12-13T16:00:00Z" },
        { id: "4", ticketNumber: "TKT-004", title: "Printer jam on Floor 2", description: "HP printer showing paper jam error", category: "Hardware", priority: "low", status: "resolved", reportedBy: "Bob Wilson", assignedTo: "IT Support", resolution: "Cleared paper jam and cleaned rollers", resolvedAt: "2024-12-13T14:30:00Z", createdAt: "2024-12-13T11:00:00Z" },
        { id: "5", ticketNumber: "TKT-005", title: "Database server high CPU alert", description: "PostgreSQL server at 95% CPU for 2 hours", category: "Infrastructure", priority: "critical", status: "in_progress", reportedBy: "Monitoring System", assignedTo: "DevOps", resolution: null, resolvedAt: null, createdAt: "2024-12-14T08:00:00Z" },
      ]);
    } finally { setLoading(false); }
  };

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved").length;
  const criticalCount = tickets.filter((t) => t.priority === "critical" && t.status !== "resolved" && t.status !== "closed").length;

  const priorityIcon = (p: string) => {
    switch (p) {
      case "critical": return <AlertCircle size={14} className="text-red-500" />;
      case "high": return <AlertCircle size={14} className="text-orange-500" />;
      case "medium": return <Clock size={14} className="text-yellow-500" />;
      default: return <Clock size={14} className="text-blue-500" />;
    }
  };

  return (
    <PageWrapper title="IT Tickets" subtitle="ICT Management — Support tickets & issues">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Open" value={String(openCount)} icon={<Ticket size={20} />} />
        <StatCard title="In Progress" value={String(inProgressCount)} icon={<Loader size={20} />} />
        <StatCard title="Resolved" value={String(resolvedCount)} icon={<CheckCircle size={20} />} />
        <StatCard title="Critical" value={String(criticalCount)} icon={<AlertCircle size={20} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Statuses</option>
          {["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Priorities</option>
          {["critical", "high", "medium", "low"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors ml-auto">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      {loading ? <LoadingSpinner /> : tickets.length === 0 ? <EmptyState title="No tickets found" icon={<Ticket size={32} />} /> : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardBody className="flex items-start gap-4 py-4">
                <div className="flex-shrink-0 mt-0.5">{priorityIcon(ticket.priority)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-[#5B21B6]">{ticket.ticketNumber}</span>
                    <Badge className={severityColor(ticket.priority)}>{ticket.priority}</Badge>
                    <Badge className={statusColor(ticket.status)}>{ticket.status.replace("_", " ")}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE] mb-1">{ticket.title}</h3>
                  <p className="text-xs text-[#9B93B8] line-clamp-1 mb-2">{ticket.description}</p>
                  <div className="flex items-center gap-4 text-[10px] text-[#9B93B8]">
                    <span>Category: {ticket.category}</span>
                    <span>By: {ticket.reportedBy}</span>
                    {ticket.assignedTo && <span>Assigned: {ticket.assignedTo}</span>}
                    <span>{formatRelativeTime(ticket.createdAt)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
