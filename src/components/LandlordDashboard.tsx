import { useEffect, useState, useMemo, ReactNode } from "react";
import { 
  Home, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  QrCode,
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
  Database,
  Info,
  Copy,
  Link2
} from "lucide-react";
import { Property, Payment, User, Contract, OnboardingInvite } from "../types";
import { cn } from "../lib/utils";
import { useAppData } from "../lib/appData";
import { InfoTooltip } from "./SharedViews";

/**
 * LandlordDashboard Component
 * Optimized for the Hebrew rental-management spec: Alerts, Summary, Non-paying alerts, and Property lists.
 */
export default function LandlordDashboard({ user }: { user: User }) {
  const { db, addProperty, inviteTenant, setTenantCreditSkipApproval, completeOnboarding, resetDatabase } = useAppData();
  const [activeTab, setActiveTab] = useState<"overview" | "properties" | "proofs" | "maintenance">("overview");
  const properties = useMemo(() => db.properties.filter((property) => property.landlordId === user.id), [db, user.id]);
  const payments = useMemo(() => [...db.payments]
    .filter((payment) => payment.landlordId === user.id)
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date)), [db, user.id]);
  const contracts = useMemo(() => db.contracts.filter((contract) => contract.landlordId === user.id), [db, user.id]);
  const serviceCalls = useMemo(() => db.serviceCalls.filter((serviceCall) => serviceCall.landlordId === user.id), [db, user.id]);
  
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
  const featuredOnboarding = useMemo(
    () =>
      featuredProperty
        ? getTenantOnboardingSnapshot(featuredProperty, contracts, db.users, db.onboardingInvites)
        : null,
    [contracts, db, featuredProperty],
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right" dir="rtl">

      {/* 0. EMPTY STATE ACTION */}
      {properties.length === 0 && (
        <div className="p-10 rounded-[40px] bg-indigo-600 text-white shadow-2xl flex flex-col items-center text-center space-y-6">
           <div className="h-20 w-20 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-md">
              <Database size={40} />
           </div>
           <div>
              <h2 className="text-3xl font-black italic">הפורטפוליו שלך ריק!</h2>
              <p className="text-indigo-100 font-medium mt-2">אפשר לטעון מחדש את נתוני המאגר המקומי כדי להחזיר נכסים ודיירים פעילים.</p>
           </div>
           <button 
             onClick={() => resetDatabase()}
             className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm tracking-[0.12em] shadow-xl hover:scale-105 active:scale-95 transition-all"
           >
             טען נתוני מאגר
           </button>
        </div>
      )}

      <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-slate-200 bg-white/70 backdrop-blur-sm transition-all sm:flex sm:flex-wrap">
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
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setSelectedProperty(featuredProperty);
                        setShowInviteTenant(true);
                      }}
                      className="inline-flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-sleek-blue transition-all hover:bg-blue-700 active:scale-95"
                    >
                      <Plus size={18} />
                      <span>הוספת דייר</span>
                    </button>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
                      <QrCode size={16} />
                      <span>ה-CTA הראשי מוביל למודול QR ייעודי לדייר ולמשכיר</span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <HeroCostPill label="שכר דירה" value={featuredProperty.rent} />
                  <HeroCostPill label="ועד בית" value={featuredCosts.buildingCommittee} />
                  <HeroCostPill label="ארנונה" value={featuredCosts.arnona} />
                  <HeroCostPill label="שירותים" value={featuredCosts.utilities} />
                </div>
              </div>
              {featuredOnboarding && (featuredOnboarding.tenant || featuredOnboarding.invite) && (
                <LandlordOnboardingTracker
                  className="mt-6"
                  snapshot={featuredOnboarding}
                  onOpenInvite={() => {
                    setSelectedProperty(featuredProperty);
                    setShowInviteTenant(true);
                  }}
                  onCreditSkipApproval={(approved) =>
                    setTenantCreditSkipApproval(user.id, {
                      propertyId: featuredProperty.id,
                      tenantEmail: featuredOnboarding.activeTenantEmail,
                      approved,
                    })
                  }
                />
              )}
            </div>
          )}

          <div className="flex flex-col gap-8 mt-4">
             
             {/* TOP ROW: Row of 4 Status Cards Spread Edge-to-Edge */}
             <div className="flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-row lg:justify-between gap-6 w-full">
                <StatusSmallCard 
                  title="קריאות שירות" 
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

             {/* ROBUST: Unified Monthly Financial Summary */}
             <div className="xl:col-span-12 dashboard-card p-6 md:p-10 lg:p-12 bg-white relative overflow-hidden border-slate-200/60 shadow-sleek">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                   <div className="flex items-center gap-6">
                      <div className="h-16 w-16 bg-slate-950 rounded-[28px] flex items-center justify-center text-white shadow-2xl shadow-slate-900/20">
                         <TrendingUp size={28} />
                      </div>
                      <div className="text-right">
                         <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter italic font-display leading-none uppercase">סיכום פיננסי חודשי</h2>
                         <p className="text-[11px] text-slate-400 font-black mt-2 uppercase tracking-[0.2em]">Real-time Performance Metrics</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3 py-2 px-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.4)]"></span>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Sync</span>
                   </div>
                </div>

                {/* Top Metrics Pillar Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                   <div className="p-7 rounded-[32px] bg-slate-50 border border-slate-100/50 hover:bg-white hover:shadow-xl transition-all group">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        התקבל (בחשבון)
                        <InfoTooltip text="סך כל התשלומים שנקלטו ואושרו בחשבון הבנק שלך החודש." />
                      </p>
                      <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black text-slate-900 tabular-nums italic font-display">₪{(totalMonthlyIncome - pendingPaymentsNum * 5000).toLocaleString()}</span>
                         <CheckCircle2 size={18} className="text-emerald-500" />
                      </div>
                   </div>
                   <div className="p-7 rounded-[32px] bg-slate-50 border border-slate-100/50 hover:bg-white hover:shadow-xl transition-all group">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        ממתין / בפיגור
                        <InfoTooltip text="תשלומים שמועד פירעונם עבר או שהם בתהליך סליקה וטרם הושלמו." />
                      </p>
                      <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black text-slate-900 tabular-nums italic font-display">₪{(pendingPaymentsNum * 5000).toLocaleString()}</span>
                         <Clock size={18} className="text-amber-500" />
                      </div>
                   </div>
                   <div className="p-7 rounded-[32px] bg-slate-50 border border-slate-100/50 hover:bg-white hover:shadow-xl transition-all group">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        יחידות מאוכלסות
                        <InfoTooltip text="מספר הנכסים המושכרים כרגע עם חוזה פעיל במערכת." />
                      </p>
                      <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black text-slate-900 tabular-nums italic font-display">{occupiedCount}</span>
                         <span className="text-xs font-bold text-slate-400">יח׳</span>
                      </div>
                   </div>
                   <div className="p-7 rounded-[32px] bg-slate-50 border border-slate-100/50 hover:bg-white hover:shadow-xl transition-all group">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        יחידות פנויות
                        <InfoTooltip text="נכסים ללא חוזה פעיל המחכים לשוכר חדש." />
                      </p>
                      <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black text-slate-400 tabular-nums italic font-display">{vacantCount}</span>
                         <span className="text-xs font-bold text-slate-300">יח׳</span>
                      </div>
                   </div>
                </div>

                {/* Bottom Split Analysis Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-12 border-t border-slate-100 items-stretch">
                   {/* Redesigned Distribution Analysis */}
                   <div className="lg:col-span-7 flex flex-col">
                      <div className="mb-10">
                         <div className="flex items-center gap-3 mb-2">
                            <div className="h-2 w-8 bg-blue-600 rounded-full"></div>
                            <h4 className="text-2xl font-black text-slate-900 tracking-tight italic font-display uppercase">פילוח תקבולים תקופתי</h4>
                         </div>
                         <p className="text-sm font-bold text-slate-400 mr-11">ניתוח ביצועי גבייה וסטטוס תזרים מזומנים</p>
                      </div>
                      
                      <div className="grid gap-4">
                         <DistributionItem 
                            label="גבייה תקינה" 
                            subLabel="תשלומים שנקלטו ועברו לחשבון"
                            value={Math.max(0, occupiedCount - pendingPaymentsNum)} 
                            total={Math.max(occupiedCount, 1)} 
                            color="bg-slate-900"
                            icon={<CheckCircle2 size={16} className="text-emerald-500" />}
                         />
                         <DistributionItem 
                            label="ממתין לסליקה" 
                            subLabel="עסקאות בתהליך אישור מול חברת האשראי"
                            value={Math.max(0, pendingPaymentsNum)} 
                            total={Math.max(occupiedCount, 1)} 
                            color="bg-blue-600"
                            icon={<Clock size={16} className="text-blue-500" />}
                         />
                         <DistributionItem 
                            label="חריגות ופיגורים" 
                            subLabel="תשלומים שנדחו או דורשים טיפול ידני"
                            value={Math.max(0, failedPaymentsNum)} 
                            total={Math.max(occupiedCount, 1)} 
                            color="bg-rose-600"
                            icon={<AlertTriangle size={16} className="text-rose-500" />}
                         />
                      </div>
                   </div>

                   {/* Visual Collection Grade Card */}
                   <div className="lg:col-span-5">
                      <div className="rounded-[48px] bg-slate-950 text-white p-10 md:p-12 shadow-2xl relative overflow-hidden border border-white/5 h-full group">
                         {/* Dynamic Background Effects */}
                         <div className="pointer-events-none absolute -top-20 -left-20 h-52 w-52 rounded-full bg-blue-600/20 blur-[100px] transition-all duration-1000 group-hover:bg-blue-600/30"></div>
                         <div className="pointer-events-none absolute -bottom-20 -right-20 h-52 w-52 rounded-full bg-indigo-600/20 blur-[100px] transition-all duration-1000 group-hover:bg-indigo-600/30"></div>
                         
                         <div className="relative z-10 flex flex-col items-center text-center h-full">
                            <div className="mb-10">
                               <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mb-3 leading-none">Monthly Grade</p>
                               <h4 className="text-2xl font-black italic tracking-tighter leading-none">מדד גבייה</h4>
                            </div>

                            <div className="relative flex items-center justify-center mb-12">
                               <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full opacity-50"></div>
                               <svg className="h-44 w-44 -rotate-90 transform relative z-10">
                                 <circle cx="88" cy="88" r="70" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-white/5" />
                                 <circle
                                   cx="88" cy="88" r="70"
                                   stroke="url(#masterBlueGradient)"
                                   strokeWidth="14"
                                   strokeDasharray={439.8}
                                   strokeDashoffset={439.8 - (Math.max(0.05, (occupiedCount - pendingPaymentsNum) / Math.max(occupiedCount, 1)) * 439.8)}
                                   strokeLinecap="round"
                                   fill="transparent"
                                   className="transition-all duration-[2s] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                 />
                                 <defs>
                                    <linearGradient id="masterBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                       <stop offset="0%" stopColor="#60A5FA" />
                                       <stop offset="100%" stopColor="#2563EB" />
                                    </linearGradient>
                                 </defs>
                               </svg>
                               <div className="absolute flex flex-col items-center justify-center z-20">
                                  <span className="text-5xl font-black italic tracking-tighter tabular-nums leading-none">
                                     {Math.round(((occupiedCount - pendingPaymentsNum) / Math.max(occupiedCount, 1)) * 100)}%
                                  </span>
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-3">בוצע בהצלחה</span>
                               </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 w-full mt-auto">
                               <div className="py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                  <p className="text-[9px] font-black text-emerald-500 mb-1 leading-none uppercase">שולם</p>
                                  <p className="text-xl font-black tabular-nums leading-none text-emerald-400">{occupiedCount - pendingPaymentsNum}</p>
                               </div>
                               <div className="py-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                                  <p className="text-[9px] font-black text-blue-500 mb-1 leading-none uppercase">ממתין</p>
                                  <p className="text-xl font-black tabular-nums leading-none text-blue-400">{pendingPaymentsNum}</p>
                               </div>
                               <div className="py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                                  <p className="text-[9px] font-black text-rose-500 mb-1 leading-none uppercase">נכשל</p>
                                  <p className="text-xl font-black tabular-nums leading-none text-rose-400">{failedPaymentsNum}</p>
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
                     desc="סהכ תשלומים עברו החודש לחשבונך" 
                   />
                </div>
             </div>

             <div className="dashboard-card bg-slate-900 p-12 text-white shadow-2xl relative overflow-hidden group h-full border-0">
                <div className="pointer-events-none absolute top-0 left-0 h-full w-28 -translate-x-8 skew-x-[-20deg] bg-blue-500/10 blur-2xl transition-all duration-1000 group-hover:bg-blue-500/20"></div>
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
                     onClick={() => {}}
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
                          onboarding={getTenantOnboardingSnapshot(p, contracts, db.users, db.onboardingInvites)}
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
          contracts={contracts}
          users={db.users}
          invites={db.onboardingInvites}
          onCreditSkipApproval={(payload) =>
            setTenantCreditSkipApproval(user.id, {
              propertyId: selectedProperty.id,
              tenantEmail: payload.email,
              approved: payload.approved,
            })
          }
          onInvite={(payload) =>
            inviteTenant(user.id, {
              propertyId: selectedProperty.id,
              tenantEmail: payload.email,
              tenantPhone: payload.phone,
              contractVisibilityStep: 2,
              landlordCreditSkipApproved: payload.landlordCreditSkipApproved,
            })
          }
          onCompleteOnboarding={completeOnboarding}
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
        "relative min-w-0 px-3 py-4 text-[11px] font-bold transition-all border-b-4 sm:flex-1 sm:px-5 md:px-8 md:py-6 md:text-[13px]",
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
    <div className="bg-white rounded-[32px] p-8 border border-slate-200/50 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all group flex-1 min-w-0">
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

