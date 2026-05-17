import { supabase } from "@/integrations/supabase/client";
import type { CodRecord, EarningsRecord, Job, UserRole } from "@/lib/index";

function codeFromEmail(email?: string | null) {
  return String(email || "").split("@")[0].toLowerCase();
}

function typeFromCode(code: string, fallback?: UserRole | null): UserRole {
  if (fallback) return fallback;
  if (code.startsWith("driver_")) return "driver";
  if (code.startsWith("helper_")) return "helper";
  return "rider";
}

function mapJob(row: any): Job {
  const tracking = row.trackingNumber || row.tracking_no || row.tracking_no || row.job_id || row.pickup_id || row.id;

  return {
    id: String(row.id || tracking),
    trackingNumber: String(tracking || "-"),
    recipientName: row.recipientName || row.receiver_name || row.receiverName || "-",
    recipientPhone: row.recipientPhone || row.receiver_phone || "",
    address: row.address || row.delivery_address || "",
    township: row.township || row.delivery_township || "",
    status: row.status || "assigned",
    itemPrice: Number(row.itemPrice || row.cod_amount || row.codAmount || 0),
    deliveryFee: Number(row.deliveryFee || row.delivery_fee || 0),
    codAmount: Number(row.codAmount || row.cod_amount || 0),
    wayId: row.wayId || row.tracking_no || tracking,
    merchantName: row.merchantName || row.merchant_name || row.merchant_code || "-",
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
    notes: row.remarks || row.itemDescription || row.item_description || "",
    weight: Number(row.weight || row.weight_kg || 1),
  } as Job;
}

function mapCod(row: any): CodRecord {
  return {
    id: String(row.id),
    trackingNumber: String(row.trackingNumber || row.tracking_no || "-"),
    recipientName: row.recipientName || row.receiver_name || "-",
    amount: Number(row.amount || row.cod_amount || 0),
    collected: Boolean(row.collected),
    handedOver: Boolean(row.handedOver || row.handed_over),
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  };
}

export async function fetchMobileAssignments(params: {
  role?: UserRole | null;
  limit?: number;
}) {
  if (!supabase) {
    return {
      jobs: [] as Job[],
      codRecords: [] as CodRecord[],
      earnings: [] as EarningsRecord[],
      account: null,
      notifications: [],
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const email = authData?.user?.email || "";
  const workforceCode = codeFromEmail(email);
  const workforceType = typeFromCode(workforceCode, params.role);

  const { data, error } = await (supabase as any).rpc("be_mobile_app_my_assignments", {
    p_workforce_code: workforceCode || null,
    p_workforce_type: workforceType,
    p_limit: params.limit || 100,
  });

  if (error) throw error;

  return {
    account: data?.account || null,
    jobs: Array.isArray(data?.jobs) ? data.jobs.map(mapJob) : [],
    codRecords: Array.isArray(data?.cod_records) ? data.cod_records.map(mapCod) : [],
    earnings: [] as EarningsRecord[],
    notifications: Array.isArray(data?.notifications) ? data.notifications : [],
  };
}

export async function updateMobileJobStatus(trackingNumber: string, status: string, payload: Record<string, unknown> = {}) {
  if (!supabase) return null;

  const { data, error } = await (supabase as any).rpc("be_mobile_app_update_job_status", {
    p_tracking_no: trackingNumber,
    p_status: status,
    p_payload: payload,
  });

  if (error) throw error;
  return data;
}
