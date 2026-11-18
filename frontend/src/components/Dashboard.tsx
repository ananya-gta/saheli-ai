import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { speak, useVoiceInput } from "../lib/speech";
import type { AssistOutput, AssistTask, Enquiry, Lang, Order, OrderStats, Readiness, SiteSummary } from "../types";
import { Icon } from "./Icon";
import { ScaledFrame } from "./ScaledFrame";
import { Button, Card, Eyebrow, Notice, Pill, ScoreRing } from "./ui";

export function Dashboard({ lang, onNew }: { lang: Lang; onNew: () => void }) {
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [error, setError] = useState<string>();
  const [active, setActive] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.sites().then((r) => { setSites(r.sites); setActive((a) => a ?? r.sites[0]?.slug ?? null); }).catch((e) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);

  const site = sites?.find((s) => s.slug === active) ?? null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><Eyebrow>Dashboard</Eyebrow><h1 className="font-display text-3xl">Meri websites</h1></div>
          <Button icon="sparkle" onClick={onNew}>Nayi website</Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {!sites && !error && <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><div className="skeleton h-64 rounded-2xl" /><div className="skeleton h-96 rounded-2xl" /></div>}
        {sites && sites.length === 0 && (
          <Card className="py-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-plum-50 text-plum-700"><Icon name="store" className="size-7" /></span>
            <h2 className="mt-4 font-display text-2xl">Abhi koi website nahi hai</h2>
            <p className="mx-auto mt-1 max-w-sm text-muted">Saheli se 5 minute baat kijiye — aapki pehli website taiyaar ho jaayegi.</p>
            <Button className="mt-5" icon="arrow" onClick={onNew}>Shuru karein</Button>
          </Card>
        )}
        {sites && sites.length > 0 && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <ul className="space-y-2">
              {sites.map((s) => (
                <li key={s.slug}>
                  <button onClick={() => setActive(s.slug)} className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${s.slug === active ? "border-plum-600/50 bg-white shadow-card" : "border-transparent hover:bg-white"}`}>
                    {s.thumb ? <img src={s.thumb} alt="" className="size-14 rounded-xl object-cover" /> : <span className="grid size-14 place-items-center rounded-xl bg-cream font-display text-xl text-plum-700">{s.name?.[0]}</span>}
                    <span className="min-w-0 flex-1"><b className="block truncate">{s.name}</b><span className="block truncate text-xs text-muted">{s.slug}.saheliai.com</span></span>
                    {s.enquiries > 0 && <Pill tone="saffron">{s.enquiries}</Pill>}
                  </button>
                </li>
              ))}
            </ul>
            {site && <SiteDetail key={site.slug} site={site} lang={lang} onChanged={refresh} />}
          </div>
        )}
      </div>
    </div>
  );
}

function SiteDetail({ site, lang, onChanged }: { site: SiteSummary; lang: Lang; onChanged: () => void }) {
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [summary, setSummary] = useState<{ text: string; speech: string; next_action: string } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [editResult, setEditResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [err, setErr] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState(0); // bump to refresh readiness after any change
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => { api.enquiries(site.slug).then((r) => setEnquiries(r.enquiries)).catch((e) => setErr(e.message)); }, [site.slug]);

  async function listen() {
    setLoadingSummary(true); setErr(undefined);
    try { const s = await api.summary(site.slug); setSummary(s); speak(s.speech || s.text, "hi"); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoadingSummary(false); }
  }

  const doEdit = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setEditing(true); setEditResult(null);
    try {
      const r = await api.edit(site.slug, t);
      setEditResult({ ok: r.ok, text: r.summary });
      if (r.ok) { setInstruction(""); setFrameKey((k) => k + 1); onChanged(); bump(); speak(r.summary, "hi"); }
    } catch (e) { setEditResult({ ok: false, text: (e as Error).message }); }
    finally { setEditing(false); }
  }, [site.slug, onChanged, bump]);

  const voice = useVoiceInput(lang, useCallback((t: string) => { setInstruction(t); doEdit(t); }, [doEdit]));
  const mcp = site.mcp_url;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
      <div className="space-y-4">
        <Card className="overflow-hidden !p-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="flex gap-1">{["#E8B4B8", "#E9D3A3", "#B9D7C4"].map((c) => <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />)}</span>
            <span className="mx-2 flex-1 truncate rounded-lg bg-cream px-3 py-1 text-center font-mono text-xs text-muted">{site.slug}.saheliai.com</span>
            <a href={site.url} target="_blank" rel="noopener" className="rounded-lg p-1.5 text-muted hover:bg-plum-50 hover:text-plum-700" aria-label="Open website"><Icon name="external" className="size-4" /></a>
          </div>
          <ScaledFrame key={frameKey} src={site.url} title={`${site.name} preview`} height={340} interactive />
        </Card>

        <Card>
          <Eyebrow>Bolkar website badlo</Eyebrow>
          <p className="text-sm text-muted">Jaise: “Aam ke achaar ka price 280 kar do” ya “Naya product jodo: lahsun ka achaar ₹240”.</p>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); doEdit(instruction); }}>
            <input value={voice.listening ? voice.interim : instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={voice.listening ? "Sun rahi hoon…" : "Kya badalna hai?"}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-[15px] focus:border-plum-600 focus:outline-none focus:ring-4 focus:ring-plum-100" />
            <button type="button" onClick={voice.listening ? voice.stop : voice.start} aria-label="Bolkar batayein"
              className={`grid size-11 place-items-center rounded-xl text-white ${voice.listening ? "bg-rose" : "bg-plum-700"}`}><Icon name="mic" /></button>
            <Button type="submit" loading={editing} disabled={!instruction.trim()}>Badlo</Button>
          </form>
          {voice.error && <div className="mt-2"><Notice tone="warn">{voice.error}</Notice></div>}
          {editing && <div className="skeleton mt-3 h-10 rounded-xl" />}
          {editResult && <div className="mt-3"><Notice tone={editResult.ok ? "info" : "warn"}>{editResult.text}</Notice></div>}
        </Card>
        <AssistantCard slug={site.slug} onDone={bump} />
      </div>

      <div className="space-y-4">
        <OrdersCard slug={site.slug} onChanged={bump} />
        <ReadinessCard slug={site.slug} version={version} onChanged={bump} />
        <Card>
          <div className="flex items-center justify-between gap-2">
            <div><Eyebrow tone="saffron">Enquiries</Eyebrow><p className="font-display text-2xl">{enquiries?.length ?? "–"}</p></div>
            <Button variant="secondary" icon="speaker" loading={loadingSummary} onClick={listen}>Summary suno</Button>
          </div>
          {summary && <div className="mt-3 rounded-xl bg-saffron-50 p-3 text-sm"><p>{summary.text}</p>{summary.next_action && <p className="mt-1 font-semibold">→ {summary.next_action}</p>}</div>}
          {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
          <ul className="mt-3 divide-y divide-line">
            {enquiries === null && [0, 1].map((k) => <li key={k} className="skeleton my-2 h-14 rounded-xl" />)}
            {enquiries?.length === 0 && <li className="py-6 text-center text-sm text-muted">Abhi koi enquiry nahi. Website ka link WhatsApp status par lagaiye!</li>}
            {enquiries?.slice(0, 8).map((q, i) => (
              <li key={i} className="py-3">
                <div className="flex items-center gap-2"><b className="text-sm">{q.name}</b>{q.channel === "agent" && <Pill tone="plum"><Icon name="bot" className="size-3" />AI agent</Pill>}
                  <span className="ml-auto text-xs text-muted">{new Date(q.received_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></div>
                {q.interest && <p className="text-xs font-medium text-plum-700">{q.interest}</p>}
                <p className="text-sm text-muted">{q.message}</p>
                <a href={`https://wa.me/${q.phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#1E9E57]"><Icon name="whatsapp" className="size-3.5" />{q.phone}</a>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-plum-50 text-plum-700"><Icon name="bot" /></span>
            <div className="min-w-0">
              <Eyebrow>AI-agent ready</Eyebrow>
              <p className="text-sm text-muted">Customers ke AI assistants (Claude, ChatGPT) bhi aapke products dekh kar order bhej sakte hain.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-cream px-3 py-2">
            <code className="flex-1 truncate text-xs">{mcp}</code>
            <button onClick={() => navigator.clipboard?.writeText(mcp).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className="text-plum-700" aria-label="Copy MCP URL"><Icon name={copied ? "check" : "copy"} className="size-4" /></button>
          </div>
          <a href={`${site.url}.well-known/agent-card.json`} target="_blank" rel="noopener" className="mt-2 inline-block text-xs font-semibold text-plum-700 hover:underline">Agent card dekhein →</a>
        </Card>
      </div>
    </div>
  );
}

/* ---------- launch readiness: computed on the server from completed work only ---------- */
function ReadinessCard({ slug, version, onChanged }: { slug: string; version: number; onChanged: () => void }) {
  const [r, setR] = useState<Readiness | null>(null);
  const [err, setErr] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { api.readiness(slug).then(setR).catch((e) => setErr(e.message)); }, [slug, version]);

  async function verify() {
    setVerifying(true); setErr(undefined);
    try { const v = await api.verify(slug); if (!v.ok) setErr(`Website ne jawab nahi diya (${v.status ?? v.error ?? "no response"})`); onChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setVerifying(false); }
  }
  const act = (a: string | null) => {
    if (a === "verify") verify();
    else if (a === "assist") document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!r) return <Card>{err ? <Notice tone="error">{err}</Notice> : <div className="flex items-center gap-4"><div className="skeleton size-24 rounded-full" /><div className="skeleton h-16 flex-1 rounded-xl" /></div>}</Card>;
  return (
    <Card>
      <div className="flex items-center gap-4">
        <ScoreRing value={r.score} size={92} />
        <div className="min-w-0 flex-1">
          <Eyebrow tone="leaf">Launch readiness</Eyebrow>
          <p className="text-sm">{r.message ?? "Sirf poore hue kaamon se gina gaya — koi andaza nahi."}</p>
          <p className="text-xs text-muted">Sirf asli checks se gina gaya — koi andaza nahi.</p>
          <button onClick={verify} disabled={verifying} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-plum-700 hover:underline disabled:opacity-60">
            <Icon name="refresh" className={`size-3.5 ${verifying ? "animate-spin" : ""}`} />{verifying ? "Check ho raha hai…" : "Abhi live check karo"}</button>
        </div>
      </div>
      {err && <div className="mt-3"><Notice tone="warn">{err}</Notice></div>}
      {r.next_steps.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-muted">Agle kadam</p>
          <ul className="mt-2 space-y-2">
            {r.next_steps.map((n) => (
              <li key={n.label} className="flex items-start gap-3 rounded-xl bg-cream/70 p-3">
                <span className="mt-0.5 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-plum-700">+{n.points}</span>
                <span className="min-w-0 flex-1 text-sm"><b className="block">{n.label}</b>{n.tip && <span className="text-muted">{n.tip}</span>}</span>
                {(n.action === "verify" || n.action === "assist") && <button onClick={() => act(n.action)} className="shrink-0 text-xs font-semibold text-plum-700 hover:underline">{n.action === "verify" ? "Check" : "Banao"} →</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="mt-3 text-xs font-semibold text-muted hover:text-plum-700" aria-expanded={open}>{open ? "Kam dikhao" : "Poora breakdown"}</button>
      {open && (
        <div className="mt-3 space-y-3">
          {r.sections.map((s) => (
            <div key={s.name}>
              <div className="flex justify-between text-xs font-semibold"><span>{s.name}</span><span className="text-muted">{s.score}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-leaf transition-all duration-700" style={{ width: `${s.score}%` }} /></div>
              <ul className="mt-1.5 grid gap-x-3 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
                {s.items.map((i) => <li key={i.label} className="flex items-center gap-1.5"><Icon name={i.done ? "check" : "x"} className={`size-3 ${i.done ? "text-leaf" : "text-muted/60"}`} />{i.label}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- post-launch business assistant ---------- */
const TASKS: { id: AssistTask; label: string; icon: string }[] = [
  { id: "instagram", label: "Instagram posts", icon: "sparkle" },
  { id: "whatsapp", label: "WhatsApp announcement", icon: "whatsapp" },
  { id: "festival", label: "Festival offer", icon: "leaf" },
  { id: "order_confirmation", label: "Customer message templates", icon: "inbox" },
  { id: "improve", label: "Improve my website", icon: "trend" },
];

function AssistantCard({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [out, setOut] = useState<{ task: string; output: AssistOutput } | null>(null);
  const [history, setHistory] = useState<{ task: string; output: AssistOutput; created_at: string }[]>([]);
  const [busy, setBusy] = useState<AssistTask | null>(null);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<string>();
  const [copied, setCopied] = useState<number | null>(null);
  useEffect(() => { api.marketing(slug).then((r) => setHistory(r.items)).catch(() => {}); }, [slug]);

  async function run(task: AssistTask, request = "") {
    setBusy(task); setErr(undefined);
    try {
      const o = await api.assist(slug, task, request);
      setOut({ task, output: o });
      setHistory((h) => [{ task, output: o, created_at: new Date().toISOString() }, ...h]);
      if (task === "custom") setCustom("");
      onDone();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }
  const copy = (i: number, text: string) => navigator.clipboard?.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied(null), 1500); });

  return (
    <Card>
      <div id="assistant" className="scroll-mt-24" />
      <Eyebrow tone="saffron">Business assistant</Eyebrow>
      <p className="text-sm text-muted">Launch ke baad ka kaam — posts, offers, customer messages. Aapki website ki asli jaankari se likha jaata hai.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TASKS.map((t) => (
          <button key={t.id} onClick={() => run(t.id)} disabled={!!busy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-medium transition hover:border-plum-600 hover:text-plum-700 disabled:opacity-50">
            {busy === t.id ? <span className="size-3.5 animate-spin rounded-full border-2 border-plum-600 border-t-transparent" /> : <Icon name={t.icon} className="size-4" />}{t.label}</button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) run("custom", custom); }}>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={600} placeholder="Ya kuch aur maangiye — jaise “Diwali banner ka text”"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-[15px] focus:border-plum-600 focus:outline-none focus:ring-4 focus:ring-plum-100" />
        <Button type="submit" variant="secondary" loading={busy === "custom"} disabled={!custom.trim() || !!busy}>Likho</Button>
      </form>
      {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
      {busy && <div className="mt-3 space-y-2"><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /></div>}
      {out && !busy && (
        <div className="mt-4 animate-rise">
          <h4 className="font-display text-lg">{out.output.title}</h4>
          <ul className="mt-2 space-y-2">
            {out.output.items.map((it, i) => (
              <li key={i} className="group rounded-xl border border-line bg-ivory p-3">
                <div className="flex items-center gap-2"><b className="text-sm">{it.heading}</b>
                  <button onClick={() => copy(i, it.text)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-plum-700"><Icon name={copied === i ? "check" : "copy"} className="size-3.5" />{copied === i ? "Copied" : "Copy"}</button></div>
                <p className="mt-1 whitespace-pre-line text-sm text-ink/85">{it.text}</p>
              </li>
            ))}
          </ul>
          {out.output.tip && <p className="mt-2 text-xs text-muted">Tip: {out.output.tip}</p>}
        </div>
      )}
      {history.length > (out ? 1 : 0) && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-plum-700">Pehle banaya hua ({history.length - (out ? 1 : 0)})</summary>
          <ul className="mt-2 space-y-1">
            {history.slice(out ? 1 : 0, 10).map((h, i) => (
              <li key={i}><button onClick={() => setOut({ task: h.task, output: h.output })} className="w-full truncate rounded-lg px-2 py-1.5 text-left hover:bg-plum-50">{h.output.title}
                <span className="ml-2 text-xs text-muted">{new Date(h.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></button></li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

/* ---------- customer orders from the website (and AI agents) ---------- */
const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const STATUS_LABEL: Record<Order["status"], string> = { new: "Naya", confirmed: "Confirm", delivered: "Deliver ho gaya", cancelled: "Cancel" };

function OrdersCard({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const [data, setData] = useState<{ orders: Order[]; stats: OrderStats } | null>(null);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [confirmPay, setConfirmPay] = useState<number | null>(null);
  const load = useCallback(() => api.orders(slug).then(setData).catch((e) => setErr(e.message)), [slug]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  async function patch(o: Order, p: Partial<Pick<Order, "status" | "payment_status">>) {
    setBusy(o.id);
    try { const u = await api.updateOrder(slug, o.id, p); setData((d) => d && { ...d, orders: d.orders.map((x) => (x.id === o.id ? u : x)) }); load(); onChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  }
  const waConfirm = (o: Order) => {
    const phone = o.customer_phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1");
    const text = `Namaste ${o.customer_name} ji! Aapka order ${o.code} (${rupees(o.total)}) confirm ho gaya hai. Dhanyavaad!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <Card>
      <div className="flex items-end justify-between gap-3">
        <div><Eyebrow tone="leaf">Orders</Eyebrow><p className="font-display text-2xl">{data ? data.stats.count : "–"}</p></div>
        {data && data.stats.count > 0 && <div className="text-right text-xs text-muted">
          <p><b className="text-ink">{rupees(data.stats.order_value)}</b> kul orders</p>
          <p><b className="text-leaf">{rupees(data.stats.paid_total)}</b> payment mili</p></div>}
      </div>
      {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
      <ul className="mt-3 divide-y divide-line">
        {!data && !err && [0, 1].map((k) => <li key={k} className="skeleton my-2 h-14 rounded-xl" />)}
        {data?.orders.length === 0 && <li className="py-6 text-center text-sm text-muted">Abhi koi order nahi. Jab customer website par order karega, wo yahan aur aapke email par aayega.</li>}
        {data?.orders.slice(0, 12).map((o) => (
          <li key={o.id} className="py-3">
            <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>
              <b className="text-sm">{o.code}</b>
              <span className="truncate text-sm text-muted">{o.customer_name}</span>
              {o.channel === "agent" && <Pill tone="plum"><Icon name="bot" className="size-3" />AI agent</Pill>}
              <span className="ml-auto font-semibold">{rupees(o.total)}</span>
            </button>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${o.payment_status === "paid" ? "bg-leaf-50 text-leaf" : "bg-saffron-50 text-[#9A6420]"}`}>
                {o.payment_status === "paid" ? "Payment mili · aapne confirm kiya" : o.payment_method === "upi" ? "UPI payment pending" : "Cash on delivery · pending"}</span>
              <span className="rounded-full bg-cream px-2 py-0.5 text-muted">{STATUS_LABEL[o.status]}</span>
              <span className="ml-auto text-muted">{new Date(o.created_at.replace(" ", "T") + (o.created_at.includes("Z") ? "" : "Z")).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
            </div>
            {open === o.id && (
              <div className="mt-3 space-y-3 rounded-xl bg-cream/60 p-3 text-sm animate-rise">
                <ul className="space-y-0.5">{o.items.map((i, k) => <li key={k} className="flex justify-between gap-2"><span>{i.name}{i.unit ? ` (${i.unit})` : ""} × {i.qty}</span><span className="text-muted">{rupees(i.amount)}</span></li>)}</ul>
                <p className="text-xs text-muted">{o.customer_phone}{o.address ? ` · ${o.address}` : ""}{o.pincode ? ` · ${o.pincode}` : ""}</p>
                {o.payment_method === "upi" && o.payment_status === "pending" && <p className="text-xs text-muted">UPI payment seedha aapke account mein aata hai. Apne UPI app mein “Order {o.code}” check karke yahan mark kijiye.</p>}
                <div className="flex flex-wrap gap-2">
                  {o.payment_status === "pending" && confirmPay !== o.id && <Button variant="secondary" onClick={() => setConfirmPay(o.id)} icon="wallet">Payment mil gayi?</Button>}
                  {o.payment_status === "pending" && confirmPay === o.id && (
                    <div className="w-full rounded-xl border border-saffron/40 bg-saffron-50 p-3">
                      <p className="text-sm font-semibold">Kya aapne apne {o.payment_method === "upi" ? "UPI app / bank" : "haath"} mein {rupees(o.total)} aate hue dekha?</p>
                      <p className="mt-0.5 text-xs text-muted">Saheli payment khud verify nahi kar sakti — sirf aap confirm kar sakti hain.{o.payment_method === "upi" ? ` Note mein “Order ${o.code}” dhoondhiye.` : ""}</p>
                      <div className="mt-2 flex gap-2">
                        <Button loading={busy === o.id} onClick={async () => { await patch(o, { payment_status: "paid" }); setConfirmPay(null); }} icon="check">Haan, mil gayi</Button>
                        <Button variant="secondary" onClick={() => setConfirmPay(null)}>Abhi nahi</Button>
                      </div>
                    </div>
                  )}
                  {o.payment_status === "paid" && <button onClick={() => patch(o, { payment_status: "pending" })} className="text-xs font-semibold text-muted hover:text-rose">Galti se mark kiya? Wapas karein</button>}
                  {o.status === "new" && <a href={waConfirm(o)} target="_blank" rel="noopener" onClick={() => patch(o, { status: "confirmed" })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1E9E57] px-4 text-sm font-semibold text-white"><Icon name="whatsapp" className="size-4" />Confirm on WhatsApp</a>}
                  {(o.status === "new" || o.status === "confirmed") && <Button variant="secondary" loading={busy === o.id} onClick={() => patch(o, { status: "delivered" })} icon="check">Deliver ho gaya</Button>}
                  {o.status !== "cancelled" && o.status !== "delivered" && <button onClick={() => patch(o, { status: "cancelled" })} className="text-xs font-semibold text-muted hover:text-rose">Cancel</button>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
