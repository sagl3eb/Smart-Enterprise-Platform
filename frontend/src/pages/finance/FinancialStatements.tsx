import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PageWrapper from "../../components/layout/PageWrapper";
import { Card, CardHeader, CardBody, LoadingSpinner } from "../../components/ui/Card";
import { Button, Toast } from "../../components/ui/Modal";
import { FileBarChart, Download, ArrowLeft, FileText } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import api from "../../api/client";
import useAuthStore from "../../store/authStore";

type ReportType = "income_statement" | "balance_sheet" | "cash_flow";

interface ReportData {
  period: { start: string; end: string };
  summary: { totalIncome: number; totalExpenses: number; netIncome: number; transactionCount: number };
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
}

const REPORT_LABEL: Record<ReportType, string> = {
  income_statement: "Income Statement",
  balance_sheet: "Balance Sheet",
  cash_flow: "Cash Flow Statement",
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const startOfYearISO = () => `${new Date().getFullYear()}-01-01`;

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function downloadCSV(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((r) => r.map((cell) => {
      const s = String(cell ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function FinancialStatements() {
  const navigate = useNavigate();
  const [type, setType] = useState<ReportType>("income_statement");
  const [start, setStart] = useState(startOfYearISO());
  const [end, setEnd] = useState(todayISO());
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const generate = useCallback(async () => {
    if (!start || !end) { setToast({ message: "Pick a start and end date", type: "error" }); return; }
    if (new Date(start) > new Date(end)) { setToast({ message: "Start date must be on or before end date", type: "error" }); return; }
    setLoading(true);
    try {
      const name = `${REPORT_LABEL[type]} — ${start} to ${end}`;
      const res = await api.post("/finance/reports/generate", { name, type, periodStart: start, periodEnd: end });
      const r = res.data.data;
      if (!r?.data) throw new Error("Empty report");
      setReport(r.data);
    } catch {
      setToast({ message: "Failed to generate report", type: "error" });
    } finally { setLoading(false); }
  }, [type, start, end]);

  const csvRows = useMemo(() => {
    if (!report) return [];
    const rows: Array<Array<string | number>> = [];
    rows.push([REPORT_LABEL[type]]);
    rows.push(["Period", `${report.period.start} to ${report.period.end}`]);
    rows.push([]);

    if (type === "income_statement" || type === "cash_flow") {
      rows.push(["Section", "Category", "Amount"]);
      Object.entries(report.incomeByCategory).forEach(([cat, amt]) => rows.push(["Income", cat, amt]));
      Object.entries(report.expenseByCategory).forEach(([cat, amt]) => rows.push(["Expenses", cat, amt]));
      rows.push([]);
      rows.push(["Total Income", "", report.summary.totalIncome]);
      rows.push(["Total Expenses", "", report.summary.totalExpenses]);
      rows.push(["Net Income", "", report.summary.netIncome]);
      rows.push(["Transaction Count", "", report.summary.transactionCount]);
    } else {
      // balance_sheet: derive from totals (assets = income, liabilities = expenses, equity = net)
      rows.push(["Section", "Item", "Amount"]);
      rows.push(["Assets", "Total inflows (period)", report.summary.totalIncome]);
      rows.push(["Liabilities", "Total outflows (period)", report.summary.totalExpenses]);
      rows.push(["Equity", "Net position", report.summary.netIncome]);
      rows.push([]);
      rows.push(["Transaction Count", "", report.summary.transactionCount]);
    }
    return rows;
  }, [report, type]);

  const download = () => {
    if (!report) return;
    const filename = `${type}_${report.period.start}_${report.period.end}.csv`;
    downloadCSV(filename, csvRows);
  };

  const orgName = useAuthStore.getState().user?.organization?.name || "Organization";

  const downloadPDF = () => {
    if (!report) return;
    const orgLine = orgName;
    const incomeRows = Object.entries(report.incomeByCategory)
      .map(([k, v]) => `<tr><td>${escapeHtml(k.replace(/_/g, " "))}</td><td class="num pos">${formatCurrency(v)}</td></tr>`).join("");
    const expenseRows = Object.entries(report.expenseByCategory)
      .map(([k, v]) => `<tr><td>${escapeHtml(k.replace(/_/g, " "))}</td><td class="num neg">${formatCurrency(v)}</td></tr>`).join("");

    const isBalance = type === "balance_sheet";
    const cashLabel = type === "cash_flow" ? "Cash In" : "Income";
    const expLabel = type === "cash_flow" ? "Cash Out" : "Expenses";

    const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<title>${escapeHtml(REPORT_LABEL[type])} — ${escapeHtml(orgLine)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1E1B2E; margin: 0; }
  .header { border-bottom: 2px solid #5B21B6; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
  .brand { font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: #5B21B6; letter-spacing: -0.5px; }
  .brand .sub { font-size: 11px; font-weight: 400; color: #6B5F8F; letter-spacing: 1.5px; text-transform: uppercase; margin-left: 6px; }
  .meta { font-size: 11px; color: #6B5F8F; text-align: right; }
  .org { font-size: 13px; color: #4C4566; font-weight: 600; margin-bottom: 2px; }
  h1 { font-family: Georgia, serif; font-size: 26px; margin: 0 0 4px 0; color: #1E1B2E; }
  .period { color: #6B5F8F; font-size: 13px; margin-bottom: 24px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px; }
  .summary .tile { padding: 10px 12px; border-radius: 8px; background: #F8F7FF; border: 1px solid #EDE9FE; }
  .summary .tile .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9B93B8; margin-bottom: 4px; }
  .summary .tile .val { font-family: Georgia, serif; font-size: 16px; font-weight: 700; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #6B5F8F; border-bottom: 1px solid #E8E4F3; padding-bottom: 4px; margin: 24px 0 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 7px 10px; border-bottom: 1px solid #F1EEFF; }
  td.num { text-align: right; font-family: Georgia, serif; font-variant-numeric: tabular-nums; font-weight: 600; }
  td.pos { color: #047857; }
  td.neg { color: #B91C1C; }
  tr.total td { border-top: 2px solid #5B21B6; border-bottom: none; padding-top: 10px; font-weight: 700; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #E8E4F3; font-size: 10px; color: #9B93B8; display: flex; justify-content: space-between; }
  @media print { .no-print { display: none; } }
  .no-print { position: fixed; top: 12px; right: 12px; }
  .no-print button { background: #5B21B6; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; box-shadow: 0 2px 8px rgba(91,33,182,0.3); }
</style>
</head><body>
<div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="header">
  <div>
    <div class="brand">SEP<span class="sub">Smart Enterprise Platform</span></div>
    <div class="org">${escapeHtml(orgLine)}</div>
  </div>
  <div class="meta">
    Generated ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}<br/>
    ${new Date().toLocaleTimeString()}
  </div>
</div>

<h1>${escapeHtml(REPORT_LABEL[type])}</h1>
<div class="period">Period: ${escapeHtml(report.period.start)} &rarr; ${escapeHtml(report.period.end)}</div>

<div class="summary">
  <div class="tile"><div class="lbl">Total Income</div><div class="val pos" style="color:#047857">${formatCurrency(report.summary.totalIncome)}</div></div>
  <div class="tile"><div class="lbl">Total Expenses</div><div class="val neg" style="color:#B91C1C">${formatCurrency(report.summary.totalExpenses)}</div></div>
  <div class="tile"><div class="lbl">${isBalance ? "Equity" : "Net Income"}</div><div class="val" style="color:${report.summary.netIncome >= 0 ? "#047857" : "#B91C1C"}">${formatCurrency(report.summary.netIncome)}</div></div>
  <div class="tile"><div class="lbl">Transactions</div><div class="val" style="color:#5B21B6">${report.summary.transactionCount}</div></div>
</div>

${isBalance ? `
<h2>Assets</h2>
<table><tbody>
  <tr><td>Cash inflows (period)</td><td class="num pos">${formatCurrency(report.summary.totalIncome)}</td></tr>
</tbody></table>
<h2>Liabilities</h2>
<table><tbody>
  <tr><td>Cash outflows (period)</td><td class="num neg">${formatCurrency(report.summary.totalExpenses)}</td></tr>
</tbody></table>
<h2>Equity</h2>
<table><tbody>
  <tr class="total"><td>Net position</td><td class="num" style="color:${report.summary.netIncome >= 0 ? "#047857" : "#B91C1C"}">${formatCurrency(report.summary.netIncome)}</td></tr>
</tbody></table>
` : `
<h2>${cashLabel}</h2>
<table><tbody>
  ${incomeRows || '<tr><td colspan="2" style="color:#9B93B8;font-style:italic">No entries.</td></tr>'}
  <tr class="total"><td>Total ${cashLabel}</td><td class="num pos">${formatCurrency(report.summary.totalIncome)}</td></tr>
</tbody></table>

<h2>${expLabel}</h2>
<table><tbody>
  ${expenseRows || '<tr><td colspan="2" style="color:#9B93B8;font-style:italic">No entries.</td></tr>'}
  <tr class="total"><td>Total ${expLabel}</td><td class="num neg">${formatCurrency(report.summary.totalExpenses)}</td></tr>
</tbody></table>

<h2>Net</h2>
<table><tbody>
  <tr class="total"><td>Net Income</td><td class="num" style="color:${report.summary.netIncome >= 0 ? "#047857" : "#B91C1C"}">${formatCurrency(report.summary.netIncome)}</td></tr>
</tbody></table>
`}

<div class="footer">
  <span>${escapeHtml(orgLine)} · Confidential</span>
  <span>Page 1</span>
</div>
<script>setTimeout(function(){ window.print(); }, 350);</script>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) { setToast({ message: "Pop-ups must be allowed to export PDF", type: "error" }); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <PageWrapper title="Financial Statements" subtitle="Income Statement · Balance Sheet · Cash Flow">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#5B21B6] dark:text-[#C4B5FD] hover:underline"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-[#9B93B8] mb-1">Statement</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReportType)}
              className="w-full px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30">
              <option value="income_statement">Income Statement</option>
              <option value="balance_sheet">Balance Sheet</option>
              <option value="cash_flow">Cash Flow Statement</option>
            </select>
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-[#9B93B8] mb-1">Period start</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-[#9B93B8] mb-1">Period end</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] text-sm bg-white dark:bg-[#16122E] border border-[#E8E4F3] dark:border-[#2E2850] text-[#1E1B2E] dark:text-[#EDE9FE] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/30" />
          </div>
          <Button onClick={generate} loading={loading}><FileBarChart size={14} /> Generate</Button>
          <Button variant="secondary" onClick={download} disabled={!report}><Download size={14} /> Export CSV</Button>
          <Button variant="secondary" onClick={downloadPDF} disabled={!report}><FileText size={14} /> Export PDF</Button>
        </CardBody>
      </Card>

      {loading ? <LoadingSpinner /> : !report ? (
        <Card><CardBody><p className="text-sm text-[#9B93B8] text-center py-8">Pick a period and generate a statement.</p></CardBody></Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-sm font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">{REPORT_LABEL[type]}</h3>
              <p className="text-[10px] text-[#9B93B8] mt-1">{report.period.start} → {report.period.end}</p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                  <p className="text-[10px] uppercase text-[#9B93B8]">Total Income</p>
                  <p className="text-base font-bold text-emerald-600">{formatCurrency(report.summary.totalIncome)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                  <p className="text-[10px] uppercase text-[#9B93B8]">Total Expenses</p>
                  <p className="text-base font-bold text-red-600">{formatCurrency(report.summary.totalExpenses)}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                  <p className="text-[10px] uppercase text-[#9B93B8]">{type === "balance_sheet" ? "Equity" : "Net Income"}</p>
                  <p className={`text-base font-bold ${report.summary.netIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(report.summary.netIncome)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F8F7FF] dark:bg-[#1A1635]">
                  <p className="text-[10px] uppercase text-[#9B93B8]">Transactions</p>
                  <p className="text-base font-bold text-[#5B21B6]">{report.summary.transactionCount}</p>
                </div>
              </div>

              {type === "balance_sheet" ? (
                <div className="space-y-3">
                  <Section label="Assets" items={[{ name: "Cash inflows (period)", amount: report.summary.totalIncome }]} positive />
                  <Section label="Liabilities" items={[{ name: "Cash outflows (period)", amount: report.summary.totalExpenses }]} />
                  <Section label="Equity" items={[{ name: "Net position", amount: report.summary.netIncome }]} positive={report.summary.netIncome >= 0} />
                </div>
              ) : (
                <div className="space-y-4">
                  <Section label={type === "cash_flow" ? "Cash In" : "Income"}
                    items={Object.entries(report.incomeByCategory).map(([name, amount]) => ({ name, amount }))}
                    positive />
                  <Section label={type === "cash_flow" ? "Cash Out" : "Expenses"}
                    items={Object.entries(report.expenseByCategory).map(([name, amount]) => ({ name, amount }))} />
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </PageWrapper>
  );
}

function Section({ label, items, positive }: { label: string; items: Array<{ name: string; amount: number }>; positive?: boolean }) {
  const color = positive ? "text-emerald-600" : "text-red-600";
  const total = items.reduce((s, it) => s + it.amount, 0);
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase text-[#9B93B8] mb-2 tracking-wider">{label}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-[#9B93B8] italic">No entries.</p>
      ) : (
        <div className="space-y-1">
          {items.map((it) => (
            <div key={it.name} className="flex justify-between text-sm py-1.5 border-b border-[#E8E4F3] dark:border-[#2E2850] last:border-0">
              <span className="text-[#4C4566] dark:text-[#B8AEDD] capitalize">{it.name.replace(/_/g, " ")}</span>
              <span className={`font-semibold ${color}`}>{formatCurrency(it.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-2 border-t-2 border-[#5B21B6]/40">
            <span className="font-semibold text-[#1E1B2E] dark:text-[#EDE9FE]">Total {label}</span>
            <span className={`font-bold ${color}`}>{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
