import { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, 
  CheckCircle2, 
  Check,
  CreditCard, 
  FileText, 
  ShieldCheck, 
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  FileSignature,
  LogOut
} from "lucide-react";
import { cn } from "../lib/utils";
import { User } from "../types";
import { useAppData } from "../lib/appData";

// -----------------------------------------------------------------------------
// Constants & Types
// -----------------------------------------------------------------------------

interface OnboardingProps {
  user: User;
  onComplete: () => void;
  onLogout: () => void;
}

const STEPS = [
  { id: "kyc", title: "זיהוי (KYC)", icon: <UserCheck size={20} /> },
  { id: "bdi", title: "בדיקת אשראי", icon: <ShieldCheck size={20} /> },
  { id: "payment", title: "הרשאה לחיוב", icon: <CreditCard size={20} /> },
  { id: "contract", title: "חתימה על הסכם", icon: <FileSignature size={20} /> },
  { id: "finish", title: "סיום", icon: <CheckCircle2 size={20} /> },
];

// -----------------------------------------------------------------------------
// Main Onboarding Component
// -----------------------------------------------------------------------------

export default function Onboarding({ user, onComplete, onLogout }: OnboardingProps) {
  const {
    submitKyc,
    approveKyc,
    requestEligibilityCheck,
    resolveEligibilityCheck,
    saveBankAuthorization,
    signOnboardingContract,
    completeOnboarding,
  } = useAppData();
  const [currentStep, setCurrentStep] = useState(user.onboardingStep || 0);
  const [isProcessing, setIsProcessing] = useState(false);

  const getButtonText = () => {
    if (isProcessing) return "...";
    if (currentStep === STEPS.length - 1) return "התחל להשתמש במערכת";
    if (currentStep === 0) {
      if (user.kycStatus === "pending") return "שלח לאימות זהות";
      if (user.kycStatus === "submitted") return "אשר KYC (סימולציית מנהל)";
    }
    if (currentStep === 1) {
      if (!user.bdiStatus) return "התחל בדיקת BDI";
      if (user.bdiStatus === "pending") return "אשר BDI (סימולציית מנהל)";
    }
    return "המשך לשלב הבא";
  };

  const handleNext = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      if (currentStep < STEPS.length - 1) {
        if (currentStep === 0) {
          if (user.kycStatus === "pending") {
            submitKyc(user.id);
          } else if (user.kycStatus === "submitted") {
            setCurrentStep(1);
            approveKyc(user.id);
          } else {
            setCurrentStep(1);
          }
        } else if (currentStep === 1) {
          if (!user.bdiStatus || user.bdiStatus === "pending") {
            if (user.bdiStatus === "pending") {
              setCurrentStep(2);
              resolveEligibilityCheck(user.id, true);
            } else {
              requestEligibilityCheck(user.id);
            }
          } else {
            setCurrentStep(2);
          }
        } else if (currentStep === 2) {
           const nextStep = currentStep + 1;
           setCurrentStep(nextStep);
           saveBankAuthorization(user.id);
        } else if (currentStep === 3) {
           const nextStep = currentStep + 1;
           setCurrentStep(nextStep);
           signOnboardingContract(user.id);
        } else if (currentStep === 4) {
          completeOnboarding(user.id);
          onComplete();
        }
      } else {
        onComplete();
      }
    } finally {
      // Small artificial timeout to allow the transition animation to start smoothly
      // but keeping it very short (50ms)
      setTimeout(() => setIsProcessing(false), 50);
    }
  };

  const handleBack = async () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4 text-right" dir="rtl">
      {/* Header with Logo and Logout */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-8 px-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 shrink-0 rounded-[14px] bg-slate-900 shadow-xl flex items-center justify-center text-white font-black text-2xl italic font-display">
            R
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tighter font-display">
            Rent<span className="text-blue-600">Flow</span>
          </span>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-3 px-5 py-2.5 text-slate-600 font-bold text-[13px] hover:text-red-500 transition-colors bg-white rounded-2xl shadow-sm border border-slate-100"
        >
          <LogOut size={16} />
          <span>יציאה</span>
        </button>
      </div>

      <div className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl border border-slate-200">
        
        {/* Top Progress Navigator */}
        <div className="flex border-b border-slate-100 bg-slate-50/30 p-4 md:p-10 overflow-x-auto hide-scrollbar gap-2 snap-x">
          {STEPS.map((step, index) => (
            <StepIndicator 
              key={step.id}
              step={step}
              index={index}
              currentStep={currentStep}
              onNavigate={(target: number) => {
                if (target <= currentStep) {
                  setCurrentStep(target);
                }
              }}
              isLast={index === STEPS.length - 1}
            />
          ))}
        </div>

        {/* Dynamic Step Content */}
        <div className="p-6 md:p-16 min-h-[480px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-10"
            >
              <StepContent stepIndex={currentStep} user={user} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="flex flex-col-reverse md:flex-row items-center justify-between border-t bg-slate-50/50 p-6 md:p-12 gap-4">
          <button 
            onClick={handleBack}
            disabled={currentStep === 0 || isProcessing || currentStep === STEPS.length - 1}
            className="flex items-center justify-center w-full md:w-auto gap-3 text-slate-400 font-black text-xs uppercase tracking-widest disabled:opacity-30 hover:text-slate-900 transition-colors italic border md:border-none border-slate-200 rounded-2xl md:rounded-none py-4 md:py-0"
          >
            <ChevronRight size={18} />
            <span>שלב קודם</span>
          </button>
          
          <button 
            onClick={handleNext}
            disabled={isProcessing}
            className="flex items-center justify-center w-full md:w-auto gap-3 rounded-2xl bg-slate-900 px-8 md:px-12 py-4 font-black text-white transition-all shadow-xl hover:bg-black active:scale-95 disabled:bg-slate-300 disabled:shadow-none font-display uppercase tracking-widest italic text-[14px] md:text-[15px]"
          >
            {isProcessing ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>{getButtonText()}</span>
                <ChevronLeft size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Step Components (Internal View Selection)
// -----------------------------------------------------------------------------

function StepContent({ stepIndex, user }: { stepIndex: number, user: User }) {
  switch (stepIndex) {
    case 0: return <KYCStep user={user} />;
    case 1: return <BDIStep />;
    case 2: return <PaymentMethodStep />;
    case 3: return <ContractStep />;
    case 4: return <FinishStep />;
    default: return null;
  }
}

function KYCStep({ user }: { user: User }) {
  const [step, setStep] = useState<"choice" | "scanning" | "success">("choice");

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight italic font-display underline decoration-blue-600/30 decoration-8 underline-offset-[-2px]">זיהוי לקוח (KYC)</h2>
        <p className="text-slate-500 font-bold mt-4 text-[13px] md:text-[15px]">בוא נסיים את הליך האימות המשפטי. המידע שלך מוצפן ומאובטח.</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
        <UploadCard 
          label="צילום תעודת זהות" 
          icon={<Camera size={24} />} 
          sub="וודא שהפרטים ברורים וללא השתקפות" 
          status={user.kycStatus === "approved" ? "complete" : "pending"}
        />
        <UploadCard 
          label="צילום סלפי וידאו" 
          icon={<Camera size={24} />} 
          sub="זיהוי פנים למניעת זיוף זהות" 
          status={user.kycStatus === "approved" ? "complete" : "pending"}
        />
      </div>

      <div className="p-6 md:p-10 bg-slate-900 rounded-[32px] md:rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 h-40 w-40 bg-blue-600/10 rounded-full translate-x-20 -translate-y-20 blur-3xl"></div>
        <div className="relative z-10 flex flex-col items-center text-center">
           <ShieldCheck size={36} md:size={40} className="text-blue-500 mb-4 md:mb-6" />
           <h3 className="text-lg md:text-xl font-black italic font-display">הצהרת סודיות ואבטחה</h3>
           <p className="text-slate-400 text-xs font-bold mt-3 md:mt-4 leading-relaxed max-w-sm">
             RentFlow עומדת בתקני אבטחה מחמירים. המידע הביומטרי שלך משמש לאימות בלבד ונמחק מיד לאחר אישור הבנק.
           </p>
        </div>
      </div>
    </div>
  );
}

function BDIStep() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const startCheck = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      setResult({ grade: "A+", score: 782 });
    }, 3000);
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight italic font-display">בדיקת דירוג אשראי</h2>
        <p className="text-slate-500 font-bold mt-4 text-[13px] md:text-[15px]">לזירוז תהליך החתימה, אנו מבצעים בדיקת Soft-Check שאינה פוגעת בדירוג.</p>
      </div>

      {!result ? (
        <div className="p-8 md:p-12 bg-white rounded-[32px] md:rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center text-center space-y-6 md:space-y-8 hover:border-slate-900 transition-all group">
           <div className={cn(
             "h-20 w-20 md:h-24 md:w-24 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 transition-all",
             checking ? "animate-spin border-4 border-slate-900 border-t-transparent bg-transparent" : "group-hover:rotate-6 group-hover:bg-slate-900 group-hover:text-white"
           )}>
              <ShieldCheck size={40} className="md:w-12 md:h-12" />
           </div>
           <div>
              <p className="text-[15px] md:text-[17px] font-black text-slate-900 italic font-display">התחל בדיקת זכאות מיידית</p>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold mt-2 uppercase tracking-[0.1em] md:tracking-widest leading-relaxed">אישור חתום לביצוע בדיקה ע״י BDI</p>
           </div>
           <button 
             onClick={startCheck}
             disabled={checking}
             className="w-full md:w-auto px-6 md:px-12 py-4 md:py-5 bg-slate-900 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all italic font-display"
           >
              {checking ? "מתחבר למאגרים..." : "אשר ובצע בדיקה"}
           </button>
        </div>
      ) : (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-10 bg-emerald-500 rounded-[40px] text-white shadow-2xl text-center space-y-6"
        >
           <div className="h-20 w-20 bg-white text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl">
              <Check size={40} />
           </div>
           <h3 className="text-5xl font-black italic font-display tracking-tighter">זכאי! ({result.grade})</h3>
           <p className="text-emerald-100 font-bold">דירוג האשראי שלך מעולה. המשכיר יקבל חיווי חיובי בלבד.</p>
        </motion.div>
      )}
    </div>
  );
}

