/** API origin for fetch(). Empty string = same origin (use Vite proxy to backend). */
export function getApiBase() {
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}
