/** Delivery pin on an address (Laravel `latitude` / `longitude`, stored with 7 decimals). */
export interface AddressLocation {
  latitude: number;
  longitude: number;
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

/** Rough box around Oman (Musandam to Dhofar), the only delivery country. */
export function isInsideOman(location: AddressLocation): boolean {
  return (
    location.latitude >= 16.4 &&
    location.latitude <= 26.6 &&
    location.longitude >= 51.8 &&
    location.longitude <= 60.0
  );
}

/**
 * Body value: `null` (no pin) or `{ latitude, longitude }` within Laravel's
 * ranges. `undefined` means invalid.
 */
export function readAddressLocation(value: unknown): AddressLocation | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { latitude, longitude } = value as Record<string, unknown>;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return undefined;
  }
  return { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) };
}

/** Laravel returns decimals as strings (`"23.6000000"`); both or neither. */
export function parseLaravelLocation(latitude: unknown, longitude: unknown): AddressLocation | null {
  const lat = typeof latitude === 'string' || typeof latitude === 'number' ? Number(latitude) : NaN;
  const lng =
    typeof longitude === 'string' || typeof longitude === 'number' ? Number(longitude) : NaN;
  if (
    latitude === null ||
    longitude === null ||
    latitude === '' ||
    longitude === '' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

export function sameLocation(a: AddressLocation | null, b: AddressLocation | null): boolean {
  if (!a || !b) return a === b;
  return a.latitude === b.latitude && a.longitude === b.longitude;
}
