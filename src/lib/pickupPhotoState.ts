export type CapturePhotoDraft = {
  line_no: number;
  parcel_weight: string;
  remarks: string;
  saved?: boolean;
  cargo_photo_url?: string;
  cargo_photo_data_url?: string;
  cargo_photo_file?: File;
  cargo_photo_name?: string;
  photo_status?: string;
  review_status?: string;
  review_note?: string;
  reviewed_photo_url?: string;
  draft_revision?: number;
};

export function isCurrentParcelDraft(current: CapturePhotoDraft | undefined, submitted: CapturePhotoDraft): boolean {
  return Boolean(current) && current!.line_no === submitted.line_no &&
    (current!.draft_revision || 0) === (submitted.draft_revision || 0);
}

export function needsPhotoReplacement(status?: string): boolean {
  return ['REUPLOAD_REQUIRED', 'PHOTO_REJECTED', 'REJECTED'].includes(String(status || '').toUpperCase());
}

export function canReuseUploadedPhoto(parcel: CapturePhotoDraft): boolean {
  return Boolean(parcel.cargo_photo_url) && (!needsPhotoReplacement(parcel.review_status) ||
    parcel.cargo_photo_url !== parcel.reviewed_photo_url);
}

/** Merge an authoritative refresh without discarding in-progress photos or weights. */
export function mergeCaptureParcels<T extends CapturePhotoDraft>(generated: T[], savedRows: Record<string, any>[], localRows: T[]): T[] {
  return generated.map(draft => {
    const server = savedRows.find(row => Number(row.line_no || row.row_no) === draft.line_no);
    const local = localRows.find(row => row.line_no === draft.line_no);
    const status = String(server?.photo_status || server?.review_status || 'PENDING_REVIEW');
    const photo = server?.cargo_photo_url || '';
    const remote = server ? {
      ...draft,
      waybill_no: server.waybill_no || (draft as any).waybill_no,
      delivery_way_id: server.delivery_way_id || (draft as any).delivery_way_id,
      temp_qr_code: server.temp_qr_code || (draft as any).temp_qr_code,
      parcel_weight: server.parcel_weight ? String(server.parcel_weight) : '',
      remarks: server.remarks || '',
      cargo_photo_url: photo,
      cargo_photo_data_url: server.cargo_photo_data_url || '',
      cargo_photo_name: server.cargo_photo_name || '',
      photo_status: status,
      review_status: status,
      review_note: server.review_note || server.rejection_note || '',
      reviewed_photo_url: photo,
      saved: Number(server.parcel_weight) > 0 && Boolean(photo) && !needsPhotoReplacement(status),
    } : draft;
    const hasDraft = local && (!local.saved || !server || !(Number(server.parcel_weight) > 0 && Boolean(photo))) && Boolean(local.cargo_photo_file || local.cargo_photo_url ||
      local.cargo_photo_data_url || local.parcel_weight || local.remarks);
    return (hasDraft ? { ...remote, ...local,
      review_status: server ? status : local.review_status,
      review_note: server ? remote.review_note : local.review_note,
      reviewed_photo_url: server ? photo : local.reviewed_photo_url,
      saved: false,
    } : remote) as T;
  });
}
