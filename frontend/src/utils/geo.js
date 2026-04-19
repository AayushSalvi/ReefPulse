/** Haversine distance in km between two WGS84 points */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Map lat/lng to % position inside a CA overview box (demo projection) */
export function caLatLngToPercent(lat, lng) {
  const latMin = 32.4;
  const latMax = 42.2;
  const lngMin = -124.6;
  const lngMax = -114.1;
  const x = ((lng - lngMin) / (lngMax - lngMin)) * 100;
  const y = ((latMax - lat) / (latMax - latMin)) * 100;
  return {
    left: `${Math.min(98, Math.max(2, x))}%`,
    top: `${Math.min(96, Math.max(4, y))}%`
  };
}
