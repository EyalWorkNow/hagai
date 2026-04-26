import { ChangeEvent, ReactNode, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  Building2,
  Calculator,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSignature,
  FileText,
  Landmark,
  LogOut,
  PenLine,
  QrCode,
  ShieldCheck,
  UploadCloud,
  UserCheck,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Contract, Property, User, UtilityPaymentMode } from "../types";
import { useAppData } from "../lib/appData";
import { BRAND_NAME, BRAND_SLOGAN } from "../lib/brand";
import hagaiLogo from "../image/HAGAI_LOGO.png";

interface OnboardingProps {
  user: User;
  onComplete: () => void;
  onLogout: () => void;
}

type StepId = "identity" | "documents" | "credit" | "property" | "signature" | "finish";

type StepMeta = {
  id: StepId;
  title: string;
  icon: ReactNode;
};

type OnboardingDraft = {
  tenantQrScanned: boolean;
  landlordQrScanned: boolean;
  contractDocumentUploaded: boolean;
  clausesApproved: boolean;
  rentAmount: number;
  buildingCommitteeAmount: number;
  arnonaAmount: number;
  utilityPaymentMode: UtilityPaymentMode;
};

const STEPS: StepMeta[] = [
  { id: "identity", title: "זיהוי ו-QR", icon: <UserCheck size={20} /> },
  { id: "documents", title: "חוזה ומסמכים", icon: <FileText size={20} /> },
  { id: "credit", title: "דירוג אשראי", icon: <ShieldCheck size={20} /> },
  { id: "property", title: "פרטי דירה", icon: <Building2 size={20} /> },
  { id: "signature", title: "חתימה", icon: <FileSignature size={20} /> },
  { id: "finish", title: "סיום", icon: <CheckCircle2 size={20} /> },
];

const BANK_OPTIONS = [
  { id: "hapoalim", name: "בנק הפועלים", code: "12", accent: "bg-red-500", mark: "פועלים" },
  { id: "leumi", name: "בנק לאומי", code: "10", accent: "bg-blue-600", mark: "לאומי" },
  { id: "discount", name: "דיסקונט", code: "11", accent: "bg-emerald-500", mark: "דיסקונט" },
  { id: "mizrahi", name: "מזרחי טפחות", code: "20", accent: "bg-orange-500", mark: "טפחות" },
  { id: "beinleumi", name: "הבינלאומי", code: "31", accent: "bg-violet-500", mark: "FIBI" },
  { id: "yahav", name: "בנק יהב", code: "04", accent: "bg-sky-500", mark: "יהב" },
] as const;

const moneyFormatter = new Intl.NumberFormat("he-IL");

function formatCurrency(value: number) {
  return `₪${moneyFormatter.format(Math.round(value))}`;
}

function calculateMonthlyPayment(draft: OnboardingDraft) {
  return (
    draft.rentAmount +
    (draft.utilityPaymentMode === "combined"
      ? draft.buildingCommitteeAmount + draft.arnonaAmount
      : 0)
  );
}

function getInitialStep(user: User) {
  if (user.onboardingComplete) return STEPS.length - 1;
  if (user.kycStatus !== "approved") return 0;
  return Math.min(Math.max(user.onboardingStep ?? 1, 0), STEPS.length - 1);
}

function findTenantContract(contracts: Contract[], userId: string) {
  return (
    contracts.find((contract) => contract.tenantId === userId && contract.status !== "expired") ??
    contracts.find((contract) => contract.tenantId === userId) ??
    null
  );
}

function findTenantProperty(properties: Property[], contract: Contract | null, userId: string) {
  return (
    (contract ? properties.find((property) => property.id === contract.propertyId) : null) ??
    properties.find((property) => property.tenantId === userId) ??
    null
  );
}

function buildInitialDraft(contract: Contract | null, property: Property | null): OnboardingDraft {
  return {
    tenantQrScanned: Boolean(contract?.tenantQrScannedAt),
    landlordQrScanned: Boolean(contract?.landlordQrScannedAt),
    contractDocumentUploaded: Boolean(contract?.contractUploadedAt || contract?.documentUrl),
    clausesApproved: Boolean(contract?.contractClausesApprovedAt),
    rentAmount: contract?.rentAmount ?? property?.rent ?? 0,
    buildingCommitteeAmount:
      contract?.buildingCommitteeAmount ?? property?.costs?.buildingCommittee ?? 0,
    arnonaAmount: contract?.arnonaAmount ?? property?.costs?.arnona ?? 0,
    utilityPaymentMode: contract?.utilityPaymentMode ?? "separate",
  };
}

