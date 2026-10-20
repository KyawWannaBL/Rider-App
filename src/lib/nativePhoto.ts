import { Capacitor, registerPlugin } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { selectGalleryPhoto } from "./selectGalleryPhoto";

const NativePhotoPicker = registerPlugin<{
  pickImage: () => Promise<{ path: string; format: string }>;
  pickImages: (options: { limit: number; batchId: string }) => Promise<{ batchId: string; photos: { path: string; format: string }[] }>;
  resumeImages: (options: { limit: number; batchId: string }) => Promise<{ batchId: string; photos: { path: string; format: string }[] }>;
  finishBatch: (options: { batchId: string }) => Promise<void>;
}>("BritiumPhotoPicker");

export type NativePhotoRestoreContext = {
  kind: string;
  route?: string;
  prefix?: string;
  lineNo?: number;
  lineNos?: number[];
  batchId?: string;
  pickupId?: string;
  deliveryWayId?: string;
  createdAt?: number;
};

type RestoredPluginResult = {
  pluginId?: string;
  methodName?: string;
  data?: any;
  success?: boolean;
  error?: { message?: string };
};

type RestoredNativePhoto = {
  context: NativePhotoRestoreContext;
  file?: File;
  files?: File[];
  error?: string;
};

const PENDING_PHOTO_KEY = "britium.rider.native-photo.pending.v1";
const PENDING_PHOTO_MAX_AGE_MS = 15 * 60 * 1000;
export const NATIVE_PHOTO_RESTORED_EVENT = "britium:native-photo-restored";

let restoreHandlerInstalled = false;
let restoredNativePhoto: RestoredNativePhoto | null = null;
let bulkRestoreInFlight = false;

async function recoverPendingBulkPhoto() {
  const context = readPendingContext();
  if (bulkRestoreInFlight || restoredNativePhoto || context?.kind !== "pickup-bulk" || !context.batchId) return;
  bulkRestoreInFlight = true;
  try {
    const result = await NativePhotoPicker.resumeImages({batchId:context.batchId,limit:context.lineNos?.length || 10});
    // The user may have opened another picker while recovery was running.
    if (readPendingContext()?.batchId !== context.batchId || result.batchId !== context.batchId) return;
    const files = await galleryResultsToFiles(result,context.prefix || "pickup-bulk",context.lineNos?.length || 10);
    if (readPendingContext()?.batchId !== context.batchId) return;
    restoredNativePhoto = {context,files};
    writePendingContext(undefined);
    void NativePhotoPicker.finishBatch({batchId:context.batchId}).catch(() => {});
    if (context.route) window.location.hash = context.route.startsWith("#") ? context.route : `#${context.route}`;
    window.dispatchEvent(new CustomEvent(NATIVE_PHOTO_RESTORED_EVENT));
  } catch (error: any) {
    if (error?.code === "PHOTO_READ_FAILED" && readPendingContext()?.batchId === context.batchId) {
      restoredNativePhoto = {context,error:"Unable to recover this photo batch. Please select it again; existing photos were kept."};
      writePendingContext(undefined);
      window.dispatchEvent(new CustomEvent(NATIVE_PHOTO_RESTORED_EVENT));
    }
    // No selection is cached while the picker is still open. The original
    // result callback handles that case; failed recovery remains available.
  } finally { bulkRestoreInFlight = false; }
}

export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function hasNativePhotoBridge(): boolean {
  return isNativeAndroidApp();
}

export function shouldUseHtmlCameraCapture(): boolean {
  // Native APK camera capture must always use Capacitor Camera.
  // Android 8 WebView file-input capture can recreate the activity without
  // returning a usable File object, which caused Pickup Verification to fall
  // back to the previous screen after a photo was taken.
  return false;
}

