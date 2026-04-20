import { useState, useMemo, ReactNode } from "react";
import { 
  Home, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  FileText,
  Plus,
  MoreVertical,
  Briefcase,
  ChevronLeft,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  ShieldCheck,
  PieChart as PieChartIcon,
  BarChart3,
  Wrench,
  Search,
  Bell,
  LogOut,
  X,
  ChevronRight,
  Database
} from "lucide-react";
import { Property, Payment, User, Contract } from "../types";
import { cn } from "../lib/utils";
import { useAppData } from "../lib/appData";

/**
 * LandlordDashboard Component
 * Optimized for the Hebrew RentFlow spec: Alerts, Summary, Non-paying alerts, and Property lists.
 */
export default function LandlordDashboard({ user }: { user: User }) {
  const { db, addProperty, inviteTenant, resetDatabase } = useAppData();
  const [activeTab, setActiveTab] = useState<"overview" | "properties" | "proofs" | "maintenance">("overview");
  const properties = useMemo(() => db.properties.filter((property) => property.landlordId === user.id), [db.properties, user.id]);
  const payments = useMemo(() => [...db.payments]
    .filter((payment) => payment.landlordId === user.id)
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date)), [db.payments, user.id]);
  const contracts = useMemo(() => db.contracts.filter((contract) => contract.landlordId === user.id), [db.contracts, user.id]);
  const serviceCalls = useMemo(() => db.serviceCalls.filter((serviceCall) => serviceCall.landlordId === user.id), [db.serviceCalls, user.id]);
  
  // Modal States
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showInviteTenant, setShowInviteTenant] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Derived Metrics
  const { totalMonthlyIncome, occupiedCount, vacantCount, pendingPaymentsNum, failedPaymentsNum, openServiceCalls, featuredProperty, featuredCosts } = useMemo(() => {
    const totalMonthlyIncome = properties.reduce((acc, p) => acc + (p.status === "occupied" ? p.rent : 0), 0);
    const occupiedCount = properties.filter(p => p.status === "occupied").length;
    const vacantCount = properties.length - occupiedCount;
    const now = new Date();
    const pendingPaymentsNum = payments.filter(p => {
      const pDate = new Date(p.date);
      return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear() && p.status === "pending";
    }).length;
    const failedPaymentsNum = payments.filter(p => p.status === "failed").length;
    const openServiceCalls = serviceCalls.filter((call) => call.status !== "closed").length;
    const featuredProperty = properties.find((property) => property.status === "occupied") ?? properties[0] ?? null;
    const featuredCosts = featuredProperty?.costs ?? {
      buildingCommittee: 0,
      arnona: 0,
      utilities: 0,
    };
    
    return { totalMonthlyIncome, occupiedCount, vacantCount, pendingPaymentsNum, failedPaymentsNum, openServiceCalls, featuredProperty, featuredCosts };
  }, [properties, payments, serviceCalls]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right" dir="rtl">

      {/* 0. EMPTY STATE ACTION (FOR DEMO) */}
      {properties.length === 0 && (
        <div className="p-10 rounded-[40px] bg-indigo-600 text-white shadow-2xl flex flex-col items-center text-center space-y-6">
           <div className="h-20 w-20 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-md">
              <Database size={40} />
           </div>
           <div>
              <h2 className="text-3xl font-black italic">הפורטפוליו שלך ריק!</h2>
              <p className="text-indigo-100 font-medium mt-2">האם תרצה להזין נכסים ודיירי דוגמה כדי להתנסות במערכת הניהול?</p>
           </div>
           <button 
             onClick={() => resetDatabase()}
             className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm tracking-[0.12em] shadow-xl hover:scale-105 active:scale-95 transition-all"
           >
             הזן נתוני דוגמה עכשיו
           </button>
        </div>
      )}

      <div className="flex overflow-x-auto border-b border-slate-200 sticky top-0 bg-white/50 backdrop-blur-sm z-10 transition-all no-scrollbar">
        <TabHeader active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="מרכז שליטה" />
        <TabHeader active={activeTab === "properties"} onClick={() => setActiveTab("properties")} label="ניהול נכסים" />
        <TabHeader active={activeTab === "proofs"} onClick={() => setActiveTab("proofs")} label="העברות ואסמכתאות" />
        <TabHeader active={activeTab === "maintenance"} onClick={() => setActiveTab("maintenance")} label="תקלות וקריאות" />
      </div>

      {activeTab === "overview" && (
        <>
          {featuredProperty && (
            <div className="rounded-[32px] bg-white border border-slate-200 p-6 md:p-8 shadow-sleek">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-black tracking-[0.14em] text-slate-400">תקציר בעל הנכס</p>
                  <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-900 tracking-tight italic font-display">
                    {featuredProperty.address}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    שכר דירה ועלויות נלוות לנכס המוביל בפורטפוליו
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <HeroCostPill label="שכר דירה" value={featuredProperty.rent} />
                  <HeroCostPill label="ועד בית" value={featuredCosts.buildingCommittee} />
                  <HeroCostPill label="ארנונה" value={featuredCosts.arnona} />
                  <HeroCostPill label="שירותים" value={featuredCosts.utilities} />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-12 mt-4 items-start">
             
             {/* LEFT SIDE: 2x2 Grid of Status Cards */}
             <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <StatusSmallCard 
                  title="תקלות פתוחות" 
                  value={openServiceCalls.toString()} 
                  status="נדרש טיפול" 
                  color="text-orange-500" 
                  icon={<AlertTriangle size={24} />} 
                />
                <StatusSmallCard 
                  title="נכסים מאוכלסים" 
                  value={occupiedCount.toString()} 
                  total={properties.length.toString()} 
                  color="text-slate-950" 
                  icon={<Home size={24} />} 
                />
                <StatusSmallCard 
                   title="חוזים לחידוש" 
                   value={contracts.filter(c => c.status === "expired" || c.status === "pending").length.toString()} 
                   status="שלח חוזה" 
                   color="text-blue-600" 
                   icon={<FileText size={24} />} 
                />
                <StatusSmallCard 
                   title="שוכרים בפיגור" 
                   value={failedPaymentsNum.toString()} 
                   status="הפעל תזכורת" 
                   color="text-red-500" 
                   icon={<Users size={24} />} 
                />
             </div>

             {/* RIGHT SIDE: Large Financial Summary Card */}
             <div className="lg:col-span-7 bg-white rounded-[40px] p-6 sm:p-8 md:p-14 border border-slate-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.03)] relative overflow-hidden h-full min-w-0">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between mb-12">
                   <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                      <Clock size={32} />
                   </div>
                   <div className="text-right">
                      <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter italic font-display leading-none">סיכום פיננסי חודשי</h2>
                      <p className="text-[11px] text-slate-500 font-bold mt-3">סטטוס תקבולים לחודש הנוכחי</p>
                   </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-12 mt-4">
                   <div className="space-y-8 flex-1 w-full order-2 md:order-1">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                         <div className="flex items-center gap-4">
                            <div className="h-3 w-3 rounded-full bg-slate-900 shadow-[0_0_15px_rgba(15,23,42,0.2)]"></div>
                            <span className="text-[17px] font-bold text-slate-500">התקבל (בחשבון)</span>
                         </div>
                         <span className="text-2xl font-black text-slate-900 tabular-nums font-display leading-none">₪{(totalMonthlyIncome - pendingPaymentsNum * 5000).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="h-3 w-3 rounded-full bg-slate-100"></div>
                            <span className="text-[17px] font-bold text-slate-500">ממתין / בפיגור</span>
                         </div>
                         <span className="text-2xl font-black text-slate-900 tabular-nums font-display leading-none">₪{(pendingPaymentsNum * 5000).toLocaleString()}</span>
                      </div>
                      <div className="rounded-[28px] bg-slate-50 border border-slate-100 p-5">
                         <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-black text-slate-900">התפלגות החודש</span>
                            <span className="text-xs font-black text-slate-400">ברזולוציית פעולה</span>
                         </div>
                         <div className="space-y-4">
                            <ProgressTrack label="נגבה בהצלחה" value={Math.max(0, occupiedCount - pendingPaymentsNum)} total={Math.max(occupiedCount, 1)} color="bg-slate-900" />
                            <ProgressTrack label="ממתין לחיוב" value={Math.max(0, pendingPaymentsNum)} total={Math.max(occupiedCount, 1)} color="bg-blue-500" />
                            <ProgressTrack label="נדרש טיפול" value={Math.max(0, failedPaymentsNum)} total={Math.max(occupiedCount, 1)} color="bg-rose-500" />
                         </div>
                      </div>
                   </div>

                   <div className="relative shrink-0 order-1 md:order-2 w-full max-w-[340px]">
                      <div className="rounded-[40px] bg-slate-950 text-white p-8 shadow-2xl overflow-hidden relative border border-white/5 group">
                         {/* Ambient Glows */}
                         <div className="absolute -top-24 -left-24 h-48 w-48 bg-blue-600/20 blur-[100px] rounded-full group-hover:bg-blue-600/30 transition-all duration-1000"></div>
                         <div className="absolute -bottom-24 -right-24 h-48 w-48 bg-indigo-600/20 blur-[100px] rounded-full group-hover:bg-indigo-600/30 transition-all duration-1000"></div>
                         
                         <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                               <div>
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">מדד גבייה חודשי</p>
                                  <h4 className="text-xl font-black italic font-display">סטטוס תקבולים</h4>
                               </div>
                               <button className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                                  <TrendingUp size={18} />
                               </button>
                            </div>

                            <div className="flex items-center gap-10">
                               {/* Enhanced Radial Chart */}
                               <div className="relative flex items-center justify-center shrink-0">
                                  <svg className="h-32 w-32 -rotate-90 transform">
                                    <circle
                                      cx="64"
                                      cy="64"
                                      r="48"
                                      stroke="currentColor"
                                      strokeWidth="10"
                                      fill="transparent"
                                      className="text-white/5"
                                    />
                                    <circle
                                      cx="64"
                                      cy="64"
                                      r="48"
                                      stroke="url(#blueGradient)"
                                      strokeWidth="10"
                                      strokeDasharray={301.6}
                                      strokeDashoffset={301.6 - (Math.max(5, Math.round(((occupiedCount - pendingPaymentsNum) / Math.max(occupiedCount, 1)) * 100)) / 100) * 301.6}
                                      strokeLinecap="round"
                                      fill="transparent"
                                      className="transition-all duration-[1.5s] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                    />
                                    <defs>
                                       <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                          <stop offset="0%" stopColor="#60A5FA" />
                                          <stop offset="100%" stopColor="#3B82F6" />
                                       </linearGradient>
                                    </defs>
                                  </svg>
                                  <div className="absolute flex flex-col items-center">
                                    <span className="text-3xl font-black tabular-nums tracking-tighter leading-none">{Math.round(((occupiedCount - pendingPaymentsNum) / Math.max(occupiedCount, 1)) * 100)}%</span>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5 leading-none">בוצע</span>
                                  </div>
                               </div>

                               <div className="space-y-4 flex-1">
                                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] transition-all">
                                     <p className="text-[10px] font-black text-slate-500 mb-1 leading-none uppercase">מאוכלסים</p>
                                     <p className="text-2xl font-black tabular-nums leading-none italic">{occupiedCount}</p>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] transition-all">
                                     <p className="text-[10px] font-black text-slate-500 mb-1 leading-none uppercase">פנויים</p>
                                     <p className="text-2xl font-black tabular-nums leading-none italic text-slate-500">{vacantCount}</p>
                                  </div>
                               </div>
                            </div>

                            <div className="mt-10 grid grid-cols-3 gap-3">
                               <div className="flex flex-col items-center p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all group/pill">
                                  <span className="text-[9px] font-black text-emerald-500/60 transition-colors group-hover/pill:text-emerald-400 mb-1">שולם</span>
                                  <span className="text-lg font-black tabular-nums">{Math.max(occupiedCount - pendingPaymentsNum - failedPaymentsNum, 0)}</span>
                               </div>
                               <div className="flex flex-col items-center p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all group/pill">
                                  <span className="text-[9px] font-black text-blue-500/60 transition-colors group-hover/pill:text-blue-400 mb-1">ממתין</span>
                                  <span className="text-lg font-black tabular-nums">{pendingPaymentsNum}</span>
                               </div>
                               <div className="flex flex-col items-center p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-all group/pill">
                                  <span className="text-[9px] font-black text-rose-500/60 transition-colors group-hover/pill:text-rose-400 mb-1">נכשל</span>
                                  <span className="text-lg font-black tabular-nums">{failedPaymentsNum}</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-3 mt-10">
             <div className="lg:col-span-2 dashboard-card p-10 min-w-0">
                <SectionHeader title="התראות מערכת" icon={<AlertTriangle className="text-slate-900" size={26} />} />
                <div className="space-y-4">
                   {failedPaymentsNum > 0 && (
                     <NotificationItem 
                       type="danger" 
                       title="דילוג על תשלום (Failed)" 
                       desc="החיוב עבור רחוב הרצל 10 נכשל עקב חוסר כיסוי. נשלחה הודעה לשוכר." 
                     />
                   )}
                   <NotificationItem 
                     type="warning" 
                     title="בקשת שינוי מועד חיוב" 
                     desc="ישראל ישראלי ביקש לדחות את החיוב ב-3 ימים. לחץ לאישור." 
                   />
                   <NotificationItem 
                     type="success" 
                     title="כל התשלומים נקלטו" 
                     desc="סה״כ 5 תשלומים הועברו היום מחשבון הנאמנות לעו״ש." 
                   />
                </div>
             </div>

             <div className="dashboard-card bg-slate-900 p-12 text-white shadow-2xl relative overflow-hidden group h-full border-0">
                <div className="absolute top-0 left-0 w-48 h-[500px] bg-blue-500/10 skew-x-[-20deg] translate-x-[-60%] group-hover:bg-blue-500/20 transition-all duration-1000 blur-3xl"></div>
                <div className="relative z-10 space-y-12">
                   <div>
                      <h2 className="text-2xl font-black italic tracking-tighter font-display">סיכום פורטפוליו</h2>
                      <p className="text-[11px] text-slate-500 font-bold tracking-[0.12em] mt-3">נכון להיום {new Date().toLocaleDateString()}</p>
                   </div>
                   
                   <div className="space-y-8">
                      <MetricInline label="שווי נכסים משוער" value="₪1.2M" />
                      <MetricInline label="תשואה ממוצעת" value="4.2%" />
                      <MetricInline label="דירוג משכיר" value="4.9★" />
                   </div>
                   
                   <button 
                     onClick={() => {
                       alert("מפיק דוח רווח והפסד שנתי... הקובץ יישלח למייל שלך בסיום העיבוד.");
                     }}
                     className="w-full mt-10 py-5 bg-white text-slate-950 font-black rounded-3xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all text-[15px] italic font-display"
                   >
                      הפק דוח רווח והפסד
                   </button>
                </div>
             </div>
          </div>
        </>
      )}

      {activeTab === "properties" && (
         <div className="rounded-3xl bg-white shadow-sleek border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-6 sm:p-10 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
               <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">ניהול יחידות ודיור</h2>
                  <p className="text-slate-500 text-sm font-medium">פירוט מלא של כל הנכסים שבבעלותך</p>
               </div>
               <button 
                  onClick={() => setShowAddProperty(true)}
                  className="flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-5 sm:px-8 py-4 text-xs font-black text-white shadow-sleek-blue hover:bg-blue-700 transition-all active:scale-95 tracking-[0.12em]"
               >
                  <Plus size={20} />
                  <span>הוסף נכס חדש</span>
               </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full min-w-[760px] text-right">
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 tracking-[0.12em]">
                     <tr>
                        <th className="px-10 py-5">נכס</th>
                        <th className="px-10 py-5">שוכר</th>
                        <th className="px-10 py-5">שכירות (₪)</th>
                        <th className="px-10 py-5 text-center">סטטוס</th>
                        <th className="px-10 py-5"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {properties.length > 0 ? (
                       properties.map(p => (
                        <PropertyRow 
                          key={p.id} 
                          property={p} 
                          onInvite={() => {
                             setSelectedProperty(p);
                             setShowInviteTenant(true);
                          }} 
                        />
                       ))
                     ) : (
                       <tr>
                         <td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">אין נכסים להצגה</td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {activeTab === "proofs" && (
         <div className="rounded-3xl bg-white p-6 sm:p-10 shadow-sleek border border-slate-200 animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-10">
               <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">אסמכתאות והעברות לעו״ש</h2>
                  <p className="text-slate-500 text-sm font-medium mt-1 italic tracking-tight">כאן תוכל לראות את כל הכספים שהמערכת גבתה והעבירה ישירות לחשבון שלך</p>
               </div>
               <div className="flex flex-wrap gap-4">
                  <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50 transition-all tracking-[0.12em]">
                    <Download size={16} />
                    <span>ייצוא הכל</span>
                  </button>
               </div>
            </div>
            <div className="space-y-4">
               {payments.filter(p => p.status === "paid").map((p, idx) => (
                 <TransferItem key={p.id} payment={p} index={idx} />
               ))}
            </div>
         </div>
      )}

      {activeTab === "maintenance" && (
         <div className="rounded-3xl bg-white p-6 sm:p-10 shadow-sleek border border-slate-200 animate-in slide-in-from-bottom-5 duration-500">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight italic mb-8">מרכז תקלות ותחזוקה</h2>
            <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[32px]">
               <Wrench size={48} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-400 font-bold italic">מרכז התחזוקה בשדרוג... בקרוב תוכלו לנהל כאן את כל הקריאות.</p>
            </div>
         </div>
      )}

      {showAddProperty && (
        <AddPropertyModal
          landlordId={user.id}
          onCreate={(payload) => addProperty(user.id, payload)}
          onClose={() => setShowAddProperty(false)}
        />
      )}
      {showInviteTenant && selectedProperty && (
        <InviteTenantModal
          property={selectedProperty}
          onInvite={(payload) =>
            inviteTenant(user.id, {
              propertyId: selectedProperty.id,
              tenantEmail: payload.email,
              tenantPhone: payload.phone,
              contractVisibilityStep: 2,
            })
          }
          onClose={() => setShowInviteTenant(false)}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI Sub-Components
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

function SectionHeader({ title, icon }: { title: string, icon: ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-10">
      <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-900 shadow-sm">
        {icon}
      </div>
      <h2 className="text-[22px] font-extrabold text-slate-900 tracking-tight italic font-display">{title}</h2>
    </div>
  );
}

function LegendItem({ color, label, amount }: { color: string, label: string, amount: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-5 last:border-0 last:pb-0">
       <div className="flex items-center gap-4">
          <div className={cn("h-4 w-4 rounded-full border-4 border-white shadow-xl", color)}></div>
          <span className="text-[15px] font-semibold text-slate-600 tracking-tight leading-none">{label}</span>
       </div>
       <span className="text-[17px] font-black text-slate-900 tabular-nums font-display">{amount}</span>
    </div>
  );
}

function HeroCostPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 px-4 py-4 min-w-[140px]">
      <p className="text-[11px] font-black tracking-[0.12em] text-slate-400 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">₪{value.toLocaleString()}</p>
    </div>
  );
}

function StatusSmallCard({ title, value, total, status, color, icon }: any) {
  return (
    <div className="bg-white rounded-[32px] p-8 border border-slate-200/50 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all group min-w-0">
       <div className="flex items-center justify-between mb-8 min-w-0 gap-4">
          <div className="text-right min-w-0">
             <p className="text-[11px] font-bold tracking-[0.12em] text-slate-400 mb-1">{title}</p>
             <div className="flex items-end gap-1.5">
                <span className={cn("text-4xl font-black tabular-nums tracking-tighter font-display leading-tight", color)}>{value}</span>
                {total && <span className="text-lg font-black text-slate-200 relative -bottom-1">/ {total}</span>}
             </div>
          </div>
          <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 shadow-inner group-hover:scale-110 transition-transform duration-500 shrink-0">
             {icon}
          </div>
       </div>
       {status && (
         <button className="w-full py-2.5 bg-slate-50 text-[10px] font-black tracking-[0.12em] text-slate-400 rounded-xl border border-slate-100 hover:bg-slate-100 hover:text-slate-900 transition-all">
            {status}
         </button>
       )}
    </div>
  );
}

function NotificationItem({ type, title, desc }: { type: "danger" | "warning" | "success", title: string, desc: string }) {
  const styles = {
    danger: "bg-red-50 border-red-100 text-red-900",
    warning: "bg-orange-50 border-orange-100 text-orange-900",
    success: "bg-emerald-50 border-emerald-100 text-emerald-900"
  };

  return (
    <div className={cn("p-5 rounded-2xl border transition-all hover:-translate-x-1 shadow-sm", styles[type])}>
      <p className="font-black text-sm italic tracking-tight leading-none">{title}</p>
      <p className="text-xs font-medium opacity-80 mt-2 leading-relaxed">{desc}</p>
    </div>
  );
}

function MetricInline({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
       <span className="text-xs font-bold text-slate-400 tracking-tight">{label}</span>
       <span className="text-lg font-black italic tabular-nums">{value}</span>
    </div>
  );
}

function ProgressTrack({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(total, 1)) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <span className="text-sm font-black text-slate-900 tabular-nums">{value}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-white shadow-inner overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function MiniStatCard({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] text-slate-400 font-black">{label}</p>
      <p className="mt-1 text-xl font-black text-white tabular-nums">{value}</p>
    </div>
  );
}

function StatusPill({ title, value, tone }: { title: string, value: string, tone: "good" | "info" | "danger" }) {
  const tones = {
    good: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    info: "bg-blue-500/15 text-blue-300 border-blue-400/20",
    danger: "bg-rose-500/15 text-rose-300 border-rose-400/20",
  };

  return (
    <div className={cn("rounded-2xl border px-3 py-3", tones[tone])}>
      <p className="text-[10px] font-black">{title}</p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function PropertyRow({ property, onInvite }: { property: Property, onInvite: () => void }) {
  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
       <td className="px-6 md:px-10 py-6 min-w-[250px]">
          <div className="flex items-center gap-4 text-right min-w-0">
             <div className="h-12 w-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Home size={22} className="text-blue-500" />
             </div>
             <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 leading-none tracking-tight">{property.address}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-2 tracking-[0.12em] leading-none">מזהה: {property.id.slice(-6)}</p>
             </div>
          </div>
       </td>
       <td className="px-10 py-6 text-slate-500 text-sm font-bold italic">
          {property.tenantId ? (
            <div className="flex items-center gap-2 text-emerald-600">
               <ShieldCheck size={14} />
               <span>דייר פעיל</span>
            </div>
          ) : (
            <button 
              onClick={onInvite}
              className="text-[10px] font-black tracking-[0.12em] text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
            >
              הזמן שוכר
            </button>
          )}
       </td>
       <td className="px-10 py-6 font-black text-slate-900 text-sm tabular-nums tracking-tighter italic">₪{property.rent.toLocaleString()}</td>
       <td className="px-10 py-6 text-center">
          <div className={cn(
             "inline-flex px-3 py-1 rounded-full text-[9px] font-black tracking-[0.12em] border shadow-sm",
             property.status === "occupied" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
          )}>
             {property.status === "occupied" ? "מאוכלס" : "פנוי"}
          </div>
       </td>
       <td className="px-10 py-6 text-center">
          <button className="h-10 w-10 text-slate-300 hover:text-slate-950 transition-colors">
             <MoreVertical size={20} />
          </button>
       </td>
    </tr>
  );
}

// -----------------------------------------------------------------------------
// Modals & Action Components
// -----------------------------------------------------------------------------

function AddPropertyModal({
  landlordId,
  onCreate,
  onClose,
}: {
  landlordId: string;
  onCreate: (payload: { address: string; rent: number; description?: string }) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    address: "",
    rent: "0",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.address) return;
    setIsSubmitting(true);
    try {
      onCreate({
        address: formData.address,
        rent: Number(formData.rent),
        description: formData.description || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 text-right" dir="rtl">
      <div className="w-full max-w-lg rounded-3xl bg-white p-10 shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 className="text-3xl font-black text-slate-900 mb-8 italic tracking-tighter text-right">הוספת נכס חדש לפורטפוליו</h2>
        <div className="space-y-6">
          <Input label="כתובת מלאה" value={formData.address} onChange={(address: string) => setFormData({...formData, address})} placeholder="למשל: רוטשילד 42, תל אביב" />
          <Input label="דמי שכירות חודשיים (₪)" type="number" value={formData.rent} onChange={(rent: string) => setFormData({...formData, rent})} />
          <Input label="תיאור חופשי" value={formData.description} onChange={(description: string) => setFormData({...formData, description})} placeholder="קומה, חדרים, מרפסת..." />
        </div>
        <div className="flex gap-4 mt-10">
          <button onClick={onClose} className="flex-1 py-4 text-sm font-black text-slate-400 hover:text-slate-900">ביטול</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-sleek-blue hover:bg-blue-700 transition-all">
             {isSubmitting ? "שומר..." : "הוסף נכס למערכת"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteTenantModal({
  property,
  onInvite,
  onClose,
}: {
  property: Property;
  onInvite: (payload: { email: string; phone?: string }) => void;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSend = () => {
    if (!email.trim()) return;
    onInvite({
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
    });
    setIsSent(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 text-right" dir="rtl">
      <div className="w-full max-w-sm rounded-3xl bg-white p-10 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
        <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
           <Users size={32} />
        </div>
        {!isSent ? (
          <>
            <h2 className="text-2xl font-black text-slate-900 mb-2">הזמנת שוכר לנכס</h2>
            <p className="text-sm text-slate-500 mb-8 italic">{property.address}</p>
            <div className="space-y-6">
               <Input label="אימייל השוכר" value={email} onChange={setEmail} placeholder="tenant@example.com" type="email" />
               <Input label="מספר טלפון (וואטסאפ)" value={phone} onChange={setPhone} placeholder="05x-xxxxxxx" />
               <button onClick={handleSend} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-blue-600 transition-all">
                  שלח הזמנה אוטומטית
               </button>
            </div>
            <button onClick={onClose} className="mt-4 text-xs font-bold text-slate-400">סגור חלון</button>
          </>
        ) : (
          <div className="py-10 space-y-4 animate-in fade-in duration-500">
             <div className="h-12 w-12 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 size={24} />
             </div>
             <p className="text-lg font-black text-slate-900">ההזמנה נשלחה בהצלחה!</p>
             <p className="text-xs text-slate-500 font-bold tracking-[0.12em]">השוכר יקבל הודעה ויוכל להתחיל בתהליך ההרשמה</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2 text-right">
      <label className="text-[10px] font-black text-slate-400 tracking-[0.12em] mr-2">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
      />
    </div>
  );
}

function TransferItem({ payment, index }: { payment: Payment, index: number }) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all group gap-4">
       <div className="flex items-center gap-4 md:gap-6 min-w-0">
          <div className="h-12 w-12 md:h-14 md:w-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-sm text-blue-600">
             <CheckCircle2 size={24} />
          </div>
          <div className="min-w-0">
             <p className="font-black text-slate-900 text-base md:text-lg italic tracking-tight">העברת שכירות - {payment.propertyAddress || payment.propertyId}</p>
             <div className="flex items-center gap-3 mt-1.5 font-sans">
                <span className="text-[10px] text-slate-400 font-black tracking-[0.12em] tabular-nums">{payment.date}</span>
                <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                <span className="text-[10px] text-blue-500 font-black italic leading-none">נשלחה אסמכתא למייל</span>
             </div>
          </div>
       </div>
       <div className="text-right font-sans shrink-0 w-full sm:w-auto flex flex-row sm:flex-col justify-between items-center sm:items-end">
          <p className="text-xl md:text-2xl font-black text-slate-950 tracking-tighter tabular-nums">₪{payment.amount.toLocaleString()}</p>
          <button className="mt-0 sm:mt-2 flex items-center justify-end gap-2 text-blue-600 hover:underline">
             <Download size={14} />
             <span className="text-[9px] font-black tracking-[0.12em] whitespace-nowrap">הורד אסמכתא</span>
          </button>
       </div>
    </div>
  );
}
