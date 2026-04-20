/**
 * Address geocoding via Digitransit Geocoding API (free, no key required).
 * Returns WGS84 lat/lon for a Finnish address.
 */

export interface GeocodingResult {
  lat: number;
  lon: number;
  label: string;
  confidence: number;
}

const DIGITRANSIT_GEOCODING_URL =
  "https://api.digitransit.fi/geocoding/v1/search";

export async function geocodeAddress(
  address: string
): Promise<GeocodingResult | null> {
  const url = `${DIGITRANSIT_GEOCODING_URL}?text=${encodeURIComponent(address)}&size=1&lang=fi`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const features = data?.features;
    if (!features || features.length === 0) return null;

    const feature = features[0];
    const [lon, lat] = feature.geometry.coordinates;
    return {
      lat,
      lon,
      label: feature.properties?.label || address,
      confidence: feature.properties?.confidence || 0,
    };
  } catch {
    console.error("Geocoding failed for:", address);
    return null;
  }
}
