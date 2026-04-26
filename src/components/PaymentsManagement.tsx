import { useState, useMemo, ReactNode } from "react";
import { 
  CreditCard, 
  DollarSign, 
  FileText, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  History,
  TrendingUp,
  CreditCard as CardsIcon,
  Clock
} from "lucide-react";
import { Payment, User } from "../types";
import { cn } from "../lib/utils";
import { useAppData } from "../lib/appData";

/**
 * PaymentsManagement Component
 */
export default function PaymentsManagement({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<"history" | "future" | "debts">("history");
  const { db: appDb } = useAppData();

  // Filter payments from local DB based on user role
  const payments = useMemo(() => {
    const all = appDb.payments;
    let filtered;
    if (user.role === "admin") {
      filtered = all;
    } else if (user.role === "landlord") {
      filtered = all.filter((p) => p.landlordId === user.id);
    } else {
      filtered = all.filter((p) => p.tenantId === user.id);
    }
    return [...filtered].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [appDb.payments, user.id, user.role]);

  const totalCollected = payments.filter(p => p.status === "paid").reduce((acc, p) => acc + p.amount, 0);
  const pendingAmount = payments.filter(p => p.status === "pending").reduce((acc, p) => acc + p.amount, 0);
  const unpaidCount = payments.filter(p => p.status === "pending" || p.status === "failed").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">ניהול כספים וגבייה</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">פירוט תזרים מזומנים, היסטוריית תשלומים וייצוא דוחות</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-black text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95 uppercase tracking-widest">
            <Download size={18} />
            <span>ייצוא דוח שנתי</span>
          </button>
          {user.role !== "tenant" && (
            <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-black text-white shadow-sleek-blue hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest">
              <DollarSign size={18} />
              <span>יצירת חיוב חדש</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. TAB NAVIGATION */}
      <div className="flex overflow-x-auto border-b border-slate-200 no-scrollbar">
        <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")} label="היסטוריית תשלומים" />
        <TabButton active={activeTab === "future"} onClick={() => setActiveTab("future")} label="תשלומים צפויים" />
        <TabButton active={activeTab === "debts"} onClick={() => setActiveTab("debts")} label="חובות ופיגורים" />
      </div>

      {activeTab === "history" && (
        <div className="animate-in slide-in-from-bottom-5 duration-500">
          {/* Summary Stats for History */}
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <SummaryCard 
              title="סה'כ תקבולים" 
              value={`₪${totalCollected.toLocaleString()}`} 
              icon={<TrendingUp size={20} />} 
              trend="+100%" 
            />
            <SummaryCard 
              title="תשלומים בהמתנה" 
              value={`₪${pendingAmount.toLocaleString()}`} 
              icon={<Clock size={20} />} 
              trend={pendingAmount > 0 ? "דרוש טיפול" : "תקין"} 
            />
            <SummaryCard 
              title="שיעור גבייה" 
              value={payments.length > 0 ? `${Math.round((payments.filter(p => p.status === "paid").length / payments.length) * 100)}%` : "100%"} 
              icon={<CheckCircle2 size={20} />} 
              trend="תקין" 
            />
          </div>

          <div className="rounded-2xl bg-white shadow-sleek border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right">
              <thead className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-5">תאריך ביצוע</th>
                  <th className="px-8 py-5">תיאור העסקה</th>
                  <th className="px-8 py-5">סכום ברוטו</th>
                  <th className="px-8 py-5 text-center">סטטוס</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(payment => (
                  <PaymentHistoryRow key={payment.id} payment={payment} />
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "debts" && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          {/* Debt Summary Banner */}
          <div className={cn(
            "rounded-2xl border p-6 md:p-10 flex flex-col md:flex-row items-center justify-between shadow-sm",
            unpaidCount > 0 ? "bg-red-50 border-red-100" : "bg-gradient-to-br from-green-50 to-blue-50 border-blue-100"
          )}>
            <div className="flex flex-col gap-4 text-center md:flex-row md:items-center md:text-right">
              <div className={cn(
                "h-16 w-16 rounded-2xl bg-white shadow-sleek flex items-center justify-center border",
                unpaidCount > 0 ? "text-red-500 border-red-100" : "text-green-500 border-green-100"
              )}>
                {unpaidCount > 0 ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
              </div>
              <div className="text-right">
                <h3 className="font-black text-slate-900 text-2xl tracking-tighter">
                  {unpaidCount > 0 ? `ישנם ${unpaidCount} חובות פעילים` : "מצב החשבון: תקין לחלוטין"}
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {unpaidCount > 0 ? "מומלץ לפעול לגבייה מיידית או הסדר תשלומים." : "אין חובות פעילים או פיגורים במערכת נכון להיום."}
                </p>
              </div>
            </div>
          </div>
          
          {/* Management Tools for Landlords */}
          {user.role === "landlord" && (
            <div className="space-y-6">
              <h3 className="font-black text-slate-900 text-xl tracking-tight">כלי ניהול גבייה ופיגורים</h3>
              <div className="grid gap-6 md:grid-cols-3">
                <ToolCard 
                  icon={<FileText size={20} />} 
                  title="מכתב התראה משפטי" 
                  desc="יצירה אוטומטית של מכתב התראה לפני נקיטת הליכים" 
                />
                <ToolCard 
                  icon={<CardsIcon size={20} />} 
                  title="הסדר פריסת חוב" 
                  desc="פריסת פיגורים לתשלומים חודשיים בריבית המערכת" 
                />
                <ToolCard 
                  icon={<History size={20} />} 
                  title="חיוב חוזר (מס'ב)" 
                  desc="ניסיון חיוב מיידי נוסף של הוראת הקבע" 
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "future" && (
        <div className="text-center py-20 opacity-30 select-none">
          <History size={64} className="mx-auto mb-6 text-slate-400" />
          <p className="text-2xl font-black text-slate-900 tracking-tighter">תשלומים עתידיים (Scheduled)</p>
          <p className="text-xs font-bold text-slate-500 uppercase mt-2 tracking-widest leading-relaxed max-w-xs mx-auto">
            מציג את התחזית הפיננסית ל-12 החודשים הבאים בהתאם לחוזי השכירות הפעילים.
          </p>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI Sub-Components for Clean Code
// -----------------------------------------------------------------------------

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-5 text-sm font-black transition-all border-b-2",
        active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
      )}
    >
      {label}
    </button>
  );
}

function SummaryCard({ title, value, icon, trend }: any) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sleek border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600 border border-slate-100 shadow-sm">
          {icon}
        </div>
        <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full">{trend}</span>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-slate-900 mt-1 tracking-tighter">{value}</p>
    </div>
  );
}

function PaymentHistoryRow({ payment }: { payment: Payment }) {
  return (
    <tr className="group hover:bg-slate-50/50 transition-colors">
      <td className="px-8 py-5">
        <div className="flex items-center gap-3">
          <div className={cn("h-2 w-2 rounded-full", payment.status === "paid" ? "bg-green-500" : "bg-orange-500")}></div>
          <span className="text-xs font-black text-slate-500 font-sans tracking-tight">{payment.date}</span>
        </div>
      </td>
      <td className="px-8 py-5">
        <p className="text-sm font-black text-slate-900 leading-none">
          {payment.type === "rent" ? "תשלום שכירות חודשי" : "תשלום שירות/תקלה"}
        </p>
      </td>
      <td className="px-8 py-5">
        <p className="text-sm font-black text-slate-900">₪{payment.amount.toLocaleString()}</p>
      </td>
      <td className="px-8 py-5 text-center">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-black uppercase border shadow-sm tracking-widest",
          payment.status === "paid" ? "bg-green-50 text-green-600 border-green-100" : "bg-orange-50 text-orange-600 border-orange-100"
        )}>
          {payment.status === "paid" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
          {payment.status === "paid" ? "שולם" : "בטיפול"}
        </span>
      </td>
      <td className="px-8 py-5 text-left">
        <button className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-100 transition-all active:scale-90">
          <Download size={18} />
        </button>
      </td>
    </tr>
  );
}

function ToolCard({ icon, title, desc }: { icon: ReactNode, title: string, desc: string }) {
  return (
    <button className="flex flex-col items-center text-center p-8 rounded-2xl border border-slate-100 hover:border-blue-300 hover:bg-white hover:shadow-sleek transition-all group">
      <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 mb-6 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all shadow-sm">
        {icon}
      </div>
      <h4 className="font-extrabold text-slate-900 mb-2 tracking-tight">{title}</h4>
      <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[150px]">{desc}</p>
    </button>
  );
}
