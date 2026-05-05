export type Role = "tenant" | "landlord" | "admin" | "vendor";
export type KYCStatus = "pending" | "submitted" | "approved" | "rejected";
export type BDIStatus = "green" | "yellow" | "red" | "pending";
export type PurchaseFlowStatus = "pending" | "in_progress" | "completed";
export type IntegrationProvider = "yad2" | "midrag" | "insurance";
export type UtilityPaymentMode = "combined" | "separate";
export type TransactionChannel =
  | "maintenance_companies"
  | "foreign_resident_agencies"
  | "commercial_real_estate";

export interface PropertyCosts {
  buildingCommittee: number;
  arnona: number;
  utilities: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  kycStatus?: KYCStatus;
  idPhotoUrl?: string;
  selfieUrl?: string;
  bdiStatus?: BDIStatus;
  bdiReason?: string;
  onboardingStep?: number;
  onboardingComplete?: boolean;
  pendingPaymentRetry?: boolean;
  rating?: number;
  createdAt?: string;
  preferredContractVisibilityStep?: 1 | 2 | 4;
  statusLabel?: string;
  insurancePreference?: "undecided" | "interested" | "declined" | "insured";
}

export interface Property {
  id: string;
  address: string;
  rent: number;
  status: "occupied" | "vacant" | "maintenance";
  landlordId?: string;
  tenantId?: string;
  partners?: string[];
  description?: string;
  imageUrl?: string;
  isArchived?: boolean;
  createdAt?: string;
  city?: string;
  rooms?: number;
  sizeSqm?: number;
  floor?: string;
  catalogStatus?: "published" | "draft" | "archived";
  costs?: PropertyCosts;
  insuranceOffered?: boolean;
  transactionType?: "sale" | "rent";
  condition?: "new" | "renovated" | "good" | "needs_renovation";
  builtSqm?: number;
  floorsInBuilding?: number;
  parkingCount?: number;
  pricePerSqm?: number;
  entryDate?: string;
  hasMamad?: boolean;
}

export interface Payment {
  id: string;
  propertyId: string;
  propertyAddress?: string;
  landlordId?: string;
  tenantId: string;
  tenantName?: string;
  amount: number;
  date: string;
  status: "paid" | "pending" | "failed" | "deferred" | "late";
  type: "rent" | "utility" | "deposit" | "fine" | "commission";
  failureReason?: string;
  expectedRetryDate?: string;
  createdAt?: string;
  source?: "direct_debit" | "manual" | "payment_link";
  linkedUtilityChargeId?: string;
}

export interface ServiceCall {
  id: string;
  propertyId: string;
  propertyAddress?: string;
  tenantId: string;
  landlordId?: string;
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  category: "plumbing" | "electricity" | "general" | "cleaning" | "other";
  description?: string;
  imageUrl?: string;
  assignedVendor?: string;
  vendorId?: string;
  rating?: number;
  createdAt: string;
  closedAt?: string;
}

export interface Contract {
  id: string;
  propertyId: string;
  propertyAddress?: string;
  landlordId?: string;
  tenantId: string;
  tenantName?: string;
  partners?: string[];
  isSplitPayment?: boolean;
  startDate: string;
  endDate: string;
  rentAmount: number;
  buildingCommitteeAmount?: number;
  arnonaAmount?: number;
  utilityPaymentMode?: UtilityPaymentMode;
  monthlyPaymentAmount?: number;
  contractUploadedAt?: string;
  contractClausesApprovedAt?: string;
  tenantQrScannedAt?: string;
  landlordQrScannedAt?: string;
  status:
    | "active"
    | "pending"
    | "expired"
    | "waiting_signature"
    | "waiting_kyc"
    | "waiting_bdi"
    | "waiting_bank_auth";
  documentUrl?: string;
  insuranceUrl?: string;
  guaranteeType?: "bank" | "promissory" | "cash" | "insurance";
  createdAt?: string;
  templateId?: string;
  signedByTenantAt?: string;
  signedByLandlordAt?: string;
}

export interface AuthAccount {
  userId: string;
  email: string;
  password: string;
}

export interface MessageTopic {
  id: string;
  participantIds: string[];
  propertyId?: string;
  title: string;
  type: "general" | "maintenance" | "payment_retry" | "support";
  unreadBy?: string[];
  lastMessageAt: string;
}

export interface ChatMessage {
  id: string;
  topicId: string;
  senderId: string;
  senderRole?: Role | "system";
  text: string;
  createdAt: string;
  kind?: "text" | "system";
}