function PaymentMethodStep() {
  return (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight italic font-display">הרשאה לחיוב (מס"ב)</h2>
        <p className="text-slate-500 font-bold mt-4 text-[15px]">הסדרת התשלום האוטומטי. הכסף עובר ישירות מהבנק שלך למשכיר.</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <InputField label="שם הבנק" placeholder="בנק הפועלים (12)" />
          <InputField label="מספר סניף" placeholder="612" />
          <InputField label="מספר חשבון" placeholder="12345678" />
        </div>
        
        <div className="p-10 bg-blue-600 rounded-[40px] text-white shadow-2xl flex flex-col items-center text-center space-y-6">
           <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <FileSignature size={32} />
           </div>
           <div>
              <h3 className="text-xl font-black italic font-display">חתימה על טופס הרשאה</h3>
              <p className="text-blue-100 text-xs font-bold mt-2 leading-relaxed opacity-80 uppercase tracking-wide">
                חתימה זו מהווה אישור לחיוב חשבון הבנק שלך בסכום השכירות החודשי
              </p>
           </div>
           <div className="h-40 w-full bg-white rounded-3xl border-4 border-blue-100 cursor-crosshair flex items-center justify-center text-slate-300 italic font-display">
              צייר את החתימה שלך כאן
           </div>
        </div>
      </div>
    </div>
  );
}

