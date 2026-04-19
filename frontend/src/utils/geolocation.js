/**
 * Browser Geolocation API wrapped as a Promise (HTTPS or localhost required in most browsers).
 */

/**
 * @param {{ timeout?: number, enableHighAccuracy?: boolean, maximumAge?: number }} [opts]
 * @returns {Promise<{ lat: number, lng: number, accuracy?: number }>}
 */
export function getCurrentPositionAsPromise(opts = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => {
        let msg = "Could not read your location.";
        if (err && typeof err.code === "number") {
          if (err.code === 1) {
            msg =
              "Location permission denied. Allow location for this site in your browser address bar or site settings.";
          } else if (err.code === 2) {
            msg = "Location unavailable.";
          } else if (err.code === 3) {
            msg = "Location request timed out.";
          }
        } else if (err && err.message) {
          msg = err.message;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy ?? true,
        timeout: opts.timeout ?? 15_000,
        maximumAge: opts.maximumAge ?? 30_000
      }
    );
  });
}
