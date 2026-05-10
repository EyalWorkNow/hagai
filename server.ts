import "dotenv/config";
import express from "express";
import os from "os";
import path from "path";
import seedDb from "./src/data/garim-po-db.json";
import { isSupabaseEnabled, loadDbFromSupabase, saveDbToSupabase } from "./server-supabase";

const IS_VERCEL = Boolean(process.env.VERCEL);
import {
  formatChannelLabel,
  formatProviderLabel,
  getAdminDashboardMetrics,
  getLandlordHeroFinancials,
  getPlatformFinancialSummary,
  getRevenueByChannel,
  getTenantHeroFinancials,
} from "./src/lib/analytics";
import type {
  AuthAccount,
  Contract,
  DocumentRecord,
  EligibilityCheck,
  OnboardingInvite,
  Property,
  RentflowDb,
  Role,
  User,
} from "./src/types";

type OnboardingSyncResponse = {
  revision: number;
  userId: string | null;
  propertyId: string;
  records: {
    user: User | null;
    authAccount?: AuthAccount;
    property: Property;
    contract: Contract | null;
    invite: OnboardingInvite | null;
    documents: DocumentRecord[];
    eligibilityCheck?: EligibilityCheck | null;
  };
};

function normalizeDb(rawDb: RentflowDb): RentflowDb {
  const db = structuredClone(rawDb);

  db.properties = db.properties.map((property) => ({
    ...property,
    costs:
      property.costs ??
      { buildingCommittee: 0, arnona: 0, utilities: 0 },
    insuranceOffered: property.insuranceOffered ?? property.tenantId !== undefined,
  }));

  db.users = db.users.map((user) => ({
    ...user,
    insurancePreference:
      user.insurancePreference ?? (user.role === "tenant" ? "undecided" : undefined),
  }));

  db.integrations = db.integrations ?? [];
  db.transactions = db.transactions ?? [];
  db.supportIssues = db.supportIssues ?? [];
  db.authAccounts = db.authAccounts ?? [];
  db.paymentRetries = db.paymentRetries ?? [];
  db.utilityCharges = db.utilityCharges ?? [];
  db.transfers = db.transfers ?? [];
  db.invoices = db.invoices ?? [];
  db.vendors = db.vendors ?? [];
  db.documents = db.documents ?? [];
  db.notifications = db.notifications ?? [];
  db.eligibilityChecks = db.eligibilityChecks ?? [];
  db.onboardingInvites = db.onboardingInvites ?? [];

  return db;
}

let runtimeDb = normalizeDb(seedDb as RentflowDb);
let runtimeDbRevision = 1;
const onboardingSubscribers = new Map<string, Set<express.Response>>();

function cloneDb(): RentflowDb {
  return normalizeDb(runtimeDb);
}

function setDbRevisionHeader(res: express.Response) {
  res.setHeader("X-Db-Revision", String(runtimeDbRevision));
}

function getClientDbRevision(req: express.Request) {
  const rawRevision = req.get("x-db-base-revision");
  if (!rawRevision) return null;
  const revision = Number(rawRevision);
  return Number.isFinite(revision) ? revision : null;
}

function buildId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  return nowIso().slice(0, 10);
}

function oneYearFromTodayIso() {
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);
  return endDate.toISOString().slice(0, 10);
}

function findUser(db: RentflowDb, userId: string) {
  return db.users.find((user) => user.id === userId) ?? null;
}

function findProperty(db: RentflowDb, propertyId: string) {
  return db.properties.find((property) => property.id === propertyId) ?? null;
}

function findOnboardingContractForProperty(db: RentflowDb, propertyId: string, tenantId?: string) {
  return (
    db.contracts.find(
      (contract) =>
        contract.propertyId === propertyId &&
        (!tenantId || contract.tenantId === tenantId) &&
        contract.status !== "active" &&
        contract.status !== "expired",
    ) ??
    db.contracts.find(
      (contract) =>
        contract.propertyId === propertyId &&
        (!tenantId || contract.tenantId === tenantId) &&
        contract.status !== "expired",
    ) ??
    null
  );
}

function getOnboardingPropertyIdForUser(db: RentflowDb, userId: string) {
  const contract = db.contracts.find(
    (item) => item.tenantId === userId && item.status !== "expired",
  );
  if (contract) return contract.propertyId;
  return db.properties.find((property) => property.tenantId === userId)?.id ?? null;
}

