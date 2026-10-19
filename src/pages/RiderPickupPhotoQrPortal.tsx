import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";
import {
  chooseNativeGalleryFile,
  consumeRestoredNativePhoto,
  peekRestoredNativePhoto,
  hasNativePhotoBridge,
  isNativeAndroidApp,
  NATIVE_PHOTO_RESTORED_EVENT,
  shouldUseHtmlCameraCapture,
  takeNativePhotoFile,
} from "@/lib/nativePhoto";

import { mergeCaptureParcels, canReuseUploadedPhoto, needsPhotoReplacement, isCurrentParcelDraft } from "@/lib/pickupPhotoState";
import { confirmPhotoUpload } from "@/lib/proofUploadState";

type PickupRow = Record<string, any>;

type ParcelDraft = {
  line_no: number;
  waybill_no: string;
  delivery_way_id: string;
  temp_qr_code: string;
  parcel_weight: string;
  remarks: string;
  cargo_photo_data_url?: string;
  cargo_photo_url?: string;
  cargo_photo_file?: File;
  cargo_photo_name?: string;
  photo_status?: string;
  photo_error?: string;
  saved?: boolean;
  review_status?: string;
  review_note?: string;
  reviewed_photo_url?: string;
  previous_photo_url?: string;
  draft_revision?: number;
};

