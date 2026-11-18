export interface User { id: number; email: string; name: string | null; is_admin?: boolean; }

export type Role = "user" | "assistant";
export type Lang = "hi" | "en";

export interface ChatMessage { role: Role; content: string; }

export interface Product { name: string; price_inr?: number; unit?: string; photo_id?: string; notes?: string; }

export interface Profile {
  owner_name?: string; business_name?: string; category?: string; city?: string; service_area?: string;
  products?: Product[]; payment_methods?: string[]; upi_id?: string; whatsapp?: string; email?: string;
  reach_goal?: string; franchise_interest?: string; help_needed?: string[]; [key: string]: unknown;
}

export interface ToolEvent { tool: string; input: Record<string, unknown>; output: Record<string, unknown>; }

export interface Approval { type: "website"; slug: string; business_name: string; url: string; cost: string; }

export interface GrowthPlan {
  headline: string;
  phases: { title: string; goal: string; actions: string[] }[];
  quick_wins: string[];
  channels: string[];
  franchise?: { relevant: boolean; steps?: string[] };
  help_resources?: string[];
}

export interface ChatResponse {
  degraded?: string | null;
  reply: string; events: ToolEvent[]; profile: Profile | null; approval: Approval | null; growth_plan: GrowthPlan | null;
}

export interface BuildResult {
  slug: string; url: string;
  content: { business_name: string; tagline_en: string; archetype: string };
  design: { archetype: string; palette: string };
  photos: { count: number; sources: string[] };
  integrations: { photos: boolean; email: boolean };
  agent?: { mcp_url: string; agent_card: string };
  verification?: Verification;
  readiness?: Readiness;
}

export interface Verification { ok: boolean; status: number | null; ms?: number; url: string; error?: string; checks?: Record<string, boolean>; }

export interface ReadinessItem { label: string; done: boolean; points: number; tip: string | null; action: string | null; }
export interface Readiness { score: number; message?: string; sections: { name: string; score: number; items: ReadinessItem[] }[]; next_steps: ReadinessItem[]; }

export interface AssistOutput { title: string; items: { heading: string; text: string }[]; tip?: string; }
export type AssistTask = "instagram" | "whatsapp" | "festival" | "order_confirmation" | "improve" | "custom";

export interface ActivityItem { tool: string; label: string; detail?: string; failed?: boolean; recovered?: boolean; checkpoint?: boolean; error?: string; raw?: unknown; }

export interface CatalogItem {
  photo_id: string; photo_index: number; name: string; name_hi: string; description: string; category: string;
  unit_guess?: string; photo_ok: boolean; photo_tip?: string;
}

export interface SiteSummary {
  slug: string; name: string; tagline: string; archetype: string; url: string; thumb: string | null;
  products: number; enquiries: number; updated: string; mcp_url: string;
}

export interface Enquiry {
  name: string; phone: string; email?: string; message: string; interest?: string; date?: string;
  channel: "website" | "agent"; received_at: string;
}

/** Items rendered in the conversation timeline. */
export type Entry =
  | { kind: "msg"; id: string; role: Role; content: string }
  | { kind: "profile"; id: string; profile: Profile; confirmed?: boolean }
  | { kind: "domains"; id: string; domains: DomainOption[] }
  | { kind: "catalog"; id: string; items: CatalogItem[]; done?: boolean }
  | { kind: "approval"; id: string; approval: Approval; status: "pending" | "building" | "done" | "declined" }
  | { kind: "site"; id: string; site: BuildResult }
  | { kind: "plan"; id: string; plan: GrowthPlan }
  | { kind: "activity"; id: string; items: ActivityItem[] }
  | { kind: "error"; id: string; message: string; retry?: "chat"; code?: string; requestId?: string };

export interface DomainOption { domain: string; available: boolean; price?: { amount: number; currency: string; approx_inr?: number } | null; }

export interface OrderLine { name: string; unit: string; qty: number; price: number; amount: number; }
export interface Order {
  id: number; number: number; code: string; items: OrderLine[]; total: number;
  customer_name: string; customer_phone: string; address?: string | null; pincode?: string | null;
  payment_method: "upi" | "cod"; payment_status: "pending" | "paid"; status: "new" | "confirmed" | "delivered" | "cancelled";
  channel: "website" | "agent"; created_at: string;
}
export interface OrderStats { count: number; paid_total: number; order_value: number; }
