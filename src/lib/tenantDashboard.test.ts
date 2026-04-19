import test from "node:test";
import assert from "node:assert/strict";
import { Contract, Payment, ServiceCall, User } from "../types";
import {
  buildTenantDashboardViewModel,
  shouldShowRenewalBanner,
} from "./tenantDashboard";

const NOW = new Date("2026-04-19T09:00:00.000Z");

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: "tenant-1",
    name: "ישראל ישראלי",
    email: "tenant@example.com",
    role: "tenant",
    onboardingComplete: true,
    ...overrides,
  };
}

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    propertyId: "property-1",
    tenantId: "tenant-1",
    amount: 6200,
    date: "2026-04-01",
    status: "paid",
    type: "rent",
    ...overrides,
  };
}

function createContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    propertyId: "property-1",
    tenantId: "tenant-1",
    propertyAddress: "אבן גבירול 20, תל אביב",
    startDate: "2025-05-01",
    endDate: "2026-06-01",
    rentAmount: 6200,
    status: "active",
    ...overrides,
  };
}

function createServiceCall(overrides: Partial<ServiceCall> = {}): ServiceCall {
  return {
    id: "service-1",
    propertyId: "property-1",
    tenantId: "tenant-1",
    title: "נזילה בכיור",
    status: "open",
    priority: "medium",
    category: "plumbing",
    createdAt: "2026-04-18T09:00:00.000Z",
    ...overrides,
  };
}

test("maps a failed payment to the failed hero state", () => {
  const viewModel = buildTenantDashboardViewModel({
    user: createUser(),
    contracts: [createContract()],
    property: {
      id: "property-1",
      address: "אבן גבירול 20, תל אביב",
      rent: 6200,
      status: "occupied",
      tenantId: "tenant-1",
    },
    payments: [
      createPayment({
        id: "payment-failed",
        date: "2026-04-15",
        status: "failed",
        failureReason: "מסגרת אשראי",
      }),
    ],
    serviceCalls: [],
    now: NOW,
  });

  assert.equal(viewModel.hero.state, "failed");
  assert.equal(viewModel.hero.primaryAction, "openRetryFlow");
});

test("prioritizes payment failure alerts above renewal alerts", () => {
  const viewModel = buildTenantDashboardViewModel({
    user: createUser(),
    contracts: [
      createContract({
        endDate: "2026-05-10",
      }),
    ],
    property: null,
    payments: [
      createPayment({
        id: "payment-failed",
        date: "2026-04-15",
        status: "failed",
      }),
    ],
    serviceCalls: [],
    now: NOW,
  });

  assert.equal(viewModel.alerts[0]?.id, "payment-failed");
  assert.equal(viewModel.alerts[1]?.id, "contract-ending");
});

test("switches between onboarding and active paid dashboard states", () => {
  const onboardingViewModel = buildTenantDashboardViewModel({
    user: createUser({ onboardingComplete: false }),
    contracts: [createContract()],
    property: null,
    payments: [],
    serviceCalls: [],
    now: NOW,
  });

  const activeViewModel = buildTenantDashboardViewModel({
    user: createUser(),
    contracts: [createContract()],
    property: null,
    payments: [createPayment()],
    serviceCalls: [createServiceCall()],
    now: NOW,
  });

  assert.equal(onboardingViewModel.hero.state, "onboarding");
  assert.equal(activeViewModel.hero.state, "paid");
});

test("shows failed payment CTA only when retry flow is relevant", () => {
  const failedViewModel = buildTenantDashboardViewModel({
    user: createUser(),
    contracts: [createContract()],
    property: null,
    payments: [
      createPayment({
        status: "failed",
        date: "2026-04-18",
      }),
    ],
    serviceCalls: [],
    now: NOW,
  });

  const paidViewModel = buildTenantDashboardViewModel({
    user: createUser(),
    contracts: [createContract()],
    property: null,
    payments: [createPayment()],
    serviceCalls: [],
    now: NOW,
  });

  assert.equal(failedViewModel.showFailedPaymentCta, true);
  assert.equal(paidViewModel.showFailedPaymentCta, false);
});

test("shows renewal banner only for active contracts ending within 45 days", () => {
  assert.equal(
    shouldShowRenewalBanner(createContract({ endDate: "2026-05-20" }), NOW),
    true,
  );
  assert.equal(
    shouldShowRenewalBanner(createContract({ endDate: "2026-08-20" }), NOW),
    false,
  );
});
