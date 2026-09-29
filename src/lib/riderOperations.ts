import { supabase } from "@/integrations/supabase/client";
import type {
  Dispatch,
  DispatchStatus,
  PaymentType,
  Settlement,
  SettlementLine,
  SettlementStatus,
  Waybill,
  WaybillStatus,
} from "@/types/rider";

function n(value: unknown) {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function iso(value: unknown) {
  return typeof value === "string" && value ? value : new Date().toISOString();
}

function statusFromRow(row: any): WaybillStatus {
  const value = String(row?.stop_status || row?.rider_status || "ASSIGNED").toUpperCase();
  if (["RIDER_ACCEPTED", "DELIVERY_ACCEPTED", "ACCEPTED_FOR_DELIVERY"].includes(value)) return "ACCEPTED";
  if (["OUT_FOR_DELIVERY", "IN_TRANSIT"].includes(value)) return "EN_ROUTE";
  if (["ARRIVED_AT_CUSTOMER", "ARRIVED"].includes(value)) return "ARRIVED";
  if (["DELIVERED", "DELIVERY_COMPLETED", "POD_VERIFIED"].includes(value)) return "DELIVERED";
  if (["FAILED_DELIVERY", "DELIVERY_FAILED", "ATTEMPTED_FAILED"].includes(value)) return "FAILED";
  if (["RETURN_TO_WAREHOUSE", "AWAITING_RETURN_SCAN"].includes(value)) return "RETURN_PENDING";
  if (["RETURN_SCANNED", "RETURNED_TO_WAREHOUSE"].includes(value)) return "RETURN_SCANNED";
  if (value === "RTO") return "RTO";
  return "ASSIGNED";
}

function paymentType(row: any): PaymentType {
  const expected = n(row?.calculated_cod_amount ?? row?.cod_amount);
  const item = n(row?.data_entry_item_price);
  const fee = n(row?.data_entry_delivery_fee ?? row?.delivery_fee);
  const entryType = String(row?.data_entry_amount_entry_type || "").toUpperCase();

  if (expected <= 0) return "ZERO";
  if (entryType.includes("PREPAID")) return "PREPAID";
  if (item <= 0 && fee > 0 && expected === fee) return "DELIVERY_FEE_ONLY";
  return "COD";
}

function extractLocation(row: any) {
  const meta = row?.metadata || {};
  const latitude = n(meta.latitude ?? meta.lat ?? meta.delivery_latitude ?? meta.gps_lat);
  const longitude = n(meta.longitude ?? meta.lng ?? meta.delivery_longitude ?? meta.gps_lng);
  if (!latitude || !longitude) return undefined;
  return { latitude, longitude };
}

function mapWaybill(row: any): Waybill {
  const expectedCod = n(row?.calculated_cod_amount ?? row?.cod_amount);
  const deliveryFee = n(row?.data_entry_delivery_fee ?? row?.delivery_fee);
  const itemPrice = n(row?.data_entry_item_price);

  return {
    id: String(row?.id || row?.delivery_way_id || ""),
    deliveryWayId: String(row?.delivery_way_id || ""),
    waybillNo: String(row?.waybill_no || row?.delivery_way_id || ""),
    pickupWayId: row?.pickup_way_id || row?.pickup_id || undefined,
    merchant: {
      id: String(row?.metadata?.merchant_id || row?.metadata?.merchant_code || row?.pickup_id || ""),
      code: String(row?.metadata?.merchant_code || row?.merchant_code || ""),
      name: String(row?.metadata?.merchant_name || row?.merchant_name || "Britium Merchant"),
    },
    customer: {
      id: String(row?.recipient_phone || row?.delivery_way_id || ""),
      name: String(row?.recipient_name || row?.receiver_name || "Recipient"),
      phone: String(row?.recipient_phone || row?.receiver_phone || ""),
      address: String(row?.address || ""),
      township: String(row?.township || ""),
      location: extractLocation(row),
    },
    parcelCount: 1,
    weightKg: n(row?.parcel_weight_kg),
    paymentType: paymentType(row),
    tariff: {
      baseDeliveryFee: deliveryFee,
      additionalFee: 0,
      remoteAreaFee: 0,
      discount: 0,
      totalDeliveryFee: deliveryFee,
      itemPrice,
      expectedCod,
      riderCommission: n(row?.metadata?.rider_commission),
      providerCommission: n(row?.metadata?.provider_commission),
    },
    status: statusFromRow(row),
    deliveryAttemptCount: n(row?.metadata?.delivery_attempt_count ?? row?.delivery_attempt_count),
    maximumDeliveryAttempts: n(row?.metadata?.maximum_delivery_attempts) || 3,
    failedReason: row?.failed_reason || undefined,
    assignedRiderId: row?.rider_code || undefined,
    assignedDriverId: row?.driver_code || undefined,
    assignedHelperId: row?.helper_code || undefined,
    sequenceNo: n(row?.stop_sequence),
    proofOfDelivery: {
      recipientName: row?.receiver_name || row?.recipient_name || undefined,
      signatureUrl: row?.receiver_signature_url || undefined,
      photoUrls: row?.rider_proof_url ? [row.rider_proof_url] : [],
      deliveredAt: row?.delivered_at || undefined,
    },
    createdAt: iso(row?.wayplan_created_at),
    updatedAt: iso(row?.delivered_at || row?.handed_over_to_rider_at || row?.wayplan_created_at),
  };
}

export async function loadRiderRoute(): Promise<{ dispatch: Dispatch | null; waybills: Waybill[] }> {
  if (!supabase) return { dispatch: null, waybills: [] };

  const { data, error } = await (supabase as any).rpc("be_rider_delivery_wayplan_jobs", {
    p_rider_code: null,
    p_limit: 300,
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.error || "Unable to load Rider route.");

  const rows = Array.isArray(data?.jobs) ? data.jobs : [];
  let locationByWay = new Map<string, any>();

  if (rows.length) {
    const deliveryWayIds = rows.map((row: any) => String(row?.delivery_way_id || "")).filter(Boolean);
    const { data: locations, error: locationError } = await (supabase as any).rpc("be_delivery_location_batch_v10", {
      p_delivery_way_ids: deliveryWayIds,
    });

    if (!locationError && Array.isArray(locations)) {
      locationByWay = new Map(
        locations.map((location: any) => [String(location?.delivery_way_id || "").toUpperCase(), location]),
      );
    }
  }

  const waybills = rows.map((row: any) => {
    const location = locationByWay.get(String(row?.delivery_way_id || "").toUpperCase());
    const enriched = location?.latitude && location?.longitude
      ? {
          ...row,
          metadata: {
            ...(row?.metadata || {}),
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            coordinate_source: location.coordinate_source,
            location_review_status: location.review_status,
          },
        }
      : row;

    return mapWaybill(enriched);
  });

  if (!rows.length) return { dispatch: null, waybills };

  const first = rows[0];
  const wayplanId = String(first?.wayplan_id || "ACTIVE");
  const stopRows = rows.filter((row: any) => String(row?.wayplan_id || "") === wayplanId);
  const statusValue = String(first?.wayplan_status || "IN_PROGRESS").toUpperCase();
  const dispatchStatus: DispatchStatus =
    statusValue === "COMPLETED" ? "COMPLETED" :
    statusValue === "CANCELLED" ? "CANCELLED" :
    "IN_PROGRESS";

  const dispatch: Dispatch = {
    id: wayplanId,
    dispatchNo: wayplanId,
    riderId: String(first?.rider_code || ""),
    driverId: first?.driver_code || undefined,
    helperId: first?.helper_code || undefined,
    vehicleId: first?.vehicle_code || undefined,
    status: dispatchStatus,
    stops: stopRows.map((row: any) => ({
      id: String(row?.id || row?.delivery_way_id),
      sequence: n(row?.stop_sequence) || 1,
      waybillId: String(row?.id || row?.delivery_way_id),
      location: extractLocation(row),
      eta: row?.metadata?.eta || undefined,
      distanceMeters: n(row?.metadata?.distance_meters) || undefined,
      durationSeconds: n(row?.metadata?.duration_seconds) || undefined,
      completedAt: row?.delivered_at || undefined,
    })),
    route: {
      provider: String(first?.metadata?.route_provider || "MANUAL").toUpperCase() === "GOOGLE" ? "GOOGLE" :
        String(first?.metadata?.route_provider || "").toUpperCase() === "MAPBOX" ? "MAPBOX" : "MANUAL",
      polyline: first?.metadata?.polyline || undefined,
      totalDistanceMeters: n(first?.metadata?.total_distance_meters) || undefined,
      totalDurationSeconds: n(first?.metadata?.total_duration_seconds) || undefined,
      optimizedAt: first?.metadata?.optimized_at || undefined,
    },
    startedAt: first?.dispatched_at || undefined,
    createdAt: iso(first?.wayplan_created_at),
    updatedAt: iso(first?.dispatched_at || first?.wayplan_created_at),
  };

  return { dispatch, waybills };
}

function settlementStatus(value: unknown): SettlementStatus {
  const s = String(value || "PENDING").toUpperCase();
  if (["CLEARED", "FINANCE_SETTLED", "SETTLED", "DEPOSITED"].includes(s)) return "DEPOSITED";
  if (["VERIFIED", "APPROVED"].includes(s)) return "VERIFIED";
  if (["SUBMITTED_TO_FINANCE", "PENDING_FINANCE", "SUBMITTED"].includes(s)) return "SUBMITTED";
  if (["COLLECTED", "READY_FOR_HANDOVER"].includes(s)) return "COLLECTED";
  if (["DISPUTED", "HOLD"].includes(s)) return "DISPUTED";
  return "PENDING";
}

export async function loadRiderSettlement(): Promise<{ settlement: Settlement; rawRows: any[] }> {
  if (!supabase) {
    const now = new Date().toISOString();
    return {
      rawRows: [],
      settlement: {
        id: "daily", settlementNo: "DAILY", riderId: "", businessDate: now.slice(0, 10),
        status: "PENDING", lines: [],
        summary: { deliveredCount: 0, expectedCod: 0, collectedCod: 0, deliveryFees: 0, riderCommission: 0, cashToDeposit: 0, totalVariance: 0 },
        createdAt: now, updatedAt: now,
      },
    };
  }

  const { data, error } = await (supabase as any).rpc("be_field_team_cod_handover_queue_v1", { p_limit: 300 });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.error || data?.code || "Unable to load COD handover queue.");

  const rows = Array.isArray(data?.jobs) ? data.jobs : [];
  const today = new Date().toISOString().slice(0, 10);

  const lines: SettlementLine[] = rows.map((row: any) => {
    const expected = n(row?.authoritative_cod_expected ?? row?.calculated_cod_amount ?? row?.cod_amount);
    const collected = n(row?.authoritative_cod_collected ?? row?.cod_collected);
    const commission = n(row?.rider_commission ?? row?.metadata?.rider_commission);
    return {
      id: String(row?.delivery_way_id || row?.id || ""),
      settlementId: "daily",
      waybillId: String(row?.id || row?.delivery_way_id || ""),
      deliveryWayId: String(row?.delivery_way_id || ""),
      waybillNo: String(row?.waybill_no || row?.delivery_way_id || ""),
      expectedCod: expected,
      collectedCod: collected,
      deliveryFee: n(row?.delivery_fee ?? row?.data_entry_delivery_fee),
      riderCommission: commission,
      variance: collected - expected,
      collectionMethod: String(row?.payment_mode || "CASH").toUpperCase() === "QR" ? "QR" :
        String(row?.payment_mode || "").toUpperCase() === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH",
      collectedAt: row?.cod_collected_at || row?.delivered_at || undefined,
      status: settlementStatus(row?.cod_settlement_status),
    };
  });

  const expectedCod = lines.reduce((s, x) => s + x.expectedCod, 0);
  const collectedCod = lines.reduce((s, x) => s + x.collectedCod, 0);
  const deliveryFees = lines.reduce((s, x) => s + x.deliveryFee, 0);
  const riderCommission = lines.reduce((s, x) => s + x.riderCommission, 0);
  const totalVariance = lines.reduce((s, x) => s + x.variance, 0);
  const cashToDeposit = rows.reduce((sum: number, row: any, index: number) => {
    const method = lines[index]?.collectionMethod;
    return sum + (method === "CASH" ? lines[index].collectedCod : 0);
  }, 0);

  const aggregateStatus: SettlementStatus =
    lines.length > 0 && lines.every((line) => line.status === "DEPOSITED") ? "DEPOSITED" :
    lines.some((line) => line.status === "DISPUTED") ? "DISPUTED" :
    lines.some((line) => line.status === "SUBMITTED") ? "SUBMITTED" :
    lines.some((line) => line.status === "COLLECTED") ? "COLLECTED" : "PENDING";

  const now = new Date().toISOString();
  return {
    rawRows: rows,
    settlement: {
      id: "daily",
      settlementNo: `COD-${today}`,
      riderId: String(data?.identity?.worker_code || ""),
      businessDate: today,
      status: aggregateStatus,
      lines,
      summary: {
        deliveredCount: lines.length,
        expectedCod,
        collectedCod,
        deliveryFees,
        riderCommission,
        cashToDeposit,
        totalVariance,
      },
      createdAt: now,
      updatedAt: now,
    },
  };
}

export async function submitCodHandover(deliveryWayId: string, input?: { proofPhotoName?: string; proofDataUrl?: string; note?: string }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await (supabase as any).rpc("be_field_team_cod_handover_submit_v1", {
    p_delivery_way_id: deliveryWayId,
    p_proof_photo_name: input?.proofPhotoName || null,
    p_proof_photo_data_url: input?.proofDataUrl || null,
    p_note: input?.note || null,
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.error || data?.code || "COD handover failed.");
  return data;
}

export function openNavigation(waybill: Waybill) {
  const loc = waybill.customer.location;
  const query = loc
    ? `${loc.latitude},${loc.longitude}`
    : encodeURIComponent([waybill.customer.address, waybill.customer.township].filter(Boolean).join(", "));
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, "_blank", "noopener,noreferrer");
}


export async function saveRiderDropoffPin(input: {
  deliveryWayId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await (supabase as any).rpc("be_rider_dropoff_pin_v147", {
    p_delivery_way_id: input.deliveryWayId,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_accuracy_m: input.accuracy ?? null,
  });

  if (error) throw error;
  if (data?.ok === false) throw new Error(data?.error || "Unable to save drop-off pin.");
  return data;
}

export function openPinInGoogleMaps(latitude: number, longitude: number) {
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    "_blank",
    "noopener,noreferrer",
  );
}
