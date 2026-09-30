type NativePhotoSource = "CAMERA" | "PHOTOS";

type NativePhotoResult = {
  dataUrl?: string;
  base64String?: string;
  format?: string;
  webPath?: string;
  path?: string;
};

function capacitorGlobal(): any {
  if (typeof window === "undefined") return null;
  return (window as any).Capacitor || null;
}

export function isNativeAndroidApp(): boolean {
  const cap = capacitorGlobal();
  if (!cap) return false;
  try {
    return Boolean(cap.isNativePlatform?.()) && String(cap.getPlatform?.() || "").toLowerCase() === "android";
  } catch {
    return false;
  }
}

function nativeCameraPlugin(): any {
  const cap = capacitorGlobal();
  return cap?.Plugins?.Camera || null;
}

export function hasNativePhotoBridge(): boolean {
  return isNativeAndroidApp() && Boolean(nativeCameraPlugin()?.getPhoto);
}

async function nativePhotoDataUrl(source: NativePhotoSource): Promise<string> {
  const camera = nativeCameraPlugin();
  if (!camera?.getPhoto) throw new Error("Native photo bridge is unavailable in this APK.");

  try {
    const result = await camera.getPhoto({
      quality: 88,
      allowEditing: false,
      resultType: "dataUrl",
      source,
      correctOrientation: true,
      width: 1800,
      height: 1800,
      presentationStyle: "fullscreen",
      promptLabelHeader: "Britium Express",
      promptLabelPhoto: "Choose from Gallery",
      promptLabelPicture: "Take Photo",
    }) as NativePhotoResult;

    if (result?.dataUrl) return String(result.dataUrl);
    if (result?.base64String) {
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
  return nativePhotoDataUrl("CAMERA");
}

export async function chooseNativeGalleryDataUrl(): Promise<string> {
  return nativePhotoDataUrl("PHOTOS");
}

export async function takeNativePhotoFile(prefix = "britium-photo"): Promise<File> {
  return dataUrlToFile(await takeNativePhotoDataUrl(), prefix);
}

export async function chooseNativeGalleryFile(prefix = "britium-gallery"): Promise<File> {
  return dataUrlToFile(await chooseNativeGalleryDataUrl(), prefix);
}