function rowsFromSnapshot(data: any): PickupRow[] {
  for (const key of ["assigned_pickups", "delivery_jobs", "jobs", "items"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function safeText(value: any, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function baseFromPickup(pickupId: string) {
  const clean = String(pickupId || "").toUpperCase();
  const match = clean.match(/^P([0-9]{4}-[A-Z0-9]+)-[0-9]{3}$/);
  return match ? match[1] : clean.replace(/^P/, "");
}

function lineCode(prefix: "D" | "W", pickupId: string, lineNo: number) {
  const safeLine = Math.max(1, Math.min(Number(lineNo || 1), 500));
  return `${prefix}${baseFromPickup(pickupId)}-${String(safeLine).padStart(3, "0")}`;
}

function tempQrCode(pickupId: string, lineNo: number) {
  return `TQR-${String(pickupId || "").toUpperCase()}-${String(lineNo).padStart(3, "0")}`;
}

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`;
}

async function compressPickupPhoto(file: File, maxBytes = 8 * 1024 * 1024): Promise<File> {
  const mime = String(file.type || "").toLowerCase();
  if (mime && !mime.startsWith("image/")) throw new Error("Select an image file.");
  if (file.size > 14 * 1024 * 1024) {
    throw new Error("Photo is too large. Please choose an image smaller than 14 MB.");
  }

  // Compression is optional. Older iOS/Android WebViews may not support
  // createImageBitmap/OffscreenCanvas even though direct file upload works.
  if (file.size <= maxBytes || /heic|heif/.test(mime) || typeof Worker === "undefined") return file;

  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("../workers/proofCompressionWorker.ts", import.meta.url), { type: "module" });
    const buffer = await file.arrayBuffer();
    return await new Promise<File>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Photo compression timed out.")), 20_000);
      worker!.onmessage = (event) => {
        window.clearTimeout(timer);
        if (!event.data?.ok) return reject(new Error(event.data?.error || "Photo compression failed."));
        resolve(new File([event.data.buffer], event.data.name || "pickup-proof.jpg", { type: event.data.type || "image/jpeg" }));
      };
      worker!.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Photo compression failed."));
      };
      worker!.postMessage({ buffer, type: file.type, name: file.name, maxBytes, maxWidth: 1600, maxHeight: 1200 }, [buffer]);
    });
  } catch (error) {
    if (file.size <= 14 * 1024 * 1024) return file;
    throw error;
  } finally {
    worker?.terminate();
  }
}

function readPhotoPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function safeStorageSegment(value: string) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function photoExtension(file: File) {
  const byName = String(file.name || "").split(".").pop()?.toLowerCase();
  if (byName && /^[a-z0-9]{2,5}$/.test(byName)) return byName === "jpeg" ? "jpg" : byName;
  const mime = String(file.type || "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("heif")) return "heif";
  return "jpg";
}

function buildParcels(pickup: PickupRow): ParcelDraft[] {
  const pickupId = safeText(pickup.pickup_id || pickup.pickup_way_id, "");
  const count = Math.max(1, Math.min(Number(pickup.parcel_count || pickup.expected_parcels || 1), 500));

  return Array.from({ length: count }, (_, idx) => {
    const line = idx + 1;
    return {
      line_no: line,
      waybill_no: lineCode("W", pickupId, line),
      delivery_way_id: lineCode("D", pickupId, line),
      temp_qr_code: tempQrCode(pickupId, line),
      parcel_weight: "",
      remarks: "",
      photo_status: "pending_photo_check",
      saved: false,
    };
  });
}

export default function RiderPickupPhotoQrPortal() {
  const { language } = useAppState();
  const tx = (en:string,my:string) => language === "my" ? my : en;
  const params = useParams();
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [selectedPickup, setSelectedPickup] = useState<PickupRow | null>(null);
  const [correctedCount, setCorrectedCount] = useState("");
  const [countReason, setCountReason] = useState("");
  const [countRequestPending, setCountRequestPending] = useState(false);
  const [parcels, setParcels] = useState<ParcelDraft[]>([]);
  const [search, setSearch] = useState(params.pickupId || "");
  const [message, setMessage] = useState(language === "my" ? "တာဝန်ပေးထားသော Pickup များကို ဖွင့်နေသည်..." : "Loading assigned pickups...");
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [savingLine, setSavingLine] = useState<number | null>(null);
  const [uploadingLine, setUploadingLine] = useState<number | null>(null);
  const [parcelPage, setParcelPage] = useState(1);
  const pageSize = 20;
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const galleryRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [bulkPreparing, setBulkPreparing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [batchWeight, setBatchWeight] = useState("2");
  const [specialRange, setSpecialRange] = useState(false);
  const [replaceUnsavedWeights, setReplaceUnsavedWeights] = useState(false);
  const stagedPhotoFiles = useRef<Map<number, File>>(new Map());
  const activePickupRef = useRef("");
  const photoWorkRef = useRef(false);
  const saveWorkRef = useRef(false);
  const parcelDraftsRef = useRef<ParcelDraft[]>([]);
  const pickupDrafts = useRef(new Map<string, ParcelDraft[]>());
  const snapshotRequest = useRef(0);
  const photoRevisions = useRef(new Map<string, number>());
  const uploadPaths = useRef(new WeakMap<File, Map<string, string>>());
  const pendingUploads = useRef(new Map<string, Promise<any>>());
  useEffect(() => { parcelDraftsRef.current = parcels; }, [parcels]);

  function applyBatchWeight() {
    if (!selectedPickup?.can_open_workspace || actionBusy || savingLine !== null || photoWorkRef.current || saveWorkRef.current) return;
    const weight = Number(batchWeight);
    const max = specialRange ? 5 : 3;
    if (!Number.isFinite(weight) || weight < 1 || weight > max) {
      setMessage("Enter an actual parcel weight from 1 to " + max + " kg.");
      return;
    }
    const targets = parcels.filter(p => !p.saved && (replaceUnsavedWeights || !p.parcel_weight.trim())).length;
    setParcels(current => current.map(p => p.saved || (!replaceUnsavedWeights && p.parcel_weight.trim())
      ? p : { ...p, parcel_weight: String(weight), draft_revision: (p.draft_revision || 0) + 1 }));
    setMessage("Applied " + weight + " kg to " + targets + " unsaved parcel(s). Confirm actual weights before saving.");
  }

  async function stageContinuousPhotos(files: FileList | null) {
    if (!files?.length || !selectedPickup?.can_open_workspace || bulkPreparing || actionBusy || photoWorkRef.current || saveWorkRef.current) return;
    const stagePickupId = activePickupRef.current;
    const available = parcels.filter((p) => !p.cargo_photo_url && !p.cargo_photo_file && !stagedPhotoFiles.current.has(p.line_no));
    if (files.length > available.length) {
      setMessage(`Selected ${files.length} photos but only ${available.length} empty parcel slots remain. Nothing staged.`);
      return;
    }
    photoWorkRef.current = true;
    setBulkPreparing(true);
    let count = 0;
    try {
      for (const original of Array.from(files)) {
        const parcel = available[count];
        const prepared = await compressPickupPhoto(original);
        if (activePickupRef.current !== stagePickupId) return;
        const preview = await readPhotoPreview(prepared);
        if (activePickupRef.current !== stagePickupId) return;
        stagedPhotoFiles.current.set(parcel.line_no, prepared);
        editParcel(parcel.line_no, {
          cargo_photo_file: prepared,
          cargo_photo_name: prepared.name,
          cargo_photo_data_url: preview,
          saved: false,
          photo_status: "photo_staged",
          photo_error: undefined,
        });
        count++;
      }
      setMessage(`Staged ${count} photos in parcel order. Review each photo/parcel match, then select Upload All. No photos uploaded yet.`);
    } catch (error: any) {
      setMessage(`Staged ${count} photos. ${error?.message || "Photo preparation failed."} You can select more photos to continue.`);
    } finally { photoWorkRef.current = false; setBulkPreparing(false); }
  }


  async function loadAssignedPickups() {
    setLoading(true);
    setMessage(tx("Loading Enterprise Pickup Requests...","Enterprise Pickup Request များကို ဖွင့်နေသည်..."));

    const { data, error } = await (supabase as any).rpc("be_field_pickup_request_options_v187", {
      p_limit: 300,
    });

    if (error) {
      console.error(error);
      setMessage(tx(`Failed to load Pickup Requests: ${error.message}`,`Pickup Request များကို ဖွင့်မရပါ: ${error.message}`));
      setLoading(false);
      return;
    }

    const rows: PickupRow[] = (Array.isArray(data?.requests) ? data.requests : []).filter(
      (row: PickupRow) => row?.assigned_to_me === true && row?.can_open_workspace === true
    );
    setPickups(rows);

    const requested = selectedPickup?.pickup_id || params.pickupId || search;
    const requestedRow = rows.find((row) => row.pickup_id === requested || row.pickup_way_id === requested);
    const first =
      (requestedRow?.can_open_workspace ? requestedRow : null) ||
      rows.find((row) => row.assigned_to_me && row.can_open_workspace) ||
      null;

    if (first) {
      await selectPickup(first);
    } else {
      setSelectedPickup(null);
      setParcels([]);
    }

    const assignedCount = Number(data?.counts?.assigned_to_me || 0);
    const waitingCount = Number(data?.counts?.waiting_assignment || 0);
    setMessage(
      tx(
        `Loaded ${rows.length} Enterprise Pickup Request(s): ${assignedCount} assigned to you, ${waitingCount} waiting assignment.`,
        `Enterprise Pickup Request ${rows.length} ခု ဖွင့်ပြီးပါပြီ။ သင့်ထံတာဝန်ပေးထားသည် ${assignedCount} ခု၊ တာဝန်ပေးရန်စောင့်နေသည် ${waitingCount} ခု။`
      )
    );
    setLoading(false);
  }

  async function selectPickup(row: PickupRow) {
    const targetId = safeText(row.pickup_id || row.pickup_way_id, "");
    if (activePickupRef.current) pickupDrafts.current.set(activePickupRef.current, parcelDraftsRef.current);
    if (activePickupRef.current !== targetId) {
      stagedPhotoFiles.current.clear();
      setUploadingLine(null);
      setSavingLine(null);
      parcelDraftsRef.current = pickupDrafts.current.get(targetId) || [];
      setParcels(parcelDraftsRef.current);
    }
    activePickupRef.current = targetId;
    const request = ++snapshotRequest.current;
    setSelectedPickup(row);
    setCorrectedCount(String(row.parcel_count || row.expected_parcels || 1));
    setCountReason("");
    setCountRequestPending(false);

    const pickupId = safeText(row.pickup_id || row.pickup_way_id, "");

    setParcelPage(1);

    if (!row.can_open_workspace) {
      setParcels([]);
      const scope = String(row.assignment_scope || "");
      setMessage(
        scope === "WAITING_ASSIGNMENT"
          ? tx("This Pickup Request is visible but is waiting for Operations/Supervisor assignment. No parcel action is available yet.","ဤ Pickup Request ကို မြင်နိုင်သော်လည်း Operations/Supervisor မှ တာဝန်ပေးရန် စောင့်နေပါသည်။ Parcel လုပ်ဆောင်ချက်များ မရနိုင်သေးပါ။")
          : tx("This Pickup Request belongs to another field worker. Select one assigned to you.","ဤ Pickup Request ကို အခြား field worker တစ်ဦးထံ တာဝန်ပေးထားပါသည်။ သင့်ထံတာဝန်ပေးထားသော Pickup ကို ရွေးပါ။")
      );
      return;
    }

    const { data, error } = await (supabase as any).rpc("be_pickup_parcel_capture_snapshot", {
      p_pickup_id: pickupId,
    });
    if (request !== snapshotRequest.current || activePickupRef.current !== pickupId) return;
    if (error || data?.ok === false) {
      setMessage(error?.message || data?.error || "Unable to load saved parcel photos. Retry the refresh before retaking photos.");
      if (!parcelDraftsRef.current.length) setParcels(buildParcels(row));
      return;
    }

    const generated = buildParcels(row);
    const savedParcels = Array.isArray(data?.parcels) ? data.parcels : [];

    const merged = mergeCaptureParcels(generated, savedParcels, parcelDraftsRef.current);
    parcelDraftsRef.current = merged;
    setParcels(merged);
  }

  async function refreshPickupAfterAction(pickupId: string) {
    const { data, error } = await (supabase as any).rpc("be_field_pickup_request_options_v187", {
      p_limit: 300,
    });
    if (error) throw error;
    if (data?.ok === false) throw new Error(data?.error || "Unable to refresh pickup status.");
    const rows = Array.isArray(data?.requests) ? data.requests : [];
    setPickups(rows);
    const current = rows.find((row: PickupRow) => String(row.pickup_id || row.pickup_way_id) === pickupId);
    if (!current) throw new Error(`${pickupId}: pickup is no longer in the assigned pickup list. Refresh to check its status.`);
    await selectPickup(current);
    return current;
  }

  async function performPickupAction(action: string) {
    if (!selectedPickup) return;
    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");
    setActionBusy(action);
    try {
      const { data, error } = await (supabase as any).rpc("be_field_team_pickup_action", {
        p_payload: { pickup_id: pickupId, action },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Pickup action failed.");

      const current = await refreshPickupAfterAction(pickupId);
      setMessage(tx(
        `${pickupId}: ${String(action).replace(/_/g, " ")} completed. Next: ${String(current.next_action || "REFRESH").replace(/_/g, " ")}.`,
        `${pickupId}: ${String(action).replace(/_/g, " ")} အောင်မြင်ပါသည်။ နောက်လုပ်ဆောင်ရန်: ${String(current.next_action || "REFRESH").replace(/_/g, " ")}။`
      ));
    } catch (error:any) {
      console.error(error);
      setMessage(error?.message || tx("Pickup action failed.","Pickup လုပ်ဆောင်မှု မအောင်မြင်ပါ။"));
    } finally {
      setBulkProgress("");
      setActionBusy("");
    }
  }

  function updateParcel(lineNo: number, patch: Partial<ParcelDraft>) {
    const next = parcelDraftsRef.current.map((parcel) =>
      parcel.line_no === lineNo ? { ...parcel, ...patch, saved: patch.saved ?? parcel.saved } : parcel
    );
    parcelDraftsRef.current = next;
    setParcels(next);
  }

  function editParcel(lineNo: number, patch: Partial<ParcelDraft>) {
    const current = parcelDraftsRef.current.find(row => row.line_no === lineNo);
    updateParcel(lineNo, { ...patch, saved: false, draft_revision: (current?.draft_revision || 0) + 1 });
  }

  async function refreshParcelSnapshot() {
    if (!selectedPickup) return;
    await selectPickup(selectedPickup);
  }

  async function uploadPhotoFile(lineNo: number, file: File, pickupId: string, deliveryWayId: string) {
    if (!supabase) throw new Error("Enterprise storage is not configured.");

    const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionResult?.session?.user) {
      throw new Error("Your Rider session expired. Sign in again, then retry the photo upload.");
    }

    const scope = `${pickupId}:${lineNo}`;
    let paths = uploadPaths.current.get(file);
    if (!paths) { paths = new Map(); uploadPaths.current.set(file, paths); }
    let path = paths.get(scope);
    if (!path) {
      const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      path = `pickup/${safeStorageSegment(pickupId)}/${safeStorageSegment(deliveryWayId)}/${id}-${lineNo}.${photoExtension(file)}`;
      paths.set(scope, path);
    }
    const storedPath = path;
    await confirmPhotoUpload({
      path: storedPath,
      pending: pendingUploads.current,
      upload: () => supabase.storage.from("rider-proofs").upload(storedPath, file, {
        upsert: false, cacheControl: "3600", contentType: file.type || "image/jpeg",
      }),
      verifyExisting: async () => {
        const { data, error } = await supabase.storage.from("rider-proofs").download(storedPath);
        if (error || !data || data.size !== file.size) return false;
        const hash = async (blob: Blob) => new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
        const [original, stored] = await Promise.all([hash(file), hash(data)]);
        return original.every((byte, index) => byte === stored[index]);
      },
    });
    const { data } = supabase.storage.from("rider-proofs").getPublicUrl(storedPath);
    const url = data?.publicUrl;
    if (!url) throw new Error("Unable to create Rider proof URL.");
    return url;
  }

  async function openCameraForParcel(lineNo: number) {
    const capturePickup = selectedPickup;
    if (isNativeAndroidApp()) {
      try {
        const pickupId = safeText(capturePickup?.pickup_id || capturePickup?.pickup_way_id, "");
        const route = window.location.hash.replace(/^#/, "") || "/pickup-verification";
        setMessage(tx("Opening device camera... Return here after taking the photo.","Device camera ဖွင့်နေသည်... ဓာတ်ပုံရိုက်ပြီးနောက် ဤနေရာသို့ ပြန်လာပါ။"));
        const file = await takeNativePhotoFile(`pickup-${lineNo}`, {
          kind: "pickup-parcel",
          route,
          lineNo,
          pickupId,
        });
        await onPhotoSelected(lineNo, file, capturePickup || undefined);
      } catch (error: any) {
        setMessage(error?.message || "Unable to take photo.");
      }
      return;
    }
    const input = fileRefs.current[lineNo];
    if (!input) {
      setMessage(tx("Camera input is not ready. Refresh this pickup and try again.","Camera input မပြင်ဆင်ရသေးပါ။ Pickup ကို Refresh ပြန်လုပ်ပြီး ထပ်စမ်းပါ။"));
      return;
    }
    input.click();
  }

  async function openGalleryForParcel(lineNo: number) {
    const capturePickup = selectedPickup;
    if (isNativeAndroidApp()) {
      try {
        const file = await chooseNativeGalleryFile(`pickup-${lineNo}`, {
          kind: "pickup-parcel", route: window.location.hash.replace(/^#/, "") || "/pickup-verification",
          lineNo, pickupId: safeText(capturePickup?.pickup_id || capturePickup?.pickup_way_id, ""),
        });
        await onPhotoSelected(lineNo, file, capturePickup || undefined);
      } catch (error: any) {
        setMessage(error?.message || "Unable to choose photo.");
      }
      return;
    }
    galleryRefs.current[lineNo]?.click();
  }

  async function onPhotoSelected(lineNo: number, file?: File, pickupOverride?: PickupRow) {
    const activePickup = pickupOverride || selectedPickup;
    if (!file || !activePickup) return;
    if (photoWorkRef.current || saveWorkRef.current) { setMessage("Wait for the current photo or parcel save to finish."); return; }
    if (!activePickup.can_open_workspace) {
      setMessage(tx(
        "This pickup is not assigned to your field-team account.",
        "ဤ Pickup ကို သင့် field-team account သို့ တာဝန်ပေးထားခြင်း မရှိသေးပါ။"
      ));
      return;
    }

    const pickupId = safeText(activePickup.pickup_id || activePickup.pickup_way_id, "");
    const currentParcel = parcelDraftsRef.current.find((parcel) => parcel.line_no === lineNo);
    if (currentParcel?.cargo_photo_url) {
      const replaceUploaded = window.confirm(tx(
        `Parcel ${lineNo} already has an uploaded photo. Review the existing photo before replacing it. Do you want to replace it?`,
        `Parcel ${lineNo} တွင် ဓာတ်ပုံတင်ပြီးဖြစ်သည်။ အသစ်ဖြင့် အစားထိုးမည်လား။`
      ));
      if (!replaceUploaded) {
        setMessage(tx(`Parcel ${lineNo}: existing photo kept. No duplicate upload made.`, `Parcel ${lineNo}: မူလဓာတ်ပုံကို ထိန်းသိမ်းထားသည်။`));
        return;
      }
    }
    if (activePickupRef.current !== pickupId) return;
    const key = `${pickupId}:${lineNo}`;
    const revision = (photoRevisions.current.get(key) || 0) + 1;
    photoRevisions.current.set(key, revision);
    const stillCurrent = () => activePickupRef.current === pickupId && photoRevisions.current.get(key) === revision;
    photoWorkRef.current = true;
    setUploadingLine(lineNo);
    try {
      const prepared = await compressPickupPhoto(file);
      const preview = await readPhotoPreview(prepared);
      if (!stillCurrent()) return;
      editParcel(lineNo, {
        cargo_photo_data_url: preview, cargo_photo_file: prepared, cargo_photo_url: "",
        previous_photo_url: currentParcel?.cargo_photo_url || currentParcel?.previous_photo_url,
        cargo_photo_name: prepared.name, photo_status: "photo_staged", photo_error: undefined, saved: false,
      });
      stagedPhotoFiles.current.set(lineNo, prepared);
      setMessage(tx(`Parcel ${lineNo}: review the photo, then approve and upload.`, `Parcel ${lineNo}: ဓာတ်ပုံကို စစ်ဆေးပြီး အတည်ပြုကာ Upload တင်ပါ။`));
    } catch (error: any) {
      if (stillCurrent()) setMessage(error?.message || "Unable to prepare the selected photo. Existing photo kept.");
    } finally { photoWorkRef.current = false; if (stillCurrent()) setUploadingLine(null); }
  }

  async function ensurePhotoUploaded(parcel: ParcelDraft, pickupId: string) {
    if (!parcel.cargo_photo_file && canReuseUploadedPhoto(parcel)) return parcel.cargo_photo_url!;
    if (!parcel.cargo_photo_file) throw new Error(`Parcel ${parcel.line_no}: take a new photo to replace the rejected evidence.`);
    if (activePickupRef.current !== pickupId) throw new Error("Pickup changed. Return to the original pickup to continue.");
    if (photoWorkRef.current) throw new Error("Another photo operation is in progress. Please wait.");
    photoWorkRef.current = true;
    const file = parcel.cargo_photo_file;
    setUploadingLine(parcel.line_no);
    updateParcel(parcel.line_no, { photo_status: "photo_uploading", photo_error: undefined, saved: false });
    try {
      const url = await uploadPhotoFile(parcel.line_no, file, pickupId, parcel.delivery_way_id);
      if (activePickupRef.current !== pickupId) throw new Error("Pickup changed while uploading. Return to the original pickup and retry the same photo.");
      const current = parcelDraftsRef.current.find(row => row.line_no === parcel.line_no);
      if (!isCurrentParcelDraft(current, parcel) || current?.cargo_photo_file !== file) throw new Error("Photo changed during upload. The newer draft has been kept.");
      updateParcel(parcel.line_no, { cargo_photo_url: url, cargo_photo_file: undefined,
        photo_status: "photo_uploaded", photo_error: undefined, saved: false });
      stagedPhotoFiles.current.delete(parcel.line_no);
      return url;
    } catch (error: any) {
      if (activePickupRef.current === pickupId && isCurrentParcelDraft(parcelDraftsRef.current.find(row => row.line_no === parcel.line_no), parcel)) updateParcel(parcel.line_no, { photo_status: "photo_upload_failed", photo_error: error?.message || "Photo upload failed", saved: false });
      throw error;
    } finally { photoWorkRef.current = false; if (activePickupRef.current === pickupId) setUploadingLine(null); }
  }

  async function approveParcelPhoto(parcel: ParcelDraft) {
    const id = activePickupRef.current;
    try {
      await ensurePhotoUploaded(parcel, id);
      if (activePickupRef.current === id) setMessage(tx(`Parcel ${parcel.line_no}: photo uploaded. Save Photo & Parcel to send it for review.`, `Parcel ${parcel.line_no}: ဓာတ်ပုံ Upload ပြီးပါပြီ။ စစ်ဆေးရန် ဓာတ်ပုံနှင့် Parcel ကို သိမ်းပါ။`));
    } catch (error: any) { if (activePickupRef.current === id) setMessage(error?.message || "Photo upload failed."); }
  }

  async function saveParcel(parcel: ParcelDraft) {
    if (!selectedPickup || saveWorkRef.current || photoWorkRef.current) return false;
    if (!selectedPickup.can_open_workspace) {
      setMessage(tx("This pickup is not assigned to your field-team account.","ဤ Pickup ကို သင့် field-team account သို့ တာဝန်ပေးထားခြင်း မရှိသေးပါ။"));
      return false;
    }
    const weight = Number(parcel.parcel_weight || 0);
    if (!Number.isFinite(weight) || weight <= 0) {
      setMessage(tx(`Parcel ${parcel.line_no}: enter actual weight greater than 0.`,`Parcel ${parcel.line_no}: အလေးချိန် 0 ထက်ကြီးသောတန်ဖိုး ထည့်ပါ။`));
      return false;
    }
    if (!parcel.cargo_photo_file && !parcel.cargo_photo_url) {
      setMessage(tx(`Parcel ${parcel.line_no}: capture or upload a cargo photo first.`,`Parcel ${parcel.line_no}: ကုန်ပစ္စည်းဓာတ်ပုံကို အရင်ရိုက်ယူ သို့မဟုတ် Upload တင်ပါ။`));
      return false;
    }

    saveWorkRef.current = true;
    setSavingLine(parcel.line_no);
    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");

    let durablePhotoUrl = parcel.cargo_photo_url || "";
    try {
      durablePhotoUrl = await ensurePhotoUploaded(parcel, pickupId);
    } catch (error: any) {
      setMessage(error?.message || `Photo upload failed for parcel ${parcel.line_no}.`);
      setSavingLine(null);
      saveWorkRef.current = false;
      return false;
    }

    const payload = {
      pickup_id: pickupId,
      pickup_way_id: selectedPickup.pickup_way_id || pickupId,
      line_no: parcel.line_no,
      row_no: parcel.line_no,
      waybill_no: parcel.waybill_no,
      delivery_way_id: parcel.delivery_way_id,
      parcel_weight: parcel.parcel_weight || 0,
      remarks: parcel.remarks || "",
      cargo_photo_url: durablePhotoUrl,
      cargo_photo_data_url: null as string | null,
      cargo_photo_name: parcel.cargo_photo_name || null,
      temp_qr_code: parcel.temp_qr_code,
    };

    try {
      if (activePickupRef.current !== pickupId) throw new Error("Pickup changed before save. Return to the original pickup to continue.");
      const { data, error } = await (supabase as any).rpc("be_pickup_parcel_capture_save", {
        p_payload: payload,
      });
      if (error) throw error;
      if (data?.ok !== true) throw new Error(data?.error || "Enterprise did not confirm the parcel save.");

      if (activePickupRef.current !== pickupId) return true;
      if (!isCurrentParcelDraft(parcelDraftsRef.current.find(row => row.line_no === parcel.line_no), parcel)) {
        setMessage("The earlier parcel version was saved. Your newer edits are kept; review and save them again.");
        return false;
      }
      updateParcel(parcel.line_no, {
        cargo_photo_url: durablePhotoUrl,
        cargo_photo_file: undefined,
        photo_status: data.photo_status || "photo_uploaded",
        saved: true,
      });
      if (activePickupRef.current !== pickupId) return true;
      await refreshParcelSnapshot();
      setMessage(tx(`Parcel ${parcel.line_no} saved successfully.`,`Parcel ${parcel.line_no} ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`));
      return true;
    } catch (error: any) {
      console.error("Parcel save failed", error);
      setMessage(`Parcel ${parcel.line_no}: ${error?.message || "Save failed. Please retry."}`);
      return false;
    } finally {
      saveWorkRef.current = false;
      if (activePickupRef.current === pickupId) setSavingLine(null);
    }
  }

  async function requestPickupCountCorrection() {
    if (!selectedPickup || actionBusy || countRequestPending) return;
    const nextCount = Number(correctedCount);
    const requested = Number(selectedPickup.parcel_count || selectedPickup.expected_parcels || 1);
    if (!Number.isInteger(nextCount) || nextCount < 1 || nextCount > 500 || nextCount === requested) {
      setMessage("Enter a different whole-number parcel count between 1 and 500."); return;
    }
    if (countReason.trim().length < 8 || parcels.some(p => p.saved)) {
      setMessage("Add a reason (at least 8 characters). Count corrections must be requested before saving parcels."); return;
    }
    setActionBusy("count-correction");
    try {
      const {data,error} = await (supabase as any).rpc("be_rider_request_pickup_count_change_v1", {
        p_pickup_id: safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, ""),
        p_count:nextCount,p_reason:countReason.trim(),
      });
      if (error || data?.ok === false) throw new Error(error?.message || data?.error || "Count correction request failed");
      setCountRequestPending(true);
      setMessage("Count discrepancy sent for supervisor review. Original request stays unchanged until approved.");
    } catch (e:any) { setMessage(e?.message || "Count correction request failed."); }
    finally {setActionBusy("");}
  }

  async function submitPickupVerification() {
    if (!selectedPickup) return;
    if (countRequestPending) { setMessage("Pickup count correction is pending supervisor review. Refresh after approval before verifying."); return; }
    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");
    const validSaved = parcels.filter((p) => p.saved);
    if (validSaved.length === 0) {
      setMessage(tx("Save at least one parcel with weight and photo before submitting verification.","Verification မတင်မီ အလေးချိန်နှင့် ဓာတ်ပုံပါ Parcel အနည်းဆုံးတစ်ခု သိမ်းဆည်းပါ။"));
      return;
    }
    setActionBusy("verify");
    try {
      const { data, error } = await (supabase as any).rpc("be_field_team_pickup_action", {
        p_payload: { pickup_id: pickupId, action: "verify" },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Verification submit failed.");
      const current = await refreshPickupAfterAction(pickupId);
      setMessage(`${pickupId}: ${data?.message || tx("Pickup verification submitted.", "Pickup verification တင်သွင်းပြီးပါပြီ။")} ${tx("Next:", "နောက်လုပ်ဆောင်ရန်:")} ${String(current.next_action || "REFRESH").replace(/_/g, " ")}.`);
    } catch (error:any) {
      setMessage(error?.message || tx("Verification submit failed.","Verification တင်သွင်းမှု မအောင်မြင်ပါ။"));
    } finally {
      setActionBusy("");
    }
  }

  async function saveAllParcels() {
    const readyParcels = parcels.filter((parcel) => {
      const weight = Number(parcel.parcel_weight || 0);
      const hasPhoto = Boolean(parcel.cargo_photo_file || parcel.cargo_photo_url || parcel.cargo_photo_data_url);
      return Number.isFinite(weight) && weight > 0 && hasPhoto;
    });

    if (readyParcels.length === 0) {
      setMessage(tx(
        "No parcel is ready to save yet. Enter weight and capture/upload a cargo photo first.",
        "သိမ်းရန် အဆင်သင့်ဖြစ်သော Parcel မရှိသေးပါ။ အလေးချိန်ထည့်ပြီး ကုန်ပစ္စည်းဓာတ်ပုံကို ရိုက်ယူ/Upload တင်ပါ။"
      ));
      return;
    }

    let okCount = 0;
    for (const parcel of readyParcels) {
      const ok = await saveParcel(parcel);
      if (ok) okCount += 1;
    }

    setMessage(tx(
      `Saved ${okCount}/${readyParcels.length} ready parcel record(s).`,
      `သိမ်းရန်အဆင်သင့် Parcel ${okCount}/${readyParcels.length} ကို သိမ်းဆည်းပြီးပါပြီ။`
    ));
  }

  async function uploadAllPhotosForReview() {
    if (!selectedPickup) return;
    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");
    const pending = parcels.filter((parcel) => !parcel.cargo_photo_url && (Boolean(parcel.cargo_photo_file) || stagedPhotoFiles.current.has(parcel.line_no)));
    const uploadedCount = parcels.filter((parcel) => Boolean(parcel.cargo_photo_url)).length;

    if (pending.length === 0) {
      setMessage(
        uploadedCount > 0
          ? tx(`All ${uploadedCount} selected photo(s) are already uploaded. Enter parcel weight and save when ready.`,`ရွေးထားသော ဓာတ်ပုံ ${uploadedCount} ပုံလုံး Upload ပြီးပါပြီ။ အလေးချိန်ထည့်ပြီး Parcel ကို သိမ်းပါ။`)
          : tx("Capture or choose at least one cargo photo before using Upload All.","Upload All မလုပ်မီ ကုန်ပစ္စည်းဓာတ်ပုံ အနည်းဆုံးတစ်ပုံ ရိုက်ယူ/ရွေးချယ်ပါ။")
      );
      return;
    }

    setActionBusy("upload_all_photos");
    let okCount = 0;
    try {
      for (const parcel of pending) {
        try {
          setBulkProgress(`Uploading ${okCount + 1} of ${pending.length}: parcel ${parcel.line_no}`);
          const staged = stagedPhotoFiles.current.get(parcel.line_no);
          await ensurePhotoUploaded(staged ? { ...parcel, cargo_photo_file: staged } : parcel, pickupId);
          stagedPhotoFiles.current.delete(parcel.line_no);
          okCount += 1;
        } catch (error) {
          console.error("Photo retry failed", parcel.line_no, error);
        }
      }
      setMessage(tx(
        `Photo upload completed: ${okCount}/${pending.length} pending photo(s) uploaded. Uploaded photos remain visible and ready for parcel save/review.`,
        `ဓာတ်ပုံ Upload ပြီးပါပြီ။ စောင့်ဆိုင်းနေသော ဓာတ်ပုံ ${okCount}/${pending.length} ပုံ တင်ပြီးပါပြီ။ တင်ပြီးသောဓာတ်ပုံများကို မပျောက်စေဘဲ Parcel သိမ်းရန်/စစ်ဆေးရန် အဆင်သင့်ထားပါမည်။`
      ));
    } finally {
      setActionBusy("");
    }
  }

  function ensureQr(parcel: ParcelDraft) {
    if (parcel.temp_qr_code) return parcel.temp_qr_code;
    const pickupId = safeText(selectedPickup?.pickup_id || selectedPickup?.pickup_way_id, "");
    const code = tempQrCode(pickupId, parcel.line_no);
    updateParcel(parcel.line_no, { temp_qr_code: code });
    return code;
  }

  function printQrCards(parcelList: ParcelDraft[]) {
    if (!selectedPickup) return;

    const pickupId = safeText(selectedPickup.pickup_id || selectedPickup.pickup_way_id, "");
    const merchant = safeText(selectedPickup.merchant_name, "");
    const cards = parcelList
      .map((parcel) => {
        const code = ensureQr(parcel);
        return `
          <div class="card">
            <h2>${pickupId}</h2>
            <p><b>Merchant:</b> ${merchant}</p>
            <p><b>Parcel:</b> ${parcel.line_no}/${parcels.length}</p>
            <p><b>Waybill:</b> ${parcel.waybill_no}</p>
            <p><b>Delivery Way ID:</b> ${parcel.delivery_way_id}</p>
            <img src="${qrImageUrl(code)}" />
            <h3>${code}</h3>
          </div>
        `;
      })
      .join("");

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Temporary QR Codes - ${pickupId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
            .card { border: 2px solid #111827; border-radius: 16px; padding: 18px; page-break-inside: avoid; }
            h2 { margin: 0 0 8px; color: #1d4ed8; }
            h3 { margin: 12px 0 0; font-family: monospace; }
            p { margin: 4px 0; }
            img { width: 180px; height: 180px; margin-top: 12px; }
            @media print { .card { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="grid">${cards}</div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);

    win.document.close();
  }

  const filteredPickups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pickups;
    return pickups.filter((row) => JSON.stringify(row || "").toLowerCase().includes(q));
  }, [pickups, search]);

  useEffect(() => {
    let cancelled = false;
    let recovering = false;

    async function recoverRestoredPhoto() {
      // Do not consume until the pickup is reloaded and the image is attached.
      // Android may recreate this WebView during camera capture; auth/route
      // restoration and pickup RPCs can finish in either order.
      if (recovering || cancelled) return;
      const restored = peekRestoredNativePhoto();
      if (!restored || restored.context.kind !== "pickup-parcel") return;
      if (restored.error) {
        setMessage(restored.error);
        consumeRestoredNativePhoto();
        return;
      }
      if (!restored.file || !restored.context.lineNo || !restored.context.pickupId) return;

      recovering = true;
      try {
        setMessage(tx("Recovering the photo just taken...","ယခုရိုက်ထားသော ဓာတ်ပုံကို ပြန်ယူနေသည်..."));
        const { data, error } = await (supabase as any).rpc("be_field_pickup_request_options_v187", { p_limit: 300 });
        if (error) throw error;
        const rows = Array.isArray(data?.requests) ? data.requests : [];
        const pickup = rows.find((row: PickupRow) =>
          String(row.pickup_id || row.pickup_way_id) === String(restored.context.pickupId)
        );
        if (!pickup) throw new Error(`${restored.context.pickupId}: pickup could not be restored after camera capture.`);
        if (cancelled) return;
        setPickups(rows);
        setSearch(String(restored.context.pickupId));
        await selectPickup(pickup);
        if (cancelled) return;
        // onPhotoSelected retains the file in the parcel draft if upload fails.
        await onPhotoSelected(Number(restored.context.lineNo), restored.file, pickup);
        consumeRestoredNativePhoto();
      } catch (error: any) {
        if (!cancelled) setMessage(`${error?.message || "Unable to restore the captured photo."} Please retry when connected; the recovered photo is still available.`);
      } finally {
        recovering = false;
      }
    }

    const onRestored = () => { void recoverRestoredPhoto(); };
    window.addEventListener(NATIVE_PHOTO_RESTORED_EVENT, onRestored);
    void loadAssignedPickups().then(recoverRestoredPhoto, (error) => {
      if (!cancelled) setMessage(error?.message || "Pickup refresh failed; retry to recover your photo.");
    });

    return () => {
      cancelled = true;
      window.removeEventListener(NATIVE_PHOTO_RESTORED_EVENT, onRestored);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickupId = safeText(selectedPickup?.pickup_id || selectedPickup?.pickup_way_id, "");
  const savedCount = parcels.filter((p) => p.saved).length;
  const readyToSaveCount = parcels.filter((parcel) => {
    const weight = Number(parcel.parcel_weight || 0);
    const hasPhoto = Boolean(parcel.cargo_photo_file || parcel.cargo_photo_url || parcel.cargo_photo_data_url);
    return Number.isFinite(weight) && weight > 0 && hasPhoto && !parcel.saved;
  }).length;
  const nextAction = String(selectedPickup?.next_action || "");
  const canSubmitVerification = Boolean(selectedPickup?.can_open_workspace) && nextAction === "CAPTURE_AND_VERIFY" && savedCount > 0;
  const canReleaseToDataEntry = Boolean(selectedPickup?.can_open_workspace) && nextAction === "COLLECT_PICKUP";
  const finalizationHint = nextAction === "WAIT_FOR_TEAM_ACCEPTANCE"
    ? tx("Waiting for the remaining assigned field worker to accept. Parcel photos can be saved now, but pickup verification must wait.", "တာဝန်ပေးထားသော field team မှ ကျန်သူ၏ တာဝန်လက်ခံမှုကို စောင့်နေသည်။ Parcel ဓာတ်ပုံများကို သိမ်းနိုင်သော်လည်း Pickup Verification ကို စောင့်ရပါမည်။")
    : nextAction === "ACCEPT_ASSIGNMENT"
      ? tx("Accept your assignment above first.", "အထက်တွင် သင့်တာဝန်ကို ဦးစွာ လက်ခံပါ။")
      : nextAction === "START_PICKUP" || nextAction === "ARRIVE_AT_PICKUP"
        ? tx("Start the trip and confirm arrival at the pickup before submitting verification.", "Verification မတင်မီ ခရီးစတင်ပြီး Pickup နေရာသို့ ရောက်ရှိမှုကို အတည်ပြုပါ။")
        : nextAction === "CAPTURE_AND_VERIFY"
          ? savedCount === 0
            ? tx("Save at least one parcel with weight and photo to submit verification.", "Verification တင်ရန် အလေးချိန်နှင့် ဓာတ်ပုံပါ Parcel အနည်းဆုံးတစ်ခု သိမ်းပါ။")
            : tx("Submit verification now. Collection becomes available after the server confirms it.", "ယခု Verification တင်နိုင်ပါပြီ။ Server အတည်ပြုပြီးနောက် Collection ကို လုပ်နိုင်ပါမည်။")
          : nextAction === "COLLECT_PICKUP"
            ? tx("Verification is complete. Confirm physical collection to release this pickup to Data Entry.", "Verification ပြီးပါပြီ။ Data Entry သို့ လွှဲရန် ပစ္စည်းကောက်ယူပြီးကြောင်း အတည်ပြုပါ။")
            : nextAction === "HANDOFF_TO_WAREHOUSE" || nextAction === "WAIT_WAREHOUSE_ACCEPTANCE" || nextAction === "COMPLETED"
              ? tx("Collection has been confirmed and the pickup has been released to Data Entry.", "ပစ္စည်းကောက်ယူမှု အတည်ပြုပြီး Data Entry သို့ လွှဲပြီးပါပြီ။")
              : tx("Complete the next pickup action shown above, then refresh the status.", "အထက်တွင် ပြထားသည့် Pickup လုပ်ဆောင်ချက်ကို ပြီးစီးအောင်လုပ်ပြီး အခြေအနေကို ပြန်ဖွင့်ပါ။");
  const canCapture = Boolean(selectedPickup?.can_capture);
  const parcelPageCount = Math.max(1, Math.ceil(parcels.length / pageSize));
  const pagedParcels = parcels.slice((parcelPage - 1) * pageSize, parcelPage * pageSize);

  return (
    <div className="min-h-screen bg-[#eefafa]">
      <header className="sticky top-0 z-20 border-b-4 border-slate-950 bg-white/95 px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p>
            <h1 className="text-2xl font-black text-slate-950">{tx("Rider Pickup Verification","Rider Pickup စစ်ဆေးအတည်ပြုခြင်း")}</h1>
          </div>
          <button
            onClick={loadAssignedPickups}
            disabled={loading}
            className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {loading ? tx("Loading...","ဖွင့်နေသည်...") : tx("Refresh","ပြန်ဖွင့်ရန်")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-5 pb-56">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-600">
              {tx("Enterprise Pickup Request","Enterprise Pickup Request")}
            </span>
            <select
              value={pickupId}
              onChange={(e) => {
                const row = pickups.find((item) => String(item.pickup_id || item.pickup_way_id) === e.target.value);
                if (row) void selectPickup(row);
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-base font-black outline-none focus:border-blue-600"
            >
              <option value="">{tx("Select Pickup Request","Pickup Request ရွေးပါ")}</option>
              {pickups.map((row) => {
                const id = safeText(row.pickup_id || row.pickup_way_id, "");
                const scope = String(row.assignment_scope || "");
                const stateLabel =
                  scope === "ASSIGNED_TO_ME"
                    ? tx("Assigned to me","ကျွန်ုပ်ထံတာဝန်ပေးထားသည်")
                    : scope === "WAITING_ASSIGNMENT"
                      ? tx("Waiting assignment","တာဝန်ပေးရန်စောင့်နေသည်")
                      : tx("Assigned to other","အခြားသူထံတာဝန်ပေးထားသည်");
                return (
                  <option key={row.id || id} value={id} disabled={!row.can_open_workspace}>
                    {id} — {safeText(row.merchant_name || row.merchant_code)} — {safeText(row.parcel_count, "1")} — {stateLabel}
                  </option>
                );
              })}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx("Search pickup ID / merchant","Pickup ID / ကုန်သည် ရှာရန်")}
              className="rounded-2xl border border-slate-300 px-5 py-4 text-base font-bold outline-none focus:border-blue-600"
            />
            <button
              onClick={loadAssignedPickups}
              className="rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white"
            >
              Search
            </button>
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-black text-blue-900">{message}</div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black uppercase tracking-widest text-slate-700">{tx("Assigned Pickups","တာဝန်ပေးထားသော Pickup များ")}</h2>
              <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">
                {filteredPickups.length}
              </span>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {filteredPickups.map((row) => {
                const id = safeText(row.pickup_id || row.pickup_way_id);
                const active = id === pickupId;

                return (
                  <button
                    key={row.id || id}
                    onClick={() => selectPickup(row)}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      active ? "border-rose-500 bg-rose-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-mono text-base font-black text-rose-500">{id}</p>
                    <p className="mt-2 text-base font-black">{safeText(row.merchant_name)}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">
                      {safeText(row.pickup_address)}
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {safeText(row.parcel_count, "1")} {tx("parcels","Parcel")}
                    </p>
                    <p className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-black ${
                      row.assignment_scope === "ASSIGNED_TO_ME"
                        ? "bg-emerald-100 text-emerald-800"
                        : row.assignment_scope === "WAITING_ASSIGNMENT"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-200 text-slate-700"
                    }`}>
                      {row.assignment_scope === "ASSIGNED_TO_ME"
                        ? tx("Assigned to me","ကျွန်ုပ်ထံတာဝန်ပေးထားသည်")
                        : row.assignment_scope === "WAITING_ASSIGNMENT"
                          ? tx("Waiting assignment","တာဝန်ပေးရန်စောင့်နေသည်")
                          : tx("Assigned to other","အခြားသူထံတာဝန်ပေးထားသည်")}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-4">
            {selectedPickup && (
              <>
                <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">{tx("Pickup Workflow","Pickup လုပ်ငန်းစဉ်")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["ASSIGN","ACCEPT","START","ARRIVE","VERIFY","COLLECT","WAREHOUSE"].map((step) => (
                      <span key={step} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-slate-700">{step}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    {tx("Current status","လက်ရှိအခြေအနေ")}: {safeText(selectedPickup.mobile_status || selectedPickup.role_assignment_status || selectedPickup.assignment_status)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {tx("Next action","နောက်လုပ်ဆောင်ရန်")}: {safeText(selectedPickup.next_action).replace(/_/g," ")}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {nextAction === "ACCEPT_ASSIGNMENT" && (
                      <button onClick={() => performPickupAction("accept")} disabled={!!actionBusy} className="rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50">
                        {actionBusy === "accept" ? tx("Accepting...","လက်ခံနေသည်...") : tx("Accept Assignment","တာဝန်လက်ခံရန်")}
                      </button>
                    )}
                    {nextAction === "START_PICKUP" && (
                      <button onClick={() => performPickupAction("start_pickup")} disabled={!!actionBusy} className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50">
                        {tx("Start Pickup Trip","Pickup ခရီးစတင်ရန်")}
                      </button>
                    )}
                    {nextAction === "ARRIVE_AT_PICKUP" && (
                      <button onClick={() => performPickupAction("arrived_at_pickup")} disabled={!!actionBusy} className="rounded-2xl bg-indigo-700 px-5 py-3 font-black text-white disabled:opacity-50">
                        {tx("Arrived at Pickup","Pickup နေရာသို့ ရောက်ရှိပြီ")}
                      </button>
                    )}
                    {nextAction === "CAPTURE_AND_VERIFY" && (
                      <button onClick={submitPickupVerification} disabled={!!actionBusy || savedCount === 0 || countRequestPending} className="rounded-2xl bg-violet-700 px-5 py-3 font-black text-white disabled:opacity-40">
                        {tx("Submit Verification","Verification တင်သွင်းရန်")}
                      </button>
                    )}
                    {nextAction === "COLLECT_PICKUP" && (
                      <button onClick={() => performPickupAction("collect_pickup")} disabled={!!actionBusy} className="rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50">
                        {tx("Confirm Collection & Release to Data Entry","Pickup ကောက်ယူပြီး Data Entry သို့ လွှဲရန်")}
                      </button>
                    )}
                    {nextAction === "HANDOFF_TO_WAREHOUSE" && (
                      <button onClick={() => performPickupAction("handoff_to_warehouse")} disabled={!!actionBusy} className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white disabled:opacity-50">
                        {tx("Handoff to Warehouse","Warehouse သို့ လွှဲပြောင်းရန်")}
                      </button>
                    )}
                    {nextAction === "WAIT_FOR_TEAM_ACCEPTANCE" && (
                      <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-900">
                        {tx("Waiting for the rest of the assigned field team to accept.","တာဝန်ပေးထားသော အခြား field team များ လက်ခံရန် စောင့်နေပါသည်။")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="font-mono text-xl font-black text-rose-500">{pickupId}</p>
                  <h2 className="mt-2 text-2xl font-black">{safeText(selectedPickup.merchant_name)}</h2>
                  <p className="mt-2 font-semibold text-slate-600">{safeText(selectedPickup.sender_phone)}</p>
                  <p className="mt-2 text-base font-semibold text-slate-700">{safeText(selectedPickup.pickup_address)}</p>

                  <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-black text-amber-950">Pickup quantity differs from CS / Merchant request?</p>
                    <p className="mt-1 text-xs text-amber-900">Reported count is submitted for supervisor approval before verification. Saved parcels and the original customer request are not overwritten.</p>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <label className="text-sm font-bold text-slate-950">Actual parcel count
                        <input type="number" min="1" max="500" step="1" value={correctedCount} onChange={e=>setCorrectedCount(e.target.value)} className="mt-1 block w-32 rounded-lg border p-2 text-black" />
                      </label>
                      <label className="text-sm font-bold text-slate-950">Reason for difference
                        <input value={countReason} onChange={e=>setCountReason(e.target.value)} maxLength={500} placeholder="e.g. Merchant has two extra parcels" className="mt-1 block w-64 rounded-lg border p-2 text-black" />
                      </label>
                      <button type="button" className="rounded-xl bg-amber-800 px-4 py-2 font-bold text-white disabled:opacity-40" onClick={()=>void requestPickupCountCorrection()} disabled={!!actionBusy || !selectedPickup.can_open_workspace || countRequestPending || parcels.some(p=>p.saved)}>Submit count correction</button>
                    </div>
                    {countRequestPending&&<p role="status" className="mt-2 font-bold text-amber-900">Pending supervisor review — verification must wait.</p>}
                  </div>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-black uppercase tracking-widest text-slate-600">{tx("Batch Info","Batch အချက်အလက်")}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <span>{tx("Parcels","Parcel များ")}</span><b>{parcels.length}</b>
                      <span>{tx("Saved","သိမ်းပြီး")}</span><b>{savedCount}/{parcels.length}</b>
                      <span>{tx("Rider","Rider")}</span><b>{safeText(selectedPickup.assigned_rider_name || selectedPickup.assigned_rider_code)}</b>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                    <p className="mb-2 text-sm font-black text-blue-950">
                      {tx(
                        `${readyToSaveCount} parcel(s) ready to save · ${savedCount}/${parcels.length} saved`,
                        `သိမ်းရန်အဆင်သင့် ${readyToSaveCount} Parcel · သိမ်းပြီး ${savedCount}/${parcels.length}`
                      )}
                    </p>
                    <div className="mb-3 rounded-xl border border-sky-200 bg-white p-3">
                      <p className="text-sm font-black text-sky-950">Set Weight for All Parcels / Parcel အားလုံး အလေးချိန်သတ်မှတ်ရန်</p>
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="text-sm font-bold">Weight (kg)
                          <input type="number" min="1" max={specialRange ? 5 : 3} step="0.1" value={batchWeight} onChange={e => setBatchWeight(e.target.value)}
                            className="mt-1 block w-24 rounded-lg border border-slate-300 p-2 text-black" />
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={specialRange} onChange={e => setSpecialRange(e.target.checked)} />Special customer (1-5 kg)</label>
                        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={replaceUnsavedWeights} onChange={e => setReplaceUnsavedWeights(e.target.checked)} />Replace existing unsaved weights</label>
                        <button type="button" onClick={applyBatchWeight} disabled={!selectedPickup?.can_open_workspace || !!actionBusy || savingLine !== null}
                          className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Apply Weight to All Unsaved Parcels</button>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-600">Normal: 1-3 kg; special: 1-5 kg. Saved parcels remain unchanged. Use the shared weight only when all selected parcels actually weigh the same.</p>
                    </div>
                    <div className="mb-3 rounded-xl border border-emerald-200 bg-white p-3">
                      <label className="block text-sm font-black text-emerald-900">Continuous photo selection (50+ parcels)</label>
                      <input type="file" multiple accept="image/*" disabled={!selectedPickup?.can_open_workspace || bulkPreparing || uploadingLine !== null || savingLine !== null || !!actionBusy}
                        onChange={(event) => { const files = event.currentTarget.files; void stageContinuousPhotos(files); event.currentTarget.value = ""; }}
                        className="mt-2 block w-full text-sm" />
                      <p className="mt-2 text-xs font-semibold text-slate-600">Photos are assigned to empty parcel lines in order across all pages. Review the matches before Upload All. Record actual weights: normally 1-3 kg, or 1-5 kg for eligible special customers; exceptions require review.</p>
                      {bulkProgress && <p role="status" className="mt-2 font-bold text-blue-700">{bulkProgress}</p>}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button disabled={!selectedPickup?.can_open_workspace || !!actionBusy || uploadingLine !== null || savingLine !== null || readyToSaveCount === 0} onClick={saveAllParcels} className="rounded-2xl bg-blue-700 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {tx("Save All Ready Parcels","အဆင်သင့် Parcel အားလုံး သိမ်းရန်")}
                    </button>
                    <button disabled={!selectedPickup?.can_open_workspace || !!actionBusy || uploadingLine !== null || savingLine !== null} onClick={uploadAllPhotosForReview} className="rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {tx("Approve & Upload All Photos","ဓာတ်ပုံအားလုံး စစ်ဆေးရန် တင်ရန်")}
                    </button>
                    <button onClick={() => printQrCards(parcels)} className="rounded-2xl bg-slate-950 px-5 py-4 font-black text-white">
                      {tx("Print All Temporary QR Codes","ယာယီ QR Code အားလုံး ပုံနှိပ်ရန်")}
                    </button>
                    </div>
                  </div>
                </div>

                {pagedParcels.map((parcel) => (
                  <article data-parcel-line={parcel.line_no} key={parcel.line_no} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest text-slate-600">
                          Parcel {parcel.line_no}/{parcels.length}
                        </p>
                        <p className="mt-1 font-mono text-lg font-black">{parcel.waybill_no}</p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-500">{parcel.delivery_way_id}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            ensureQr(parcel);
                            setMessage(`Temporary QR generated for parcel ${parcel.line_no}.`);
                          }}
                          className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white"
                        >
                          {tx("Generate Temporary QR","ယာယီ QR ထုတ်ရန်")}
                        </button>
                        <button
                          onClick={() => printQrCards([parcel])}
                          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                        >
                          Print This QR
                        </button>
                        <button
                          disabled={!selectedPickup?.can_open_workspace || savingLine !== null || uploadingLine !== null || !!actionBusy || bulkPreparing}
                          onClick={() => saveParcel(parcel)}
                          className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingLine === parcel.line_no ? tx("Saving...","သိမ်းနေသည်...") : tx("Save This Parcel","ဤ Parcel ကို သိမ်းရန်")}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px]">
                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-600">Weight (KG)</span>
                          <input
                            disabled={savingLine !== null || uploadingLine !== null || !!actionBusy || bulkPreparing}
                            value={parcel.parcel_weight}
                            onChange={(e) => editParcel(parcel.line_no, { parcel_weight: e.target.value, saved: false })}
                            inputMode="decimal"
                            placeholder="0.0"
                            className="mt-2 w-full rounded-2xl border border-slate-300 px-5 py-4 text-right text-lg font-black outline-none focus:border-blue-600"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-600">Parcel Remarks</span>
                          <textarea
                            disabled={savingLine !== null || uploadingLine !== null || !!actionBusy || bulkPreparing}
                            value={parcel.remarks}
                            onChange={(e) => editParcel(parcel.line_no, { remarks: e.target.value, saved: false })}
                            placeholder="Fragile / special handling note..."
                            className="mt-2 min-h-[90px] w-full rounded-2xl border border-slate-300 px-5 py-4 font-semibold outline-none focus:border-blue-600"
                          />
                        </label>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-600">Cargo Photo</p>

                        {parcel.cargo_photo_data_url || parcel.cargo_photo_url ? (
                          <img
                            src={parcel.cargo_photo_data_url || parcel.cargo_photo_url}
                            alt={`Cargo parcel ${parcel.line_no}`}
                            className="h-40 w-full rounded-2xl border border-slate-200 object-contain"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm font-black text-slate-500">
                            No cargo photo yet
                          </div>
                        )}

                        {parcel.review_status && <div className={`rounded-xl p-3 text-sm font-bold ${needsPhotoReplacement(parcel.review_status) ? "bg-rose-100 text-rose-900" : "bg-blue-50 text-blue-900"}`}>
                          Enterprise review: {parcel.review_status.replace(/_/g, " ")}
                          {parcel.review_note && <p>{parcel.review_note}</p>}
                        </div>}
                        {(parcel.cargo_photo_url || parcel.previous_photo_url) && (
                          <a href={parcel.cargo_photo_url || parcel.previous_photo_url} target="_blank" rel="noopener noreferrer"
                            className="block rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-900 underline">
                            {tx("View Already Uploaded Photo - Check Before Retaking", "တင်ပြီးသော ဓာတ်ပုံကို ကြည့်ရန်")}
                          </a>
                        )}
                        {parcel.cargo_photo_name && <p className="text-xs font-semibold text-slate-600">Photo: {parcel.cargo_photo_name}</p>}
                        <input
                          ref={(el) => {
                            fileRefs.current[parcel.line_no] = el;
                          }}
                          type="file"
                          disabled={savingLine !== null || uploadingLine !== null || !!actionBusy || bulkPreparing}
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const input = e.currentTarget;
                            const file = input.files?.[0];
                            input.value = "";
                            void onPhotoSelected(parcel.line_no, file);
                          }}
                        />
                        <input
                          ref={(el) => {
                            galleryRefs.current[parcel.line_no] = el;
                          }}
                          type="file"
                          disabled={savingLine !== null || uploadingLine !== null || !!actionBusy || bulkPreparing}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const input = e.currentTarget;
                            const file = input.files?.[0];
                            input.value = "";
                            void onPhotoSelected(parcel.line_no, file);
                          }}
                        />

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            disabled={!selectedPickup?.can_open_workspace || uploadingLine !== null || savingLine !== null || !!actionBusy || bulkPreparing}
                            onClick={() => void openCameraForParcel(parcel.line_no)}
                            className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {uploadingLine === parcel.line_no ? tx("Uploading...","Upload တင်နေသည်...") : tx("Take Photo","ဓာတ်ပုံရိုက်ရန်")}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedPickup?.can_open_workspace || uploadingLine !== null || savingLine !== null || !!actionBusy || bulkPreparing}
                            onClick={() => void openGalleryForParcel(parcel.line_no)}
                            className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {tx("Choose from Gallery","Gallery မှရွေးရန်")}
                          </button>
                        </div>

                        <div className={`rounded-xl px-4 py-3 text-sm font-black ${
                          uploadingLine === parcel.line_no
                            ? "bg-blue-100 text-blue-800"
                            : parcel.cargo_photo_url
                              ? "bg-emerald-100 text-emerald-800"
                              : parcel.photo_status === "photo_upload_failed"
                                ? "bg-rose-100 text-rose-800"
                                : parcel.cargo_photo_file
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                        }`}>
                          {uploadingLine === parcel.line_no
                            ? tx("Uploading photo to Enterprise storage...","Enterprise storage သို့ ဓာတ်ပုံ Upload တင်နေသည်...")
                            : parcel.cargo_photo_url
                              ? tx("Photo uploaded successfully","ဓာတ်ပုံ Upload အောင်မြင်")
                              : parcel.photo_status === "photo_upload_failed"
                                ? tx("Photo upload failed","ဓာတ်ပုံ Upload မအောင်မြင်")
                                : parcel.cargo_photo_file
                                  ? tx("Photo preview — awaiting approval","ဓာတ်ပုံ စစ်ဆေးအတည်ပြုရန်")
                                  : tx("No photo uploaded","ဓာတ်ပုံ မတင်ရသေး")}
                        </div>

                        {parcel.photo_error && (
                          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                            {parcel.photo_error}
                          </p>
                        )}

                        {parcel.cargo_photo_file && (
                          <button
                            type="button"
                            disabled={!selectedPickup?.can_open_workspace || uploadingLine !== null || savingLine !== null || !!actionBusy || bulkPreparing}
                            onClick={() => void approveParcelPhoto(parcel)}
                            className="w-full rounded-2xl bg-rose-600 px-4 py-3 font-black text-white disabled:opacity-40"
                          >
                            {parcel.photo_status === "photo_upload_failed" ? tx("Retry Photo Upload","ဓာတ်ပုံ Upload ပြန်စမ်းရန်") : tx("Approve Photo & Upload", "ဓာတ်ပုံကို အတည်ပြုပြီး Upload တင်ရန်")}
                          </button>
                        )}

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-black uppercase text-slate-500">Temporary QR</p>
                          <img
                            src={qrImageUrl(parcel.temp_qr_code)}
                            alt={parcel.temp_qr_code}
                            className="mt-2 h-28 w-28 rounded-xl bg-white p-2"
                          />
                          <p className="mt-2 break-all font-mono text-xs font-black">{parcel.temp_qr_code}</p>
                        </div>

                        <div className={`rounded-xl px-4 py-3 text-sm font-black ${parcel.saved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                          {parcel.saved ? tx("Saved","သိမ်းပြီး") : tx("Not Saved","မသိမ်းရသေး")}
                        </div>

                        {!parcel.saved && (
                          <button
                            type="button"
                            disabled={!selectedPickup?.can_open_workspace || savingLine !== null || uploadingLine !== null || !!actionBusy || bulkPreparing}
                            onClick={() => saveParcel(parcel)}
                            className="w-full rounded-2xl bg-blue-700 px-4 py-4 font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {savingLine === parcel.line_no
                              ? tx("Saving Photo & Parcel...","ဓာတ်ပုံနှင့် Parcel ကို သိမ်းနေသည်...")
                              : tx("Save Photo & Parcel","ဓာတ်ပုံနှင့် Parcel ကို သိမ်းရန်")}
                          </button>
                        )}

                        {!parcel.saved && (
                          <p className="text-xs font-bold leading-5 text-slate-500">
                            {tx(
                              "Review your selected photo, approve and upload it, then save the parcel with its actual weight. Save Photo & Parcel also confirms the displayed photo.",
                              "ရွေးထားသောဓာတ်ပုံကို စစ်ဆေးပြီး အတည်ပြုကာ Upload တင်ပါ။ အလေးချိန်ထည့်ပြီး ဓာတ်ပုံနှင့် Parcel ကို သိမ်းပါ။"
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}

                {parcels.length > pageSize && (
                  <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <button
                      type="button"
                      disabled={parcelPage <= 1}
                      onClick={() => setParcelPage((p) => Math.max(1,p-1))}
                      className="rounded-xl border border-slate-300 px-4 py-2 font-black disabled:opacity-40"
                    >
                      {tx("Previous","နောက်သို့")}
                    </button>
                    <span className="text-sm font-black text-slate-700">
                      {tx("Page","စာမျက်နှာ")} {parcelPage}/{parcelPageCount} · {parcels.length} {tx("parcels","Parcel")}
                    </span>
                    <button
                      type="button"
                      disabled={parcelPage >= parcelPageCount}
                      onClick={() => setParcelPage((p) => Math.min(parcelPageCount,p+1))}
                      className="rounded-xl border border-slate-300 px-4 py-2 font-black disabled:opacity-40"
                    >
                      {tx("Next","ရှေ့သို့")}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </main>
      {selectedPickup && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-blue-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto max-w-[1200px]">
            <p className="mb-2 text-xs font-bold text-slate-700" role="status">{pickupId} · {finalizationHint}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <button type="button" onClick={submitPickupVerification} disabled={!canSubmitVerification || !!actionBusy} className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600">
                {actionBusy === "verify" ? tx("Submitting Verification...", "Verification တင်နေသည်...") : tx("Submit Verification", "Verification တင်သွင်းရန်")}
              </button>
              <button type="button" onClick={() => performPickupAction("collect_pickup")} disabled={!canReleaseToDataEntry || !!actionBusy} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600">
                {actionBusy === "collect_pickup" ? tx("Confirming Collection...", "ကောက်ယူမှု အတည်ပြုနေသည်...") : tx("Confirm Collection & Release to Data Entry", "ကောက်ယူပြီး Data Entry သို့ လွှဲရန်")}
              </button>
              <button type="button" onClick={loadAssignedPickups} disabled={loading || !!actionBusy} className="rounded-xl border border-blue-200 px-4 py-3 text-sm font-black text-blue-800 disabled:opacity-40">
                {tx("Refresh Status", "အခြေအနေ ပြန်ဖွင့်ရန်")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

