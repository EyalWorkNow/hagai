import test from "node:test";
import assert from "node:assert/strict";
import { Contract, OnboardingInvite, Property, User } from "../types";
import { getTenantOnboardingSnapshot } from "./onboardingStatus";

function createProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "property-1",
    address: "אבן גבירול 20, תל אביב",
    rent: 6200,
    status: "occupied",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    ...overrides,
  };
}

function createTenant(overrides: Partial<User> = {}): User {
  return {
    id: "tenant-1",
    name: "ישראל ישראלי",
    email: "tenant@example.com",
    role: "tenant",
    phone: "050-1234567",
    onboardingComplete: false,
    onboardingStep: 0,
    ...overrides,
  };
}

function createContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    propertyId: "property-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyAddress: "אבן גבירול 20, תל אביב",
    startDate: "2026-05-01",
    endDate: "2027-05-01",
    rentAmount: 6200,
    status: "waiting_kyc",
    tenantQrScannedAt: "2026-05-06T09:00:00.000Z",
    ...overrides,
  };
}

function createInvite(overrides: Partial<OnboardingInvite> = {}): OnboardingInvite {
  return {
    id: "invite-1",
    landlordId: "landlord-1",
    tenantEmail: "tenant@example.com",
    tenantPhone: "050-1234567",
    propertyId: "property-1",
    sentAt: "2026-05-06T08:50:00.000Z",
    status: "opened",
    contractVisibilityStep: 2,
    ...overrides,
  };
}

test("shows a QR-registered tenant immediately at onboarding step zero", () => {
  const tenant = createTenant();
  const snapshot = getTenantOnboardingSnapshot(
    createProperty(),
    [createContract()],
    [tenant],
    [createInvite()],
  );

  assert.equal(snapshot.tenant?.id, tenant.id);
  assert.equal(snapshot.stepIndex, 0);
  assert.equal(snapshot.activeTenantEmail, tenant.email);
  assert.match(snapshot.status, /שלב 1/);
});

test("matches an opened invite before the tenant advances past the first step", () => {
  const tenant = createTenant();
  const snapshot = getTenantOnboardingSnapshot(
    createProperty({ status: "vacant", tenantId: undefined }),
    [],
    [tenant],
    [createInvite()],
  );

  assert.equal(snapshot.tenant?.id, tenant.id);
  assert.equal(snapshot.invite?.status, "opened");
});

test("does not treat a sent-only invite as an active scanned tenant", () => {
  const snapshot = getTenantOnboardingSnapshot(
    createProperty({ status: "vacant", tenantId: undefined }),
    [],
    [createTenant()],
    [createInvite({ status: "sent" })],
  );

  assert.equal(snapshot.tenant, null);
  assert.equal(snapshot.invite?.status, "sent");
});

test("does not keep showing a tenant after the onboarding contract is cancelled", () => {
  const snapshot = getTenantOnboardingSnapshot(
    createProperty({ status: "vacant", tenantId: undefined }),
    [createContract({ status: "expired", tenantQrScannedAt: undefined })],
    [createTenant()],
    [createInvite({ status: "completed" })],
  );

  assert.equal(snapshot.tenant, null);
  assert.equal(snapshot.invite, null);
});
