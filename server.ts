import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import seedDb from "./src/data/rentflow-db.json";
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

  db.properties = db.properties.map((property, index) => ({
    ...property,
    costs:
      property.costs ??
      [
        { buildingCommittee: 380, arnona: 540, utilities: 460 },
        { buildingCommittee: 520, arnona: 690, utilities: 610 },
        { buildingCommittee: 300, arnona: 470, utilities: 380 },
        { buildingCommittee: 410, arnona: 560, utilities: 430 },
      ][index % 4],
    insuranceOffered: property.insuranceOffered ?? property.tenantId !== undefined,
  }));

  db.users = db.users.map((user) => ({
    ...user,
    insurancePreference:
      user.insurancePreference ?? (user.role === "tenant" ? "undecided" : undefined),
  }));

  db.integrations = db.integrations ?? [
    {
      id: "integration_yad2",
      provider: "yad2",
      status: "connected",
      syncHealth: "completed",
      lastSyncAt: "2026-04-20T08:00:00.000Z",
      transactionCount: 14,
      revenue: 15200,
    },
    {
      id: "integration_midrag",
      provider: "midrag",
      status: "connected",
      syncHealth: "in_progress",
      lastSyncAt: "2026-04-20T07:45:00.000Z",
      transactionCount: 9,
      revenue: 9800,
    },
    {
      id: "integration_insurance",
      provider: "insurance",
      status: "warning",
      syncHealth: "pending",
      lastSyncAt: "2026-04-19T18:30:00.000Z",
      transactionCount: 11,
      revenue: 20000,
    },
  ];

  db.transactions = db.transactions ?? [
    {
      id: "txn_1",
      propertyId: db.properties[0]?.id,
      contractId: db.contracts[0]?.id,
      paymentId: db.payments[0]?.id,
      provider: "insurance",
      channel: "commercial_real_estate",
      status: "completed",
      amount: 6200,
      revenue: 950,
      createdAt: "2026-04-01T08:00:00.000Z",
    },
    {
      id: "txn_2",
      propertyId: db.properties[1]?.id,
      contractId: db.contracts[2]?.id,
      provider: "midrag",
      channel: "maintenance_companies",
      status: "in_progress",
      amount: 2400,
      revenue: 370,
      createdAt: "2026-04-17T13:00:00.000Z",
    },
    {
      id: "txn_3",
      propertyId: db.properties[2]?.id,
      contractId: db.contracts[1]?.id,
      provider: "yad2",
      channel: "foreign_resident_agencies",
      status: "pending",
      amount: 7200,
      revenue: 680,
      createdAt: "2026-04-12T11:00:00.000Z",
    },
  ];

  db.supportIssues = db.supportIssues ?? [
    {
      id: "issue_1",
      source: "insurance",
      title: "עיכוב בוובהוק של ספק הביטוח",
      severity: "high",
      status: "open",
      createdAt: "2026-04-19T14:00:00.000Z",
    },
    {
      id: "issue_2",
      source: "platform",
      title: "תיקון חירום לאגרגציית הספר הראשי",
      severity: "low",
      status: "resolved",
      createdAt: "2026-04-16T09:00:00.000Z",
    },
  ];

  return db;
}

function cloneDb(): RentflowDb {
  return normalizeDb(seedDb as RentflowDb);
}

function buildApi() {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "rentflow-api" });
  });

  router.get("/users", (_req, res) => res.json(cloneDb().users));
  router.get("/properties", (_req, res) => res.json(cloneDb().properties));
  router.get("/contracts", (_req, res) => res.json(cloneDb().contracts));
  router.get("/payments", (_req, res) => res.json(cloneDb().payments));
  router.get("/transactions", (_req, res) => res.json(cloneDb().transactions ?? []));
  router.get("/integrations", (_req, res) => res.json(cloneDb().integrations ?? []));

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
  const PORT = 3000;

  app.use(express.json());
  app.use("/api/v1", buildApi());

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
