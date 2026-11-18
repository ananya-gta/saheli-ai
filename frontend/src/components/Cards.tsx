import { useEffect, useState } from "react";
import { api } from "../api";
import { getDrill, setDrill } from "../api";
import type { ActivityItem, Approval, BuildResult, CatalogItem, DomainOption, GrowthPlan, Profile } from "../types";
import { Icon } from "./Icon";
import { ScaledFrame } from "./ScaledFrame";
import { Button, Card, Eyebrow, Notice, Pill, ScoreRing } from "./ui";

const CATEGORY_LABEL: Record<string, string> = {
  food: "Ghar ka khana", bakery: "Bakery", beauty: "Beauty / Mehendi", tutoring: "Tuition / Classes",
  boutique: "Boutique", handicraft: "Handicraft", services: "Services", other: "Business",
};

/* ---------- profile confirmation ---------- */
export function ProfileCard({ profile, onConfirm, onChange, compact, confirmed }: { profile: Profile; onConfirm: () => void; onChange: () => void; compact?: boolean; confirmed?: boolean }) {
  const products = profile.products ?? [];
  const pay = (profile.payment_methods ?? []).map((m) => ({ upi: "UPI", cod: "Cash on delivery", cash: "Cash", card: "Card" } as Record<string, string>)[m] ?? m);
  return (
    <Card>
      <Eyebrow>Aapka business profile</Eyebrow>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl leading-tight">{profile.business_name || `${profile.owner_name ?? "Aapka"} business`}</h3>
          <p className="mt-0.5 text-sm text-muted">{CATEGORY_LABEL[profile.category ?? "other"]}{profile.city ? ` · ${profile.city}` : ""}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-700"><Icon name="store" /></span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {profile.owner_name && <Field icon="user" label="Owner" value={profile.owner_name} />}
        {(profile.service_area || profile.city) && <Field icon="pin" label="Area" value={String(profile.service_area || profile.city)} />}
        {pay.length > 0 && <Field icon="wallet" label="Payment" value={pay.join(", ")} />}
        {profile.reach_goal && <Field icon="trend" label="Goal" value={String(profile.reach_goal)} />}
      </dl>
      {products.length > 0 && (
        <div className="mt-4 divide-y divide-line rounded-xl border border-line">
          {products.slice(0, compact ? 3 : 8).map((p, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              {p.photo_id ? <img src={api.photoUrl(p.photo_id)} alt="" className="size-9 rounded-lg object-cover" /> :
                <span className="grid size-9 place-items-center rounded-lg bg-cream text-muted"><Icon name="store" className="size-4" /></span>}
              <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
              <span className="text-sm text-muted">{p.price_inr ? `₹${p.price_inr}` : "—"}{p.unit ? ` / ${p.unit}` : ""}</span>
            </div>
          ))}
        </div>
      )}
      {confirmed ? (
        <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-leaf"><Icon name="check" className="size-4" />Confirm ho gaya — kuch badalna ho to bas boliye</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" icon="check" onClick={onConfirm}>Haan, sahi hai</Button>
          <Button variant="secondary" onClick={onChange}>Badlo</Button>
        </div>
      )}
    </Card>
  );
}

function Field({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <Icon name={icon} className="mt-0.5 size-4 shrink-0 text-plum-600" />
      <div className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</dt><dd className="truncate">{value}</dd></div>
    </div>
  );
}

