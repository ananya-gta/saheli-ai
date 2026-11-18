/** Small, failure-tolerant localStorage helpers (storage can be unavailable in some browsers). */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
export function clear(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
export const uid = () => Math.random().toString(36).slice(2, 10);
