import { supabase } from "@/integrations/supabase/client";

export type MobileRole = "rider" | "driver" | "helper";
export type MobileMode =
  | "home"
  | "jobs"
  | "route"
  | "proof"
  | "cod"
  | "earnings"
  | "sync"
  | "support"
  | "pickup"
  | "pickupForm";

export type MobilePickup = {
  pickup_id: string;
  pickup_way_id?: string;
  merchant_code?: string;
  merchant_name?: string;
  sender_name?: string;
  sender_phone?: string;
  pickup_address?: string;
  township?: string;
  city?: string;
  parcel_count?: number;
  status?: string;
  assignment_status?: string;
  assigned_rider_name?: string;
  assigned_driver_name?: string;
  assigned_helper_name?: string;
  assigned_vehicle_plate?: string;
  assigned_at?: string;
};

export type MobileJob = {
  id: string;
  pickup_id: string;
  pickup_way_id?: string;
  tracking_no?: string;
  deliver_way_id?: string;
  line_no?: number;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_town?: string;
  delivery_address?: string;
  status?: string;
  cod_amount?: number;
  item_price?: number;
  delivery_fee?: number;
  final_cod?: number;
  weight_kg?: number;
  field_pickup_checked?: boolean;
  data_entry_registration_checked?: boolean;
  pickup_verification_status?: string;
  photo_url?: string;
  field_pickup_photo_url?: string;
};

export type MobileSnapshot = {
  ok: boolean;
  account?: Record<string, unknown>;
  workforce_code?: string;
  workforce_type?: MobileRole;
  pickups: MobilePickup[];
  jobs: MobileJob[];
  cod_records: MobileJob[];
  notifications: Record<string, unknown>[];
  server_time?: string;
};

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function loadMobileSnapshot(role: MobileRole, limit = 100): Promise<MobileSnapshot> {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_snapshot", {
    p_workforce_type: role,
    p_workforce_code: null,
    p_limit: limit,
  });

  if (error) throw error;

  return {
    ok: Boolean(data?.ok ?? true),
    account: data?.account ?? {},
    workforce_code: data?.workforce_code ?? "",
    workforce_type: (data?.workforce_type || role) as MobileRole,
    pickups: normalizeArray<MobilePickup>(data?.pickups),
    jobs: normalizeArray<MobileJob>(data?.jobs),
    cod_records: normalizeArray<MobileJob>(data?.cod_records),
    notifications: normalizeArray<Record<string, unknown>>(data?.notifications),
    server_time: data?.server_time,
  };
}

export async function updateWaybillStatus(eventId: string, status: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_waybill_status", {
    p_event_id: eventId,
    p_status: status,
    p_payload: payload,
  });

  if (error) throw error;
  return data;
}

export async function verifyPickupParcel(payload: {
  pickup_id: string;
  deliver_way_id: string;
  weight_kg: number;
  photo_url: string;
  note?: string;
  role: MobileRole;
}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_verify_pickup_parcel", {
    p_payload: payload,
  });

  if (error) throw error;
  return data;
}

export async function codHandover(eventId: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_cod_handover", {
    p_event_id: eventId,
    p_payload: payload,
  });

  if (error) throw error;
  return data;
}

export async function submitSupportRequest(role: MobileRole, message: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_support_request", {
    p_workforce_type: role,
    p_message: message,
    p_payload: payload,
  });

  if (error) throw error;
  return data;
}

export function asMoney(value: unknown) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US");
}

export function goLivePickupPattern(value: string) {
  return /^P\d{4}-[A-Z][A-Z0-9]{1,4}-\d{3}$/.test(String(value || "").trim().toUpperCase());
}

export function goLiveDeliveryPattern(value: string) {
  return /^D\d{4}-[A-Z][A-Z0-9]{1,4}-\d{3}$/.test(String(value || "").trim().toUpperCase());
}
