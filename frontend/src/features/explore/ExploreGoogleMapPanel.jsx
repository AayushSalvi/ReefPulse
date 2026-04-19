/**
 * Google Map on Explore index — one shared script load via `ExploreMapsApiProvider`.
 * Map position syncs with URL `mlat`, `mlng`, `mz` (set from the left sidebar Places search).
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { getCurrentPositionAsPromise } from "../../utils/geolocation";
import ExploreOsmEmbed from "./ExploreOsmEmbed";
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

function patchMapCoords(setSearchParams, lat, lng, zoom = 14) {
  const z = Math.min(Math.max(Math.round(zoom), 1), 20);
  setSearchParams(
    (prev) => {
      const p = new URLSearchParams(prev);
      p.set("mlat", lat.toFixed(6));
      p.set("mlng", lng.toFixed(6));
      p.set("mz", String(z));
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
      patchMapCoords(setSearchParams, la, ln, 14);
    },
    [setSearchParams],
  );

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);

  const onUseMyLocation = useCallback(async () => {
    setGeoError(null);
    setGeoLoading(true);
    const zoom = 15;
    try {
      const { lat: la, lng: ln } = await getCurrentPositionAsPromise({
        enableHighAccuracy: true,
        timeout: 18_000,
        maximumAge: 0
      });
      const pos = { lat: la, lng: ln };
      setMarkerPosition(pos);
      setCenter(pos);
      setMapZoom(zoom);
      patchMapCoords(setSearchParams, la, ln, zoom);
      if (map) {
        map.panTo(pos);
        map.setZoom(zoom);
      }
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "Could not get your location.");
    } finally {
      setGeoLoading(false);
    }
  }, [map, setSearchParams]);

  const showGoogle = hasKey && isLoaded && !loadError;
  const showGoogleLoading = hasKey && !isLoaded && !loadError;

  return (
    <div className="ex-map-card ex-google-map">
      <p className="ex-google-map-lede">
        Live map — latitude and longitude follow the pin (click the map, search the sidebar, or use your location).
      </p>
      {!hasKey && (
        <p className="ex-google-map-banner ex-google-map-banner--key" role="status">
          <strong>No Google API key.</strong> Showing a real{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{" "}
          embed below. Set <code className="ex-google-map-code">VITE_GOOGLE_MAPS_API_KEY</code> or{" "}
          <code className="ex-google-map-code">GOOGLE_MAPS_API_KEY</code> in{" "}
          <code className="ex-google-map-code">frontend/.env</code>, repo root <code className="ex-google-map-code">.env</code>, or{" "}
          <code className="ex-google-map-code">backend/.env</code>, then restart Vite.
        </p>
      )}
      {hasKey && loadError && (
        <p className="ex-google-map-banner ex-google-map-banner--err" role="alert">
          <strong>Google Maps failed to load.</strong> Using OpenStreetMap below. Check billing, API enablement, and
          referrer restrictions for your key.
        </p>
      )}
      <div className="ex-google-map-locate-row">
        <button
          type="button"
          className="ex-google-map-locate"
          onClick={onUseMyLocation}
          disabled={geoLoading}
          aria-busy={geoLoading}
        >
          {geoLoading ? "Getting your location…" : "Use my location"}
        </button>
        <span className="ex-google-map-locate-hint">
          Uses your browser (HTTPS or localhost). You may need to allow location for this site.
        </span>
      </div>
      {geoError ? (
        <p className="ex-google-map-geo-error" role="status">
          {geoError}
        </p>
      ) : null}
      {showGoogle ? (
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
      ) : showGoogleLoading ? (
        <div className="ex-google-map-frame ex-google-map-frame--loading">
          <p className="ex-google-map-loading-text">Loading Google Maps…</p>
        </div>
      ) : (
        <ExploreOsmEmbed lat={markerPosition.lat} lng={markerPosition.lng} zoom={mapZoom} />
      )}
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
            ? "Decimal degrees above; same values are in the URL as mlat & mlng (shareable). Sidebar shows them when you are on the map view."
            : "Set a pin from the sidebar search, map click (Google only), or “Use my location”."}
        </p>
      </div>
    </div>
  );
}