export default function Onboarding({ user, onComplete, onLogout }: OnboardingProps) {
  const {
    db,
    submitKyc,
    approveKyc,
    requestEligibilityCheck,
    resolveEligibilityCheck,
    skipEligibilityCheck,
    saveOnboardingAgreement,
    saveBankAuthorization,
    signOnboardingContract,
    completeOnboarding,
    updateUser,
  } = useAppData();
  const activeContract = useMemo(
    () => findTenantContract(db.contracts, user.id),
    [db.contracts, user.id],
  );
  const activeProperty = useMemo(
    () => findTenantProperty(db.properties, activeContract, user.id),
    [activeContract, db.properties, user.id],
  );
  const eligibilityCheck = useMemo(
    () => db.eligibilityChecks.find((check) => check.tenantId === user.id) ?? null,
    [db.eligibilityChecks, user.id],
  );
  const [currentStep, setCurrentStep] = useState(() => getInitialStep(user));
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    buildInitialDraft(activeContract, activeProperty),
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const isCreditApproved = user.bdiStatus === "green";
  const hasRequiredQr = draft.tenantQrScanned && draft.landlordQrScanned;
  const hasRequiredDocuments = draft.contractDocumentUploaded && draft.clausesApproved;
  const monthlyPayment = calculateMonthlyPayment(draft);
  const canSign = Boolean(activeContract && isCreditApproved);

  const persistAgreement = () => {
    saveOnboardingAgreement(user.id, draft);
  };

  const getButtonText = () => {
    if (isProcessing) return "...";
    if (currentStep === 0) {
      if (user.kycStatus === "pending") return "שלח לאימות זהות";
      if (user.kycStatus === "submitted") return "אשר KYC והמשך";
      return "המשך לניהול מסמכים";
    }
    if (currentStep === 1) return "שמור מסמכים והמשך";
    if (currentStep === 2) {
      if (isCreditApproved) return "המשך לפרטי הדירה";
      if (eligibilityCheck?.status === "pending") return "אשר חיווי חיובי";
      return "התחל בדיקת דירוג אשראי";
    }
    if (currentStep === 3) return "שמור פרטי תשלום והמשך לחתימה";
    if (currentStep === 4) return "חתימה דיגיטלית מאובטחת";
    return "התחל להשתמש במערכת";
  };

  const isPrimaryDisabled =
    isProcessing ||
    (currentStep === 0 && user.kycStatus === "approved" && !hasRequiredQr) ||
    (currentStep === 1 && !hasRequiredDocuments) ||
    (currentStep === 2 && user.bdiStatus === "red") ||
    (currentStep === 3 && draft.rentAmount <= 0) ||
    (currentStep === 4 && !canSign);

  const handleNext = async () => {
    if (isPrimaryDisabled) return;
    setIsProcessing(true);

    try {
      if (currentStep === 0) {
        if (user.kycStatus === "pending") {
          submitKyc(user.id);
          return;
        }
        if (user.kycStatus === "submitted") {
          approveKyc(user.id);
          if (hasRequiredQr) {
            persistAgreement();
            setCurrentStep(1);
          }
          return;
        }
        persistAgreement();
        setCurrentStep(1);
        return;
      }

      if (currentStep === 1) {
        persistAgreement();
        updateUser(user.id, { onboardingStep: 2 });
        setCurrentStep(2);
        return;
      }

      if (currentStep === 2) {
        if (isCreditApproved) {
          setCurrentStep(3);
          return;
        }
        if (eligibilityCheck?.status === "pending") {
          resolveEligibilityCheck(user.id, true);
          setCurrentStep(3);
          return;
        }
        requestEligibilityCheck(user.id, activeContract?.landlordId);
        return;
      }

      if (currentStep === 3) {
        persistAgreement();
        saveBankAuthorization(user.id);
        setCurrentStep(4);
        return;
      }

      if (currentStep === 4) {
        persistAgreement();
        signOnboardingContract(user.id);
        setCurrentStep(5);
        return;
      }

      completeOnboarding(user.id);
      onComplete();
    } finally {
      setTimeout(() => setIsProcessing(false), 80);
    }
  };

  const handleSkipCredit = () => {
    if (isProcessing || isCreditApproved) return;
    persistAgreement();
    skipEligibilityCheck(user.id, activeContract?.landlordId);
    setCurrentStep(3);
  };

  const handleBack = () => {
    if (currentStep > 0 && currentStep < STEPS.length - 1) {
      setCurrentStep((step) => step - 1);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-3 text-right sm:p-4" dir="rtl">
      <div className="mb-5 flex w-full max-w-5xl flex-col gap-4 px-1 sm:mb-7 sm:flex-row sm:items-center sm:justify-between sm:px-2">
        <div className="flex items-center gap-4">
          <img src={hagaiLogo} alt={BRAND_NAME} className="h-12 w-auto object-contain drop-shadow-sm" />
          <div>
            <span className="text-2xl font-black text-slate-900 tracking-tighter font-display">
              {BRAND_NAME}
            </span>
            <p className="text-[11px] font-black text-slate-400">{BRAND_SLOGAN}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-2.5 text-[13px] font-bold text-slate-600 shadow-sm transition-colors hover:text-red-500"
        >
          <LogOut size={16} />
          <span>יציאה</span>
        </button>
      </div>

      <div className="w-full max-w-5xl overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-2xl sm:rounded-[32px]">
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-3 md:grid-cols-6 md:p-5">
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
            />
          ))}
        </div>

        <div className="min-h-[460px] p-4 sm:p-6 md:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="space-y-8"
            >
              <StepContent
                stepIndex={currentStep}
                user={user}
                contract={activeContract}
                property={activeProperty}
                eligibilityStatus={eligibilityCheck?.status}
                draft={draft}
                monthlyPayment={monthlyPayment}
                canSign={canSign}
                onDraftChange={setDraft}
                onSkipCredit={handleSkipCredit}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col-reverse items-center justify-between gap-4 border-t bg-slate-50/50 p-4 sm:p-6 md:flex-row md:p-8">
          <button
            onClick={handleBack}
            disabled={currentStep === 0 || isProcessing || currentStep === STEPS.length - 1}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 py-4 text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-900 disabled:opacity-30 md:w-auto md:border-none md:py-0"
          >
            <ChevronRight size={18} />
            <span>שלב קודם</span>
          </button>

          <button
            onClick={handleNext}
            disabled={isPrimaryDisabled}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-7 py-4 text-[13px] font-black text-white shadow-xl transition-all hover:bg-black active:scale-95 disabled:bg-slate-300 disabled:shadow-none md:w-auto md:px-10 md:text-[14px]"
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