/* ---------- domain suggestions (real GoDaddy data) ---------- */
export function DomainCards({ domains, onPick }: { domains: DomainOption[]; onPick: (d: string) => void }) {
  const list = domains.filter((d) => d.domain).slice(0, 5);
  if (!list.length) return null;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow>Naam aur domain</Eyebrow>
        <Pill tone="leaf"><Icon name="check" className="size-3.5" />GoDaddy se live check</Pill>
      </div>
      <p className="mb-3 text-sm text-muted">Domain = aapki online dukaan ka pata. Aapki website pehle <b>free Saheli address</b> par banegi. Apna .com optional hai — ye abhi khareede nahi gaye hain.</p>
      <div className="grid gap-2">
        {list.map((d) => (
          <button key={d.domain} onClick={() => d.available && onPick(d.domain)} disabled={!d.available}
            className="group flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition hover:border-plum-600/50 hover:bg-plum-50 disabled:opacity-60">
            <Icon name="globe" className="size-5 text-plum-600" />
            <span className="flex-1 font-semibold">{d.domain}</span>
            {d.available ? (
              <span className="text-right text-sm">
                <span className="font-semibold">{d.price ? `$${d.price.amount}` : ""}</span>
                {d.price?.approx_inr ? <span className="block text-xs text-muted">≈ ₹{d.price.approx_inr.toLocaleString("en-IN")}/saal</span> : null}
              </span>
            ) : <Pill>Taken</Pill>}
            {d.available && <Icon name="arrow" className="size-4 text-muted transition group-hover:translate-x-0.5" />}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Daam GoDaddy ka pehle saal ka daam hai (renewal alag ho sakta hai). Saheli khud domain nahi khareedti — chahein to
        {" "}<a className="font-semibold text-plum-700 underline" href={`https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(list.find((d) => d.available)?.domain ?? list[0].domain)}`} target="_blank" rel="noopener">GoDaddy par khud dekh kar khareed sakti hain</a>.</p>
    </Card>
  );
}

/* ---------- photo -> catalog review ---------- */
export function CatalogReview({ items, onDone, done }: { items: CatalogItem[]; onDone: (rows: { name: string; price_inr?: number; unit?: string; photo_id: string; category: string }[]) => void; done?: boolean }) {
  const [rows, setRows] = useState(() => items.map((it) => ({ ...it, price: "", unit: it.unit_guess ?? "" })));
  const [touched, setTouched] = useState(false);
  const missing = rows.filter((r) => !r.price.trim() || isNaN(Number(r.price)));
  const update = (i: number, k: "name" | "price" | "unit", v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <Card tone="accent">
      <Eyebrow tone="saffron">Photos se catalog</Eyebrow>
      <h3 className="font-display text-lg">Aapke products bahut acche hain! Maine {rows.length} pehchaane — bas daam daal dijiye</h3>
      <div className="mt-3 grid gap-3">
        {rows.map((r, i) => (
          <div key={r.photo_id + i} className="flex gap-3 rounded-xl border border-line p-2.5">
            <img src={api.photoUrl(r.photo_id)} alt={r.name} className="size-20 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <input value={r.name} disabled={done} onChange={(e) => update(i, "name", e.target.value)} aria-label="Product name"
                className="w-full rounded-lg border border-transparent px-1.5 py-0.5 text-[15px] font-semibold hover:border-line focus:border-plum-600 focus:outline-none" />
              <p className="px-1.5 text-xs text-muted">{r.description}</p>
              {!r.photo_ok && r.photo_tip && <p className="px-1.5 text-xs text-[#9A6420]">{r.photo_tip}</p>}
              <div className="flex gap-2">
                <label className={`flex flex-1 items-center rounded-lg border px-2 ${touched && (!r.price || isNaN(Number(r.price))) ? "border-rose" : "border-line"}`}>
                  <span className="text-sm text-muted">₹</span>
                  <input inputMode="numeric" value={r.price} disabled={done} placeholder="Price" aria-label={`Price for ${r.name}`}
                    onChange={(e) => update(i, "price", e.target.value.replace(/[^\d.]/g, ""))} className="w-full bg-transparent px-1 py-1.5 text-sm focus:outline-none" />
                </label>
                <input value={r.unit} disabled={done} placeholder="Unit (500 g)" aria-label="Unit" onChange={(e) => update(i, "unit", e.target.value)}
                  className="w-28 rounded-lg border border-line px-2 py-1.5 text-sm focus:border-plum-600 focus:outline-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {touched && missing.length > 0 && <div className="mt-3"><Notice tone="warn">Har product ka price daaliye (sirf number).</Notice></div>}
      {!done && (
        <Button className="mt-4 w-full" icon="check" onClick={() => {
          setTouched(true);
          if (missing.length) return;
          onDone(rows.map((r) => ({ name: r.name.trim(), price_inr: Number(r.price), unit: r.unit.trim() || undefined, photo_id: r.photo_id, category: r.category })));
        }}>Meri dukaan mein jodo</Button>
      )}
      {done && <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-leaf"><Icon name="check" className="size-4" />Products jud gaye</p>}
    </Card>
  );
}

/* ---------- transparent cost breakdown + approval ---------- */
const BUILD_STAGES = [
  { t: "Aapke business ke liye design chun rahi hoon", d: "Industry, rang aur fonts" },
  { t: "Website ka content likh rahi hoon", d: "Kahani, products, FAQ" },
  { t: "Photos dhoondh aur check kar rahi hoon", d: "Aapki photos + licensed photos" },
  { t: "Website bana rahi hoon", d: "Mobile, SEO, enquiry form" },
  { t: "Online kar rahi hoon", d: "Secure link (HTTPS)" },
];

export function ApprovalCard({ approval, status, onApprove, onDecline, error }: {
  approval: Approval; status: "pending" | "building" | "done" | "declined"; onApprove: () => void; onDecline: () => void; error?: string;
}) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (status !== "building") { setStage(0); return; }
    const t = setInterval(() => setStage((s) => Math.min(s + 1, BUILD_STAGES.length - 1)), 4500);
    return () => clearInterval(t);
  }, [status]);

  if (status === "building") {
    return (
      <Card>
        <Eyebrow>Website ban rahi hai</Eyebrow>
        <ol className="mt-2 space-y-3">
          {BUILD_STAGES.map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold transition
                ${i < stage ? "bg-leaf text-white" : i === stage ? "bg-plum-700 text-white ring-4 ring-plum-100" : "bg-cream text-muted"}`}>
                {i < stage ? <Icon name="check" className="size-3.5" strokeWidth={2.4} /> : i + 1}
              </span>
              <div className={i > stage ? "opacity-50" : ""}>
                <p className={`text-sm ${i === stage ? "font-semibold" : ""}`}>{s.t}{i === stage && <span className="ml-1 inline-flex gap-0.5 align-middle">{[0, 1, 2].map((k) => <span key={k} className="inline-block size-1 animate-pulse rounded-full bg-plum-600" style={{ animationDelay: `${k * 0.2}s` }} />)}</span>}</p>
                <p className="text-xs text-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="skeleton mt-4 h-28 rounded-xl" aria-hidden="true" />
        <p className="mt-2 text-xs text-muted">Isme 30–60 second lagte hain.</p>
      </Card>
    );
  }

  return (
    <Card tone="accent">
      <Eyebrow tone="saffron">Aapki manzoori chahiye</Eyebrow>
      <h3 className="font-display text-xl leading-snug">{approval.business_name} ki website banayein?</h3>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-plum-50 px-3 py-2.5 font-mono text-[13.5px] text-plum-700">
        <Icon name="globe" className="size-4 shrink-0" /><span className="truncate">{approval.slug}.saheliai.com</span>
      </div>
      <table className="mt-4 w-full text-sm">
        <tbody className="divide-y divide-line">
          {[["Website design + content", "Free"], ["Hosting & secure link (HTTPS)", "Free"], ["Enquiry form → email", "Free"], ["WhatsApp & UPI ordering", "Free"]].map(([k, v]) => (
            <tr key={k}><td className="py-2 text-muted">{k}</td><td className="py-2 text-right font-medium">{v}</td></tr>
          ))}
          <tr><td className="pt-3 font-semibold">Aaj ka kharcha</td><td className="pt-3 text-right font-display text-xl font-semibold text-leaf">₹0</td></tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">Apna .com domain (lagbhag ₹1,100/saal) baad mein — sirf aapki alag manzoori se. Kuch bhi apne aap nahi khareeda jaayega.</p>
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      {status === "declined" ? <p className="mt-4 text-sm text-muted">Theek hai — naya naam chuniye.</p> : (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" icon="check" onClick={onApprove}>Haan, banao</Button>
          <Button variant="secondary" onClick={onDecline}>Naam badlo</Button>
        </div>
      )}
    </Card>
  );
}

/* ---------- success ---------- */
export function SuccessCard({ site, onDashboard }: { site: BuildResult; onDashboard: () => void }) {
  const share = `Namaste! Ab aap ${site.content.business_name} ko online dekh sakte hain: ${site.url}`;
  const [copied, setCopied] = useState(false);
  return (
    <Card tone="success" className="overflow-hidden !p-0">
      <div className="relative border-b border-line">
        <ScaledFrame src={site.url} title="Website preview" height={210} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
        <span className="absolute left-3 top-3"><Pill tone="leaf"><span className="size-1.5 rounded-full bg-leaf" />Live</Pill></span>
      </div>
      <div className="p-4 sm:p-5">
        <Eyebrow tone="leaf">Badhai ho! Aapki dukaan online hai</Eyebrow>
        <h3 className="font-display text-2xl leading-tight">{site.content.business_name}</h3>
        <p className="text-sm text-muted">{site.content.tagline_en}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="plum">{site.design.archetype} design</Pill>
          {site.photos.count > 0 && <Pill>{site.photos.count} photos</Pill>}
          {site.agent && <Pill tone="saffron"><Icon name="bot" className="size-3.5" />AI-agent ready</Pill>}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <a href={site.url} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-plum-700 px-4 font-semibold text-ivory shadow-lift hover:bg-plum-800">
            <Icon name="external" className="size-[18px]" />Website kholo</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1E9E57] px-4 font-semibold text-white hover:bg-[#188A4B]">
            <Icon name="whatsapp" className="size-[18px]" />WhatsApp par share</a>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" className="flex-1" icon={copied ? "check" : "copy"} onClick={() => { navigator.clipboard?.writeText(site.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}>{copied ? "Copied" : "Link copy"}</Button>
          <Button variant="secondary" className="flex-1" icon="grid" onClick={onDashboard}>Dashboard</Button>
        </div>
        {site.verification && (
          <div className={`mt-4 rounded-2xl border p-3.5 ${site.verification.ok ? "border-leaf/30 bg-leaf-50" : "border-rose/30 bg-rose/5"}`}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon name={site.verification.ok ? "shield" : "x"} className={`size-4 ${site.verification.ok ? "text-leaf" : "text-rose"}`} />
              {site.verification.ok ? "Saheli ne khud website khol kar check kiya" : "Website check nahi ho paayi"}
              <code className="ml-auto text-[11px] font-normal text-muted">{site.verification.status ?? "—"}{site.verification.ms ? ` · ${site.verification.ms} ms` : ""}</code>
            </p>
            {site.verification.checks && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {Object.entries(site.verification.checks).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1"><Icon name={v ? "check" : "x"} className={`size-3.5 ${v ? "text-leaf" : "text-rose"}`} />{CHECK_LABEL[k] ?? k}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {site.readiness && (
          <button onClick={onDashboard} className="mt-3 flex w-full items-center gap-3.5 rounded-2xl border border-line bg-white p-3 text-left transition hover:border-plum-100 hover:shadow-card">
            <ScoreRing value={site.readiness.score} size={56} />
            <span className="min-w-0 flex-1">
              <b className="block text-sm">Launch readiness</b>
              <span className="block text-xs text-muted">{site.readiness.message ?? (site.readiness.next_steps[0] ? `Agla kadam: ${site.readiness.next_steps[0].label}` : "")}</span>
            </span>
            <Icon name="arrow" className="size-4 text-muted" />
          </button>
        )}
        <div className="mt-3 space-y-2">
          {site.photos.count === 0 && <Notice tone="warn">Photos download nahi ho payi — server ka internet check karein, phir dashboard se dobara banaiye.</Notice>}
          {!site.integrations.email && <Notice>Orders aur enquiries aapke Dashboard mein aayengi. Email notifications abhi is server par chalu nahi hain.</Notice>}
        </div>
      </div>
    </Card>
  );
}

const CHECK_LABEL: Record<string, string> = { page_loads: "Page loads", https: "HTTPS", has_title: "SEO title", mobile_ready: "Mobile-ready", enquiry_form: "Enquiry form" };

/* ---------- agent activity: the real tool calls behind a reply ---------- */
function dotClass(a: ActivityItem) { return a.failed ? "bg-rose" : a.checkpoint ? "bg-plum-600" : a.recovered ? "bg-saffron" : "bg-leaf"; }

export function ActivityLog({ items }: { items: ActivityItem[] }) {
  const failed = items.some((i) => i.failed);
  // always open when something needs attention (an error or an approval checkpoint)
  const [open, setOpen] = useState(items.length <= 4 || failed || items.some((i) => i.checkpoint || i.recovered));
  return (
    <div className="animate-rise ml-11 max-w-[min(92%,560px)]">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-plum-700" aria-expanded={open}>
        <span className={`grid size-4 place-items-center rounded-full ${failed ? "bg-rose" : "bg-leaf"} text-white`}><Icon name={failed ? "x" : "check"} className="size-2.5" strokeWidth={3} /></span>
        Saheli ne {items.length} kaam kiye{failed ? " · ek mein dikkat" : ""}
        <Icon name="arrow" className={`size-3 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <ol className="mt-2 space-y-1 border-l border-line pl-3.5">
          {items.map((a, i) => (
            <li key={i} className="relative text-[12.5px] leading-snug">
              <span className={`absolute -left-[18.5px] top-1.5 size-2 rounded-full ring-2 ring-ivory ${dotClass(a)}`} />
              <span className={a.checkpoint ? "font-semibold text-plum-700" : "text-ink"}>{a.label}</span>
              {a.detail && <span className="text-muted"> — {a.detail}</span>}
              {a.recovered && <span className="ml-1 text-[#9A6420]"> (pehli koshish fail, dobara mein ho gaya)</span>}
              <code className="ml-1.5 rounded bg-cream px-1.5 py-px text-[10.5px] text-plum-600">{a.tool}</code>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Developer panel: every real tool call in this conversation with status, errors and raw input/output. */
const DRILLS: [string, string][] = [["", "Off"], ["claude", "Claude down"], ["godaddy", "GoDaddy down"], ["timeout", "Every call times out"]];

export function ExecutionLog({ items, onClose, isAdmin = false }: { items: ActivityItem[]; onClose: () => void; isAdmin?: boolean }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [drill, setDrillState] = useState(getDrill());
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  const status = (a: ActivityItem) => (a.failed ? ["error", "text-rose"] : a.recovered ? ["recovered", "text-[#9A6420]"] : a.checkpoint ? ["approval", "text-plum-700"] : ["ok", "text-leaf"]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-lift" onClick={(e) => e.stopPropagation()} aria-label="Execution log">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div><b className="text-sm">Agent execution log</b><p className="text-xs text-muted">Real tool calls in this conversation · raw backend data</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-cream" aria-label="Close"><Icon name="x" /></button>
        </header>
        <ol className="flex-1 divide-y divide-line overflow-y-auto font-mono text-[12px]">
          {items.length === 0 && <li className="p-6 text-center font-sans text-sm text-muted">Abhi tak koi tool call nahi hua.</li>}
          {items.map((a, i) => {
            const [st, cls] = status(a);
            return (
              <li key={i}>
                <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-cream/60" onClick={() => setOpenIdx(openIdx === i ? null : i)} aria-expanded={openIdx === i}>
                  <span className="w-6 text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate text-plum-700">{a.tool}</span>
                  <span className={`font-semibold uppercase ${cls}`}>{st}</span>
                </button>
                {openIdx === i && (
                  <div className="space-y-2 bg-cream/40 px-4 pb-3 pt-1">
                    <p className="font-sans text-xs text-ink">{a.label}{a.detail ? ` — ${a.detail}` : ""}</p>
                    {a.error && <p className="rounded bg-rose/10 px-2 py-1 text-rose">error: {a.error}</p>}
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#1F1219] p-3 text-[11px] leading-relaxed text-ivory/85">{JSON.stringify(a.raw ?? null, null, 2).slice(0, 4000)}</pre>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {isAdmin && (
          <div className="border-t border-line bg-saffron-50/60 px-4 py-3">
            <p className="text-xs font-semibold">Failure drill <span className="font-normal text-muted">— admin only, applies to your next messages</span></p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DRILLS.map(([v, label]) => (
                <button key={v || "off"} onClick={() => { setDrill(v); setDrillState(v); }} aria-pressed={drill === v}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${drill === v ? (v ? "bg-rose text-white" : "bg-leaf text-white") : "bg-white text-muted ring-1 ring-line"}`}>{label}</button>
              ))}
            </div>
          </div>
        )}
        <p className="border-t border-line px-4 py-2.5 text-[11px] text-muted">This panel only shows what the backend actually returned. Failures appear as errors with their recovery — never as fake success.</p>
      </aside>
    </div>
  );
}

/* ---------- growth plan ---------- */
export function PlanCard({ plan }: { plan: GrowthPlan }) {
  const [tab, setTab] = useState(0);
  const phase = plan.phases?.[tab];
  return (
    <Card>
      <Eyebrow>Aapka growth plan</Eyebrow>
      <h3 className="font-display text-xl leading-snug">{plan.headline}</h3>
      {plan.quick_wins?.length > 0 && (
        <div className="mt-3 rounded-xl bg-saffron-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[#9A6420]">Is hafte</p>
          <ul className="mt-1.5 space-y-1 text-sm">{plan.quick_wins.map((w, i) => <li key={i} className="flex gap-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-[#9A6420]" />{w}</li>)}</ul>
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-cream p-1" role="tablist">
        {plan.phases?.map((_, i) => (
          <button key={i} role="tab" aria-selected={i === tab} onClick={() => setTab(i)}
            className={`rounded-lg py-1.5 text-sm font-semibold transition ${i === tab ? "bg-white text-plum-700 shadow-card" : "text-muted"}`}>{[30, 60, 90][i] ?? i + 1} din</button>
        ))}
      </div>
      {phase && (
        <div key={tab} className="animate-rise mt-3">
          <p className="font-semibold">{phase.title}</p>
          <p className="text-sm text-muted">Lakshya: {phase.goal}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{phase.actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
        </div>
      )}
      {plan.channels?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{plan.channels.map((c) => <Pill key={c} tone="plum">{c}</Pill>)}</div>}
      {plan.franchise?.relevant && plan.franchise.steps?.length ? (
        <details className="mt-3 rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Franchise roadmap</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{plan.franchise.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></details>
      ) : null}
      {plan.help_resources?.length ? (
        <details className="mt-2 rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Sarkari yojnaayein & madad</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.help_resources.map((s, i) => <li key={i}>{s}</li>)}</ul></details>
      ) : null}
    </Card>
  );
}
