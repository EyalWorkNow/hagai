import { useState, ReactNode } from "react";
import { 
  Shield, 
  Activity, 
  Map as MapIcon, 
  Scale,
  DollarSign,
  AlertCircle,
  BarChart3,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  PieChart as PieChartIcon,
  Check,
  X,
  FileText
} from "lucide-react";
import { BDICheckStandalone } from "./Onboarding";
import { cn } from "../lib/utils";
import { User, Property, Payment, Contract } from "../types";
import { useAppData } from "../lib/appData";
import { Database } from "lucide-react";

/**
 * AdminDashboard Component
 */
export default function AdminDashboard({ user: adminUser }: { user: User }) {
  const { db, updateUser, resetDatabase } = useAppData();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "bdi">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const allUsers = db.users;
  const allProperties = db.properties;
  const allContracts = db.contracts;
  const recentPayments = [...db.payments]
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
    .slice(0, 10);

  // Handling User Updates
  const updateUserStatus = async (userId: string, data: Partial<User>) => {
    updateUser(userId, data);
  };

  // Compute Funnel Data
  const funnel = {
    firstNotice: allUsers.filter(u => u.role === "tenant" && u.onboardingStep !== undefined && u.onboardingStep >= 0).length,
    sentKYC: allUsers.filter(u => u.role === "tenant" && u.onboardingStep !== undefined && u.onboardingStep >= 1).length,
    waitingLandlord: allContracts.filter(c => c.status === "pending" || c.status === "waiting_kyc" || c.status === "waiting_bdi").length,
    waitingSignature: allContracts.filter(c => c.status === "waiting_signature").length,
    completed: allContracts.filter(c => c.status === "active").length,
  };

  const pendingKYC = allUsers.filter(u => u.kycStatus === "submitted" || u.kycStatus === "pending").length;
  const totalVolume = recentPayments.reduce((acc, p) => acc + p.amount, 0);
  const regionalBreakdown = [
    { label: "מרכז", share: 62, occupancy: 91, accent: "bg-slate-900" },
    { label: "ירושלים והשפלה", share: 21, occupancy: 84, accent: "bg-blue-600" },
    { label: "צפון", share: 10, occupancy: 76, accent: "bg-emerald-500" },
    { label: "דרום", share: 7, occupancy: 68, accent: "bg-amber-500" },
  ];

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-1000">
      
      {/* 0. ADMIN HEADER ACTIONS */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-10 border-b border-slate-200/60 mb-10 gap-6">
        <div>
           <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter italic font-display">לוח בקרה <span className="text-blue-600">ניהולי</span></h1>
           <p className="text-slate-400 font-bold mt-3 text-[13px] tracking-[0.08em]">פיקוח מערכתי • אישור KYC • ניטור עסקאות בזמן אמת</p>
        </div>
         <div className="flex items-center gap-6">
            <button 
              onClick={() => {
                resetDatabase();
                alert("נתוני הפרוקסי אופסו ונטענו מחדש.");
              }}
              className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black tracking-[0.12em] text-slate-900 hover:border-slate-900 transition-all shadow-sm flex items-center gap-3"
            >
              <Database size={18} />
              <span>הזנת נתוני פרוקסי</span>
            </button>
            <div className="h-16 w-16 rounded-[24px] bg-slate-900 flex items-center justify-center text-white shadow-2xl shadow-slate-950/20 rotate-3">
               <Shield size={28} />
            </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <TabHeader 
          active={activeTab === "overview"} 
          onClick={() => setActiveTab("overview")} 
          label="סקירה מערכתית" 
        />
        <TabHeader 
          active={activeTab === "users"} 
          onClick={() => setActiveTab("users")} 
          label="ניהול משתמשים ו-KYC" 
        />
        <TabHeader 
          active={activeTab === "bdi"} 
          onClick={() => setActiveTab("bdi")} 
          label="בדיקת BDI עצמאית" 
        />
      </div>

      {activeTab === "overview" && (
        <>
          {/* 2. SYSTEM METRICS GRID (The "Greenest" View) */}
          <div className="grid gap-8 md:grid-cols-4">
            <MetricCard 
              icon={<TrendingUp size={20} />} 
              title="מדד הצלחת גבייה" 
              value="98.2%" 
              subtitle="חיובים פעילים במערכת" 
              color="text-emerald-500" 
            />
            <MetricCard 
              icon={<DollarSign size={20} />} 
              title="נפח עסקאות (חודשי)" 
              value={`₪${(totalVolume / 1000).toFixed(1)}K`} 
              subtitle="מעקב תשלומים אחרונים" 
              color="text-slate-900" 
            />
            <MetricCard 
              icon={<Users size={20} />} 
              title="נכסים ברישום" 
              value={allProperties.length} 
              subtitle={`${allProperties.filter(p => p.status === "vacant").length} נכסים זמינים כרגע`} 
              color="text-slate-900" 
            />
            <MetricCard 
              icon={<Scale size={20} />} 
              title="טיפול משפטי" 
              value="3" 
              subtitle="תיקים בטיפול הוצאה לפועל" 
              color="text-red-500" 
            />
          </div>

          {/* 3. ONBOARDING FUNNEL (Pipeline Efficiency) */}
          <div className="mt-10 dashboard-card p-10 md:p-14">
            <div className="flex items-center justify-between mb-16">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight italic font-display">משפך אונבורדינג</h2>
                <p className="text-slate-400 text-[11px] font-bold tracking-[0.12em] mt-3">מעקב התקדמות הרישום מחלונית ההזמנה ועד לחתימה</p>
              </div>
              <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-lg">
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="text-[10px] font-black tracking-[0.12em] leading-none mt-0.5">ניטור חי</span>
              </div>
            </div>
            
            <div className="flex justify-between items-start gap-2 md:gap-4 px-4">
              <FunnelStep label="הודעה ראשונה" count={funnel.firstNotice.toString()} color="bg-slate-900" />
              <FunnelStep label="שלחו KYC" count={funnel.sentKYC.toString()} color="bg-slate-900" />
              <FunnelStep label="מתנה לאישור" count={funnel.waitingLandlord.toString()} color="bg-slate-900" />
              <FunnelStep label="חתימה" count={funnel.waitingSignature.toString()} color="bg-slate-900" />
              <FunnelStep label="הושלם" count={funnel.completed.toString()} color="bg-blue-600" isLast={true} />
            </div>
            
            <div className="mt-16 flex items-center justify-between text-[11px] font-black text-slate-400 tracking-[0.12em] border-t border-slate-100 pt-10">
              <div className="flex gap-10">
                 <span>סה"כ נכסים: {allProperties.length}</span>
                 <span className="text-slate-900">משתמשים בתהליך: {allUsers.filter(u => u.onboardingStep !== undefined && u.onboardingStep < 4).length}</span>
              </div>
              <span className="bg-slate-50 px-4 py-2 rounded-full border border-slate-100">אחוז המרה: {((funnel.completed / (funnel.firstNotice || 1)) * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* 4. REAL-TIME MONITORING & GEOGRAPHY */}
          <div className="grid gap-8 lg:grid-cols-2 mt-8">
            {/* Live Transaction Feed */}
            <div className="rounded-3xl bg-white p-8 shadow-sleek border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 tracking-tight italic flex items-center gap-3">
                  <Activity className="text-blue-500" size={24} />
                  <span>ניטור עסקאות בזמן אמת</span>
                </h2>
                <button className="text-[10px] font-black text-slate-400 tracking-[0.12em] hover:text-blue-600 transition-colors">היסטוריה מלאה</button>
              </div>
              <div className="space-y-4">
                {recentPayments.length > 0 ? (
                  recentPayments.map((p, i) => <TransactionItem key={p.id} payment={p} index={i} />)
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                     <DollarSign size={48} className="opacity-10 mb-4" />
                     <p className="text-sm font-bold tracking-[0.12em]">אין תשלומים אחרונים במערכת</p>
                  </div>
                )}
              </div>
              <button className="w-full mt-8 py-4 text-xs font-black text-blue-600 bg-blue-50/50 hover:bg-blue-600 hover:text-white rounded-2xl transition-all tracking-[0.12em] shadow-sm">
                הפק דוח גבייה חודשי
              </button>
            </div>

            {/* National Property Analytics */}
            <div className="rounded-3xl bg-white p-8 shadow-sleek border border-slate-200 flex flex-col min-h-[450px]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-900 tracking-tight italic flex items-center gap-3">
                  <MapIcon className="text-indigo-500" size={24} />
                  <span>פיזור נכסים ותפוסה</span>
                </h2>
                <PieChartIcon size={20} className="text-slate-400" />
              </div>
              <div className="flex-1 rounded-3xl bg-slate-50 border border-slate-100 relative overflow-hidden shadow-inner p-6">
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] h-full">
                  <div className="rounded-[28px] bg-slate-950 text-white p-6 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-2/3 bg-blue-600/10 blur-3xl"></div>
                    <div className="relative z-10">
                      <p className="text-xs text-slate-400 font-black mb-2">תמונה ארצית</p>
                      <h3 className="text-3xl font-black tracking-tight">תפוסה גבוהה במרכז, מקום לשיפור בפריפריה</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300 font-semibold">
                        הדשבורד מדגיש איפה מרוכזים הנכסים הפעילים ואיפה עדיין יש פער בין היצע, חתימות ותפוסה בפועל.
                      </p>

                      <div className="mt-8 space-y-4">
                        {regionalBreakdown.map((region) => (
                          <RegionalBar key={region.label} region={region} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 content-start">
                    <GeoMetricCard label="נכסים במרכז" value="62%" helper="ריכוז עיקרי של פורטפוליו קיים" tone="indigo" />
                    <GeoMetricCard label="תפוסה ממוצעת" value="86%" helper="בכלל האזורים הפעילים" tone="slate" />
                    <GeoMetricCard label="אזורים בפער" value="2" helper="דורשים חיזוק שיווקי/תפעולי" tone="amber" />
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                      <p className="text-sm font-black text-slate-900">מוקד תשומת לב</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500 font-semibold">
                        ירושלים והשפלה מציגים יחס טוב בין היצע לתפוסה, בעוד שבצפון ובדרום כדאי לחזק חידושי חוזה וגיוס שוכרים.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "users" && (
        <div className="rounded-3xl bg-white shadow-sleek-lg border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5 duration-500">
          <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">ניהול משתמשים ו-KYC</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">פיקוח על זהות המשתמשים, אישורי KYC ובדיקות אמינות</p>
            </div>
            <div className="relative group">
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="חפש לפי שם, ת.ז או אימייל..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-2xl bg-white border border-slate-200 py-4 pl-8 pr-14 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 w-96 shadow-sm transition-all font-bold" 
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 tracking-[0.16em] border-b border-slate-100">
                <tr>
                  <th className="px-10 py-6 text-right">פרופיל משתמש</th>
                  <th className="px-10 py-6 text-center">סטטוס KYC</th>
                  <th className="px-10 py-6 text-center">BDI SCORE</th>
                  <th className="px-10 py-6 text-center">תפקיד</th>
                  <th className="px-10 py-6 text-right">פעולות אישור</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allUsers
                  .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(u => (
                    <UserTableRow 
                      key={u.id}
                      user={u}
                      onUpdate={(data) => updateUserStatus(u.id, data)}
                    />
                  ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
            <p className="text-[10px] font-black text-slate-400 text-center tracking-[0.18em] leading-relaxed">
              מציג {allUsers.length} משתמשים במערכת RentFlow • כל הנתונים מאובטחים
            </p>
          </div>
        </div>
      )}

      {activeTab === "bdi" && (
        <div className="py-20 animate-in fade-in duration-700 bg-[radial-gradient(circle_at_center,_white_0%,_#f8fafc_100%)] rounded-3xl border border-slate-100">
          <BDICheckStandalone />
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI Sub-Components for Clean Code
// -----------------------------------------------------------------------------

function TabHeader({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-10 py-8 text-[13px] font-bold transition-all border-b-4 relative tracking-[0.14em]",
        active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-900"
      )}
    >
      {label}
      {active && <div className="absolute bottom-[-2px] left-0 right-0 h-1 bg-slate-900"></div>}
    </button>
  );
}

function MetricCard({ icon, title, value, status, subtitle, color }: any) {
  return (
    <div className="dashboard-card p-10 border-slate-100 hover:border-slate-300 transition-all hover:-translate-y-1 group min-w-0">
      <div className="flex items-center gap-5 mb-8 min-w-0">
        <div className={cn("h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform shrink-0", color)}>
          {icon}
        </div>
        <h3 className="font-black text-[11px] text-slate-400 tracking-[0.12em] leading-tight truncate">{title}</h3>
      </div>
      {status ? (
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-sm font-black text-slate-900 tracking-[0.08em] italic">{status}</span>
        </div>
      ) : (
        <>
          <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none tabular-nums font-display truncate">{value}</p>
          <p className="text-[10px] text-slate-400 font-bold tracking-[0.14em] mt-4 truncate">{subtitle}</p>
        </>
      )}
    </div>
  );
}

function FunnelStep({ label, count, color, isLast }: { label: string, count: string, color: string, isLast?: boolean }) {
  const isComplete = color.includes("blue");
  
  return (
    <div className="relative flex flex-col items-center group min-w-0 flex-1">
      {/* Connector Line */}
      {!isLast && (
        <div className="absolute top-8 left-1/2 w-full h-[2px] bg-slate-100 -z-10 transform -translate-x-1/2">
           <div className={cn("h-full transition-all duration-1000", isComplete ? "bg-blue-600 w-full" : "bg-transparent w-0 group-hover:w-1/2 bg-slate-200")} />
        </div>
      )}
      
      {/* Step Circle */}
      <div className={cn(
        "h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black tabular-nums transition-all duration-500 shadow-sm z-10 font-display",
        isComplete 
          ? "bg-blue-600 text-white shadow-blue-600/20 shadow-xl scale-110" 
          : "bg-white border-2 border-slate-100 text-slate-900 group-hover:border-slate-300"
      )}>
        {count}
      </div>
      
      {/* Label */}
      <p className={cn(
        "text-[11px] font-bold mt-6 tracking-[0.12em] text-center max-w-[100px] break-words leading-tight transition-colors",
        isComplete ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
      )}>
        {label}
      </p>
    </div>
  );
}

function TransactionItem({ payment, index }: { payment: Payment, index: number }) {
  return (
    <div className="flex items-center justify-between p-5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
      <div className="flex items-center gap-5 min-w-0">
        <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm shrink-0">
          <DollarSign size={24} className="text-slate-400 group-hover:text-white shrink-0" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 italic truncate">
            {payment.type === "rent" ? "תשלום שכירות חודשי" : payment.type === "commission" ? "עמלת מערכת" : "תשלום שירות/תקלה"}
          </p>
          <div className="flex items-center gap-3 mt-1.5 min-w-0">
            <span className="text-[10px] text-slate-400 font-black tracking-[0.12em] tabular-nums shrink-0">{payment.date}</span>
            <span className="h-1 w-1 rounded-full bg-slate-200 shrink-0"></span>
            <span className="text-[10px] text-blue-500 font-black italic truncate">ID: {payment.id.slice(-8)}</span>
          </div>
        </div>
      </div>
      <div className="text-right font-sans">
        <p className="text-xl font-black text-slate-900 tracking-tighter tabular-nums">₪{payment.amount.toLocaleString()}</p>
        <span className={cn(
          "flex items-center justify-end gap-1.5 text-[9px] font-black tracking-[0.12em] mt-1",
          payment.status === "paid" ? "text-emerald-500" : "text-orange-500"
        )}>
          {payment.status === "paid" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
          {payment.status === "paid" ? "הושלם" : "ממתין"}
        </span>
      </div>
    </div>
  );
}

function RegionalBar({ region }: { region: { label: string; share: number; occupancy: number; accent: string } }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-white">{region.label}</p>
          <p className="text-[11px] text-slate-400 font-semibold">תפוסה {region.occupancy}%</p>
        </div>
        <span className="text-xl font-black text-white tabular-nums">{region.share}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", region.accent)} style={{ width: `${region.share}%` }} />
      </div>
    </div>
  );
}

function GeoMetricCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: "indigo" | "slate" | "amber" }) {
  const tones = {
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  };

  return (
    <div className={cn("rounded-[24px] border p-5", tones[tone])}>
      <p className="text-sm font-black">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-sm leading-6 font-semibold opacity-80">{helper}</p>
    </div>
  );
}

function UserTableRow({ user: u, onUpdate }: { user: User, onUpdate: (data: Partial<User>) => void }) {
  const statusStyles: any = {
    approved: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
    pending: "bg-slate-100 text-slate-400 border border-slate-200",
    submitted: "bg-blue-600 text-white shadow-lg shadow-blue-600/20",
    rejected: "bg-red-500 text-white shadow-lg shadow-red-500/20"
  };

  const statusLabels: any = {
    approved: "מאושר",
    pending: "חדש",
    submitted: "ממתין",
    rejected: "נדחה"
  };

  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="px-10 py-8 min-w-[250px]">
        <div className="flex items-center gap-5 min-w-0">
          <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-lg font-black text-slate-900 shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-sm font-display tracking-[0.08em]">
            {u.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-black text-slate-900 leading-none tracking-tight truncate font-display italic">{u.name}</p>
            <p className="text-[11px] text-slate-400 font-bold mt-2 tracking-[0.08em] truncate">{u.email}</p>
          </div>
        </div>
      </td>
      <td className="px-10 py-8 text-center">
        <div className={cn("inline-flex items-center gap-3 px-5 py-2 rounded-full text-[11px] font-bold tracking-[0.12em] shadow-sm", statusStyles[u.kycStatus || "pending"])}>
          {u.kycStatus === "approved" ? <CheckCircle2 size={14} /> : u.kycStatus === "rejected" ? <XCircle size={14} /> : <Clock size={14} />}
          <span className="mt-0.5">{statusLabels[u.kycStatus || "pending"]}</span>
        </div>
      </td>
      <td className="px-10 py-8 text-center text-[15px] font-black tabular-nums font-display tracking-widest">
        {u.bdiStatus?.toUpperCase() || "N/A"}
      </td>
      <td className="px-10 py-8 text-center">
        <span className={cn(
          "px-4 py-2 rounded-2xl text-[11px] font-bold tracking-[0.12em] border shadow-sm",
          u.role === "tenant" ? "text-blue-600 bg-blue-50 border-blue-100" : "text-slate-900 bg-white border-slate-200"
        )}>
          {u.role === "tenant" ? "שוכר" : "משכיר"}
        </span>
      </td>
      <td className="px-10 py-8">
         {u.kycStatus !== "approved" && (
           <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => onUpdate({ kycStatus: "approved", onboardingStep: 1 })}
                className="btn-pill bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:bg-black transition-all"
              >
                <span>אשר</span>
              </button>
              <button 
                onClick={() => onUpdate({ kycStatus: "rejected" })}
                className="btn-pill bg-slate-50 text-red-500 border border-red-100 hover:bg-red-50 transition-all"
              >
                <span>דחה</span>
              </button>
           </div>
         )}
      </td>
    </tr>
  );
}