function readPendingContext(): NativePhotoRestoreContext | null {
  try {
    const raw = localStorage.getItem(PENDING_PHOTO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NativePhotoRestoreContext;
    const createdAt = Number(parsed?.createdAt || 0);
    if (createdAt > 0 && Date.now() - createdAt > PENDING_PHOTO_MAX_AGE_MS) {
      localStorage.removeItem(PENDING_PHOTO_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function restorePendingNativePhotoRoute(): boolean {
  if (!isNativeAndroidApp() || typeof window === "undefined") return false;
  const context = readPendingContext();
  if (!context?.route) return false;
  const targetHash = context.route.startsWith("#") ? context.route : `#${context.route}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
  return true;
}

function writePendingContext(context?: NativePhotoRestoreContext) {
  try {
    if (!context) {
      localStorage.removeItem(PENDING_PHOTO_KEY);
      return;
    }
    localStorage.setItem(PENDING_PHOTO_KEY, JSON.stringify({ ...context, createdAt: Date.now() }));
  } catch {
    // Camera capture can still continue even when localStorage is unavailable.
  }
}

function dataUrlFromCameraResult(result: any): string {
  if (result?.dataUrl) return String(result.dataUrl);
  if (result?.base64String) {
    const format = String(result.format || "jpeg").toLowerCase();
    const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${result.base64String}`;
  }
  throw new Error("Android returned no photo data.");
}

function dataUrlToFile(dataUrl: string, prefix: string): File {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image returned by Android.");
  const mime = match[1] || "image/jpeg";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return new File([bytes], `${prefix}-${Date.now()}.${extension}`, { type: mime });
}

async function cameraResultToFile(result: any, prefix: string): Promise<File> {
  if (result?.dataUrl || result?.base64String) {
    return dataUrlToFile(dataUrlFromCameraResult(result), prefix);
  }

  const sourceUrl = result?.webPath
    ? String(result.webPath)
    : result?.path
      ? Capacitor.convertFileSrc(String(result.path))
      : "";

  if (!sourceUrl) throw new Error("Android returned no readable photo file.");

  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Unable to read captured photo (${response.status}).`);
  const blob = await response.blob();
  const mime = blob.type || (String(result?.format || "").toLowerCase() === "png" ? "image/png" : "image/jpeg");
  const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return new File([blob], `${prefix}-${Date.now()}.${extension}`, { type: mime });
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read captured photo."));
    reader.readAsDataURL(file);
  });
}

export function installNativePhotoRestoreHandler() {
  if (restoreHandlerInstalled || !isNativeAndroidApp()) return;
  if (!Capacitor.isPluginAvailable("App")) return;

  restoreHandlerInstalled = true;
  const NativeApp = registerPlugin<{
    addListener: (
      eventName: "appRestoredResult" | "appStateChange",
      listener: (event: any) => void | Promise<void>
    ) => Promise<{ remove: () => Promise<void> }>;
  }>("App");

  void NativeApp.addListener("appStateChange", async (state: any) => {
    if (!state?.isActive || typeof window === "undefined") return;
    const context = readPendingContext();
    if (!context?.route) return;
    const targetHash = context.route.startsWith("#") ? context.route : `#${context.route}`;
    if (window.location.hash !== targetHash) window.location.hash = targetHash;
    void recoverPendingBulkPhoto();
  }).catch((error) => {
    console.warn("Native app resume handler unavailable:", error);
  });
  void recoverPendingBulkPhoto();

  void NativeApp.addListener("appRestoredResult", async (event) => {
    const bulk = event?.pluginId === "BritiumPhotoPicker" && event?.methodName === "pickImages";
    if (!bulk && (event?.pluginId !== "Camera" || event?.methodName !== "getPhoto")) return;

    const context = readPendingContext();
    if (!context) return;
    if (bulk && (event.success === false || event.data?.batchId !== context.batchId)) return;
    if (!bulk && context.kind === "pickup-bulk") return;

    try {
      if (event.success === false) {
        throw new Error(event.error?.message || "Android could not restore the camera result.");
      }
      const prefix = context.prefix || "britium-restored-photo";
      if (bulk) {
        if (context.kind !== "pickup-bulk") return;
        const files = await galleryResultsToFiles(event.data, prefix, context.lineNos?.length || 10);
        if (readPendingContext()?.batchId !== context.batchId) return;
        restoredNativePhoto = { context, files };
        if (context.batchId) void NativePhotoPicker.finishBatch({batchId:context.batchId}).catch(() => {});
      } else {
        restoredNativePhoto = { context, file: await cameraResultToFile(event.data, prefix) };
      }
      writePendingContext(undefined);
    } catch (error: any) {
      restoredNativePhoto = {
        context,
        error: String(error?.message || error || "Unable to restore camera photo."),
      };
      if (bulk && readPendingContext()?.batchId === context.batchId) writePendingContext(undefined);
    }

    if (context.route && typeof window !== "undefined") {
      const targetHash = context.route.startsWith("#") ? context.route : `#${context.route}`;
      if (window.location.hash !== targetHash) window.location.hash = targetHash;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(NATIVE_PHOTO_RESTORED_EVENT));
    }
  }).catch((error) => {
    restoreHandlerInstalled = false;
    console.warn("Native camera restore handler unavailable:", error);
  });
}

export function peekRestoredNativePhoto(): RestoredNativePhoto | null {
  return restoredNativePhoto;
}

export function consumeRestoredNativePhoto(): RestoredNativePhoto | null {
  const result = restoredNativePhoto;
  restoredNativePhoto = null;
  return result;
}

function shouldClearPendingAfterError(error: unknown): boolean {
  const message = String((error as any)?.message || error || "");
  return /cancel|canceled|cancelled|user cancelled|permission|denied/i.test(message);
}

async function nativePhotoFile(source: CameraSource, prefix: string): Promise<File> {
  if (!isNativeAndroidApp()) throw new Error("Direct camera is available only inside the installed Rider Android app.");

  // Do not gate native capture on Capacitor.isPluginAvailable("Camera").
  // On some Android 8 WebViews the availability probe can report false during
  // bridge startup even though @capacitor/camera is packaged and registered.
  // Calling the plugin directly gives us the real native result/error.

  try {
    if (source === CameraSource.Camera) {
      const permissions = await Camera.requestPermissions({ permissions: ["camera"] });
      if (permissions.camera !== "granted") {
        throw new Error("Camera permission was denied. Open Android Settings > Apps > Britium Express Rider > Permissions and allow Camera.");
      }
    }

    // URI avoids returning a multi-megabyte base64 string through the Android
    // bridge. This is materially safer on Android 8/tablets where opening the
    // system Camera Activity can recreate the WebView under memory pressure.
    const standardPickerOrCamera = () => Camera.getPhoto({
      quality: 84,
      allowEditing: false,
      saveToGallery: false,
      resultType: CameraResultType.Uri,
      source,
      correctOrientation: true,
      width: 1600,
      height: 1600,
      presentationStyle: "fullscreen",
      promptLabelHeader: "Britium Express",
      promptLabelPhoto: "Choose from Gallery",
      promptLabelPicture: "Take Photo",
    });

    const result = source === CameraSource.Photos
      ? await selectGalleryPhoto(
          Capacitor.isPluginAvailable("BritiumPhotoPicker") ? () => NativePhotoPicker.pickImage() : undefined,
          standardPickerOrCamera,
        )
      : await standardPickerOrCamera();
    return await cameraResultToFile(result, prefix);
  } catch (error: any) {
    const message = String(error?.message || error || "");
    if (/cancel|canceled|cancelled|user cancelled/i.test(message)) {
      throw new Error("Photo selection was cancelled.");
    }
    if (/permission|denied/i.test(message)) {
      throw new Error("Camera/photo permission was denied. Open Android Settings > Apps > Britium Express Rider > Permissions and allow Camera/Photos.");
    }
    throw new Error(message || "Unable to open Android camera/gallery.");
  }
}

export async function takeNativePhotoDataUrl(context?: NativePhotoRestoreContext): Promise<string> {
  writePendingContext(context);
  try {
    return await fileToDataUrl(await nativePhotoFile(CameraSource.Camera, context?.prefix || "britium-photo"));
  } finally {
    // If Android kills this WebView while the Camera Activity is open, this
    // finally block never runs. The persisted context is then consumed by
    // appRestoredResult on the newly created WebView.
    writePendingContext(undefined);
  }
}

export async function chooseNativeGalleryDataUrl(context?: NativePhotoRestoreContext): Promise<string> {
  writePendingContext(context);
  try {
    return await fileToDataUrl(await nativePhotoFile(CameraSource.Photos, context?.prefix || "britium-gallery"));
  } finally {
    writePendingContext(undefined);
  }
}

export async function takeNativePhotoFile(
  prefix = "britium-photo",
  context?: NativePhotoRestoreContext
): Promise<File> {
  const persisted = context ? { ...context, prefix } : { kind: "native-camera", prefix };
  writePendingContext(persisted);
  try {
    const file = await nativePhotoFile(CameraSource.Camera, prefix);
    writePendingContext(undefined);
    return file;
  } catch (error) {
    // On Android 8/tablets the Camera Activity can recreate the WebView. In that
    // case Capacitor may reject the original promise before appRestoredResult
    // arrives. Keep the persisted route/context so startup can return to the
    // exact Pickup Verification record and recover the captured photo.
    if (shouldClearPendingAfterError(error)) writePendingContext(undefined);
    throw error;
  }
}

export async function chooseNativeGalleryFile(
  prefix = "britium-gallery",
  context?: NativePhotoRestoreContext
): Promise<File> {
  const persisted = context ? { ...context, prefix } : { kind: "native-gallery", prefix };
  writePendingContext(persisted);
  try {
    const file = await nativePhotoFile(CameraSource.Photos, prefix);
    writePendingContext(undefined);
    return file;
  } catch (error) {
    if (shouldClearPendingAfterError(error)) writePendingContext(undefined);
    throw error;
  }
}

async function galleryResultsToFiles(result: any, prefix: string, limit: number): Promise<File[]> {
  if (result?.cancelled) throw new Error("Photo selection was cancelled.");
  if (result?.error) throw Object.assign(new Error(String(result.error)), {code:"PHOTO_READ_FAILED"});
  if (!Array.isArray(result?.photos) || result.photos.length === 0) throw new Error("No photos were selected.");
  if (result.photos.length > limit) throw new Error(`Select at most ${limit} photos for the empty parcel slots.`);
  const files: File[] = [];
  // Avoid reading all selected files into the WebView at once.
  for (const photo of result.photos) files.push(await cameraResultToFile(photo, `${prefix}-${files.length + 1}`));
  return files;
}

export async function chooseNativeGalleryFiles(prefix: string, context: NativePhotoRestoreContext, limit: number): Promise<File[]> {
  if (!isNativeAndroidApp()) throw new Error("Native multi-photo selection requires the installed Android app.");
  if (readPendingContext()) throw new Error("A previous photo selection is still open or recovering. Return to its pickup and wait for recovery before selecting another batch.");
  const boundedLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const batchId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writePendingContext({ ...context, prefix, batchId });
  try {
    const result = await NativePhotoPicker.pickImages({ limit: boundedLimit, batchId });
    if (result.batchId !== batchId) throw new Error("Photo batch does not match this selection. Existing photos were kept.");
    const files = await galleryResultsToFiles(result, prefix, boundedLimit);
    if (readPendingContext()?.batchId !== batchId) throw new Error("Photo selection changed before preparation completed. Existing photos were kept.");
    writePendingContext(undefined);
    void NativePhotoPicker.finishBatch({batchId}).catch(() => {});
    return files;
  } catch (error: any) {
    if (readPendingContext()?.batchId === batchId && (shouldClearPendingAfterError(error) || ["PHOTO_READ_FAILED", "PHOTO_SELECTION_LIMIT", "UNAVAILABLE"].includes(error?.code) || /at most|No photos|does not match/i.test(error?.message || ""))) writePendingContext(undefined);
    if (/unimplemented|not implemented|not available/i.test(String(error?.message || error))) {
      writePendingContext(undefined);
      throw new Error("Please upgrade the Rider APK to use reliable bulk photo selection. Existing saved photos are unchanged.");
    }
    throw error;
  }
}


