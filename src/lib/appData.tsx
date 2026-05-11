import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AuthAccount,
  ChatMessage,
  Contract,
  DocumentRecord,
  EligibilityCheck,
  OnboardingInvite,
  Payment,
  PaymentRetryRequest,
  Property,
  RentflowDb,
  Role,
  ServiceCall,
  SessionState,
  SiteAccessSession,
  UtilityPaymentMode,
  User,
} from "../types";
import {
  authenticateSiteAccess,
  isSiteAccessSessionValid,
  SiteAccessActivationMap,
} from "./siteAccess";

const DB_STORAGE_KEY = "garim-po-json-db-v1";
const DB_BROADCAST_CHANNEL = "garim-po-db-sync";
const DB_API_ENDPOINT = "/api/v1/db";
const DB_RESET_API_ENDPOINT = "/api/v1/db/reset";
const ONBOARDING_REGISTER_API_ENDPOINT = "/api/v1/onboarding/register";
const ONBOARDING_LOGIN_API_ENDPOINT = "/api/v1/onboarding/login";
const ONBOARDING_STATUS_API_ENDPOINT = "/api/v1/onboarding/status";
const ONBOARDING_ACTION_API_ENDPOINT = "/api/v1/onboarding/action";
const SESSION_STORAGE_KEY = "garim-po-session";
const SITE_ACCESS_SESSION_STORAGE_KEY = "garim-po-site-access-session";
const SITE_ACCESS_ACTIVATIONS_STORAGE_KEY = "garim-po-site-access-activations";
const DEBUG_LOG_STORAGE_KEY = "garim-po-debug-log-v1";
const DEBUG_LOG_LIMIT = 250;
const STORAGE_WARNING =
  "נפח הנתונים המקומי חרג ממגבלת הדפדפן. המערכת ממשיכה לעבוד, אך שינויים כבדים לא יישמרו מקומית.";

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role: Role;
  propertyId?: string;
};

export type OnboardingSyncResponse = {
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

type CreateContractPayload = {
  propertyId: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  buildingCommitteeAmount?: number;
  arnonaAmount?: number;
  utilityPaymentMode?: UtilityPaymentMode;
  guaranteeType: Contract["guaranteeType"];
  isSplitPayment?: boolean;
  partners?: string[];
};

type CreatePaymentPayload = {
  propertyId: string;
  amount: number;
  tenantName?: string;
  type: Payment["type"];
  status?: Payment["status"];
  date?: string;
};

type CreateServiceCallPayload = {
  propertyId: string;
  title: string;
  description: string;
  priority: ServiceCall["priority"];
  category: ServiceCall["category"];
};

type SubmitRetryPayload = {
  paymentId: string;
  reason: string;
  note?: string;
  preferredRetryDate: string;
};

type ResolveRetryPayload = {
  retryRequestId: string;
  approved: boolean;
};

type SendMessagePayload = {
  topicId: string;
  senderId: string;
  text: string;
};

type AddPropertyPayload = {
  address: string;
  rent: number;
  buildingCommittee?: number;
  arnona?: number;
  utilities?: number;
  description?: string;
};

type InviteTenantPayload = {
  propertyId: string;
  tenantEmail: string;
  tenantPhone?: string;
  contractVisibilityStep?: 1 | 2 | 4;
  landlordCreditSkipApproved?: boolean;
};

type CreditSkipApprovalPayload = {
  propertyId: string;
  tenantEmail?: string;
  approved: boolean;
};

type CancelTenantOnboardingPayload = {
  propertyId: string;
  tenantId: string;
};

type CreateUtilityChargePayload = {
  propertyId: string;
  label: string;
  provider: string;
  amount: number;
  dueDate: string;
};

type SaveOnboardingAgreementPayload = {
  tenantQrScanned: boolean;
  landlordQrScanned: boolean;
  contractDocumentUploaded: boolean;
  clausesApproved: boolean;
  rentAmount: number;
  buildingCommitteeAmount: number;
  arnonaAmount: number;
  utilityPaymentMode: UtilityPaymentMode;
};

type AppDataContextValue = {
  db: RentflowDb;
  currentUser: User | null;
  siteAccessSession: SiteAccessSession | null;
  isReady: boolean;
  requestSiteAccess: (username: string, password: string) => void;
  clearSiteAccess: () => void;
  login: (email: string, password: string, propertyId?: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  linkProperty: (userId: string, propertyId: string) => Promise<void>;
  applyOnboardingSync: (sync: OnboardingSyncResponse) => void;
  syncOnboardingStatus: (propertyId: string) => Promise<void>;
  logout: () => void;
  resetDatabase: () => void;
  updateUser: (userId: string, patch: Partial<User>) => void;
  submitKyc: (userId: string) => void;
  approveKyc: (userId: string) => void;
  requestEligibilityCheck: (userId: string, landlordId?: string, propertyId?: string) => void;
  resolveEligibilityCheck: (userId: string, approved: boolean) => void;
  skipEligibilityCheck: (userId: string, landlordId?: string) => void;
  saveOnboardingAgreement: (userId: string, payload: SaveOnboardingAgreementPayload) => void;
  saveBankAuthorization: (userId: string) => void;
  signOnboardingContract: (userId: string) => void;
  completeOnboarding: (userId: string) => void;
  cancelTenantOnboarding: (landlordId: string, payload: CancelTenantOnboardingPayload) => void;
  addProperty: (landlordId: string, payload: AddPropertyPayload) => string | null;
  inviteTenant: (landlordId: string, payload: InviteTenantPayload) => void;
  setTenantCreditSkipApproval: (landlordId: string, payload: CreditSkipApprovalPayload) => void;
  createContract: (landlordId: string, payload: CreateContractPayload) => void;
  deleteContract: (contractId: string) => void;
  signContract: (contractId: string, signerId: string) => void;
  createManualPayment: (actor: User, payload: CreatePaymentPayload) => void;
  updatePaymentStatus: (paymentId: string, status: Payment["status"]) => void;
  submitRetryRequest: (tenantId: string, payload: SubmitRetryPayload) => void;
  resolveRetryRequest: (landlordId: string, payload: ResolveRetryPayload) => void;
  createServiceCall: (tenantId: string, payload: CreateServiceCallPayload) => void;
  updateServiceCall: (callId: string, patch: Partial<ServiceCall>) => void;
  sendMessage: (payload: SendMessagePayload) => void;
  createUtilityCharge: (landlordId: string, payload: CreateUtilityChargePayload) => void;
  createDebtLetter: (paymentId: string) => void;
  restartOnboarding: (userId: string) => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

// Minimal empty DB used while the real DB is loading asynchronously.
// All arrays are empty so any filter / find returns safely.
const EMPTY_DB: RentflowDb = {
  users: [], authAccounts: [], properties: [], contracts: [],
  payments: [], transfers: [], serviceRequests: [], serviceCalls: [],
  documents: [], notifications: [], messageTopics: [], messages: [],
  onboardingInvites: [], eligibilityChecks: [], integrations: [],
  transactions: [], supportIssues: [], contractTemplates: [], legalCases: [],
  paymentRetries: [], utilityCharges: [], invoices: [], vendors: [], meta: { version: "1.0", seededAt: "" },
} as unknown as RentflowDb;

function normalizeDb(rawDb: RentflowDb): RentflowDb {
  // Use shallow spread instead of structuredClone to avoid deep-copying the entire 11MB JSON.
  // We then spread arrays that need mutation so originals are not modified.
  const db: RentflowDb = { ...rawDb };

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

async function loadSeedDbAsync(): Promise<RentflowDb> {
  const response = await fetch("/garim-po-db.json");
  const seedDb = await response.json();
  return normalizeDb(seedDb as RentflowDb);
}

type ServerDbResult = {
  db: RentflowDb;
  revision: number | null;
};

type ServerPersistResult = {
  ok: boolean;
  stale?: boolean;
  db?: RentflowDb;
  revision?: number | null;
};

type QueuedServerPersist = {
  db: RentflowDb;
  snapshot: string;
  staleRetries: number;
};

type DebugLogEntry = {
  at: string;
  event: string;
  details?: Record<string, unknown>;
};

function appendDebugLog(event: string, details?: Record<string, unknown>) {
  const entry: DebugLogEntry = {
    at: new Date().toISOString(),
    event,
    details,
  };

  try {
    if (typeof window !== "undefined") {
      const currentLogs = loadStoredValue<DebugLogEntry[]>(DEBUG_LOG_STORAGE_KEY, []);
      const nextLogs = [...currentLogs, entry].slice(-DEBUG_LOG_LIMIT);
      window.localStorage.setItem(DEBUG_LOG_STORAGE_KEY, JSON.stringify(nextLogs));
      (window as typeof window & {
        __garimPoDebug?: {
          getLogs: () => DebugLogEntry[];
          clearLogs: () => void;
        };
      }).__garimPoDebug = {
        getLogs: () => loadStoredValue<DebugLogEntry[]>(DEBUG_LOG_STORAGE_KEY, []),
        clearLogs: () => window.localStorage.removeItem(DEBUG_LOG_STORAGE_KEY),
      };
    }
  } catch {
    // Logging must not affect product flow.
  }

  console.debug("[garim-po-debug]", event, details ?? {});
}

function summarizeDbForDebug(db: RentflowDb) {
  return {
    users: db.users.length,
    properties: db.properties.length,
    contracts: db.contracts.length,
    invites: db.onboardingInvites.length,
    documents: db.documents.length,
  };
}

function isServerDbEnvironmentEnabled() {
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;
  // Local dev (localhost) or LAN (non-standard port) or any production host
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) return true;
  if (port !== "" && port !== "80" && port !== "443") return true;
  // Production deployment (e.g. Vercel/Netlify on port 443) — server API is always present
  return true;
}

function getResponseRevision(response: Response) {
  const rawRevision = response.headers.get("x-db-revision");
  if (!rawRevision) return null;
  const revision = Number(rawRevision);
  return Number.isFinite(revision) ? revision : null;
}

async function loadServerDbAsync(sinceRevision?: number | null): Promise<ServerDbResult | null> {
  try {
    const headers: Record<string, string> = {};
    if (sinceRevision != null) {
      headers["x-db-base-revision"] = String(sinceRevision);
    }
    const response = await fetch(DB_API_ENDPOINT, { cache: "no-store", headers });
    if (response.status === 304) return null;
    if (!response.ok) return null;
    const revision = getResponseRevision(response);
    appendDebugLog("db.load_server.success", { revision, status: response.status });
    return {
      db: normalizeDb((await response.json()) as RentflowDb),
      revision,
    };
  } catch {
    appendDebugLog("db.load_server.failure");
    return null;
  }
}

async function persistServerDbAsync(
  db: RentflowDb,
  baseRevision: number | null,
): Promise<ServerPersistResult> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  appendDebugLog("db.persist.start", {
    requestId,
    baseRevision,
    summary: summarizeDbForDebug(db),
  });
  try {
    const response = await fetch(DB_API_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Request-Id": requestId,
        ...(baseRevision !== null ? { "X-Db-Base-Revision": String(baseRevision) } : {}),
      },
      body: JSON.stringify(db),
    });
    const payload = await response.json().catch(() => null);
    appendDebugLog("db.persist.response", {
      requestId,
      status: response.status,
      responseRevision: getResponseRevision(response),
      payloadRevision: typeof payload?.revision === "number" ? payload.revision : null,
      stale: response.status === 409 || Boolean(payload?.stale),
    });
    if (response.status === 409 || payload?.stale) {
      return {
        ok: false,
        stale: true,
        db: payload?.db ? normalizeDb(payload.db as RentflowDb) : undefined,
        revision: typeof payload?.revision === "number" ? payload.revision : getResponseRevision(response),
      };
    }
    return {
      ok: response.ok,
      db: response.ok && payload ? normalizeDb(payload as RentflowDb) : undefined,
      revision: getResponseRevision(response),
    };
  } catch {
    appendDebugLog("db.persist.failure", { requestId, baseRevision });
    return { ok: false };
  }
}

