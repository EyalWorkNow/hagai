import express from "express";
import os from "os";
import path from "path";
import { createServer as createViteServer } from "vite";
import seedDb from "./src/data/garim-po-db.json";
import {
  formatChannelLabel,
  formatProviderLabel,
  getAdminDashboardMetrics,
  getLandlordHeroFinancials,
  getPlatformFinancialSummary,
  getRevenueByChannel,
  getTenantHeroFinancials,
} from "./src/lib/analytics";
import type { RentflowDb, Role } from "./src/types";

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

function cloneDb(): RentflowDb {
  return normalizeDb(runtimeDb);
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
  propertyId?: string;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  if (runtimeDb.authAccounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
    return { error: "האימייל כבר בשימוש", status: 409 as const };
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

  if (payload.role === "tenant" && payload.propertyId) {
    startTenantOnboardingForProperty(runtimeDb, userId, payload.propertyId);
  }

  runtimeDb = normalizeDb(runtimeDb);
  return { db: cloneDb(), userId, status: 200 as const };
}

function loginUserForOnboarding(payload: {
  email: string;
  password: string;
  propertyId?: string;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const account = runtimeDb.authAccounts.find(
    (candidate) =>
      candidate.email.toLowerCase() === normalizedEmail && candidate.password === payload.password,
  );

  if (!account) {
    return { error: "פרטי התחברות שגויים", status: 401 as const };
  }

  if (payload.propertyId) {
    startTenantOnboardingForProperty(runtimeDb, account.userId, payload.propertyId);
  }

  runtimeDb = normalizeDb(runtimeDb);
  return { db: cloneDb(), userId: account.userId, status: 200 as const };
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

  router.get("/db", (_req, res) => {
    res.json(cloneDb());
  });

  router.put("/db", (req, res) => {
    const incomingDb = req.body as Partial<RentflowDb>;

    if (
      !incomingDb ||
      !Array.isArray(incomingDb.users) ||
      !Array.isArray(incomingDb.properties) ||
      !Array.isArray(incomingDb.contracts)
    ) {
      res.status(400).json({ error: "Invalid database snapshot" });
      return;
    }

    runtimeDb = normalizeDb({
      ...runtimeDb,
      ...incomingDb,
      integrations: runtimeDb.integrations,
      transactions: runtimeDb.transactions,
      supportIssues: runtimeDb.supportIssues,
    } as RentflowDb);
    res.json(cloneDb());
  });

  router.post("/db/reset", (_req, res) => {
    runtimeDb = normalizeDb(seedDb as RentflowDb);
    res.json(cloneDb());
  });

  router.post("/onboarding/register", (req, res) => {
    const payload = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: Role;
      propertyId?: string;
    };

    if (!payload.name?.trim() || !payload.email?.trim() || !payload.password?.trim() || !payload.role) {
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
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json(result);
  });

  router.post("/onboarding/login", (req, res) => {
    const payload = req.body as {
      email?: string;
      password?: string;
      propertyId?: string;
    };

    if (!payload.email?.trim() || !payload.password?.trim()) {
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

    res.json(result);
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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const HOST = "0.0.0.0";

  app.use(express.json({ limit: "25mb" }));
  app.use("/api/v1", buildApi());

  if (process.env.NODE_ENV !== "production") {
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

startServer();
