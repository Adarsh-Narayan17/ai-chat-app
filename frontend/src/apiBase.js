/** Base URL for the Render API (empty in dev → Vite proxy + relative /api paths). */
const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const API_BASE = base;

/** Resolve `/api/...` against `VITE_API_URL`, or return a root-relative path for local dev. */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
