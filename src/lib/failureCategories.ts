export type FailureCategory = "DIRECT_RTO" | "VALID_REASON" | "INVALID_REASON";

const direct = new Set(["CUSTOMER_REFUSED", "CUSTOMER_REJECTED", "WRONG_ITEM", "CUSTOMER_DENIED_ORDER", "CUSTOMER_CANCELLED", "OS_REQUESTED_RTO", "REFUSED_COD", "FAKE_ORDER_SCAM", "CUSTOMER_RELOCATED"]);
const valid = new Set(["PHONE_OFF", "PHONE_OUT_OF_COVERAGE", "NO_ANSWER", "WRONG_PHONE", "ADDRESS_NOT_FOUND", "PHONE_UNREACHABLE", "CUSTOMER_NOT_AVAILABLE"]);

export function classifyFailureReason(code: string): FailureCategory {
  const normalized = String(code || "").trim().toUpperCase();
  if (direct.has(normalized)) return "DIRECT_RTO";
  if (valid.has(normalized)) return "VALID_REASON";
  return "INVALID_REASON";
}

export function requiresDirectRtoReview(code: string): boolean {
  return classifyFailureReason(code) === "DIRECT_RTO";
}
