/**
 * Logistics & Delivery Feature Suite - TypeScript Data Contracts
 * ---------------------------------------------------------------
 * All interfaces for the 5 new pages: Manning, Schedule, Deliveries, Picklist, DDRMS.
 * As specified in LOGISTICS_AND_DELIVERY_PLAN.md
 */

// ─── 1. Logistics Manning ───────────────────────────────────────────────────
export interface LogisticsManning {
  id: string;
  plateNumber: string; // Account: [plateNumber]@KENEA.com
  driverName: string;
  helpers: string[];
  vehicleType: 'Elf' | 'Forward' | '10WH' | '6WH' | 'Tractor';
  createdAt: string;
  updatedAt: string;
}

export interface LogisticsDriver {
  id: string;
  name: string;
  phone?: string;
  photoURL?: string;
  createdAt?: string;
}

export interface LogisticsHelper {
  id: string;
  name: string;
  phone?: string;
  photoURL?: string;
  createdAt?: string;
}

// ─── 2. Delivery Schedule ───────────────────────────────────────────────────
export interface DeliverySchedule {
  id: string;
  date: string;
  plateNumber: string;
  picklistNumbers: string[];
  route: string;
  noOfAccounts: number;
  qtyCS: number;
  salesmen: string[];
  driverName?: string;
  helpers: string[];
  noOfPushcart?: number; // Added No. of Pushcart
  remarks?: string;
  status: 'Scheduled' | 'In Transit' | 'Completed';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 3. Picklist ────────────────────────────────────────────────────────────
export interface Picklist {
  id: string;
  picklistDate: string;
  picklistNumber: string;
  city: string;
  salesmanCode: string;
  salesmanName: string;
  cs: number;
  sc: number;
  pc: number;
  estimatedAmount: number;
  numberOfAccounts: number;
  systemStatus: 'Allocated' | 'Invoiced' | 'Scheduled' | 'Completed';
  assignedChecker?: string;
  customers?: { name: string; code: string; barangay?: string; city?: string; province?: string }[];
  encoderId: string;
  encoderName: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 4. DDRMS Invoice Line Item ─────────────────────────────────────────────
export type DeliveryStatus = 'Pending' | 'Delivered' | 'Not Delivered';
export type NotDeliveredReason = 'Store Closed' | 'Customer Refused' | 'Payment Issue' | 'Damaged/Missing Goods' | 'Out of Time';

export interface DDRMSInvoice {
  id: string;
  invoiceDate: string;
  picklistNumber: string;
  systemInvoiceNumber: string;
  invoiceNumberSeries: string; // Physical booklet series e.g. "12345-368, 12400-409"
  customerCode: string;
  customerName: string;
  barangay: string;
  city: string;
  province: string;
  grossAmount: number;
  cs: number;
  pc: number;
  sc: number;
  deliveryStatus: DeliveryStatus;
  notDeliveredReason?: NotDeliveredReason;
  remarks?: string;
  updatedAt: string;
}

// ─── 5. DDRMS Document (Header + Invoices) ──────────────────────────────────
export type DDRMSStatus = 'Draft' | 'Submitted' | 'On The Way' | 'Delivered' | 'Remitted';

export interface DDRMSHeader {
  id: string;
  ddrmsNumber: string;
  salesmanCode: string;
  salesmanName: string;
  plateNumber: string;
  deliveryDate: string;
  driverName: string;
  noOfHelpers: number;
  noOfPushcart?: number; // Added No. of Pushcart
  routeCity: string;
  encoderId: string;
  encoderName: string;
  companyName: string;       // Admin configurable
  divisionTitle: string;     // Admin configurable
  officerInChargeCashierName: string; // Admin configurable
  status: DDRMSStatus;
  invoices: DDRMSInvoice[];
  totalGrossAmount: number;
  totalCS: number;
  totalPC: number;
  totalSC: number;
  remittanceCash?: number;
  remittanceDR?: number;
  remittanceChecks?: number;
  createdAt: string;
  updatedAt: string;
  qrScanTime?: string;
}

// ─── 6. Collection / Remittance ─────────────────────────────────────────────
export interface RemittanceCheck {
  bankName: string;
  checkNumber: string;
  checkDate: string;
  amount: number;
}

export interface DDRMSCollection {
  id: string;
  ddrmsId: string;
  ddrmsNumber: string;
  cashAmount: number;
  checks: RemittanceCheck[];
  drNumbers: string[];
  totalRemittance: number;
  encoderId: string;
  encoderName: string;
  createdAt: string;
}

// ─── 7. DDRMS Global Config (Admin-editable) ────────────────────────────────
export interface DDRMSGlobalConfig {
  companyName: string;
  divisionTitle: string;
  officerInChargeCashierName: string;
}

// ─── Delivery Status Sort Priority ──────────────────────────────────────────
export const DELIVERY_STATUS_PRIORITY: Record<DeliveryStatus, number> = {
  'Not Delivered': 0,  // Pinned at very top
  'Pending': 1,
  'Delivered': 2,
};

// ─── Vehicle Types ──────────────────────────────────────────────────────────
export const VEHICLE_TYPES = ['Elf', 'Forward', '10WH', '6WH', 'Tractor'] as const;

// ─── Not Delivered Reason Codes ─────────────────────────────────────────────
export const NOT_DELIVERED_REASONS: NotDeliveredReason[] = [
  'Store Closed',
  'Customer Refused',
  'Payment Issue',
  'Damaged/Missing Goods',
  'Out of Time',
];
