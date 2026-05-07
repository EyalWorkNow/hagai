import type { IncomingMessage, ServerResponse } from "http";
import type { RentflowDb, Role } from "../../../src/types";
import type {
  cancelTenantOnboardingOnServer,
  inviteTenantForOnboarding,
  setCreditSkipApprovalForOnboarding,
} from "../runtimeApi";

type Req = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

function sendJson(res: ServerResponse, status: number, payload: unknown, extraHeaders?: Record<string, string>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      res.setHeader(key, value);
    }
  }
  res.end(JSON.stringify(payload));
}

function parseUrl(req: Req) {
  const host = req.headers.host ?? "localhost";
  return new URL(req.url ?? "/", `http://${host}`);
}

function getRequestOrigin(req: Req) {
  if (process.env.PUBLIC_APP_ORIGIN) {
    return process.env.PUBLIC_APP_ORIGIN.replace(/\/$/, "");
  }

  const protocol = req.headers["x-forwarded-proto"]?.toString() || "https";
  return `${protocol}://${req.headers.host ?? ""}`;
}

async function getRuntimeApi() {
  return import("../runtimeApi.js");
}

async function readJsonBody<T>(req: Req): Promise<T> {
  if (req.body && typeof req.body === "object") {
    return req.body as T;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  return (rawBody ? JSON.parse(rawBody) : {}) as T;
}

async function setRevisionHeader(res: ServerResponse) {
  const { getRuntimeDbRevision } = await getRuntimeApi();
  res.setHeader("X-Db-Revision", String(getRuntimeDbRevision()));
}

function getRequestId(req: Req) {
  const raw = req.headers["x-debug-request-id"];
  return Array.isArray(raw) ? raw[0] : raw ?? `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function routeRequest(req: Req, res: ServerResponse) {
  const url = parseUrl(req);
  const pathname = url.pathname.replace(/^\/api\/v1/, "") || "/";
  const method = req.method ?? "GET";
  const requestId = getRequestId(req);

  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "garim-po-api" });
    return;
  }

  if (method === "GET" && pathname === "/public-origin") {
    sendJson(res, 200, {
      origin: getRequestOrigin(req),
    });
    return;
  }

  if (method === "GET" && pathname === "/db") {
    const { getRuntimeDbSnapshot } = await getRuntimeApi();
    await setRevisionHeader(res);
    sendJson(res, 200, getRuntimeDbSnapshot());
    return;
  }

  if (method === "PUT" && pathname === "/db") {
    const { getClientDbRevision, replaceRuntimeDb } = await getRuntimeApi();
    const baseRevision = getClientDbRevision(req.headers);
    const incomingDb = await readJsonBody<Partial<RentflowDb>>(req);
    console.log("[garim-po-api]", "db.put.start", {
      requestId,
      baseRevision,
      users: Array.isArray(incomingDb.users) ? incomingDb.users.length : null,
      properties: Array.isArray(incomingDb.properties) ? incomingDb.properties.length : null,
      contracts: Array.isArray(incomingDb.contracts) ? incomingDb.contracts.length : null,
    });
    const result = replaceRuntimeDb(incomingDb, baseRevision);
    await setRevisionHeader(res);
    if ("error" in result) {
      console.log("[garim-po-api]", "db.put.error", {
        requestId,
        baseRevision,
        status: result.status,
        error: result.error,
      });
      sendJson(res, result.status, { error: result.error });
      return;
    }

    console.log("[garim-po-api]", "db.put.success", {
      requestId,
      baseRevision,
      responseRevision: res.getHeader("X-Db-Revision"),
    });
    sendJson(res, 200, result.db);
    return;
  }

  if (method === "POST" && pathname === "/db/reset") {
    const { resetRuntimeDb } = await getRuntimeApi();
    const db = resetRuntimeDb();
    await setRevisionHeader(res);
    sendJson(res, 200, db);
    return;
  }

  if (method === "GET" && pathname === "/onboarding/status") {
    const { getOnboardingSyncResponse } = await getRuntimeApi();
    const propertyId = url.searchParams.get("propertyId") ?? "";
    if (!propertyId) {
      sendJson(res, 400, { error: "Missing propertyId" });
      return;
    }

    const sync = getOnboardingSyncResponse(propertyId);
    if (!sync) {
      sendJson(res, 404, { error: "Property not found" });
      return;
    }

    await setRevisionHeader(res);
    sendJson(res, 200, sync);
    return;
  }

  if (method === "GET" && pathname === "/onboarding/events") {
    const { subscribeToOnboarding } = await getRuntimeApi();
    const propertyId = url.searchParams.get("propertyId") ?? "";
    if (!propertyId) {
      sendJson(res, 400, { error: "Missing propertyId" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");

    const unsubscribe = subscribeToOnboarding(propertyId, (payload) => {
      res.write("event: onboarding-sync\n");
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

    const keepAlive = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 25000);

    req.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
    return;
  }

  if (method === "POST" && pathname === "/onboarding/register") {
    const { registerUserForOnboarding } = await getRuntimeApi();
    const payload = await readJsonBody<{
      name?: string;
      email?: string;
      password?: string;
      role?: Role;
      propertyId?: string;
    }>(req);

    if (
      !payload.name?.trim() ||
      !payload.email?.trim() ||
      !payload.password?.trim() ||
      !payload.role ||
      !payload.propertyId?.trim()
    ) {
      sendJson(res, 400, { error: "Missing registration fields" });
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
      sendJson(res, result.status, { error: result.error });
      return;
    }

    await setRevisionHeader(res);
    sendJson(res, 200, result.sync);
    return;
  }

  if (method === "POST" && pathname === "/onboarding/login") {
    const { loginUserForOnboarding } = await getRuntimeApi();
    const payload = await readJsonBody<{
      email?: string;
      password?: string;
      propertyId?: string;
    }>(req);

    if (!payload.email?.trim() || !payload.password?.trim() || !payload.propertyId?.trim()) {
      sendJson(res, 400, { error: "Missing login fields" });
      return;
    }

    const result = loginUserForOnboarding({
      email: payload.email,
      password: payload.password,
      propertyId: payload.propertyId,
    });
    if ("error" in result) {
      sendJson(res, result.status, { error: result.error });
      return;
    }

    await setRevisionHeader(res);
    sendJson(res, 200, result.sync);
    return;
  }

  if (method === "POST" && pathname === "/onboarding/action") {
    const {
      cancelTenantOnboardingOnServer,
      inviteTenantForOnboarding,
      setCreditSkipApprovalForOnboarding,
    } = await getRuntimeApi();
    const payload = await readJsonBody<{
      action?: string;
      landlordId?: string;
      propertyId?: string;
      tenantId?: string;
      tenantEmail?: string;
      tenantPhone?: string;
      approved?: boolean;
      landlordCreditSkipApproved?: boolean;
    }>(req);

    let result:
      | ReturnType<typeof inviteTenantForOnboarding>
      | ReturnType<typeof setCreditSkipApprovalForOnboarding>
      | ReturnType<typeof cancelTenantOnboardingOnServer>;

    if (payload.action === "invite") {
      if (!payload.landlordId || !payload.propertyId || !payload.tenantEmail?.trim()) {
        sendJson(res, 400, { error: "Missing invite fields" });
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
        sendJson(res, 400, { error: "Missing approval fields" });
        return;
      }
      result = setCreditSkipApprovalForOnboarding({
        landlordId: payload.landlordId,
        propertyId: payload.propertyId,
        tenantEmail: payload.tenantEmail,
        approved: payload.approved,
      });
    } else if (payload.action === "cancel") {
      if (!payload.landlordId || !payload.propertyId || !payload.tenantId) {
        sendJson(res, 400, { error: "Missing cancel fields" });
        return;
      }
      result = cancelTenantOnboardingOnServer({
        landlordId: payload.landlordId,
        propertyId: payload.propertyId,
        tenantId: payload.tenantId,
      });
    } else {
      sendJson(res, 400, { error: "Unsupported onboarding action" });
      return;
    }

    if ("error" in result) {
      sendJson(res, result.status, { error: result.error });
      return;
    }

    await setRevisionHeader(res);
    sendJson(res, 200, result.sync);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

export default async function handler(req: Req, res: ServerResponse) {
  try {
    await routeRequest(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown API error";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    console.error("[api/v1] request failed", error);
    sendJson(res, 500, { error: "Internal server error", message, code });
  }
}
