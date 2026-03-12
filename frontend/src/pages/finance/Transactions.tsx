import { useState, useEffect } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { formatCurrency, formatDate, statusColor } from "../../utils/formatters";
import api from "../../api/client";
import type { Transaction, ApiMeta } from "../../types";

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => { fetchData(); }, [page, typeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/finance/transactions?${params}`);
      setTransactions(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch {
      setTransactions([
        { id: "1", type: "income", category: "Consulting", amount: 45000, currency: "USD", description: "Q4 consulting fee", reference: "INV-2024-089", costCenterId: null, transactionDate: "2024-12-15", status: "completed", costCenter: null },
        { id: "2", type: "expense", category: "Personnel", amount: 125000, currency: "USD", description: "December payroll", reference: "PAY-2024-12", costCenterId: null, transactionDate: "2024-12-01", status: "completed", costCenter: null },
        { id: "3", type: "expense", category: "Technology", amount: 8500, currency: "USD", description: "Cloud hosting - December", reference: "AWS-DEC24", costCenterId: null, transactionDate: "2024-12-05", status: "completed", costCenter: null },
        { id: "4", type: "income", category: "Product Sales", amount: 32000, currency: "USD", description: "Enterprise license renewal", reference: "LIC-2024-045", costCenterId: null, transactionDate: "2024-12-10", status: "completed", costCenter: null },
        { id: "5", type: "expense", category: "Marketing", amount: 12000, currency: "USD", description: "Social media campaign", reference: "MKT-2024-23", costCenterId: null, transactionDate: "2024-12-08", status: "pending", costCenter: null },
      ]);
    } finally { setLoading(false); }
  };

  const handleSearch = () => { setPage(1); fetchData(); };

  return (
    <PageWrapper title="Transactions" subtitle="Finance — Income & Expenses">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Search transactions..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-[#5B21B6] hover:bg-[#7C3AED] transition-colors ml-auto">
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      {loading ? <LoadingSpinner /> : transactions.length === 0 ? (
        <EmptyState title="No transactions found" icon={<Filter size={32} />} />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Date", "Type", "Category", "Description", "Reference", "Amount", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F] transition-colors">
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(tx.transactionDate)}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        {tx.type === "income" ? <ArrowDownLeft size={14} className="text-emerald-500" /> : <ArrowUpRight size={14} className="text-red-500" />}
                        <span className="capitalize text-[#1E1B2E] dark:text-[#EDE9FE]">{tx.type}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#1E1B2E] dark:text-[#EDE9FE]">{tx.category}</td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD] max-w-[200px] truncate">{tx.description}</td>
                    <td className="px-5 py-3 text-xs font-mono text-[#9B93B8]">{tx.reference}</td>
                    <td className={`px-5 py-3 font-semibold font-serif ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-5 py-3"><Badge className={statusColor(tx.status)}>{tx.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-[#9B93B8]">Page {meta.page} of {meta.totalPages} ({meta.total} total)</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-[8px] text-xs bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages} className="px-3 py-1.5 rounded-[8px] text-xs bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
