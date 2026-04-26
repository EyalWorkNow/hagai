import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import {
  ChatMessage,
  Contract,
  DocumentRecord,
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
const SESSION_STORAGE_KEY = "garim-po-session";
const SITE_ACCESS_SESSION_STORAGE_KEY = "garim-po-site-access-session";
const SITE_ACCESS_ACTIVATIONS_STORAGE_KEY = "garim-po-site-access-activations";
const STORAGE_WARNING =
  "נפח הנתונים המקומי חרג ממגבלת הדפדפן. המערכת ממשיכה לעבוד, אך שינויים כבדים לא יישמרו מקומית.";

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role: Role;
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
  login: (email: string, password: string) => void;
  register: (payload: RegisterPayload) => void;
  logout: () => void;
  resetDatabase: () => void;
  updateUser: (userId: string, patch: Partial<User>) => void;
  submitKyc: (userId: string) => void;
  approveKyc: (userId: string) => void;
  requestEligibilityCheck: (userId: string, landlordId?: string) => void;
  resolveEligibilityCheck: (userId: string, approved: boolean) => void;
  skipEligibilityCheck: (userId: string, landlordId?: string) => void;
  saveOnboardingAgreement: (userId: string, payload: SaveOnboardingAgreementPayload) => void;
  saveBankAuthorization: (userId: string) => void;
  signOnboardingContract: (userId: string) => void;
  completeOnboarding: (userId: string) => void;
  addProperty: (landlordId: string, payload: AddPropertyPayload) => void;
  inviteTenant: (landlordId: string, payload: InviteTenantPayload) => void;
  createContract: (landlordId: string, payload: CreateContractPayload) => void;
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

async function loadDbStateAsync(): Promise<RentflowDb> {
  const seededDb = await loadSeedDbAsync();
  const storedDb = loadStoredValue<RentflowDb | null>(DB_STORAGE_KEY, null);

  if (!storedDb) {
    return seededDb;
  }

  return normalizeDb({
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
  });
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

function buildPersistableDbSnapshot(db: RentflowDb): RentflowDb {
  return {
    ...db,
    transactions: [],
  };
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
  const [session, setSession] = useState<SessionState>(() =>
    loadStoredValue<SessionState>(SESSION_STORAGE_KEY, { userId: null }),
  );
  const [siteAccessSession, setSiteAccessSession] = useState<SiteAccessSession | null>(() =>
    loadStoredValue<SiteAccessSession | null>(SITE_ACCESS_SESSION_STORAGE_KEY, null),
  );
  const [siteAccessActivations, setSiteAccessActivations] = useState<SiteAccessActivationMap>(() =>
    loadStoredValue<SiteAccessActivationMap>(SITE_ACCESS_ACTIVATIONS_STORAGE_KEY, {}),
  );
  const [isReady, setIsReady] = useState(false);

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

    loadDbStateAsync().then((loadedDb) => {
      setDb(loadedDb);
      setIsReady(true);
    });
  }, []);

  // Only persist AFTER the real DB is loaded (isReady gate prevents saving EMPTY_DB)
  useEffect(() => {
    if (isReady && db !== EMPTY_DB) {
      persistValue(DB_STORAGE_KEY, buildPersistableDbSnapshot(db));
    }
  }, [db, isReady]);

  useEffect(() => {
    persistValue(SESSION_STORAGE_KEY, session);
  }, [session]);

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
      return nextDb;
    });
  };

  const login = (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const account = db.authAccounts.find(
      (candidate) =>
        candidate.email.toLowerCase() === normalizedEmail && candidate.password === password,
    );

    if (!account) {
      throw new Error("פרטי התחברות שגויים");
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

  const register = ({ name, email, password, role }: RegisterPayload) => {
    const normalizedEmail = email.trim().toLowerCase();
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
    });
    setSession({ userId });
  };

  const logout = () => {
    setSession({ userId: null });
  };

  const clearSiteAccess = () => {
    setSiteAccessSession(null);
  };

  const resetDatabase = () => {
    loadSeedDbAsync().then((freshDb) => {
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

  const requestEligibilityCheck = (userId: string, landlordId?: string) => {
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
      if (user.bdiStatus !== "green") return;
      const contract = nextDb.contracts.find(
        (item) => item.tenantId === userId && item.status === "waiting_signature",
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
    updateUser(userId, { onboardingComplete: true, onboardingStep: 5 });
  };

  const addProperty = (landlordId: string, payload: AddPropertyPayload) => {
    applyDbUpdate((nextDb) => {
      nextDb.properties.unshift({
        id: buildId("property"),
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
  };

  const inviteTenant = (landlordId: string, payload: InviteTenantPayload) => {
    applyDbUpdate((nextDb) => {
      const property = findProperty(nextDb, payload.propertyId);
      if (!property) return;

      nextDb.onboardingInvites.unshift({
        id: buildId("invite"),
        landlordId,
        tenantEmail: payload.tenantEmail,
        tenantPhone: payload.tenantPhone,
        propertyId: payload.propertyId,
        sentAt: nowIso(),
        status: "sent",
        contractVisibilityStep: payload.contractVisibilityStep ?? 2,
      });
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
        addProperty,
        inviteTenant,
        createContract,
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
