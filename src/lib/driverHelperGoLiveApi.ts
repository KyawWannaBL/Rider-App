import { supabase } from "@/integrations/supabase/client";

export type WorkforceRole = "driver" | "helper" | "rider";

export type GoLivePickup = {
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
};

export type GoLiveJob = {
  id?: string;
  pickup_id: string;
  pickup_way_id?: string;
  deliver_way_id: string;
  tracking_no?: string;
  job_id?: string;
  line_no?: number;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_town?: string;
  delivery_city?: string;
  delivery_address?: string;
  status?: string;
  item_price?: number;
  delivery_fee?: number;
  cod_amount?: number;
  cod_collected_amount?: number;
  weight_kg?: number;
  service_type?: string;
  package_type?: string;
  item_description?: string;
  remarks?: string;
  merchant_name?: string;
  assigned_vehicle_plate?: string;
  field_pickup_checked?: boolean;
  data_entry_registration_checked?: boolean;
  pickup_verification_status?: string;
  proof_photo_url?: string;
  proof_signature_url?: string;
};

export type GoLiveCodRecord = {
  id?: string;
  pickup_id: string;
  deliver_way_id: string;
  recipient_name?: string;
  amount: number;
  collected_amount?: number;
  collected?: boolean;
  handed_over?: boolean;
};

export type GoLiveSnapshot = {
  ok: boolean;
  account: Record<string, any>;
  workforce_code?: string;
  workforce_type?: WorkforceRole;
  pickup_ids: string[];
  pickups: GoLivePickup[];
  jobs: GoLiveJob[];
  assignments: GoLiveJob[];
  cod_records: GoLiveCodRecord[];
  notifications: any[];
  summary: {
    pickup_count?: number;
    job_count?: number;
    cod_total?: number;
    delivered_count?: number;
    pending_count?: number;
  };
};

function assertNoError(error: any) {
  if (error) throw new Error(error.message || "Enterprise sync failed.");
}

export async function loadGoLiveSnapshot(role: WorkforceRole, workforceCode?: string): Promise<GoLiveSnapshot> {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_snapshot", {
    p_workforce_code: workforceCode || null,
    p_workforce_type: role,
    p_limit: 200,
  });

  assertNoError(error);

  return {
    ok: Boolean(data?.ok),
    account: data?.account || {},
    workforce_code: data?.workforce_code,
    workforce_type: data?.workforce_type || role,
    pickup_ids: Array.isArray(data?.pickup_ids) ? data.pickup_ids : [],
    pickups: Array.isArray(data?.pickups) ? data.pickups : [],
    jobs: Array.isArray(data?.jobs) ? data.jobs : [],
    assignments: Array.isArray(data?.assignments) ? data.assignments : [],
    cod_records: Array.isArray(data?.cod_records) ? data.cod_records : [],
    notifications: Array.isArray(data?.notifications) ? data.notifications : [],
    summary: data?.summary || {},
  };
}

export async function updateGoLiveWaybillStatus(payload: {
  pickup_id: string;
  deliver_way_id: string;
  status: string;
  proof_photo_url?: string;
  proof_signature_url?: string;
  note?: string;
  cod_collected_amount?: number;
  actor_code?: string;
  actor_name?: string;
}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_update_waybill_status", { p_payload: payload });
  assertNoError(error);
  return data;
}

export async function handoverGoLiveCod(payload: {
  pickup_id?: string;
  deliver_way_id?: string;
  amount?: number;
  actor_code?: string;
  actor_name?: string;
}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_cod_handover", { p_payload: payload });
  assertNoError(error);
  return data;
}

export async function sendGoLiveSupportRequest(payload: {
  workforce_type: WorkforceRole;
  title: string;
  message: string;
  pickup_id?: string;
  deliver_way_id?: string;
  actor_code?: string;
  actor_name?: string;
}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_support_request", { p_payload: payload });
  assertNoError(error);
  return data;
}

export async function verifyGoLivePickupParcel(payload: {
  pickup_id: string;
  deliver_way_id: string;
  weight_kg: number;
  photo_url: string;
  note?: string;
  actor_code?: string;
  actor_name?: string;
}) {
  const { data, error } = await (supabase as any).rpc("be_mobile_go_live_verify_pickup_parcel", { p_payload: payload });
  assertNoError(error);
  return data;
}

export function formatMMK(value: unknown) {
  const n = Number(value || 0);
  return `${n.toLocaleString()} MMK`;
}

export function statusLabel(status?: string) {
  return String(status || "assigned").replace(/_/g, " ").toUpperCase();
}
