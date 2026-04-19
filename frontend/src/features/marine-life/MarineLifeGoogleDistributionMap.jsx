/**
 * California distribution map for Marine life — iNaturalist observation counts as clustered dots.
 * Requires `ExploreMapsApiProvider` above in the tree (see `App.jsx`).
 */
import { useCallback, useEffect, useRef } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { useExploreMapsApi } from "../explore/ExploreMapsApiContext";

const DEFAULT_CENTER = { lat: 36.35, lng: -119.45 };
const DEFAULT_ZOOM = 6;

const MAP_OPTIONS = {
  streetViewControl: false,
  fullscreenControl: true,
  mapTypeControl: true
};

const INAT_DOT_FILL = "#FAFF6C";

function inatDotIcon() {
  const g = typeof window !== "undefined" ? window.google : undefined;
  if (!g?.maps) return undefined;
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: 4,
    fillColor: INAT_DOT_FILL,
    fillOpacity: 0.95,
    strokeColor: "rgba(27, 37, 75, 0.45)",
    strokeWeight: 1
  };
}

function demoHotspotIcon() {
  const g = typeof window !== "undefined" ? window.google : undefined;
  if (!g?.maps) return undefined;
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: "#14b8a6",
    fillOpacity: 0.95,
    strokeColor: "#0f766e",
    strokeWeight: 1.5
  };
}

/**
 * @param {{ lat: number, lng: number, count: number, label: string }[]} distribution
 * @param {{ lat: number, lng: number, label: string }[]} [demoHotspots]
 * @param {boolean} showDemoHotspots
 * @param {boolean} loading
 * @param {boolean} panelActive
 */
export default function MarineLifeGoogleDistributionMap({
  distribution,
  demoHotspots = [],
  showDemoHotspots,
  loading,
  panelActive
}) {
  const { hasKey, isLoaded, loadError, ready } = useExploreMapsApi();
  const mapRef = useRef(null);

  const onLoad = useCallback((m) => {
    mapRef.current = m;
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    const g = window.google;
    if (!m || !ready || !g?.maps) return;

    if (!distribution.length) {
      if (panelActive && !loading) {
        m.setCenter(DEFAULT_CENTER);
        m.setZoom(DEFAULT_ZOOM);
      }
      return;
    }

    if (distribution.length === 1) {
      const p = distribution[0];
      m.setCenter({ lat: p.lat, lng: p.lng });
      m.setZoom(11);
      return;
    }

    const bounds = new g.maps.LatLngBounds();
    for (const d of distribution) {
      bounds.extend({ lat: d.lat, lng: d.lng });
    }
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (ne.lat() === sw.lat() && ne.lng() === sw.lng()) {
      m.setCenter({ lat: distribution[0].lat, lng: distribution[0].lng });
      m.setZoom(11);
      return;
    }
    m.fitBounds(bounds, 48);
  }, [distribution, loading, panelActive, ready]);

  if (!hasKey) {
    return (
      <div className="ml-google-map ml-google-map--missing" role="status">
        <p className="ml-google-map-missing-title">Interactive map needs an API key</p>
        <p className="ml-google-map-missing-text">
          Add <code className="ml-google-map-code">VITE_GOOGLE_MAPS_API_KEY</code> to{" "}
          <code className="ml-google-map-code">frontend/.env</code> and restart the dev server. Enable the{" "}
          <strong>Maps JavaScript API</strong> for this project.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="ml-google-map ml-google-map--error" role="alert">
        <p className="ml-google-map-missing-title">Could not load Google Maps</p>
        <p className="ml-google-map-missing-text">
          Check billing, API enablement, and HTTP referrer restrictions for your key.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="ml-google-map ml-google-map--loading">
        <p>Loading map…</p>
      </div>
    );
  }

  return (
    <div className="ml-google-map-frame">
      {!panelActive && (
        <div className="ml-google-map-overlay-hint">
          Pick a species from search or chips — California iNaturalist reports appear as small dots on the map (hover a
          dot for details).
        </div>
      )}
      {panelActive && loading && distribution.length === 0 && (
        <div className="ml-google-map-overlay-hint">Loading iNaturalist sightings…</div>
      )}
      <GoogleMap
        mapContainerClassName="ml-google-map-canvas"
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        onLoad={onLoad}
        options={MAP_OPTIONS}
      >
        {distribution.map((d) => (
          <Marker
            key={`inat-${d.lat}-${d.lng}`}
            position={{ lat: d.lat, lng: d.lng }}
            title={`${d.count} report${d.count === 1 ? "" : "s"}${d.label ? ` · ${d.label}` : ""}`}
            icon={inatDotIcon()}
          />
        ))}
        {showDemoHotspots &&
          demoHotspots.map((h, i) => (
            <Marker
              key={`demo-${h.label}-${i}`}
              position={{ lat: h.lat, lng: h.lng }}
              title={`${h.label} (ReefPulse demo)`}
              icon={demoHotspotIcon()}
            />
          ))}
      </GoogleMap>
    </div>
  );
}
