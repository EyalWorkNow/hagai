import { HTMLAttributes, InputHTMLAttributes, PointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  ArrowLeftRight,
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
  ShieldCheck,
  UserCheck,
  MapPin,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Contract, Property, User, UtilityPaymentMode } from "../types";
import { useAppData } from "../lib/appData";
import { BRAND_NAME, BRAND_SLOGAN } from "../lib/brand";
import bankFibiLogo from "../image/banks/בנק בינלאומי לוגו.jpeg";
import bankHapoalimLogo from "../image/banks/בנק הפועלים לוגו.jpg";
import bankOneZeroLogo from "../image/banks/בנק וואן זירו לוגו.png";
import bankYahavLogo from "../image/banks/בנק יהב לוגו.png";
import bankJerusalemLogo from "../image/banks/בנק ירושליים לוגו.jpg";
import bankLeumiLogo from "../image/banks/בנק לאומי לוגו.png";
import bankMizrahiLogo from "../image/banks/בנק מזרחי לוגו.jpeg";
import bankMassadLogo from "../image/banks/בנק מסד לוגו.jpg";
import bankMercantileLogo from "../image/banks/בנק מרכנתיל לוגו.webp";
import hagaiLogo from "../image/HAGAI_LOGO.png";

interface OnboardingProps {
  user: User;
  onComplete: () => void;
  onLogout: () => void;
}

type StepId = "identity" | "property" | "credit" | "bank_auth" | "signature" | "finish";

type StepMeta = {
  id: StepId;
  title: string;
  icon: ReactNode;
};

type OnboardingDraft = {
  identityNumber: string;
  phoneNumber: string;
  idPhotoUploaded: boolean;
  selfieUploaded: boolean;
  contractDocumentUploaded: boolean;
  clausesApproved: boolean;
  rentAmount: number;
  buildingCommitteeAmount: number;
  arnonaAmount: number;
  utilityPaymentMode: UtilityPaymentMode;
  creditConsent: boolean;
  landlordCreditSkipApproved: boolean;
  bankId: string;
  branchNumber: string;
  accountNumber: string;
  accountHolderName: string;
  bankConsent: boolean;
  signatureAccepted: boolean;
};

type DraftUpdate = OnboardingDraft | ((currentDraft: OnboardingDraft) => OnboardingDraft);
type DraftChangeHandler = (nextDraft: DraftUpdate) => void;

const STEPS: StepMeta[] = [
  { id: "identity", title: "פתיחת תהליך", icon: <UserCheck size={20} /> },
  { id: "property", title: "פרטי דירה", icon: <Building2 size={20} /> },
  { id: "credit", title: "בדיקת זכאות", icon: <ShieldCheck size={20} /> },
  { id: "bank_auth", title: "הרשאה לחיוב", icon: <Landmark size={20} /> },
  { id: "signature", title: "חתימה", icon: <FileSignature size={20} /> },
  { id: "finish", title: "סיום", icon: <CheckCircle2 size={20} /> },
];

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

function buildInitialDraft(contract: Contract | null, property: Property | null, user?: User): OnboardingDraft {
  return {
    identityNumber: "",
    phoneNumber: user?.phone ?? "",
    idPhotoUploaded: false,
    selfieUploaded: false,
    contractDocumentUploaded: Boolean(contract?.contractUploadedAt || contract?.documentUrl),
    clausesApproved: Boolean(contract?.contractClausesApprovedAt),
    rentAmount: contract?.rentAmount ?? property?.rent ?? 0,
    buildingCommitteeAmount:
      contract?.buildingCommitteeAmount ?? property?.costs?.buildingCommittee ?? 0,
    arnonaAmount: contract?.arnonaAmount ?? property?.costs?.arnona ?? 0,
    utilityPaymentMode: contract?.utilityPaymentMode ?? "separate",
    creditConsent: false,
    landlordCreditSkipApproved: false,
    bankId: "",
    branchNumber: "",
    accountNumber: "",
    accountHolderName: "",
    bankConsent: false,
    signatureAccepted: false,
  };
}

