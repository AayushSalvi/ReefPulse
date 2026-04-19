/**
 * Single Google Maps JS + Places load for Explore (avoids duplicate script / auth errors).
 */
import { createContext, useContext, useMemo } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

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
  const raw = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const apiKey = typeof raw === "string" ? raw.trim() : "";

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
