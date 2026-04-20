import { useMemo, useState, ReactNode } from "react";
import { 
  FileText, 
  Download, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  History,
  ChevronLeft,
  CheckCircle2,
  Lock,
  Calendar,
  X,
  Plus
} from "lucide-react";
import { User, Contract, Property } from "../types";
import { cn } from "../lib/utils";
import { useAppData } from "../lib/appData";
import { formatCurrencyCompact } from "../lib/analytics";

/**
 * ContractsManagement Component
 */
export default function ContractsManagement({ user }: { user: User }) {
  const { db, signContract, createContract } = useAppData();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const contracts = useMemo(() => db.contracts.filter((contract) => {
    if (user.role === "admin") return true;
    if (user.role === "landlord") return contract.landlordId === user.id;
    return contract.tenantId === user.id;
  }), [db.contracts, user.id, user.role]);

  const landlordProperties = useMemo(() =>
    user.role === "admin"
      ? db.properties
      : db.properties.filter((property) => property.landlordId === user.id),
    [db.properties, user.id, user.role]);

  const contractMetrics = useMemo(() => {
    const active = contracts.filter((contract) => contract.status === "active");
    const waitingSignature = contracts.filter((contract) => contract.status === "waiting_signature");
    const guarantees = contracts.reduce<Record<string, number>>((acc, contract) => {
      acc[contract.guaranteeType || "none"] = (acc[contract.guaranteeType || "none"] || 0) + 1;
      return acc;
    }, {});
    const linkedTransactions = db.transactions.filter((transaction) =>
      contracts.some((contract) => contract.id === transaction.contractId),
    );
    const totalRent = contracts.reduce((sum, contract) => sum + contract.rentAmount, 0);
    return {
      total: contracts.length,
      active: active.length,
      waitingSignature,
      linkedTransactionCount: linkedTransactions.length,
      linkedTransactionVolume: linkedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
      totalRent,
      insuranceGuarantees: guarantees.insurance || 0,
      bankGuarantees: guarantees.bank || 0,
      promissoryGuarantees: guarantees.promissory || 0,
    };
  }, [contracts, db.transactions]);
  const latestSignatureRequest = contractMetrics.waitingSignature[0] || null;
  const versionTemplates = db.contractTemplates;

  // Sign Document Logic
  const handleSignDoc = async (contractId: string) => {
    signContract(contractId, user.id);
    alert("המסמך נחתם בהצלחה!");
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700" dir="rtl">
      
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-200/60">
        <div className="flex items-center gap-5">
           <div className="h-16 w-16 bg-white border border-slate-100 shadow-sm rounded-[20px] flex items-center justify-center text-blue-600 rotate-3 transition-transform hover:scale-110">
              <FileText size={32} />
           </div>
           <div>
             <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter italic font-display leading-tight">ניהול חוזים והסכמים</h1>
             <p className="text-slate-400 font-bold mt-2 text-[13px] tracking-[0.08em]">
               {contractMetrics.total.toLocaleString("he-IL")} חוזים • {contractMetrics.linkedTransactionCount.toLocaleString("he-IL")} עסקאות משויכות • ארכיון משפטי פעיל
             </p>
           </div>
        </div>
        {user.role !== "tenant" && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-[13px] font-black text-white shadow-xl hover:shadow-2xl hover:bg-black active:scale-95 transition-all uppercase tracking-widest italic"
          >
            <Plus size={18} />
            <span>יצירת חוזה חדש</span>
          </button>
        )}
      </div>

      <div className="grid gap-8 md:gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* 2. MAIN LIST - Contracts & Insurance */}
        <div className="space-y-10">
          
          {/* Contracts List Table */}
          <div className="rounded-[32px] bg-white shadow-sleek border border-slate-200 overflow-hidden relative">
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight italic font-display flex items-center gap-4">
                 <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                   <FileText size={18} />
                 </div>
                 <span>ארכיון חוזים פעילים</span>
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              {contracts.length > 0 ? (
                <table className="w-full min-w-[720px] text-right">
                  <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.16em] border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5">נכס ותקופה</th>
                      {user.role !== "tenant" && <th className="px-8 py-5">שוכר</th>}
                      <th className="px-8 py-5 text-center">סטטוס</th>
                      <th className="px-8 py-5 text-left">מסמכים</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {contracts.map(contract => (
                      <ContractRow key={contract.id} contract={contract} userRole={user.role} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                   <FileText size={48} className="mb-4 opacity-20" />
                   <p className="font-bold uppercase tracking-widest text-sm">אין חוזים להצגה</p>
                </div>
              )}
            </div>
          </div>

          {/* Guarantees & Insurance Status */}
          <div className="rounded-[32px] bg-white p-8 md:p-10 shadow-sleek border border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight italic font-display flex items-center gap-4">
                <div className="h-8 w-8 bg-slate-900 text-white rounded-lg flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <span>ביטוחים וערבויות</span>
              </h2>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 relative z-10">
              <GuaranteeCard 
                label="חוזים פעילים" 
                value={contractMetrics.active.toLocaleString("he-IL")} 
                status={`שכירות חודשית כוללת ${formatCurrencyCompact(contractMetrics.totalRent)}`} 
                icon={<Lock size={20} />} 
              />
              <GuaranteeCard 
                label="נפח עסקאות משויך לחוזים" 
                value={formatCurrencyCompact(contractMetrics.linkedTransactionVolume)} 
                status={`${contractMetrics.linkedTransactionCount.toLocaleString("he-IL")} עסקאות משויכות`} 
                icon={<ShieldCheck size={20} />} 
              />
              <GuaranteeCard 
                label="ערבויות ביטוח" 
                value={contractMetrics.insuranceGuarantees.toLocaleString("he-IL")} 
                status="חוזים עם ביטוח ערבות פעיל" 
                icon={<ShieldCheck size={20} />} 
              />
              <GuaranteeCard 
                label="ערבויות בנקאיות ושטרי חוב" 
                value={(contractMetrics.bankGuarantees + contractMetrics.promissoryGuarantees).toLocaleString("he-IL")} 
                status="מכסה בנקאית והתחייבויות חוזיות" 
                icon={<Lock size={20} />} 
              />
            </div>
          </div>
        </div>

        {/* 3. SIDEBAR Actions & Versioning */}
        <div className="space-y-10">
          
          {/* Digital Signature Promotion/Action */}
          <div className="rounded-[32px] bg-slate-950 p-6 md:p-10 text-white shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full mix-blend-screen transition-all group-hover:bg-blue-500/30"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-600/20 blur-[80px] rounded-full mix-blend-screen"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-md">
                   <span className="text-2xl">✍️</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight italic font-display">חתימה דיגיטלית</h2>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-[0.2em]">אבטחה מקסימלית • תוקף משפטי</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-10 mt-8">
                <div className="flex items-center gap-5 p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-all">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <Clock size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[15px] font-black text-white leading-none tracking-tight">
                      {latestSignatureRequest ? "ממתין לחתימה" : "אין מסמכים פתוחים לחתימה"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2 font-bold max-w-[240px] leading-relaxed">
                      {latestSignatureRequest
                        ? `${latestSignatureRequest.propertyAddress || latestSignatureRequest.propertyId} • ${latestSignatureRequest.tenantName || "שוכר לא הוגדר"}`
                        : `${contractMetrics.active.toLocaleString("he-IL")} חוזים פעילים כבר חתומים במערכת`}
                    </p>
                  </div>
                </div>
              </div>
              
              {latestSignatureRequest && (
                <button 
                  onClick={() => {
                    handleSignDoc(latestSignatureRequest.id);
                  }}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-[0_0_40px_rgba(37,99,235,0.3)] hover:shadow-[0_0_60px_rgba(37,99,235,0.5)] active:scale-95 text-xs uppercase tracking-[0.16em] leading-none border border-blue-400/50"
                >
                  חתום כעת על המסמך
                </button>
              )}
            </div>
          </div>

          {/* Audit Trail / Version History */}
          <div className="rounded-[32px] bg-white p-8 md:p-10 shadow-sleek border border-slate-200">
            <h2 className="text-xl font-black text-slate-900 mb-8 tracking-tight italic font-display flex items-center gap-3">
              <History size={24} className="text-slate-400" />
              <span>היסטוריית גרסאות משפטיות</span>
            </h2>
            <div className="space-y-3">
              {versionTemplates.map((template) => (
                <VersionItem key={template.id} template={template} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateContractModal 
          properties={landlordProperties} 
          onCreate={(payload) => createContract(user.id, payload)}
          onClose={() => setShowCreateModal(false)} 
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// UI Sub-Components for Clean Code
// -----------------------------------------------------------------------------

function CreateContractModal({
  properties,
  onCreate,
  onClose,
}: {
  properties: Property[];
  onCreate: (payload: {
    propertyId: string;
    tenantName: string;
    tenantEmail: string;
    startDate: string;
    endDate: string;
    rentAmount: number;
    guaranteeType: "bank" | "insurance" | "cash" | "promissory";
  }) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    propertyId: "",
    tenantName: "",
    tenantEmail: "",
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    rentAmount: "0",
    guaranteeType: "bank" as const
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.propertyId || !formData.tenantName || !formData.endDate) return;
    setIsSubmitting(true);
    try {
      onCreate({
        propertyId: formData.propertyId,
        tenantName: formData.tenantName,
        tenantEmail: formData.tenantEmail,
        startDate: formData.startDate,
        endDate: formData.endDate,
        rentAmount: Number(formData.rentAmount),
        guaranteeType: formData.guaranteeType,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right" dir="rtl">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-8 md:p-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 italic tracking-tighter">יצירת הסכם שכירות חדש</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">בחר נכס</label>
            <select 
              value={formData.propertyId} 
              onChange={e => setFormData({...formData, propertyId: e.target.value})}
              className="w-full mt-2 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
            >
              <option value="">בחר נכס מהרשימה...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.address}</option>
              ))}
            </select>
          </div>

          <Input label="שלו שם השוכר המלא" value={formData.tenantName} onChange={(v: string) => setFormData({...formData, tenantName: v})} placeholder="למשל: ישראל ישראלי" />
          <Input label="אימייל השוכר" value={formData.tenantEmail} onChange={(v: string) => setFormData({...formData, tenantEmail: v})} placeholder="email@example.com" />
          
          <Input label="תאריך תחילת חוזה" type="date" value={formData.startDate} onChange={(v: string) => setFormData({...formData, startDate: v})} />
          <Input label="תאריך סיום חוזה" type="date" value={formData.endDate} onChange={(v: string) => setFormData({...formData, endDate: v})} />
          
          <Input label="דמי שכירות חודשיים (₪)" type="number" value={formData.rentAmount} onChange={(v: string) => setFormData({...formData, rentAmount: v})} />
          
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">סוג ערבות</label>
            <select 
              value={formData.guaranteeType} 
              onChange={e => setFormData({...formData, guaranteeType: e.target.value as any})}
              className="w-full mt-2 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
            >
              <option value="bank">ערבות בנקאית</option>
              <option value="insurance">ביטוח ערבות</option>
              <option value="cash">פיקדון מזומן</option>
              <option value="promissory">שטר חוב</option>
            </select>
          </div>
        </div>

        <div className="mt-10 flex flex-col-reverse sm:flex-row gap-4">
          <button onClick={onClose} className="flex-1 py-4 text-sm font-black text-slate-400 hover:text-slate-900">ביטול</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-sleek-blue hover:bg-blue-700 transition-all">
             {isSubmitting ? "מייצר הסכם..." : "שלח לחתימה דיגיטלית"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div className="space-y-2 text-right">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{label}</label>
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

function ContractRow({ contract, userRole }: { contract: Contract, userRole: string }) {
  const statusConfig: any = {
    active: { color: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "בתוקף" },
    waiting_signature: { color: "bg-amber-50 text-amber-600 border-amber-200 shadow-sm", label: "ממתין לחתימה" },
    expired: { color: "bg-slate-100 text-slate-500 border-slate-200", label: "פג תוקף" }
  };

  const currentStatus = statusConfig[contract.status] || statusConfig.waiting_signature;

  return (
    <tr className="group hover:bg-slate-50/80 transition-all cursor-pointer">
      <td className="px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all shadow-sm">
             <FileText size={18} />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[15px] font-black text-slate-900 italic font-display">{contract.propertyAddress || contract.propertyId}</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest tabular-nums">
                {contract.startDate} — {contract.endDate}
              </span>
            </div>
          </div>
        </div>
      </td>
      {userRole !== "tenant" && (
        <td className="px-8 py-6 text-right">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 border border-white shadow-sm ring-2 ring-slate-50">
               {contract.tenantName ? contract.tenantName.charAt(0) : "T"}
             </div>
             <span className="text-sm font-bold text-slate-700">{contract.tenantName || "שוכר לא הוגדר"}</span>
          </div>
        </td>
      )}
      <td className="px-8 py-6 text-center">
        <span className={cn("inline-flex items-center justify-center rounded-xl px-4 py-2 text-[10px] font-black uppercase border tracking-widest", currentStatus.color)}>
          {currentStatus.label}
        </span>
      </td>
      <td className="px-8 py-6 text-left">
        <div className="flex items-center justify-end gap-3">
          <button className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 bg-white border border-slate-200 hover:text-blue-600 hover:bg-blue-50 transition-all hover:border-blue-200 shadow-sm">
            <Download size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function GuaranteeCard({ label, value, status, icon, isDownloadable = false }: any) {
  return (
    <div className="p-6 rounded-[24px] border border-slate-100 bg-slate-50/50 group hover:bg-white hover:shadow-xl hover:border-slate-200 transition-all duration-300 text-right cursor-pointer min-h-[140px] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-blue-500 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-blue-600 group-hover:text-white">
          {icon}
        </div>
        {isDownloadable && (
          <button className="h-10 w-10 rounded-xl bg-slate-100/50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Download size={18} />
          </button>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
        <p className="text-xl font-black text-slate-900 leading-none italic font-display">{value}</p>
        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {status}
        </p>
      </div>
    </div>
  );
}

function VersionItem({ template }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all group cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors shadow-sm">
          <History size={18} />
        </div>
        <div className="text-right">
          <p className="text-[13px] font-black text-slate-900 tracking-tight leading-none">{template.name}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{template.version} • {template.summary}</p>
        </div>
      </div>
      <button className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-300 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
         <Download size={16} />
      </button>
    </div>
  );
}
