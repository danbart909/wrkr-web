export type LatLng = { lat: number; lng: number };

export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);

  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return R * c;
}

/**
 * Geocode a ZIP using OpenStreetMap Nominatim.
 * No API key, but rate-limited. We cache in localStorage.
 */
export async function geocodeZip(zip: string): Promise<LatLng | null> {
  const z = zip.trim();
  if (!z) return null;

  const key = `zipgeo:${z}`;
  const cached = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  if (cached) {
    try {
      return JSON.parse(cached) as LatLng;
    } catch {}
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us,ca&q=${encodeURIComponent(
    z
  )}`;

  const res = await fetch(url, {
    headers: {
      // Nominatim asks for identifiable UA; browsers don't allow setting User-Agent,
      // but Referer is usually enough. Keep usage light; caching helps.
      "Accept": "application/json",
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data?.length) return null;

  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const coords = { lat, lng };
  try {
    window.localStorage.setItem(key, JSON.stringify(coords));
  } catch {}

  return coords;
}

export function formatMiles(miles: number): string {
  if (!Number.isFinite(miles)) return "";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}