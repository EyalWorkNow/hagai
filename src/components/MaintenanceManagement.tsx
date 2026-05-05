import { useState, ReactNode } from "react";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Plus, 
  MapPin, 
  MessageSquare,
  Wrench,
  Zap,
  Droplets,
  Hammer,
  Image as ImageIcon,
  Star,
  ChevronLeft,
  Camera,
  X
} from "lucide-react";
import { User, ServiceCall, Property } from "../types";
import { cn } from "../lib/utils";
import { useAppData } from "../lib/appData";

/**
 * MaintenanceManagement Component
 * High-tech interface for fault reporting, professional marketplace, and status tracking.
 */
export default function MaintenanceManagement({ user }: { user: User }) {
  const { db, createServiceCall, updateServiceCall } = useAppData();
  const [showNewCallForm, setShowNewCallForm] = useState(false);
  const properties = db.properties.filter((property) =>
    user.role === "tenant"
      ? property.tenantId === user.id
      : user.role === "landlord"
        ? property.landlordId === user.id
        : true,
  );
  const activeCalls = db.serviceCalls.filter((serviceCall) => {
    if (user.role === "admin") return true;
    if (user.role === "landlord") return serviceCall.landlordId === user.id;
    return serviceCall.tenantId === user.id;
  });
  const partnerIntegrations = db.integrations.filter(
    (integration) => integration.provider === "midrag" || integration.provider === "yad2",
  );

  // Update Call Logic
  const handleUpdateCall = async (callId: string, data: Partial<ServiceCall>) => {
    updateServiceCall(callId, data);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right" dir="rtl">
      
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter italic">מרכז שירות ותחזוקה</h1>
          <p className="text-slate-500 text-xs font-black mt-1 uppercase tracking-widest leading-none">ניהול תקלות • Marketplace בעלי מקצוע • בקרה ואיכות</p>
        </div>
        {user.role === "tenant" && (
          <button
            onClick={() => setShowNewCallForm(true)}
            className="flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black text-white shadow-sleek-lg hover:bg-slate-800 transition-all active:scale-95 uppercase tracking-widest"
          >
            <Camera size={20} />
            <span>דווח על תקלה (צלם ושלח)</span>
          </button>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        
        {/* 2. ACTIVE SERVICE CALLS (Main Feed) */}
        <div className="lg:col-span-8 space-y-10">
          
          <div className="rounded-3xl bg-white p-6 sm:p-10 shadow-sleek border border-slate-200">
             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">סטטוס קריאות שירות</h2>
                <div className="flex items-center gap-2">
                   <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">בטיפול פעיל</span>
                </div>
             </div>
            
            <div className="space-y-6">
              {activeCalls.length > 0 ? (
                activeCalls.map(call => (
                  <ServiceCallCard 
                    key={call.id} 
                    call={call} 
                    userRole={user.role} 
                    onUpdate={(data) => handleUpdateCall(call.id, data)}
                  />
                ))
              ) : (
                <EmptyMaintenanceState />
              )}
            </div>
          </div>

          {/* Professional Marketplace (For Landlords & Admins) */}
          {(user.role === "landlord" || user.role === "admin") && (
            <div className="rounded-3xl bg-white p-6 sm:p-10 shadow-sleek border border-slate-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-10">
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">Marketplace בעלי מקצוע</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">שריינו את המומחים הטובים ביותר • מסלול ירוק לטיפול בתקלות</p>
                </div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-2xl shadow-sm">ספקים מורשים</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <ProfessionalCard name="אברהם אינסטלציה" category="אינסטלציה ומים" rating="4.9" reviews="128" icon={<Droplets size={24} />} />
                <ProfessionalCard name="שי החשמלאי" category="חשמל ותשתיות" rating="4.8" reviews="95" icon={<Zap size={24} />} />
                <ProfessionalCard name="דוד שיפוצים" category="תיקונים כלליים" rating="5.0" reviews="42" icon={<Hammer size={24} />} />
                <ProfessionalCard name="אבי הדברות" category="הדברה וירוק" rating="4.7" reviews="67" icon={<Wrench size={24} />} />
              </div>
            </div>
          )}

          {(user.role === "landlord" || user.role === "admin") && (
            <div className="rounded-3xl bg-white p-6 sm:p-10 shadow-sleek border border-slate-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-10">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">אינטגרציות ספקים</h2>
                  <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">חיבור ישיר למידרג וליד2 לטובת איתור ספקים וחשיפת נכסים</p>
                </div>
                <span className="text-[10px] font-black text-slate-900 tracking-widest px-4 py-1.5 bg-slate-100 border border-slate-200 rounded-2xl shadow-sm">חיבורים פעילים</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {partnerIntegrations.map((integration) => (
                  <IntegrationStatusCard key={integration.id} integration={integration} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. MAINTENANCE KPIS & TIPS SIDEBAR */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Actionable Tip Card */}
          <div className="rounded-3xl bg-slate-950 p-6 sm:p-10 text-white shadow-sleek-lg relative overflow-hidden group transition-all">
            <div className="absolute top-0 right-0 w-48 h-64 bg-blue-600/20 skew-x-[-15deg] translate-x-10 translate-y-[-10%] group-hover:bg-blue-600/30 transition-all duration-700"></div>
            <h2 className="text-2xl font-black mb-6 tracking-tighter italic relative z-10">תחזוקה מונעת</h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-8 font-medium relative z-10 uppercase tracking-wide">
              בדיקת תקינות מערכות המים לפני עונת הגשמים חוסכת עד 40% מעלות התיקונים המפתיעים במהלך השנה.
            </p>
            <button 
              onClick={() => {
                alert("צ'ק-ליסט תחזוקה מונעת יורד כעת למכשירך. נא עקוב אחר ההוראות לשמירה על ערך הנכס.");
              }}
              className="w-full py-4 bg-white text-slate-950 font-black rounded-2xl text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-2xl relative z-10 uppercase tracking-widest flex items-center justify-center gap-3"
            >
              <span>הורד צ'ק-ליסט תקופתי</span>
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* Performance Stats Dashboard */}
          <div className="rounded-3xl bg-white p-8 shadow-sleek border border-slate-200 space-y-8">
            <h2 className="text-xs font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">מדדי ביצוע (SLA)</h2>
            <div className="space-y-8">
              <ServiceStat label="זמן תגובה ממוצע (Response)" value="2.4 שעות" progress={85} color="bg-blue-500" />
              <ServiceStat label="מדד שביעות רצון (CSAT)" value="9.8 / 10" progress={98} color="bg-emerald-500" />
              <ServiceStat label="תקלות שנסגרו החודש" value="12" progress={70} color="bg-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. NEW CALL MODAL (Overlay) */}
      {showNewCallForm && (
        <NewCallModal 
          properties={properties}
          onCreate={(payload) => createServiceCall(user.id, payload)}
          onClose={() => setShowNewCallForm(false)} 
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI Sub-Components for Clean Code
// -----------------------------------------------------------------------------

function ServiceCallCard({ call, userRole, onUpdate }: { call: ServiceCall, userRole: string, onUpdate: (data: Partial<ServiceCall>) => void }) {
  const categories: any = {
    plumbing: { color: "bg-blue-50 text-blue-600 border-blue-100", icon: <Droplets size={24} /> },
    electricity: { color: "bg-orange-50 text-orange-600 border-orange-100", icon: <Zap size={24} /> },
    general: { color: "bg-slate-50 text-slate-600 border-slate-100", icon: <Wrench size={24} /> },
    cleaning: { color: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: <CheckCircle2 size={24} /> }
  };

  const currentCategory = categories[call.category] || categories.general;

  return (
    <div className="group p-5 sm:p-8 rounded-3xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl transition-all animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-start justify-between gap-5 sm:gap-8">
        <div className="flex items-start gap-6">
          <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center border shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3", currentCategory.color)}>
            {currentCategory.icon}
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-black text-slate-900 tracking-tight italic">{call.title}</h3>
              <span className={cn(
                "px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest shadow-sm",
                call.priority === "high" ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-50 text-slate-400 border-slate-100"
              )}>
                {call.priority === "high" ? "עדיפות גבוהה / דחוף" : "עדיפות רגילה"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold flex items-center gap-2 mt-2 uppercase tracking-[0.1em]">
              <MapPin size={12} className="text-blue-500" /> 
              <span>{call.propertyAddress || "נכס לא משויך"}</span>
              <span className="opacity-30 mx-1">|</span>
              <span className="tabular-nums">פתיחה: {new Date(call.createdAt).toLocaleDateString()}</span>
            </p>
            <p className="text-sm text-slate-600 mt-6 font-medium leading-relaxed max-w-xl">{call.description}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-6 w-full md:w-auto">
          <div className={cn(
            "inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-[10px] font-black border uppercase tracking-[0.15em] shadow-sm",
            call.status === "in_progress" ? "bg-indigo-50 text-indigo-600 border-indigo-100" : 
            call.status === "closed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
            "bg-orange-50 text-orange-600 border-orange-100"
          )}>
            {call.status === "in_progress" ? <Clock size={16} className="animate-spin-slow" /> : 
             call.status === "closed" ? <CheckCircle2 size={16} /> :
             <AlertCircle size={16} />}
            {call.status === "in_progress" ? "בטיפול צוות טכני" : 
             call.status === "closed" ? "קריאה סגורה" :
             "ממתין לאישור ביצוע"}
          </div>

          {call.assignedVendor && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right w-full md:w-auto">
              <p className="text-[10px] font-black tracking-[0.14em] text-slate-400">בעל מקצוע מוקצה</p>
              <p className="mt-1 text-sm font-black text-slate-900">{call.assignedVendor}</p>
            </div>
          )}
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            {userRole === "landlord" && call.status === "open" && (
               <button 
                  onClick={() => {
                    onUpdate({ status: "in_progress", vendorId: "vendor_1" });
                    alert("בעל המקצוע הוקצה לקריאה. הוא ייצור קשר עם השוכר לתיאום הגעה.");
                  }}
                  className="flex-1 md:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sleek-blue hover:bg-blue-700 transition-all"
               >
                 הקצה בעל מקצוע
               </button>
            )}
            {(userRole === "landlord" || userRole === "admin") && call.status === "in_progress" && (
              <button
                onClick={() => {
                  onUpdate({ status: "open", vendorId: undefined, assignedVendor: undefined });
                  alert("הקצאת בעל המקצוע בוטלה והקריאה חזרה להמתנה לאישור.");
                }}
                className="flex-1 md:flex-none px-6 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:border-slate-900 transition-all"
              >
                בטל העברה לצוות טכני
              </button>
            )}
            {userRole === "tenant" && call.status === "in_progress" && (
              <button 
                onClick={() => onUpdate({ status: "closed" })}
                className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sleek hover:bg-emerald-700 transition-all"
              >
                סגור קריאה (בוצע)
              </button>
            )}
            <button className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-lg border border-transparent hover:border-blue-100 transition-all">
              <MessageSquare size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationStatusCard({ integration }: { integration: { provider: "midrag" | "yad2" | "insurance"; status: string; syncHealth: string; transactionCount: number; revenue: number; lastSyncAt: string } }) {
  const providerLabel = integration.provider === "midrag" ? "מידרג" : "יד2";
  const providerDescription =
    integration.provider === "midrag"
      ? "איתור בעלי מקצוע, סינון לפי דירוג והזרמת לידים לטיפול מהיר."
      : "פרסום נכסים, חשיפת מלאי והזרמת פניות ישירות למערכת.";
  const healthLabel =
    integration.syncHealth === "completed"
      ? "מסונכרן"
      : integration.syncHealth === "in_progress"
        ? "סנכרון פעיל"
        : "ממתין לסנכרון";
  const healthClass =
    integration.syncHealth === "completed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : integration.syncHealth === "in_progress"
        ? "bg-cyan-50 text-cyan-700 border-cyan-100"
        : "bg-amber-50 text-amber-700 border-amber-100";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black text-slate-900">{providerLabel}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500 font-semibold">{providerDescription}</p>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.12em]", healthClass)}>
          {healthLabel}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-4 border border-slate-100">
          <p className="text-[10px] font-black tracking-[0.12em] text-slate-400">עסקאות</p>
          <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">{integration.transactionCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-slate-100">
          <p className="text-[10px] font-black tracking-[0.12em] text-slate-400">סנכרון אחרון</p>
          <p className="mt-2 text-sm font-black text-slate-900">{new Date(integration.lastSyncAt).toLocaleDateString("he-IL")}</p>
        </div>
      </div>
    </div>
  );
}

function ProfessionalCard({ name, category, rating, reviews, icon }: any) {
  return (
    <div className="p-6 rounded-3xl border border-slate-50 bg-slate-50/50 hover:bg-white hover:border-indigo-400 hover:shadow-2xl transition-all cursor-pointer group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 border border-slate-100 group-hover:scale-110 group-hover:-rotate-3 transition-all">
            {icon}
          </div>
          <div>
            <p className="text-base font-black text-slate-900 leading-none italic">{name}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">{category}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 text-orange-400 group-hover:scale-110 transition-transform">
            <Star size={16} fill="currentColor" />
            <span className="text-lg font-black text-slate-900 tabular-nums">{rating}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">({reviews} ביקורות)</p>
        </div>
      </div>
    </div>
  );
}

function ServiceStat({ label, value, progress, color }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
        <p className="text-base font-black text-slate-900 italic tabular-nums">{value}</p>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
}

function NewCallModal({
  properties,
  onCreate,
  onClose,
}: {
  properties: Property[];
  onCreate: (payload: {
    propertyId: string;
    title: string;
    description: string;
    priority: "medium" | "low" | "high";
    category: "general" | "plumbing" | "electricity" | "cleaning" | "other";
  }) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    category: "general",
    propertyId: properties[0]?.id || ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.title || !formData.propertyId) return;

    setIsSubmitting(true);
    try {
      onCreate({
        propertyId: formData.propertyId,
        title: formData.title,
        description: formData.description,
        priority: formData.priority as "medium" | "low" | "high",
        category: formData.category as "general" | "plumbing" | "electricity" | "cleaning" | "other",
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-2xl rounded-[40px] bg-white p-5 sm:p-8 md:p-12 shadow-2xl border border-slate-200 text-right animate-in zoom-in-95 duration-300 relative overflow-hidden max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 left-4 sm:top-8 sm:left-8 text-slate-300 hover:text-slate-900 hover:rotate-90 transition-all">
           <X size={24} />
        </button>
        
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tighter italic">דיווח על תקלה בנכס</h2>
        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mb-10">שלב 2: תיאור הבעיה וצילום</p>
        
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">נושא התקלה / כותרת קצרה</label>
            <input 
              type="text" 
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all font-bold placeholder:text-slate-300" 
              placeholder="למשך: נזילה בקופסת החשמל, סתימה משמעותית בשירותים..." 
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">פירוט המפגע (ציין מיקום מדויק)</label>
            <textarea 
              className="w-full h-40 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all resize-none font-bold placeholder:text-slate-300" 
              placeholder="נא פרט מה הבעיה, מתי התחילה והאם היא מונעת שימוש בנכס..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            ></textarea>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">בדיקת דחיפות</label>
              <select 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 appearance-none font-black text-slate-900 italic"
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
              >
                <option value="low">עדיפות רגילה (עד 72 שעות)</option>
                <option value="medium">דחוף (עד 24 שעות)</option>
                <option value="high">חירום (מיידי / סכנת חיים)</option>
              </select>
            </div>
            
            <div className="space-y-3">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">בחר נכס מבוטח</label>
               <select 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 appearance-none font-black text-slate-900"
                value={formData.propertyId}
                onChange={(e) => setFormData({...formData, propertyId: e.target.value})}
              >
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.address}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Photo Upload Requirement (Simulated) */}
          <div className="p-8 bg-blue-50/50 rounded-3xl border-2 border-dashed border-blue-200 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-blue-600 hover:bg-white transition-all">
             <Camera size={32} className="text-blue-600 mb-3 group-hover:scale-125 transition-transform" />
             <p className="text-sm font-black text-slate-900 italic mb-1 uppercase tracking-tight">צלם את התקלה (חובה להמשך)</p>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">תמונה אחת שווה אלף מילים ועוזרת לאיש המקצוע</p>
          </div>
        </div>

        <div className="mt-10 flex gap-6">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title || !formData.propertyId}
            className="flex-[2] py-5 bg-slate-950 text-white rounded-2xl text-base font-black shadow-sleek-lg hover:bg-blue-600 active:scale-95 transition-all uppercase tracking-[0.2em] disabled:opacity-50 italic"
          >
            {isSubmitting ? "שולח למערכת..." : "שלח דיווח למשכיר"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyMaintenanceState() {
  return (
    <div className="text-center py-20 text-slate-900/10 select-none">
      <CheckCircle2 size={96} className="mx-auto mb-8 text-emerald-500/20" />
      <h3 className="text-3xl font-black text-slate-900 tracking-tighter opacity-20 italic">הכל תקין עכשיו!</h3>
      <p className="text-xs font-black text-slate-400 uppercase mt-2 tracking-widest opacity-40">אין קריאות שירות פתוחות הדורשות את תשומת ליבך</p>
    </div>
  );
}