function DistributionItem({ label, subLabel, value, total, color, icon }: { label: string, subLabel: string, value: number, total: number, color: string, icon: ReactNode }) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(total, 1)) * 100));

  return (
    <div className="group p-5 rounded-[28px] bg-white border border-slate-100 hover:border-blue-200 hover:shadow-xl transition-all duration-500">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            {icon}
          </div>
          <div>
            <p className="text-base font-black text-slate-900 leading-none">
              {label}
              <InfoTooltip text={subLabel} />
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1.5">{subLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-slate-900 tabular-nums italic font-display">{value}</p>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">{percent.toFixed(1)}%</p>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-50 overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", color)} 
          style={{ width: `${percent}%` }} 
        />
      </div>
    </div>
  );
}

function ProgressTrack({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(total, 1)) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">
          {label}
          <InfoTooltip text={`מעקב התקדמות עבור ${label}`} />
        </span>
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

function PropertyRow({
  property,
  onboarding,
  onInvite,
}: {
  property: Property;
  onboarding: TenantOnboardingSnapshot;
  onInvite: () => void;
}) {
  const hasActiveOnboarding = Boolean(onboarding.tenant || onboarding.invite);

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
          {hasActiveOnboarding ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-600">
                 <Clock size={14} />
                 <span className="max-w-[220px] truncate">{onboarding.status}</span>
              </div>
              <button
                onClick={onInvite}
                className="text-[10px] font-black tracking-[0.12em] text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all"
              >
                פתח מעקב
              </button>
            </div>
          ) : property.tenantId ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600">
                 <ShieldCheck size={14} />
                 <span>דייר פעיל</span>
              </div>
              <button
                onClick={onInvite}
                className="text-[10px] font-black tracking-[0.12em] text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
              >
                הוסף דייר חדש
              </button>
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
  onCreate: (payload: {
    address: string;
    rent: number;
    buildingCommittee?: number;
    arnona?: number;
    description?: string;
  }) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    address: "",
    rent: "0",
    buildingCommittee: "0",
    arnona: "0",
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
        buildingCommittee: Number(formData.buildingCommittee),
        arnona: Number(formData.arnona),
        description: formData.description || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 text-right backdrop-blur-sm sm:p-4" dir="rtl">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-8 md:p-10">
        <h2 className="text-3xl font-black text-slate-900 mb-8 italic tracking-tighter text-right">הוספת נכס חדש לפורטפוליו</h2>
        <div className="space-y-6">
          <Input label="כתובת מלאה" value={formData.address} onChange={(address: string) => setFormData({...formData, address})} placeholder="למשל: רוטשילד 42, תל אביב" />
          <Input label="דמי שכירות חודשיים (₪)" type="number" value={formData.rent} onChange={(rent: string) => setFormData({...formData, rent})} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="ועד בית חודשי (₪)" type="number" value={formData.buildingCommittee} onChange={(buildingCommittee: string) => setFormData({...formData, buildingCommittee})} />
            <Input label="ארנונה חודשית (₪)" type="number" value={formData.arnona} onChange={(arnona: string) => setFormData({...formData, arnona})} />
          </div>
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

const TENANT_ONBOARDING_STEPS = [
  "פתיחת תהליך",
  "פרטי דירה",
  "בדיקת זכאות",
  "הרשאה לחיוב",
  "חתימה",
  "סיום",
];

type TenantOnboardingSnapshot = {
  tenant: User | null;
  currentTenant: User | null;
  contract: Contract | null;
  invite: OnboardingInvite | null;
  status: string;
  stepIndex: number;
  totalSteps: number;
  activeTenantEmail?: string;
  landlordCreditSkipApproved: boolean;
};

function getTenantOnboardingStatus(tenant: User | null, invite?: OnboardingInvite | null) {
  if (!tenant && invite) return `הזמנה נשלחה אל ${invite.tenantEmail}`;
  if (!tenant) return "ממתין לדייר שיסרוק את ההזמנה ויירשם";
  if (tenant.onboardingComplete) return "הדייר השלים את תהליך ההרשמה";

  const stepIndex = Math.min(
    Math.max(tenant.onboardingStep ?? 0, 0),
    TENANT_ONBOARDING_STEPS.length - 1,
  );

  return `הדייר בשלב ${stepIndex + 1} מתוך ${TENANT_ONBOARDING_STEPS.length}: ${TENANT_ONBOARDING_STEPS[stepIndex]}`;
}

function getTenantOnboardingSnapshot(
  property: Property,
  contracts: Contract[],
  users: User[],
  invites: OnboardingInvite[],
): TenantOnboardingSnapshot {
  const propertyContracts = contracts.filter((contract) => contract.propertyId === property.id);
  const onboardingContract =
    propertyContracts.find((contract) => {
      if (contract.status === "active" || contract.status === "expired") return false;
      const candidate = users.find((user) => user.id === contract.tenantId);
      return Boolean(candidate && !candidate.onboardingComplete);
    }) ?? null;
  const tenant = onboardingContract
    ? users.find((candidate) => candidate.id === onboardingContract.tenantId) ?? null
    : null;
  const currentTenant = property.tenantId
    ? users.find((candidate) => candidate.id === property.tenantId) ?? null
    : null;
  const propertyInvites = [...invites]
    .filter((invite) => invite.propertyId === property.id && invite.status !== "completed")
    .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt));
  const invite =
    (tenant
      ? propertyInvites.find((item) => item.tenantEmail.toLowerCase() === tenant.email.toLowerCase())
      : propertyInvites.find(
          (item) => !currentTenant || item.tenantEmail.toLowerCase() !== currentTenant.email.toLowerCase(),
        )) ?? null;
  const stepIndex = tenant
    ? Math.min(Math.max(tenant.onboardingStep ?? 0, 0), TENANT_ONBOARDING_STEPS.length - 1)
    : 0;

  return {
    tenant,
    currentTenant,
    contract: onboardingContract,
    invite,
    status: getTenantOnboardingStatus(tenant, invite),
    stepIndex,
    totalSteps: TENANT_ONBOARDING_STEPS.length,
    activeTenantEmail: tenant?.email ?? invite?.tenantEmail,
    landlordCreditSkipApproved: Boolean(invite?.landlordCreditSkipApproved),
  };
}

