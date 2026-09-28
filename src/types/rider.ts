export type ID = string;

export type WaybillStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "DELIVERED"
  | "FAILED"
  | "RETURN_PENDING"
  | "RETURN_SCANNED"
  | "RTO";

export type DispatchStatus = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type SettlementStatus = "PENDING" | "COLLECTED" | "SUBMITTED" | "VERIFIED" | "DEPOSITED" | "DISPUTED";
export type PaymentType = "COD" | "DELIVERY_FEE_ONLY" | "PREPAID" | "ZERO";
export type NetworkState = "idle" | "loading" | "success" | "error" | "offline";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  township?: string;
  ward?: string;
  location?: GeoPoint;
}

export interface Merchant {
  id: ID;
  code: string;
  name: string;
  phone?: string;
}

export interface TariffBreakdown {
  baseDeliveryFee: number;
  additionalFee: number;
  remoteAreaFee: number;
  discount: number;
  totalDeliveryFee: number;
  itemPrice: number;
  expectedCod: number;
  riderCommission?: number;
  providerCommission?: number;
}

export interface Waybill {
  id: ID;
  deliveryWayId: string;
  waybillNo: string;
  pickupWayId?: string;
  merchant: Merchant;
  customer: Customer;
  parcelSize?: "SMALL" | "MEDIUM" | "LARGE" | "XL";
  parcelCount: number;
  weightKg?: number;
  paymentType: PaymentType;
  tariff: TariffBreakdown;
  status: WaybillStatus;
  deliveryAttemptCount: number;
  maximumDeliveryAttempts?: number;
  failedReason?: string;
  deferredUntil?: string;
  assignedRiderId?: ID;
  assignedDriverId?: ID;
  assignedHelperId?: ID;
  sequenceNo?: number;
  proofOfDelivery?: {
    recipientName?: string;
    signedOnBehalf?: boolean;
    signatureUrl?: string;
    photoUrls?: string[];
    deliveredAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DispatchStop {
  id: ID;
  sequence: number;
  waybillId: ID;
  location?: GeoPoint;
  eta?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  completedAt?: string;
}

export interface Dispatch {
  id: ID;
  dispatchNo: string;
  riderId: ID;
  driverId?: ID;
  helperId?: ID;
  vehicleId?: ID;
  status: DispatchStatus;
  stops: DispatchStop[];
  route?: {
    provider: "GOOGLE" | "MAPBOX" | "MANUAL";
    polyline?: string;
    totalDistanceMeters?: number;
    totalDurationSeconds?: number;
    optimizedAt?: string;
  };
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementLine {
  id: ID;
  settlementId: ID;
  waybillId: ID;
  deliveryWayId: string;
  waybillNo: string;
  expectedCod: number;
  collectedCod: number;
  deliveryFee: number;
  riderCommission: number;
  variance: number;
  collectionMethod: "CASH" | "QR" | "BANK_TRANSFER";
  collectedAt?: string;
  status: SettlementStatus;
}

export interface Settlement {
  id: ID;
  settlementNo: string;
  riderId: ID;
  businessDate: string;
  status: SettlementStatus;
  lines: SettlementLine[];
  summary: {
    deliveredCount: number;
    expectedCod: number;
    collectedCod: number;
    deliveryFees: number;
    riderCommission: number;
    cashToDeposit: number;
    totalVariance: number;
  };
  submittedAt?: string;
  verifiedAt?: string;
  depositedAt?: string;
  createdAt: string;
  updatedAt: string;
}
