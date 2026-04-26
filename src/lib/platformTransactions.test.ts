import test from "node:test";
import assert from "node:assert/strict";
import {
  Contract,
  Payment,
  PlatformTransaction,
  Property,
  RentflowDb,
  User,
} from "../types";
import { buildPlatformTransactionRows } from "./platformTransactions";

function createDb(overrides: Partial<RentflowDb> = {}): RentflowDb {
  return {
    meta: { version: "test", seededAt: "2026-04-20T00:00:00.000Z" },
    authAccounts: [],
    users: [],
    properties: [],
    contracts: [],
    payments: [],
    serviceCalls: [],
    messageTopics: [],
    messages: [],
    paymentRetries: [],
    utilityCharges: [],
    transfers: [],
    invoices: [],
    documents: [],
    vendors: [],
    legalCases: [],
    contractTemplates: [],
    eligibilityChecks: [],
    onboardingInvites: [],
    notifications: [],
    integrations: [],
    transactions: [],
    supportIssues: [],
    ...overrides,
  };
}

function createTransaction(overrides: Partial<PlatformTransaction> = {}): PlatformTransaction {
  return {
    id: "txn_13987",
    provider: "yad2",
    channel: "maintenance_companies",
    status: "completed",
    propertyId: "property_19",
    contractId: "contract_19",
    paymentId: "payment_44",
    amount: 11_454.97,
    revenue: 553.91,
    createdAt: "2026-04-20T23:57:57.000Z",
    ...overrides,
  };
}

test("resolves tenant through payment, contract, property and users", () => {
  const tenant: User = {
    id: "tenant_1",
    name: "נועה כהן",
    email: "noa@example.com",
    role: "tenant",
  };
  const property: Property = {
    id: "property_19",
    address: "הרצל 19, תל אביב",
    rent: 9_800,
    status: "occupied",
    catalogStatus: "published",
    tenantId: tenant.id,
  };
  const contract: Contract = {
    id: "contract_19",
    propertyId: property.id,
    tenantId: tenant.id,
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    rentAmount: 9_800,
    status: "active",
  };
  const payment: Payment = {
    id: "payment_44",
    propertyId: property.id,
    tenantId: tenant.id,
    amount: 9_800,
    date: "2026-04-20",
    status: "paid",
    type: "rent",
  };
  const db = createDb({
    users: [tenant],
    properties: [property],
    contracts: [contract],
    payments: [payment],
  });

  const rows = buildPlatformTransactionRows(db, [createTransaction()]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].tenantId, "tenant_1");
  assert.equal(rows[0].tenantLabel, "נועה כהן");
  assert.equal(rows[0].propertyLabel, "הרצל 19, תל אביב");
});

test("does not render orphan platform transactions as unidentified tenants", () => {
  const db = createDb({
    transactions: [createTransaction()],
  });

  const rows = buildPlatformTransactionRows(db, db.transactions);

  assert.equal(rows.length, 0);
});
