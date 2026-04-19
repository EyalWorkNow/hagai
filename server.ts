import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Data
  const db = {
    properties: [
      { id: "1", address: "הרצל 10, תל אביב", rent: 6500, status: "occupied", tenant: "ישראל ישראלי" },
      { id: "2", address: "רוטשילד 42, תל אביב", rent: 8200, status: "vacant", tenant: null },
    ],
    payments: [
      { id: "p1", propertyId: "1", amount: 6500, date: "2024-04-01", status: "paid", tenant: "ישראל ישראלי" },
    ],
    serviceCalls: [
      { id: "s1", propertyId: "1", title: "נזילה בכיור", status: "open", priority: "high", createdAt: new Date().toISOString() },
    ]
  };

  // API Routes
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  
  app.get("/api/properties", (req, res) => res.json(db.properties));
  app.get("/api/payments", (req, res) => res.json(db.payments));
  app.get("/api/service-calls", (req, res) => res.json(db.serviceCalls));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
