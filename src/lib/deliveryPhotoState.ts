export function deliveryPhotoScope(context: { deliveryWayId?: string; route?: string }): string {
  return context.deliveryWayId || new URLSearchParams((context.route || '').split('?')[1] || '').get('deliveryWayId') || '';
}
export function isCurrentDeliveryPhoto(capturedId: string, capturedRevision: number, activeId: string, activeRevision: number): boolean {
  return Boolean(capturedId) && capturedId === activeId && capturedRevision === activeRevision;
}
