import {
  Contract,
  Payment,
  PlatformTransaction,
  Property,
  RentflowDb,
  User,
} from "../types";

export type EnrichedPlatformTransactionRow = {
  transaction: PlatformTransaction;
  property: Property | undefined;
  payment: Payment | undefined;
  contract: Contract | undefined;
  tenant: User | undefined;
  tenantId: string | undefined;
  propertyLabel: string;
  tenantLabel: string;
  contractLabel: string;
  providerLabel: string;
  channelLabel: string;
};

type BuildPlatformTransactionRowsOptions = {
  maxRows?: number;
  requireIdentifiedTenant?: boolean;
  requireKnownProperty?: boolean;
};

export function formatPlatformProviderLabel(provider: PlatformTransaction["provider"]) {
  switch (provider) {
    case "insurance":
      return "עסקאות ביטוח נכסים ורכוש פעילים החודש";
    case "midrag":
      return "מידרג";
    case "yad2":
      return "יד2";
    default:
      return provider;
  }
}

export function formatPlatformChannelLabel(channel: PlatformTransaction["channel"]) {
  switch (channel) {
    case "maintenance_companies":
      return "חברות תחזוקה";
    case "foreign_resident_agencies":
      return "משרדי נדל\"ן לתושבי חוץ";
    case "commercial_real_estate":
      return "נדל\"ן מסחרי";
    default:
      return channel;
  }
}

export function resolvePlatformTransactionTenant(
  transaction: PlatformTransaction,
  maps: {
    payments: Map<string, Payment>;
    contracts: Map<string, Contract>;
    properties: Map<string, Property>;
    users: Map<string, User>;
  },
) {
  const payment = transaction.paymentId ? maps.payments.get(transaction.paymentId) : undefined;
  const contract = transaction.contractId ? maps.contracts.get(transaction.contractId) : undefined;
  const property = transaction.propertyId ? maps.properties.get(transaction.propertyId) : undefined;
  const tenantId = payment?.tenantId ?? contract?.tenantId ?? property?.tenantId;
  const tenant = tenantId ? maps.users.get(tenantId) : undefined;

  return {
    payment,
    contract,
    property,
    tenantId,
    tenant,
    tenantLabel: tenant?.name ?? payment?.tenantName ?? contract?.tenantName,
  };
}

export function buildPlatformTransactionRows(
  db: RentflowDb,
  transactions: PlatformTransaction[],
  options: BuildPlatformTransactionRowsOptions = {},
): EnrichedPlatformTransactionRow[] {
  const {
    maxRows = 500,
    requireIdentifiedTenant = true,
    requireKnownProperty = true,
  } = options;
  const propertyMap = new Map(db.properties.map((property) => [property.id, property]));
  const paymentMap = new Map(db.payments.map((payment) => [payment.id, payment]));
  const contractMap = new Map(db.contracts.map((contract) => [contract.id, contract]));
  const userMap = new Map(db.users.map((user) => [user.id, user]));
  const rows: EnrichedPlatformTransactionRow[] = [];

  for (const transaction of transactions) {
    if (rows.length >= maxRows) break;

    const {
      payment,
      contract,
      property,
      tenantId,
      tenant,
      tenantLabel,
    } = resolvePlatformTransactionTenant(transaction, {
      payments: paymentMap,
      contracts: contractMap,
      properties: propertyMap,
      users: userMap,
    });

    if (requireKnownProperty && !property) continue;
    if (property?.catalogStatus === "archived") continue;
    if (requireIdentifiedTenant && (!tenantId || !tenantLabel)) continue;

    rows.push({
      transaction,
      property,
      payment,
      contract,
      tenant,
      tenantId,
      propertyLabel:
        property?.address ??
        payment?.propertyAddress ??
        contract?.propertyAddress ??
        transaction.propertyId ??
        "נכס לא משויך",
      tenantLabel: tenantLabel ?? "שוכר לא זוהה",
      contractLabel: contract?.id ?? transaction.contractId ?? "ללא חוזה משויך",
      providerLabel: formatPlatformProviderLabel(transaction.provider),
      channelLabel: formatPlatformChannelLabel(transaction.channel),
    });
  }

  return rows;
}
