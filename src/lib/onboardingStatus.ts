import { Contract, OnboardingInvite, Property, User } from "../types";

export const TENANT_ONBOARDING_STEPS = [
  "פתיחת תהליך",
  "פרטי דירה",
  "בדיקת זכאות",
  "הרשאה לחיוב",
  "חתימה",
  "סיום",
];

export type TenantOnboardingSnapshot = {
  tenant: User | null;
  currentTenant: User | null;
  contract: Contract | null;
  invite: OnboardingInvite | null;
  status: string;
  stepIndex: number;
  totalSteps: number;
  activeTenantEmail?: string;
  landlordCreditSkipApproved: boolean;
};

export function getTenantOnboardingStatus(
  tenant: User | null,
  invite?: OnboardingInvite | null,
) {
  if (!tenant && invite) return `הזמנה נשלחה אל ${invite.tenantEmail}`;
  if (!tenant) return "ממתין לדייר שיסרוק את ההזמנה ויירשם";
  if (tenant.onboardingComplete) return "הדייר השלים את תהליך ההרשמה";

  const stepIndex = Math.min(
    Math.max(tenant.onboardingStep ?? 0, 0),
    TENANT_ONBOARDING_STEPS.length - 1,
  );

  return `הדייר בשלב ${stepIndex + 1} מתוך ${TENANT_ONBOARDING_STEPS.length}: ${TENANT_ONBOARDING_STEPS[stepIndex]}`;
}

export function getTenantOnboardingSnapshot(
  property: Property,
  contracts: Contract[],
  users: User[],
  invites: OnboardingInvite[],
): TenantOnboardingSnapshot {
  const propertyContracts = contracts.filter((contract) => contract.propertyId === property.id);
  const currentTenant = property.tenantId
    ? users.find((candidate) => candidate.id === property.tenantId) ?? null
    : null;
  const inProgressCurrentTenant =
    currentTenant && !currentTenant.onboardingComplete ? currentTenant : null;
  const completedCurrentTenant =
    currentTenant && currentTenant.onboardingComplete ? currentTenant : null;
  const onboardingContracts = propertyContracts
    .filter((contract) => contract.status !== "active" && contract.status !== "expired")
    .sort(
      (left, right) =>
        getContractActivityTime(right) - getContractActivityTime(left),
    );
  const currentTenantContract =
    inProgressCurrentTenant
      ? onboardingContracts.find((contract) => contract.tenantId === inProgressCurrentTenant.id) ?? null
      : null;
  const onboardingContract =
    currentTenantContract ??
    onboardingContracts.find((contract) => {
      const candidate = users.find((user) => user.id === contract.tenantId);
      return Boolean(
        candidate &&
          !candidate.onboardingComplete &&
          candidate.id !== completedCurrentTenant?.id,
      );
    }) ??
    null;

  let tenant = onboardingContract
    ? users.find((candidate) => candidate.id === onboardingContract.tenantId) ?? null
    : inProgressCurrentTenant;
  let contract = onboardingContract;

  const propertyInvites = [...invites]
    .filter((invite) => invite.propertyId === property.id && invite.status !== "completed")
    .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt));

  const invite =
    (tenant
      ? propertyInvites.find((item) => item.tenantEmail.toLowerCase() === tenant!.email.toLowerCase())
      : propertyInvites.find(
          (item) =>
            !completedCurrentTenant ||
            item.tenantEmail.toLowerCase() !== completedCurrentTenant.email.toLowerCase(),
        )) ?? null;

  if (!tenant && invite) {
    const invitedTenant = users.find(
      (user) =>
        user.role === "tenant" &&
        user.email.toLowerCase() === invite.tenantEmail.toLowerCase() &&
        !user.onboardingComplete &&
        user.id !== completedCurrentTenant?.id &&
        (invite.status === "opened" || (user.onboardingStep ?? 0) > 0),
    );
    if (invitedTenant) {
      tenant = invitedTenant;
      contract =
        propertyContracts.find(
          (candidate) =>
            candidate.tenantId === invitedTenant.id &&
            candidate.status !== "active" &&
            candidate.status !== "expired",
        ) ?? null;
    }
  }

  if (!tenant) {
    const allPropertyTenantIds = new Set(onboardingContracts.map((contract) => contract.tenantId));
    const registeredTenant = users.find(
      (user) =>
        allPropertyTenantIds.has(user.id) &&
        !user.onboardingComplete &&
        user.id !== completedCurrentTenant?.id &&
        user.role === "tenant",
    );
    if (registeredTenant) {
      tenant = registeredTenant;
      contract =
        propertyContracts.find(
          (candidate) =>
            candidate.tenantId === registeredTenant.id &&
            candidate.status !== "active" &&
            candidate.status !== "expired",
        ) ?? null;
    }
  }

  const stepIndex = tenant
    ? Math.min(Math.max(tenant.onboardingStep ?? 0, 0), TENANT_ONBOARDING_STEPS.length - 1)
    : 0;

  return {
    tenant,
    currentTenant,
    contract,
    invite,
    status: getTenantOnboardingStatus(tenant, invite),
    stepIndex,
    totalSteps: TENANT_ONBOARDING_STEPS.length,
    activeTenantEmail: tenant?.email ?? invite?.tenantEmail,
    landlordCreditSkipApproved: Boolean(invite?.landlordCreditSkipApproved),
  };
}

function getContractActivityTime(contract: Contract) {
  return Math.max(
    Date.parse(contract.tenantQrScannedAt ?? "") || 0,
    Date.parse(contract.createdAt ?? "") || 0,
    Date.parse(contract.signedByTenantAt ?? "") || 0,
  );
}
