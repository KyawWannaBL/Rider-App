// @ts-nocheck
self.onmessage = async (event) => {
  try {
    const { buffer, type, name, maxBytes = 950 * 1024, maxWidth = 1280, maxHeight = 720 } = event.data;
    const input = new Blob([buffer], { type: type || "image/jpeg" });
    const bitmap = await createImageBitmap(input);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let quality = 0.88;
    let blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    while (blob.size > maxBytes && quality > 0.46) {
      quality -= 0.08;
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    }

    const output = await blob.arrayBuffer();
    self.postMessage({ ok: true, buffer: output, type: blob.type, name: name.replace(/\.[^.]+$/, "") + ".jpg", size: blob.size }, [output]);
  } catch (error) {
    self.postMessage({ ok: false, error: error?.message || "Proof compression failed." });
  }
};
