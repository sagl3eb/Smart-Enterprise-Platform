import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Plus, Search, BookOpen } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import api from "../../api/client";
import type { ChartOfAccount } from "../../types";

const typeColors: Record<string, "success" | "danger" | "warning" | "info" | "purple"> = {
  asset: "info",
  liability: "danger",
  equity: "purple",
  revenue: "success",
  expense: "warning",
};

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => { fetchData(); }, [typeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/accounting/accounts?${params}`);
      setAccounts(res.data.data || []);
    } catch {
      setAccounts([
        { id: "1", accountCode: "1000", name: "Cash & Equivalents", type: "asset", parentId: null, balance: 450000, isActive: true, description: null, parent: null, children: [] },
        { id: "2", accountCode: "1100", name: "Accounts Receivable", type: "asset", parentId: null, balance: 185000, isActive: true, description: null, parent: null, children: [] },
        { id: "3", accountCode: "2000", name: "Accounts Payable", type: "liability", parentId: null, balance: 92000, isActive: true, description: null, parent: null, children: [] },
        { id: "4", accountCode: "3000", name: "Owner's Equity", type: "equity", parentId: null, balance: 500000, isActive: true, description: null, parent: null, children: [] },
        { id: "5", accountCode: "4000", name: "Revenue", type: "revenue", parentId: null, balance: 2450000, isActive: true, description: null, parent: null, children: [] },
        { id: "6", accountCode: "4100", name: "Consulting Revenue", type: "revenue", parentId: null, balance: 680000, isActive: true, description: null, parent: null, children: [] },
        { id: "7", accountCode: "5000", name: "Cost of Goods Sold", type: "expense", parentId: null, balance: 980000, isActive: true, description: null, parent: null, children: [] },
        { id: "8", accountCode: "5100", name: "Salaries & Wages", type: "expense", parentId: null, balance: 1450000, isActive: true, description: null, parent: null, children: [] },
        { id: "9", accountCode: "5200", name: "Operating Expenses", type: "expense", parentId: null, balance: 320000, isActive: true, description: null, parent: null, children: [] },
        { id: "10", accountCode: "2100", name: "Short-term Loans", type: "liability", parentId: null, balance: 200000, isActive: true, description: null, parent: null, children: [] },
      ]);
    } finally { setLoading(false); }
  };

  const filtered = accounts.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.accountCode.includes(q);
    }
    return true;
  });

  const totals = {
    assets: filtered.filter((a) => a.type === "asset").reduce((s, a) => s + a.balance, 0),
    liabilities: filtered.filter((a) => a.type === "liability").reduce((s, a) => s + a.balance, 0),
    equity: filtered.filter((a) => a.type === "equity").reduce((s, a) => s + a.balance, 0),
    revenue: filtered.filter((a) => a.type === "revenue").reduce((s, a) => s + a.balance, 0),
    expenses: filtered.filter((a) => a.type === "expense").reduce((s, a) => s + a.balance, 0),
  };

  return (
    <PageWrapper title="Chart of Accounts" subtitle="Accounting — Account structure & balances">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {Object.entries(totals).map(([key, value]) => (
          <Card key={key}>
            <CardBody className="py-3 px-4 text-center">
              <p className="text-[10px] font-medium text-[#9B93B8] uppercase">{key}</p>
              <p className="text-lg font-bold font-serif text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(value)}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Types</option>
          {["asset", "liability", "equity", "revenue", "expense"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors ml-auto">
          <Plus size={16} /> Add Account
        </button>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? <EmptyState title="No accounts found" icon={<BookOpen size={32} />} /> : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Code", "Account Name", "Type", "Balance", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((acc) => (
                  <tr key={acc.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                    <td className="px-5 py-3 font-mono font-medium text-[#5B21B6]">{acc.accountCode}</td>
                    <td className="px-5 py-3 font-medium text-[#1E1B2E] dark:text-[#EDE9FE]">{acc.name}</td>
                    <td className="px-5 py-3"><Badge variant={typeColors[acc.type] || "default"}>{acc.type}</Badge></td>
                    <td className="px-5 py-3 font-semibold font-serif text-[#1E1B2E] dark:text-[#EDE9FE]">{formatCurrency(acc.balance)}</td>
                    <td className="px-5 py-3"><Badge variant={acc.isActive ? "success" : "default"}>{acc.isActive ? "Active" : "Inactive"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </PageWrapper>
  );
}