async function resetServerDbAsync(): Promise<ServerDbResult | null> {
  try {
    const response = await fetch(DB_RESET_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    return {
      db: normalizeDb((await response.json()) as RentflowDb),
      revision: getResponseRevision(response),
    };
  } catch {
    return null;
  }
}

async function postOnboardingMutation(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<OnboardingSyncResponse | null> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const rawText = await response.text().catch(() => "");
    let responsePayload: any = null;
    try { responsePayload = rawText ? JSON.parse(rawText) : null; } catch { /* ignore */ }

    if (!response.ok) {
      appendDebugLog("mutation.error", {
        endpoint,
        status: response.status,
        rawText: rawText.slice(0, 400),
        errorField: responsePayload?.error ?? null,
      });
      throw new Error(responsePayload?.error || "פעולת הסנכרון מול השרת נכשלה");
    }

    if (!responsePayload?.records || !responsePayload?.propertyId) {
      return null;
    }

    return {
      ...(responsePayload as OnboardingSyncResponse),
      revision: responsePayload.revision ?? getResponseRevision(response) ?? 0,
    } as OnboardingSyncResponse;
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

async function fetchOnboardingStatus(propertyId: string): Promise<OnboardingSyncResponse | null> {
  try {
    const response = await fetch(
      `${ONBOARDING_STATUS_API_ENDPOINT}?propertyId=${encodeURIComponent(propertyId)}`,
      { cache: "no-store" },
    );
    const responsePayload = await response.json().catch(() => null);
    if (!response.ok || !responsePayload?.records) return null;
    return {
      ...(responsePayload as OnboardingSyncResponse),
      revision: responsePayload.revision ?? getResponseRevision(response) ?? 0,
    };
  } catch {
    return null;
  }
}

function mergeSeededRecords<T extends { id: string }>(
  seededRecords: T[],
  storedRecords: T[] | undefined,
  mergeRecord: (seeded: T, stored: T) => T = (seeded, stored) => ({ ...seeded, ...stored }),
) {
  if (!storedRecords) return seededRecords;

  const seededById = new Map(seededRecords.map((record) => [record.id, record]));
  const seenIds = new Set<string>();
  const mergedRecords = storedRecords.map((stored) => {
    const seeded = seededById.get(stored.id);
    seenIds.add(stored.id);
    return seeded ? mergeRecord(seeded, stored) : stored;
  });

  for (const seeded of seededRecords) {
    if (!seenIds.has(seeded.id)) {
      mergedRecords.push(seeded);
    }
  }

  return mergedRecords;
}

type LoadedDbState = {
  db: RentflowDb;
  source: "server" | "local";
  revision: number | null;
};

async function loadDbStateAsync(serverDbEnabled: boolean): Promise<LoadedDbState> {
  if (serverDbEnabled) {
    const serverState = await loadServerDbAsync();
    if (serverState) {
      return { db: serverState.db, source: "server", revision: serverState.revision };
    }
  }

  const seededDb = await loadSeedDbAsync();
  const storedDb = loadStoredValue<RentflowDb | null>(DB_STORAGE_KEY, null);

  if (!storedDb) {
    return { db: seededDb, source: "local", revision: null };
  }

  return {
    db: normalizeDb({
      ...seededDb,
      ...storedDb,
      properties: mergeSeededRecords(seededDb.properties, storedDb.properties, (seeded, stored) => ({
        ...seeded,
        ...stored,
        costs: stored.costs ?? seeded.costs,
        insuranceOffered: stored.insuranceOffered ?? seeded.insuranceOffered,
      })),
      contracts: mergeSeededRecords(seededDb.contracts, storedDb.contracts, (seeded, stored) => ({
        ...seeded,
        ...stored,
        buildingCommitteeAmount: stored.buildingCommitteeAmount ?? seeded.buildingCommitteeAmount,
        arnonaAmount: stored.arnonaAmount ?? seeded.arnonaAmount,
        utilityPaymentMode: stored.utilityPaymentMode ?? seeded.utilityPaymentMode,
        monthlyPaymentAmount: stored.monthlyPaymentAmount ?? seeded.monthlyPaymentAmount,
        contractUploadedAt: stored.contractUploadedAt ?? seeded.contractUploadedAt,
        contractClausesApprovedAt: stored.contractClausesApprovedAt ?? seeded.contractClausesApprovedAt,
        tenantQrScannedAt: stored.tenantQrScannedAt ?? seeded.tenantQrScannedAt,
        landlordQrScannedAt: stored.landlordQrScannedAt ?? seeded.landlordQrScannedAt,
      })),
      meta: storedDb.meta ?? seededDb.meta,
      integrations: seededDb.integrations,
      transactions: seededDb.transactions,
      supportIssues: seededDb.supportIssues,
    }),
    source: "local",
    revision: null,
  };
}

function loadStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persistValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn(STORAGE_WARNING);
      return;
    }
    throw error;
  }
}

function loadSessionValue(): SessionState {
  if (typeof window === "undefined") return { userId: null };

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : { userId: null };
  } catch {
    return { userId: null };
  }
}

