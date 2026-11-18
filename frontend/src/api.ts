import type { User } from "./types";
import type { AssistOutput, AssistTask, BuildResult, CatalogItem, ChatMessage, ChatResponse, Enquiry, Lang, Order, OrderStats, Profile, Readiness, SiteSummary, Verification } from "./types";

/** Error from the API (or the network) with everything the UI needs to react well. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code = "error", public retryable = false, public requestId?: string) { super(message); }
}

let drill = ""; // admin-only failure drill, sent as X-Saheli-Fault (ignored by the server for everyone else)
export const setDrill = (v: string) => { drill = v; };
export const getDrill = () => drill;

async function req<T>(path: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...init, signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(drill ? { "X-Saheli-Fault": drill } : {}), ...(init?.headers ?? {}) } });
  } catch (e) {
    const timedOut = (e as Error).name === "AbortError";
    throw new ApiError(timedOut ? "Jawab aane mein bahut der ho gayi. Ek baar phir koshish kijiye." : "Internet ya server se connect nahi ho paaya. Connection check karke dobara koshish kijiye.",
      0, timedOut ? "client_timeout" : "network", true);
  } finally {
    clearTimeout(timer);
  }
  /** The API's error shape: {detail, code, retryable, request_id}; on success, the endpoint's own body. */
  let data: { detail?: unknown; error?: unknown; code?: string; retryable?: boolean; request_id?: string } | null = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && !path.startsWith("/api/auth/")) window.dispatchEvent(new Event("saheli:unauthorized"));
  if (!res.ok) {
    const detail = data && (data.detail || data.error);
    const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? "Kuch details sahi nahi hain" : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data?.code ?? `http_${res.status}`, !!data?.retryable || res.status >= 500 || res.status === 429,
      data?.request_id ?? res.headers.get("X-Request-ID") ?? undefined);
  }
  return data as unknown as T;
}

export interface ShowcaseSite {
  slug: string; name: string; tagline: string; archetype: string; url: string; image?: string | null;
  readiness?: { score: number; done: number; total: number; done_labels: string[]; next: { label: string; points: number }[] } | null;
}
export interface LandingPhoto { src: string; src_small: string; alt: string; photographer?: string | null; page_url?: string | null; source?: string | null; license?: string | null; license_url?: string | null }
export interface LandingData {
  photos: Record<string, LandingPhoto>;
  pricing: { domain: string; live: boolean; available?: boolean; price?: { amount: number; currency: string; approx_inr?: number } | null; reason?: string; checked_at?: string };
}

const post = <T,>(path: string, body: unknown, timeoutMs?: number) => req<T>(path, { method: "POST", body: JSON.stringify(body) }, timeoutMs);

export const api = {
  me: () => req<{ user: User | null }>("/api/auth/me"),
  requestCode: (email: string) => post<{ sent: boolean; via: "email" | "dev"; dev_code?: string }>("/api/auth/request-code", { email }),
  verifyCode: (email: string, code: string) => post<{ user: User }>("/api/auth/verify", { email, code }),
  setName: (name: string) => post<{ user: User }>("/api/auth/name", { name }),
  logout: () => post<{ ok: boolean }>("/api/auth/logout", {}),
  exportUrl: "/api/account/export",
  deleteAccount: (confirm_email: string) => post<{ deleted: boolean; websites: number; photos: number }>("/api/account/delete", { confirm_email }),
  health: () => req<{ ok: boolean; missing_settings: string[]; integrations: Record<string, boolean> }>("/api/health"),
  chat: (messages: ChatMessage[], profile: Profile | null, lang: Lang) => post<ChatResponse>("/api/chat", { messages, profile, lang }, 130000),
  build: (slug: string, profile: Profile) => post<BuildResult>("/api/sites/build", { slug, profile }, 300000),
  uploadPhotos: (images: string[]) => post<{ photo_ids: string[]; errors: { index: number; error: string }[] }>("/api/photos", { images }),
  analyze: (photo_ids: string[], context: string) => post<{ business_guess: string; items: CatalogItem[] }>("/api/catalog/analyze", { photo_ids, context }, 150000),
  sites: () => req<{ sites: SiteSummary[] }>("/api/sites"),
  enquiries: (slug: string) => req<{ enquiries: Enquiry[] }>(`/api/sites/${slug}/enquiries`),
  summary: (slug: string) => req<{ text: string; speech: string; next_action: string; count: number }>(`/api/sites/${slug}/summary`, undefined, 90000),
  edit: (slug: string, instruction: string) => post<{ ok: boolean; summary: string; changed?: string[] }>(`/api/sites/${slug}/edit`, { instruction }, 180000),
  photoUrl: (id: string) => `/api/photos/${id}`,
  readiness: (slug: string, lang: Lang) => req<Readiness>(`/api/sites/${slug}/readiness?lang=${lang}`),
  addPhotos: (slug: string, items: { photo_id: string; name: string; price_inr?: number; unit?: string; description?: string }[]) =>
    post<{ ok: boolean; summary: string }>(`/api/sites/${slug}/photos`, { items }, 180000),
  verify: (slug: string) => post<Verification>(`/api/sites/${slug}/verify`, {}),
  assist: (slug: string, task: AssistTask, request = "") => post<AssistOutput>(`/api/sites/${slug}/assist`, { task, request }, 120000),
  marketing: (slug: string) => req<{ items: { task: string; output: AssistOutput; created_at: string }[] }>(`/api/sites/${slug}/marketing`),
  orders: (slug: string) => req<{ orders: Order[]; stats: OrderStats }>(`/api/sites/${slug}/orders`),
  updateOrder: (slug: string, id: number, patch: Partial<Pick<Order, "status" | "payment_status">>) =>
    req<Order>(`/api/sites/${slug}/orders/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  showcase: () => req<{ sites: ShowcaseSite[] }>("/api/showcase"),
  landing: () => req<LandingData>("/api/landing"),
};