export interface PaymentRetryRequest {
  id: string;
  paymentId: string;
  tenantId: string;
  landlordId: string;
  reason: string;
  note?: string;
  preferredRetryDate: string;
  status: "requested" | "approved" | "rejected" | "scheduled";
  requestedAt: string;
  updatedAt: string;
}

export interface UtilityCharge {
  id: string;
  propertyId: string;
  landlordId: string;
  tenantId: string;
  label: string;
  provider: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid";
}

export interface TransferRecord {
  id: string;
  paymentId: string;
  landlordId: string;
  propertyId: string;
  amount: number;
  transferDate: string;
  settlementDate?: string;
  status: "scheduled" | "sent" | "settled";
  proofLabel: string;
}

export interface InvoiceRecord {
  id: string;
  userId: string;
  paymentId?: string;
  kind: "platform_fee" | "manual_charge" | "utility";
  amount: number;
  issuedAt: string;
  status: "issued" | "paid";
  recipientName: string;
}

export interface DocumentRecord {
  id: string;
  ownerType: "property" | "contract" | "user" | "payment" | "legal_case";
  ownerId: string;
  label: string;
  category:
    | "contract"
    | "bank_auth"
    | "guarantee"
    | "insurance"
    | "inspection"
    | "invoice"
    | "warning_letter";
  status: "ready" | "pending" | "missing";
  uploadedAt?: string;
  url?: string;
}

export interface VendorProfile {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviews: number;
  phone: string;
  area: string;
  status: "active" | "busy";
}

export interface LegalCase {
  id: string;
  paymentId: string;
  propertyId: string;
  landlordId: string;
  tenantId: string;
  amount: number;
  status: "warning_sent" | "in_collection" | "closed";
  stageLabel: string;
  openedAt: string;
  description: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  summary: string;
  version: string;
  fields: string[];
}

export interface EligibilityCheck {
  id: string;
  tenantId: string;
  landlordId?: string;
  status: "pending" | "approved" | "rejected";
  score: number;
  grade: string;
  recommendation: "approve" | "review" | "decline";
  checkedAt: string;
  provider: string;
  notes: string;
  standalone?: boolean;
}

export interface OnboardingInvite {
  id: string;
  landlordId: string;
  tenantEmail: string;
  tenantPhone?: string;
  propertyId: string;
  sentAt: string;
  status: "sent" | "opened" | "completed";
  contractVisibilityStep: 1 | 2 | 4;
  landlordCreditSkipApproved?: boolean;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  tone: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  createdAt: string;
  read?: boolean;
}

export interface IntegrationRecord {
  id: string;
  provider: IntegrationProvider;
  status: "connected" | "warning" | "disconnected";
  syncHealth: PurchaseFlowStatus;
  lastSyncAt: string;
  transactionCount: number;
  revenue: number;
}

export interface PlatformTransaction {
  id: string;
  propertyId?: string;
  contractId?: string;
  paymentId?: string;
  provider: IntegrationProvider;
  channel: TransactionChannel;
  status: PurchaseFlowStatus;
  amount: number;
  revenue: number;
  createdAt: string;
}

export interface SupportIssue {
  id: string;
  source: IntegrationProvider | "platform";
  title: string;
  severity: "low" | "medium" | "high";
  status: "open" | "resolved";
  createdAt: string;
}

export interface RentflowDb {
  meta: {
    version: string;
    seededAt: string;
  };
  authAccounts: AuthAccount[];
  users: User[];
  properties: Property[];
  contracts: Contract[];
  payments: Payment[];
  serviceCalls: ServiceCall[];
  messageTopics: MessageTopic[];
  messages: ChatMessage[];
  paymentRetries: PaymentRetryRequest[];
  utilityCharges: UtilityCharge[];
  transfers: TransferRecord[];
  invoices: InvoiceRecord[];
  documents: DocumentRecord[];
  vendors: VendorProfile[];
  legalCases: LegalCase[];
  contractTemplates: ContractTemplate[];
  eligibilityChecks: EligibilityCheck[];
  onboardingInvites: OnboardingInvite[];
  notifications: NotificationRecord[];
  integrations: IntegrationRecord[];
  transactions: PlatformTransaction[];
  supportIssues: SupportIssue[];
}

export interface SessionState {
  userId: string | null;
}

export interface SiteAccessSession {
  username: string;
  grantedAt: string;
  expiresAt: string | null;
  mode: "admin" | "temporary";
}
