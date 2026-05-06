import express from "express";
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
import { RentflowDb } from "./src/types";

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

function buildApi() {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "garim-po-api" });
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