function StepContent({
  stepIndex,
  user,
  contract,
  property,
  eligibilityStatus,
  draft,
  monthlyPayment,
  canSign,
  onDraftChange,
  onSkipCredit,
}: {
  stepIndex: number;
  user: User;
  contract: Contract | null;
  property: Property | null;
  eligibilityStatus?: "pending" | "approved" | "rejected";
  draft: OnboardingDraft;
  monthlyPayment: number;
  canSign: boolean;
  onDraftChange: (nextDraft: OnboardingDraft) => void;
  onSkipCredit: () => void;
}) {
  switch (stepIndex) {
    case 0:
      return (
        <IdentitySetupStep
          user={user}
          draft={draft}
          onDraftChange={onDraftChange}
        />
      );
    case 1:
      return <DocumentsStep draft={draft} onDraftChange={onDraftChange} />;
    case 2:
      return (
        <CreditStep
          user={user}
          eligibilityStatus={eligibilityStatus}
          onSkipCredit={onSkipCredit}
        />
      );
    case 3:
      return (
        <PropertyPaymentStep
          contract={contract}
          property={property}
          draft={draft}
          monthlyPayment={monthlyPayment}
          onDraftChange={onDraftChange}
        />
      );
    case 4:
      return (
        <SignatureStep
          contract={contract}
          property={property}
          draft={draft}
          monthlyPayment={monthlyPayment}
          canSign={canSign}
          user={user}
        />
      );
    case 5:
      return <FinishStep />;
    default:
      return null;
  }
}

