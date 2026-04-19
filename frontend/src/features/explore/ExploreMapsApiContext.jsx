/**
 * Single Google Maps JS + Places load for Explore (avoids duplicate script / auth errors).
 */
import { createContext, useContext, useMemo } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

import { resolveGoogleMapsApiKey } from "../../lib/googleMapsEnv";

const ExploreMapsApiContext = createContext(null);

function LoaderInner({ apiKey, children }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "reefpulse-google-maps",
    googleMapsApiKey: apiKey,
    libraries: ["places"],
    version: "weekly"
  });

  const value = useMemo(
    () => ({
      hasKey: true,
      isLoaded,
      loadError,
      ready: isLoaded && !loadError
    }),
    [isLoaded, loadError]
  );

  return <ExploreMapsApiContext.Provider value={value}>{children}</ExploreMapsApiContext.Provider>;
}

export function ExploreMapsApiProvider({ children }) {
  const apiKey = resolveGoogleMapsApiKey(__INJECTED_GOOGLE_MAPS_KEY__);

  if (!apiKey) {
    return (
      <ExploreMapsApiContext.Provider value={{ hasKey: false, isLoaded: false, loadError: null, ready: false }}>
        {children}
      </ExploreMapsApiContext.Provider>
    );
  }

  return <LoaderInner apiKey={apiKey}>{children}</LoaderInner>;
}

export function useExploreMapsApi() {
  const ctx = useContext(ExploreMapsApiContext);
  if (!ctx) {
    throw new Error("useExploreMapsApi must be used under ExploreMapsApiProvider");
  }
  return ctx;
}