function LandlordOnboardingTracker({
  snapshot,
  onCreditSkipApproval,
  onOpenInvite,
  className,
}: {
  snapshot: TenantOnboardingSnapshot;
  onCreditSkipApproval: (approved: boolean) => void;
  onOpenInvite: () => void;
  className?: string;
}) {
  const progress = Math.round(((snapshot.stepIndex + 1) / snapshot.totalSteps) * 100);
  const displayName = snapshot.tenant?.name ?? snapshot.invite?.tenantEmail ?? "דייר חדש";

  return (
    <div className={cn("rounded-[28px] border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[0.14em] text-indigo-500">מעקב הצטרפות פעיל</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="max-w-full truncate text-base font-black text-slate-900">{displayName}</p>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-indigo-700 shadow-sm">
              {snapshot.status}
            </span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white shadow-inner">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          <button
            onClick={() => onCreditSkipApproval(!snapshot.landlordCreditSkipApproved)}
            disabled={!snapshot.activeTenantEmail}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-black transition-all",
              snapshot.landlordCreditSkipApproved
                ? "bg-emerald-500 text-white shadow-sm"
                : "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50",
              !snapshot.activeTenantEmail && "cursor-not-allowed opacity-50",
            )}
          >
            <ShieldCheck size={15} />
            {snapshot.landlordCreditSkipApproved ? "דילוג אשראי מאושר" : "אשר דילוג אשראי"}
          </button>
          <button
            onClick={onOpenInvite}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-[11px] font-black text-white transition-all hover:bg-black"
          >
            <QrCode size={15} />
            פתח הזמנה
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteTenantModal({
  property,
  contracts,
  users,
  invites,
  onCreditSkipApproval,
  onInvite,
  onCompleteOnboarding,
  onClose,
}: {
  property: Property;
  contracts: Contract[];
  users: User[];
  invites: OnboardingInvite[];
  onCreditSkipApproval: (payload: { email?: string; approved: boolean }) => void;
  onInvite: (payload: { email: string; phone?: string; landlordCreditSkipApproved: boolean }) => void;
  onCompleteOnboarding: (tenantId: string) => void;
  onClose: () => void;
}) {
  const onboardingSnapshot = getTenantOnboardingSnapshot(property, contracts, users, invites);
  const tenant = onboardingSnapshot.tenant;
  const currentTenant = onboardingSnapshot.currentTenant;
  const existingInvite = onboardingSnapshot.invite;
  const [phone, setPhone] = useState(tenant?.phone ?? existingInvite?.tenantPhone ?? "");
  const [email, setEmail] = useState(tenant?.email ?? existingInvite?.tenantEmail ?? "");
  const [landlordCreditSkipApproved, setLandlordCreditSkipApproved] = useState(
    Boolean(existingInvite?.landlordCreditSkipApproved),
  );
  const [isSent, setIsSent] = useState(false);
  const processStatus = onboardingSnapshot.status;
  const activeTenantEmail = onboardingSnapshot.activeTenantEmail ?? email.trim().toLowerCase();

  useEffect(() => {
    setEmail(tenant?.email ?? existingInvite?.tenantEmail ?? "");
    setPhone(tenant?.phone ?? existingInvite?.tenantPhone ?? "");
    setLandlordCreditSkipApproved(Boolean(existingInvite?.landlordCreditSkipApproved));
  }, [existingInvite?.landlordCreditSkipApproved, existingInvite?.tenantEmail, existingInvite?.tenantPhone, tenant?.email, tenant?.phone]);

  const handleCreditSkipChange = (approved: boolean) => {
    setLandlordCreditSkipApproved(approved);
    if (activeTenantEmail) {
      onCreditSkipApproval({ email: activeTenantEmail, approved });
    }
  };

  const handleSend = () => {
    if (!email.trim()) return;
    onInvite({
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      landlordCreditSkipApproved,
    });
    setIsSent(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 text-right backdrop-blur-md sm:p-4" dir="rtl">
      <div className="relative max-h-[92dvh] w-full max-w-4xl overflow-y-auto overflow-x-hidden rounded-[28px] bg-white p-5 shadow-[0_30px_100px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-300 sm:rounded-[36px] sm:p-8 md:p-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="h-20 w-20 bg-slate-50 text-slate-900 rounded-[28px] flex items-center justify-center mb-8 shadow-inner">
             <QrCode size={40} />
          </div>
        {!isSent ? (
          <>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tighter italic font-display">הוספת דייר לנכס</h2>
            <p className="text-slate-500 text-base font-bold italic mb-10">{property.address}</p>

            <div className="mb-10 grid w-full gap-6 md:grid-cols-2 md:gap-8">
              <div className="group flex flex-col items-center rounded-[28px] border-2 border-slate-100 bg-slate-50/50 p-5 text-center shadow-sm transition-all hover:border-blue-500/20 hover:bg-white sm:p-8">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">QR לשוכר (סריקה מהירה)</p>
                <div className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white p-4 shadow-xl transition-transform duration-500 group-hover:scale-[1.02] sm:p-6 sm:rounded-[32px]">
                  <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_49%,#3b82f6_50%,#3b82f6_51%,transparent_52%)] bg-[length:100%_200%] animate-[scan_3s_linear_infinite] opacity-10 pointer-events-none"></div>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=M&margin=10&data=${encodeURIComponent(window.location.origin + "/?propertyId=" + property.id)}`}
                    alt="Scan for onboarding"
                    className="h-40 w-40 rounded-xl relative z-10"
                  />
                </div>
                <p className="mt-8 text-sm font-bold leading-relaxed text-slate-500">
                  הצג את הקוד לשוכר לסריקה. לאחר הסריקה הוא יועבר ישירות לתהליך ההרשמה במכשיר שלו.
                </p>
                <div className="mt-6 flex flex-col w-full gap-3">
                  <button 
                    onClick={() => {
                      const link = window.location.origin + "/?propertyId=" + property.id;
                      navigator.clipboard.writeText(link);
                      alert("הקישור הועתק ללוח!");
                    }}
                    className="w-full py-3 bg-slate-100 text-slate-900 rounded-xl font-black text-xs hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Copy size={14} />
                    <span>העתק קישור להצטרפות</span>
                  </button>
                  <button 
                    onClick={() => {
                      const link = window.location.origin + "/?propertyId=" + property.id;
                      const message = encodeURIComponent(`היי! מוזמן להתחיל את תהליך ההצטרפות לדירה ב-${property.address} דרך RentFlow בקישור הבא: ${link}`);
                      window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
                    }}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span>שלח הזמנה בוואטסאפ</span>
                  </button>
                  <button 
                    onClick={handleSend}
                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] hover:bg-slate-200 transition-all"
                  >
                    סמן כנשלח (דמו)
                  </button>
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-6 text-right">
                <div className="rounded-[28px] bg-slate-50 p-6 border border-slate-100">
                   <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                     <Users size={16} />
                     הזמנה ידנית
                   </h3>
                   <div className="space-y-4">
                     <Input label="אימייל השוכר" value={email} onChange={setEmail} placeholder="tenant@example.com" type="email" />
                     <Input label="מספר טלפון" value={phone} onChange={setPhone} placeholder="05x-xxxxxxx" />
                     <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200">
                       <input
                         type="checkbox"
                         checked={landlordCreditSkipApproved}
                         onChange={(event) => handleCreditSkipChange(event.target.checked)}
                         className="mt-1 h-5 w-5 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-600"
                       />
                       <span className="text-xs font-bold leading-6 text-slate-600">
                         אני מאשר לדייר לדלג על בדיקת נתוני אשראי אם יידרש לכך בתהליך ההרשמה.
                       </span>
                     </label>
                   </div>
                   <button 
                     onClick={handleSend}
                     className="mt-6 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-black transition-all"
                   >
                     שלח הזמנה בוואטסאפ / מייל
                   </button>
                </div>

                <div className="rounded-[28px] bg-indigo-50/50 p-6 border border-indigo-100/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                        <ShieldCheck size={20} />
                      </div>
                      <p className="text-sm font-black text-indigo-950">סטטוס חיבור</p>
                    </div>
                    {tenant && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 rounded-full border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Live Sync</span>
                      </div>
                    )}
                  </div>

                  {currentTenant?.onboardingComplete && !tenant && (
                    <div className="mb-4 rounded-2xl border border-emerald-100 bg-white p-4 text-right shadow-sm">
                      <p className="text-[10px] font-black tracking-[0.12em] text-emerald-600">דייר נוכחי</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{currentTenant.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">{currentTenant.email}</p>
                    </div>
                  )}
                  
                  {tenant ? (
                    <div className="mb-4 p-4 bg-white rounded-2xl border border-indigo-100 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center font-black text-sm">
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 leading-none">{tenant.name}</p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-1">{tenant.email}</p>
                        </div>
                      </div>
                      {!tenant.onboardingComplete && (
                        <button
                          onClick={() => {
                            if (window.confirm('האם אתה בטוח שברצונך לסיים את התהליך ידנית עבור דייר זה?')) {
                              onCompleteOnboarding(tenant.id);
                            }
                          }}
                          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-black hover:bg-black transition-colors shadow-sm"
                        >
                          סגור תהליך
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-indigo-700/80 leading-relaxed mb-4">
                      המערכת תסנכרן את נתוני המשכיר והשוכר באופן אוטומטי לאחר סיום הסריקה ואימות ה-KYC של השוכר.
                    </p>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white shadow-inner">
                       <div
                         className="h-full rounded-full bg-indigo-600 transition-all"
                         style={{ width: `${Math.round(((onboardingSnapshot.stepIndex + 1) / onboardingSnapshot.totalSteps) * 100)}%` }}
                       />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full self-start inline-flex border border-indigo-100">
                       <div className={cn("h-2 w-2 rounded-full", tenant ? "bg-blue-500 animate-pulse" : "bg-amber-500 animate-pulse")}></div>
                       <span className="text-[10px] font-black text-indigo-900">{processStatus}</span>
                    </div>
                    
                    <button
                      onClick={() => handleCreditSkipChange(!landlordCreditSkipApproved)}
                      className={cn(
                        "mt-2 w-full py-3 rounded-xl font-black text-[11px] transition-all flex items-center justify-center gap-2 border",
                        landlordCreditSkipApproved 
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" 
                          : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 shadow-sm"
                      )}
                    >
                      <ShieldCheck size={14} />
                      {landlordCreditSkipApproved ? "בדיקת אשראי - דילוג אושר בהצלחה" : "אישור דילוג על בדיקת נתוני אשראי"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-sm font-black text-slate-400 hover:text-slate-900 transition-colors">סגור חלון וחזור לדאשבורד</button>
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