function IdentitySetupStep({
  user,
  draft,
  onDraftChange,
}: {
  user: User;
  draft: OnboardingDraft;
  onDraftChange: (nextDraft: OnboardingDraft) => void;
}) {
  return (
    <div className="space-y-8">
      <StepHeader
        title="הגדרת תהליך וזיהוי"
        subtitle="סריקת QR לשוכר ולמשכיר, ואז אימות זהות בסיסי לפני המשך למסמכי החוזה."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <QrScanCard
          title="QR שוכר"
          description="קוד ייעודי לפתיחת התהליך מצד השוכר ואימות התאמה לנכס."
          scanned={draft.tenantQrScanned}
          onToggle={() => onDraftChange({ ...draft, tenantQrScanned: !draft.tenantQrScanned })}
        />
        <QrScanCard
          title="QR משכיר"
          description="קוד משכיר שמאשר שהנכס וההזמנה משויכים לגורם הנכון."
          scanned={draft.landlordQrScanned}
          onToggle={() => onDraftChange({ ...draft, landlordQrScanned: !draft.landlordQrScanned })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UploadCard
          label="צילום תעודת זהות"
          icon={<Camera size={24} />}
          sub="וודא שהפרטים ברורים וללא השתקפות"
          complete={user.kycStatus === "approved"}
        />
        <UploadCard
          label="צילום סלפי וידאו"
          icon={<Camera size={24} />}
          sub="זיהוי פנים למניעת זיוף זהות"
          complete={user.kycStatus === "approved"}
        />
      </div>

      <InfoPanel tone={user.kycStatus === "approved" ? "success" : "info"}>
        <ShieldCheck size={22} />
        <div>
          <h3>אבטחת מידע</h3>
          <p>
            {BRAND_NAME} שומרת את נתוני הזיהוי והחוזה במסד המקומי של התהליך ומתקדמת רק אחרי התאמת QR ואימות KYC.
          </p>
        </div>
      </InfoPanel>
    </div>
  );
}

function DocumentsStep({
  draft,
  onDraftChange,
}: {
  draft: OnboardingDraft;
  onDraftChange: (nextDraft: OnboardingDraft) => void;
}) {
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    onDraftChange({ ...draft, contractDocumentUploaded: Boolean(event.target.files?.length) });
  };

  return (
    <div className="space-y-8">
      <StepHeader
        title="ניהול מסמכים ואישור סעיפים"
        subtitle="העלאת חוזה השכירות ואישור הסעיפים על ידי הצדדים לפני בדיקות האשראי והחתימה."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <label
          htmlFor="lease-contract-upload"
          className={cn(
            "group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-6 text-center transition-all",
            draft.contractDocumentUploaded
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-900 hover:bg-white",
          )}
        >
          <input
            id="lease-contract-upload"
            type="file"
            className="sr-only"
            accept=".pdf,.doc,.docx,image/*"
            onChange={handleUpload}
          />
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
            {draft.contractDocumentUploaded ? <CheckCircle2 size={30} /> : <UploadCloud size={30} />}
          </div>
          <p className="text-lg font-black text-slate-900">העלאת חוזה שכירות</p>
          <p className="mt-2 max-w-xs text-sm font-bold leading-6 text-slate-500">
            קובץ PDF, Word או צילום חתום. לאחר העלאה המסמך נשמר כטיוטת חוזה פעילה.
          </p>
        </label>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <FileText size={22} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900">אישור סעיפי חוזה</p>
              <p className="text-xs font-bold text-slate-400">שוכר ומשכיר מאשרים הסכמה מלאה.</p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:bg-white">
            <input
              type="checkbox"
              checked={draft.clausesApproved}
              disabled={!draft.contractDocumentUploaded}
              onChange={(event) =>
                onDraftChange({ ...draft, clausesApproved: event.target.checked })
              }
              className="mt-1 h-5 w-5 rounded-lg border-2 border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-40"
            />
            <span className="text-sm font-bold leading-7 text-slate-600">
              הצדדים קראו את סעיפי חוזה השכירות, אין מחלוקות פתוחות, וניתן להתקדם לבדיקה מקדימה ולחתימה.
            </span>
          </label>

          {!draft.contractDocumentUploaded && (
            <p className="mt-4 text-xs font-black text-amber-600">
              יש להעלות חוזה לפני אישור הסעיפים.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreditStep({
  user,
  eligibilityStatus,
  onSkipCredit,
}: {
  user: User;
  eligibilityStatus?: "pending" | "approved" | "rejected";
  onSkipCredit: () => void;
}) {
  const approved = user.bdiStatus === "green";
  const rejected = user.bdiStatus === "red" || eligibilityStatus === "rejected";

  return (
    <div className="space-y-8">
      <StepHeader
        title="בדיקת דירוג אשראי"
        subtitle="בדיקת האשראי היא תנאי מקדים לשטר החוב. דילוג יוצר אישור ידני חיובי ומתועד."
      />

      <div
        className={cn(
          "rounded-[32px] border p-6 text-center shadow-sm md:p-10",
          approved
            ? "border-emerald-200 bg-emerald-50"
            : rejected
              ? "border-rose-200 bg-rose-50"
              : "border-slate-200 bg-white",
        )}
      >
        <div
          className={cn(
            "mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-3xl shadow-xl",
            approved ? "bg-emerald-500 text-white" : "bg-slate-900 text-white",
          )}
        >
          {approved ? <Check size={46} /> : <ShieldCheck size={46} />}
        </div>

        <h3 className="text-3xl font-black tracking-tight text-slate-900">
          {approved ? "חיווי חיובי התקבל" : "ממתין לחיווי דירוג אשראי"}
        </h3>
        <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-7 text-slate-500">
          המערכת לא תאפשר מעבר לחתימה על שטר חוב ללא סטטוס חיובי. ניתן להריץ בדיקה, לאשר חיווי חיובי, או לבצע דילוג מתועד שמסמן אישור ידני.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatusPill title="סטטוס משתמש" value={user.bdiStatus ?? "pending"} tone={approved ? "success" : rejected ? "danger" : "info"} />
          <StatusPill title="רשומת בדיקה" value={eligibilityStatus ?? "טרם נפתחה"} tone={approved ? "success" : "info"} />
          <StatusPill title="תנאי חתימה" value={approved ? "פתוח" : "חסום"} tone={approved ? "success" : "danger"} />
        </div>

        {!approved && (
          <button
            type="button"
            onClick={onSkipCredit}
            className="mt-8 inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:border-slate-900"
          >
            <AlertCircle size={18} />
            <span>דלג ואשר ידנית</span>
          </button>
        )}
      </div>
    </div>
  );
}

function PropertyPaymentStep({
  contract,
  property,
  draft,
  monthlyPayment,
  onDraftChange,
}: {
  contract: Contract | null;
  property: Property | null;
  draft: OnboardingDraft;
  monthlyPayment: number;
  onDraftChange: (nextDraft: OnboardingDraft) => void;
}) {
  return (
    <div className="space-y-8">
      <StepHeader
        title="פרטי הדירה ושטר החוב"
        subtitle="הנתונים שמופיעים בשטר החוב ובחישוב התשלום החודשי לפני חתימה."
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900">פרטי הדירה</p>
              <p className="text-xs font-bold text-slate-400">
                {property?.address ?? contract?.propertyAddress ?? "נכס משויך לתהליך"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumericField
              label="גובה שכר הדירה"
              value={draft.rentAmount}
              icon={<CreditCard size={18} />}
              onChange={(rentAmount) => onDraftChange({ ...draft, rentAmount })}
            />
            <NumericField
              label="עלויות ועד בית"
              value={draft.buildingCommitteeAmount}
              icon={<Landmark size={18} />}
              onChange={(buildingCommitteeAmount) =>
                onDraftChange({ ...draft, buildingCommitteeAmount })
              }
            />
            <NumericField
              label="עלויות ארנונה"
              value={draft.arnonaAmount}
              icon={<FileText size={18} />}
              onChange={(arnonaAmount) => onDraftChange({ ...draft, arnonaAmount })}
            />
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <PaymentModeCheck
              title="תשלום משולב"
              description="ועד הבית והארנונה מתווספים לתשלום החודשי הכולל."
              checked={draft.utilityPaymentMode === "combined"}
              onChange={() => onDraftChange({ ...draft, utilityPaymentMode: "combined" })}
            />
            <PaymentModeCheck
              title="תשלום נפרד"
              description="השוכר מתחייב לשלם ישירות לרשויות או לוועד."
              checked={draft.utilityPaymentMode === "separate"}
              onChange={() => onDraftChange({ ...draft, utilityPaymentMode: "separate" })}
            />
          </div>
        </div>

        <div className="rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-blue-300">
              <Calculator size={22} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-400">תשלום חודשי סופי</p>
              <p className="text-4xl font-black tracking-tight tabular-nums">
                {formatCurrency(monthlyPayment)}
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3 text-sm font-bold text-slate-300">
            <SummaryLine label="שכר דירה" value={formatCurrency(draft.rentAmount)} />
            <SummaryLine
              label="ועד בית"
              value={
                draft.utilityPaymentMode === "combined"
                  ? formatCurrency(draft.buildingCommitteeAmount)
                  : "תשלום נפרד"
              }
            />
            <SummaryLine
              label="ארנונה"
              value={
                draft.utilityPaymentMode === "combined"
                  ? formatCurrency(draft.arnonaAmount)
                  : "תשלום נפרד"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SignatureStep({
  contract,
  property,
  draft,
  monthlyPayment,
  canSign,
  user,
}: {
  contract: Contract | null;
  property: Property | null;
  draft: OnboardingDraft;
  monthlyPayment: number;
  canSign: boolean;
  user: User;
}) {
  return (
    <div className="space-y-8">
      <StepHeader
        title="חתימה דיגיטלית מאובטחת"
        subtitle="חתימה על חוזה השכירות ושטר החוב מתאפשרת רק אחרי אינדיקציה חיובית מדירוג האשראי."
      />

      {!canSign && (
        <InfoPanel tone="danger">
          <AlertCircle size={22} />
          <div>
            <h3>החתימה חסומה</h3>
            <p>
              סטטוס דירוג האשראי הנוכחי הוא {user.bdiStatus ?? "לא קיים"}. יש לקבל חיווי חיובי לפני חתימה על שטר חוב.
            </p>
          </div>
        </InfoPanel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <SignatureDocumentCard
          title="אישור חוזה שכירות"
          description={draft.clausesApproved ? "כל סעיפי החוזה מאושרים לחתימה." : "נדרש אישור סעיפים לפני חתימה."}
          icon={<FileText size={26} />}
          complete={draft.contractDocumentUploaded && draft.clausesApproved}
        />
        <SignatureDocumentCard
          title="שטר חוב"
          description={`${property?.address ?? contract?.propertyAddress ?? "נכס"} • תשלום חודשי ${formatCurrency(monthlyPayment)}`}
          icon={<ShieldCheck size={26} />}
          complete={canSign}
        />
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <PenLine size={22} />
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">משטח חתימה</p>
            <p className="text-xs font-bold text-slate-400">החתימה תינעל לאחר לחיצה על כפתור ההמשך.</p>
          </div>
        </div>
        <div className="flex h-44 w-full items-center justify-center rounded-[28px] border-2 border-dashed border-slate-200 bg-slate-50 text-sm font-black text-slate-300">
          חתימה דיגיטלית
        </div>
      </div>
    </div>
  );
}

function FinishStep() {
  return (
    <div className="space-y-8 py-8 text-center">
      <div className="relative inline-block">
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-green-500 text-white shadow-sleek-lg">
          <CheckCircle2 size={64} />
        </div>
        <div className="absolute -right-4 -top-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-green-100 bg-white text-green-500 shadow-xl">
          <ShieldCheck size={24} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-3xl font-black tracking-tighter text-slate-900 md:text-4xl">ברוך הבא לבית החדש!</h2>
        <p className="mx-auto max-w-md font-medium leading-relaxed text-slate-500">
          כל המסמכים החתומים נשלחו למייל שלך ולבעל הנכס. מעכשיו, הכל מנוהל ב-{BRAND_NAME}.
        </p>
      </div>

      <div className="inline-flex flex-col gap-2 rounded-3xl border border-slate-100 bg-slate-50 p-6 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">מה קורה עכשיו?</p>
        <p className="text-xs font-bold leading-relaxed text-slate-600">
          החיוב הקרוב יבוצע אוטומטית • תקבל התראה יומיים לפני • אפשר לדווח על כל תקלה בקליק
        </p>
      </div>
    </div>
  );
}

export function BDICheckStandalone() {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");

  const runCheck = () => {
    setStatus("processing");
    setTimeout(() => setStatus("success"), 2500);
  };

  return (
    <div className="mx-auto max-w-md animate-in zoom-in-95 rounded-[36px] border border-slate-200 bg-white p-6 text-right shadow-2xl duration-500 sm:p-8 md:p-12" dir="rtl">
      <div className="mb-12 text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 rotate-3 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-900/20">
          <ShieldCheck size={36} />
        </div>
        <h2 className="text-3xl font-black tracking-tighter text-slate-900 md:text-4xl">בדיקת זכאות מערכת נתוני אשראי</h2>
        <p className="mt-3 text-[15px] font-bold text-slate-500">הפק דוח אשראי חתום לזירוז חתימת החוזה</p>
      </div>

      {status === "idle" && (
        <div className="space-y-8">
          <InputField label="מספר תעודת זהות" placeholder="למשל: 312456789" />
          <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-6 shadow-inner">
            <input type="checkbox" className="mt-1 h-5 w-5 rounded-lg border-2 border-slate-300 text-slate-900 focus:ring-slate-900" />
            <span className="text-[11px] font-black leading-relaxed tracking-[0.1em] text-slate-400">
              אני מאשר ביצוע בדיקת נתוני אשראי. המידע ישמש להערכת זכאות בלבד • מסלול soft check ללא פגיעה בדירוג
            </span>
          </div>
          <button
            onClick={runCheck}
            className="w-full rounded-2xl bg-slate-900 py-5 text-[15px] font-black text-white shadow-xl transition-all hover:bg-black active:scale-95"
          >
            בצע בדיקה מיידית
          </button>
        </div>
      )}

      {status === "processing" && (
        <div className="py-20 text-center">
          <div className="relative mx-auto mb-10 h-20 w-20 animate-spin rounded-full border-4 border-slate-900 border-t-transparent shadow-xl">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100 opacity-20"></div>
          </div>
          <p className="animate-pulse text-2xl font-black tracking-tighter text-slate-900">מתחבר למאגרי המידע...</p>
          <p className="mt-4 text-[11px] font-bold leading-loose tracking-[0.2em] text-slate-400">
            מערכת נתוני אשראי • מסד נתוני אזרחים • בדיקת עיקולים
          </p>
        </div>
      )}

      {status === "success" && (
        <div className="animate-in fade-in slide-in-from-bottom-6 text-center duration-700">
          <div className="mx-auto mb-10 flex h-28 w-28 rotate-6 scale-110 items-center justify-center rounded-[32px] bg-emerald-500 text-white shadow-2xl">
            <CheckCircle2 size={56} />
          </div>
          <h3 className="text-4xl font-black tracking-tighter text-slate-900">זכאי! (Grade: A+)</h3>
          <p className="mt-2 text-[15px] font-bold text-slate-500">ציון מערכת נתוני אשראי שלך מצוין ומאפשר המשך תהליך מיידי.</p>

          <div className="group relative mt-12 overflow-hidden rounded-[32px] border border-white/5 bg-slate-950 p-8 text-right shadow-2xl">
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">ציון אשראי bdi</span>
              <span className="text-sm font-black uppercase text-emerald-400">מעולה</span>
            </div>
            <div className="flex items-end gap-4">
              <span className="text-6xl font-black tracking-tighter text-white tabular-nums">782</span>
              <span className="mb-3 text-sm font-bold tracking-widest text-slate-600">/ 850</span>
            </div>
            <div className="mt-8 h-3 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-[88%] rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]"></div>
            </div>
          </div>

          <button className="mt-12 flex w-full items-center justify-center gap-4 rounded-2xl border-2 border-slate-900 py-5 text-[13px] font-black tracking-[0.2em] text-slate-900 transition-all hover:bg-slate-50 active:scale-95">
            <span>שלח אסמכתא חתומה למשכיר</span>
            <ChevronLeft size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{title}</h2>
      <p className="mt-4 text-[14px] font-bold leading-7 text-slate-500 md:text-[15px]">{subtitle}</p>
    </div>
  );
}

function StepIndicator({
  step,
  index,
  currentStep,
  onNavigate,
}: {
  step: StepMeta;
  index: number;
  currentStep: number;
  onNavigate: (target: number) => void;
}) {
  const isActive = index <= currentStep;
  const isCompleted = index < currentStep;
  const canNavigate = index <= currentStep;

  return (
    <button
      type="button"
      onClick={() => canNavigate && onNavigate(index)}
      className={cn(
        "min-w-0 rounded-2xl border p-3 text-right transition-all",
        isActive
          ? "border-slate-900 bg-white text-slate-900 shadow-sm"
          : "border-slate-200 bg-slate-100/70 text-slate-400",
        canNavigate ? "cursor-pointer hover:border-slate-900" : "cursor-default",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
            isActive ? "bg-slate-900 text-white" : "bg-white text-slate-300",
          )}
        >
          {isCompleted ? <CheckCircle2 size={20} /> : step.icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black text-slate-400">שלב {index + 1}</p>
          <p className="truncate text-[12px] font-black">{step.title}</p>
        </div>
      </div>
    </button>
  );
}

function QrScanCard({
  title,
  description,
  scanned,
  onToggle,
}: {
  title: string;
  description: string;
  scanned: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex min-h-[190px] items-center gap-5 rounded-[28px] border p-5 text-right shadow-sm transition-all",
        scanned
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white hover:border-slate-900",
      )}
    >
      <div
        className={cn(
          "grid h-28 w-28 shrink-0 grid-cols-3 gap-1 rounded-3xl p-4",
          scanned ? "bg-emerald-500" : "bg-slate-950",
        )}
      >
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "rounded-sm",
              [0, 2, 4, 6, 8].includes(index) ? "bg-white" : "bg-white/25",
            )}
          />
        ))}
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <QrCode size={20} className={scanned ? "text-emerald-700" : "text-slate-500"} />
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
        </div>
        <p className="text-sm font-bold leading-6 text-slate-500">{description}</p>
        <span
          className={cn(
            "mt-4 inline-flex rounded-full px-3 py-1 text-[11px] font-black",
            scanned ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
          )}
        >
          {scanned ? "נסרק ואושר" : "לחץ לסימון סריקה"}
        </span>
      </div>
    </button>
  );
}

function UploadCard({
  label,
  icon,
  sub,
  complete,
}: {
  label: string;
  icon: ReactNode;
  sub?: string;
  complete?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex aspect-video flex-col items-center justify-center rounded-[28px] border-2 border-dashed p-6 text-center transition-all",
        complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50/50",
      )}
    >
      {complete && (
        <div className="absolute left-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
          <CheckCircle2 size={16} />
        </div>
      )}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-400">
        {icon}
      </div>
      <span className="text-[17px] font-black text-slate-900">{label}</span>
      {sub && <span className="mt-2 text-[11px] font-bold tracking-[0.1em] text-slate-400">{sub}</span>}
    </div>
  );
}

function NumericField({
  label,
  value,
  icon,
  onChange,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="mr-2 block text-[11px] font-black text-slate-400">{label}</label>
      <div className="relative">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">{icon}</div>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(Number(event.target.value || 0))}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pr-11 pl-4 text-sm font-black tabular-nums outline-none transition focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5"
        />
      </div>
    </div>
  );
}

function PaymentModeCheck({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition-all",
        checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-5 w-5 rounded-lg border-2 border-slate-300 text-slate-900 focus:ring-slate-900"
      />
      <span>
        <span className={cn("block text-sm font-black", checked ? "text-white" : "text-slate-900")}>{title}</span>
        <span className={cn("mt-1 block text-xs font-bold leading-6", checked ? "text-slate-300" : "text-slate-500")}>{description}</span>
      </span>
    </label>
  );
}

function SignatureDocumentCard({
  title,
  description,
  icon,
  complete,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  complete: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] border p-6 shadow-sm",
        complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50",
      )}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", complete ? "bg-emerald-500 text-white" : "bg-white text-slate-500")}>
          {icon}
        </div>
        <CheckCircle2 size={22} className={complete ? "text-emerald-500" : "text-slate-300"} />
      </div>
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function StatusPill({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "success" | "info" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "info" && "border-blue-100 bg-blue-50 text-blue-700",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      <p className="text-[10px] font-black text-current/60">{title}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function InfoPanel({
  tone,
  children,
}: {
  tone: "info" | "success" | "danger";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-[28px] border p-5 text-right",
        tone === "info" && "border-blue-100 bg-blue-50 text-blue-800",
        tone === "success" && "border-emerald-100 bg-emerald-50 text-emerald-800",
        tone === "danger" && "border-rose-100 bg-rose-50 text-rose-800",
      )}
    >
      {children}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span>{label}</span>
      <span className="font-black tabular-nums text-white">{value}</span>
    </div>
  );
}

function InputField({
  label,
  placeholder,
  value,
  readOnly = false,
}: {
  label: string;
  placeholder?: string;
  value?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-3">
      <label className="mr-3 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</label>
      <input
        type="text"
        className={cn(
          "w-full rounded-2xl border p-5 text-[15px] font-bold shadow-sm transition-all",
          readOnly
            ? "border-slate-200 bg-slate-100 text-slate-900"
            : "border-slate-200 bg-white placeholder:text-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/5",
        )}
        placeholder={placeholder}
        value={value}
        readOnly={readOnly}
        onChange={() => undefined}
      />
    </div>
  );
}