function persistSessionValue(session: SessionState) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Session persistence is non-critical. A reload can safely return to login.
  }
}

function buildPersistableDbSnapshot(db: RentflowDb): RentflowDb {
  return {
    ...db,
    transactions: [],
  };
}

function serializePersistableDbSnapshot(db: RentflowDb) {
  return JSON.stringify(buildPersistableDbSnapshot(db));
}

function upsertRecord<T extends { id: string }>(records: T[], record: T | null | undefined) {
  if (!record) return records;
  const existingIndex = records.findIndex((item) => item.id === record.id);
  if (existingIndex === -1) return [record, ...records];
  return records.map((item, index) => (index === existingIndex ? { ...item, ...record } : item));
}

function upsertRecords<T extends { id: string }>(records: T[], nextRecords: T[] | undefined) {
  return (nextRecords ?? []).reduce((currentRecords, record) => upsertRecord(currentRecords, record), records);
}

function upsertAuthAccount(records: AuthAccount[], record: AuthAccount | null | undefined) {
  if (!record) return records;
  const existingIndex = records.findIndex((item) => item.userId === record.userId);
  if (existingIndex === -1) return [record, ...records];
  return records.map((item, index) => (index === existingIndex ? { ...item, ...record } : item));
}

function mergeOnboardingRecords(db: RentflowDb, sync: OnboardingSyncResponse): RentflowDb {
  const records = sync.records;
  return normalizeDb({
    ...db,
    authAccounts: upsertAuthAccount(db.authAccounts, records.authAccount),
    users: upsertRecord(db.users, records.user),
    properties: upsertRecord(db.properties, records.property),
    contracts: records.contract ? upsertRecord(db.contracts, records.contract) : db.contracts,
    onboardingInvites: (() => {
      if (!records.invite) return db.onboardingInvites;
      const serverInvite = records.invite;
      const localInvite = db.onboardingInvites.find(
        (inv) =>
          inv.id === serverInvite.id ||
          (inv.propertyId === serverInvite.propertyId &&
            inv.tenantEmail.toLowerCase() === serverInvite.tenantEmail.toLowerCase()),
      );
      const safeInvite = localInvite
        ? { ...serverInvite, landlordCreditSkipApproved: localInvite.landlordCreditSkipApproved }
        : serverInvite;
      return upsertRecord(db.onboardingInvites, safeInvite);
    })(),
    documents: upsertRecords(db.documents, records.documents),
    eligibilityChecks:
      records.eligibilityCheck === undefined
        ? db.eligibilityChecks
        : records.eligibilityCheck
          ? upsertRecord(db.eligibilityChecks, records.eligibilityCheck)
          : db.eligibilityChecks,
  });
}


function findUser(db: RentflowDb, userId: string) {
  return db.users.find((user) => user.id === userId) ?? null;
}

function findProperty(db: RentflowDb, propertyId: string) {
  return db.properties.find((property) => property.id === propertyId) ?? null;
}

