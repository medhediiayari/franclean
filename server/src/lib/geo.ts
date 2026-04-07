/**
 * Haversine distance calculation between two GPS coordinates.
 * Returns distance in meters.
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if agent coordinates are within the event's geo-radius.
 * Returns null if the event has no GPS coordinates configured.
 */
export function validateGpsLocation(
  agentLat: number | undefined | null,
  agentLon: number | undefined | null,
  eventLat: number | undefined | null,
  eventLon: number | undefined | null,
  geoRadius: number | undefined | null,
): { isValid: boolean; distance: number } | null {
  if (!agentLat || !agentLon) return null;
  if (!eventLat || !eventLon) return null;

  const radius = geoRadius ?? 200;
  const distance = getDistanceMeters(agentLat, agentLon, eventLat, eventLon);
  return { isValid: distance <= radius, distance };
}
