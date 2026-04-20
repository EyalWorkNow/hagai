import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  MoreVertical,
  Search,
  ShieldAlert,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, isSameMonth, parseISO, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "../lib/utils";
import { PlatformTransaction, User } from "../types";
import { useAppData } from "../lib/appData";

const moneyFormatter = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatCurrency(value: number) {
  return `₪${moneyFormatter.format(value)}`;
}

function formatDate(value?: string) {
  if (!value) return "ללא תאריך";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `₪${Math.round(value / 1_000_000)}M`;
  if (abs >= 1_000) return `₪${Math.round(value / 1_000)}K`;
  return formatCurrency(Math.round(value));
}

function transactionStatusLabel(status: PlatformTransaction["status"]) {
  switch (status) {
    case "completed":
      return "הושלם";
    case "in_progress":
      return "בתהליך";
    case "pending":
      return "ממתין";
    default:
      return status;
  }
}

/**
 * AdminPaymentsView: System-wide financial oversight backed by the updated transaction DB.
 */
export default function AdminPaymentsView({ user: _user }: { user: User }) {
  const { db } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<{
    transaction: PlatformTransaction;
    propertyLabel: string;
    tenantLabel: string;
    contractLabel: string;
  } | null>(null);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const transactions = useMemo(() => {
    // Cache the parsed dates to prevent N log N redundant Date.parse calls in sort comparator
    const withParsedDates = db.transactions.map(t => ({
      ...t,
      _parsedDate: Date.parse(t.createdAt) || 0
    }));
    return withParsedDates.sort((a, b) => b._parsedDate - a._parsedDate);
  }, [db.transactions]);

  const transactionRows = useMemo(() => {
    const propertyMap = new Map(db.properties.map(p => [p.id, p]));
    const contractMap = new Map(db.contracts.map(c => [c.id, c]));
    
    // Process only up to 500 latest transactions to avoid unresponsiveness if DB is massive
    return transactions.slice(0, 500).map((transaction) => {
      const property = propertyMap.get(transaction.propertyId);
      const contract = contractMap.get(transaction.contractId);
      return {
        transaction,
        propertyLabel: property?.address || transaction.propertyId || "נכס לא משויך",
        tenantLabel: contract?.tenantName || "שוכר לא זוהה",
        contractLabel: contract?.id || transaction.contractId || "ללא חוזה משויך",
        providerLabel:
          transaction.provider === "insurance"
            ? "ביטוח"
            : transaction.provider === "midrag"
              ? "מידרג"
              : "יד2",
        channelLabel:
          transaction.channel === "maintenance_companies"
            ? "חברות תחזוקה"
            : transaction.channel === "foreign_resident_agencies"
              ? "משרדי נדל\"ן לתושבי חוץ"
              : "נדל\"ן מסחרי",
      };
    });
  }, [db.contracts, db.properties, transactions]);

  const stats = useMemo(() => {
    let totalVolume = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let pendingCount = 0;
    let completedVolume = 0;
    let pendingVolume = 0;
    
    for (let i = 0; i < transactions.length; i++) {
        const amount = transactions[i].amount;
        totalVolume += amount;
        if (transactions[i].status === "completed") {
            completedCount++;
            completedVolume += amount;
        } else if (transactions[i].status === "in_progress") {
            inProgressCount++;
            pendingVolume += amount;
        } else {
            pendingCount++;
            pendingVolume += amount;
        }
    }

    return {
      totalVolume,
      completedCount,
      inProgressCount,
      pendingCount,
      completedVolume,
      pendingVolume,
      feesCaptured: transactions.length * 20,
      collectionRate: transactions.length > 0 ? (completedCount / transactions.length) * 100 : 0,
      connectedIntegrations: db.integrations.filter((integration) => integration.status === "connected").length,
      averageTransactionValue: transactions.length > 0 ? totalVolume / transactions.length : 0,
    };
  }, [db.integrations, transactions]);

  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => subMonths(new Date(), index)).reverse();
    
    // Group by month/year string to avoid N * M calls to isSameMonth / parseISO
    const buckets: Record<string, typeof transactions> = {};
    for (const month of months) {
      const key = `${month.getFullYear()}-${month.getMonth()}`;
      buckets[key] = [];
    }
    
    // Build buckets linearly O(N)
    for (let i = 0; i < transactions.length; i++) {
        const d = new Date(transactions[i]._parsedDate);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (buckets[key]) {
            buckets[key].push(transactions[i]);
        }
    }

    return months.map((month) => {
      const key = `${month.getFullYear()}-${month.getMonth()}`;
      const monthTransactions = buckets[key];
      let collected = 0;
      let pending = 0;

      for (let i = 0; i < monthTransactions.length; i++) {
          if (monthTransactions[i].status === "completed") {
              collected += monthTransactions[i].amount;
          } else {
              pending += monthTransactions[i].amount;
          }
      }

      return {
        name: format(month, "LLL", { locale: he }),
        collected,
        fees: monthTransactions.length * 20,
        pending,
      };
    });
  }, [transactions]);

  const filteredTransactions = useMemo(
    () =>
      transactionRows.filter((row) => {
        const matchesStatus =
          filterStatus === "all" || row.transaction.status === filterStatus;
        const haystack = [
          row.propertyLabel,
          row.tenantLabel,
          row.transaction.id,
          row.providerLabel,
          row.channelLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchesStatus && (!deferredQuery || haystack.includes(deferredQuery));
      }),
    [deferredQuery, filterStatus, transactionRows],
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 text-right" dir="rtl">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-slate-900 italic font-display">
            ניהול פיננסי מערכתי
          </h1>
          <p className="mt-3 text-[13px] font-bold tracking-[0.12em] text-slate-400">
            נפח עסקאות, עמלות פלטפורמה וסטטוסי השלמה מתוך מסד העסקאות המעודכן
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-8 py-4 text-[13px] font-black tracking-[0.12em] text-slate-900 shadow-sm transition-all hover:bg-slate-50">
            <Download size={18} />
            <span>ייצוא דוח שנתי</span>
          </button>

          <div className="hidden h-14 w-px bg-slate-200 lg:block" />

          <div className="flex items-center gap-4 rounded-2xl bg-slate-900 p-2 text-white shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <ShieldAlert size={24} />
            </div>
            <div className="pl-4 pr-2 text-right">
              <p className="text-[9px] font-black tracking-[0.16em] text-white/50">
                סליקה ומעקב
              </p>
              <p className="mt-1 text-[13px] font-black tracking-tight">
                מסד עסקאות SQL פעיל
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KPIItem
          label="נפח עסקאות מערכתי"
          value={formatCurrency(stats.totalVolume)}
          trend={`${stats.collectionRate.toFixed(0)}% הושלמו`}
          trendUp={stats.collectionRate >= 70}
          icon={<TrendingUp size={22} />}
          color="blue"
        />
        <KPIItem
          label="עמלות פלטפורמה"
          value={formatCurrency(Math.round(stats.feesCaptured))}
          trend={`${transactions.length.toLocaleString("he-IL")} עסקאות`}
          trendUp
          icon={<BarChart3 size={22} />}
          color="emerald"
        />
        <KPIItem
          label="עסקאות שהושלמו"
          value={stats.completedCount.toLocaleString("he-IL")}
          trend={formatCompactCurrency(stats.completedVolume)}
          trendUp
          icon={<CheckCircle2 size={22} />}
          color="indigo"
        />
        <KPIItem
          label="עסקאות ממתינות/בתהליך"
          value={(stats.pendingCount + stats.inProgressCount).toLocaleString("he-IL")}
          trend={formatCompactCurrency(stats.pendingVolume)}
          trendUp={stats.pendingCount + stats.inProgressCount < stats.completedCount}
          icon={<AlertCircle size={22} />}
          color="rose"
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="dashboard-card flex min-h-[450px] flex-col border-slate-100 p-8 shadow-sleek lg:col-span-8 md:p-10">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 italic font-display">
                מגמות עסקאות ועמלות
              </h2>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                השוואה בין עסקאות שהושלמו, עמלות שנצברו ועסקאות שעדיין לא נסגרו
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-6">
              <ChartLegend label="גבייה בפועל" color="#0f172a" />
              <ChartLegend label="עמלות" color="#2563eb" />
              <ChartLegend label="ממתין/בתהליך" color="#fb7185" />
            </div>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <InsightChip
              label="ממוצע חודשי"
              value={formatCurrency(Math.round(stats.totalVolume / Math.max(chartData.length, 1)))}
              tone="slate"
            />
            <InsightChip
              label="שיעור השלמה"
              value={`${stats.collectionRate.toFixed(0)}%`}
              tone="blue"
            />
            <InsightChip
              label="ממוצע לעסקה"
              value={formatCompactCurrency(stats.averageTransactionValue)}
              tone="rose"
            />
          </div>

          <div className="w-full min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  yAxisId="money"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(value) => formatCompactCurrency(value)}
                />
                <YAxis
                  yAxisId="fees"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(value) => `₪${Math.round(value)}`}
                />
                <Tooltip cursor={{ fill: "rgba(37,99,235,0.06)" }} content={<FinanceTooltip />} />
                <Bar yAxisId="money" dataKey="pending" barSize={22} radius={[10, 10, 0, 0]} fill="#fecdd3" />
                <Area
                  yAxisId="money"
                  type="monotone"
                  dataKey="collected"
                  stroke="#0f172a"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCollected)"
                />
                <Line
                  yAxisId="fees"
                  type="monotone"
                  dataKey="fees"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-8 lg:col-span-4">
          <div className="dashboard-card relative overflow-hidden bg-slate-950 p-10 text-white shadow-2xl">
            <div className="absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-12 rounded-full bg-blue-600/10 blur-3xl" />
            <h3 className="relative z-10 mb-8 border-r-4 border-blue-600 px-2 text-xl font-black tracking-tighter">
              תובנות סיכון
            </h3>
            <div className="relative z-10 space-y-6">
              <RiskMetric
                label="עסקאות ממתינות"
                value={stats.pendingCount.toLocaleString("he-IL")}
                color="text-amber-400"
              />
              <RiskMetric
                label="עסקאות בתהליך"
                value={stats.inProgressCount.toLocaleString("he-IL")}
                color="text-rose-400"
              />
              <RiskMetric
                label="אינטגרציות מחוברות"
                value={stats.connectedIntegrations.toString()}
                color="text-blue-400"
              />
            </div>
            <button className="mt-10 w-full rounded-2xl border border-white/5 bg-white/10 py-4 text-[10px] font-black tracking-[0.14em] text-white transition-all hover:bg-white/20">
              הפק דוח חריגים
            </button>
          </div>

          <div className="dashboard-card border-slate-100 p-8">
            <h3 className="mb-6 text-xs font-black tracking-[0.14em] text-slate-400">
              יעדי השלמה ועמלות
            </h3>
            <div className="space-y-6">
              <GoalProgress label="השלמת עסקאות" progress={Math.round(stats.collectionRate)} target={`${stats.completedCount.toLocaleString("he-IL")} הושלמו`} />
              <GoalProgress
                label="צבירת עמלות"
                progress={Math.round((stats.feesCaptured / Math.max(stats.totalVolume, 1)) * 100)}
                target={formatCurrency(stats.feesCaptured)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card overflow-hidden border-slate-100 p-0 shadow-sleek">
        <div className="flex flex-col items-center justify-between gap-8 border-b border-slate-100 bg-slate-50/50 p-8 md:flex-row md:p-10">
          <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center">
            <div className="group relative w-full md:w-96">
              <Search size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="חיפוש לפי שוכר, נכס או מזהה עסקה"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
                className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-8 pr-14 text-[13px] font-bold outline-none transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <FilterButton active={filterStatus === "all"} label="הכל" onClick={() => { setFilterStatus("all"); setCurrentPage(1); }} />
              <FilterButton active={filterStatus === "completed"} label="הושלם" tone="emerald" onClick={() => { setFilterStatus("completed"); setCurrentPage(1); }} />
              <FilterButton active={filterStatus === "in_progress"} label="בתהליך" tone="rose" onClick={() => { setFilterStatus("in_progress"); setCurrentPage(1); }} />
              <FilterButton active={filterStatus === "pending"} label="ממתין" tone="amber" onClick={() => { setFilterStatus("pending"); setCurrentPage(1); }} />
            </div>
          </div>

          <p className="text-[10px] font-black tracking-[0.12em] text-slate-400">
            מציג {filteredTransactions.length.toLocaleString("he-IL")} מתוך {transactions.length.toLocaleString("he-IL")} עסקאות
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black tracking-[0.16em] text-slate-400">
                <th className="px-10 py-6">פרטי העסקה</th>
                <th className="px-10 py-6 text-center">שוכר / נכס</th>
                <th className="px-10 py-6 text-center">ערוץ / ספק</th>
                <th className="px-10 py-6 text-center">סטטוס</th>
                <th className="px-10 py-6 text-center">סכום</th>
                <th className="px-10 py-6 text-center">פעולות</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.slice((currentPage - 1) * 10, currentPage * 10).map((row) => (
                <tr key={row.transaction.id} className="group transition-all hover:bg-slate-50/80">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition-all group-hover:rotate-3 group-hover:scale-110">
                        <CreditCard size={22} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-base font-black leading-none text-slate-900 italic font-display">
                          ID-{row.transaction.id.slice(-8).toUpperCase()}
                        </p>
                        <p className="mt-2 text-[10px] font-bold tracking-[0.12em] text-slate-400">
                          {formatDate(row.transaction.createdAt)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <p className="text-sm font-black leading-none text-slate-900 italic">
                      {row.tenantLabel}
                    </p>
                    <p className="mx-auto mt-2 max-w-[220px] text-[10px] font-bold text-slate-400 leading-relaxed">
                      {row.propertyLabel}
                    </p>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <span className="inline-flex rounded-xl border border-slate-100 bg-white px-3 py-1.5 text-[9px] font-black tracking-[0.12em] text-slate-900">
                      {row.channelLabel} • {row.providerLabel}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-[10px] font-black tracking-[0.12em] shadow-sm",
                        row.transaction.status === "completed"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                          : row.transaction.status === "in_progress"
                            ? "border-rose-100 bg-rose-50 text-rose-600"
                            : row.transaction.status === "pending"
                              ? "border-amber-100 bg-amber-50 text-amber-600"
                              : "border-slate-100 bg-slate-50 text-slate-500",
                      )}
                    >
                      {row.transaction.status === "completed" ? (
                        <CheckCircle2 size={14} />
                      ) : row.transaction.status === "in_progress" ? (
                        <AlertCircle size={14} />
                      ) : (
                        <Clock size={14} />
                      )}
                      <span>{transactionStatusLabel(row.transaction.status)}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <p className="text-2xl font-black text-slate-900 italic font-display">
                      {formatCurrency(row.transaction.amount)}
                    </p>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <button
                      onClick={() => setSelectedTransaction({
                        transaction: row.transaction,
                        propertyLabel: row.propertyLabel,
                        tenantLabel: row.tenantLabel,
                        contractLabel: row.contractLabel,
                      })}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-slate-900 hover:text-slate-900"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length > 10 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 px-10 py-6">
            <button
               onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
               disabled={currentPage === 1}
               className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent hover:bg-white hover:text-slate-900 transition-all shadow-sm disabled:shadow-none"
            >
               <ChevronRight size={18} />
            </button>
            <span className="text-[11px] font-black tracking-[0.16em] text-slate-400">
              עמוד {currentPage} מתוך {Math.ceil(filteredTransactions.length / 10)}
            </span>
            <button
               onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTransactions.length / 10), p + 1))}
               disabled={currentPage === Math.ceil(filteredTransactions.length / 10)}
               className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent hover:bg-white hover:text-slate-900 transition-all shadow-sm disabled:shadow-none"
            >
               <ChevronLeft size={18} />
            </button>
          </div>
        )}

        {filteredTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-slate-300">
            <FileText size={64} className="mb-6 opacity-10" />
            <p className="text-sm font-black tracking-[0.2em] opacity-40">
              לא נמצאו עסקאות העונות לחיפוש
            </p>
          </div>
        )}
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="relative w-full max-w-xl overflow-hidden rounded-[40px] bg-white p-6 sm:p-12 text-right shadow-2xl animate-in zoom-in-95">
            <div className="absolute right-0 top-0 h-2 w-full bg-blue-600" />
            <button
              onClick={() => setSelectedTransaction(null)}
              className="absolute left-8 top-8 text-slate-300 transition-all hover:text-slate-900"
            >
              <X size={24} />
            </button>

            <div className="mb-12 flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-2xl">
                <DollarSign size={36} />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tighter text-slate-900 italic font-display">
                  פרטי עסקה
                </h2>
                <p className="mt-2 text-xs font-bold tracking-[0.12em] text-slate-400">
                  מעקב, שינוי סטטוס והסלמה משפטית
                </p>
              </div>
            </div>

            <div className="space-y-6 rounded-[32px] border border-slate-100 bg-slate-50 p-8">
              <DetailRow label="מזהה" value={selectedTransaction.transaction.id} />
              <DetailRow label="שוכר" value={selectedTransaction.tenantLabel} />
              <DetailRow label="נכס" value={selectedTransaction.propertyLabel} />
              <DetailRow label="חוזה" value={selectedTransaction.contractLabel} />
              <DetailRow label="ספק" value={selectedTransaction.transaction.provider === "insurance" ? "ביטוח" : selectedTransaction.transaction.provider === "midrag" ? "מידרג" : "יד2"} />
              <DetailRow label="ערוץ" value={selectedTransaction.transaction.channel === "maintenance_companies" ? "חברות תחזוקה" : selectedTransaction.transaction.channel === "foreign_resident_agencies" ? "משרדי נדל\"ן לתושבי חוץ" : "נדל\"ן מסחרי"} />
              <DetailRow label="תאריך" value={formatDate(selectedTransaction.transaction.createdAt)} />
              <DetailRow label="סטטוס" value={transactionStatusLabel(selectedTransaction.transaction.status)} />
              <DetailRow label="סכום" value={formatCurrency(selectedTransaction.transaction.amount)} emphasize />
            </div>

            <div className="mt-12 space-y-4">
              <p className="mb-6 text-center text-[10px] font-black tracking-[0.14em] text-slate-400">
                פעולות מערכת
              </p>

              <button className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-[11px] font-black tracking-[0.12em] text-white shadow-sleek transition-all hover:bg-black">
                <Download size={18} />
                <span>ייצא פרטי עסקה</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPIItem({
  label,
  value,
  trend,
  trendUp,
  icon,
  color,
}: {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "indigo" | "rose";
}) {
  const colors = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
    rose: "text-rose-600 bg-rose-50 border-rose-100",
  };

  return (
    <div className="dashboard-card flex flex-col border-slate-100 p-10 transition-all group hover:-translate-y-1">
      <div className="mb-8 flex items-center justify-between">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm", colors[color])}>
          {icon}
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-black tracking-[0.12em]",
            trendUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
          )}
        >
          {trendUp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span>{trend}</span>
        </div>
      </div>

      <p className="mb-3 text-[10px] font-black tracking-[0.12em] text-slate-400">{label}</p>
      <p className="text-4xl font-black leading-tight tracking-tighter text-slate-900 italic font-display">
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  label,
  onClick,
  tone = "slate",
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone?: "slate" | "emerald" | "rose" | "amber";
}) {
  const activeClass =
    tone === "emerald"
      ? "bg-emerald-500 text-white"
      : tone === "rose"
        ? "bg-rose-500 text-white"
        : tone === "amber"
          ? "bg-amber-500 text-white"
          : "bg-slate-900 text-white";

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl px-5 py-2 text-[10px] font-black tracking-[0.12em] transition-all",
        active ? activeClass : "text-slate-400 hover:text-slate-900",
      )}
    >
      {label}
    </button>
  );
}

