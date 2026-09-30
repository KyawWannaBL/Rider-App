import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function hasNativePhotoBridge(): boolean {
  return isNativeAndroidApp() && Capacitor.isPluginAvailable("Camera");
}

async function nativePhotoDataUrl(source: CameraSource): Promise<string> {
  if (!hasNativePhotoBridge()) throw new Error("Native photo bridge is unavailable in this APK.");

  try {
    if (source === CameraSource.Camera) {
      const permissions = await Camera.requestPermissions({ permissions: ["camera"] });
      if (permissions.camera !== "granted") {
        throw new Error("Camera permission was denied. Open Android Settings > Apps > Britium Express Rider > Permissions and allow Camera.");
      }
    }

    const result = await Camera.getPhoto({
      quality: 88,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source,
      correctOrientation: true,
      width: 1800,
      height: 1800,
      presentationStyle: "fullscreen",
      promptLabelHeader: "Britium Express",
      promptLabelPhoto: "Choose from Gallery",
      promptLabelPicture: "Take Photo",
    });

    if (result.dataUrl) return String(result.dataUrl);
    if (result.base64String) {
      const format = String(result.format || "jpeg").toLowerCase();
      const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
      return `data:${mime};base64,${result.base64String}`;
    }
    throw new Error("Android returned no photo data.");
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

export async function takeNativePhotoDataUrl(): Promise<string> {
  return nativePhotoDataUrl(CameraSource.Camera);
}

export async function chooseNativeGalleryDataUrl(): Promise<string> {
  return nativePhotoDataUrl(CameraSource.Photos);
}

export async function takeNativePhotoFile(prefix = "britium-photo"): Promise<File> {
  return dataUrlToFile(await takeNativePhotoDataUrl(), prefix);
}

export async function chooseNativeGalleryFile(prefix = "britium-gallery"): Promise<File> {
  return dataUrlToFile(await chooseNativeGalleryDataUrl(), prefix);
}
