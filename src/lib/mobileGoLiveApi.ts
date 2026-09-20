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
  const { data, error } = await (supabase as any).rpc("be_field_team_mobile_snapshot_v77", {
    p_payload: { limit },
  });

  if (error) throw error;

  return {
    ok: Boolean(data?.ok ?? true),
    account: data?.identity ?? {},
    workforce_code: data?.identity?.worker_code ?? "",
    workforce_type: (data?.identity?.role || role) as MobileRole,
    pickups: normalizeArray<any>(data?.jobs).filter((row: any) => String(row.job_kind || "PICKUP").toUpperCase() === "PICKUP") as MobilePickup[],
    jobs: normalizeArray<any>(data?.jobs).filter((row: any) => String(row.job_kind || "").toUpperCase() === "DELIVERY") as MobileJob[],
    cod_records: normalizeArray<any>(data?.jobs).filter((row: any) => String(row.job_kind || "").toUpperCase() === "DELIVERY" && Number(row.cod_collected ?? row.cod_amount ?? 0) > 0) as MobileJob[],
    notifications: normalizeArray<Record<string, unknown>>(data?.notifications),
    server_time: data?.server_time,
  };
}

export async function updateWaybillStatus(_eventId: string, _status: string, _payload: Record<string, unknown> = {}) {
  throw new Error("Direct Waybill status mutation is retired. Use strict Enterprise workflow actions.");
}

export async function verifyPickupParcel(payload: {
  pickup_id: string;
  deliver_way_id: string;
  weight_kg: number;
  photo_url: string;
  note?: string;
  role: MobileRole;
}) {
  const lineNo = Number(String(payload.deliver_way_id || "").split("-").pop() || 0);
  const { data, error } = await (supabase as any).rpc("be_pickup_parcel_capture_save", {
    p_payload: {
      pickup_id: payload.pickup_id,
      delivery_way_id: payload.deliver_way_id,
      line_no: lineNo,
      parcel_weight: payload.weight_kg,
      cargo_photo_url: payload.photo_url,
      remarks: payload.note || null,
    },
  });

  if (error) throw error;
  return data;
}

export async function codHandover(eventId: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await (supabase as any).rpc("be_rider_submit_cod_settlement", {
    p_delivery_way_id: eventId,
    p_cod_amount: Number((payload as any).amount || (payload as any).cod_amount || 0),
    p_remark: String((payload as any).remark || (payload as any).note || ""),
  });

  if (error) throw error;
  return data;
}

export async function submitSupportRequest(role: MobileRole, message: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await (supabase as any).rpc("be_rider_support_ticket_save", {
    p_payload: {
      ticket_type: (payload as any).ticket_type || (payload as any).topic || "app_error",
      priority: (payload as any).priority || "normal",
      subject: (payload as any).subject || `${role} support request`,
      message,
      pickup_id: (payload as any).pickup_id || null,
    },
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
