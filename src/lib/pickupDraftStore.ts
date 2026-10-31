/** Local recovery only. Callers must authorize the pickup before reading and
 * reconcile cached `saved` flags with the authoritative server before using them. */
export type PickupDraft = {
  line_no: number;
  waybill_no?: string;
  delivery_way_id?: string;
  temp_qr_code?: string;
  parcel_weight?: string;
  remarks?: string;
  cargo_photo_file?: File;
  cargo_photo_name?: string;
  cargo_photo_url?: string;
  cargo_photo_path?: string;
  photo_status?: string;
  photo_error?: string;
  saved?: boolean;
  review_status?: string;
  review_note?: string;
  reviewed_photo_url?: string;
  previous_photo_url?: string;
  draft_revision?: number;
};

const DATABASE = 'britium-pickup-drafts:2026-11-01';
const STORE = 'parcels';
const textFields = ['waybill_no', 'delivery_way_id', 'temp_qr_code', 'parcel_weight',
  'remarks', 'cargo_photo_name', 'cargo_photo_url', 'cargo_photo_path', 'photo_status',
  'photo_error', 'review_status', 'review_note', 'reviewed_photo_url', 'previous_photo_url'] as const;
type StoredDraft = {
  userId: string;
  pickupId: string;
  lineNo: number;
  metadata: Omit<PickupDraft, 'cargo_photo_file'>;
  photo?: { blob: Blob; name: string; type: string; lastModified: number };
};
const writes = new Map<string, Promise<void>>();

function scopeKey(userId: string, pickupId: string) {
  if (!userId?.trim() || !pickupId?.trim()) throw new Error('Pickup draft storage requires a user and pickup.');
  return JSON.stringify([userId, pickupId]);
}

function storageError(cause: unknown) {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(`Pickup draft storage failed. Keep this page open and retry before reloading. ${detail}`);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(storageError('IndexedDB is unavailable.'));
      return;
    }
    let blocked = false;
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); }
    catch (error) { reject(storageError(error)); return; }
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: ['userId', 'pickupId', 'lineNo'] });
      store.createIndex('scope', ['userId', 'pickupId']);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () => {
      blocked = true;
      reject(storageError('Close other pickup tabs to allow local storage to open.'));
    };
  });
}

function snapshot(userId: string, pickupId: string, rows: readonly PickupDraft[]): StoredDraft[] {
  const lines = new Set<number>();
  return rows.map(row => {
    if (!Number.isInteger(row.line_no) || row.line_no < 1 || lines.has(row.line_no)) {
      throw new Error('Pickup draft storage requires unique positive parcel line numbers.');
    }
    lines.add(row.line_no);
    const metadata: StoredDraft['metadata'] = { line_no: row.line_no };
    for (const key of textFields) {
      const value = row[key];
      // Transient previews and base64 never belong in durable metadata.
      if (typeof value === 'string' && !/^(blob:|data:)/i.test(value)) metadata[key] = value;
    }
    if (typeof row.saved === 'boolean') metadata.saved = row.saved;
    if (typeof row.draft_revision === 'number' && Number.isFinite(row.draft_revision)) metadata.draft_revision = row.draft_revision;
    const file = row.cargo_photo_file;
    return { userId, pickupId, lineNo: row.line_no, metadata,
      ...(file instanceof Blob ? { photo: { blob: file.slice(0, file.size, file.type),
        name: file.name || row.cargo_photo_name || `parcel-${row.line_no}.jpg`,
        type: file.type, lastModified: file.lastModified || 0 } } : {}) };
  });
}

function enqueue(userId: string, pickupId: string, action: () => Promise<void>): Promise<void> {
  const key = scopeKey(userId, pickupId);
  const next = (writes.get(key) ?? Promise.resolve()).catch((): void => undefined).then(action);
  writes.set(key, next);
  // Both branches handle rejection without creating an unhandled rejected finally promise.
  const release = () => { if (writes.get(key) === next) writes.delete(key); };
  void next.then(release, release);
  return next;
}

async function mutate(userId: string, pickupId: string, rows?: StoredDraft[], lineNo?: number, replace = true) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let failure: unknown;
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(storageError(failure ?? tx.error ?? 'Transaction aborted.'));
      tx.onerror = () => { failure ??= tx.error; };
      try {
        if (lineNo !== undefined) { store.delete([userId, pickupId, lineNo]); return; }
        if (!replace) { for (const row of rows ?? []) store.put(row); return; }
        const request = store.index('scope').getAllKeys(IDBKeyRange.only([userId, pickupId]));
        request.onsuccess = () => {
          try {
            for (const key of request.result) store.delete(key);
            for (const row of rows ?? []) store.put(row);
          } catch (error) { failure = error; tx.abort(); }
        };
      } catch (error) { failure = error; tx.abort(); }
    });
  } finally { db.close(); }
}

/** Atomically replace this pickup's snapshot. Resolves only after commit.
 * Invocation order is preserved, including after a failed write. */
export function savePickupDrafts(userId: string, pickupId: string, rows: readonly PickupDraft[]): Promise<void> {
  try {
    scopeKey(userId, pickupId);
    const data = snapshot(userId, pickupId, rows);
    return enqueue(userId, pickupId, () => mutate(userId, pickupId, data));
  } catch (error) { return Promise.reject(storageError(error)); }
}

export async function loadPickupDrafts(userId: string, pickupId: string): Promise<PickupDraft[]> {
  const key = scopeKey(userId, pickupId);
  await writes.get(key)?.catch((): void => undefined);
  const db = await openDatabase();
  try {
    const rows = await new Promise<StoredDraft[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).index('scope').getAll(IDBKeyRange.only([userId, pickupId]));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(storageError(tx.error));
      tx.onerror = () => reject(storageError(tx.error));
    });
    return rows.sort((a, b) => a.lineNo - b.lineNo).map(row => ({ ...row.metadata,
      ...(row.photo ? { cargo_photo_file: new File([row.photo.blob], row.photo.name,
        { type: row.photo.type, lastModified: row.photo.lastModified }) } : {}) }));
  } finally { db.close(); }
}

export function removePickupDraft(userId: string, pickupId: string, lineNo: number): Promise<void> {
  if (!Number.isInteger(lineNo) || lineNo < 1) return Promise.reject(storageError('A valid parcel line is required for deletion.'));
  return enqueue(userId, pickupId, () => mutate(userId, pickupId, undefined, lineNo));
}

export function clearPickupDrafts(userId: string, pickupId: string): Promise<void> {
  return enqueue(userId, pickupId, () => mutate(userId, pickupId, []));
}

/** Atomically write only the supplied parcel rows; other lines remain intact.
 * Each row is a complete draft (omitting cargo_photo_file removes its local Blob). */
export function upsertPickupDrafts(userId: string, pickupId: string, rows: readonly PickupDraft[]): Promise<void> {
  try {
    scopeKey(userId, pickupId);
    const data = snapshot(userId, pickupId, rows);
    return enqueue(userId, pickupId, () => mutate(userId, pickupId, data, undefined, false));
  } catch (error) { return Promise.reject(storageError(error)); }
}
