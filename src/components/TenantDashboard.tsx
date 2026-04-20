import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  CreditCard,
  FileText,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { Contract, Payment, Property, ServiceCall, User } from "../types";
import { cn } from "../lib/utils";
import {
  buildTenantDashboardViewModel,
  TenantActionKind,
  TenantDashboardNavTarget,
  TenantDocumentRow,
  TenantHeroViewModel,
  TenantNextStep,
  TenantQuickAction,
  TenantRetryRequest,
} from "../lib/tenantDashboard";
import { useAppData } from "../lib/appData";
import { getTenantHeroFinancials } from "../lib/analytics";

type RemoteStatus = "loading" | "ready" | "error";

interface TenantDashboardProps {
  user: User;
  onNavigate?: (target: TenantDashboardNavTarget) => void;
  onResumeOnboarding?: () => void;
}

interface RetryRequestDraft {
  reason: string;
  note: string;
  preferredRetryDate: string;
}

const RETRY_REASON_OPTIONS = [
  { value: "insufficient_funds", label: "לא הייתה יתרה מספקת", help: "נעדכן שהיתרה תוסדר לפני החיוב הבא." },
  { value: "timing_issue", label: "מועד החיוב לא התאים", help: "נבקש לבצע את החיוב החוזר במועד שנוח לך." },
  { value: "bank_limit", label: "הבנק חסם או הגביל", help: "הצוות ידע לעקוב ולבדוק אם נדרש תיאום נוסף." },
  { value: "other", label: "סיבה אחרת", help: "אפשר להוסיף פירוט חופשי כדי שנבין את ההקשר." },
];

