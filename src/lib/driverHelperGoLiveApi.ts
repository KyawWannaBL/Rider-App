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
  const { data, error } = await (supabase as any).rpc("be_field_team_mobile_snapshot_v77", {
    p_payload: { limit: 200 },
  });

  assertNoError(error);

  return {
    ok: Boolean(data?.ok),
    account: data?.identity || {},
    workforce_code: data?.identity?.worker_code,
    workforce_type: data?.identity?.role || role,
    pickup_ids: (Array.isArray(data?.jobs) ? data.jobs : []).filter((row: any) => String(row.job_kind || "PICKUP").toUpperCase() === "PICKUP").map((row: any) => row.pickup_id).filter(Boolean),
    pickups: (Array.isArray(data?.jobs) ? data.jobs : []).filter((row: any) => String(row.job_kind || "PICKUP").toUpperCase() === "PICKUP"),
    jobs: (Array.isArray(data?.jobs) ? data.jobs : []).filter((row: any) => String(row.job_kind || "").toUpperCase() === "DELIVERY"),
    assignments: (Array.isArray(data?.jobs) ? data.jobs : []).filter((row: any) => String(row.job_kind || "").toUpperCase() === "DELIVERY"),
    cod_records: (Array.isArray(data?.jobs) ? data.jobs : []).filter((row: any) => String(row.job_kind || "").toUpperCase() === "DELIVERY" && Number(row.cod_collected ?? row.cod_amount ?? 0) > 0),
    notifications: Array.isArray(data?.notifications) ? data.notifications : [],
    summary: data?.counts || {},
  };
}

export async function updateGoLiveWaybillStatus(_payload: {
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
  throw new Error("Direct delivery status mutation is retired. Use the strict Delivery Verification workflow.");
}

export async function handoverGoLiveCod(payload: {
  pickup_id?: string;
  deliver_way_id?: string;
  amount?: number;
  actor_code?: string;
  actor_name?: string;
}) {
  const { data, error } = await (supabase as any).rpc("be_rider_submit_cod_settlement", {
    p_pickup_id: payload.pickup_id || null,
    p_delivery_way_id: payload.deliver_way_id || null,
    p_cod_amount: Number(payload.amount || 0),
    p_remark: "Submitted from field-team compatibility flow",
  });
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
  const { data, error } = await (supabase as any).rpc("be_rider_support_ticket_save", {
    p_payload: {
      ticket_type: "app_error",
      priority: "normal",
      subject: payload.title,
      message: payload.message,
      pickup_id: payload.pickup_id || payload.deliver_way_id || null,
    },
  });
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