function getOnboardingSyncResponse(
  propertyId: string,
  preferredUserId?: string | null,
): OnboardingSyncResponse | null {
  const property = findProperty(runtimeDb, propertyId);
  if (!property) return null;

  const tenant =
    (preferredUserId ? findUser(runtimeDb, preferredUserId) : null) ??
    (property.tenantId ? findUser(runtimeDb, property.tenantId) : null);
  const contract = findOnboardingContractForProperty(runtimeDb, property.id, tenant?.id);
  const tenantEmail = tenant?.email.trim().toLowerCase();
  const invite =
    runtimeDb.onboardingInvites.find(
      (item) =>
        item.propertyId === property.id &&
        tenantEmail &&
        item.tenantEmail.toLowerCase() === tenantEmail &&
        item.status !== "completed",
    ) ??
    runtimeDb.onboardingInvites.find(
      (item) => item.propertyId === property.id && item.status !== "completed",
    ) ??
    null;
  const documents = contract
    ? runtimeDb.documents.filter(
        (document) => document.ownerType === "contract" && document.ownerId === contract.id,
      )
    : [];
  const eligibilityCheck = tenant
    ? runtimeDb.eligibilityChecks.find((check) => check.tenantId === tenant.id) ?? null
    : null;
  const authAccount = tenant
    ? runtimeDb.authAccounts.find((account) => account.userId === tenant.id)
    : undefined;

  return {
    revision: runtimeDbRevision,
    userId: tenant?.id ?? null,
    propertyId: property.id,
    records: {
      user: tenant ?? null,
      authAccount,
      property,
      contract,
      invite,
      documents,
      eligibilityCheck,
    },
  };
}

