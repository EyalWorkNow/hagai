import { Contract, Payment, Property, ServiceCall, User } from "../types";

export type TenantDashboardNavTarget =
  | "maintenance"
  | "contracts"
  | "messages"
  | "payments";

export type TenantHeroState =
  | "loading"
  | "error"
  | "empty"
  | "onboarding"
  | "paid"
  | "scheduled"
  | "dueSoon"
  | "failed"
  | "overdue"
  | "retryPendingApproval";

export type TenantActionKind =
  | "openRetryFlow"
  | "openOnboarding"
  | "openContracts"
  | "openMaintenance"
  | "openMessages"
  | "openPayments";

export interface TenantRetryRequest {
  reason: string;
  note?: string;
  preferredRetryDate: string;
  submittedAt: string;
}

export interface TenantAlert {
  id: string;
  priority: number;
  tone: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  actionLabel?: string;
  action?: TenantActionKind;
}

export interface TenantHeroViewModel {
  state: TenantHeroState;
  badge: string;
  title: string;
  description: string;
  amountLabel: string;
  amountValue: string;
  primaryActionLabel?: string;
  primaryAction?: TenantActionKind;
  secondaryActionLabel?: string;
  secondaryAction?: TenantActionKind;
  meta: Array<{ label: string; value: string }>;
}

export interface TenantQuickAction {
  id: TenantDashboardNavTarget;
  label: string;
  description: string;
  badge?: string;
}

export interface TenantSummaryMetric {
  label: string;
  value: string;
}

export interface TenantSummaryCard {
  address: string;
  statusLabel: string;
  metrics: TenantSummaryMetric[];
}

export interface TenantDocumentRow {
  id: string;
  label: string;
  status: string;
  emphasis: "default" | "warning" | "success";
  actionLabel: string;
  action: TenantActionKind;
}

export interface TenantNextStep {
  id: string;
  title: string;
  description: string;
  actionLabel?: string;
  action?: TenantActionKind;
}

export interface TenantRenewalBanner {
  title: string;
  description: string;
  actionLabel: string;
  action: TenantActionKind;
}

export interface TenantDashboardViewModel {
  pageState: "loading" | "error" | "empty" | "ready";
  hero: TenantHeroViewModel;
  alerts: TenantAlert[];
  statusPill: { label: string; tone: TenantAlert["tone"] };
  summaryCard: TenantSummaryCard;
  quickActions: TenantQuickAction[];
  documents: TenantDocumentRow[];
  nextSteps: TenantNextStep[];
  renewalBanner: TenantRenewalBanner | null;
  paymentHistory: Payment[];
  serviceHighlights: ServiceCall[];
  showFailedPaymentCta: boolean;
}

export interface TenantDashboardInput {
  user: User;
  payments: Payment[];
  serviceCalls: ServiceCall[];
  property: Property | null;
  contracts: Contract[];
  isLoading?: boolean;
  hasError?: boolean;
  now?: Date;
  retryRequest?: TenantRetryRequest | null;
}

export interface TenantDashboardDataBundle {
  payments: Payment[];
  serviceCalls: ServiceCall[];
  property: Property | null;
  contracts: Contract[];
}