export default function Onboarding({ user, onComplete, onLogout }: OnboardingProps) {
  const {
    db,
    submitKyc,
    approveKyc,
    requestEligibilityCheck,
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
    [db, user.id],
  );
  const activeInvite = useMemo(
    () =>
      db.onboardingInvites.find(
        (invite) =>
          invite.propertyId === activeContract?.propertyId &&
          invite.tenantEmail.toLowerCase() === user.email.toLowerCase(),
      ) ?? null,
    [activeContract?.propertyId, db, user.email],
  );
  const [currentStep, setCurrentStep] = useState(() => getInitialStep(user));
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    buildInitialDraft(activeContract, activeProperty, user),
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const moveToStep = (step: number) => {
    const nextStep = Math.min(Math.max(step, 0), STEPS.length - 1);
    updateUser(user.id, { onboardingStep: nextStep });
    setCurrentStep(nextStep);
  };

  useEffect(() => {
    const syncedStep = getInitialStep(user);
    if (syncedStep > currentStep) {
      setCurrentStep(syncedStep);
    }
  }, [currentStep, user]);

  const identityDigits = draft.identityNumber.replace(/\D/g, "");
  const phoneDigits = draft.phoneNumber.replace(/\D/g, "");
  const hasValidOptionalIdentity = identityDigits.length === 0 || identityDigits.length === 9;
  const hasValidOptionalPhone = phoneDigits.length === 0 || phoneDigits.length >= 9;
  const hasRequiredIdentity = draft.idPhotoUploaded && draft.selfieUploaded && hasValidOptionalIdentity && hasValidOptionalPhone;
  const isCreditApproved = user.bdiStatus === "green";
  const landlordCreditSkipApproved = draft.landlordCreditSkipApproved || Boolean(activeInvite?.landlordCreditSkipApproved);
  const hasRequiredDocuments = draft.clausesApproved;
  const hasRequiredBankDetails =
    Boolean(draft.bankId) &&
    /^\d{2,4}$/.test(draft.branchNumber) &&
    /^\d{5,12}$/.test(draft.accountNumber) &&
    draft.accountHolderName.trim().length >= 2 &&
    draft.bankConsent;
  const hasRequiredSignature = draft.signatureAccepted;
  const monthlyPayment = calculateMonthlyPayment(draft);
  const canSign = Boolean(activeContract && isCreditApproved);

  const persistAgreement = () => {
    saveOnboardingAgreement(user.id, {
      ...draft,
      tenantQrScanned: true,
      landlordQrScanned: true,
      contractDocumentUploaded: true,
    });
  };

  const getButtonText = () => {
    if (isProcessing) return "...";
    if (currentStep === 0) {
      return "המשך לפרטי הדירה";
    }
    if (currentStep === 1) return "שמור פרטי דירה והמשך";
    if (currentStep === 2) {
       if (isCreditApproved) return "המשך להקמת הרשאה";
       if (eligibilityCheck?.status === "pending") return "ממתין לאישור משכיר";
       return "שלח בקשה לבדיקת זכאות";
    }
    if (currentStep === 3) return "אישור הרשאה לחיוב";
    if (currentStep === 4) return "חתימה וסיום חוזה";
    return "התחל להשתמש במערכת";
  };

  const isPrimaryDisabled =
    isProcessing ||
    (currentStep === 0 && user.kycStatus !== "approved" && !hasRequiredIdentity) ||
    (currentStep === 1 && (!hasRequiredDocuments || draft.rentAmount <= 0)) ||
    (currentStep === 2 && (!draft.creditConsent || eligibilityCheck?.status === "pending") && !isCreditApproved) ||
    (currentStep === 3 && !hasRequiredBankDetails) ||
    (currentStep === 4 && (!canSign || !hasRequiredSignature));

  const handleNext = async () => {
    if (isPrimaryDisabled) return;
    setIsProcessing(true);

    try {
      if (currentStep === 0) {
        if (user.kycStatus === "pending") {
          submitKyc(user.id);
          approveKyc(user.id);
          persistAgreement();
          moveToStep(1);
          return;
        }
        if (user.kycStatus === "submitted") {
          approveKyc(user.id);
          persistAgreement();
          moveToStep(1);
          return;
        }
        persistAgreement();
        moveToStep(1);
        return;
      }

      if (currentStep === 1) {
        persistAgreement();
        moveToStep(2);
        return;
      }

      if (currentStep === 2) {
        if (isCreditApproved) {
          moveToStep(3);
          return;
        }
        requestEligibilityCheck(user.id, activeContract?.landlordId);
        return;
      }

      if (currentStep === 3) {
        persistAgreement();
        saveBankAuthorization(user.id);
        moveToStep(4);
        return;
      }

      if (currentStep === 4) {
        persistAgreement();
        signOnboardingContract(user.id);
        moveToStep(STEPS.length - 1);
        return;
      }

      completeOnboarding(user.id);
      onComplete();
    } finally {
      setTimeout(() => setIsProcessing(false), 80);
    }
  };

  const handleSkipCredit = () => {
    if (isCreditApproved || !landlordCreditSkipApproved) return;
    persistAgreement();
    skipEligibilityCheck(user.id, activeContract?.landlordId);
    moveToStep(3);
  };

  const handleBack = () => {
    if (currentStep > 0 && currentStep < STEPS.length - 1) {
      setCurrentStep((step) => step - 1);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-start overflow-x-hidden bg-slate-100 px-3 py-4 text-right sm:p-4 md:justify-center" dir="rtl">
      <div className="mb-4 flex w-full max-w-5xl flex-col gap-4 px-1 sm:mb-6 sm:px-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 justify-center md:justify-start">
          <img src={hagaiLogo} alt={BRAND_NAME} className="h-14 w-auto object-contain md:h-16" />
          <div className="text-right">
            <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter font-display italic leading-none">
              {BRAND_NAME}
            </span>
            <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">{BRAND_SLOGAN}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-3 text-[13px] font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95 md:px-6"
        >
          <LogOut size={16} />
          <span>יציאה מהחשבון</span>
        </button>
      </div>

      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl md:rounded-[40px]">
        {/* Step indicators: scrollable on mobile, grid on larger screens */}
        <div className="border-b border-slate-100 bg-slate-50/60">
          <div className="flex overflow-x-auto no-scrollbar gap-2 p-2 md:grid md:grid-cols-6 md:p-4">
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
          {/* Mobile progress bar */}
          <div className="md:hidden h-1 bg-slate-100">
            <div
              className="h-full bg-slate-900 transition-all duration-500 rounded-full"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="min-h-[420px] p-4 sm:p-6 md:min-h-[460px] md:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="space-y-6 md:space-y-8"
            >
              <StepContent
                stepIndex={currentStep}
                user={user}
                contract={activeContract}
                property={activeProperty}
                eligibilityStatus={eligibilityCheck?.status}
                draft={draft}
                landlordCreditSkipApproved={landlordCreditSkipApproved}
                monthlyPayment={monthlyPayment}
                canSign={canSign}
                onDraftChange={setDraft}
                onSkipCredit={handleSkipCredit}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col-reverse items-center justify-between gap-3 border-t bg-slate-50/50 p-4 sm:p-6 md:flex-row md:gap-4 md:p-8">
          <button
            onClick={handleBack}
            disabled={currentStep === 0 || isProcessing || currentStep === STEPS.length - 1}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 py-3 text-xs font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-900 disabled:opacity-30 md:w-auto md:border-none md:py-0"
          >
            <ChevronRight size={18} />
            <span>שלב קודם</span>
          </button>

          <button
            onClick={handleNext}
            disabled={isPrimaryDisabled}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-7 py-3.5 text-[13px] font-black text-white shadow-xl transition-all hover:bg-black active:scale-95 disabled:bg-slate-300 disabled:shadow-none md:w-auto md:px-10 md:py-4 md:text-[14px]"
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
  landlordCreditSkipApproved,
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
  landlordCreditSkipApproved: boolean;
  monthlyPayment: number;
  canSign: boolean;
  onDraftChange: DraftChangeHandler;
  onSkipCredit: () => void;
}) {
  switch (stepIndex) {
    case 0:
      return (
        <IdentitySetupStep
          user={user}
          contract={contract}
          draft={draft}
          onDraftChange={onDraftChange}
        />
      );
    case 1:
      return (
        <PropertyStep
          contract={contract}
          property={property}
          draft={draft}
          monthlyPayment={monthlyPayment}
          onDraftChange={onDraftChange}
        />
      );
    case 2:
      return (
        <CreditCheckStep
          user={user}
          eligibilityStatus={eligibilityStatus}
          draft={draft}
          landlordCreditSkipApproved={landlordCreditSkipApproved}
          onDraftChange={onDraftChange}
          onSkipCredit={onSkipCredit}
        />
      );
    case 3:
      return (
        <BankAuthorizationStep 
          draft={draft} 
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
          onDraftChange={onDraftChange}
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
  contract,
  draft,
  onDraftChange,
}: {
  user: User;
  contract: Contract | null;
  draft: OnboardingDraft;
  onDraftChange: DraftChangeHandler;
}) {
  const contractAddress = contract?.propertyAddress ?? "הנכס המשויך לתהליך";

  const kycApproved = user.kycStatus === "approved";
  const identityDigits = draft.identityNumber.replace(/\D/g, "");
  const phoneDigits = draft.phoneNumber.replace(/\D/g, "");
  const missingIdentityItems = [
    identityDigits.length > 0 && identityDigits.length !== 9 ? "מספר תעודת זהות בן 9 ספרות" : null,
    phoneDigits.length > 0 && phoneDigits.length < 9 ? "מספר טלפון תקין" : null,
    !draft.idPhotoUploaded ? "צילום תעודת זהות" : null,
    !draft.selfieUploaded ? "צילום סלפי או וידאו" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 md:space-y-8">
      <StepHeader
        title="אימות זהות ופרטי שוכר"
        subtitle="נא לוודא את הפרטים האישיים ולהשלים את תהליך אימות הזהות (KYC) כדי שנוכל להתקדם לחוזה."
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:gap-8">
        {/* Profile Card */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl relative overflow-hidden group md:rounded-[40px] md:p-10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>

          <div className="flex flex-col items-center gap-5 relative z-10 md:flex-row md:gap-8">
            <div className="h-20 w-20 rounded-[28px] bg-slate-900 text-white flex items-center justify-center text-2xl font-black shadow-xl shadow-slate-900/20 group-hover:scale-105 transition-transform md:h-24 md:w-24 md:rounded-[32px] md:text-3xl">
              {user.name.charAt(0)}
            </div>
            <div className="text-center md:text-right flex-1">
               <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight italic">{user.name}</h3>
               <p className="text-slate-500 font-bold mt-1">{user.email}</p>
               <div className="mt-5 flex flex-wrap justify-center gap-2 md:mt-6 md:justify-start md:gap-3">
                  <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-black text-slate-400 tracking-widest uppercase">
                    סטטוס: שוכר מועמד
                  </div>
                  <div className="px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-[11px] font-black text-blue-600 tracking-widest uppercase">
                    ID: {user.id.slice(-8)}
                  </div>
               </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 md:mt-12 md:pt-10">
             <div className="grid gap-4 md:grid-cols-2 md:gap-8">
                <div className="space-y-2">
                   <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">מספר תעודת זהות</label>
                   <input
                    type="text"
                    inputMode="numeric"
                    value={draft.identityNumber}
                    onChange={(event) =>
                      onDraftChange((currentDraft) => ({
                        ...currentDraft,
                        identityNumber: event.target.value.replace(/\D/g, "").slice(0, 9),
                      }))
                    }
                    placeholder="הזן 9 ספרות"
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-slate-900 transition-all outline-none md:p-5"
                   />
                   {draft.identityNumber && draft.identityNumber.length !== 9 && (
                    <p className="text-[11px] font-black text-amber-600">מספר תעודת זהות חייב להכיל 9 ספרות.</p>
                   )}
                </div>
                <div className="space-y-2">
                   <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">מספר טלפון נייד</label>
                   <input
                    type="tel"
                    inputMode="tel"
                    value={draft.phoneNumber}
                    onChange={(event) =>
                      onDraftChange((currentDraft) => ({
                        ...currentDraft,
                        phoneNumber: event.target.value.replace(/[^\d-]/g, "").slice(0, 12),
                      }))
                    }
                    placeholder="050-0000000"
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-slate-900 transition-all outline-none md:p-5"
                   />
                </div>
             </div>
          </div>
        </div>

        {/* Property Context Card */}
        <div className="rounded-[28px] border border-blue-100 bg-blue-50/50 p-5 flex flex-col items-center justify-center text-center relative overflow-hidden md:rounded-[40px] md:p-8">
           <div className="h-16 w-16 bg-white rounded-2xl border border-blue-100 flex items-center justify-center text-blue-600 mb-6 shadow-sm">
              <MapPin size={32} />
           </div>
           <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">הנכס שאליו אתה מצטרף</p>
           <h4 className="text-xl font-black text-slate-900 leading-tight italic">{contractAddress}</h4>
           <div className="mt-6 w-full h-px bg-blue-100 md:mt-8"></div>
           <div className="mt-6 flex items-center gap-3 bg-white px-5 py-3 rounded-full border border-blue-100 md:mt-8 md:px-6">
              <div className={cn("h-2 w-2 rounded-full animate-pulse", kycApproved ? "bg-emerald-500" : "bg-amber-400")}></div>
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                {kycApproved ? "KYC אושר" : "ממתין לאימות זהות"}
              </span>
           </div>
        </div>
      </div>

      {/* KYC Upload Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UploadCard
          label="צילום תעודת זהות"
          icon={<Camera size={24} />}
          sub="וודא שהפרטים ברורים וללא השתקפות"
          complete={kycApproved || draft.idPhotoUploaded}
          onUpload={() => onDraftChange((currentDraft) => ({ ...currentDraft, idPhotoUploaded: true }))}
        />
        <UploadCard
          label="צילום סלפי וידאו"
          icon={<Camera size={24} />}
          sub="זיהוי פנים למניעת זיוף זהות"
          complete={kycApproved || draft.selfieUploaded}
          accept="video/*"
          capture="user"
          onUpload={() => onDraftChange((currentDraft) => ({ ...currentDraft, selfieUploaded: true }))}
        />
      </div>

      {!kycApproved && (
        <div className="rounded-[24px] border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-7 text-blue-800">
          {missingIdentityItems.length > 0 ? (
            <>
              <p className="font-black">כדי להמשיך חסר:</p>
              <ul className="mt-2 list-disc space-y-1 pr-5">
                {missingIdentityItems.map((item) => (
                  <li key={String(item)}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            "צילומי הזהות נקלטו. אפשר ללחוץ על הכפתור התחתון כדי לאשר זהות ולהמשיך לפרטי הדירה."
          )}
        </div>
      )}

      <InfoPanel tone={kycApproved ? "success" : "info"}>
        <ShieldCheck size={22} />
        <div>
          <h3>אבטחת מידע</h3>
          <p>
            {BRAND_NAME} שומרת את נתוני הזיהוי והחוזה במסד המקומי של התהליך ומתקדמת רק אחרי אימות KYC.
          </p>
        </div>
      </InfoPanel>
    </div>
  );
}

function PropertyStep({
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
  onDraftChange: DraftChangeHandler;
}) {
  return (
    <div className="space-y-6 md:space-y-8">
      <StepHeader
        title="פרטי דירה"
        subtitle="עדכון נתוני הדירה, העלאת חוזה ואישור הסעיפים לפני מעבר להקמת הוראת הקבע."
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:rounded-[32px] md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900">נתוני הדירה</p>
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
              onChange={(rentAmount) =>
                onDraftChange((currentDraft) => ({ ...currentDraft, rentAmount }))
              }
            />
            <NumericField
              label="עלויות ועד בית"
              value={draft.buildingCommitteeAmount}
              icon={<Landmark size={18} />}
              onChange={(buildingCommitteeAmount) =>
                onDraftChange((currentDraft) => ({ ...currentDraft, buildingCommitteeAmount }))
              }
            />
            <NumericField
              label="עלויות ארנונה"
              value={draft.arnonaAmount}
              icon={<FileText size={18} />}
              onChange={(arnonaAmount) =>
                onDraftChange((currentDraft) => ({ ...currentDraft, arnonaAmount }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PaymentModeCheck
              title="תשלום משולב"
              description="ועד הבית והארנונה מתווספים לתשלום החודשי הכולל."
              checked={draft.utilityPaymentMode === "combined"}
              onChange={() =>
                onDraftChange((currentDraft) => ({
                  ...currentDraft,
                  utilityPaymentMode: "combined",
                }))
              }
            />
            <PaymentModeCheck
              title="תשלום נפרד"
              description="השוכר מתחייב לשלם ישירות לרשויות או לוועד."
              checked={draft.utilityPaymentMode === "separate"}
              onChange={() =>
                onDraftChange((currentDraft) => ({
                  ...currentDraft,
                  utilityPaymentMode: "separate",
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-5">
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
                onChange={(event) =>
                  onDraftChange((currentDraft) => ({
                    ...currentDraft,
                    clausesApproved: event.target.checked,
                  }))
                }
                className="mt-1 h-5 w-5 rounded-lg border-2 border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-40"
              />
              <span className="text-sm font-bold leading-7 text-slate-600">
                הצדדים קראו את סעיפי חוזה השכירות, אין מחלוקות פתוחות, וניתן להתקדם להקמת הרשאה ולחתימה.
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-2xl md:rounded-[32px] md:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-blue-300">
            <Calculator size={22} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-400">תשלום חודשי סופי</p>
            <p className="text-3xl font-black tracking-tight tabular-nums md:text-4xl">
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
  );
}

function BankAuthorizationStep({
  draft,
  onDraftChange
}: {
  draft: OnboardingDraft;
  onDraftChange: DraftChangeHandler;
}) {
  const ISRAELI_BANKS = [
    { id: "leumi", name: "בנק לאומי", code: "10", logo: bankLeumiLogo },
    { id: "hapoalim", name: "בנק הפועלים", code: "12", logo: bankHapoalimLogo },
    { id: "mizrahi", name: "מזרחי טפחות", code: "20", logo: bankMizrahiLogo },
    { id: "discount", name: "בנק דיסקונט", code: "11", logo: null },
    { id: "fibi", name: "הבנק הבינלאומי", code: "31", logo: bankFibiLogo },
    { id: "yahav", name: "בנק יהב", code: "4", logo: bankYahavLogo },
    { id: "onezero", name: "וואן זירו", code: "18", logo: bankOneZeroLogo },
    { id: "mercantile", name: "מרכנתיל דיסקונט", code: "17", logo: bankMercantileLogo },
    { id: "massad", name: "בנק מסד", code: "46", logo: bankMassadLogo },
    { id: "jerusalem", name: "בנק ירושלים", code: "54", logo: bankJerusalemLogo },
  ];

  const selectedBank = draft.bankId;

  return (
    <div className="space-y-6 md:space-y-8">
      <StepHeader
        title="הקמת הרשאה לחיוב חשבון"
        subtitle="הוספת פרטי הבנק שלך לצורך הקמת הרשאה לחיוב שוטף ומאובטח."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:rounded-[32px] md:p-8">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <Landmark size={26} />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900">פרטי חשבון בנק</p>
              <p className="text-sm font-bold text-slate-400">יש לבחור את הבנק ולהזין פרטי סניף וחשבון.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="mb-3 block text-sm font-black text-slate-700">בחר בנק</label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ISRAELI_BANKS.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() =>
                      onDraftChange((currentDraft) => ({
                        ...currentDraft,
                        bankId: bank.id,
                      }))
                    }
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 rounded-2xl border p-4 transition-all",
                      selectedBank === bank.id
                        ? "border-slate-900 bg-slate-900 text-white shadow-xl scale-[1.02]"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white"
                    )}
                  >
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border shadow-sm",
                      selectedBank === bank.id ? "border-white/20 bg-white" : "border-slate-100 bg-white"
                    )}>
                      {bank.logo ? (
                        <img
                          src={bank.logo}
                          alt=""
                          className="h-full w-full object-contain p-1.5"
                        />
                      ) : (
                        <Building2 size={20} className={selectedBank === bank.id ? "text-slate-900" : "text-slate-400"} />
                      )}
                    </div>
                    <span className="text-xs font-black text-center">{bank.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="מספר סניף"
                value={draft.branchNumber}
                inputMode="numeric"
                placeholder="123"
                onChange={(branchNumber) =>
                  onDraftChange((currentDraft) => ({
                    ...currentDraft,
                    branchNumber: branchNumber.replace(/\D/g, "").slice(0, 4),
                  }))
                }
              />
              <TextField
                label="מספר חשבון"
                value={draft.accountNumber}
                inputMode="numeric"
                placeholder="12345678"
                onChange={(accountNumber) =>
                  onDraftChange((currentDraft) => ({
                    ...currentDraft,
                    accountNumber: accountNumber.replace(/\D/g, "").slice(0, 12),
                  }))
                }
              />
            </div>

            <TextField
              label="שם בעל החשבון"
              value={draft.accountHolderName}
              placeholder="שם כפי שמופיע בבנק"
              onChange={(accountHolderName) =>
                onDraftChange((currentDraft) => ({ ...currentDraft, accountHolderName }))
              }
            />

            <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:bg-white">
              <input
                type="checkbox"
                checked={draft.bankConsent}
                onChange={(event) =>
                  onDraftChange((currentDraft) => ({
                    ...currentDraft,
                    bankConsent: event.target.checked,
                  }))
                }
                className="mt-1 h-5 w-5 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span className="text-sm font-bold leading-7 text-slate-600">
                אני מאשר/ת הקמת הרשאה לחיוב חשבון עבור תשלומי השכירות והחיובים הנלווים לפי ההסכם.
              </span>
            </label>

            {(!selectedBank || !draft.branchNumber || !draft.accountNumber || !draft.accountHolderName || !draft.bankConsent) && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-black leading-6 text-amber-700">
                יש לבחור בנק, להזין סניף, חשבון, שם בעל חשבון ולאשר את ההרשאה כדי להמשיך.
              </div>
            )}
          </div>

          <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-start gap-4">
               <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <ShieldCheck size={18} />
               </div>
               <div>
                  <p className="text-sm font-black text-slate-900">אבטחת המידע שלך</p>
                  <p className="mt-2 text-xs font-bold leading-6 text-slate-500">
                     פרטי החשבון מוצפנים ונשמרים לצורך הקמת ההרשאה בלבד. לא נעשה שימוש בפרטים אלו ללא אישור חתימה דיגיטלית בשלב הבא.
                  </p>
               </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-2xl flex flex-col justify-between md:rounded-[32px] md:p-8">
          <div>
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-blue-400">
               <Landmark size={32} />
            </div>
            <p className="text-[11px] font-black tracking-[0.14em] text-slate-500 uppercase">
               פעולה מאובטחת
            </p>
            <h3 className="mt-4 text-2xl font-black tracking-tight leading-tight md:text-3xl">
               הקמת הרשאה לחיוב חשבון
            </h3>
            <p className="mt-6 text-sm font-bold leading-8 text-slate-300">
               לאחר הזנת פרטי הבנק ואישור ההרשאה, המערכת תבצע אימות מול הבנק ותאפשר מעבר מיידי לשלב החתימה על החוזה.
            </p>
          </div>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5 relative overflow-hidden md:mt-12 md:rounded-[28px] md:p-6">
            <div className="relative z-10">
               <p className="text-xs font-black tracking-[0.12em] text-slate-400">חיווי מערכת</p>
               <p className="mt-3 text-2xl font-black italic font-display">המשך לאישור</p>
               <p className="mt-4 text-sm font-bold leading-7 text-slate-300">
                  ההרשאה תוקם באופן אוטומטי ותוצמד להסכם השכירות.
               </p>
            </div>
            <div className="absolute -bottom-8 -left-8 h-32 w-32 bg-blue-500/10 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CreditCheckStep({
  user,
  eligibilityStatus,
  draft,
  landlordCreditSkipApproved,
  onDraftChange,
  onSkipCredit,
}: {
  user: User;
  eligibilityStatus?: "pending" | "approved" | "rejected";
  draft: OnboardingDraft;
  landlordCreditSkipApproved: boolean;
  onDraftChange: DraftChangeHandler;
  onSkipCredit: () => void;
}) {
  const approved = user.bdiStatus === "green";
  const rejected = user.bdiStatus === "red" || eligibilityStatus === "rejected";
  const isPending = eligibilityStatus === "pending";

  return (
    <div className="space-y-6 md:space-y-8">
      <StepHeader
        title="בדיקת זכאות ודירוג אשראי"
        subtitle="לפני הקמת ההרשאה לחיוב, המערכת מבצעת בדיקת זכאות פיננסית כדי להבטיח את אמינות התשלומים."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:rounded-[32px] md:p-8">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <ShieldCheck size={26} />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900">חיווי אשראי</p>
              <p className="text-sm font-bold text-slate-400">אישור לביצוע בדיקת נתוני אשראי מול הגורמים המוסמכים.</p>
            </div>
          </div>

          {!approved && !rejected && !isPending && (
             <div className="space-y-6">
                <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all hover:bg-white hover:border-blue-200 md:p-6">
                  <input
                    type="checkbox"
                    checked={draft.creditConsent}
                    onChange={(event) =>
                      onDraftChange((currentDraft) => ({
                        ...currentDraft,
                        creditConsent: event.target.checked,
                      }))
                    }
                    className="mt-1 h-6 w-6 rounded-lg border-2 border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <div className="text-sm font-bold leading-7 text-slate-600">
                    אני מאשר/ת ל-{BRAND_NAME} לבצע בדיקת חיווי אשראי מול מאגרי המידע המוסמכים לצורך בחינת זכאות להצטרפות למסלול התשלומים הדיגיטלי. ידוע לי כי הבדיקה הינה תנאי הכרחי להמשך התהליך.
                  </div>
                </label>
             </div>
          )}

          {approved && (
            <InfoPanel tone="success" className="mt-4">
               <CheckCircle2 size={24} />
               <div>
                  <p className="text-lg font-black">זכאות אושרה בהצלחה</p>
                  <p className="mt-1 text-sm font-bold">דירוג האשראי שלך נמצא תקין. ניתן להמשיך להקמת הרשאה לחיוב.</p>
               </div>
            </InfoPanel>
          )}

          {rejected && (
            <div className="space-y-4 mt-4">
              <InfoPanel tone="danger">
                <AlertCircle size={24} />
                <div>
                    <p className="text-lg font-black">לא ניתן לאשר זכאות כרגע</p>
                    <p className="mt-1 text-sm font-bold">דילוג על בדיקת נתוני אשראי אפשרי רק לאחר אישור המשכיר.</p>
                </div>
              </InfoPanel>
              <CreditSkipStatus
                approved={landlordCreditSkipApproved}
                onSkipCredit={onSkipCredit}
              />
            </div>
          )}

          {isPending && !approved && !rejected && (
             <div className="mt-6 space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-6">
                  <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-black text-blue-900">בקשת הזכאות נשלחה</p>
                    <p className="mt-1 text-xs font-bold leading-6 text-blue-700">
                      ממתין לאישור המשכיר או לאישור דרך מערכת נתוני אשראי.
                    </p>
                  </div>
                </div>
                <CreditSkipStatus
                  approved={landlordCreditSkipApproved}
                  onSkipCredit={onSkipCredit}
                />
             </div>
          )}
        </div>

        <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-2xl flex flex-col justify-between md:rounded-[32px] md:p-8">
           <div>
              <p className="text-[11px] font-black tracking-[0.14em] text-slate-500 uppercase">מידע חשוב</p>
              <h3 className="mt-4 text-2xl font-black tracking-tight leading-tight italic font-display md:text-3xl">מדוע נדרשת בדיקה?</h3>
              <p className="mt-6 text-sm font-bold leading-8 text-slate-300">
                בדיקת האשראי מאפשרת לנו להעניק בטחון מלא למשכיר ולוודא שהתהליך הדיגיטלי מתבצע באחריות פיננסית מלאה. הבדיקה אינה פוגעת בדירוג האשראי שלך.
              </p>
           </div>
           
           <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                 <p className="text-[10px] font-black text-slate-500 uppercase mb-1">זמן בדיקה</p>
                 <p className="text-lg font-black italic font-display">כ-30 שניות</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                 <p className="text-[10px] font-black text-slate-500 uppercase mb-1">אבטחה</p>
                 <p className="text-lg font-black italic font-display">PCI-DSS</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function CreditSkipStatus({
  approved,
  onSkipCredit,
}: {
  approved: boolean;
  onSkipCredit: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className={cn(
        "rounded-2xl border p-4 text-sm font-bold leading-7",
        approved ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-amber-100 bg-amber-50 text-amber-700",
      )}>
        {approved
          ? "בעל הדירה אישר מראש דילוג על בדיקת נתוני אשראי. ניתן להמשיך להרשאת החיוב."
          : "בעל הדירה עדיין לא אישר דילוג על בדיקת נתוני אשראי."}
      </div>
      {!approved && (
                <a
                  href="https://www.creditdata.org.il/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                >
                  מעבר לאישור בדיקת נתוני אשראי
                </a>
      )}
      <button
        disabled={!approved}
        onClick={onSkipCredit}
        className="w-full rounded-2xl border border-slate-200 py-4 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300"
      >
        דילוג באישור משכיר
      </button>
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
  onDraftChange,
}: {
  contract: Contract | null;
  property: Property | null;
  draft: OnboardingDraft;
  monthlyPayment: number;
  canSign: boolean;
  user: User;
  onDraftChange: DraftChangeHandler;
}) {
  const approved = user.bdiStatus === "green";
  const rejected = user.bdiStatus === "red";

  return (
    <div className="space-y-6 md:space-y-8">
      <StepHeader
        title="חתימה דיגיטלית מאובטחת"
        subtitle="לאחר אישור הזכאות והקמת ההרשאה, ניתן לסיים את החוזה ואת שטר החוב בחתימה אחת."
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
          המערכת מאשרת את החתימה רק לאחר קבלת סטטוס חיובי. החוזה ושטר החוב ייחתמו דיגיטלית ויאובטחו במערכת.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <StatusPill title="סטטוס אשראי" value={user.bdiStatus ?? "ממתין"} tone={approved ? "success" : rejected ? "danger" : "info"} />
          <StatusPill title="תנאי חתימה" value={approved ? "מאושר" : "חסום"} tone={approved ? "success" : "danger"} />
        </div>
      </div>

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
          complete={draft.clausesApproved}
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
        <SignaturePad
          signed={draft.signatureAccepted}
          onSignedChange={(signed) =>
            onDraftChange((currentDraft) => ({
              ...currentDraft,
              signatureAccepted: signed,
            }))
          }
        />
      </div>
    </div>
  );
}

function SignaturePad({
  signed,
  onSignedChange,
}: {
  signed: boolean;
  onSignedChange: (signed: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const previousPointRef = useRef<{ x: number; y: number } | null>(null);

  const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const drawPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const point = getCanvasPoint(event);
    if (!canvas || !point) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";

    const previousPoint = previousPointRef.current ?? point;
    context.beginPath();
    context.moveTo(previousPoint.x, previousPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    previousPointRef.current = point;
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    previousPointRef.current = getCanvasPoint(event);
    drawPoint(event);
    onSignedChange(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawPoint(event);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    previousPointRef.current = null;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onSignedChange(false);
  };

  return (
    <div className="rounded-[28px] border-2 border-dashed border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-900">חתימה ידנית</p>
          <p className="mt-1 text-xs font-bold text-slate-500">חתום עם האצבע או העכבר בתוך המשטח.</p>
        </div>
        <button
          type="button"
          onClick={clearSignature}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black text-slate-500 transition hover:text-slate-900"
        >
          נקה חתימה
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={280}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
        className="h-48 w-full touch-none rounded-[24px] border border-slate-200 bg-white shadow-inner"
        aria-label="משטח חתימה"
      />
      <div className={cn(
        "mt-4 rounded-2xl p-4 text-sm font-bold leading-7",
        signed ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-500",
      )}>
        {signed
          ? "החתימה נקלטה. ניתן להמשיך לסיום החוזה."
          : "יש לחתום בתוך המשטח כדי לפתוח את המשך התהליך."}
      </div>
    </div>
  );
}

function FinishStep() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-10 animate-in fade-in zoom-in duration-700">
      <div className="relative group">
        <div className="absolute inset-0 bg-emerald-400/20 blur-[60px] rounded-full scale-150 animate-pulse" />
        <div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_20px_50px_rgba(16,185,129,0.4)] transition-transform group-hover:scale-105">
          <CheckCircle2 size={80} strokeWidth={1.5} />
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute -right-2 -top-2 flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-white bg-slate-900 text-emerald-400 shadow-2xl"
        >
          <ShieldCheck size={28} />
        </motion.div>
      </div>

      <div className="space-y-6 max-w-2xl px-4">
        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 font-display italic">
          ברוך הבא לבית החדש!
        </h2>
        <p className="text-lg md:text-xl font-bold leading-relaxed text-slate-500">
          כל המסמכים נחתמו ואובטחו בהצלחה. עותק דיגיטלי נשלח אליך ולבעל הנכס בדקות אלו.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 w-full max-w-2xl">
         <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex flex-col items-center gap-3">
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-900">
               <Calculator size={20} />
            </div>
            <p className="text-sm font-black text-slate-900">חיובים אוטומטיים</p>
            <p className="text-xs font-bold text-slate-500 leading-6">התשלומים יבוצעו לפי התאריכים בחוזה ללא צורך בפעולה נוספת.</p>
         </div>
         <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex flex-col items-center gap-3">
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-900">
               <AlertCircle size={20} />
            </div>
            <p className="text-sm font-black text-slate-900">דיווח תקלות</p>
            <p className="text-xs font-bold text-slate-500 leading-6">מעכשיו תוכל לדווח על כל תקלה בבית ישירות מהדשבורד שלך.</p>
         </div>
      </div>

      <div className="pt-4">
         <span className="px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-black tracking-widest uppercase">
            תהליך הושלם בבטחה
         </span>
      </div>
    </div>
  );
}

export function BDICheckStandalone({
  users = [],
  onUpdateUser,
}: {
  users?: User[];
  onUpdateUser?: (userId: string, data: Partial<User>) => void;
}) {
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [lastScore, setLastScore] = useState<number>(0);

  const runCheck = () => {
    if (!selectedUserId) return;
    setStatus("processing");
    const score = 600 + Math.floor(Math.random() * 200);
    setLastScore(score);

    setTimeout(() => {
      setStatus("success");
      if (onUpdateUser) {
        onUpdateUser(selectedUserId, {
          bdiStatus: score > 700 ? "green" : score > 650 ? "yellow" : "red",
        });
      }
    }, 2000);
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div
      className="mx-auto max-w-md animate-in zoom-in-95 rounded-[36px] border border-slate-200 bg-white p-6 text-right shadow-2xl duration-500 sm:p-8 md:p-12"
      dir="rtl"
    >
      <div className="mb-12 text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 rotate-3 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-900/20">
          <ShieldCheck size={36} />
        </div>
        <h2 className="text-3xl font-black tracking-tighter text-slate-900 md:text-4xl">
          בדיקת זכאות מערכת נתוני אשראי
        </h2>
        <p className="mt-3 text-[15px] font-bold text-slate-500">
          כלי ניהולי להפעלת שאילתת BDI ידנית ועדכון סטטוס משתמש
        </p>
      </div>

      {status === "idle" && (
        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 mr-2">בחר משתמש לבדיקה</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-bold focus:border-slate-900 focus:outline-none"
            >
              <option value="">בחר משתמש...</option>
              {users
                .filter((u) => u.role === "tenant")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-6 shadow-inner">
            <input
              type="checkbox"
              defaultChecked
              className="mt-1 h-5 w-5 rounded-lg border-2 border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-[11px] font-black leading-relaxed tracking-[0.1em] text-slate-400">
              ביצוע השאילתה מתועד ביומן המערכת ומשפיע על זכאות המשתמש לחתימה • מסלול soft check
            </span>
          </div>
          <button
            onClick={runCheck}
            disabled={!selectedUserId}
            className="w-full rounded-2xl bg-slate-900 py-5 text-[15px] font-black text-white shadow-xl transition-all hover:bg-black active:scale-95 disabled:opacity-30"
          >
            בצע בדיקה ועדכן DB
          </button>
        </div>
      )}

      {status === "processing" && (
        <div className="py-20 text-center">
          <div className="relative mx-auto mb-10 h-20 w-20 animate-spin rounded-full border-4 border-slate-900 border-t-transparent shadow-xl">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100 opacity-20"></div>
          </div>
          <p className="animate-pulse text-2xl font-black tracking-tighter text-slate-900">
            מושך נתונים עבור {selectedUser?.name}...
          </p>
        </div>
      )}

      {status === "success" && (
        <div className="animate-in fade-in slide-in-from-bottom-6 text-center duration-700">
          <div className="mx-auto mb-10 flex h-28 w-28 rotate-6 scale-110 items-center justify-center rounded-[32px] bg-emerald-500 text-white shadow-2xl">
            <CheckCircle2 size={56} />
          </div>
          <h3 className="text-4xl font-black tracking-tighter text-slate-900">הבדיקה הושלמה!</h3>
          <p className="mt-2 text-[15px] font-bold text-slate-500">הסטטוס של {selectedUser?.name} עודכן בהצלחה במערכת.</p>

          <div className="group relative mt-12 overflow-hidden rounded-[32px] border border-white/5 bg-slate-950 p-8 text-right shadow-2xl">
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">ציון אשראי מעודכן</span>
              <span className="text-sm font-black uppercase text-emerald-400">
                {lastScore > 700 ? "A+" : "B"}
              </span>
            </div>
            <div className="flex items-end gap-4">
              <span className="text-6xl font-black tracking-tighter text-white tabular-nums">{lastScore}</span>
              <span className="mb-3 text-sm font-bold tracking-widest text-slate-600">/ 850</span>
            </div>
          </div>

          <button
            onClick={() => setStatus("idle")}
            className="mt-12 w-full rounded-2xl border-2 border-slate-900 py-5 text-[13px] font-black tracking-[0.2em] text-slate-900 transition-all hover:bg-slate-50"
          >
            בדיקה נוספת
          </button>
        </div>
      )}
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl md:text-4xl">{title}</h2>
      <p className="mt-3 text-[13px] font-bold leading-7 text-slate-500 md:mt-4 md:text-[15px]">{subtitle}</p>
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
        "shrink-0 min-w-[120px] rounded-2xl border p-3 text-right transition-all md:min-w-0",
        isActive
          ? "border-slate-900 bg-white text-slate-900 shadow-sm"
          : "border-slate-200 bg-slate-100/70 text-slate-400",
        canNavigate ? "cursor-pointer hover:border-slate-900" : "cursor-default",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
            isActive ? "bg-slate-900 text-white" : "bg-white text-slate-300",
          )}
        >
          {isCompleted ? <CheckCircle2 size={16} /> : step.icon}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black text-slate-400">שלב {index + 1}</p>
          <p className="truncate text-[11px] font-black leading-4">{step.title}</p>
        </div>
      </div>
    </button>
  );
}

function ProcessStatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "info" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "info" && "border-blue-100 bg-blue-50 text-blue-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      <p className="text-[10px] font-black text-current/60">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function UploadCard({
  label,
  icon,
  sub,
  complete,
  accept = "image/*,video/*,.pdf",
  capture,
  onUpload,
}: {
  label: string;
  icon: ReactNode;
  sub?: string;
  complete?: boolean;
  accept?: string;
  capture?: InputHTMLAttributes<HTMLInputElement>["capture"];
  onUpload?: () => void;
}) {
  const Wrapper = onUpload ? "label" : "div";
  return (
    <Wrapper
      className={cn(
        "relative flex min-h-[168px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed p-5 text-center transition-all sm:aspect-video sm:min-h-0 sm:rounded-[28px] sm:p-6",
        onUpload && "cursor-pointer hover:border-slate-900 hover:bg-white",
        complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50/50",
      )}
    >
      {onUpload && (
        <input
          type="file"
          accept={accept}
          capture={capture}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) onUpload();
          }}
        />
      )}
      {complete && (
        <div className="absolute left-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
          <CheckCircle2 size={16} />
        </div>
      )}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-400 sm:mb-6 sm:h-16 sm:w-16">
        {icon}
      </div>
      <span className="text-[16px] font-black text-slate-900 sm:text-[17px]">{label}</span>
      {sub && <span className="mt-2 text-[11px] font-bold tracking-[0.1em] text-slate-400">{sub}</span>}
      {onUpload && (
        <span className="mt-3 rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500 shadow-sm">
          {complete ? "קובץ נקלט" : "בחר קובץ"}
        </span>
      )}
    </Wrapper>
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

function TextField({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="mr-2 block text-[11px] font-black text-slate-400">{label}</label>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none transition placeholder:text-slate-300 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5"
      />
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
        "rounded-[24px] border p-5 shadow-sm md:rounded-[28px] md:p-6",
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
  tone: "success" | "info" | "danger" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "info" && "border-blue-100 bg-blue-50 text-blue-700",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
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
  className,
}: {
  tone: "info" | "success" | "danger";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[24px] border p-4 text-right md:gap-4 md:rounded-[28px] md:p-5",
        tone === "info" && "border-blue-100 bg-blue-50 text-blue-800",
        tone === "success" && "border-emerald-100 bg-emerald-50 text-emerald-800",
        tone === "danger" && "border-rose-100 bg-rose-50 text-rose-800",
        className,
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