function writeOnboardingEvent(res: express.Response, payload: OnboardingSyncResponse) {
  try {
    res.write(`event: onboarding-sync\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // Socket was destroyed before the close event cleaned up the subscriber — safe to ignore
  }
}

function notifyOnboardingSubscribers(propertyId: string) {
  const subscribers = onboardingSubscribers.get(propertyId);
  if (!subscribers?.size) return;
  const payload = getOnboardingSyncResponse(propertyId);
  if (!payload) return;
  for (const subscriber of subscribers) {
    writeOnboardingEvent(subscriber, payload);
  }
}

function notifyAllOnboardingSubscribers() {
  for (const propertyId of onboardingSubscribers.keys()) {
    notifyOnboardingSubscribers(propertyId);
  }
}

let supabaseStateLoaded = false;
let lastSupabaseRefreshAt = 0;
const SUPABASE_REFRESH_INTERVAL_MS = 3000;

async function ensureSupabaseState() {
  if (supabaseStateLoaded || !isSupabaseEnabled) return;
  supabaseStateLoaded = true;
  try {
    const saved = await loadDbFromSupabase();
    if (saved) {
      runtimeDb = normalizeDb(saved.db);
      runtimeDbRevision = saved.revision;
      lastSupabaseRefreshAt = Date.now();
      console.log(`[supabase] lazy-loaded DB (revision ${saved.revision})`);
    }
  } catch (err: unknown) {
    console.error("[supabase] lazy load failed:", (err as Error)?.message ?? err);
  }
}

async function refreshFromSupabaseIfStale(): Promise<void> {
  if (!IS_VERCEL || !isSupabaseEnabled) return;
  const now = Date.now();
  if (now - lastSupabaseRefreshAt < SUPABASE_REFRESH_INTERVAL_MS) return;
  lastSupabaseRefreshAt = now;
  try {
    const saved = await loadDbFromSupabase();
    if (saved) {
      runtimeDb = normalizeDb(saved.db);
      runtimeDbRevision = saved.revision;
    }
  } catch (err: unknown) {
    console.error("[supabase] stale refresh failed:", (err as Error)?.message ?? err);
  }
}

function persistToSupabase() {
  if (!isSupabaseEnabled) return;
  saveDbToSupabase(runtimeDb, runtimeDbRevision).catch((err: unknown) => {
    console.error("[supabase] save failed:", (err as Error)?.message ?? err);
  });
}

function commitRuntimeDb(propertyIds: Array<string | null | undefined>) {
  runtimeDb = normalizeDb(runtimeDb);
  runtimeDbRevision += 1;
  persistToSupabase();
  const uniquePropertyIds = [...new Set(propertyIds.filter(Boolean) as string[])];
  for (const propertyId of uniquePropertyIds) {
    notifyOnboardingSubscribers(propertyId);
  }
}

function getOnboardingPropertyIds(db: RentflowDb) {
  const propertyIds = new Set<string>();
  db.properties.forEach((property) => {
    if (property.tenantId) propertyIds.add(property.id);
  });
  db.contracts.forEach((contract) => {
    if (contract.status !== "expired") propertyIds.add(contract.propertyId);
  });
  db.onboardingInvites.forEach((invite) => {
    if (invite.status !== "completed") propertyIds.add(invite.propertyId);
  });
  return propertyIds;
}

function upsertOnboardingInvite(
  db: RentflowDb,
  payload: {
    landlordId?: string;
    propertyId: string;
    tenantEmail: string;
    tenantPhone?: string;
    status?: "sent" | "opened" | "completed";
    contractVisibilityStep?: 1 | 2 | 4;
    landlordCreditSkipApproved?: boolean;
  },
) {
  const normalizedEmail = payload.tenantEmail.trim().toLowerCase();
  const existing = db.onboardingInvites.find(
    (invite) =>
      invite.propertyId === payload.propertyId &&
      invite.tenantEmail.toLowerCase() === normalizedEmail,
  );

  if (existing) {
    existing.tenantEmail = normalizedEmail;
    existing.tenantPhone = payload.tenantPhone ?? existing.tenantPhone;
    existing.status = payload.status ?? existing.status;
    existing.contractVisibilityStep =
      payload.contractVisibilityStep ?? existing.contractVisibilityStep;
    if (payload.landlordCreditSkipApproved !== undefined) {
      existing.landlordCreditSkipApproved = payload.landlordCreditSkipApproved;
    }
    return existing;
  }

  const invite = {
    id: buildId("invite"),
    landlordId: payload.landlordId ?? findProperty(db, payload.propertyId)?.landlordId ?? "",
    tenantEmail: normalizedEmail,
    tenantPhone: payload.tenantPhone,
    propertyId: payload.propertyId,
    sentAt: nowIso(),
    status: payload.status ?? "sent",
    contractVisibilityStep: payload.contractVisibilityStep ?? 2,
    landlordCreditSkipApproved: Boolean(payload.landlordCreditSkipApproved),
  };

  db.onboardingInvites.unshift(invite);
  return invite;
}

function startTenantOnboardingForProperty(db: RentflowDb, userId: string, propertyId: string) {
  const user = findUser(db, userId);
  const property = findProperty(db, propertyId);
  if (!user || user.role !== "tenant" || !property) return;

  const tenantEmail = user.email.trim().toLowerCase();
  db.onboardingInvites.forEach((invite) => {
    if (
      invite.propertyId === property.id &&
      invite.tenantEmail.toLowerCase() !== tenantEmail &&
      invite.status !== "completed"
    ) {
      invite.status = "completed";
    }
  });

  property.tenantId = user.id;
  property.status = "occupied";
  user.onboardingComplete = false;
  user.onboardingStep = 0;
  user.kycStatus = "pending";
  user.bdiStatus = "pending";
  user.bdiReason = undefined;
  user.statusLabel = undefined;

  upsertOnboardingInvite(db, {
    landlordId: property.landlordId,
    propertyId: property.id,
    tenantEmail,
    tenantPhone: user.phone,
    status: "opened",
    contractVisibilityStep: 2,
  });

  const existingContract = db.contracts.find(
    (contract) =>
      contract.propertyId === property.id &&
      contract.tenantId === user.id &&
      contract.status !== "active" &&
      contract.status !== "expired",
  );

  if (existingContract) {
    existingContract.propertyAddress = property.address;
    existingContract.landlordId = property.landlordId;
    existingContract.tenantName = user.name;
    existingContract.rentAmount = property.rent;
    existingContract.buildingCommitteeAmount = property.costs?.buildingCommittee ?? 0;
    existingContract.arnonaAmount = property.costs?.arnona ?? 0;
    existingContract.utilityPaymentMode = "separate";
    existingContract.monthlyPaymentAmount = property.rent;
    existingContract.status = "waiting_kyc";
    existingContract.tenantQrScannedAt = nowIso();
    existingContract.landlordQrScannedAt = undefined;
    existingContract.contractUploadedAt = undefined;
    existingContract.contractClausesApprovedAt = undefined;
    existingContract.signedByTenantAt = undefined;
    existingContract.signedByLandlordAt = undefined;
    return;
  }

  const contractId = buildId("contract");
  db.contracts.unshift({
    id: contractId,
    propertyId: property.id,
    propertyAddress: property.address,
    landlordId: property.landlordId,
    tenantId: user.id,
    tenantName: user.name,
    rentAmount: property.rent,
    buildingCommitteeAmount: property.costs?.buildingCommittee ?? 0,
    arnonaAmount: property.costs?.arnona ?? 0,
    utilityPaymentMode: "separate",
    monthlyPaymentAmount: property.rent,
    startDate: todayIso(),
    endDate: oneYearFromTodayIso(),
    status: "waiting_kyc",
    guaranteeType: "bank",
    createdAt: nowIso(),
    templateId: "template_standard",
    tenantQrScannedAt: nowIso(),
  });

  db.documents.unshift({
    id: buildId("document"),
    ownerType: "contract",
    ownerId: contractId,
    label: "טיוטת חוזה שכירות",
    category: "contract",
    status: "pending",
  });
}

function registerUserForOnboarding(payload: {
  name: string;
  email: string;
  password: string;
  role: Role;
  propertyId: string;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  if (runtimeDb.authAccounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
    return { error: "האימייל כבר בשימוש", status: 409 as const };
  }

  const property = findProperty(runtimeDb, payload.propertyId);
  if (!property) {
    return { error: "הנכס לא נמצא במערכת", status: 404 as const };
  }

  const userId = buildId(payload.role);
  runtimeDb.authAccounts.push({
    userId,
    email: normalizedEmail,
    password: payload.password,
  });
  runtimeDb.users.push({
    id: userId,
    name: payload.name,
    email: normalizedEmail,
    role: payload.role,
    phone: "",
    kycStatus: payload.role === "tenant" ? "pending" : "approved",
    bdiStatus: payload.role === "tenant" ? "pending" : "green",
    onboardingStep: payload.role === "tenant" ? 0 : 5,
    onboardingComplete: payload.role !== "tenant",
    createdAt: nowIso(),
  });

  if (payload.role === "tenant") {
    startTenantOnboardingForProperty(runtimeDb, userId, payload.propertyId);
  }

  commitRuntimeDb([payload.propertyId]);
  const sync = getOnboardingSyncResponse(payload.propertyId, userId);
  if (!sync) {
    console.error("[register] getOnboardingSyncResponse returned null", {
      propertyId: payload.propertyId,
      userId,
      property: findProperty(runtimeDb, payload.propertyId),
      contractsForProperty: runtimeDb.contracts.filter(c => c.propertyId === payload.propertyId).map(c => ({ id: c.id, tenantId: c.tenantId, status: c.status })),
    });
  }
  return sync
    ? { sync, status: 200 as const }
    : { error: "סנכרון הדייר נכשל", status: 500 as const };
}

function loginUserForOnboarding(payload: {
  email: string;
  password: string;
  propertyId: string;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const property = findProperty(runtimeDb, payload.propertyId);
  if (!property) {
    return { error: "הנכס לא נמצא במערכת", status: 404 as const };
  }

  const account = runtimeDb.authAccounts.find(
    (candidate) =>
      candidate.email.toLowerCase() === normalizedEmail && candidate.password === payload.password,
  );

  if (!account) {
    return { error: "פרטי התחברות שגויים", status: 401 as const };
  }

  startTenantOnboardingForProperty(runtimeDb, account.userId, payload.propertyId);

  commitRuntimeDb([payload.propertyId]);
  const sync = getOnboardingSyncResponse(payload.propertyId, account.userId);
  return sync
    ? { sync, status: 200 as const }
    : { error: "סנכרון הדייר נכשל", status: 500 as const };
}

function inviteTenantForOnboarding(payload: {
  landlordId: string;
  propertyId: string;
  tenantEmail: string;
  tenantPhone?: string;
  landlordCreditSkipApproved?: boolean;
}) {
  const property = findProperty(runtimeDb, payload.propertyId);
  if (!property || property.landlordId !== payload.landlordId) {
    return { error: "הנכס לא נמצא עבור המשכיר", status: 404 as const };
  }

  upsertOnboardingInvite(runtimeDb, {
    landlordId: payload.landlordId,
    propertyId: property.id,
    tenantEmail: payload.tenantEmail,
    tenantPhone: payload.tenantPhone,
    status: "sent",
    contractVisibilityStep: 2,
    landlordCreditSkipApproved: Boolean(payload.landlordCreditSkipApproved),
  });

  commitRuntimeDb([property.id]);
  const sync = getOnboardingSyncResponse(property.id);
  return sync
    ? { sync, status: 200 as const }
    : { error: "סנכרון ההזמנה נכשל", status: 500 as const };
}

function setCreditSkipApprovalForOnboarding(payload: {
  landlordId: string;
  propertyId: string;
  tenantEmail?: string;
  approved: boolean;
}) {
  const property = findProperty(runtimeDb, payload.propertyId);
  if (!property || property.landlordId !== payload.landlordId) {
    return { error: "הנכס לא נמצא עבור המשכיר", status: 404 as const };
  }

  const tenant =
    (property.tenantId ? findUser(runtimeDb, property.tenantId) : null) ??
    runtimeDb.users.find(
      (candidate) =>
        payload.tenantEmail &&
        candidate.email.toLowerCase() === payload.tenantEmail.toLowerCase(),
    ) ??
    null;
  const tenantEmail = (payload.tenantEmail || tenant?.email || "").trim().toLowerCase();
  if (!tenantEmail) {
    return { error: "לא נמצא דייר לעדכון אישור דילוג", status: 400 as const };
  }

  upsertOnboardingInvite(runtimeDb, {
    landlordId: payload.landlordId,
    propertyId: property.id,
    tenantEmail,
    tenantPhone: tenant?.phone,
    status: tenant ? "opened" : "sent",
    contractVisibilityStep: 2,
    landlordCreditSkipApproved: payload.approved,
  });

  commitRuntimeDb([property.id]);
  const sync = getOnboardingSyncResponse(property.id, tenant?.id);
  return sync
    ? { sync, status: 200 as const }
    : { error: "סנכרון אישור הדילוג נכשל", status: 500 as const };
}

function requestEligibilityCheckOnServer(payload: {
  tenantId: string;
  propertyId: string;
  landlordId?: string;
}) {
  const property = findProperty(runtimeDb, payload.propertyId);
  const tenant = findUser(runtimeDb, payload.tenantId);
  if (!property || !tenant || tenant.role !== "tenant") {
    return { error: "הדייר או הנכס לא נמצא", status: 404 as const };
  }

  const existing = runtimeDb.eligibilityChecks.find((check) => check.tenantId === tenant.id);
  if (existing) {
    existing.status = "pending";
    existing.checkedAt = nowIso();
    existing.notes = "הבדיקה נשלחה לעיון מחדש.";
  } else {
    runtimeDb.eligibilityChecks.push({
      id: buildId("eligibility"),
      tenantId: tenant.id,
      landlordId: payload.landlordId ?? property.landlordId,
      status: "pending",
      score: 0,
      grade: "בהמתנה",
      recommendation: "review",
      checkedAt: nowIso(),
      provider: "BDI",
      notes: "בדיקה חדשה הוגשה מתוך תהליך האונבורדינג.",
    });
  }

  tenant.bdiStatus = "pending";
  tenant.onboardingStep = Math.max(tenant.onboardingStep ?? 0, 2);

  commitRuntimeDb([property.id]);
  const sync = getOnboardingSyncResponse(property.id, tenant.id);
  return sync
    ? { sync, status: 200 as const }
    : { error: "סנכרון בקשת הבדיקה נכשל", status: 500 as const };
}

function cancelTenantOnboardingOnServer(payload: {
  landlordId: string;
  propertyId: string;
  tenantId: string;
}) {
  const property = findProperty(runtimeDb, payload.propertyId);
  const tenant = findUser(runtimeDb, payload.tenantId);
  if (!property || property.landlordId !== payload.landlordId || !tenant || tenant.role !== "tenant") {
    return { error: "לא ניתן לבטל את תהליך החיבור", status: 404 as const };
  }

  const tenantEmail = tenant.email.toLowerCase();
  runtimeDb.contracts
    .filter(
      (contract) =>
        contract.propertyId === property.id &&
        contract.tenantId === tenant.id &&
        contract.status !== "active" &&
        contract.status !== "expired",
    )
    .forEach((contract) => {
      contract.status = "expired";
      contract.tenantQrScannedAt = undefined;
      contract.landlordQrScannedAt = undefined;
      contract.contractUploadedAt = undefined;
      contract.contractClausesApprovedAt = undefined;
      contract.signedByTenantAt = undefined;
      contract.signedByLandlordAt = undefined;
    });

  if (property.tenantId === tenant.id) {
    property.tenantId = undefined;
    property.status = "vacant";
  }

  tenant.onboardingComplete = false;
  tenant.onboardingStep = 0;
  tenant.kycStatus = "pending";
  tenant.bdiStatus = "pending";
  tenant.bdiReason = undefined;
  tenant.statusLabel = "תהליך חיבור בוטל";

  runtimeDb.onboardingInvites.forEach((invite) => {
    if (
      invite.propertyId === property.id &&
      invite.tenantEmail.toLowerCase() === tenantEmail &&
      invite.status !== "completed"
    ) {
      invite.status = "completed";
    }
  });

  commitRuntimeDb([property.id]);
  const sync = getOnboardingSyncResponse(property.id);
  return sync
    ? { sync, status: 200 as const }
    : { error: "סנכרון ביטול החיבור נכשל", status: 500 as const };
}

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

function getPublicOrigin(req: express.Request) {
  if (process.env.PUBLIC_APP_ORIGIN) {
    return process.env.PUBLIC_APP_ORIGIN.replace(/\/$/, "");
  }

  const protocol = req.protocol || "http";
  const host = req.get("host") ?? "";
  const [hostname, port] = host.split(":");
  const isLocalhost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);

  if (!isLocalhost) {
    return `${protocol}://${host}`;
  }

  const lanAddress = getLanAddress();
  return `${protocol}://${lanAddress ?? hostname}${port ? `:${port}` : ""}`;
}

function buildApi() {
  const router = express.Router();

  // On serverless cold starts, load DB from Supabase before handling any request
  router.use((_req, _res, next) => {
    ensureSupabaseState().then(() => next()).catch(next);
  });

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "garim-po-api" });
  });

  router.get("/public-origin", (req, res) => {
    res.json({ origin: getPublicOrigin(req) });
  });

  router.get("/users", (_req, res) => res.json(cloneDb().users));
  router.get("/properties", (_req, res) => res.json(cloneDb().properties));
  router.get("/contracts", (_req, res) => res.json(cloneDb().contracts));
  router.get("/payments", (_req, res) => res.json(cloneDb().payments));
  router.get("/transactions", (_req, res) => res.json(cloneDb().transactions ?? []));
  router.get("/integrations", (_req, res) => res.json(cloneDb().integrations ?? []));

  router.get("/db", async (req, res, next) => {
    try {
      await refreshFromSupabaseIfStale();
      const clientRevision = getClientDbRevision(req);
      if (clientRevision !== null && clientRevision >= runtimeDbRevision) {
        res.status(304).end();
        return;
      }
      setDbRevisionHeader(res);
      res.json(cloneDb());
    } catch (err) {
      next(err);
    }
  });

  router.put("/db", async (req, res, next) => {
    try {
    await refreshFromSupabaseIfStale();

    const incomingDb = req.body as Partial<RentflowDb>;
    const clientRevision = getClientDbRevision(req);

    if (
      !incomingDb ||
      !Array.isArray(incomingDb.users) ||
      !Array.isArray(incomingDb.properties) ||
      !Array.isArray(incomingDb.contracts)
    ) {
      res.status(400).json({ error: "Invalid database snapshot" });
      return;
    }

    if (runtimeDbRevision > 1 && (clientRevision === null || clientRevision < runtimeDbRevision)) {
      setDbRevisionHeader(res);
      res.status(409).json({
        error: "Database snapshot is stale",
        revision: runtimeDbRevision,
        db: cloneDb(),
      });
      return;
    }

    const nextRuntimeDb = normalizeDb({
      ...runtimeDb,
      ...incomingDb,
      integrations: runtimeDb.integrations,
      transactions: runtimeDb.transactions,
      supportIssues: runtimeDb.supportIssues,
    } as RentflowDb);
    const affectedPropertyIds = new Set([
      ...getOnboardingPropertyIds(runtimeDb),
      ...getOnboardingPropertyIds(nextRuntimeDb),
    ]);
    runtimeDb = nextRuntimeDb;
    runtimeDbRevision += 1;
    persistToSupabase();
    setDbRevisionHeader(res);
    for (const propertyId of affectedPropertyIds) {
      notifyOnboardingSubscribers(propertyId);
    }
    res.json(cloneDb());
    } catch (err) { next(err); }
  });

  router.post("/db/reset", (_req, res) => {
    runtimeDb = normalizeDb(seedDb as RentflowDb);
    runtimeDbRevision += 1;
    persistToSupabase();
    setDbRevisionHeader(res);
    notifyAllOnboardingSubscribers();
    res.json(cloneDb());
  });

  router.get("/onboarding/status", async (req, res, next) => {
    try {
      await refreshFromSupabaseIfStale();
      const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : "";
      if (!propertyId) {
        res.status(400).json({ error: "Missing propertyId" });
        return;
      }

      const sync = getOnboardingSyncResponse(propertyId);
      if (!sync) {
        res.status(404).json({ error: "Property not found" });
        return;
      }

      setDbRevisionHeader(res);
      res.json(sync);
    } catch (err) {
      next(err);
    }
  });

  router.get("/onboarding/events", (req, res) => {
    const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : "";
    if (!propertyId) {
      res.status(400).json({ error: "Missing propertyId" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");

    const subscribers = onboardingSubscribers.get(propertyId) ?? new Set<express.Response>();
    subscribers.add(res);
    onboardingSubscribers.set(propertyId, subscribers);

    const currentSync = getOnboardingSyncResponse(propertyId);
    if (currentSync) {
      writeOnboardingEvent(res, currentSync);
    }

    const keepAlive = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 25000);

    req.on("close", () => {
      clearInterval(keepAlive);
      subscribers.delete(res);
      if (!subscribers.size) {
        onboardingSubscribers.delete(propertyId);
      }
    });
  });

  router.post("/onboarding/register", (req, res, next) => {
    try {
      const payload = req.body as {
        name?: string;
        email?: string;
        password?: string;
        role?: Role;
        propertyId?: string;
      };

      console.log("[register] incoming", {
        ip: req.ip,
        contentType: req.get("content-type"),
        bodyKeys: payload ? Object.keys(payload) : null,
        hasName: Boolean(payload?.name),
        hasEmail: Boolean(payload?.email),
        hasPropertyId: Boolean(payload?.propertyId),
      });

      if (
        !payload?.name?.trim() ||
        !payload?.email?.trim() ||
        !payload?.password?.trim() ||
        !payload?.role ||
        !payload?.propertyId?.trim()
      ) {
        console.log("[register] validation failed", payload);
        res.status(400).json({ error: "Missing registration fields" });
        return;
      }

      const result = registerUserForOnboarding({
        name: payload.name.trim(),
        email: payload.email,
        password: payload.password,
        role: payload.role,
        propertyId: payload.propertyId,
      });

      if ("error" in result) {
        console.log("[register] business error", result.error, result.status);
        res.status(result.status).json({ error: result.error });
        return;
      }

      console.log("[register] success", { userId: result.sync.userId, propertyId: result.sync.propertyId });
      setDbRevisionHeader(res);
      res.json(result.sync);
    } catch (err) {
      console.error("[register] unexpected exception", err);
      next(err);
    }
  });

  router.post("/onboarding/login", (req, res) => {
    const payload = req.body as {
      email?: string;
      password?: string;
      propertyId?: string;
    };

    if (!payload.email?.trim() || !payload.password?.trim() || !payload.propertyId?.trim()) {
      res.status(400).json({ error: "Missing login fields" });
      return;
    }

    const result = loginUserForOnboarding({
      email: payload.email,
      password: payload.password,
      propertyId: payload.propertyId,
    });

    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    setDbRevisionHeader(res);
    res.json(result.sync);
  });

  router.post("/onboarding/action", (req, res) => {
    const payload = req.body as {
      action?: string;
      landlordId?: string;
      propertyId?: string;
      tenantId?: string;
      tenantEmail?: string;
      tenantPhone?: string;
      approved?: boolean;
      landlordCreditSkipApproved?: boolean;
    };
    let result:
      | ReturnType<typeof inviteTenantForOnboarding>
      | ReturnType<typeof setCreditSkipApprovalForOnboarding>
      | ReturnType<typeof cancelTenantOnboardingOnServer>
      | ReturnType<typeof requestEligibilityCheckOnServer>;

    if (payload.action === "invite") {
      if (!payload.landlordId || !payload.propertyId || !payload.tenantEmail?.trim()) {
        res.status(400).json({ error: "Missing invite fields" });
        return;
      }
      result = inviteTenantForOnboarding({
        landlordId: payload.landlordId,
        propertyId: payload.propertyId,
        tenantEmail: payload.tenantEmail,
        tenantPhone: payload.tenantPhone,
        landlordCreditSkipApproved: Boolean(payload.landlordCreditSkipApproved),
      });
    } else if (payload.action === "credit_skip_approval") {
      if (!payload.landlordId || !payload.propertyId || payload.approved === undefined) {
        res.status(400).json({ error: "Missing approval fields" });
        return;
      }
      result = setCreditSkipApprovalForOnboarding({
        landlordId: payload.landlordId,
        propertyId: payload.propertyId,
        tenantEmail: payload.tenantEmail,
        approved: payload.approved,
      });
    } else if (payload.action === "request_eligibility_check") {
      if (!payload.tenantId || !payload.propertyId) {
        res.status(400).json({ error: "Missing eligibility check fields" });
        return;
      }
      result = requestEligibilityCheckOnServer({
        tenantId: payload.tenantId,
        propertyId: payload.propertyId,
        landlordId: payload.landlordId,
      });
    } else if (payload.action === "cancel") {
      if (!payload.landlordId || !payload.propertyId || !payload.tenantId) {
        res.status(400).json({ error: "Missing cancel fields" });
        return;
      }
      result = cancelTenantOnboardingOnServer({
        landlordId: payload.landlordId,
        propertyId: payload.propertyId,
        tenantId: payload.tenantId,
      });
    } else {
      res.status(400).json({ error: "Unsupported onboarding action" });
      return;
    }

    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    setDbRevisionHeader(res);
    res.json(result.sync);
  });

  router.get("/dashboard/admin", (_req, res) => {
    const db = cloneDb();
    const metrics = getAdminDashboardMetrics({
      ...db,
      integrations: db.integrations ?? [],
      transactions: db.transactions ?? [],
      supportIssues: db.supportIssues ?? [],
    });

    res.json({
      financials: metrics,
      integrations: metrics.providerMetrics.map((item) => ({
        provider: item.provider,
        label: formatProviderLabel(item.provider),
        count: item.count,
        revenue: item.revenue,
      })),
      purchaseFlow: metrics.purchaseFlow,
      issues: {
        open: metrics.unresolvedIssues,
        resolved: metrics.resolvedIssues,
      },
      channels: metrics.channelBreakdown.map((item) => ({
        channel: item.channel,
        label: formatChannelLabel(item.channel),
        count: item.count,
        revenue: item.revenue,
      })),
    });
  });

  router.get("/dashboard/landlords/:landlordId", (req, res) => {
    const db = cloneDb();
    const hero = getLandlordHeroFinancials(
      {
        ...db,
        integrations: db.integrations ?? [],
        transactions: db.transactions ?? [],
        supportIssues: db.supportIssues ?? [],
      },
      req.params.landlordId,
    );

    res.json({
      landlordId: req.params.landlordId,
      hero,
      financials: getPlatformFinancialSummary({
        ...db,
        integrations: db.integrations ?? [],
        transactions: db.transactions ?? [],
        supportIssues: db.supportIssues ?? [],
      }),
    });
  });

  router.get("/dashboard/tenants/:tenantId", (req, res) => {
    const db = cloneDb();
    const hero = getTenantHeroFinancials(
      {
        ...db,
        integrations: db.integrations ?? [],
        transactions: db.transactions ?? [],
        supportIssues: db.supportIssues ?? [],
      },
      req.params.tenantId,
    );

    res.json({
      tenantId: req.params.tenantId,
      hero,
      revenueByChannel: getRevenueByChannel({
        ...db,
        integrations: db.integrations ?? [],
        transactions: db.transactions ?? [],
        supportIssues: db.supportIssues ?? [],
      }),
    });
  });

  router.get("/analytics/revenue-by-channel", (_req, res) => {
    const db = cloneDb();
    res.json(
      getRevenueByChannel({
        ...db,
        integrations: db.integrations ?? [],
        transactions: db.transactions ?? [],
        supportIssues: db.supportIssues ?? [],
      }),
    );
  });

  return router;
}

function registerApi(app: express.Express, mountPath = "/api/v1") {
  app.use(express.json({ limit: "25mb" }));
  app.use(mountPath, buildApi());
  app.set("trust proxy", true);
  // Catch any unhandled exception from API routes and return JSON (not Express's default HTML 500).
  // Without this, a thrown exception (e.g. writing to a destroyed SSE socket) produces an HTML
  // response that the client can't parse, triggering the silent local-fallback path.
  app.use(mountPath, ((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api.error]", err?.message ?? err);
    if (!res.headersSent) {
      res.status(err?.status ?? err?.statusCode ?? 500).json({
        error: err?.message || "שגיאה פנימית בשרת",
      });
    }
  }) as express.ErrorRequestHandler);
  return app;
}

export function createApiApp(mountPath = "/api/v1") {
  return registerApi(express(), mountPath);
}

export async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const HOST = "0.0.0.0";

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  if (isSupabaseEnabled) {
    try {
      const saved = await loadDbFromSupabase();
      if (saved) {
        runtimeDb = normalizeDb(saved.db);
        runtimeDbRevision = saved.revision;
        console.log(`[supabase] loaded DB from cloud (revision ${saved.revision})`);
      } else {
        console.log("[supabase] no saved state — seeding Supabase with initial data");
        await saveDbToSupabase(runtimeDb, runtimeDbRevision);
      }
    } catch (err: unknown) {
      console.error("[supabase] failed to load DB on startup:", (err as Error)?.message ?? err);
    }
  } else {
    console.log("[supabase] disabled — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  }

  registerApi(app, "/api/v1");

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  });
}