export default function TenantDashboard({
  user,
  onNavigate,
  onResumeOnboarding,
}: TenantDashboardProps) {
  const { db, submitRetryRequest, updateUser } = useAppData();

  const [isRetryDialogOpen, setIsRetryDialogOpen] = useState(false);
  const payments = useMemo(
    () => db.payments.filter((payment) => payment.tenantId === user.id),
    [db.payments, user.id],
  );
  const serviceCalls = useMemo(
    () => db.serviceCalls.filter((serviceCall) => serviceCall.tenantId === user.id),
    [db.serviceCalls, user.id],
  );
  const contracts = useMemo(
    () => db.contracts.filter((contract) => contract.tenantId === user.id),
    [db.contracts, user.id],
  );
  const property = useMemo(
    () =>
      db.properties.find((entry) => entry.tenantId === user.id) ??
      db.properties.find((entry) =>
        contracts.some((contract) => contract.propertyId === entry.id),
      ) ??
      null,
    [contracts, db.properties, user.id],
  );
  const retryRequest = useMemo(() => {
    const activeRequest = db.paymentRetries.find(
      (request) =>
        request.tenantId === user.id &&
        ["requested", "approved", "scheduled"].includes(request.status),
    );

    if (!activeRequest) return null;

    return {
      reason: activeRequest.reason,
      note: activeRequest.note,
      preferredRetryDate: activeRequest.preferredRetryDate,
      submittedAt: activeRequest.requestedAt,
    };
  }, [db.paymentRetries, user.id]);

  const viewModel = buildTenantDashboardViewModel({
    user,
    payments,
    serviceCalls,
    contracts,
    property,
    isLoading: false,
    hasError: false,
    retryRequest,
  });
  const tenantFinancials = getTenantHeroFinancials(db, user.id);

  const handleAction = (action?: TenantActionKind) => {
    switch (action) {
      case "openRetryFlow":
        setIsRetryDialogOpen(true);
        return;
      case "openOnboarding":
        onResumeOnboarding?.();
        return;
      case "openContracts":
        onNavigate?.("contracts");
        return;
      case "openMaintenance":
        onNavigate?.("maintenance");
        return;
      case "openMessages":
        onNavigate?.("messages");
        return;
      case "openPayments":
        onNavigate?.("payments");
        return;
      default:
        return;
    }
  };

  const handleRetryRequestSubmit = async (draft: RetryRequestDraft) => {
    const failedPayment = payments.find((payment) => payment.status === "failed");
    if (!failedPayment) return;

    submitRetryRequest(user.id, {
      paymentId: failedPayment.id,
      reason: draft.reason,
      note: draft.note,
      preferredRetryDate: draft.preferredRetryDate,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right" dir="rtl">
      <AnimatePresence>
        {isRetryDialogOpen && (
          <RetryPaymentDialog
            pendingApproval={Boolean(retryRequest || user.pendingPaymentRetry)}
            request={retryRequest}
            onClose={() => setIsRetryDialogOpen(false)}
            onSubmit={handleRetryRequestSubmit}
          />
        )}
      </AnimatePresence>

      <DashboardHeader
        user={user}
        address={viewModel.summaryCard.address}
        statusLabel={viewModel.statusPill.label}
        tone={viewModel.statusPill.tone}
        rent={tenantFinancials.rent}
        buildingCommittee={tenantFinancials.costs.buildingCommittee}
        arnona={tenantFinancials.costs.arnona}
        utilities={tenantFinancials.costs.utilities}
      />

      {viewModel.pageState === "loading" ? (
        <DashboardLoadingState />
      ) : viewModel.pageState === "error" ? (
        <DashboardErrorState
          message="לא הצלחנו לטעון את נתוני החשבון."
          onPrimaryAction={() => handleAction("openMessages")}
        />
      ) : (
        <>
          {viewModel.alerts.length > 0 && (
            <div className="space-y-3">
              {viewModel.alerts.map((alert) => (
                <AlertBanner
                  key={alert.id}
                  title={alert.title}
                  description={alert.description}
                  tone={alert.tone}
                  actionLabel={alert.actionLabel}
                  onAction={() => handleAction(alert.action)}
                />
              ))}
            </div>
          )}

          <div className="grid gap-8 xl:grid-cols-12 items-start">
            <div className="xl:col-span-8 space-y-8">
              <HeroCard hero={viewModel.hero} onAction={handleAction} />

              <QuickActionsGrid
                actions={viewModel.quickActions}
                onNavigate={(target) => onNavigate?.(target)}
              />

              {viewModel.pageState === "empty" ? (
                <EmptyDashboardState
                  onOpenContracts={() => handleAction("openContracts")}
                  onOpenOnboarding={() => handleAction("openOnboarding")}
                />
              ) : (
                <div className="grid gap-8 lg:grid-cols-2">
                  <RecentPaymentsCard payments={viewModel.paymentHistory} />
                  <RecentActivityCard
                    serviceCalls={viewModel.serviceHighlights}
                    onOpenMaintenance={() => handleAction("openMaintenance")}
                  />
                </div>
              )}
            </div>

            <div className="xl:col-span-4 space-y-8">
              <SummaryCard
                address={viewModel.summaryCard.address}
                statusLabel={viewModel.summaryCard.statusLabel}
                metrics={viewModel.summaryCard.metrics}
              />

              {viewModel.renewalBanner && (
                <RenewalBanner
                  title={viewModel.renewalBanner.title}
                  description={viewModel.renewalBanner.description}
                  actionLabel={viewModel.renewalBanner.actionLabel}
                  onAction={() => handleAction(viewModel.renewalBanner?.action)}
                />
              )}

              <DocumentsCard
                documents={viewModel.documents}
                onAction={handleAction}
              />

              <NextStepsCard steps={viewModel.nextSteps} onAction={handleAction} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardHeader({
  user,
  address,
  statusLabel,
  tone,
  rent,
  buildingCommittee,
  arnona,
  utilities,
}: {
  user: User;
  address: string;
  statusLabel: string;
  tone: "critical" | "warning" | "info" | "success";
  rent: number;
  buildingCommittee: number;
  arnona: number;
  utilities: number;
}) {
  const rows = [
    { label: "שכר דירה", value: rent },
    { label: "ועד בית", value: buildingCommittee },
    { label: "ארנונה", value: arnona },
    { label: "שירותים", value: utilities },
  ];

  return (
    <div className="dashboard-card p-6 md:p-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 md:gap-10 bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute top-[-50%] left-[-10%] w-96 h-96 bg-blue-600/30 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="flex items-center gap-5 min-w-0 relative z-10 w-full xl:w-auto shrink-0 xl:border-l xl:border-white/10 xl:pl-10">
        <div className="h-16 w-16 shrink-0 rounded-[24px] bg-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-xl shadow-blue-900/50">
          {user.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              שלום, {user.name.split(" ")[0]}
            </h1>
            <span className={cn(
              "shrink-0 rounded-full px-3 py-1 text-[10px] font-black tracking-wide hidden sm:block",
              tone === "success" ? "bg-emerald-500/20 text-emerald-300" :
              tone === "warning" ? "bg-amber-500/20 text-amber-300" :
              tone === "critical" ? "bg-rose-500/20 text-rose-300" :
              "bg-blue-500/20 text-blue-300"
            )}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-slate-400 min-w-0">
            <ShieldCheck size={16} className="text-blue-500 shrink-0" />
            <span className="text-sm font-semibold truncate">{address}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 relative z-10">
         {rows.map((row) => (
           <div key={row.label} className="flex flex-col items-start bg-white/5 shadow-inner shadow-white/5 rounded-2xl p-4 md:p-5 border border-white/10 w-full hover:bg-white/10 transition-colors">
             <p className="text-xs font-black text-slate-400 drop-shadow-sm">{row.label}</p>
             <p className="mt-1.5 text-xl font-black text-white tabular-nums drop-shadow-md">₪{row.value.toLocaleString()}</p>
           </div>
         ))}
      </div>
    </div>
  );
}

function HeroCard({
  hero,
  onAction,
}: {
  hero: TenantHeroViewModel;
  onAction: (action?: TenantActionKind) => void;
}) {
  const palette = getHeroPalette(hero.state);

  return (
    <section
      className={cn(
        "dashboard-card relative overflow-hidden p-8 md:p-10 transition-all",
        palette.wrapper,
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1/3 blur-3xl opacity-60", palette.glow)} />

      <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className={cn("h-16 w-16 shrink-0 rounded-full flex items-center justify-center text-white shadow-xl", palette.icon)}>
              {renderHeroIcon(hero.state)}
            </div>
            <div>
              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-black", palette.badge)}>
                {hero.badge}
              </span>
              <h2 className={cn("mt-3 text-3xl md:text-4xl font-black tracking-tight", palette.title)}>
                {hero.title}
              </h2>
            </div>
          </div>

          <p className={cn("max-w-2xl text-base md:text-lg leading-7 font-semibold", palette.description)}>
            {hero.description}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {hero.meta.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-[24px] border px-5 py-4 backdrop-blur-sm",
                  palette.metaCard,
                )}
              >
                <p className="text-xs font-black text-slate-400">{item.label}</p>
                <p className={cn("mt-2 text-sm font-extrabold", palette.metaValue)}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-sm shrink-0 rounded-[28px] bg-white/75 p-6 border border-white/70 shadow-xl shadow-slate-900/5">
          <p className="text-xs font-black text-slate-400">{hero.amountLabel}</p>
          <p className="mt-3 text-4xl font-black text-slate-900 tracking-tight tabular-nums">
            {hero.amountValue}
          </p>

          <div className="mt-6 space-y-3">
            {hero.primaryActionLabel && (
              <button
                onClick={() => onAction(hero.primaryAction)}
                className="w-full rounded-[20px] bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-xl shadow-slate-900/15 hover:bg-black transition-all active:scale-[0.99]"
              >
                {hero.primaryActionLabel}
              </button>
            )}

            {hero.secondaryActionLabel && (
              <button
                onClick={() => onAction(hero.secondaryAction)}
                className="w-full rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                {hero.secondaryActionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AlertBanner({
  title,
  description,
  tone,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  tone: "critical" | "warning" | "info" | "success";
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className={cn(
        "dashboard-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between",
        tone === "critical" && "border-rose-100 bg-rose-50/90",
        tone === "warning" && "border-amber-100 bg-amber-50/90",
        tone === "info" && "border-blue-100 bg-blue-50/90",
        tone === "success" && "border-emerald-100 bg-emerald-50/90",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center",
            tone === "critical" && "bg-rose-100 text-rose-700",
            tone === "warning" && "bg-amber-100 text-amber-700",
            tone === "info" && "bg-blue-100 text-blue-700",
            tone === "success" && "bg-emerald-100 text-emerald-700",
          )}
        >
          <AlertCircle size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600 font-semibold">{description}</p>
        </div>
      </div>

      {actionLabel && (
        <button
          onClick={onAction}
          className="shrink-0 rounded-[18px] bg-white px-4 py-3 text-sm font-black text-slate-900 border border-white shadow-sm hover:border-slate-200 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function QuickActionsGrid({
  actions,
  onNavigate,
}: {
  actions: TenantQuickAction[];
  onNavigate: (target: TenantDashboardNavTarget) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onNavigate(action.id)}
          className="dashboard-card flex min-h-[148px] flex-col items-start justify-between p-5 text-right hover:-translate-y-0.5 hover:shadow-xl transition-all"
        >
          <div className="flex w-full items-start justify-between gap-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
              {renderQuickActionIcon(action.id)}
            </div>
            {action.badge && (
              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">
                {action.badge}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">{action.label}</h3>
            <p className="mt-1 text-sm text-slate-500 font-semibold leading-6">{action.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function RecentPaymentsCard({ payments }: { payments: Payment[] }) {
  return (
    <section className="dashboard-card p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">תשלומים אחרונים</h3>
          <p className="mt-1 text-sm text-slate-500 font-semibold">חיובים אחרונים והסטטוס שלהם</p>
        </div>
        <CreditCard size={20} className="text-slate-300" />
      </div>

      {payments.length === 0 ? (
        <CardEmptyState
          icon={<CreditCard size={22} />}
          title="עדיין אין היסטוריית תשלומים"
          description="ברגע שיתחילו להיקלט חיובים, תוכל לעקוב אחריהם כאן."
        />
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <PaymentRow key={payment.id} payment={payment} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecentActivityCard({
  serviceCalls,
  onOpenMaintenance,
}: {
  serviceCalls: ServiceCall[];
  onOpenMaintenance: () => void;
}) {
  return (
    <section className="dashboard-card p-6 md:p-7">
      <div className="mb-6 flex items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-slate-900">תחזוקה ועדכונים</h3>
          <p className="mt-1 text-sm text-slate-500 font-semibold">קריאות פעילות ומה שחשוב לדעת עכשיו</p>
        </div>
        <button
          onClick={onOpenMaintenance}
          className="shrink-0 rounded-[18px] border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          למסך התחזוקה
        </button>
      </div>

      {serviceCalls.length === 0 ? (
        <CardEmptyState
          icon={<Wrench size={22} />}
          title="אין כרגע קריאות פתוחות"
          description="כשתיפתח קריאה חדשה, סטטוס הטיפול יופיע כאן."
        />
      ) : (
        <div className="space-y-3">
          {serviceCalls.map((call) => (
            <ServiceCallRow key={call.id} call={call} />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryCard({
  address,
  statusLabel,
  metrics,
}: {
  address: string;
  statusLabel: string;
  metrics: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="dashboard-card bg-slate-900 border-slate-900 p-7 text-white shadow-2xl shadow-slate-900/10 overflow-hidden relative">
      <div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="relative z-10">
        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black text-blue-100">
          {statusLabel}
        </span>
        <h3 className="mt-4 text-2xl font-black tracking-tight leading-9">{address}</h3>

        <div className="mt-8 space-y-5">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-300 font-semibold">{metric.label}</span>
              <span className="text-base font-black text-white tabular-nums">{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RenewalBanner({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="dashboard-card border-amber-100 bg-amber-50/90 p-6">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <Calendar size={20} />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 font-semibold">{description}</p>
        </div>
      </div>
      <button
        onClick={onAction}
        className="mt-5 w-full rounded-[18px] border border-amber-200 bg-white px-4 py-3 text-sm font-black text-slate-900 hover:bg-amber-50 transition-all"
      >
        {actionLabel}
      </button>
    </section>
  );
}

function DocumentsCard({
  documents,
  onAction,
}: {
  documents: TenantDocumentRow[];
  onAction: (action?: TenantActionKind) => void;
}) {
  return (
    <section className="dashboard-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">מסמכים ואישורים</h3>
          <p className="mt-1 text-sm text-slate-500 font-semibold">גישה מהירה למסמכים של הדירה</p>
        </div>
        <FileText size={20} className="text-slate-300" />
      </div>

      <div className="space-y-3">
        {documents.map((document) => (
          <button
            key={document.id}
            onClick={() => onAction(document.action)}
            className="flex w-full items-center justify-between gap-4 rounded-[22px] border border-slate-100 bg-slate-50/70 px-4 py-4 hover:bg-white hover:border-slate-200 transition-all"
          >
            <div className="text-right">
              <p className="text-sm font-black text-slate-900">{document.label}</p>
              <p
                className={cn(
                  "mt-1 text-sm font-semibold leading-6",
                  document.emphasis === "warning" && "text-amber-700",
                  document.emphasis === "success" && "text-emerald-700",
                  document.emphasis === "default" && "text-slate-500",
                )}
              >
                {document.status}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 border border-slate-200">
              {document.actionLabel}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function NextStepsCard({
  steps,
  onAction,
}: {
  steps: TenantNextStep[];
  onAction: (action?: TenantActionKind) => void;
}) {
  return (
    <section className="dashboard-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">מה כדאי לעשות עכשיו</h3>
          <p className="mt-1 text-sm text-slate-500 font-semibold">פעולות קצרות לפי מצב החשבון הנוכחי</p>
        </div>
        <ArrowLeft size={18} className="text-slate-300" />
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.id} className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-4">
            <h4 className="text-sm font-black text-slate-900">{step.title}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-500 font-semibold">{step.description}</p>
            {step.actionLabel && (
              <button
                onClick={() => onAction(step.action)}
                className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 hover:bg-slate-50"
              >
                {step.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="dashboard-card h-[280px] bg-slate-100 border-slate-100" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="dashboard-card h-[148px] bg-slate-100 border-slate-100" />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="dashboard-card h-[320px] bg-slate-100 border-slate-100" />
        <div className="dashboard-card h-[320px] bg-slate-100 border-slate-100" />
      </div>
    </div>
  );
}

function DashboardErrorState({
  message,
  onPrimaryAction,
}: {
  message: string | null;
  onPrimaryAction: () => void;
}) {
  return (
    <section className="dashboard-card border-rose-100 bg-rose-50/80 p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertCircle size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">לא הצלחנו להציג את הדשבורד כרגע</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 font-semibold">
              {message ?? "אירעה שגיאה זמנית בזמן טעינת הנתונים. אפשר לנסות שוב בעוד רגע או לפנות לתמיכה."}
            </p>
          </div>
        </div>

        <button
          onClick={onPrimaryAction}
          className="w-full md:w-auto rounded-[20px] bg-white px-5 py-4 text-sm font-black text-slate-900 border border-rose-100 shadow-sm hover:bg-rose-50"
        >
          פתח הודעות תמיכה
        </button>
      </div>
    </section>
  );
}

function EmptyDashboardState({
  onOpenContracts,
  onOpenOnboarding,
}: {
  onOpenContracts: () => void;
  onOpenOnboarding: () => void;
}) {
  return (
    <section className="dashboard-card p-8 md:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-100 text-slate-500">
          <FileText size={28} />
        </div>
        <h2 className="mt-6 text-3xl font-black text-slate-900">עדיין מחכים לפרטי השכירות</h2>
        <p className="mt-3 text-base leading-7 text-slate-500 font-semibold">
          ברגע שהחוזה, התשלומים והאישורים יחוברו לחשבון שלך, הם יופיעו כאן בצורה מסודרת. עד אז אפשר לבדוק מסמכים זמינים או להשלים פרטים חסרים.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onOpenContracts}
            className="rounded-[20px] bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-xl shadow-slate-900/15 hover:bg-black"
          >
            למסמכים
          </button>
          <button
            onClick={onOpenOnboarding}
            className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            השלמת פרטים
          </button>
        </div>
      </div>
    </section>
  );
}

function CardEmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 border border-slate-200">
        {icon}
      </div>
      <h4 className="mt-4 text-base font-black text-slate-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-500 font-semibold">{description}</p>
    </div>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const tone = getPaymentTone(payment.status);

  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-100 bg-slate-50/70 px-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900">
          {payment.type === "rent" ? "שכר דירה" : "תשלום נוסף"}
        </p>
        <p className="mt-1 text-sm text-slate-500 font-semibold">{formatDisplayDate(payment.date)}</p>
      </div>
      <div className="text-left shrink-0">
        <p className="text-base font-black text-slate-900 tabular-nums">
          {formatCurrency(payment.amount)}
        </p>
        <span
          className={cn(
            "mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black",
            tone.badge,
          )}
        >
          {tone.label}
        </span>
      </div>
    </div>
  );
}

function ServiceCallRow({ call }: { call: ServiceCall }) {
  const statusConfig =
    call.status === "resolved" || call.status === "closed"
      ? {
          label: "טופל",
          badge: "bg-emerald-50 text-emerald-700",
          icon: <CheckCircle2 size={18} />,
        }
      : call.status === "in_progress"
        ? {
            label: "בטיפול",
            badge: "bg-blue-50 text-blue-700",
            icon: <RefreshCw size={18} />,
          }
        : {
            label: "חדש",
            badge: "bg-amber-50 text-amber-700",
            icon: <Clock3 size={18} />,
          };

  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-100 bg-slate-50/70 px-4 py-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
          {statusConfig.icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">{call.title}</p>
          <p className="mt-1 text-sm text-slate-500 font-semibold leading-relaxed">
            {mapServiceCategory(call.category)}
          </p>
        </div>
      </div>
      <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-black", statusConfig.badge)}>
        {statusConfig.label}
      </span>
    </div>
  );
}

function RetryPaymentDialog({
  request,
  pendingApproval,
  onClose,
  onSubmit,
}: {
  request: TenantRetryRequest | null;
  pendingApproval: boolean;
  onClose: () => void;
  onSubmit: (draft: RetryRequestDraft) => Promise<void>;
}) {
  const [reason, setReason] = useState(RETRY_REASON_OPTIONS[0].value);
  const [note, setNote] = useState("");
  const [preferredRetryDate, setPreferredRetryDate] = useState(getDefaultRetryDate());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ reason, note, preferredRetryDate });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end justify-center md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="retry-dialog-title"
        className="w-full bg-white text-right shadow-2xl md:max-w-2xl md:rounded-[36px] md:m-6 rounded-t-[32px] min-h-[88vh] md:min-h-0 md:max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur md:px-8 md:py-5">
          <div>
            <p className="text-xs font-black text-slate-400">טיפול בחיוב שלא עבר</p>
            <h2 id="retry-dialog-title" className="mt-1 text-xl font-black text-slate-900">
              {pendingApproval ? "בקשת חיוב חוזר" : "קביעת ניסיון חיוב חוזר"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-11 w-11 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 md:p-8">
          {pendingApproval ? (
            <RetryPendingState request={request} onClose={onClose} />
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="rounded-[28px] border border-rose-100 bg-rose-50/70 p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <AlertCircle size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">החיוב האחרון לא הושלם</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 font-semibold">
                      כדי שנוכל להמשיך באופן מסודר, בחר סיבה, הוסף הערה אם צריך, וקבע מועד מועדף לניסיון החיוב החוזר.
                    </p>
                  </div>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-black text-slate-900">מה הסיבה המרכזית לחיוב שלא עבר?</legend>
                {RETRY_REASON_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-[22px] border px-4 py-4 transition-all",
                      reason === option.value
                        ? "border-blue-200 bg-blue-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="retry-reason"
                      value={option.value}
                      checked={reason === option.value}
                      onChange={() => setReason(option.value)}
                      className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <span>
                      <span className="block text-sm font-black text-slate-900">{option.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-500 font-semibold">
                        {option.help}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="space-y-2">
                <label htmlFor="retry-note" className="text-sm font-black text-slate-900">
                  הערה לצוות הטיפול (אופציונלי)
                </label>
                <textarea
                  id="retry-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  placeholder="למשל: אבקש לבצע את החיוב לאחר ה-10 לחודש."
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="retry-date" className="text-sm font-black text-slate-900">
                  תאריך מועדף לניסיון החיוב החוזר
                </label>
                <input
                  id="retry-date"
                  type="date"
                  min={getTodayDate()}
                  value={preferredRetryDate}
                  onChange={(event) => setPreferredRetryDate(event.target.value)}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  סגור בינתיים
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-3 rounded-[20px] bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-xl shadow-slate-900/15 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && <LoaderCircle size={18} className="animate-spin" />}
                  {isSubmitting ? "שולחים בקשה..." : "שלח בקשה לניסיון חיוב חוזר"}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function RetryPendingState({
  request,
  onClose,
}: {
  request: TenantRetryRequest | null;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">הבקשה נקלטה וממתינה לאישור</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 font-semibold">
              אנחנו נבדוק את הבקשה ונעדכן אותך ברגע שהניסיון החוזר יאושר או יתוזמן.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard
          label="מועד מועדף"
          value={request?.preferredRetryDate ? formatDisplayDate(request.preferredRetryDate) : "נעדכן בהמשך"}
        />
        <InfoCard
          label="סיבה שנבחרה"
          value={request ? getRetryReasonLabel(request.reason) : "בקשה פתוחה"}
        />
      </div>

      {request?.note && <InfoCard label="הערה שנשלחה" value={request.note} />}

      <div className="flex justify-end border-t border-slate-100 pt-5">
        <button
          onClick={onClose}
          className="rounded-[20px] bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-xl shadow-slate-900/15 hover:bg-black"
        >
          חזרה לדשבורד
        </button>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function renderHeroIcon(state: TenantHeroViewModel["state"]) {
  switch (state) {
    case "paid":
      return <CheckCircle2 size={28} />;
    case "retryPendingApproval":
      return <RefreshCw size={28} />;
    case "failed":
    case "overdue":
      return <AlertCircle size={28} />;
    case "dueSoon":
    case "scheduled":
      return <Clock3 size={28} />;
    case "onboarding":
      return <ShieldCheck size={28} />;
    case "error":
      return <AlertCircle size={28} />;
    case "empty":
      return <FileText size={28} />;
    default:
      return <LoaderCircle size={28} />;
  }
}

function renderQuickActionIcon(target: TenantDashboardNavTarget) {
  switch (target) {
    case "maintenance":
      return <Wrench size={22} />;
    case "messages":
      return <MessageSquare size={22} />;
    case "contracts":
      return <FileText size={22} />;
    case "payments":
      return <CreditCard size={22} />;
    default:
      return <ChevronLeft size={22} />;
  }
}

function getHeroPalette(state: TenantHeroViewModel["state"]) {
  switch (state) {
    case "failed":
    case "overdue":
      return {
        wrapper: "border-rose-100 bg-rose-50/90",
        glow: "bg-rose-200",
        icon: "bg-rose-600",
        badge: "bg-white text-rose-700 border border-rose-100",
        title: "text-slate-900",
        description: "text-slate-700",
        metaCard: "border-rose-100 bg-white/70",
        metaValue: "text-slate-800",
      };
    case "retryPendingApproval":
      return {
        wrapper: "border-blue-100 bg-blue-50/90",
        glow: "bg-blue-200",
        icon: "bg-blue-600",
        badge: "bg-white text-blue-700 border border-blue-100",
        title: "text-slate-900",
        description: "text-slate-700",
        metaCard: "border-blue-100 bg-white/70",
        metaValue: "text-slate-800",
      };
    case "onboarding":
      return {
        wrapper: "border-slate-900 bg-slate-900",
        glow: "bg-blue-500/40",
        icon: "bg-blue-600",
        badge: "bg-white/10 text-blue-100 border border-white/10",
        title: "text-white",
        description: "text-slate-200",
        metaCard: "border-white/10 bg-white/5",
        metaValue: "text-white",
      };
    case "paid":
      return {
        wrapper: "border-emerald-100 bg-emerald-50/90",
        glow: "bg-emerald-200",
        icon: "bg-emerald-600",
        badge: "bg-white text-emerald-700 border border-emerald-100",
        title: "text-slate-900",
        description: "text-slate-700",
        metaCard: "border-emerald-100 bg-white/70",
        metaValue: "text-slate-800",
      };
    case "dueSoon":
      return {
        wrapper: "border-blue-100 bg-white",
        glow: "bg-blue-100",
        icon: "bg-blue-600",
        badge: "bg-blue-50 text-blue-700 border border-blue-100",
        title: "text-slate-900",
        description: "text-slate-700",
        metaCard: "border-slate-100 bg-slate-50/80",
        metaValue: "text-slate-800",
      };
    case "error":
      return {
        wrapper: "border-rose-100 bg-white",
        glow: "bg-rose-100",
        icon: "bg-rose-600",
        badge: "bg-rose-50 text-rose-700 border border-rose-100",
        title: "text-slate-900",
        description: "text-slate-700",
        metaCard: "border-slate-100 bg-slate-50/80",
        metaValue: "text-slate-800",
      };
    default:
      return {
        wrapper: "border-slate-100 bg-white",
        glow: "bg-slate-100",
        icon: "bg-slate-900",
        badge: "bg-slate-50 text-slate-700 border border-slate-100",
        title: "text-slate-900",
        description: "text-slate-700",
        metaCard: "border-slate-100 bg-slate-50/80",
        metaValue: "text-slate-800",
      };
  }
}

function getPaymentTone(status: Payment["status"]) {
  switch (status) {
    case "paid":
      return {
        label: "שולם",
        badge: "bg-emerald-50 text-emerald-700",
      };
    case "failed":
      return {
        label: "נכשל",
        badge: "bg-rose-50 text-rose-700",
      };
    case "late":
      return {
        label: "באיחור",
        badge: "bg-amber-50 text-amber-700",
      };
    case "deferred":
      return {
        label: "נדחה",
        badge: "bg-blue-50 text-blue-700",
      };
    default:
      return {
        label: "מתוזמן",
        badge: "bg-slate-100 text-slate-700",
      };
  }
}

function getRetryReasonLabel(value: string) {
  return (
    RETRY_REASON_OPTIONS.find((option) => option.value === value)?.label ??
    "בקשה פתוחה"
  );
}

function mapServiceCategory(category: ServiceCall["category"]) {
  switch (category) {
    case "plumbing":
      return "אינסטלציה";
    case "electricity":
      return "חשמל";
    case "cleaning":
      return "ניקיון";
    case "general":
      return "כללי";
    default:
      return "אחר";
  }
}

function formatDisplayDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "טרם עודכן";

  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
  }).format(parsed);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getDefaultRetryDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().split("T")[0];
}
