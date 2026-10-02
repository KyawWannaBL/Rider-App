// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

const PAYMENT_METHODS = ["CASH", "PREPAID", "QR", "BANK_TRANSFER", "MOBILE_WALLET"];
const PROOF_MAX_BYTES = 950 * 1024;
const UPLOAD_TIMEOUT_MS = 120_000;
const FALLBACK_FAILED_REASONS = [
  ["PHONE_OFF", "ဖုန်းစက်ပိတ်ထားသည်။ / Phone switched off"],
  ["PHONE_OUT_OF_COVERAGE", "ဖုန်းဆက်သွယ်မှုဧရိယာပြင်ပသို့ရောက်ရှိနေသည်။ / Outside coverage"],
  ["NO_ANSWER", "ဖုန်းမကိုင်ပါ။ / Customer did not answer"],
  ["CUSTOMER_NOT_AVAILABLE", "Customer not available"],
  ["CUSTOMER_REFUSED", "Customer refused"],
  ["WRONG_ADDRESS", "Wrong address"],
  ["COD_NOT_READY", "COD not ready"],
  ["NO_ACCESS_TO_BUILDING", "No access to building"],
  ["PARCEL_DAMAGED", "Parcel damaged"],
  ["WEATHER_TRAFFIC_ISSUE", "Weather / traffic issue"],
  ["CUSTOMER_REQUESTED_RESCHEDULE", "Delivery date postponed / changed by customer"],
  ["OTHER", "Other"],
];

async function compressImage(file: File, maxBytes = 950 * 1024): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Select an image file.");
  if (file.size <= maxBytes && file.size <= PROOF_MAX_BYTES) return file;
  const worker = new Worker(new URL("../workers/proofCompressionWorker.ts", import.meta.url), { type: "module" });
  try {
    const buffer = await file.arrayBuffer();
    return await new Promise<File>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Photo compression timed out.")), 30_000);
      worker.onmessage = (event) => {
        window.clearTimeout(timer);
        if (!event.data?.ok) return reject(new Error(event.data?.error || "Photo compression failed."));
        resolve(new File([event.data.buffer], event.data.name || "proof.jpg", { type: event.data.type || "image/jpeg" }));
      };
      worker.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Photo compression failed."));
      };
      worker.postMessage({ buffer, type: file.type, name: file.name, maxBytes, maxWidth: 1280, maxHeight: 720 }, [buffer]);
    });
  } finally {
    worker.terminate();
  }
}

async function withTimeout<T>(promise: Promise<T>, ms = UPLOAD_TIMEOUT_MS): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("Upload timed out. Check the mobile network and retry.")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

function jobsFromResponse(data: any) {
  if (Array.isArray(data?.jobs)) return data.jobs;
  if (Array.isArray(data)) return data;
  return [];
}

function safeName(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

async function currentGps() {
  if (!navigator.geolocation) return {};
  return await new Promise<any>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude, gps_accuracy_m: pos.coords.accuracy }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
}

