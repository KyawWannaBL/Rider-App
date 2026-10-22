export type PhotoIdentityRow = { line_no: number; cargo_photo_file?: File; cargo_photo_url?: string };

const blobHashes = new WeakMap<Blob, Promise<string>>();
export function photoContentHash(blob: Blob): Promise<string> {
  let result = blobHashes.get(blob);
  if (!result) {
    result = blob.arrayBuffer().then(bytes => crypto.subtle.digest('SHA-256', bytes))
      .then(hash => Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join(''));
    blobHashes.set(blob, result);
  }
  return result;
}

/** Names and upload paths are not image identity. Cache only by immutable proof URL. */
export function remotePhotoHash(url: string, cache: Map<string, Promise<string>>): Promise<string> {
  let pending = cache.get(url);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('An existing parcel photo could not be checked. Retry before adding photos.');
        return await photoContentHash(await response.blob());
      } finally { clearTimeout(timer); }
    })();
    cache.set(url, pending);
    void pending.catch(() => { if (cache.get(url) === pending) cache.delete(url); });
  }
  return pending;
}

export async function existingPhotoIndex(rows: readonly PhotoIdentityRow[], remote: (url: string) => Promise<string>): Promise<Map<string, number>> {
  const index = new Map<string, number>();
  const photos = rows.filter(row => row.cargo_photo_file || row.cargo_photo_url);
  // Bound simultaneous downloads for historical photos without client hashes.
  for (let offset = 0; offset < photos.length; offset += 4) {
    const batch = photos.slice(offset, offset + 4);
    const hashes = await Promise.all(batch.map(row => row.cargo_photo_file
      ? photoContentHash(row.cargo_photo_file) : remote(row.cargo_photo_url!)));
    batch.forEach((row, i) => { if (!index.has(hashes[i])) index.set(hashes[i], row.line_no); });
  }
  return index;
}

export async function repeatedPhotoLines(rows: readonly PhotoIdentityRow[], remote: (url: string) => Promise<string>): Promise<string[]> {
  const index = await existingPhotoIndex(rows, remote);
  const duplicates: string[] = [];
  for (const row of rows) {
    if (!row.cargo_photo_file && !row.cargo_photo_url) continue;
    const hash = row.cargo_photo_file ? await photoContentHash(row.cargo_photo_file) : await remote(row.cargo_photo_url!);
    const first = index.get(hash)!;
    if (first !== row.line_no) duplicates.push(`${first}/${row.line_no}`);
  }
  return duplicates;
}
