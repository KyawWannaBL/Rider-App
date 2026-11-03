/** Google Maps URLs keep navigation within Google's supported app/browser experience.
 *  This module never mutates Wayplan order, dispatch, or delivery status.
 */
export type DeliveryNavMode = "directions" | "start";
export type DeliveryNavPoint = { latitude: number; longitude: number };
export function validDeliveryPin(point: DeliveryNavPoint | null | undefined): point is DeliveryNavPoint {
  return !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
    && !(point.latitude === 0 && point.longitude === 0);
}
export function googleDeliveryNavigationUrl(
  point: DeliveryNavPoint | null | undefined,
  mode: DeliveryNavMode,
  fallbackAddress?: string,
  travelmode: "driving" | "bicycling" | "walking" = "driving",
): string | null {
  const precise = validDeliveryPin(point);
  // Start never guesses a drop-off from unverified/free-text addresses.
  if (mode === "start" && !precise) return null;
  const destination = precise
    ? `${point.latitude},${point.longitude}`
    : (fallbackAddress || "").trim();
  if (!destination) return null;
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode,
  });
  if (mode === "start") params.set("dir_action", "navigate");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
