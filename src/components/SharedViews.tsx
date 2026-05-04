import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Filter,
  FolderOpen,
  Home,
  Info,
  Landmark,
  Mail,
  MessageSquare,
  MoreVertical,
  Plus,
  Receipt,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  Contract,
  DocumentRecord,
  MessageTopic,
  Payment,
  Property,
  User,
} from "../types";
import {
  getDocumentsForOwner,
  getMessagesForTopic,
  getTopicCounterparty,
  getTopicsForUser,
  useAppData,
} from "../lib/appData";
import { BRAND_NAME } from "../lib/brand";
import AdminPaymentsView from "./AdminPaymentsView";

const moneyFormatter = new Intl.NumberFormat("he-IL");
const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatCurrency(value: number) {
  return `₪${moneyFormatter.format(value)}`;
}

function formatDate(value?: string) {
  if (!value) return "ללא תאריך";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function getPaymentStatusLabel(status: Payment["status"]) {
  switch (status) {
    case "paid":
      return "שולם";
    case "pending":
      return "ממתין";
    case "failed":
      return "נכשל";
    case "late":
      return "בפיגור";
    case "deferred":
      return "נדחה";
    default:
      return status;
  }
}

function getPaymentStatusClasses(status: Payment["status"]) {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "pending":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "failed":
      return "bg-rose-50 text-rose-700 border-rose-100";
    case "late":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "deferred":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function getDocumentStatusLabel(status: DocumentRecord["status"]) {
  switch (status) {
    case "ready":
      return "מוכן";
    case "pending":
      return "ממתין";
    case "missing":
      return "חסר";
    default:
      return status;
  }
}

function getDocumentStatusClasses(status: DocumentRecord["status"]) {
  switch (status) {
    case "ready":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "missing":
      return "bg-rose-50 text-rose-700 border-rose-100";
    default:
      return "bg-slate-50 text-slate-700 border-slate-100";
  }
}

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group/info relative inline-block mx-2 align-middle">
      <span className="relative">
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-400 shadow-sm transition-colors hover:text-slate-900"
        >
          <Info size={11} />
        </button>
        <span className="pointer-events-none absolute left-1/2 bottom-full mb-3 z-[100] w-64 -translate-x-1/2 rounded-2xl bg-slate-950 px-4 py-3 text-right text-[11px] font-bold leading-5 text-white opacity-0 shadow-2xl transition-all group-hover/info:opacity-100">
          {text}
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-950"></span>
        </span>
      </span>
    </span>
  );
}

function getTopicTypeLabel(type: MessageTopic["type"]) {
  switch (type) {
    case "maintenance":
      return "תחזוקה";
    case "payment_retry":
      return "חיוב חוזר";
    case "support":
      return "תמיכה";
    case "general":
    default:
      return "כללי";
  }
}

/**
 * PaymentsManagement
 */
