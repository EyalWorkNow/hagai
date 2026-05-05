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

  return db;
}

function cloneDb(): RentflowDb {
  return normalizeDb(seedDb as RentflowDb);
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
  const HOST = process.env.HOST ?? "0.0.0.0";

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

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  });
}

startServer();
