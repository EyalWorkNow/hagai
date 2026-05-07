import os from "os";
import { createRequire } from "module";
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
} from "../types";

const require = createRequire(import.meta.url);
const seedDb = require("../data/garim-po-db.json") as RentflowDb;

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

type OnboardingListener = (payload: OnboardingSyncResponse) => void;

let runtimeDb = normalizeDb(seedDb as RentflowDb);
let runtimeDbRevision = 1;
const onboardingSubscribers = new Map<string, Set<OnboardingListener>>();

export function normalizeDb(rawDb: RentflowDb): RentflowDb {
  const db = structuredClone(rawDb);

  db.properties = db.properties.map((property) => ({
    ...property,
    costs: property.costs ?? { buildingCommittee: 0, arnona: 0, utilities: 0 },
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

function cloneDb(): RentflowDb {
  return normalizeDb(runtimeDb);
}

export function getRuntimeDbRevision() {
  return runtimeDbRevision;
}

export function getRuntimeDbSnapshot() {
  return cloneDb();
}

export function getClientDbRevision(headers: { [key: string]: string | string[] | undefined }) {
  const rawRevision = headers["x-db-base-revision"];
  const revision = Array.isArray(rawRevision) ? rawRevision[0] : rawRevision;
  if (!revision) return null;
  const parsed = Number(revision);
  return Number.isFinite(parsed) ? parsed : null;
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

export function getOnboardingSyncResponse(
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

function notifyOnboardingSubscribers(propertyId: string) {
  const subscribers = onboardingSubscribers.get(propertyId);
  if (!subscribers?.size) return;
  const payload = getOnboardingSyncResponse(propertyId);
  if (!payload) return;
  for (const subscriber of subscribers) {
    subscriber(payload);
  }
}

function notifyAllOnboardingSubscribers() {
  for (const propertyId of onboardingSubscribers.keys()) {
    notifyOnboardingSubscribers(propertyId);
  }
}

function commitRuntimeDb(propertyIds: Array<string | null | undefined>) {
  runtimeDb = normalizeDb(runtimeDb);
  runtimeDbRevision += 1;
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

export function registerUserForOnboarding(payload: {
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
  return sync
    ? { sync, status: 200 as const }
    : { error: "סנכרון הדייר נכשל", status: 500 as const };
}

export function loginUserForOnboarding(payload: {
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

export function inviteTenantForOnboarding(payload: {
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

export function setCreditSkipApprovalForOnboarding(payload: {
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

export function cancelTenantOnboardingOnServer(payload: {
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

export function replaceRuntimeDb(incomingDb: Partial<RentflowDb>, clientRevision: number | null) {
  if (
    !incomingDb ||
    !Array.isArray(incomingDb.users) ||
    !Array.isArray(incomingDb.properties) ||
    !Array.isArray(incomingDb.contracts)
  ) {
    return { error: "Invalid database snapshot", status: 400 as const };
  }

  if (runtimeDbRevision > 1 && (clientRevision === null || clientRevision < runtimeDbRevision)) {
    return {
      error: "Database snapshot is stale",
      status: 200 as const,
      stale: true,
      revision: runtimeDbRevision,
      db: cloneDb(),
    };
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
  for (const propertyId of affectedPropertyIds) {
    notifyOnboardingSubscribers(propertyId);
  }
  return { db: cloneDb(), status: 200 as const };
}

export function resetRuntimeDb() {
  runtimeDb = normalizeDb(seedDb as RentflowDb);
  runtimeDbRevision += 1;
  notifyAllOnboardingSubscribers();
  return cloneDb();
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

export function getPublicOrigin(params: {
  protocol: string;
  host: string;
  publicAppOrigin?: string;
}) {
  if (params.publicAppOrigin) {
    return params.publicAppOrigin.replace(/\/$/, "");
  }

  const [hostname, port] = params.host.split(":");
  const isLocalhost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  if (!isLocalhost) {
    return `${params.protocol}://${params.host}`;
  }

  const lanAddress = getLanAddress();
  return `${params.protocol}://${lanAddress ?? hostname}${port ? `:${port}` : ""}`;
}

export function subscribeToOnboarding(propertyId: string, listener: OnboardingListener) {
  const subscribers = onboardingSubscribers.get(propertyId) ?? new Set<OnboardingListener>();
  subscribers.add(listener);
  onboardingSubscribers.set(propertyId, subscribers);

  const currentSync = getOnboardingSyncResponse(propertyId);
  if (currentSync) {
    listener(currentSync);
  }

  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) {
      onboardingSubscribers.delete(propertyId);
    }
  };
}