function ContractStep() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">חתימה על הסכם ושטר חוב</h2>
        <p className="text-slate-500 font-medium mt-2">מזל טוב! השלב האחרון הוא חתימה על חוזה השכירות ושטר החוב הנלווה</p>
      </div>
      
      <div className="grid gap-6">
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner group cursor-pointer hover:border-blue-400 transition-all">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <FileText className="text-blue-600" size={24} />
                 <div>
                    <p className="text-sm font-black text-slate-900">הסכם שכירות דיגיטלי</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">לחץ לצפייה וחתימה</p>
                 </div>
              </div>
              <CheckCircle2 size={20} className="text-slate-200 group-hover:text-blue-600 transition-colors" />
           </div>
        </div>

        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner group cursor-pointer hover:border-orange-400 transition-all">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="text-orange-600" size={24} />
                 <div>
                    <p className="text-sm font-black text-slate-900 italic">שטר חוב (Promissory Note)</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ביטחון להסכם השכירות</p>
                 </div>
              </div>
              <CheckCircle2 size={20} className="text-slate-200 group-hover:text-orange-600 transition-colors" />
           </div>
        </div>
      </div>
    </div>
  );
}

function FinishStep() {
  return (
    <div className="space-y-8 text-center py-10">
      <div className="relative inline-block">
        <div className="h-32 w-32 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-sleek-lg animate-bounce">
          <CheckCircle2 size={64} />
        </div>
        <div className="absolute -top-4 -right-4 h-12 w-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-green-500 border border-green-100 animate-pulse">
          <ShieldCheck size={24} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">ברוך הבא לבית החדש!</h2>
        <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
          כל המסמכים החתומים נשלחו כרגע למייל שלך ולבעל הנכס. מעכשיו, הכל מנוהל ב-RentFlow.
        </p>
      </div>

      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 inline-flex flex-col gap-2 shadow-sm italic">
         <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">מה קורה עכשיו?</p>
         <p className="text-xs font-bold text-slate-600 leading-relaxed">
           החיוב הקרוב יבוצע אוטומטית • תקבל התראה יומיים לפני • מוזמן לדווח על כל תקלה בקליק
         </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Shared Logic / Helpers (Standalone BDI view used in Admin)
// -----------------------------------------------------------------------------

export function BDICheckStandalone() {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");

  const runCheck = () => {
    setStatus("processing");
    setTimeout(() => setStatus("success"), 2500);
  };

  return (
    <div className="max-w-md mx-auto p-12 bg-white rounded-[36px] shadow-2xl border border-slate-200 text-right animate-in zoom-in-95 duration-500" dir="rtl">
      <div className="text-center mb-12">
        <div className="h-20 w-20 bg-slate-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-slate-900/20 rotate-3">
          <ShieldCheck size={36} />
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter italic font-display">בדיקת זכאות BDI</h2>
        <p className="text-[15px] text-slate-500 mt-3 font-bold">הפק דוח אשראי חתום לזירוז חתימת החוזה</p>
      </div>

      {status === "idle" && (
        <div className="space-y-8">
          <InputField label="מספר תעודת זהות" placeholder="למשל: 312456789" />
          <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
            <input type="checkbox" className="mt-1 h-5 w-5 rounded-lg border-slate-300 text-slate-900 focus:ring-slate-900 transition-all border-2" />
            <span className="text-[11px] text-slate-400 font-black leading-relaxed italic uppercase tracking-[0.1em]">
              אני מאשר ביצוע בדיקת נתוני אשראי ע״י BDI. המידע ישמש להערכת זכאות בלבד • מסלול soft check ללא פגיעה בדירוג
            </span>
          </div>
          <button 
            onClick={runCheck}
            className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95 text-[15px] font-display italic uppercase tracking-widest"
          >
            בצע בדיקה מיידית
          </button>
        </div>
      )}

      {status === "processing" && (
        <div className="text-center py-20">
          <div className="h-20 w-20 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-10 shadow-xl relative">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100 opacity-20"></div>
          </div>
          <p className="font-black text-slate-900 text-2xl animate-pulse italic tracking-tighter font-display">מתחבר למאגרי המידע...</p>
          <p className="text-[11px] text-slate-400 mt-4 font-bold uppercase tracking-[0.2em] leading-loose">
            BDI Credit Monitoring • מסד נתוני אזרחים • בדיקת עיקולים
          </p>
        </div>
      )}

      {status === "success" && (
        <div className="text-center transition-all animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="h-28 w-28 bg-emerald-500 text-white rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-2xl transform rotate-6 scale-110">
            <CheckCircle2 size={56} />
          </div>
          <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic font-display">זכאי! (Grade: A+)</h3>
          <p className="text-slate-500 mt-2 font-bold italic text-[15px]">ציון ה-BDI שלך מצוין ומאפשר המשך תהליך מיידי.</p>
          
          <div className="mt-12 p-8 bg-slate-950 rounded-[32px] text-right shadow-2xl relative overflow-hidden group border border-white/5">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
            <div className="flex justify-between items-center mb-5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">ציון אשראי bdi</span>
              <span className="text-sm font-black text-emerald-400 uppercase italic font-display">מעולה</span>
            </div>
            <div className="flex items-end gap-4">
               <span className="text-6xl font-black text-white tracking-tighter tabular-nums font-display">782</span>
               <span className="text-sm text-slate-600 font-bold mb-3 tracking-widest">/ 850</span>
            </div>
            <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden mt-8">
              <div className="bg-emerald-500 h-full w-[88%] rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)]"></div>
            </div>
          </div>
          
          <button className="w-full mt-12 py-5 border-2 border-slate-900 text-slate-900 font-black rounded-2xl hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-[0.2em] text-[13px] flex items-center justify-center gap-4 italic font-display">
            <span>שלח אסמכתא חתומה למשכיר</span>
            <ChevronLeft size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Small UI Element Helpers
// -----------------------------------------------------------------------------

function StepIndicator({ step, index, currentStep, isLast, onNavigate }: any) {
  const isActive = index <= currentStep;
  const isCompleted = index < currentStep;
  const canNavigate = index <= (currentStep || 0);

  return (
    <div className="flex flex-1 items-center last:flex-none">
      <div 
        onClick={() => canNavigate && onNavigate(index)}
        className={cn(
          "flex flex-col items-center gap-4 transition-all px-2",
          canNavigate ? "cursor-pointer hover:opacity-100" : "cursor-default"
        )}
      >
        <div className={cn(
          "flex h-14 w-14 items-center justify-center rounded-[20px] transition-all duration-500 shadow-sm relative group",
          isActive 
            ? "bg-slate-900 text-white shadow-xl rotate-3" 
            : "bg-slate-100 text-slate-400 grayscale opacity-40"
        )}>
          {isCompleted ? <CheckCircle2 size={24} className="animate-in zoom-in" /> : step.icon}
          {isActive && !isCompleted && <div className="absolute -inset-1 rounded-[20px] border-2 border-slate-900 opacity-20 animate-ping"></div>}
        </div>
        <span className={cn(
          "text-[9px] font-black uppercase tracking-[0.2em] text-center whitespace-nowrap italic",
          isActive ? "text-slate-900" : "text-slate-300"
        )}>
          {step.title}
        </span>
      </div>
      {!isLast && (
        <div className="mx-2 md:mx-6 h-[2px] bg-slate-100 flex-1 relative mt-[-18px]">
           <div className={cn(
             "absolute top-0 right-0 h-full bg-slate-900 transition-all duration-1000",
             isCompleted ? "w-full" : "w-0"
           )} />
        </div>
      )}
    </div>
  );
}

function UploadCard({ label, icon, sub, status }: { label: string, icon: ReactNode, sub?: string, status?: string }) {
  return (
    <div className="flex aspect-video flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-900 hover:shadow-2xl transition-all group cursor-pointer p-6 text-center relative">
       {status === "approved" && (
         <div className="absolute top-6 left-6 h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg animate-in zoom-in">
           <CheckCircle2 size={16} />
         </div>
       )}
      <div className="h-16 w-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-900 group-hover:shadow-lg group-hover:rotate-6 transition-all mb-6">
        {icon}
      </div>
      <span className="text-[17px] font-black text-slate-900 group-hover:text-slate-900 transition-colors uppercase tracking-tight italic font-display">{label}</span>
      {sub && <span className="text-[11px] text-slate-400 font-bold mt-2 uppercase tracking-[0.15em]">{sub}</span>}
    </div>
  );
}

function InputField({ label, placeholder }: { label: string, placeholder?: string }) {
  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mr-3">{label}</label>
      <input 
        type="text" 
        className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-[15px] focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-bold shadow-sm placeholder:text-slate-300"
        placeholder={placeholder}
      />
    </div>
  );
}