function ChartLegend({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] font-black tracking-[0.12em] text-slate-400">{label}</span>
    </div>
  );
}

function InsightChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "blue" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
  };

  return (
    <div className={cn("rounded-[22px] border px-5 py-4 text-right", tones[tone])}>
      <p className="mb-2 text-[11px] font-black text-slate-400">{label}</p>
      <p className="text-2xl font-black tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function FinanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const values = Object.fromEntries(payload.map((entry: any) => [entry.dataKey, entry.value]));

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-right shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
      <p className="text-sm font-black text-slate-900">{label}</p>
      <div className="mt-3 space-y-2">
        <TooltipRow
          label="גבייה בפועל"
          value={formatCurrency(Math.round(values.collected ?? 0))}
          color="bg-slate-900"
        />
        <TooltipRow
          label="עמלות"
          value={formatCurrency(Math.round(values.fees ?? 0))}
          color="bg-blue-600"
        />
        <TooltipRow
          label="ממתין/בתהליך"
          value={formatCurrency(Math.round(values.pending ?? 0))}
          color="bg-rose-400"
        />
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="flex items-center gap-2 text-sm font-black tabular-nums text-slate-900">
        <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
        {value}
      </span>
    </div>
  );
}

function RiskMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="group flex items-center justify-between">
      <span className="text-[11px] font-black tracking-[0.12em] text-slate-400 transition-colors group-hover:text-white">
        {label}
      </span>
      <span className={cn("text-2xl font-black tabular-nums font-display", color)}>{value}</span>
    </div>
  );
}

function GoalProgress({
  label,
  progress,
  target,
}: {
  label: string;
  progress: number;
  target: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <p className="text-[10px] font-black tracking-[0.12em] text-slate-400">{label}</p>
        <p className="text-sm font-black italic tabular-nums text-slate-900">{target}</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-1000 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div className="flex justify-end">
        <span className="text-[9px] font-black tracking-[0.12em] text-blue-600">
          {Math.min(100, Math.max(0, progress))}% הושלם
        </span>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-4 last:border-0 last:pb-0">
      <span className="text-[11px] font-black tracking-[0.12em] text-slate-400">{label}</span>
      <span
        className={cn(
          "text-sm font-black text-slate-900",
          emphasize && "text-2xl font-display",
        )}
      >
        {value}
      </span>
    </div>
  );
}