export function PaymentsManagement({ user }: { user: User }) {
  const { db, createDebtLetter } = useAppData();
  const [activeFilter, setActiveFilter] = useState<"all" | Payment["status"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showManualPay, setShowManualPay] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  if (user.role === "admin") {
    return <AdminPaymentsView user={user} />;
  }

  const payments = useMemo(() => {
    const scopedPayments = db.payments.filter((payment) =>
      user.role === "landlord"
        ? payment.landlordId === user.id
        : payment.tenantId === user.id,
    );

    return [...scopedPayments].sort(
      (left, right) => Date.parse(right.date) - Date.parse(left.date),
    );
  }, [db.payments, user.id, user.role]);

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        const matchesFilter = activeFilter === "all" || payment.status === activeFilter;
        const haystack = [
          payment.propertyAddress,
          payment.tenantName,
          payment.id,
          payment.type,
          payment.failureReason,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchesFilter && (!deferredQuery || haystack.includes(deferredQuery));
      }),
    [activeFilter, deferredQuery, payments],
  );

  const utilityCharges = useMemo(
    () =>
      [...db.utilityCharges]
        .filter((utility) =>
          user.role === "landlord"
            ? utility.landlordId === user.id
            : utility.tenantId === user.id,
        )
        .sort((left, right) => Date.parse(left.dueDate) - Date.parse(right.dueDate)),
    [db.utilityCharges, user.id, user.role],
  );

  const visibleTransfers = useMemo(
    () =>
      db.transfers
        .filter((transfer) =>
          user.role === "landlord" ? transfer.landlordId === user.id : true,
        )
        .slice(0, 4),
    [db.transfers, user.id, user.role],
  );

  const visibleInvoices = useMemo(
    () =>
      [...db.invoices]
        .filter((invoice) => invoice.userId === user.id)
        .sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt))
        .slice(0, 4),
    [db.invoices, user.id],
  );

  const stats = useMemo(() => {
    const paid = payments
      .filter((payment) => payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const pending = payments
      .filter((payment) => payment.status === "pending")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const risk = payments
      .filter((payment) => payment.status === "failed" || payment.status === "late")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const utilities = utilityCharges.reduce((sum, charge) => sum + charge.amount, 0);

    return { paid, pending, risk, utilities };
  }, [payments, utilityCharges]);

  const handleExport = () => {
    alert("דוח גבייה והיסטוריית תשלומים מוכן לייצוא מה־proxy DB.");
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-5 duration-700 text-right" dir="rtl">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic font-display">
            {user.role === "landlord" ? "מרכז גבייה ותזרים" : "תשלומים וחיובים"}
          </h1>
          <p className="mt-3 text-[13px] font-bold tracking-[0.1em] text-slate-400">
            שכר דירה, חשבונות, קנסות, חיובים חוזרים והיסטוריית אסמכתאות במקום אחד
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <FilterTab
              active={activeFilter === "all"}
              label="הכל"
              onClick={() => setActiveFilter("all")}
            />
            <FilterTab
              active={activeFilter === "paid"}
              label="שולם"
              onClick={() => setActiveFilter("paid")}
            />
            <FilterTab
              active={activeFilter === "pending"}
              label="ממתין"
              onClick={() => setActiveFilter("pending")}
            />
            <FilterTab
              active={activeFilter === "failed"}
              label="נכשל"
              onClick={() => setActiveFilter("failed")}
            />
          </div>

          {user.role === "landlord" && (
            <button
              onClick={() => setShowManualPay(true)}
              className="rounded-[20px] bg-slate-900 px-7 py-4 text-[13px] font-black tracking-[0.12em] text-white shadow-xl transition-all hover:bg-black active:scale-95"
            >
              גבייה ידנית
            </button>
          )}

          <button
            onClick={handleExport}
            className="rounded-[20px] border border-slate-200 bg-white px-7 py-4 text-[13px] font-black tracking-[0.12em] text-slate-900 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
          >
            ייצוא דוח
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={<Wallet size={20} />}
          label="נגבה בהצלחה"
          value={formatCurrency(stats.paid)}
          helper="תקבולים שנכנסו למערכת"
          tone="slate"
        />
        <MetricTile
          icon={<Clock size={20} />}
          label="בהמתנה"
          value={formatCurrency(stats.pending)}
          helper="תשלומים פתוחים לטיפול"
          tone="blue"
        />
        <MetricTile
          icon={<AlertCircle size={20} />}
          label="בסיכון / פיגור"
          value={formatCurrency(stats.risk)}
          helper="פריטים שדורשים פעולה עכשיו"
          tone="rose"
        />
        <MetricTile
          icon={<Receipt size={20} />}
          label="חיובי שירות וחשבונות"
          value={formatCurrency(stats.utilities)}
          helper="הוצאות נלוות וחיובים משלימים"
          tone="amber"
        />
      </div>

      {showManualPay && (
        <ManualPaymentModal user={user} onClose={() => setShowManualPay(false)} />
      )}

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="dashboard-card overflow-hidden border-slate-100 shadow-sleek">
            <div className="border-b border-slate-100 bg-slate-50/60 p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">רשימת תשלומים פעילים</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    כל החיובים הפעילים וההיסטוריים לפי סטטוס, תאריך וסוג חיוב
                  </p>
                </div>

                <div className="relative w-full md:max-w-sm">
                  <Search
                    size={18}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="חיפוש לפי נכס, מזהה או דייר"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-5 pr-11 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 md:p-6">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => {
                  const hasLegalCase = db.legalCases.some(
                    (legalCase) => legalCase.paymentId === payment.id,
                  );

                  return (
                    <div
                      key={payment.id}
                      className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-slate-200 hover:shadow-lg"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-900">
                            <CreditCard size={24} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-lg font-black text-slate-900">
                                {payment.propertyAddress || payment.propertyId}
                              </p>
                              <span
                                className={cn(
                                  "inline-flex rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.12em]",
                                  getPaymentStatusClasses(payment.status),
                                )}
                              >
                                {getPaymentStatusLabel(payment.status)}
                              </span>
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black tracking-[0.12em] text-slate-500">
                                {payment.type === "rent"
                                  ? "שכר דירה"
                                  : payment.type === "utility"
                                    ? "חשבון"
                                    : payment.type === "deposit"
                                      ? "פיקדון"
                                      : payment.type === "fine"
                                        ? "קנס"
                                        : "עמלה"}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400">
                              <span>{payment.tenantName || "ללא דייר משויך"}</span>
                              <span className="h-1 w-1 rounded-full bg-slate-200" />
                              <span>{formatDate(payment.date)}</span>
                              {payment.failureReason && (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-slate-200" />
                                  <span>סיבה: {payment.failureReason}</span>
                                </>
                              )}
                            </div>

                            {payment.expectedRetryDate && (
                              <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                                ניסיון חיוב חוזר מתוכנן ל־{formatDate(payment.expectedRetryDate)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-4 lg:items-end">
                          <p className="text-3xl font-black tracking-tighter text-slate-900 font-display">
                            {formatCurrency(payment.amount)}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {(payment.status === "failed" || payment.status === "late") &&
                              user.role === "landlord" &&
                              !hasLegalCase && (
                                <button
                                  onClick={() => createDebtLetter(payment.id)}
                                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 transition-all hover:bg-rose-100"
                                >
                                  הפק מכתב התראה
                                </button>
                              )}

                            <button
                              onClick={() =>
                                alert(
                                  `אסמכתא עבור ${payment.id} מוכנה לצפייה ב־JSON DB.`,
                                )
                              }
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition-all hover:bg-slate-50"
                            >
                              פתח פירוט
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={<Search size={30} />}
                  title="לא נמצאו תשלומים"
                  description="נסה לשנות את הסינון או להרחיב את מונח החיפוש."
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <SidePanel
            title={user.role === "landlord" ? "העברות ואסמכתאות" : "חיובי שירות קרובים"}
            subtitle={
              user.role === "landlord"
                ? "הכסף שעבר לחשבון המשכיר והאסמכתאות התואמות"
                : "ארנונה, חשמל ושירותים שנוספו לחוזה"
            }
            icon={user.role === "landlord" ? <Landmark size={20} /> : <Receipt size={20} />}
          >
            <div className="space-y-4">
              {(user.role === "landlord" ? visibleTransfers : utilityCharges.slice(0, 4)).map(
                (item) => {
                  if ("proofLabel" in item) {
                    const relatedPayment = db.payments.find(
                      (payment) => payment.id === item.paymentId,
                    );

                    return (
                      <MiniRow
                        key={item.id}
                        title={relatedPayment?.propertyAddress || item.propertyId}
                        subtitle={`${formatDate(item.transferDate)} • ${item.proofLabel}`}
                        value={formatCurrency(item.amount)}
                      />
                    );
                  }

                  return (
                    <MiniRow
                      key={item.id}
                      title={item.label}
                      subtitle={`${item.provider} • עד ${formatDate(item.dueDate)}`}
                      value={formatCurrency(item.amount)}
                    />
                  );
                },
              )}

              {user.role !== "landlord" && utilityCharges.length === 0 && (
                <EmptyInline label="אין כרגע חיובי שירות פתוחים." />
              )}
              {user.role === "landlord" && visibleTransfers.length === 0 && (
                <EmptyInline label="אין עדיין העברות מתועדות." />
              )}
            </div>
          </SidePanel>

          <SidePanel
            title="חשבוניות ומסמכי חיוב"
            subtitle="פלטפורמה, חיובי שירות ואסמכתאות תשלום"
            icon={<FileText size={20} />}
          >
            <div className="space-y-4">
              {visibleInvoices.length > 0 ? (
                visibleInvoices.map((invoice) => (
                  <MiniRow
                    key={invoice.id}
                    title={invoice.recipientName}
                    subtitle={`${invoice.kind === "platform_fee" ? "עמלת פלטפורמה" : invoice.kind === "utility" ? "חיוב שירות" : "חיוב ידני"} • ${formatDate(invoice.issuedAt)}`}
                    value={formatCurrency(invoice.amount)}
                  />
                ))
              ) : (
                <EmptyInline label="אין חשבוניות חדשות להצגה." />
              )}
            </div>
          </SidePanel>
        </div>
      </div>
    </div>
  );
}

/**
 * PropertyCondition
 */
export function PropertyCondition({ user }: { user: User }) {
  const { db } = useAppData();

  const scopedProperties = useMemo(() => {
    if (user.role === "admin") return db.properties;
    if (user.role === "landlord") {
      return db.properties.filter((property) => property.landlordId === user.id);
    }
    return db.properties.filter((property) => property.tenantId === user.id);
  }, [db.properties, user.id, user.role]);

  const scopedContracts = useMemo(() => {
    if (user.role === "admin") return db.contracts;
    if (user.role === "landlord") {
      return db.contracts.filter((contract) => contract.landlordId === user.id);
    }
    return db.contracts.filter((contract) => contract.tenantId === user.id);
  }, [db.contracts, user.id, user.role]);

  const documentIds = useMemo(() => {
    const documents = scopedContracts.flatMap((contract) =>
      getDocumentsForOwner(db, "contract", contract.id),
    );
    const propertyDocuments = scopedProperties.flatMap((property) =>
      getDocumentsForOwner(db, "property", property.id),
    );
    const legalDocuments =
      user.role === "tenant"
        ? []
        : db.legalCases
            .filter((legalCase) =>
              user.role === "admin" ? true : legalCase.landlordId === user.id,
            )
            .flatMap((legalCase) => getDocumentsForOwner(db, "legal_case", legalCase.id));

    return [...documents, ...propertyDocuments, ...legalDocuments].sort((left, right) =>
      `${right.uploadedAt || ""}`.localeCompare(left.uploadedAt || ""),
    );
  }, [db, scopedContracts, scopedProperties, user.id, user.role]);

  const invoices = useMemo(() => {
    if (user.role === "admin") return db.invoices;
    return db.invoices.filter((invoice) => invoice.userId === user.id);
  }, [db.invoices, user.id, user.role]);

  const legalCases = useMemo(() => {
    if (user.role === "tenant") {
      return db.legalCases.filter((legalCase) => legalCase.tenantId === user.id);
    }
    if (user.role === "landlord") {
      return db.legalCases.filter((legalCase) => legalCase.landlordId === user.id);
    }
    return db.legalCases;
  }, [db.legalCases, user.id, user.role]);

  const readyDocuments = documentIds.filter((document) => document.status === "ready").length;
  const missingDocuments = documentIds.filter((document) => document.status !== "ready").length;

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-5 duration-700 text-right" dir="rtl">
      <div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic font-display">
          מסמכים, חוזים וארכיון נכס
        </h1>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          תבניות חוזה, חתימות דיגיטליות, מסמכי כניסה לנכס, חשבוניות ומעקב משפטי
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={<FolderOpen size={20} />}
          label="מסמכים מוכנים"
          value={readyDocuments.toString()}
          helper="קבצים זמינים להורדה או חתימה"
          tone="emerald"
        />
        <MetricTile
          icon={<AlertCircle size={20} />}
          label="מסמכים פתוחים"
          value={missingDocuments.toString()}
          helper="טיוטות, חוסרים או מסמכים שמחכים לפעולה"
          tone="amber"
        />
        <MetricTile
          icon={<Sparkles size={20} />}
          label="תבניות חוזה"
          value={db.contractTemplates.length.toString()}
          helper="כולל split payments ונספחי ערבות"
          tone="blue"
        />
        <MetricTile
          icon={<Scale size={20} />}
          label="מעקב משפטי"
          value={legalCases.length.toString()}
          helper="מכתבי התראה ותיקי גבייה"
          tone="rose"
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <SidePanel
            title="ארכיון מסמכים"
            subtitle="כל המסמכים הזמינים לפי נכס, חוזה או הליך"
            icon={<FileText size={20} />}
          >
            <div className="space-y-4">
              {documentIds.length > 0 ? (
                documentIds.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-4 rounded-[24px] border border-slate-100 bg-white p-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-base font-black text-slate-900">{document.label}</p>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.12em]",
                            getDocumentStatusClasses(document.status),
                          )}
                        >
                          {getDocumentStatusLabel(document.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {document.category} • {document.ownerType} •
                        {" "}
                        {document.uploadedAt ? formatDate(document.uploadedAt) : "טרם הועלה"}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        alert(
                          document.url
                            ? `המסמך זמין בנתיב ${document.url}`
                            : "המסמך קיים ב־JSON DB ויופיע להורדה לאחר העלאה.",
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition-all hover:bg-slate-50"
                    >
                      <Download size={15} />
                      <span>פתח מסמך</span>
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={<FolderOpen size={30} />}
                  title="אין מסמכים להצגה"
                  description="המסמכים יופיעו כאן ברגע שיתווספו לחוזה, לנכס או לתיק הגבייה."
                />
              )}
            </div>
          </SidePanel>

          <SidePanel
            title="נכסים וחוזים"
            subtitle="תמונת מצב של הנכסים הפעילים והחוזים המשויכים"
            icon={<Home size={20} />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {scopedProperties.map((property) => {
                const propertyContracts = scopedContracts.filter(
                  (contract) => contract.propertyId === property.id,
                );
                const propertyDocs = getDocumentsForOwner(db, "property", property.id);

                return (
                  <div
                    key={property.id}
                    className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-5"
                  >
                    <p className="text-lg font-black text-slate-900">{property.address}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      {property.rooms || "-"} חדרים • {property.sizeSqm || "-"} מ"ר •
                      {" "}
                      {formatCurrency(property.rent)}
                    </p>

                    <div className="mt-4 space-y-3">
                      <MiniPill label="סטטוס נכס" value={property.status} />
                      <MiniPill
                        label="חוזים משויכים"
                        value={propertyContracts.length.toString()}
                      />
                      <MiniPill
                        label="מסמכי נכס"
                        value={propertyDocs.length.toString()}
                      />
                    </div>
                  </div>
                );
              })}

              {scopedProperties.length === 0 && (
                <EmptyInline label="אין נכסים משויכים למשתמש הזה." />
              )}
            </div>
          </SidePanel>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <SidePanel
            title="תבניות חוזה ומסלולים"
            subtitle="תשתית החוזים והפיצ'רים שב־proxy DB"
            icon={<ShieldCheck size={20} />}
          >
            <div className="space-y-4">
              {db.contractTemplates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-[24px] border border-slate-100 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-900">{template.name}</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                        {template.summary}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black tracking-[0.12em] text-slate-500">
                      {template.version}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.fields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black text-slate-500"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SidePanel>

          <SidePanel
            title="חשבוניות והליכים"
            subtitle="חיובי שירות, עמלות ותיקים פתוחים"
            icon={<Receipt size={20} />}
          >
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <MiniRow
                  key={invoice.id}
                  title={invoice.recipientName}
                  subtitle={`${invoice.kind} • ${formatDate(invoice.issuedAt)}`}
                  value={formatCurrency(invoice.amount)}
                />
              ))}
              {invoices.length === 0 && <EmptyInline label="אין חשבוניות פתוחות כרגע." />}

              {legalCases.length > 0 && <div className="my-2 h-px bg-slate-100" />}

              {legalCases.map((legalCase) => (
                <div
                  key={legalCase.id}
                  className="rounded-[24px] border border-rose-100 bg-rose-50/70 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-900">
                        {legalCase.stageLabel}
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                        {legalCase.description}
                      </p>
                    </div>
                    <span className="text-lg font-black text-rose-700">
                      {formatCurrency(legalCase.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SidePanel>
        </div>
      </div>
    </div>
  );
}

export function ChatUI({ user }: { user: User }) {
  const { db, resolveRetryRequest, sendMessage } = useAppData();
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [msg, setMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const topics = useMemo(() => getTopicsForUser(db, user.id), [db, user.id]);

  useEffect(() => {
    if (!topics.length) {
      setSelectedTopicId("");
      return;
    }
    if (!topics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(topics[0].id);
    }
  }, [selectedTopicId, topics]);

  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? null;
  const messages = selectedTopic ? getMessagesForTopic(db, selectedTopic.id) : [];
  const counterparty = selectedTopic
    ? getTopicCounterparty(db, selectedTopic.id, user.id)
    : null;
  const pendingRetryRequest = useMemo(() => {
    if (!selectedTopic || selectedTopic.type !== "payment_retry") return null;
    return db.paymentRetries.find(
      (request) =>
        request.status === "requested" &&
        selectedTopic.participantIds.includes(request.tenantId) &&
        selectedTopic.participantIds.includes(request.landlordId) &&
        (!selectedTopic.propertyId ||
          db.payments.find((payment) => payment.id === request.paymentId)?.propertyId ===
            selectedTopic.propertyId),
    );
  }, [db.paymentRetries, db.payments, selectedTopic]);

  const handleSend = () => {
    if (!selectedTopic || !msg.trim()) return;

    setIsSubmitting(true);
    startTransition(() => {
      sendMessage({
        topicId: selectedTopic.id,
        senderId: user.id,
        text: msg,
      });
      setMsg("");
      setIsSubmitting(false);
    });
  };

  const handleRetryDecision = (approved: boolean) => {
    if (!pendingRetryRequest) return;
    resolveRetryRequest(user.id, {
      retryRequestId: pendingRetryRequest.id,
      approved,
    });
  };

  if (!topics.length) {
    return (
      <div
        className="flex min-h-[520px] items-center justify-center rounded-[32px] border border-slate-200 bg-white shadow-2xl"
        dir="rtl"
      >
        <EmptyState
          icon={<MessageSquare size={32} />}
          title="אין עדיין שיחות פעילות"
          description="שיחות על תשלומים, תחזוקה ותמיכה יופיעו כאן ברגע שייפתחו."
        />
      </div>
    );
  }

  return (
    <div
      className="grid min-h-[calc(100vh-220px)] gap-0 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl lg:grid-cols-[320px_minmax(0,1fr)]"
      dir="rtl"
    >
      <aside className="border-b border-slate-100 bg-slate-50/50 lg:border-b-0 lg:border-l lg:border-slate-100">
        <div className="border-b border-slate-100 p-6">
          <h1 className="text-2xl font-black text-slate-900">הודעות ותיאום</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            תשלומים, תחזוקה ומסרים תפעוליים מול הצד השני
          </p>
        </div>

        <div className="space-y-2 p-3">
          {topics.map((topic) => {
            const topicCounterparty = getTopicCounterparty(db, topic.id, user.id);

            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={cn(
                  "w-full rounded-[24px] border p-4 text-right transition-all",
                  selectedTopicId === topic.id
                    ? "border-slate-900 bg-white shadow-sm"
                    : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white/80",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">
                      {topic.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 leading-relaxed">
                      {topicCounterparty?.name || `מערכת ${BRAND_NAME}`}
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
                    {getTopicTypeLabel(topic.type)}
                  </span>
                </div>

                <p className="mt-3 text-[11px] font-bold text-slate-400">
                  פעילות אחרונה: {formatDate(topic.lastMessageAt)}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-h-[520px] flex-col">
        <div className="border-b border-slate-100 bg-white/80 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-900 text-2xl font-black text-white">
                {(counterparty?.name || BRAND_NAME).slice(0, 1)}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {counterparty?.name || BRAND_NAME}
                </h2>
                <p className="mt-1 text-[11px] font-bold tracking-[0.12em] text-slate-400">
                  {selectedTopic ? getTopicTypeLabel(selectedTopic.type) : "שיחה"}
                  {" • "}
                  {selectedTopic?.title}
                </p>
              </div>
            </div>

            <button className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition-all hover:text-slate-900">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {pendingRetryRequest && (
          <div className="border-b border-amber-100 bg-amber-50 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-amber-900">
                  בקשת חיוב חוזר פתוחה
                </p>
                <p className="mt-2 text-sm font-semibold text-amber-800">
                  סיבה: {pendingRetryRequest.reason}. תאריך מבוקש:
                  {" "}
                  {formatDate(pendingRetryRequest.preferredRetryDate)}
                  {pendingRetryRequest.note ? ` • ${pendingRetryRequest.note}` : ""}
                </p>
              </div>

              {user.role === "landlord" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleRetryDecision(true)}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white transition-all hover:bg-emerald-700"
                  >
                    אשר חיוב חוזר
                  </button>
                  <button
                    onClick={() => handleRetryDecision(false)}
                    className="rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black text-white transition-all hover:bg-rose-700"
                  >
                    דחה בקשה
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-xs font-black text-amber-700">
                  ממתין לאישור בעל הנכס
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/40 p-6">
          {messages.map((message) => {
            const isCurrentUser = message.senderId === user.id;
            const isSystem = message.kind === "system";

            return (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  isCurrentUser ? "justify-start" : "justify-end",
                  isSystem && "justify-center",
                )}
              >
                <div
                  className={cn(
                    "max-w-2xl rounded-[28px] px-5 py-4 text-sm leading-7 shadow-sm",
                    isSystem
                      ? "border border-slate-200 bg-white text-slate-600"
                      : isCurrentUser
                        ? "rounded-tr-none bg-slate-900 text-white"
                        : "rounded-tl-none bg-white text-slate-900",
                  )}
                >
                  {!isSystem && (
                    <p className="mb-1 text-[11px] font-black text-inherit/70">
                      {message.senderRole === "tenant"
                        ? "דייר"
                        : message.senderRole === "landlord"
                          ? "משכיר"
                          : BRAND_NAME}
                    </p>
                  )}
                  <p>{message.text}</p>
                  <p className="mt-3 text-[10px] font-black text-inherit/60">
                    {formatDate(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 bg-white p-5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={msg}
              onChange={(event) => setMsg(event.target.value)}
              placeholder="כתוב הודעה תפעולית, בקשת תחזוקה או הבהרה על החיוב..."
              className="flex-1 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold outline-none transition-all focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
            />
            <button
              onClick={handleSend}
              disabled={isSubmitting || !msg.trim() || !selectedTopic}
              className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-slate-900 text-white shadow-xl transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ManualPaymentModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { db, createManualPayment } = useAppData();
  const [formData, setFormData] = useState({
    propertyId: "",
    amount: "",
    tenantName: "",
    type: "rent" as Payment["type"],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const properties = useMemo(() => {
    if (user.role === "admin") return db.properties;
    return db.properties.filter((property) => property.landlordId === user.id);
  }, [db.properties, user.id, user.role]);

  useEffect(() => {
    if (!formData.propertyId && properties[0]?.id) {
      setFormData((current) => ({ ...current, propertyId: properties[0].id }));
    }
  }, [formData.propertyId, properties]);

  const handleSubmit = () => {
    if (!formData.amount || !formData.propertyId) return;

    setIsSubmitting(true);
    startTransition(() => {
      createManualPayment(user, {
        propertyId: formData.propertyId,
        amount: Number(formData.amount),
        tenantName: formData.tenantName || undefined,
        type: formData.type,
        status: "paid",
      });
      setIsSubmitting(false);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[32px] bg-white p-8 shadow-2xl" dir="rtl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">גבייה ידנית</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              רישום תשלום חריג, קנס, פיקדון או חיוב שאינו דרך מס"ב
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-500"
          >
            סגור
          </button>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Field label="נכס">
            <select
              value={formData.propertyId}
              onChange={(event) =>
                setFormData((current) => ({ ...current, propertyId: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-slate-900"
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.address}
                </option>
              ))}
            </select>
          </Field>

          <Field label="סוג חיוב">
            <select
              value={formData.type}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  type: event.target.value as Payment["type"],
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-slate-900"
            >
              <option value="rent">שכר דירה</option>
              <option value="deposit">פיקדון</option>
              <option value="utility">חשבון</option>
              <option value="fine">קנס</option>
              <option value="commission">עמלה</option>
            </select>
          </Field>

          <Field label="סכום">
            <input
              type="number"
              value={formData.amount}
              onChange={(event) =>
                setFormData((current) => ({ ...current, amount: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-slate-900"
              placeholder="0"
            />
          </Field>

          <Field label="שם המשלם">
            <input
              type="text"
              value={formData.tenantName}
              onChange={(event) =>
                setFormData((current) => ({ ...current, tenantName: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-slate-900"
              placeholder="אם שונה מהדייר המשויך"
            />
          </Field>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 text-sm font-black text-slate-500"
          >
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-[2] rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white shadow-xl transition-all hover:bg-black disabled:opacity-50"
          >
            {isSubmitting ? "שומר..." : "רשום תשלום"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2 text-right">
      <span className="block text-[11px] font-black tracking-[0.12em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-[11px] font-black tracking-[0.12em] transition-all",
        active ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900",
      )}
    >
      {label}
    </button>
  );
}

function MetricTile({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: "slate" | "blue" | "rose" | "amber" | "emerald";
}) {
  const tones = {
    slate: "bg-slate-50 text-slate-900 border-slate-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  return (
    <div className="dashboard-card border-slate-100 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className={cn("rounded-2xl border p-3", tones[tone])}>{icon}</div>
        <span className="text-[11px] font-black tracking-[0.12em] text-slate-400">
          {label}
        </span>
      </div>
      <p className="mt-6 text-4xl font-black tracking-tighter text-slate-900 font-display">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function SidePanel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-card border-slate-100 p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-slate-900">{icon}</div>
      </div>
      {children}
    </div>
  );
}

function MiniRow({
  title,
  subtitle,
  value,
}: {
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-100 bg-slate-50/70 p-4">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900">{title}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500 leading-relaxed">{subtitle}</p>
      </div>
      <span className="shrink-0 text-lg font-black text-slate-900">{value}</span>
    </div>
  );
}

function MiniPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <span className="text-sm font-black text-slate-900">{value}</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-8 py-14 text-center">
      <div className="mb-5 rounded-3xl bg-white p-5 text-slate-300 shadow-sm">{icon}</div>
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function EmptyInline({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}
