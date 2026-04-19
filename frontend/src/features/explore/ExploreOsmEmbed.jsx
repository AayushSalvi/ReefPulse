/**
 * OpenStreetMap embed fallback when Google Maps JS is unavailable (no API key or load error).
 * bbox order: min_lon, min_lat, max_lon, max_lat per OSM export docs.
 */
function embedSrc(lat, lng, zoom) {
  const z = Math.min(Math.max(Number(zoom) || 11, 5), 18);
  const spanLat = 0.12 / (z / 11);
  const spanLng = spanLat * 1.15;
  const minLat = lat - spanLat / 2;
  const maxLat = lat + spanLat / 2;
  const minLng = lng - spanLng / 2;
  const maxLng = lng + spanLng / 2;
  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const marker = `${lat},${lng}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}

/**
 * @param {{ lat: number, lng: number, zoom?: number }} props
 */
export default function ExploreOsmEmbed({ lat, lng, zoom = 11 }) {
  const la = Number.isFinite(lat) ? lat : 34.05;
  const ln = Number.isFinite(lng) ? lng : -118.25;
  return (
    <div className="ex-google-map-frame ex-google-map-frame--osm">
      <iframe
        title="OpenStreetMap"
        className="ex-osm-embed"
        src={embedSrc(la, ln, zoom)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="ex-osm-attrib">
        Map data ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