function findOnboardingContract(db: RentflowDb, userId: string) {
  return (
    db.contracts.find((contract) => contract.tenantId === userId && contract.status !== "expired") ??
    db.contracts.find((contract) => contract.tenantId === userId) ??
    null
  );
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

function upsertNotification(
  db: RentflowDb,
  notification: RentflowDb["notifications"][number],
) {
  db.notifications.unshift(notification);
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

function calculateMonthlyPayment(
  rentAmount: number,
  buildingCommitteeAmount: number,
  arnonaAmount: number,
  utilityPaymentMode: UtilityPaymentMode,
) {
  return (
    rentAmount +
    (utilityPaymentMode === "combined" ? buildingCommitteeAmount + arnonaAmount : 0)
  );
}

function ensureTopic(
  db: RentflowDb,
  participantIds: string[],
  propertyId: string | undefined,
  title: string,
  type: "general" | "maintenance" | "payment_retry" | "support",
) {
  const existing = db.messageTopics.find(
    (topic) =>
      topic.type === type &&
      topic.propertyId === propertyId &&
      participantIds.every((participantId) => topic.participantIds.includes(participantId)) &&
      topic.participantIds.length === participantIds.length,
  );

  if (existing) return existing;

  const topic = {
    id: buildId("topic"),
    participantIds,
    propertyId,
    title,
    type,
    unreadBy: participantIds.slice(1),
    lastMessageAt: nowIso(),
  };

  db.messageTopics.unshift(topic);
  return topic;
}

function pushMessage(db: RentflowDb, message: ChatMessage) {
  db.messages.push(message);
  const topic = db.messageTopics.find((item) => item.id === message.topicId);
  if (topic) {
    topic.lastMessageAt = message.createdAt;
    topic.unreadBy = topic.participantIds.filter((participantId) => participantId !== message.senderId);
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<RentflowDb>(EMPTY_DB);
  const [session, setSession] = useState<SessionState>(() => loadSessionValue());
  const [siteAccessSession, setSiteAccessSession] = useState<SiteAccessSession | null>(() =>
    loadStoredValue<SiteAccessSession | null>(SITE_ACCESS_SESSION_STORAGE_KEY, null),
  );
  const [siteAccessActivations, setSiteAccessActivations] = useState<SiteAccessActivationMap>(() =>
    loadStoredValue<SiteAccessActivationMap>(SITE_ACCESS_ACTIVATIONS_STORAGE_KEY, {}),
  );
  const [isReady, setIsReady] = useState(false);
  const lastPersistedDbRef = useRef<string | null>(null);
  const dbBroadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const hasServerDbRef = useRef(false);
  const serverDbEnabledRef = useRef(isServerDbEnvironmentEnabled());
  const queuedServerPersistRef = useRef<QueuedServerPersist | null>(null);
  const activeServerPersistRef = useRef<string | null>(null);
  const serverRevisionRef = useRef<number | null>(null);

  const flushQueuedServerPersist = () => {
    if (!hasServerDbRef.current || activeServerPersistRef.current || !queuedServerPersistRef.current) {
      return;
    }

    const queuedPersist = queuedServerPersistRef.current;
    appendDebugLog("db.queue.flush", {
      snapshot: queuedPersist.snapshot.slice(0, 24),
      staleRetries: queuedPersist.staleRetries,
      serverRevision: serverRevisionRef.current,
    });
    queuedServerPersistRef.current = null;
    activeServerPersistRef.current = queuedPersist.snapshot;

    persistServerDbAsync(queuedPersist.db, serverRevisionRef.current).then((result) => {
      if (activeServerPersistRef.current !== queuedPersist.snapshot) return;

      if (result.stale) {
        appendDebugLog("db.queue.stale", {
          revision: result.revision,
          staleRetries: queuedPersist.staleRetries,
        });
        hasServerDbRef.current = true;
        serverRevisionRef.current = result.revision ?? serverRevisionRef.current;

        if (result.db) {
          const serverSnapshot = serializePersistableDbSnapshot(result.db);
          if (serverSnapshot === queuedPersist.snapshot) {
            lastPersistedDbRef.current = serverSnapshot;
            persistValue(DB_STORAGE_KEY, buildPersistableDbSnapshot(result.db));
            dbBroadcastChannelRef.current?.postMessage(serverSnapshot);
            return;
          }
        }

        const canRetryWithFreshRevision =
          serverRevisionRef.current !== null && queuedPersist.staleRetries < 2;
        if (canRetryWithFreshRevision && !queuedServerPersistRef.current) {
          queuedServerPersistRef.current = {
            ...queuedPersist,
            staleRetries: queuedPersist.staleRetries + 1,
          };
        } else if (!canRetryWithFreshRevision) {
          hasServerDbRef.current = false;
        }
        return;
      }

      if (result.ok) {
        appendDebugLog("db.queue.success", { revision: result.revision });
        hasServerDbRef.current = true;
        serverRevisionRef.current = result.revision ?? serverRevisionRef.current;
        return;
      }

      appendDebugLog("db.queue.offline_or_failed");
      hasServerDbRef.current = false;
    }).finally(() => {
      if (activeServerPersistRef.current === queuedPersist.snapshot) {
        activeServerPersistRef.current = null;
      }
      if (hasServerDbRef.current && queuedServerPersistRef.current) {
        flushQueuedServerPersist();
      }
    });
  };

  const queueServerPersist = (persistableDb: RentflowDb, snapshot: string) => {
    appendDebugLog("db.queue.enqueue", {
      snapshot: snapshot.slice(0, 24),
      serverRevision: serverRevisionRef.current,
    });
    queuedServerPersistRef.current = { db: persistableDb, snapshot, staleRetries: 0 };
    flushQueuedServerPersist();
  };

  // Async DB initialization — avoids blocking the main thread on first render.
  // We REMOVE any stale snapshot before loading so an old EMPTY_DB save never
  // overwrites the seed data on subsequent visits.
  useEffect(() => {
    // Clear any snapshot that was saved while db === EMPTY_DB (race condition guard)
    const staleSnapshot = loadStoredValue<Record<string, unknown> | null>(DB_STORAGE_KEY, null);
    const isStaleEmpty =
      staleSnapshot &&
      Array.isArray((staleSnapshot as any).authAccounts) &&
      (staleSnapshot as any).authAccounts.length === 0;
    if (isStaleEmpty) {
      try { window.localStorage.removeItem(DB_STORAGE_KEY); } catch { /* ignore */ }
    }

    appendDebugLog("app.init.server_db_mode", {
      enabled: serverDbEnabledRef.current,
      hostname: typeof window !== "undefined" ? window.location.hostname : null,
      port: typeof window !== "undefined" ? (window.location.port || "(default)") : null,
      origin: typeof window !== "undefined" ? window.location.origin : null,
    });
    appendDebugLog("garim-po-debug.page.url", {
      href: typeof window !== "undefined" ? window.location.href : null,
      origin: typeof window !== "undefined" ? window.location.origin : null,
    });
    appendDebugLog("garim-po-debug.api.base_url", {
      db: new URL(DB_API_ENDPOINT, typeof window !== "undefined" ? window.location.origin : "").toString(),
      register: new URL(ONBOARDING_REGISTER_API_ENDPOINT, typeof window !== "undefined" ? window.location.origin : "").toString(),
    });

    loadDbStateAsync(serverDbEnabledRef.current).then((loadedState) => {
      appendDebugLog("app.init.loaded", {
        source: loadedState.source,
        revision: loadedState.revision,
        summary: summarizeDbForDebug(loadedState.db),
      });
      hasServerDbRef.current = serverDbEnabledRef.current && loadedState.source === "server";
      serverRevisionRef.current = loadedState.revision;
      lastPersistedDbRef.current = serializePersistableDbSnapshot(loadedState.db);
      setDb(loadedState.db);
      setIsReady(true);
    });
  }, []);

  // Only persist AFTER the real DB is loaded (isReady gate prevents saving EMPTY_DB)
  useEffect(() => {
    if (isReady && db !== EMPTY_DB) {
      const nextSnapshot = serializePersistableDbSnapshot(db);
      if (nextSnapshot === lastPersistedDbRef.current) return;
      lastPersistedDbRef.current = nextSnapshot;
      const persistableDb = buildPersistableDbSnapshot(db);
      persistValue(DB_STORAGE_KEY, persistableDb);
      dbBroadcastChannelRef.current?.postMessage(nextSnapshot);
      appendDebugLog("db.local.persist", {
        serverEnabled: hasServerDbRef.current,
        summary: summarizeDbForDebug(db),
      });
      if (serverDbEnabledRef.current && hasServerDbRef.current) {
        queueServerPersist(persistableDb, nextSnapshot);
      }
    }
  }, [db, isReady]);

  useEffect(() => {
    appendDebugLog("session.changed", { userId: session.userId });
    persistSessionValue(session);
  }, [session]);

  useEffect(() => {
    if (!isReady) return;

    const syncDbSnapshot = (raw: string | null) => {
      try {
        if (!raw || raw === lastPersistedDbRef.current) return;
        lastPersistedDbRef.current = raw;
        const incomingDb = normalizeDb(JSON.parse(raw) as RentflowDb);
        appendDebugLog("db.sync.storage", {
          summary: summarizeDbForDebug(incomingDb),
        });
        setDb((currentDb) =>
          normalizeDb({
            ...(currentDb ?? EMPTY_DB),
            ...incomingDb,
            integrations: incomingDb.integrations.length ? incomingDb.integrations : currentDb.integrations,
            transactions: incomingDb.transactions.length ? incomingDb.transactions : currentDb.transactions,
            supportIssues: incomingDb.supportIssues.length ? incomingDb.supportIssues : currentDb.supportIssues,
          }),
        );
      } catch {
        // Ignore malformed external writes and keep the current in-memory state.
      }
    };

    const syncDbFromStorage = () => {
      syncDbSnapshot(window.localStorage.getItem(DB_STORAGE_KEY));
    };

    const syncDbFromServer = async () => {
      if (
        !serverDbEnabledRef.current ||
        !hasServerDbRef.current ||
        activeServerPersistRef.current ||
        queuedServerPersistRef.current
      ) return;
      const serverState = await loadServerDbAsync(serverRevisionRef.current);
      if (!serverState) {
        return;
      }
      const nextSnapshot = serializePersistableDbSnapshot(serverState.db);
      if (nextSnapshot === lastPersistedDbRef.current) return;
      hasServerDbRef.current = true;
      serverRevisionRef.current = serverState.revision;
      lastPersistedDbRef.current = nextSnapshot;
      persistValue(DB_STORAGE_KEY, buildPersistableDbSnapshot(serverState.db));
      appendDebugLog("db.sync.server_apply", {
        revision: serverState.revision,
        summary: summarizeDbForDebug(serverState.db),
      });
      setDb(serverState.db);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DB_STORAGE_KEY) syncDbFromStorage();
    };

    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(DB_BROADCAST_CHANNEL)
        : null;
    dbBroadcastChannelRef.current = channel;
    if (channel) {
      channel.onmessage = (event) => {
        if (typeof event.data === "string") {
          syncDbSnapshot(event.data);
        }
      };
    }

    window.addEventListener("storage", handleStorage);
    const intervalId = window.setInterval(() => {
      syncDbFromStorage();
      void syncDbFromServer();
    }, 500);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.clearInterval(intervalId);
      if (dbBroadcastChannelRef.current === channel) {
        dbBroadcastChannelRef.current = null;
      }
      channel?.close();
    };
  }, [isReady]);

  useEffect(() => {
    persistValue(SITE_ACCESS_SESSION_STORAGE_KEY, siteAccessSession);
  }, [siteAccessSession]);

  useEffect(() => {
    persistValue(SITE_ACCESS_ACTIVATIONS_STORAGE_KEY, siteAccessActivations);
  }, [siteAccessActivations]);

  useEffect(() => {
    if (
      siteAccessSession &&
      !isSiteAccessSessionValid({ session: siteAccessSession, activations: siteAccessActivations })
    ) {
      setSiteAccessSession(null);
    }
  }, [siteAccessSession, siteAccessActivations]);

  const currentUser = session.userId ? findUser(db, session.userId) : null;

  const applyDbUpdate = (updater: (nextDb: RentflowDb) => void) => {
    setDb((previousDb) => {
      // Shallow-clone only the top-level DB object so React sees a new reference,
      // then mutate arrays in-place inside the updater. This avoids deep-copying
      // the entire multi-MB dataset on every action.
      const nextDb: RentflowDb = { ...(previousDb ?? EMPTY_DB) };
      updater(nextDb);
      appendDebugLog("db.apply_local_update", {
        summary: summarizeDbForDebug(nextDb),
      });
      return nextDb;
    });
  };

  const applyServerDb = (serverDb: RentflowDb, revision: number | null = serverRevisionRef.current) => {
    appendDebugLog("db.apply_server", {
      revision,
      summary: summarizeDbForDebug(serverDb),
    });
    const nextSnapshot = serializePersistableDbSnapshot(serverDb);
    queuedServerPersistRef.current = null;
    activeServerPersistRef.current = null;
    hasServerDbRef.current = serverDbEnabledRef.current;
    serverRevisionRef.current = revision;
    lastPersistedDbRef.current = nextSnapshot;
    persistValue(DB_STORAGE_KEY, buildPersistableDbSnapshot(serverDb));
    dbBroadcastChannelRef.current?.postMessage(nextSnapshot);
    setDb(serverDb);
  };

  const applyOnboardingSync = (sync: OnboardingSyncResponse) => {
    appendDebugLog("onboarding.sync.apply", {
      revision: sync.revision,
      userId: sync.userId,
      propertyId: sync.propertyId,
      contractId: sync.records.contract?.id ?? null,
      onboardingStep: sync.records.user?.onboardingStep ?? null,
    });
    hasServerDbRef.current = serverDbEnabledRef.current;
    serverRevisionRef.current = sync.revision;
    queuedServerPersistRef.current = null;
    activeServerPersistRef.current = null;
    setDb((previousDb) => {
      const nextDb = mergeOnboardingRecords(previousDb ?? EMPTY_DB, sync);
      const nextSnapshot = serializePersistableDbSnapshot(nextDb);
      if (nextSnapshot === lastPersistedDbRef.current) return previousDb;
      lastPersistedDbRef.current = nextSnapshot;
      persistValue(DB_STORAGE_KEY, buildPersistableDbSnapshot(nextDb));
      dbBroadcastChannelRef.current?.postMessage(nextSnapshot);
      return nextDb;
    });
  };

  const syncOnboardingStatus = async (propertyId: string) => {
    appendDebugLog("onboarding.status.fetch", { propertyId });
    const sync = await fetchOnboardingStatus(propertyId);
    if (sync) {
      applyOnboardingSync(sync);
    }
  };

  const postOnboardingAction = async (payload: Record<string, unknown>) => {
    appendDebugLog("onboarding.action.start", payload);
    const sync = await postOnboardingMutation(ONBOARDING_ACTION_API_ENDPOINT, payload);
    if (sync) {
      applyOnboardingSync(sync);
      return true;
    }
    appendDebugLog("onboarding.action.no_sync", payload);
    return false;
  };

  const login = async (email: string, password: string, propertyId?: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (propertyId) {
      try {
        const result = await postOnboardingMutation(ONBOARDING_LOGIN_API_ENDPOINT, {
          email: normalizedEmail,
          password,
          propertyId,
        });

        if (result) {
          applyOnboardingSync(result);
          setSession({ userId: result.userId });
          return;
        }
      } catch (err) {
        console.warn("[login] server login failed, using local fallback:", err);
      }
    }

    const account = db.authAccounts.find(
      (candidate) =>
        candidate.email.toLowerCase() === normalizedEmail && candidate.password === password,
    );

    if (!account) {
      throw new Error("פרטי התחברות שגויים");
    }

    // Special case for demo user: Reset onboarding state on every login
    // This allows the user to re-experience the onboarding flow as requested.
    if (normalizedEmail === "noa@example.com") {
      restartOnboarding(account.userId);
    }

    if (propertyId) {
      applyDbUpdate((nextDb) => {
        startTenantOnboardingForProperty(nextDb, account.userId, propertyId);
      });
    }

    setSession({ userId: account.userId });
  };

  const requestSiteAccess = (username: string, password: string) => {
    const result = authenticateSiteAccess({
      username,
      password,
      activations: siteAccessActivations,
    });

    setSiteAccessActivations(result.activations);

    if (!result.ok || !result.session) {
      throw new Error(result.error || "הגישה נדחתה");
    }

    setSiteAccessSession(result.session);
  };

  const register = async ({ name, email, password, role, propertyId }: RegisterPayload) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (propertyId) {
      try {
        appendDebugLog("garim-po-debug.register.endpoint", {
          endpoint: ONBOARDING_REGISTER_API_ENDPOINT,
          resolved: new URL(ONBOARDING_REGISTER_API_ENDPOINT, typeof window !== "undefined" ? window.location.origin : "").toString(),
          email: normalizedEmail,
          propertyId,
        });
        const result = await postOnboardingMutation(ONBOARDING_REGISTER_API_ENDPOINT, {
          name,
          email: normalizedEmail,
          password,
          role,
          propertyId,
        });

        if (result) {
          applyOnboardingSync(result);
          setSession({ userId: result.userId });
          return;
        }
      } catch (err) {
        // Server error (e.g. property not in server DB, network issue) — fall through to local registration
        console.warn("[register] server registration failed, using local fallback:", err);
      }
    }

    if (db.authAccounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
      throw new Error("האימייל כבר בשימוש");
    }

    const userId = buildId(role);
    applyDbUpdate((nextDb) => {
      nextDb.authAccounts.push({
        userId,
        email: normalizedEmail,
        password,
      });
      nextDb.users.push({
        id: userId,
        name,
        email: normalizedEmail,
        role,
        phone: "",
        kycStatus: role === "tenant" ? "pending" : "approved",
        bdiStatus: role === "tenant" ? "pending" : "green",
        onboardingStep: role === "tenant" ? 0 : 5,
        onboardingComplete: role !== "tenant",
        createdAt: nowIso(),
      });

      if (role === "tenant" && propertyId) {
        startTenantOnboardingForProperty(nextDb, userId, propertyId);
      }
    });
    setSession({ userId });
  };

  const linkProperty = async (userId: string, propertyId: string) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user || user.role !== "tenant") return;

      startTenantOnboardingForProperty(nextDb, user.id, propertyId);
    });
  };

  const logout = () => {
    setSession({ userId: null });
  };

  const clearSiteAccess = () => {
    setSiteAccessSession(null);
  };

  const resetDatabase = () => {
    const loadFreshDb = serverDbEnabledRef.current && hasServerDbRef.current
      ? resetServerDbAsync().then(
          async (serverState) => serverState ?? { db: await loadSeedDbAsync(), revision: null },
        )
      : loadSeedDbAsync().then((seedDb) => ({ db: seedDb, revision: null }));

    loadFreshDb.then((freshState) => {
      const freshDb = freshState.db;
      serverRevisionRef.current = freshState.revision;
      hasServerDbRef.current = serverDbEnabledRef.current && freshState.revision !== null;
      setDb(freshDb);
      if (session.userId) {
        const nextUser = freshDb.users.find((user) => user.id === session.userId);
        if (!nextUser) {
          setSession({ userId: null });
        }
      }
    });
  };

  const updateUser = (userId: string, patch: Partial<User>) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user) return;
      Object.assign(user, patch);
    });
  };

  const submitKyc = (userId: string) => {
    updateUser(userId, { kycStatus: "submitted", onboardingStep: 1 });
  };

  const approveKyc = (userId: string) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user) return;
      user.kycStatus = "approved";
      user.onboardingStep = Math.max(user.onboardingStep ?? 0, 1);
      const contract = nextDb.contracts.find(
        (item) => item.tenantId === userId && item.status === "waiting_kyc",
      );
      if (contract) contract.status = "waiting_bdi";
    });
  };

  const requestEligibilityCheck = (userId: string, landlordId?: string, propertyId?: string) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user) return;

      const existing = nextDb.eligibilityChecks.find((check) => check.tenantId === userId);
      if (existing) {
        existing.status = "pending";
        existing.checkedAt = nowIso();
        existing.notes = "הבדיקה נשלחה לעיון מחדש.";
      } else {
        nextDb.eligibilityChecks.push({
          id: buildId("eligibility"),
          tenantId: userId,
          landlordId,
          status: "pending",
          score: 0,
          grade: "בהמתנה",
          recommendation: "review",
          checkedAt: nowIso(),
          provider: "BDI",
          notes: "בדיקה חדשה הוגשה מתוך תהליך האונבורדינג.",
        });
      }

      user.bdiStatus = "pending";
      user.onboardingStep = Math.max(user.onboardingStep ?? 0, 2);
    });

    if (propertyId) {
      postOnboardingAction({
        action: "request_eligibility_check",
        tenantId: userId,
        propertyId,
        landlordId,
      }).catch((err) => {
        console.warn("[requestEligibilityCheck] server action failed, relying on local state:", err);
      });
    }
  };

  const resolveEligibilityCheck = (userId: string, approved: boolean) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      const check = nextDb.eligibilityChecks.find((item) => item.tenantId === userId);
      if (!user || !check) return;

      check.status = approved ? "approved" : "rejected";
      check.score = approved ? 782 : 530;
      check.grade = approved ? "A+" : "C";
      check.recommendation = approved ? "approve" : "decline";
      check.checkedAt = nowIso();
      check.notes = approved
        ? "המשכיר קיבל המלצה חיובית להמשך התהליך."
        : "המערכת סימנה את הבדיקה באדום ודורשת בירור.";

      user.bdiStatus = approved ? "green" : "red";
      user.onboardingStep = approved ? 3 : 2;

      const contract = nextDb.contracts.find(
        (item) =>
          item.tenantId === userId &&
          ["waiting_bdi", "waiting_kyc", "pending"].includes(item.status),
      );

      if (contract && approved) {
        contract.status = "waiting_bank_auth";
      }
    });
  };

  const skipEligibilityCheck = (userId: string, landlordId?: string) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user) return;

      const contract = findOnboardingContract(nextDb, userId);
      const existing = nextDb.eligibilityChecks.find((check) => check.tenantId === userId);
      const checkPayload = {
        status: "approved" as const,
        score: 782,
        grade: "A+",
        recommendation: "approve" as const,
        checkedAt: nowIso(),
        provider: "BDI - אישור ידני",
        notes: "בדיקת דירוג האשראי דולגה ונרשמה אינדיקציה חיובית ידנית להמשך חתימה.",
      };

      if (existing) {
        Object.assign(existing, checkPayload);
      } else {
        nextDb.eligibilityChecks.push({
          id: buildId("eligibility"),
          tenantId: userId,
          landlordId: landlordId ?? contract?.landlordId,
          standalone: false,
          ...checkPayload,
        });
      }

      user.bdiStatus = "green";
      user.onboardingStep = Math.max(user.onboardingStep ?? 0, 3);

      if (contract && ["waiting_bdi", "waiting_kyc", "pending"].includes(contract.status)) {
        contract.status = "waiting_bank_auth";
      }
    });
  };

  const saveOnboardingAgreement = (userId: string, payload: SaveOnboardingAgreementPayload) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      const contract = findOnboardingContract(nextDb, userId);
      if (!user || !contract) return;

      const property = findProperty(nextDb, contract.propertyId);
      const rentAmount = Math.max(0, payload.rentAmount);
      const buildingCommitteeAmount = Math.max(0, payload.buildingCommitteeAmount);
      const arnonaAmount = Math.max(0, payload.arnonaAmount);
      const monthlyPaymentAmount = calculateMonthlyPayment(
        rentAmount,
        buildingCommitteeAmount,
        arnonaAmount,
        payload.utilityPaymentMode,
      );

      contract.rentAmount = rentAmount;
      contract.buildingCommitteeAmount = buildingCommitteeAmount;
      contract.arnonaAmount = arnonaAmount;
      contract.utilityPaymentMode = payload.utilityPaymentMode;
      contract.monthlyPaymentAmount = monthlyPaymentAmount;
      contract.tenantQrScannedAt = payload.tenantQrScanned ? (contract.tenantQrScannedAt ?? nowIso()) : undefined;
      contract.landlordQrScannedAt = payload.landlordQrScanned ? (contract.landlordQrScannedAt ?? nowIso()) : undefined;
      contract.contractUploadedAt = payload.contractDocumentUploaded ? (contract.contractUploadedAt ?? nowIso()) : undefined;
      contract.contractClausesApprovedAt = payload.clausesApproved ? (contract.contractClausesApprovedAt ?? nowIso()) : undefined;

      if (property) {
        property.rent = rentAmount;
        property.costs = {
          buildingCommittee: buildingCommitteeAmount,
          arnona: arnonaAmount,
          utilities: property.costs?.utilities ?? 0,
        };
      }

      const contractDocument = nextDb.documents.find(
        (document) =>
          document.ownerType === "contract" &&
          document.ownerId === contract.id &&
          document.category === "contract",
      );

      if (contractDocument && payload.contractDocumentUploaded) {
        contractDocument.status = "ready";
        contractDocument.uploadedAt = todayIso();
        contractDocument.url = contractDocument.url ?? contract.documentUrl;
      }

      user.onboardingStep = Math.max(user.onboardingStep ?? 0, payload.clausesApproved ? 2 : 1);
    });
  };

  const saveBankAuthorization = (userId: string) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user) return;
      user.onboardingStep = Math.max(user.onboardingStep ?? 0, 4);
      const contract = nextDb.contracts.find(
        (item) => item.tenantId === userId && item.status === "waiting_bank_auth",
      );
      if (contract) {
        contract.status = "waiting_signature";
      }

      const existingDoc = nextDb.documents.find(
        (document) =>
          document.ownerType === "contract" &&
          document.ownerId === contract?.id &&
          document.category === "bank_auth",
      );
      if (existingDoc) {
        existingDoc.status = "ready";
        existingDoc.uploadedAt = todayIso();
      }
    });
  };

  const signOnboardingContract = (userId: string) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user) return;
      const contract =
        nextDb.contracts.find(
          (item) => item.tenantId === userId && item.status === "waiting_signature",
        ) ??
        nextDb.contracts.find(
          (item) =>
            item.tenantId === userId &&
            item.status !== "active" &&
            item.status !== "expired",
        );
      if (!contract) return;

      contract.signedByTenantAt = nowIso();
      contract.signedByLandlordAt = contract.signedByLandlordAt ?? nowIso();
      contract.status = "active";
      user.onboardingStep = 5;

      const property = findProperty(nextDb, contract.propertyId);
      if (property) {
        property.status = "occupied";
        property.tenantId = userId;
      }
    });
  };

  const completeOnboarding = (userId: string) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user) return;

      const completedAt = nowIso();
      user.onboardingComplete = true;
      user.onboardingStep = 5;
      user.kycStatus = user.kycStatus === "pending" ? "approved" : user.kycStatus;
      user.bdiStatus = user.bdiStatus === "pending" ? "green" : user.bdiStatus;

      const contract = findOnboardingContract(nextDb, userId);
      if (contract) {
        contract.status = "active";
        contract.tenantQrScannedAt = contract.tenantQrScannedAt ?? completedAt;
        contract.signedByTenantAt = contract.signedByTenantAt ?? completedAt;
        contract.signedByLandlordAt = contract.signedByLandlordAt ?? completedAt;
        contract.monthlyPaymentAmount = calculateMonthlyPayment(
          contract.rentAmount ?? 0,
          contract.buildingCommitteeAmount ?? 0,
          contract.arnonaAmount ?? 0,
          contract.utilityPaymentMode ?? "separate",
        );

        const property = findProperty(nextDb, contract.propertyId);
        if (property) {
          property.status = "occupied";
          property.tenantId = userId;
        }
      }

      nextDb.onboardingInvites.forEach((invite) => {
        if (
          invite.tenantEmail.toLowerCase() === user.email.toLowerCase() &&
          (!contract || invite.propertyId === contract.propertyId)
        ) {
          invite.status = "completed";
        }
      });
    });
  };

  const cancelTenantOnboarding = (
    landlordId: string,
    payload: CancelTenantOnboardingPayload,
  ) => {
    applyDbUpdate((nextDb) => {
      const property = findProperty(nextDb, payload.propertyId);
      const tenant = findUser(nextDb, payload.tenantId);
      if (!property || property.landlordId !== landlordId || !tenant || tenant.role !== "tenant") return;

      const tenantEmail = tenant.email.toLowerCase();
      const relatedContracts = nextDb.contracts.filter(
        (contract) =>
          contract.propertyId === property.id &&
          contract.tenantId === tenant.id &&
          contract.status !== "active" &&
          contract.status !== "expired",
      );

      relatedContracts.forEach((contract) => {
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

      nextDb.onboardingInvites.forEach((invite) => {
        if (
          invite.propertyId === property.id &&
          invite.tenantEmail.toLowerCase() === tenantEmail &&
          invite.status !== "completed"
        ) {
          invite.status = "completed";
        }
      });
    });
    postOnboardingAction({
      action: "cancel",
      landlordId,
      propertyId: payload.propertyId,
      tenantId: payload.tenantId,
    }).catch((err) => {
      console.warn("[cancelTenantOnboarding] server action failed, relying on local state:", err);
    });
  };

  const restartOnboarding = (userId: string) => {
    applyDbUpdate((nextDb) => {
      const user = findUser(nextDb, userId);
      if (!user) return;

      user.onboardingComplete = false;
      user.onboardingStep = 0;
      user.kycStatus = "pending";
      user.bdiStatus = "pending";

      const contract = findOnboardingContract(nextDb, userId);
      if (contract) {
        contract.status = "waiting_kyc";
        contract.tenantQrScannedAt = undefined;
        contract.landlordQrScannedAt = undefined;
        contract.contractUploadedAt = undefined;
        contract.contractClausesApprovedAt = undefined;
        contract.signedByTenantAt = undefined;
        contract.monthlyPaymentAmount = calculateMonthlyPayment(
          contract.rentAmount ?? 0,
          contract.buildingCommitteeAmount ?? 0,
          contract.arnonaAmount ?? 0,
          contract.utilityPaymentMode ?? "separate",
        );
      }

      const property = contract ? findProperty(nextDb, contract.propertyId) : null;
      if (property) {
        property.status = "vacant";
        property.tenantId = undefined;
      }
    });
  };

  const addProperty = (landlordId: string, payload: AddPropertyPayload) => {
    const propertyId = buildId("property");
    applyDbUpdate((nextDb) => {
      nextDb.properties.unshift({
        id: propertyId,
        address: payload.address,
        rent: payload.rent,
        status: "vacant",
        landlordId,
        costs: {
          buildingCommittee: payload.buildingCommittee ?? 0,
          arnona: payload.arnona ?? 0,
          utilities: payload.utilities ?? 0,
        },
        description: payload.description,
        createdAt: nowIso(),
        catalogStatus: "draft",
      });
    });
    return propertyId;
  };

  const inviteTenant = (landlordId: string, payload: InviteTenantPayload) => {
    applyDbUpdate((nextDb) => {
      const property = findProperty(nextDb, payload.propertyId);
      if (!property) return;

      upsertOnboardingInvite(nextDb, {
        landlordId,
        tenantEmail: payload.tenantEmail,
        tenantPhone: payload.tenantPhone,
        propertyId: payload.propertyId,
        status: "sent",
        contractVisibilityStep: payload.contractVisibilityStep ?? 2,
        landlordCreditSkipApproved: Boolean(payload.landlordCreditSkipApproved),
      });
    });
    postOnboardingAction({
      action: "invite",
      landlordId,
      propertyId: payload.propertyId,
      tenantEmail: payload.tenantEmail,
      tenantPhone: payload.tenantPhone,
      landlordCreditSkipApproved: Boolean(payload.landlordCreditSkipApproved),
    }).catch((err) => {
      console.warn("[inviteTenant] server action failed, relying on local state:", err);
    });
  };

  const setTenantCreditSkipApproval = (
    landlordId: string,
    payload: CreditSkipApprovalPayload,
  ) => {
    applyDbUpdate((nextDb) => {
      const property = findProperty(nextDb, payload.propertyId);
      if (!property) return;

      const tenant =
        (property.tenantId ? findUser(nextDb, property.tenantId) : null) ??
        nextDb.users.find(
          (candidate) =>
            payload.tenantEmail &&
            candidate.email.toLowerCase() === payload.tenantEmail.toLowerCase(),
        ) ??
        null;
      const tenantEmail = (payload.tenantEmail || tenant?.email || "").trim().toLowerCase();
      if (!tenantEmail) return;

      upsertOnboardingInvite(nextDb, {
        landlordId,
        propertyId: property.id,
        tenantEmail,
        tenantPhone: tenant?.phone,
        status: tenant ? "opened" : "sent",
        contractVisibilityStep: 2,
        landlordCreditSkipApproved: payload.approved,
      });
    });
    postOnboardingAction({
      action: "credit_skip_approval",
      landlordId,
      propertyId: payload.propertyId,
      tenantEmail: payload.tenantEmail,
      approved: payload.approved,
    }).catch((err) => {
      console.warn("[setTenantCreditSkipApproval] server action failed, relying on local state:", err);
    });
  };

  const createContract = (landlordId: string, payload: CreateContractPayload) => {
    applyDbUpdate((nextDb) => {
      const property = findProperty(nextDb, payload.propertyId);
      if (!property) return;

      const normalizedEmail = payload.tenantEmail.trim().toLowerCase();
      let tenant = nextDb.users.find((user) => user.email.toLowerCase() === normalizedEmail);

      if (!tenant) {
        const tenantId = buildId("tenant");
        tenant = {
          id: tenantId,
          name: payload.tenantName,
          email: normalizedEmail,
          role: "tenant",
          phone: payload.tenantPhone,
          kycStatus: "pending",
          bdiStatus: "pending",
          onboardingStep: 0,
          onboardingComplete: false,
          createdAt: nowIso(),
        };
        nextDb.users.push(tenant);
        nextDb.authAccounts.push({
          userId: tenantId,
          email: normalizedEmail,
          password: "123123",
        });
      }

      const contractId = buildId("contract");
      const buildingCommitteeAmount =
        payload.buildingCommitteeAmount ?? property.costs?.buildingCommittee ?? 0;
      const arnonaAmount = payload.arnonaAmount ?? property.costs?.arnona ?? 0;
      const utilityPaymentMode = payload.utilityPaymentMode ?? "separate";
      nextDb.contracts.unshift({
        id: contractId,
        propertyId: payload.propertyId,
        propertyAddress: property.address,
        landlordId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        partners: payload.partners,
        isSplitPayment: payload.isSplitPayment,
        startDate: payload.startDate,
        endDate: payload.endDate,
        rentAmount: payload.rentAmount,
        buildingCommitteeAmount,
        arnonaAmount,
        utilityPaymentMode,
        monthlyPaymentAmount: calculateMonthlyPayment(
          payload.rentAmount,
          buildingCommitteeAmount,
          arnonaAmount,
          utilityPaymentMode,
        ),
        status: "waiting_kyc",
        guaranteeType: payload.guaranteeType,
        createdAt: nowIso(),
        templateId: payload.isSplitPayment ? "template_split" : "template_standard",
      });

      nextDb.documents.unshift({
        id: buildId("document"),
        ownerType: "contract",
        ownerId: contractId,
        label: payload.isSplitPayment ? "טיוטת חוזה שותפים" : "טיוטת חוזה שכירות",
        category: "contract",
        status: "pending",
      });

      nextDb.onboardingInvites.unshift({
        id: buildId("invite"),
        landlordId,
        tenantEmail: normalizedEmail,
        tenantPhone: payload.tenantPhone,
        propertyId: payload.propertyId,
        sentAt: nowIso(),
        status: "sent",
        contractVisibilityStep: 2,
      });
    });
  };

  const deleteContract = (contractId: string) => {
    applyDbUpdate((nextDb) => {
      nextDb.contracts = nextDb.contracts.filter(c => c.id !== contractId);
    });
  };

  const signContract = (contractId: string, signerId: string) => {
    applyDbUpdate((nextDb) => {
      const contract = nextDb.contracts.find((item) => item.id === contractId);
      if (!contract) return;

      if (signerId === contract.tenantId) {
        const signer = findUser(nextDb, signerId);
        if (contract.guaranteeType === "promissory" && signer?.bdiStatus !== "green") {
          return;
        }
        contract.signedByTenantAt = nowIso();
      }
      if (signerId === contract.landlordId) {
        contract.signedByLandlordAt = nowIso();
      }

      if (contract.signedByTenantAt && (contract.signedByLandlordAt || contract.landlordId)) {
        contract.status = "active";
        const property = findProperty(nextDb, contract.propertyId);
        if (property) {
          property.status = "occupied";
          property.tenantId = contract.tenantId;
        }
      }
    });
  };

  const createManualPayment = (actor: User, payload: CreatePaymentPayload) => {
    applyDbUpdate((nextDb) => {
      const property = findProperty(nextDb, payload.propertyId);
      if (!property) return;
      const tenant = property.tenantId ? findUser(nextDb, property.tenantId) : null;

      nextDb.payments.unshift({
        id: buildId("payment"),
        propertyId: payload.propertyId,
        propertyAddress: property.address,
        landlordId: property.landlordId,
        tenantId: property.tenantId ?? actor.id,
        tenantName: payload.tenantName || tenant?.name,
        amount: payload.amount,
        date: payload.date ?? todayIso(),
        status: payload.status ?? "paid",
        type: payload.type,
        createdAt: nowIso(),
        source: "manual",
      });
    });
  };

  const updatePaymentStatus = (paymentId: string, status: Payment["status"]) => {
    applyDbUpdate((nextDb) => {
      const payment = nextDb.payments.find((item) => item.id === paymentId);
      if (!payment) return;
      payment.status = status;
      if (status === "paid") {
        nextDb.transfers.unshift({
          id: buildId("transfer"),
          paymentId: payment.id,
          landlordId: payment.landlordId ?? "",
          propertyId: payment.propertyId,
          amount: payment.amount,
          transferDate: todayIso(),
          settlementDate: todayIso(),
          status: "settled",
          proofLabel: `אסמכתא אוטומטית #${payment.id.slice(-4)}`,
        });
      }
    });
  };

  const submitRetryRequest = (tenantId: string, payload: SubmitRetryPayload) => {
    applyDbUpdate((nextDb) => {
      const payment = nextDb.payments.find((item) => item.id === payload.paymentId);
      if (!payment || !payment.landlordId) return;

      const retry: PaymentRetryRequest = {
        id: buildId("retry"),
        paymentId: payment.id,
        tenantId,
        landlordId: payment.landlordId,
        reason: payload.reason,
        note: payload.note,
        preferredRetryDate: payload.preferredRetryDate,
        status: "requested",
        requestedAt: nowIso(),
        updatedAt: nowIso(),
      };

      nextDb.paymentRetries.unshift(retry);
      payment.expectedRetryDate = payload.preferredRetryDate;

      const tenant = findUser(nextDb, tenantId);
      if (tenant) tenant.pendingPaymentRetry = true;

      const property = findProperty(nextDb, payment.propertyId);
      const topic = ensureTopic(
        nextDb,
        [tenantId, payment.landlordId],
        payment.propertyId,
        property ? `${property.address} - תשלומים ותחזוקה` : "שיחה עם בעל הנכס",
        "payment_retry",
      );

      pushMessage(nextDb, {
        id: buildId("message"),
        topicId: topic.id,
        senderId: "system",
        senderRole: "system",
        text: "נפתחה בקשת חיוב חוזר חדשה וממתינה לאישור בעל הנכס.",
        createdAt: nowIso(),
        kind: "system",
      });

      pushMessage(nextDb, {
        id: buildId("message"),
        topicId: topic.id,
        senderId: tenantId,
        senderRole: "tenant",
        text: payload.note || `מבקש לנסות שוב ב-${payload.preferredRetryDate}.`,
        createdAt: nowIso(),
        kind: "text",
      });

      upsertNotification(nextDb, {
        id: buildId("notification"),
        userId: payment.landlordId,
        tone: "warning",
        title: "בקשת חיוב חוזר חדשה",
        description: `${payment.tenantName || "השוכר"} ביקש לחייב שוב ב-${payload.preferredRetryDate}.`,
        createdAt: nowIso(),
        read: false,
      });
    });
  };

  const resolveRetryRequest = (_landlordId: string, payload: ResolveRetryPayload) => {
    applyDbUpdate((nextDb) => {
      const retryRequest = nextDb.paymentRetries.find(
        (item) => item.id === payload.retryRequestId,
      );
      if (!retryRequest) return;

      retryRequest.status = payload.approved ? "approved" : "rejected";
      retryRequest.updatedAt = nowIso();

      const payment = nextDb.payments.find((item) => item.id === retryRequest.paymentId);
      if (payment) {
        payment.status = payload.approved ? "pending" : "failed";
        payment.expectedRetryDate = retryRequest.preferredRetryDate;
      }

      const tenant = findUser(nextDb, retryRequest.tenantId);
      if (tenant) tenant.pendingPaymentRetry = false;

      const property = payment ? findProperty(nextDb, payment.propertyId) : null;
      const topic = ensureTopic(
        nextDb,
        [retryRequest.tenantId, retryRequest.landlordId],
        payment?.propertyId,
        property ? `${property.address} - תשלומים ותחזוקה` : "שיחה עם בעל הנכס",
        "payment_retry",
      );

      pushMessage(nextDb, {
        id: buildId("message"),
        topicId: topic.id,
        senderId: retryRequest.landlordId,
        senderRole: "landlord",
        text: payload.approved
          ? `אישרתי את החיוב החוזר ל-${retryRequest.preferredRetryDate}.`
          : "כרגע לא ניתן לאשר את מועד החיוב שביקשת, נצטרך לתאם חלופה.",
        createdAt: nowIso(),
        kind: "text",
      });
    });
  };

  const createServiceCall = (tenantId: string, payload: CreateServiceCallPayload) => {
    applyDbUpdate((nextDb) => {
      const property = findProperty(nextDb, payload.propertyId);
      if (!property || !property.landlordId) return;

      nextDb.serviceCalls.unshift({
        id: buildId("call"),
        propertyId: property.id,
        propertyAddress: property.address,
        tenantId,
        landlordId: property.landlordId,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        category: payload.category,
        status: "open",
        createdAt: nowIso(),
      });
    });
  };

  const updateServiceCall = (callId: string, patch: Partial<ServiceCall>) => {
    applyDbUpdate((nextDb) => {
      const serviceCall = nextDb.serviceCalls.find((item) => item.id === callId);
      if (!serviceCall) return;
      Object.assign(serviceCall, patch);
      if (patch.status === "closed") {
        serviceCall.closedAt = nowIso();
      } else if ("status" in patch) {
        serviceCall.closedAt = undefined;
      }
      if ("vendorId" in patch && !patch.vendorId) {
        serviceCall.vendorId = undefined;
        serviceCall.assignedVendor = undefined;
      }
      if (patch.vendorId) {
        const vendor = nextDb.vendors.find((item) => item.id === patch.vendorId);
        if (vendor) {
          serviceCall.assignedVendor = vendor.name;
        }
      }
    });
  };

  const sendMessage = (payload: SendMessagePayload) => {
    applyDbUpdate((nextDb) => {
      const topic = nextDb.messageTopics.find((item) => item.id === payload.topicId);
      if (!topic || !payload.text.trim()) return;
      pushMessage(nextDb, {
        id: buildId("message"),
        topicId: payload.topicId,
        senderId: payload.senderId,
        senderRole: findUser(nextDb, payload.senderId)?.role,
        text: payload.text.trim(),
        createdAt: nowIso(),
        kind: "text",
      });
    });
  };

  const createUtilityCharge = (landlordId: string, payload: CreateUtilityChargePayload) => {
    applyDbUpdate((nextDb) => {
      const property = findProperty(nextDb, payload.propertyId);
      if (!property || !property.tenantId) return;

      nextDb.utilityCharges.unshift({
        id: buildId("utility"),
        propertyId: property.id,
        landlordId,
        tenantId: property.tenantId,
        label: payload.label,
        provider: payload.provider,
        amount: payload.amount,
        dueDate: payload.dueDate,
        status: "pending",
      });
    });
  };

  const createDebtLetter = (paymentId: string) => {
    applyDbUpdate((nextDb) => {
      const payment = nextDb.payments.find((item) => item.id === paymentId);
      if (!payment || !payment.landlordId) return;

      const legalCaseId = buildId("legal");
      nextDb.legalCases.unshift({
        id: legalCaseId,
        paymentId: payment.id,
        propertyId: payment.propertyId,
        landlordId: payment.landlordId,
        tenantId: payment.tenantId,
        amount: payment.amount,
        status: "warning_sent",
        stageLabel: "מכתב התראה נשלח",
        openedAt: nowIso(),
        description: "מכתב התראה אוטומטי הופק ונשמר בארכיון המסמכים.",
      });

      nextDb.documents.unshift({
        id: buildId("document"),
        ownerType: "legal_case",
        ownerId: legalCaseId,
        label: `מכתב התראה - ${payment.propertyAddress || payment.propertyId}`,
        category: "warning_letter",
        status: "ready",
        uploadedAt: todayIso(),
      });
    });
  };

  return (
    <AppDataContext.Provider
      value={{
        db: db ?? EMPTY_DB,
        currentUser,
        siteAccessSession,
        isReady,
        requestSiteAccess,
        clearSiteAccess,
        login,
        register,
        applyOnboardingSync,
        syncOnboardingStatus,
        logout,
        resetDatabase,
        updateUser,
        submitKyc,
        approveKyc,
        requestEligibilityCheck,
        resolveEligibilityCheck,
        skipEligibilityCheck,
        saveOnboardingAgreement,
        saveBankAuthorization,
        signOnboardingContract,
        completeOnboarding,
        cancelTenantOnboarding,
        addProperty,
        inviteTenant,
        setTenantCreditSkipApproval,
        createContract,
        deleteContract,
        signContract,
        createManualPayment,
        updatePaymentStatus,
        submitRetryRequest,
        resolveRetryRequest,
        createServiceCall,
        updateServiceCall,
        sendMessage,
        createUtilityCharge,
        createDebtLetter,
        restartOnboarding,
        linkProperty,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return value;
}

export function getMessagesForTopic(db: RentflowDb, topicId: string) {
  return db.messages
    .filter((message) => message.topicId === topicId)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

export function getTopicsForUser(db: RentflowDb, userId: string) {
  return db.messageTopics
    .filter((topic) => topic.participantIds.includes(userId))
    .sort((left, right) => Date.parse(right.lastMessageAt) - Date.parse(left.lastMessageAt));
}

export function getTopicCounterparty(
  db: RentflowDb,
  topicId: string,
  currentUserId: string,
) {
  const topic = db.messageTopics.find((item) => item.id === topicId);
  if (!topic) return null;
  const counterpartyId = topic.participantIds.find((participantId) => participantId !== currentUserId);
  return counterpartyId ? findUser(db, counterpartyId) : null;
}

export function getDocumentsForOwner(
  db: RentflowDb,
  ownerType: DocumentRecord["ownerType"],
  ownerId: string,
) {
  return db.documents.filter(
    (document) => document.ownerType === ownerType && document.ownerId === ownerId,
  );
}
