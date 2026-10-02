import { Capacitor, registerPlugin } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export type NativePhotoRestoreContext = {
  kind: string;
  route?: string;
  prefix?: string;
  lineNo?: number;
  pickupId?: string;
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
  error?: string;
};

const PENDING_PHOTO_KEY = "britium.rider.native-photo.pending.v1";
const PENDING_PHOTO_MAX_AGE_MS = 15 * 60 * 1000;
export const NATIVE_PHOTO_RESTORED_EVENT = "britium:native-photo-restored";

let restoreHandlerInstalled = false;
let restoredNativePhoto: RestoredNativePhoto | null = null;

export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function hasNativePhotoBridge(): boolean {
  return isNativeAndroidApp() && Capacitor.isPluginAvailable("Camera");
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
  }).catch((error) => {
    console.warn("Native app resume handler unavailable:", error);
  });

  void NativeApp.addListener("appRestoredResult", async (event) => {
    if (event?.pluginId !== "Camera" || event?.methodName !== "getPhoto") return;

    const context = readPendingContext();
    if (!context) return;

    try {
      if (event.success === false) {
        throw new Error(event.error?.message || "Android could not restore the camera result.");
      }
      const prefix = context.prefix || "britium-restored-photo";
      restoredNativePhoto = {
        context,
        file: await cameraResultToFile(event.data, prefix),
      };
      writePendingContext(undefined);
    } catch (error: any) {
      restoredNativePhoto = {
        context,
        error: String(error?.message || error || "Unable to restore camera photo."),
      };
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
  if (!hasNativePhotoBridge()) throw new Error("Native photo bridge is unavailable in this APK.");

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
    const result = await Camera.getPhoto({
      quality: 84,
      allowEditing: false,
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