interface DashboardFacts {
  address: string;
  contract: Contract | null;
  rentAmount: number | null;
  failedPayment: Payment | null;
  overduePayment: Payment | null;
  nextPayment: Payment | null;
  currentMonthPaidPayment: Payment | null;
  latestPaidPayment: Payment | null;
  retryPendingApproval: boolean;
  contractEndingSoon: boolean;
  daysUntilContractEnd: number | null;
  daysUntilNextPayment: number | null;
  pageState: TenantDashboardViewModel["pageState"];
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function buildTenantDashboardViewModel(
  input: TenantDashboardInput,
): TenantDashboardViewModel {
  const now = input.now ?? new Date();
  const facts = collectFacts(input, now);
  const heroState = getTenantHeroState(input.user, facts);
  const hero = buildHero(heroState, facts, input, now);
  const alerts = buildAlerts(heroState, facts, input, now);
  const renewalBanner = buildRenewalBanner(facts);

  return {
    pageState: facts.pageState,
    hero,
    alerts,
    statusPill: buildStatusPill(heroState),
    summaryCard: buildSummaryCard(facts, input),
    quickActions: buildQuickActions(input),
    documents: buildDocuments(facts, input),
    nextSteps: buildNextSteps(heroState, facts),
    renewalBanner,
    paymentHistory: sortPaymentsByDate(input.payments).slice(0, 5),
    serviceHighlights: sortServiceCallsByDate(input.serviceCalls).slice(0, 4),
    showFailedPaymentCta:
      hero.primaryAction === "openRetryFlow" ||
      alerts.some((alert) => alert.action === "openRetryFlow"),
  };
}

export function getTenantHeroState(
  user: User,
  facts: Pick<
    DashboardFacts,
    | "pageState"
    | "retryPendingApproval"
    | "failedPayment"
    | "overduePayment"
    | "nextPayment"
    | "currentMonthPaidPayment"
    | "daysUntilNextPayment"
  >,
): TenantHeroState {
  if (facts.pageState === "loading") return "loading";
  if (facts.pageState === "error") return "error";
  if (!user.onboardingComplete) return "onboarding";
  if (facts.pageState === "empty") return "empty";
  if (facts.retryPendingApproval) return "retryPendingApproval";
  if (facts.failedPayment) return "failed";
  if (facts.overduePayment) return "overdue";
  if (
    facts.nextPayment &&
    facts.daysUntilNextPayment !== null &&
    facts.daysUntilNextPayment <= 5
  ) {
    return "dueSoon";
  }
  if (facts.currentMonthPaidPayment) return "paid";
  if (facts.nextPayment) return "scheduled";
  return "scheduled";
}

export function shouldShowRenewalBanner(
  contract: Contract | null,
  now: Date = new Date(),
): boolean {
  if (!contract || contract.status !== "active") return false;
  const endDate = parseDate(contract.endDate);
  if (!endDate) return false;
  const daysUntilEnd = diffInDays(now, endDate);
  return daysUntilEnd >= 0 && daysUntilEnd <= 45;
}

export function createTenantDashboardDemoData(
  user: User,
  now: Date = new Date(),
): TenantDashboardDataBundle {
  const property: Property = {
    id: "demo-property",
    address: "שדרות רוטשילד 45, תל אביב",
    rent: 6200,
    status: "occupied",
    tenantId: user.id,
  };

  const contracts: Contract[] = [
    {
      id: "demo-contract",
      propertyId: property.id,
      propertyAddress: property.address,
      tenantId: user.id,
      tenantName: user.name,
      startDate: formatInputDate(addDays(now, -320)),
      endDate: formatInputDate(addDays(now, 38)),
      rentAmount: property.rent,
      guaranteeType: "bank",
      status: user.onboardingComplete ? "active" : "waiting_bank_auth",
    },
  ];

  const payments: Payment[] = user.onboardingComplete
    ? [
        {
          id: "demo-payment-upcoming",
          propertyId: property.id,
          propertyAddress: property.address,
          tenantId: user.id,
          amount: property.rent,
          date: formatInputDate(addDays(now, 3)),
          status: "pending",
          type: "rent",
        },
        {
          id: "demo-payment-last",
          propertyId: property.id,
          propertyAddress: property.address,
          tenantId: user.id,
          amount: property.rent,
          date: formatInputDate(addDays(now, -27)),
          status: "paid",
          type: "rent",
        },
      ]
    : [];

  const serviceCalls: ServiceCall[] = [
    {
      id: "demo-service",
      propertyId: property.id,
      propertyAddress: property.address,
      tenantId: user.id,
      title: "בדיקת מזגן בסלון",
      status: "in_progress",
      priority: "medium",
      category: "general",
      createdAt: addDays(now, -2).toISOString(),
    },
  ];

  return {
    payments,
    serviceCalls,
    property,
    contracts,
  };
}

function collectFacts(input: TenantDashboardInput, now: Date): DashboardFacts {
  const contract = pickPrimaryContract(input.contracts, now);
  const address =
    input.property?.address || contract?.propertyAddress || "כתובת הנכס תופיע כאן";
  const rentAmount = input.property?.rent ?? contract?.rentAmount ?? null;
  const payments = sortPaymentsByDate(input.payments);
  const failedPayment = payments.find((payment) => payment.status === "failed") ?? null;
  const overduePayment =
    payments.find((payment) => isPaymentOverdue(payment, now)) ?? null;
  const nextPayment =
    [...payments]
      .filter((payment) => isPaymentUpcoming(payment, now))
      .sort((left, right) => getDateValue(left.date) - getDateValue(right.date))[0] ?? null;
  const currentMonthPaidPayment =
    payments.find((payment) => isPaidThisMonth(payment, now)) ?? null;
  const latestPaidPayment =
    payments.find((payment) => payment.status === "paid") ?? null;
  const retryPendingApproval = Boolean(input.retryRequest || input.user.pendingPaymentRetry);
  const daysUntilContractEnd = contract ? diffInDays(now, parseDate(contract.endDate)) : null;
  const contractEndingSoon = shouldShowRenewalBanner(contract, now);
  const daysUntilNextPayment = nextPayment ? diffInDays(now, parseDate(nextPayment.date)) : null;
  const pageState = getPageState(input);

  return {
    address,
    contract,
    rentAmount,
    failedPayment,
    overduePayment,
    nextPayment,
    currentMonthPaidPayment,
    latestPaidPayment,
    retryPendingApproval,
    contractEndingSoon,
    daysUntilContractEnd,
    daysUntilNextPayment,
    pageState,
  };
}

function getPageState(input: TenantDashboardInput): TenantDashboardViewModel["pageState"] {
  if (input.isLoading) return "loading";
  if (input.hasError) return "error";

  const hasCoreData =
    Boolean(input.property) ||
    input.contracts.length > 0 ||
    input.payments.length > 0 ||
    input.serviceCalls.length > 0;

  return hasCoreData ? "ready" : "empty";
}

function buildHero(
  state: TenantHeroState,
  facts: DashboardFacts,
  input: TenantDashboardInput,
  now: Date,
): TenantHeroViewModel {
  const amountValue = formatCurrency(
    facts.failedPayment?.amount ??
      facts.overduePayment?.amount ??
      facts.nextPayment?.amount ??
      facts.currentMonthPaidPayment?.amount ??
      facts.latestPaidPayment?.amount ??
      facts.rentAmount ??
      0,
  );

  const meta = [
    { label: "נכס", value: facts.address },
    {
      label: "חוזה",
      value: facts.contract?.endDate
        ? `עד ${formatDateLabel(facts.contract.endDate)}`
        : "טרם נקבע מועד סיום",
    },
  ];

  switch (state) {
    case "loading":
      return {
        state,
        badge: "טוען נתוני דייר",
        title: "מכינים עבורך את תמונת המצב",
        description: "המערכת אוספת כרגע את פרטי התשלומים, החוזה והתחזוקה.",
        amountLabel: "שכר דירה חודשי",
        amountValue,
        meta,
      };
    case "error":
      return {
        state,
        badge: "נדרש רענון",
        title: "לא הצלחנו לטעון את הדשבורד",
        description: "אפשר לנסות שוב בעוד רגע. אם זה נמשך, פנה לתמיכה מתוך ההודעות.",
        amountLabel: "שכר דירה חודשי",
        amountValue,
        primaryActionLabel: "פתח הודעות",
        primaryAction: "openMessages",
        meta,
      };
    case "empty":
      return {
        state,
        badge: "ממתין להפעלה",
        title: "עדיין אין נתוני שכירות להצגה",
        description: "ברגע שהחוזה והתשלומים יחוברו לחשבון, הכול יופיע כאן בצורה מסודרת.",
        amountLabel: "שכר דירה חודשי",
        amountValue,
        primaryActionLabel: "צפה במסמכים",
        primaryAction: "openContracts",
        meta,
      };
    case "onboarding":
      return {
        state,
        badge: "השלמה נדרשת",
        title: "נשארו כמה פרטים כדי להפעיל את הדירה",
        description:
          "השלם את שלבי הזיהוי, ההרשאה לחיוב והמסמכים כדי שנוכל להפעיל את החוזה והגבייה בצורה מלאה.",
        amountLabel: "דמי שכירות שיפעלו לאחר השלמה",
        amountValue,
        primaryActionLabel: "המשך השלמת רישום",
        primaryAction: "openOnboarding",
        secondaryActionLabel: "למסמכי החוזה",
        secondaryAction: "openContracts",
        meta,
      };
    case "retryPendingApproval":
      return {
        state,
        badge: "ממתין לאישור",
        title: "בקשת ניסיון החיוב החוזר נקלטה",
        description:
          input.retryRequest?.preferredRetryDate
            ? `נבדוק את הבקשה ונעדכן אותך לגבי החיוב החוזר בתאריך ${formatDateLabel(
                input.retryRequest.preferredRetryDate,
              )}.`
            : "הבקשה ממתינה לאישור ונעדכן אותך ברגע שתאושר.",
        amountLabel: "סכום בבקשת החיוב",
        amountValue,
        primaryActionLabel: "למסך תשלומים",
        primaryAction: "openPayments",
        meta,
      };
    case "failed":
      return {
        state,
        badge: "נדרשת פעולה",
        title: "החיוב האחרון לא עבר",
        description:
          facts.failedPayment?.failureReason
            ? `סיבת הדחייה המעודכנת: ${facts.failedPayment.failureReason}. אפשר לבקש ניסיון חוזר בתאריך שנוח לך.`
            : "אפשר לבחור סיבה, להוסיף הערה ולקבוע ניסיון חיוב חוזר מול הצוות.",
        amountLabel: "סכום שלא נגבה",
        amountValue,
        primaryActionLabel: "תיאום ניסיון חיוב חוזר",
        primaryAction: "openRetryFlow",
        secondaryActionLabel: "לפרטי תשלומים",
        secondaryAction: "openPayments",
        meta,
      };
    case "overdue":
      return {
        state,
        badge: "תשלום באיחור",
        title: "יש יתרה פתוחה לטיפול",
        description:
          facts.overduePayment?.date
            ? `מועד החיוב המקורי היה ${formatDateLabel(
                facts.overduePayment.date,
              )}. מומלץ להסדיר עכשיו כדי למנוע עיכובים נוספים.`
            : "מומלץ להסדיר את היתרה הפתוחה בהקדם.",
        amountLabel: "יתרה פתוחה",
        amountValue,
        primaryActionLabel: "תיאום ניסיון חיוב חוזר",
        primaryAction: "openRetryFlow",
        secondaryActionLabel: "לפרטי תשלומים",
        secondaryAction: "openPayments",
        meta,
      };
    case "dueSoon":
      return {
        state,
        badge: "קרוב לחיוב",
        title: "החיוב הקרוב מתקרב",
        description:
          facts.nextPayment?.date
            ? `החיוב הבא יבוצע ב-${formatDateLabel(
                facts.nextPayment.date,
              )}. שווה לוודא שיש יתרה מספקת ושפרטי החיוב מעודכנים.`
            : "החיוב הבא צפוי בימים הקרובים.",
        amountLabel: "סכום לחיוב",
        amountValue,
        primaryActionLabel: "בדיקת פרטי תשלום",
        primaryAction: "openPayments",
        secondaryActionLabel: "לחוזה",
        secondaryAction: "openContracts",
        meta,
      };
    case "paid":
      return {
        state,
        badge: "שולם בהצלחה",
        title: "התשלום הנוכחי תקין",
        description:
          facts.currentMonthPaidPayment?.date
            ? `התשלום האחרון נקלט ב-${formatDateLabel(
                facts.currentMonthPaidPayment.date,
              )} והכול נראה תקין.`
            : "התשלום האחרון נקלט בהצלחה ואין כרגע פעולה דחופה.",
        amountLabel: "סכום ששולם",
        amountValue,
        primaryActionLabel: "לארכיון תשלומים",
        primaryAction: "openPayments",
        secondaryActionLabel: "למסמכים",
        secondaryAction: "openContracts",
        meta,
      };
    case "scheduled":
    default:
      return {
        state: "scheduled",
        badge: "מתוזמן אוטומטית",
        title: "התשלום הבא כבר מתוזמן",
        description:
          facts.nextPayment?.date
            ? `החיוב הבא צפוי ל-${formatDateLabel(
                facts.nextPayment.date,
              )}. אין כרגע פעולה דחופה, רק מעקב שוטף.`
            : `החיוב הבא יבוצע כרגיל במהלך ${formatMonthLabel(now)}.`,
        amountLabel: "סכום לחיוב",
        amountValue,
        primaryActionLabel: "לפרטי תשלומים",
        primaryAction: "openPayments",
        secondaryActionLabel: "למסמכי החוזה",
        secondaryAction: "openContracts",
        meta,
      };
  }
}

function buildAlerts(
  heroState: TenantHeroState,
  facts: DashboardFacts,
  input: TenantDashboardInput,
  now: Date,
): TenantAlert[] {
  const alerts: TenantAlert[] = [];

  if (!input.user.onboardingComplete) {
    alerts.push({
      id: "onboarding",
      priority: 80,
      tone: "warning",
      title: "החשבון עדיין לא הושלם",
      description:
        "עד שלא נסיים את שלבי הזיהוי וההרשאה לחיוב, חלק מהפעולות והמסמכים יוצגו באופן חלקי.",
      actionLabel: "להשלמת הרישום",
      action: "openOnboarding",
    });
  }

  if (heroState === "failed") {
    alerts.push({
      id: "payment-failed",
      priority: 100,
      tone: "critical",
      title: "החיוב האחרון נכשל",
      description: "אפשר לבקש ניסיון חוזר ולצרף הערה כדי שהצוות ידע איך לטפל במקרה.",
      actionLabel: "לטיפול עכשיו",
      action: "openRetryFlow",
    });
  }

  if (heroState === "overdue") {
    alerts.push({
      id: "payment-overdue",
      priority: 90,
      tone: "critical",
      title: "קיימת יתרה פתוחה",
      description: "התשלום עבר את מועדו ועדיין לא הוסדר. מומלץ לבחור תאריך חדש לחיוב.",
      actionLabel: "הסדרת תשלום",
      action: "openRetryFlow",
    });
  }

  if (heroState === "retryPendingApproval") {
    alerts.push({
      id: "retry-pending",
      priority: 85,
      tone: "info",
      title: "בקשת ניסיון החיוב החוזר ממתינה לאישור",
      description:
        input.retryRequest?.preferredRetryDate
          ? `העדכון האחרון: הוגשה בקשה לחיוב חוזר ב-${formatDateLabel(
              input.retryRequest.preferredRetryDate,
            )}.`
          : "הבקשה נקלטה ואנחנו ממתינים לאישור המשך טיפול.",
      actionLabel: "לפרטי תשלומים",
      action: "openPayments",
    });
  }

  if (facts.contractEndingSoon && facts.daysUntilContractEnd !== null) {
    alerts.push({
      id: "contract-ending",
      priority: 60,
      tone: "warning",
      title: "החוזה מתקרב לסיום",
      description: `נותרו ${facts.daysUntilContractEnd} ימים עד סיום החוזה. כדאי לעבור על מסמכי החידוש והערבויות.`,
      actionLabel: "למסמכי החוזה",
      action: "openContracts",
    });
  }

  if (
    facts.nextPayment &&
    facts.daysUntilNextPayment !== null &&
    facts.daysUntilNextPayment >= 0 &&
    facts.daysUntilNextPayment <= 5
  ) {
    alerts.push({
      id: "payment-due-soon",
      priority: 40,
      tone: "info",
      title: "החיוב הבא קרוב",
      description: `החיוב הבא מתוזמן ל-${formatDateLabel(
        facts.nextPayment.date,
      )}. זה זמן טוב לוודא שהכול מעודכן.`,
      actionLabel: "לפרטי תשלום",
      action: "openPayments",
    });
  }

  return alerts.sort((left, right) => right.priority - left.priority);
}

function buildStatusPill(
  heroState: TenantHeroState,
): TenantDashboardViewModel["statusPill"] {
  switch (heroState) {
    case "failed":
    case "overdue":
      return { label: "נדרשת פעולה", tone: "critical" };
    case "retryPendingApproval":
      return { label: "ממתין לאישור", tone: "info" };
    case "dueSoon":
    case "onboarding":
      return { label: "דורש תשומת לב", tone: "warning" };
    case "paid":
      return { label: "תקין", tone: "success" };
    default:
      return { label: "בשליטה", tone: "info" };
  }
}

function buildSummaryCard(
  facts: DashboardFacts,
  input: TenantDashboardInput,
): TenantSummaryCard {
  return {
    address: facts.address,
    statusLabel: facts.contract?.status === "active" ? "חוזה פעיל" : "סטטוס חוזה חלקי",
    metrics: [
      {
        label: "שכר דירה חודשי",
        value: formatCurrency(facts.rentAmount ?? 0),
      },
      {
        label: "סיום חוזה",
        value: facts.contract?.endDate
          ? formatDateLabel(facts.contract.endDate)
          : "טרם עודכן",
      },
      {
        label: "אמצעי תשלום",
        value: input.user.onboardingComplete ? "חיוב אוטומטי מאומת" : "ממתין להשלמה",
      },
    ],
  };
}

function buildQuickActions(input: TenantDashboardInput): TenantQuickAction[] {
  const openCalls = input.serviceCalls.filter((call) => call.status !== "resolved" && call.status !== "closed").length;

  return [
    {
      id: "maintenance",
      label: "תחזוקה",
      description: "פתיחת תקלה ומעקב",
      badge: openCalls > 0 ? `${openCalls}` : undefined,
    },
    {
      id: "messages",
      label: "הודעות",
      description: "שיחות ותמיכה",
    },
    {
      id: "contracts",
      label: "מסמכים",
      description: "חוזה, ערבויות ואישורים",
    },
    {
      id: "payments",
      label: "תשלומים",
      description: "היסטוריה וסטטוס חיובים",
    },
  ];
}

function buildDocuments(
  facts: DashboardFacts,
  input: TenantDashboardInput,
): TenantDocumentRow[] {
  const contractStatus = facts.contract
    ? facts.contract.status === "active"
      ? "חוזה פעיל וזמין לעיון"
      : "טיוטת חוזה/מסמך ממתינה להשלמה"
    : "טרם הוזן חוזה לחשבון";

  return [
    {
      id: "lease",
      label: "חוזה שכירות",
      status: contractStatus,
      emphasis: facts.contract ? "success" : "warning",
      actionLabel: "למסמכים",
      action: "openContracts",
    },
    {
      id: "direct-debit",
      label: "אישור הרשאה לחיוב",
      status: input.user.onboardingComplete ? "ההרשאה התקבלה" : "נדרש להשלים הרשאה",
      emphasis: input.user.onboardingComplete ? "success" : "warning",
      actionLabel: input.user.onboardingComplete ? "למסמכים" : "להשלמה",
      action: input.user.onboardingComplete ? "openContracts" : "openOnboarding",
    },
    {
      id: "guarantee",
      label: "ערבות / ביטוח",
      status: facts.contract?.guaranteeType
        ? `סוג ערבות: ${mapGuaranteeType(facts.contract.guaranteeType)}`
        : "פרטי הערבות יוצגו כאן",
      emphasis: facts.contract?.guaranteeType ? "default" : "warning",
      actionLabel: "לפרטים",
      action: "openContracts",
    },
  ];
}

function buildNextSteps(
  heroState: TenantHeroState,
  facts: DashboardFacts,
): TenantNextStep[] {
  const commonSteps: TenantNextStep[] = [
    {
      id: "maintenance",
      title: "צריך לדווח על תקלה?",
      description: "אפשר לפתוח קריאה חדשה או לעקוב אחרי קריאות פתוחות ממסך התחזוקה.",
      actionLabel: "לתחזוקה",
      action: "openMaintenance",
    },
  ];

  switch (heroState) {
    case "onboarding":
      return [
        {
          id: "onboarding",
          title: "השלמת זיהוי והרשאה לחיוב",
          description: "זה השלב שיפתח עבורך את החוזה, המסמכים והחיובים האוטומטיים.",
          actionLabel: "להמשך רישום",
          action: "openOnboarding",
        },
        ...commonSteps,
      ];
    case "failed":
    case "overdue":
      return [
        {
          id: "retry",
          title: "בחירת מועד חלופי לחיוב",
          description: "תוכל לציין סיבה, הערה ותאריך מועדף כדי שנוכל לטפל במהירות.",
          actionLabel: "לבקשת חיוב חוזר",
          action: "openRetryFlow",
        },
        {
          id: "payments",
          title: "בדיקת פרטי החיוב",
          description: "כדאי לעבור על היסטוריית החיובים והסטטוס המעודכן של התשלום האחרון.",
          actionLabel: "למסך תשלומים",
          action: "openPayments",
        },
      ];
    case "retryPendingApproval":
      return [
        {
          id: "pending",
          title: "ממתינים לאישור בקשה",
          description: "אין צורך לפתוח בקשה נוספת כרגע. נעדכן אותך ברגע שתהיה התקדמות.",
          actionLabel: "לפרטי תשלום",
          action: "openPayments",
        },
        ...commonSteps,
      ];
    case "dueSoon":
      return [
        {
          id: "prepare",
          title: "בדיקת יתרה ופרטי תשלום",
          description: "כך אפשר לוודא שהחיוב הקרוב יעבור בצורה חלקה.",
          actionLabel: "לפרטי תשלום",
          action: "openPayments",
        },
        ...commonSteps,
      ];
    default:
      return [
        {
          id: "documents",
          title: "כל המסמכים במקום אחד",
          description: "החוזה, הערבויות והאישורים מרוכזים במסך המסמכים.",
          actionLabel: "למסמכים",
          action: "openContracts",
        },
        ...commonSteps,
      ];
  }
}

function buildRenewalBanner(facts: DashboardFacts): TenantRenewalBanner | null {
  if (!facts.contractEndingSoon || facts.daysUntilContractEnd === null) {
    return null;
  }

  return {
    title: "החוזה מתקרב לסיום",
    description: `נותרו ${facts.daysUntilContractEnd} ימים עד לתאריך הסיום. מומלץ לעבור על פרטי החידוש והמסמכים.`,
    actionLabel: "למסמכי החוזה",
    action: "openContracts",
  };
}

function pickPrimaryContract(contracts: Contract[], now: Date): Contract | null {
  if (contracts.length === 0) return null;

  const prioritizedStatuses = ["active", "waiting_signature", "pending", "waiting_bank_auth"];

  return [...contracts].sort((left, right) => {
    const leftStatusRank = prioritizedStatuses.indexOf(left.status);
    const rightStatusRank = prioritizedStatuses.indexOf(right.status);

    if (leftStatusRank !== rightStatusRank) {
      const normalizedLeft = leftStatusRank === -1 ? Number.MAX_SAFE_INTEGER : leftStatusRank;
      const normalizedRight = rightStatusRank === -1 ? Number.MAX_SAFE_INTEGER : rightStatusRank;
      return normalizedLeft - normalizedRight;
    }

    const leftDiff = Math.abs(diffInDays(now, parseDate(left.endDate)));
    const rightDiff = Math.abs(diffInDays(now, parseDate(right.endDate)));
    return leftDiff - rightDiff;
  })[0];
}

function sortPaymentsByDate(payments: Payment[]): Payment[] {
  return [...payments].sort((left, right) => getDateValue(right.date) - getDateValue(left.date));
}

function sortServiceCallsByDate(calls: ServiceCall[]): ServiceCall[] {
  return [...calls].sort(
    (left, right) => getTimestampValue(right.createdAt) - getTimestampValue(left.createdAt),
  );
}

function isPaymentUpcoming(payment: Payment, now: Date): boolean {
  if (!["pending", "deferred"].includes(payment.status)) return false;
  const paymentDate = parseDate(payment.date);
  if (!paymentDate) return false;
  return diffInDays(now, paymentDate) >= 0;
}

function isPaymentOverdue(payment: Payment, now: Date): boolean {
  if (payment.status === "late") return true;
  if (!["pending", "deferred"].includes(payment.status)) return false;
  const paymentDate = parseDate(payment.date);
  if (!paymentDate) return false;
  return diffInDays(now, paymentDate) < 0;
}

function isPaidThisMonth(payment: Payment, now: Date): boolean {
  const paymentDate = parseDate(payment.date);
  if (!paymentDate || payment.status !== "paid") return false;
  return (
    paymentDate.getMonth() === now.getMonth() &&
    paymentDate.getFullYear() === now.getFullYear()
  );
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffInDays(from: Date, to: Date | null): number {
  if (!to) return Number.MAX_SAFE_INTEGER;
  const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toStart = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((toStart - fromStart) / DAY_IN_MS);
}

function getDateValue(value: string | null | undefined): number {
  return parseDate(value)?.getTime() ?? 0;
}

function getTimestampValue(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value && typeof value === "object") {
    if ("seconds" in value && typeof (value as { seconds?: unknown }).seconds === "number") {
      return ((value as { seconds: number }).seconds ?? 0) * 1000;
    }
    if (
      "toDate" in value &&
      typeof (value as { toDate?: () => Date }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
  }
  return 0;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateLabel(value: string): string {
  const parsed = parseDate(value);
  if (!parsed) return "טרם עודכן";

  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
  }).format(parsed);
}

function formatMonthLabel(value: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function mapGuaranteeType(value: Contract["guaranteeType"]): string {
  switch (value) {
    case "bank":
      return "ערבות בנקאית";
    case "cash":
      return "פיקדון";
    case "insurance":
      return "ביטוח";
    case "promissory":
      return "שטר חוב";
    default:
      return "לא הוגדר";
  }
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function formatInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
