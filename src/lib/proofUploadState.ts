type UploadResult = { error?: unknown };

/** A retry keeps the same object path and in-flight storage request. */
export async function confirmPhotoUpload<T extends UploadResult>(options: {
  path: string;
  pending: Map<string, Promise<T>>;
  upload: () => PromiseLike<T>;
  verifyExisting?: () => Promise<boolean>;
  timeoutMs?: number;
}): Promise<void> {
  let request = options.pending.get(options.path);
  if (!request) {
    request = Promise.resolve(options.upload());
    options.pending.set(options.path, request);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Photo upload confirmation timed out. Retry this photo to check the same upload.')), options.timeoutMs ?? 120_000);
      }),
    ]);
    if (result.error) {
      const error = result.error as { statusCode?: string | number; status?: string | number; message?: string };
      const duplicate = Number(error.statusCode ?? error.status) === 409 || /already exists|duplicate/i.test(error.message || '');
      if (duplicate && await options.verifyExisting?.()) return;
      options.pending.delete(options.path);
      throw new Error(error.message || String(result.error));
    }
  } catch (error) {
    // A rejected request is finished; a timeout leaves the original request reusable.
    void request.catch(() => { if (options.pending.get(options.path) === request) options.pending.delete(options.path); });
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
