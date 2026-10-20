/** Keep each staged parcel photo small even when a camera JPEG is below upload limits. */
export const PICKUP_PHOTO_MAX_BYTES = 1024 * 1024;
export const PICKUP_PHOTO_MAX_EDGE = 1600;
const MAX_INPUT_BYTES = 14 * 1024 * 1024;
const DECODE_TIMEOUT_MS = 20_000;

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Photo preparation cancelled.', 'AbortError');
}

/**
 * Sequential callers retain only bounded JPEGs, never full-resolution originals.
 * HTMLImageElement/canvas also work on older Android WebViews without Worker,
 * createImageBitmap or OffscreenCanvas. Browser decoding applies EXIF orientation
 * on platforms that support it; drawing that decoded image avoids a second rotation.
 */
export async function preparePickupPhoto(file: File, options: { signal?: AbortSignal } = {}): Promise<File> {
  const { signal } = options;
  checkAbort(signal);
  if (file.type && !file.type.toLowerCase().startsWith('image/')) throw new Error('Select an image file.');
  if (!file.size) throw new Error('Photo is empty. Please choose another image.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Photo is too large. Please choose an image smaller than 14 MB.');

  const image = new Image();
  const canvas = document.createElement('canvas');
  let url: string | undefined;
  try {
    url = URL.createObjectURL(file);
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        window.clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        image.onload = null;
        image.onerror = null;
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(new DOMException('Photo preparation cancelled.', 'AbortError'));
      const timer = window.setTimeout(() => finish(new Error('Photo decoding timed out. Please choose another image.')), DECODE_TIMEOUT_MS);
      image.onload = () => finish();
      image.onerror = () => finish(new Error('Unable to decode this photo. Please choose another image.'));
      signal?.addEventListener('abort', abort, { once: true });
      image.src = url!;
    });
    checkAbort(signal);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > 48_000_000) {
      throw new Error('Photo dimensions are too large or invalid. Please choose a smaller image.');
    }
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare this photo on this device.');

    // Normally 1600px/0.8 is sufficient. Noisy photos get a bounded series of
    // retries; if the encoder cannot meet the cap we reject, never return file.
    for (const maxEdge of [PICKUP_PHOTO_MAX_EDGE, 1200, 800]) {
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.7, 0.6]) {
        checkAbort(signal);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(result => result ? resolve(result) : reject(new Error('Photo compression failed. Please choose another image.')), 'image/jpeg', quality);
        });
        checkAbort(signal);
        if (blob.size > 0 && blob.size <= PICKUP_PHOTO_MAX_BYTES && blob.type === 'image/jpeg') {
          const name = file.name.replace(/\.[^.]*$/, '') || 'pickup-proof';
          return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
        }
      }
    }
    throw new Error('Unable to compress this photo within the size limit. Please choose another image.');
  } finally {
    image.onload = null;
    image.onerror = null;
    image.src = '';
    if (url) URL.revokeObjectURL(url);
    // Explicitly release the canvas backing store rather than waiting for GC.
    canvas.width = 0;
    canvas.height = 0;
  }
}
