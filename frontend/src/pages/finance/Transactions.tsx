import { useState, useEffect, useCallback } from "react";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardBody, Badge, LoadingSpinner, EmptyState } from "../../components/ui/Card";
import { Button, Toast } from "../../components/ui/Modal";
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Info } from "lucide-react";
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (typeFilter) params.set("type", typeFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/finance/transactions?${params}`);
      setTransactions(res.data.data || []);
      setMeta(res.data.meta || null);
    } catch { setTransactions([]); }
    finally { setLoading(false); }
  }, [page, typeFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <PageWrapper title="Transactions" subtitle="Finance ledger — derived from invoice payments">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-4 flex items-start gap-2 p-3 rounded-[10px] bg-[#EDE9FE] dark:bg-[#2D1F5E]/50 text-[#4C4566] dark:text-[#B8AEDD]">
        <Info size={16} className="text-[#5B21B6] mt-0.5 shrink-0" />
        <p className="text-xs">
          Transactions are read-only here — each row comes from a recorded payment against an invoice in Accounting.
          To add a new transaction, create or record a payment on an invoice.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B93B8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchData()} placeholder="Search transactions..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] placeholder-[#9B93B8] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#4C4566] dark:text-[#B8AEDD]">
          <option value="">All Types</option>
          <option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option>
        </select>
        <Button variant="ghost" onClick={() => { setSearch(""); setTypeFilter(""); setPage(1); }} className="ml-auto">Clear filters</Button>
      </div>

      {loading ? <LoadingSpinner /> : transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Record a payment on an invoice in Accounting to see transactions here."
          icon={<Filter size={32} />}
        />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4F3] dark:border-[#2E2850]">
                  {["Date", "Type", "Category", "Description", "Invoice #", "Amount", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-[#9B93B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0 hover:bg-[#F8F7FF] dark:hover:bg-[#0E0B1F]">
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD]">{formatDate(tx.transactionDate)}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        {tx.type === "income" ? <ArrowDownLeft size={14} className="text-emerald-500" /> : <ArrowUpRight size={14} className="text-red-500" />}
                        <span className="capitalize text-[#1E1B2E] dark:text-[#EDE9FE]">{tx.type}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#1E1B2E] dark:text-[#EDE9FE]">{tx.category}</td>
                    <td className="px-5 py-3 text-[#4C4566] dark:text-[#B8AEDD] max-w-[240px] truncate">{tx.description}</td>
                    <td className="px-5 py-3 text-xs font-mono text-[#5B21B6]">{tx.reference || "—"}</td>
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
          <p className="text-xs text-[#9B93B8]">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Previous</Button>
            <Button variant="ghost" onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages}>Next</Button>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
