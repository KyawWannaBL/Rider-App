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
  const settlementStatus = String(row.settlement_status || row.status || "").toUpperCase();
  const collectedAmount = Number(row.reported_collected ?? row.cod_collected ?? row.amount ?? row.cod_amount ?? 0);
  return {
    id: String(row.delivery_way_id || row.id || row.tracking_no || ""),
    trackingNumber: String(row.delivery_way_id || row.trackingNumber || row.tracking_no || "-"),
    recipientName: row.recipient_name || row.recipientName || row.receiver_name || "-",
    amount: collectedAmount,
    collected: collectedAmount > 0 || Boolean(row.collected),
    handedOver: ["SUBMITTED_TO_FINANCE","SETTLED","PAID","COMPLETED","POSTED"].includes(settlementStatus) || Boolean(row.handedOver || row.handed_over),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
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

  const { data, error } = await (supabase as any).rpc("be_field_team_mobile_snapshot_v77", {
    p_payload: { limit: params.limit || 100 },
  });

  if (error) throw error;

  const allJobs = Array.isArray(data?.jobs) ? data.jobs : [];
  const deliveryJobs = allJobs.filter((row: any) => String(row.job_kind || "").toUpperCase() === "DELIVERY");

  const { data: financeData, error: financeError } = await (supabase as any).rpc("be_field_financial_snapshot_v91", {
    p_days: 30,
  });
  if (financeError) throw financeError;

  const commissionRows = Array.isArray(financeData?.commission?.rows) ? financeData.commission.rows : [];
  const earnings: EarningsRecord[] = commissionRows.map((row: any) => ({
    date: String(row.work_date || ""),
    deliveries: Number(row.total_units || 0),
    earnings: Number(row.commission_mmk || 0),
    cod: 0,
  }));
  const codRows = Array.isArray(financeData?.cod_settlements) ? financeData.cod_settlements : [];

  return {
    account: data?.identity || null,
    jobs: deliveryJobs.map(mapJob),
    codRecords: codRows.map(mapCod),
    earnings,
    notifications: Array.isArray(data?.notifications) ? data.notifications : [],
  };
}

export async function updateMobileJobStatus(_trackingNumber: string, _status: string, _payload: Record<string, unknown> = {}) {
  throw new Error("Direct mobile status mutation is retired. Use Pickup Verification or strict Delivery Verification.");
}
