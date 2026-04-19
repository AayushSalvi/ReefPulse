/**
 * Google Map on Explore index — one shared script load via `ExploreMapsApiProvider`.
 * Map position syncs with URL `mlat`, `mlng`, `mz` (set from the left sidebar Places search).
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { useExploreMapsApi } from "./ExploreMapsApiContext";

const DEFAULT_CENTER = { lat: 34.05, lng: -118.25 };

const mapOptions = {
  streetViewControl: false,
  fullscreenControl: true,
  mapTypeControl: true,
};

function formatCoord(n) {
  return Number.isFinite(n) ? n.toFixed(6) : "—";
}

function MissingKeyNotice() {
  return (
    <div className="ex-map-card ex-google-map ex-google-map--missing-key">
      <div className="ex-google-map-missing-inner">
        <p className="ex-google-map-missing-title">
          Map search needs an API key
        </p>
        <p className="ex-google-map-missing-text">
          Add{" "}
          <code className="ex-google-map-code">VITE_GOOGLE_MAPS_API_KEY</code>{" "}
          to <code className="ex-google-map-code">frontend/.env</code> and
          restart the dev server. Enable <strong>Maps JavaScript API</strong>{" "}
          and <strong>Places API</strong>, billing, and allow this origin on the
          key (e.g.{" "}
          <code className="ex-google-map-code">http://localhost:5173/*</code>).
        </p>
      </div>
    </div>
  );
}

function parseMapParams(sp) {
  const lat = parseFloat(sp.get("mlat") || "");
  const lng = parseFloat(sp.get("mlng") || "");
  const mzRaw = sp.get("mz");
  const zParsed = mzRaw != null && mzRaw !== "" ? parseInt(mzRaw, 10) : NaN;
  const has = Number.isFinite(lat) && Number.isFinite(lng);
  const hasZ = Number.isFinite(zParsed) && zParsed >= 1 && zParsed <= 20;
  return {
    hasCoords: has,
    lat: has ? lat : DEFAULT_CENTER.lat,
    lng: has ? lng : DEFAULT_CENTER.lng,
    zoom: hasZ ? zParsed : has ? 14 : 8,
  };
}

function patchMapClick(setSearchParams, lat, lng) {
  setSearchParams(
    (prev) => {
      const p = new URLSearchParams(prev);
      p.set("mlat", lat.toFixed(6));
      p.set("mlng", lng.toFixed(6));
      p.set("mz", "14");
      return p;
    },
    { replace: true },
  );
}

export default function ExploreGoogleMapPanel() {
  const { hasKey, isLoaded, loadError } = useExploreMapsApi();
  const [sp, setSearchParams] = useSearchParams();
  const mlat = sp.get("mlat");
  const mlng = sp.get("mlng");
  const mz = sp.get("mz");
  const mapSig = `${mlat ?? ""}|${mlng ?? ""}|${mz ?? ""}`;
  const { hasCoords, lat, lng, zoom } = parseMapParams(sp);

  const [center, setCenter] = useState(() => ({ lat, lng }));
  const [markerPosition, setMarkerPosition] = useState(() => ({ lat, lng }));
  const [mapZoom, setMapZoom] = useState(zoom);
  const [map, setMap] = useState(null);

  useEffect(() => {
    const next = parseMapParams(sp);
    const pos = { lat: next.lat, lng: next.lng };
    setCenter(pos);
    setMarkerPosition(pos);
    setMapZoom(next.zoom);
    if (map) {
      map.panTo(pos);
      map.setZoom(next.zoom);
    }
  }, [mapSig, map, sp]);

  const onMapLoad = useCallback(
    (m) => {
      setMap(m);
      const pos = { lat, lng };
      m.panTo(pos);
      m.setZoom(mapZoom);
    },
    [lat, lng, mapZoom],
  );

  const onMapClick = useCallback(
    (e) => {
      if (!e.latLng) return;
      const la = e.latLng.lat();
      const ln = e.latLng.lng();
      setMarkerPosition({ lat: la, lng: ln });
      setCenter({ lat: la, lng: ln });
      patchMapClick(setSearchParams, la, ln);
    },
    [setSearchParams],
  );

  if (!hasKey) {
    return <MissingKeyNotice />;
  }

  if (loadError) {
    return (
      <div
        className="ex-map-card ex-google-map ex-google-map--error"
        role="alert"
      >
        <p className="ex-google-map-missing-title">
          Could not load Google Maps
        </p>
        <p className="ex-google-map-missing-text">
          Typical fixes: enable billing on the Google Cloud project, turn on{" "}
          <strong>Maps JavaScript API</strong> and <strong>Places API</strong>,
          and add this site’s origin under API key restrictions (HTTP
          referrers). Check the browser console for the exact error code.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="ex-map-card ex-google-map ex-google-map--loading">
        <p className="ex-google-map-loading-text">Loading map…</p>
      </div>
    );
  }

  return (
    <div className="ex-map-card ex-google-map">
      <div className="ex-google-map-frame">
        <GoogleMap
          mapContainerClassName="ex-google-map-canvas"
          center={center}
          zoom={mapZoom}
          onLoad={onMapLoad}
          onClick={onMapClick}
          options={mapOptions}
        >
          <Marker position={markerPosition} />
        </GoogleMap>
      </div>
      <div className="ex-google-map-coords" aria-live="polite">
        <div className="ex-google-map-coord">
          <span className="ex-google-map-coord-label">Latitude</span>
          <span className="ex-google-map-coord-value">
            {formatCoord(markerPosition.lat)}
          </span>
        </div>
        <div className="ex-google-map-coord">
          <span className="ex-google-map-coord-label">Longitude</span>
          <span className="ex-google-map-coord-value">
            {formatCoord(markerPosition.lng)}
          </span>
        </div>
        <p className="ex-google-map-hint">
          {hasCoords
            ? "Lat/lng are also in the page URL (shareable)."
            : "Choose a place from the sidebar search to set coordinates."}
        </p>
      </div>
    </div>
  );
}