export default function DeliveryPage() {
  const { language, activeRole } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const [pickups, setPickups] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [approvedProofFile, setApprovedProofFile] = useState<File | null>(null);
  const [proofState, setProofState] = useState<"idle" | "compressing" | "ready" | "approved">("idle");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureOnBehalf, setSignatureOnBehalf] = useState(false);
  const [proofPreview, setProofPreview] = useState("");
  const [signaturePreview, setSignaturePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [failureMode, setFailureMode] = useState(false);
  const [deliveryProgress, setDeliveryProgress] = useState<"idle"|"validating"|"uploading"|"gps"|"confirming"|"success"|"error">("idle");
  const [deliveryResult, setDeliveryResult] = useState("");
  const [geofenceRepairAvailable, setGeofenceRepairAvailable] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [activeActions, setActiveActions] = useState<Record<string, boolean>>({});
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [form, setForm] = useState({
    receiver_name: "",
    receiver_phone: "",
    remarks: "",
    payment_method: "CASH",
    transaction_reference: "",
    cod_collected: "",
    failed_reason: "",
    signature_name: "",
    reschedule_date: "",
  });
  const [failureReasons, setFailureReasons] = useState<any[]>(FALLBACK_FAILED_REASONS);
  const [msg, setMsg] = useState(language === "my" ? "ပို့ဆောင်ရေးအလုပ်များကို ဖွင့်နေသည်..." : "Loading delivery jobs...");

  const requiredCod = Number(selected?.calculated_cod_amount ?? selected?.cod_amount ?? 0);
  const status = String(selected?.stop_status || selected?.rider_status || "").toUpperCase();
  const electronicPayment = ["QR", "BANK_TRANSFER", "MOBILE_WALLET"].includes(form.payment_method);
  const canDeliver = ["RIDER_ACCEPTED","DELIVERY_ACCEPTED","ACCEPTED_FOR_DELIVERY","OUT_FOR_DELIVERY","ARRIVED_AT_CUSTOMER"].includes(status);
  const helperPreparedForDriver =
    activeRole === "driver" &&
    String(selected?.rider_status || "").toUpperCase() === "HELPER_COMPLETED_PENDING_DRIVER";

  function resetProofs() {
    setProofFile(null);
    setApprovedProofFile(null);
    setProofState("idle");
    setSignatureFile(null);
    setProofPreview("");
    setSignaturePreview("");
  }

  function selectJob(job: any) {
    setSelected(job);
    setFailureMode(false);
    setSignatureOnBehalf(false);
    setGeofenceRepairAvailable(false);
    resetProofs();
    setForm((current) => ({
      ...current,
      receiver_name: job.receiver_name || job.recipient_name || "",
      receiver_phone: job.receiver_phone || job.recipient_phone || "",
      cod_collected: String(job.calculated_cod_amount ?? job.cod_amount ?? 0),
      transaction_reference: "",
      remarks: "",
      signature_name: job.recipient_name || job.receiver_name || "",
      failed_reason: "",
    }));
  }

  async function load(preferredDeliveryWayId?: string) {
    setMsg(tx("Loading assigned Wayplan deliveries...","တာဝန်ပေးထားသော Wayplan ပို့ဆောင်မှုများကို ဖွင့်နေသည်..."));
    const [jobsResult, reasonResult] = await Promise.all([
      (supabase as any).rpc("be_rider_delivery_wayplan_jobs_v187", {
        p_rider_code: null,
        p_limit: 200,
      }),
      (supabase as any).rpc("be_field_delivery_failure_reasons_v92"),
    ]);
    if (jobsResult.error) return setMsg(jobsResult.error.message);

    const enterpriseReasons = Array.isArray(reasonResult.data?.reasons) ? reasonResult.data.reasons : [];
    if (!reasonResult.error && enterpriseReasons.length) {
      setFailureReasons(
        enterpriseReasons.map((r: any) => [
          r.code,
          [r.name_mm, r.name_en].filter(Boolean).join(" / ") || r.code,
        ])
      );
    }

    const list = jobsFromResponse(jobsResult.data);
    setPickups(list);
    const next =
      list.find((job: any) => job.delivery_way_id === preferredDeliveryWayId) ||
      list.find((job: any) => !["DELIVERED", "FAILED_DELIVERY", "RETURN_TO_WAREHOUSE"].includes(String(job.stop_status || "").toUpperCase())) ||
      list[0] ||
      null;
    if (next) selectJob(next);
    else setSelected(null);
    setMsg(tx(`Loaded ${list.length} assigned delivery stop(s).`,`တာဝန်ပေးထားသော ပို့ဆောင်မှတ်တိုင် ${list.length} ခု ဖွင့်ပြီးပါပြီ။`));
  }

  function currentDeliveryState() {
    return String(selected?.stop_status || selected?.rider_status || selected?.dispatch_status || "").toUpperCase();
  }

  function visualActionKey(action:string) {
    return `${selected?.delivery_way_id || "NO-WAY"}:${action}`;
  }

  function actionActive(action:string) {
    const s=currentDeliveryState();
    if (activeActions[visualActionKey(action)]) return true;
    if (action==="accept") return ["RIDER_ACCEPTED","DELIVERY_ACCEPTED","ACCEPTED_FOR_DELIVERY","OUT_FOR_DELIVERY","ARRIVED_AT_CUSTOMER","DELIVERED"].includes(s);
    if (action==="start") return ["OUT_FOR_DELIVERY","ARRIVED_AT_CUSTOMER","DELIVERED"].includes(s);
    if (action==="arrive") return ["ARRIVED_AT_CUSTOMER","DELIVERED"].includes(s);
    if (action==="delivered") return ["DELIVERED","DELIVERY_COMPLETED","POD_VERIFIED"].includes(s);
    if (action==="failed") return failureMode || ["FAILED_DELIVERY","DELIVERY_FAILED","ATTEMPTED_FAILED","RETURN_TO_WAREHOUSE"].includes(s);
    if (action==="return") return ["RETURN_TO_WAREHOUSE","AWAITING_RETURN_SCAN"].includes(s);
    return false;
  }

  function markActionActive(action:string) {
    setActiveActions((current)=>({...current,[visualActionKey(action)]:true}));
  }

  function actionClass(action:string, normal:string) {
    return `be-jelly-action rounded-2xl p-3 font-black text-white ${actionActive(action) ? "bg-violet-700 ring-4 ring-violet-200" : normal}`;
  }

  function requestConfirm(action:string) {
    setConfirmAction(action);
  }

  async function executeConfirmedAction(action:string) {
    setConfirmAction(null);
    let ok:any=false;

    if (action==="accept") ok=await acceptDeliveryStep();
    else if (action==="start") ok=await startDeliveryStep();
    else if (action==="arrive") ok=await arriveDeliveryStep();
    else if (action==="delivered") ok=await deliver();
    else if (action==="failed") {
      setFailureMode(true);
      setMsg(tx("Choose the failed reason, then press Return to Warehouse.","မအောင်မြင်ရသည့် အကြောင်းပြချက်ကို ရွေးပြီးနောက် Warehouse သို့ ပြန်ပို့ရန် ကို နှိပ်ပါ။"));
      ok=true;
    } else if (action==="return") ok=await failAndReturnToWarehouse();
    else if (action==="gps") ok=await sendGps();
    else if (action==="fix_dropoff") ok=await correctDropoffToCurrentGps();

    if (ok !== false) markActionActive(action);
    return ok;
  }

  async function acceptDeliveryStep() {
    const s=currentDeliveryState();
    if (["RIDER_ACCEPTED","DELIVERY_ACCEPTED","ACCEPTED_FOR_DELIVERY","OUT_FOR_DELIVERY","ARRIVED_AT_CUSTOMER","DELIVERED"].includes(s)) {
      setMsg(tx("Parcel is already accepted.","ပါဆယ်ကို လက်ခံပြီးဖြစ်ပါသည်။")); return true;
    }
    return await act("accept");
  }

  async function startDeliveryStep() {
    const s=currentDeliveryState();
    if (["OUT_FOR_DELIVERY","ARRIVED_AT_CUSTOMER","DELIVERED"].includes(s)) {
      setMsg(tx("Delivery has already started.","ပို့ဆောင်မှု စတင်ပြီးဖြစ်ပါသည်။")); return true;
    }
    if (!["RIDER_ACCEPTED","DELIVERY_ACCEPTED","ACCEPTED_FOR_DELIVERY"].includes(s)) {
      setMsg(tx("Accept the parcel before starting delivery.","ပို့ဆောင်မှု မစတင်မီ ပါဆယ်ကို အရင်လက်ခံပါ။")); return false;
    }
    return await act("start_delivery");
  }

  async function arriveDeliveryStep() {
    const s=currentDeliveryState();
    if (["ARRIVED_AT_CUSTOMER","DELIVERED"].includes(s)) {
      setMsg(tx("Customer arrival is already recorded.","Customer နေရာသို့ ရောက်ရှိမှု မှတ်တမ်းတင်ပြီးဖြစ်ပါသည်။")); return true;
    }
    if (s!=="OUT_FOR_DELIVERY") {
      setMsg(tx("Start Delivery before recording customer arrival.","Customer နေရာရောက်ရှိမှု မမှတ်တမ်းတင်မီ ပို့ဆောင်မှုကို စတင်ပါ။")); return false;
    }
    return await arriveAtCustomer();
  }

  async function choosePhoto(file?: File) {
    if (!file) return;
    setProofState("compressing");
    setApprovedProofFile(null);
    try {
      const compressed = await compressImage(file, 950 * 1024);
      if (compressed.size > PROOF_MAX_BYTES) throw new Error("Proof photo remains larger than 950 KB after compression.");
      setProofFile(compressed);
      setProofPreview(URL.createObjectURL(compressed));
      setProofState("ready");
      setMsg(`Proof compressed to ${Math.ceil(compressed.size / 1024)} KB. Review it, then press “{tx("Approve photo & upload","ဓာတ်ပုံအတည်ပြုပြီး Upload တင်ရန်")}”.`);
    } catch (error: any) {
      setProofFile(null);
      setProofPreview("");
      setProofState("idle");
      setMsg(error?.message || "Unable to prepare proof photo.");
    }
  }

  function approveProofPhoto() {
    if (!proofFile) return setMsg("Capture a proof photo first.");
    setApprovedProofFile(proofFile);
    setProofState("approved");
    setMsg("Delivery proof approved. It will upload only when delivery is confirmed.");
  }

  function canvasPoint(event: any) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
  }

  function startSignature(event: any) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    drawingRef.current = true;
    const p = canvasPoint(event);
    const ctx = canvas.getContext("2d");
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  }

  function drawSignature(event: any) {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !drawingRef.current) return;
    event.preventDefault();
    const p = canvasPoint(event);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stopSignature(event?: any) {
    event?.preventDefault?.();
    drawingRef.current = false;
  }

  function clearSignatureCanvas() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function signatureCanvasFile() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasInk = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) { hasInk = true; break; }
    }
    if (!hasInk) return null;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob ? new File([blob], "customer-signature.png", { type: "image/png" }) : null;
  }

  function chooseSignature(file?: File) {
    if (!file) return;
    setSignatureFile(file);
    setSignaturePreview(URL.createObjectURL(file));
  }

  async function upload(bucket: "rider-proofs" | "ops-signatures", file: File, prefix: string) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) throw new Error("Sign in before uploading proof.");
    const path = `${auth.user.id}/${prefix}/${safeName(file)}`;
    const result = await withTimeout(supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    }) as any, UPLOAD_TIMEOUT_MS);
    if (result.error) throw result.error;
    if (bucket === "rider-proofs") {
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    return path;
  }

  async function act(action: string, extra: any = {}) {
    if (!selected) { setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။")); return false; }
    setBusy(true);
    try {
      const payload = {
        wayplan_id: selected.wayplan_id,
        delivery_way_id: selected.delivery_way_id,
        action,
        ...extra,
      };
      const { data, error } = await (supabase as any).rpc("be_rider_wayplan_action", { p_payload: payload });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Rider action failed.");
      setMsg(`${selected.delivery_way_id}: ${data?.status || action} saved.`);
      await load(selected.delivery_way_id);
      return true;
    } catch (error: any) {
      setMsg(error?.message || "Unable to save Rider action.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deliver() {
    if (!selected) {
      const message = tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။");
      setMsg(message); setDeliveryResult(message); setDeliveryProgress("error"); return false;
    }
    if (!canDeliver) {
      const message = tx(
        "Accept the parcel before confirming delivery.",
        "ပို့ဆောင်ပြီး အတည်ပြုရန် ပါဆယ်ကို အရင်လက်ခံပါ။"
      );
      setMsg(message); setDeliveryResult(message); setDeliveryProgress("error"); return false;
    }

    // V176 van-team workflow: once the assigned Helper has completed GPS,
    // proof, signature and COD checks, the assigned Driver confirms with one tap.
    // The Driver must not repeat the Helper's evidence capture.
    if (helperPreparedForDriver) {
      setBusy(true);
      setDeliveryProgress("confirming");
      setDeliveryResult(tx(
        "Helper completed the delivery checks. Confirming final Driver acceptance...",
        "Helper မှ ပို့ဆောင်မှုစစ်ဆေးချက်များ ပြီးစီးထားပါသည်။ Driver အတည်ပြုမှုကို လုပ်ဆောင်နေပါသည်..."
      ));
      try {
        const { data, error } = await (supabase as any).rpc("be_field_team_confirm_delivery_v146", {
          p_payload: {
            wayplan_id: selected.wayplan_id,
            delivery_way_id: selected.delivery_way_id,
          },
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data?.message || data?.error || "Driver confirmation failed.");
        if (String(data?.mobile_status || "").toUpperCase() !== "DELIVERED") {
          throw new Error("Driver confirmation did not return authoritative DELIVERED status.");
        }
        const successMessage = tx(
          `${selected.delivery_way_id}: Helper work accepted. Delivery is now DELIVERED.`,
          `${selected.delivery_way_id}: Helper လုပ်ဆောင်ချက်ကို Driver အတည်ပြုပြီး DELIVERED ဖြစ်ပါပြီ။`
        );
        setDeliveryProgress("success");
        setDeliveryResult(successMessage);
        setMsg(successMessage);
        markActionActive("delivered");
        await load(selected.delivery_way_id);
        return true;
      } catch (error:any) {
        const message=error?.message || tx("Driver confirmation failed.","Driver အတည်ပြုမှု မအောင်မြင်ပါ။");
        setDeliveryProgress("error");
        setDeliveryResult(message);
        setMsg(message);
        return false;
      } finally {
        setBusy(false);
      }
    }
    if (!form.receiver_name.trim()) {
      const message = tx("Receiver name is required.","လက်ခံသူအမည် ဖြည့်ရန်လိုအပ်ပါသည်။");
      setMsg(message); setDeliveryResult(message); setDeliveryProgress("error"); return false;
    }
    if (!approvedProofFile) {
      const message = tx("Capture, review and approve the delivery proof photo first.","ပို့ဆောင်မှုဓာတ်ပုံကို ရိုက်ယူ၊ စစ်ဆေးပြီး အတည်ပြုပါ။");
      setMsg(message); setDeliveryResult(message); setDeliveryProgress("error"); return false;
    }

    setDeliveryProgress("validating");
    setDeliveryResult(tx("Checking proof, signature and payment...","ဓာတ်ပုံ၊ လက်မှတ်နှင့် ငွေပေးချေမှုကို စစ်ဆေးနေပါသည်..."));

    const drawnSignature = await signatureCanvasFile();
    if (!signatureFile && !drawnSignature) {
      const message = tx(
        "Capture or upload the customer signature before confirming delivery.",
        "ပို့ဆောင်ပြီးအတည်ပြုမီ Customer လက်မှတ်ကို ရေးထိုး သို့မဟုတ် ဓာတ်ပုံတင်ပါ။"
      );
      setMsg(message); setDeliveryResult(message); setDeliveryProgress("error"); return false;
    }

    if (Number(form.cod_collected || requiredCod || 0) !== requiredCod) {
      setForm((current) => ({ ...current, cod_collected: String(requiredCod) }));
    }
    if (electronicPayment && !form.transaction_reference.trim()) {
      const message = tx("Transaction reference is required for electronic payment.","အီလက်ထရွန်နစ်ငွေပေးချေမှုအတွက် ငွေလွှဲအမှတ် လိုအပ်ပါသည်။");
      setMsg(message); setDeliveryResult(message); setDeliveryProgress("error"); return false;
    }

    setBusy(true);
    try {
      setDeliveryProgress("uploading");
      setDeliveryResult(tx("Uploading proof and signature...","သက်သေဓာတ်ပုံနှင့် လက်မှတ်ကို Upload တင်နေပါသည်..."));

      const prefix = `${selected.wayplan_id}/${selected.delivery_way_id}`;
      const proof_url = await upload("rider-proofs", approvedProofFile, prefix);
      const finalSignatureFile = signatureFile || drawnSignature;
      const signature_path = finalSignatureFile
        ? await upload("ops-signatures", finalSignatureFile, prefix)
        : null;

      setDeliveryProgress("gps");
      setDeliveryResult(tx("Checking current GPS and arrival state...","လက်ရှိ GPS နှင့် ရောက်ရှိမှုအခြေအနေကို စစ်ဆေးနေပါသည်..."));
      const gps = await currentGps();
      if (!gps.gps_lat || !gps.gps_lng) {
        throw new Error(tx(
          "Current GPS is required to complete delivery. Allow location permission and try again.",
          "ပို့ဆောင်ပြီး အတည်ပြုရန် လက်ရှိ GPS လိုအပ်ပါသည်။ Location Permission ကို ခွင့်ပြုပြီး ပြန်စမ်းပါ။"
        ));
      }

      const signature_payload = form.signature_name.trim()
        ? {
            method: "CUSTOMER_TYPED_ACKNOWLEDGEMENT",
            signed_name: form.signature_name.trim(),
            signed_at: new Date().toISOString(),
          }
        : {};

      setDeliveryProgress("confirming");
      setDeliveryResult(tx(
        "Confirming delivery and synchronizing Warehouse, Finance and Operations...",
        "ပို့ဆောင်ပြီး အတည်ပြုပြီး Warehouse, Finance နှင့် Operations သို့ ချိတ်ဆက်နေပါသည်..."
      ));

      const { data, error } = await (supabase as any).rpc("be_field_team_confirm_delivery_v146", {
        p_payload: {
          wayplan_id: selected.wayplan_id,
          delivery_way_id: selected.delivery_way_id,
          recipient_name: form.receiver_name.trim(),
          recipient_phone: form.receiver_phone.trim() || null,
          proof_url,
          signature_url: signature_path,
          signature_payload,
          payment_method: form.payment_method,
          transaction_reference: form.transaction_reference.trim() || null,
          cod_collected_amount: requiredCod,
          remark: form.remarks.trim() || null,
          ...gps,
        },
      });

      if (error) throw error;
      if (data?.ok === false) {
        const stage = data?.failed_stage ? ` [${data.failed_stage}]` : "";
        throw new Error((data?.message || data?.error || "Delivery confirmation failed.") + stage);
      }
      const mobileStatus = String(data?.mobile_status || "").toUpperCase();
      if (activeRole === "helper" && mobileStatus === "PENDING_DRIVER_CONFIRMATION") {
        const successMessage = tx(
          `${selected.delivery_way_id}: Delivery checks completed. Waiting for assigned Driver to press Delivered and confirm.`,
          `${selected.delivery_way_id}: Helper လုပ်ဆောင်ချက်များ ပြီးစီးပါပြီ။ Assigned Driver မှ Delivered ကိုနှိပ်၍ အတည်ပြုရန်သာ ကျန်ပါသည်။`
        );
        setDeliveryProgress("success");
        setDeliveryResult(successMessage);
        setMsg(successMessage);
        markActionActive("delivered");
        resetProofs();
        await load(selected.delivery_way_id);
        return true;
      }
      if (mobileStatus !== "DELIVERED") {
        throw new Error("Delivery confirmation did not return authoritative DELIVERED status.");
      }

      const successMessage = tx(
        `${selected.delivery_way_id}: Delivered successfully. Backend status is DELIVERED and synchronized.`,
        `${selected.delivery_way_id}: ပို့ဆောင်မှု အောင်မြင်ပါသည်။ Backend Status သည် DELIVERED ဖြစ်ပြီး ချိတ်ဆက်ပြီးပါပြီ။`
      );
      setDeliveryProgress("success");
      setDeliveryResult(successMessage);
      setMsg(successMessage);
      markActionActive("delivered");
      resetProofs();
      await load(selected.delivery_way_id);
      return true;
    } catch (error: any) {
      const rawMessage = error?.message || tx("Delivery confirmation failed.","ပို့ဆောင်ပြီး အတည်ပြုမှု မအောင်မြင်ပါ။");
      const isGeofence = String(rawMessage).includes("GEOFENCE_OUTSIDE_RADIUS");
      if (isGeofence) {
        setGeofenceRepairAvailable(false);
        const friendly = tx(
          "Location verification could not complete automatically. Wait for a stronger GPS signal and press Delivered again.",
          "Location စစ်ဆေးမှုကို အလိုအလျောက် မပြီးဆုံးနိုင်ပါ။ GPS Signal ပိုကောင်းလာအောင် ခဏစောင့်ပြီး Delivered ကို ပြန်နှိပ်ပါ။"
        );
        setDeliveryProgress("error");
        setDeliveryResult(friendly);
        setMsg(friendly);
      } else {
        setDeliveryProgress("error");
        setDeliveryResult(rawMessage);
        setMsg(rawMessage);
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function arriveAtCustomer() {
    if (!selected) { setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။")); return false; }
    const gps = await currentGps();
    if (!gps.gps_lat || !gps.gps_lng) { setMsg(tx("GPS permission is required to record arrival.","ရောက်ရှိမှုမှတ်တမ်းတင်ရန် GPS ခွင့်ပြုချက် လိုအပ်ပါသည်။")); return false; }
    return await act("arrived", gps);
  }

  async function correctDropoffToCurrentGps() {
    if (!selected) return false;
    setBusy(true);
    try {
      const gps = await currentGps();
      if (!gps.gps_lat || !gps.gps_lng) {
        throw new Error(tx(
          "Current GPS is unavailable. Enable precise location permission and try again.",
          "လက်ရှိ GPS မရရှိပါ။ Precise Location Permission ကို ဖွင့်ပြီး ပြန်စမ်းပါ။"
        ));
      }
      const { data, error } = await (supabase as any).rpc("be_rider_dropoff_pin_v147", {
        p_delivery_way_id: selected.delivery_way_id,
        p_latitude: gps.gps_lat,
        p_longitude: gps.gps_lng,
        p_accuracy_m: gps.gps_accuracy_m ?? null,
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.message || data?.error || "Unable to correct drop-off pin.");
      setGeofenceRepairAvailable(false);
      const message = tx(
        `${selected.delivery_way_id}: Drop-off pin corrected to the current GPS. Press Delivered again to complete the normal evidence and geofence checks.`,
        `${selected.delivery_way_id}: Drop-off Pin ကို လက်ရှိ GPS နေရာသို့ ပြင်ဆင်ပြီးပါပြီ။ ပုံမှန် Evidence နှင့် Geofence စစ်ဆေးမှုဖြင့် အပြီးသတ်ရန် Delivered ကို ပြန်နှိပ်ပါ။`
      );
      setDeliveryProgress("success");
      setDeliveryResult(message);
      setMsg(message);
      await load(selected.delivery_way_id);
      return true;
    } catch (error:any) {
      const message = error?.message || tx("Unable to correct drop-off pin.","Drop-off Pin ပြင်ဆင်၍ မရပါ။");
      setDeliveryProgress("error");
      setDeliveryResult(message);
      setMsg(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function failDelivery() {
    if (!selected) return setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။"));
    if (form.failed_reason === "CUSTOMER_REQUESTED_RESCHEDULE") {
      if (!form.reschedule_date) return setMsg(tx("Choose the customer’s dedicated delivery date.","Customer သတ်မှတ်ထားသော ပို့ဆောင်ရက်ကို ရွေးပါ။"));
      const today = new Date();
      const selectedDate = new Date(`${form.reschedule_date}T00:00:00`);
      if (selectedDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        return setMsg(tx("Dedicated delivery date cannot be in the past.","သတ်မှတ်ပို့ဆောင်ရက်သည် ယခင်ရက် မဖြစ်ရပါ။"));
      }
      setBusy(true);
      try {
        const { data, error } = await (supabase as any).rpc("be_set_delivery_reschedule_v71", {
          p_way_id: selected.delivery_way_id,
          p_delivery_date: form.reschedule_date,
          p_reason_code: "CUSTOMER_REQUESTED_RESCHEDULE",
          p_actor_email: null,
          p_note: form.remarks.trim() || null,
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data?.error || "Unable to reschedule delivery.");
        setMsg(`${selected.delivery_way_id}: rescheduled for ${form.reschedule_date}. It is held from Wayplan assignment until that date.`);
        await load(selected.delivery_way_id);
      } catch (error: any) {
        setMsg(error?.message || "Unable to reschedule delivery.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const gps = await currentGps();
    if (!selected) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("be_rider_wayplan_action", {
        p_payload: {
          wayplan_id: selected.wayplan_id,
          delivery_way_id: selected.delivery_way_id,
          action: "failed",
          failed_reason: form.failed_reason,
          remark: form.remarks || null,
          ...gps,
        },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Failed delivery submission failed.");
      setMsg(`${selected.delivery_way_id}: failed delivery saved. Enterprise synchronized Warehouse return queue, Customer Service follow-up, Finance exception review, Operations exception board and RTO tracking where applicable.`);
      await load(selected.delivery_way_id);
    } catch (error: any) {
      setMsg(error?.message || "Failed delivery submission failed.");
    } finally {
      setBusy(false);
    }
  }

  async function failAndReturnToWarehouse() {
    if (!selected) return setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။"));
    if (!failureMode) {
      return setMsg(tx("Click Failed Delivery first, then choose a failed reason.","ပို့ဆောင်မှုမအောင်မြင် ကို အရင်နှိပ်ပြီး အကြောင်းပြချက်ကို ရွေးပါ။"));
    }
    if (!form.failed_reason) {
      return setMsg(tx("Choose a failed delivery reason.","ပို့ဆောင်မှုမအောင်မြင်ရသည့် အကြောင်းပြချက်ကို ရွေးပါ။"));
    }

    if (form.failed_reason === "CUSTOMER_REQUESTED_RESCHEDULE") {
      await failDelivery();
      return;
    }

    const gps=await currentGps();
    setBusy(true);
    try {
      const failedResult=await (supabase as any).rpc("be_field_team_delivery_action_v77", {
        p_payload: {
          wayplan_id:selected.wayplan_id,
          delivery_way_id:selected.delivery_way_id,
          action:"exception",
          exception_reason:form.failed_reason,
          failed_reason:form.failed_reason,
          remark:form.remarks || null,
          ...gps,
        },
      });
      if (failedResult.error) throw failedResult.error;
      if (failedResult.data?.ok===false) throw new Error(failedResult.data?.error || "Failed delivery submission failed.");

      setMsg(tx(
        `${selected.delivery_way_id}: failed delivery recorded. Warehouse Return Scan is now the next physical step.`,
        `${selected.delivery_way_id}: ပို့ဆောင်မှုမအောင်မြင်ကြောင်း မှတ်တမ်းတင်ပြီးပါပြီ။ နောက်တစ်ဆင့်မှာ Warehouse Return Scan လုပ်ရန်ဖြစ်ပါသည်။`
      ));
      setFailureMode(false);
      await load(selected.delivery_way_id);
    } catch(error:any) {
      setMsg(error?.message || "Unable to return parcel to Warehouse.");
    } finally {
      setBusy(false);
    }
  }

  async function sendGps() {
    if (!selected) return setMsg(tx("Select a delivery stop first.","ပို့ဆောင်မည့် Way ကို အရင်ရွေးပါ။"));
    const gps = await currentGps();
    if (!gps.gps_lat) return setMsg(tx("GPS unavailable or permission denied.","GPS မရရှိနိုင်ပါ သို့မဟုတ် ခွင့်ပြုချက် မပေးထားပါ။"));
    setMsg(`Current GPS: ${gps.gps_lat.toFixed(6)}, ${gps.gps_lng.toFixed(6)}. It will be attached to delivery proof.`);
  }

  const activeCount = useMemo(
    () => pickups.filter((job) => !["DELIVERED", "FAILED_DELIVERY", "RETURN_TO_WAREHOUSE"].includes(String(job.stop_status || "").toUpperCase())).length,
    [pickups],
  );

  useEffect(() => {
    const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
    const preferred = new URLSearchParams(hashQuery).get("deliveryWayId") || undefined;
    load(preferred);
  }, []);

  return (
    <div className="be-page min-h-screen p-4 pb-28 lg:pb-6">
      <style>{`
        @keyframes beJellyPress {
          0% { transform: scale(1,1); }
          25% { transform: scale(.93,1.08); }
          50% { transform: scale(1.07,.94); }
          75% { transform: scale(.98,1.03); }
          100% { transform: scale(1,1); }
        }
        .be-jelly-action {
          cursor:pointer;
          transform-origin:center;
          touch-action:manipulation;
          transition:transform .15s ease, box-shadow .2s ease, background-color .2s ease;
        }
        .be-jelly-action:active { animation:beJellyPress .38s ease-out; }
        .be-jelly-action:hover { transform:translateY(-1px); box-shadow:0 10px 24px rgba(15,23,42,.14); }
      `}</style>
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="be-surface rounded-[30px] p-5">
          <h1 className="text-3xl font-black">{tx("Delivery / Drop-Off Process","ပို့ဆောင် / ပစ္စည်းချ လုပ်ငန်းစဉ်")}</h1>
          <p className="font-semibold text-slate-600">{tx("Assigned Wayplan stops, arrival, delivery proof, signature, COD/payment confirmation and failed delivery.","တာဝန်ပေးထားသော Wayplan မှတ်တိုင်များ၊ ရောက်ရှိမှု၊ ပို့ဆောင်သက်သေ၊ လက်မှတ်၊ COD/ငွေပေးချေမှု အတည်ပြုခြင်းနှင့် ပို့ဆောင်မအောင်မြင်မှုတို့ကို စီမံပါ။")}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-white">{pickups.length} assigned</span>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-900">{activeCount} active</span>
          </div>
          <div className="mt-3 rounded-2xl bg-blue-50 p-3 font-bold text-blue-900">{msg}</div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
          <aside className="be-surface be-scrollbar max-h-[78vh] space-y-3 overflow-y-auto rounded-[30px] p-4">
            {pickups.map((p) => {
              const current = p.delivery_way_id === selected?.delivery_way_id;
              return (
                <button
                  key={p.id || `${p.wayplan_id}-${p.delivery_way_id}`}
                  onClick={() => selectJob(p)}
                  className={`w-full rounded-2xl border p-3 text-left hover:bg-slate-50 ${current ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}
                >
                  <b className="font-mono text-blue-700">{p.delivery_way_id || p.waybill_no}</b>
                  <p className="font-black">{p.recipient_name || p.receiver_name || "-"}</p>
                  <p className="text-sm text-slate-500">{p.address || p.township || "-"}</p>
                  <div className="mt-2 flex items-center justify-between text-xs font-bold">
                    <span>{String(p.stop_status || p.rider_status || "PENDING").replaceAll("_", " ")}</span>
                    <span>{Number(p.cod_amount || 0).toLocaleString()} Ks</span>
                  </div>
                </button>
              );
            })}
          </aside>

          <section className="be-surface rounded-[30px] p-5">
            <h2 className="text-xl font-black">{selected?.delivery_way_id || "No delivery stop selected"}</h2>
            {selected && (
              <>
                <div className="mt-2 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-2">
                  <div><b>Wayplan:</b> {selected.wayplan_id}</div>
                  <div><b>Status:</b> {status || "PENDING"}</div>
                  <div><b>Township:</b> {selected.township || "-"}</div>
                  <div><b>COD:</b> {requiredCod.toLocaleString()} Ks</div>
                  <div className="md:col-span-2"><b>Address:</b> {selected.address || "-"}</div>
                </div>

                <section className="mt-4 rounded-[26px] border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50/50 p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-black text-blue-950">{tx("Delivery Drop Workflow","ပို့ဆောင်ပစ္စည်းချ လုပ်ငန်းစဉ်")}</h3>
                      <p className="text-xs font-bold text-blue-700">{tx("Follow the three field steps in order. Buttons remain clickable and explain any missing prerequisite.","Field လုပ်ငန်းအဆင့် ၃ ဆင့်ကို အစဉ်လိုက် ဆောင်ရွက်ပါ။ လိုအပ်ချက်မပြည့်စုံပါက Button ကို disable မလုပ်ဘဲ အကြောင်းပြချက်ပြပါမည်။")}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-900">{status || "PENDING"}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <button type="button" onClick={() => requestConfirm("accept")} className={actionClass("accept","bg-slate-900")}>{tx("Accept","လက်ခံရန်")}</button>
                    <button type="button" onClick={() => requestConfirm("start")} className={actionClass("start","bg-blue-700")}>{tx("Start Delivery","ပို့ဆောင်မှု စတင်ရန်")}</button>
                    <button type="button" onClick={() => requestConfirm("arrive")} className={actionClass("arrive","bg-indigo-700")}>{tx("Arrived at Customer","Customer နေရာသို့ ရောက်ရှိပြီ")}</button>
                  </div>
                </section>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input className="rounded-2xl border p-3 font-bold" placeholder={tx("Receiver name","လက်ခံသူအမည်")} value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} />
                  <input className="rounded-2xl border p-3 font-bold" placeholder={tx("Receiver phone","လက်ခံသူဖုန်း")} value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} />
                  <textarea className="rounded-2xl border p-3 font-bold md:col-span-2" placeholder={tx("Remarks / special issue","မှတ်ချက် / အထူးပြဿနာ")} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="rounded-2xl border p-3 font-bold">
                    {tx("Delivery proof photo","ပို့ဆောင်မှု သက်သေဓာတ်ပုံ")}
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => choosePhoto(e.target.files?.[0])} className="mt-2 block w-full text-sm" />
                    {proofPreview && <img src={proofPreview} className="mt-3 h-40 w-full rounded-2xl object-cover" />}
                    {proofState === "compressing" && <p className="mt-2 text-sm text-blue-700">{tx("Compressing photo…","ဓာတ်ပုံကို ချုံ့နေသည်…")}</p>}
                    {proofPreview && (
                      <button type="button" disabled={proofState === "approved"} onClick={approveProofPhoto} className="mt-3 w-full rounded-xl bg-emerald-600 p-3 text-white disabled:opacity-50">
                        {proofState === "approved" ? tx("Photo approved","ဓာတ်ပုံ အတည်ပြုပြီး") : tx("Approve photo & upload","ဓာတ်ပုံအတည်ပြုပြီး Upload တင်ရန်")}
                      </button>
                    )}
                  </label>
                  <label className="rounded-2xl border p-3 font-bold">
                    {tx("Customer Electronic Signature","Customer အီလက်ထရွန်နစ်လက်မှတ်")}
                    <input type="file" accept="image/*" onChange={(e) => chooseSignature(e.target.files?.[0])} className="mt-2 block w-full text-sm" />
                    <canvas
                      ref={signatureCanvasRef}
                      width={600}
                      height={180}
                      onMouseDown={startSignature}
                      onMouseMove={drawSignature}
                      onMouseUp={stopSignature}
                      onMouseLeave={stopSignature}
                      onTouchStart={startSignature}
                      onTouchMove={drawSignature}
                      onTouchEnd={stopSignature}
                      className="mt-3 h-32 w-full touch-none rounded-xl border bg-white"
                    />
                    <button type="button" onClick={clearSignatureCanvas} className="mt-2 rounded-lg border px-3 py-2 text-xs">{tx("Clear drawn signature","ရေးထားသောလက်မှတ် ဖျက်ရန်")}</button>
                    <div className="mt-3 flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-xl border bg-slate-100 p-3 font-bold disabled:cursor-not-allowed"
                        placeholder={tx("Signed customer name","လက်မှတ်ထိုးသူအမည်")}
                        value={form.signature_name}
                        disabled={!signatureOnBehalf}
                        onChange={(e) => setForm({ ...form, signature_name: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSignatureOnBehalf((current) => {
                            const next = !current;
                            setForm((f) => ({
                              ...f,
                              signature_name: next ? "" : (selected?.recipient_name || selected?.receiver_name || ""),
                            }));
                            return next;
                          });
                        }}
                        className={`be-jelly-action rounded-xl border px-4 py-3 font-black ${
                          signatureOnBehalf ? "bg-amber-500 text-white" : "bg-white text-slate-900"
                        }`}
                      >
                        {tx("On behalf","ကိုယ်စား")}
                      </button>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {signatureOnBehalf
                        ? tx("Type the actual person signing on behalf of the customer.","Customer ကိုယ်စား လက်မှတ်ထိုးသူ၏ အမည်ကို ရိုက်ထည့်ပါ။")
                        : tx("Automatically synchronized from Data Entry recipient name.","Data Entry မှ လက်ခံသူအမည်ကို အလိုအလျောက် Synchronize လုပ်ထားပါသည်။")}
                    </p>
                    {signaturePreview && <img src={signaturePreview} className="mt-3 h-40 w-full rounded-2xl object-contain" />}
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="font-bold">
                    {tx("Payment method","ငွေပေးချေမှုနည်းလမ်း")}
                    <select className="mt-1 w-full rounded-2xl border p-3" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                  <label className="font-bold">
                    {tx("COD collected","ကောက်ခံပြီး COD")}
                    <input
                      className="mt-1 w-full cursor-not-allowed rounded-2xl border bg-slate-100 p-3 font-black text-slate-800"
                      inputMode="decimal"
                      value={String(requiredCod)}
                      readOnly
                      aria-readonly="true"
                    />
                    <span className="mt-1 block text-xs font-bold text-slate-500">
                      {tx("Synchronized automatically from Data Entry calculated amount.","Data Entry တွက်ချက်ထားသည့် ငွေပမာဏမှ အလိုအလျောက် Synchronize လုပ်ထားပါသည်။")}
                    </span>
                  </label>
                  {electronicPayment && (
                    <label className="font-bold md:col-span-2">
                      {tx("Transaction reference","ငွေလွှဲအမှတ်")}
                      <input className="mt-1 w-full rounded-2xl border p-3" value={form.transaction_reference} onChange={(e) => setForm({ ...form, transaction_reference: e.target.value })} />
                    </label>
                  )}
                </div>

                <section className="mt-5 rounded-[26px] border border-slate-200/80 bg-slate-50/80 p-4">
                  <h3 className="text-lg font-black">{tx("Completion / Exception Control","ပို့ဆောင်ပြီး / မအောင်မြင် ထိန်းချုပ်မှု")}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">{tx("Successful delivery and failed-delivery return are separate paths.","ပို့ဆောင်အောင်မြင်မှုနှင့် မအောင်မြင်၍ Warehouse ပြန်ပို့မှုကို သီးခြားလုပ်ငန်းစဉ်ဖြင့် ဆောင်ရွက်ပါ။")}</p>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => requestConfirm("delivered")}
                      disabled={busy}
                      className={`${actionClass("delivered","bg-emerald-600")} disabled:cursor-wait disabled:opacity-60`}
                    >
                      {busy && ["validating","uploading","gps","confirming"].includes(deliveryProgress)
                        ? tx("Processing...","လုပ်ဆောင်နေသည်...")
                        : helperPreparedForDriver
                          ? tx("Accept Helper Done / Delivered","Helper ပြီးစီးမှု အတည်ပြု / ပို့ဆောင်ပြီး")
                          : activeRole === "helper"
                            ? tx("Complete & Send to Driver","ပြီးစီးပြီး Driver သို့ အတည်ပြုရန်ပို့မည်")
                            : tx("Delivered","ပို့ဆောင်ပြီး")}
                    </button>

                    <select
                      disabled={!failureMode}
                      className="rounded-2xl border p-3 font-bold disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      value={form.failed_reason}
                      onChange={(e) => setForm({ ...form, failed_reason: e.target.value })}
                    >
                      <option value="">{tx("Choose failed reason","မအောင်မြင်ရသည့်အကြောင်းပြချက် ရွေးပါ")}</option>
                      {failureReasons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  </div>

                  {deliveryProgress !== "idle" && (
                    <div className={`mt-3 rounded-2xl border p-4 text-sm font-black ${
                      deliveryProgress === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : deliveryProgress === "error"
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : "border-blue-200 bg-blue-50 text-blue-800"
                    }`}>
                      <div className="flex items-center gap-3">
                        {["validating","uploading","gps","confirming"].includes(deliveryProgress) && (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                        )}
                        <span>{deliveryResult}</span>
                      </div>
                    </div>
                  )}

                  {false && (
                    <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                      <div className="font-black text-amber-900">
                        {tx("Saved drop-off location appears incorrect","သိမ်းထားသော Drop-off Location မှားယွင်းနိုင်ပါသည်")}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-amber-800">
                        {tx(
                          "Only use this when you are physically at the customer's correct delivery address. The corrected pin is saved with your authenticated user and GPS evidence.",
                          "Customer ၏ မှန်ကန်သော ပို့ဆောင်ရမည့်နေရာတွင် အမှန်တကယ်ရောက်နေချိန်တွင်သာ အသုံးပြုပါ။ ပြင်ဆင်ထားသော Pin ကို Login User နှင့် GPS Evidence ဖြင့် မှတ်တမ်းတင်ပါမည်။"
                        )}
                      </p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => requestConfirm("fix_dropoff")}
                        className="be-jelly-action mt-3 w-full rounded-2xl bg-amber-600 p-3 font-black text-white disabled:opacity-50"
                      >
                        {tx("Correct Drop-off to Current GPS","လက်ရှိ GPS ကို Drop-off အဖြစ်ပြင်မည်")}
                      </button>
                    </div>
                  )}

                  {failureMode && form.failed_reason === "CUSTOMER_REQUESTED_RESCHEDULE" && (
                    <label className="mt-3 block rounded-2xl border bg-white p-3 font-bold">
                      {tx("Dedicated delivery date","သတ်မှတ်ပို့ဆောင်ရက်")}
                      <input type="date" className="mt-1 w-full rounded-xl border p-2" value={form.reschedule_date} onChange={(e) => setForm({ ...form, reschedule_date: e.target.value })} />
                    </label>
                  )}

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => requestConfirm("failed")}
                      className={actionClass("failed","bg-rose-600")}
                    >
                      {tx("Failed Delivery","ပို့ဆောင်မှုမအောင်မြင်")}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestConfirm("return")}
                      className={actionClass("return","bg-orange-600")}
                    >
                      {tx("Return to Warehouse","Warehouse သို့ ပြန်ပို့ရန်")}
                    </button>
                    <button type="button" onClick={() => requestConfirm("gps")} className={`be-jelly-action rounded-2xl border p-3 font-black ${activeActions[visualActionKey("gps")] ? "border-violet-700 bg-violet-700 text-white ring-4 ring-violet-200" : "bg-white text-slate-900"}`}>{tx("Check Current GPS","လက်ရှိ GPS စစ်ရန်")}</button>
                  </div>
                </section>

                {confirmAction && (
                  <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-[0_30px_80px_rgba(15,23,42,.22)] backdrop-blur-2xl">
                      <h3 className="text-xl font-black">{tx("Confirm action?","လုပ်ဆောင်ချက်ကို အတည်ပြုမည်လား?")}</h3>
                      <p className="mt-2 font-semibold text-slate-600">
                        {confirmAction==="accept" && tx("Accept this parcel?","ဤပါဆယ်ကို လက်ခံမည်လား?")}
                        {confirmAction==="start" && tx("Start delivery now?","ယခု ပို့ဆောင်မှု စတင်မည်လား?")}
                        {confirmAction==="arrive" && tx("Confirm arrival at the customer?","Customer နေရာသို့ ရောက်ရှိကြောင်း အတည်ပြုမည်လား?")}
                        {confirmAction==="delivered" && tx("Confirm successful delivery? Required proof, signature and COD/payment will be validated.","ပို့ဆောင်ပြီးကြောင်း အတည်ပြုမည်လား? လိုအပ်သော ဓာတ်ပုံ၊ လက်မှတ်နှင့် COD/ငွေပေးချေမှုကို စစ်ဆေးပါမည်။")}
                        {confirmAction==="failed" && tx("Open failed-delivery mode and enable the failed reason list?","ပို့ဆောင်မှုမအောင်မြင် လုပ်ငန်းစဉ်ကို ဖွင့်ပြီး အကြောင်းပြချက်စာရင်းကို အသုံးပြုမည်လား?")}
                        {confirmAction==="return" && tx("Record the failed delivery and return this parcel to Warehouse?","ပို့ဆောင်မှုမအောင်မြင်ကြောင်း မှတ်တမ်းတင်ပြီး Warehouse သို့ ပြန်ပို့မည်လား?")}
                        {confirmAction==="gps" && tx("Check current GPS now?","လက်ရှိ GPS တည်နေရာကို စစ်ဆေးမည်လား?")}
                        {confirmAction==="fix_dropoff" && tx(
                          "You are confirming that you are physically at the customer's correct delivery address. Replace the saved drop-off pin with this device's current GPS?",
                          "Customer ၏ မှန်ကန်သော ပို့ဆောင်ရမည့်နေရာတွင် အမှန်တကယ်ရောက်နေကြောင်း အတည်ပြုပါသည်။ သိမ်းထားသော Drop-off Pin ကို ယခု Device ၏ လက်ရှိ GPS ဖြင့် အစားထိုးမည်လား?"
                        )}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setConfirmAction(null)} className="be-jelly-action rounded-2xl border p-3 font-black">{tx("No","မဟုတ်ပါ")}</button>
                        <button type="button" onClick={() => void executeConfirmedAction(confirmAction)} className="be-jelly-action rounded-2xl bg-violet-700 p-3 font-black text-white">{tx("Yes","ဟုတ်ကဲ့")}</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
