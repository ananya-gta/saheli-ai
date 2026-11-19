import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { api, type AdminStats } from "../api";
import { Icon } from "./Icon";
import { Notice } from "./ui";

const USAGE_LABEL: Record<string, string> = {
  chat: "Chat", build: "Websites built", edit: "Site edits", photos: "Photo uploads", assist: "AI assistant", voice: "Voice replies",
};
/* One hue, dark -> light (Saheli plum): this week / the biggest share always the darkest. */
const SHADE = ["#5B1F4A", "#8A3F72", "#B97BA3", "#E3C9DA"];
const LAST_WEEK = "#E3C9DA";
type Day = { day: string; events: number; users: number };

/** Server times are UTC ("YYYY-MM-DD HH:MM:SS"); show them in local time. */
const toDate = (ts: string) => new Date(ts.replace(" ", "T") + (ts.length > 10 ? "Z" : "T00:00:00Z"));
function when(ts: string | null): string {
  if (!ts) return "—";
  const d = toDate(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
const shortDay = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const weekday = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const recent = (ts: string | null, days = 7) => !!ts && Date.now() - toDate(ts).getTime() < days * 864e5;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const initials = (name: string | null, email: string) => (name || email).trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** The last 14 UTC days (zero-activity days filled in), split into last week and this week. */
function weeks(daily: AdminStats["daily"]): { prev: Day[]; cur: Day[] } {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const all: Day[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    all.push(byDay.get(day) ?? { day, events: 0, users: 0 });
  }
  return { prev: all.slice(0, 7), cur: all.slice(7) };
}

/** A round axis maximum (1, 2, 5 × 10^n) so gridlines land on readable numbers. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

function Change({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-xs text-muted">{now ? "first week of data" : "no activity yet"}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className="text-xs text-muted">
      <b className={up ? "text-leaf" : "text-rose"}>{up ? "↑" : "↓"} {Math.abs(pct)}%</b> vs last week
    </span>
  );
}

function Panel({ id, title, sub, right, children, className = "" }: { id?: string; title: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-[15px] font-semibold">{title}</h2>{sub && <p className="text-[13px] text-muted">{sub}</p>}</div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: c }} />{l}</span>)}
    </div>
  );
}

function Tip({ at, children }: { at: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-plum-800 px-2.5 py-1.5 text-xs text-white shadow-lift"
      style={{ left: `calc(36px + (100% - 36px) * ${at})` }}>{children}</div>
  );
}

function Grid({ max }: { max: number }) {
  return (
    <>
      {[1, 0.5, 0].map((f) => (
        <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${f * 100}%`, transform: "translateY(50%)" }}>
          <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-muted">{Math.round(max * f)}</span>
          <span className={`flex-1 ${f === 0 ? "h-px bg-[#CDBFB0]" : "border-t border-dashed border-line"}`} />
        </div>
      ))}
    </>
  );
}

/** Paired columns: this week (dark) next to the same weekday last week (light). */
function PairedBars({ prev, cur }: { prev: Day[]; cur: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...cur.map((d) => d.events), ...prev.map((d) => d.events)));
  const h = (v: number) => (v ? `${Math.max(2, (v / max) * 100)}%` : "0");
  return (
    <div className="relative">
      <div className="relative h-44">
        <Grid max={max} />
        <div className="absolute inset-y-0 left-9 right-0 flex items-end" onMouseLeave={() => setHover(null)}>
          {cur.map((d, i) => (
            <button key={d.day} type="button" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)}
              aria-label={`${weekday(d.day)}: ${d.events} actions this week, ${prev[i].events} last week`}
              className={`flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-md ${hover === i ? "bg-plum-50/60" : ""}`}>
              <span className="block w-2.5 rounded-t-[4px] bg-gradient-to-t from-plum-700 to-[#8A3F72] sm:w-3.5" style={{ height: h(d.events) }} />
              <span className="block w-2.5 rounded-t-[4px] sm:w-3.5" style={{ height: h(prev[i].events), background: LAST_WEEK }} />
            </button>
          ))}
        </div>
      </div>
      <div className="ml-9 mt-1.5 flex text-[11px] text-muted">{cur.map((d) => <span key={d.day} className="flex-1 text-center">{weekday(d.day)}</span>)}</div>
      {hover !== null && (
        <Tip at={(hover + 0.5) / cur.length}>
          <b className="block">{weekday(cur[hover].day)} · {shortDay(cur[hover].day)}</b>
          <span className="block tabular-nums">This week: {cur[hover].events}</span>
          <span className="block tabular-nums opacity-80">Last week: {prev[hover].events}</span>
        </Tip>
      )}
      <Legend items={[[SHADE[0], "This week"], [LAST_WEEK, "Last week"]]} />
    </div>
  );
}

/** Two lines: active people per day, this week vs last week. */
function Lines({ prev, cur }: { prev: Day[]; cur: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...cur.map((d) => d.users), ...prev.map((d) => d.users)));
  const x = (i: number) => ((i + 0.5) / cur.length) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  const path = (ds: Day[]) => ds.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.users)}`).join(" ");
  return (
    <div className="relative">
      <div className="relative h-44">
        <Grid max={max} />
        <div className="absolute inset-y-0 left-9 right-0">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs><linearGradient id="adm-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7A2E63" stopOpacity=".22" /><stop offset="1" stopColor="#7A2E63" stopOpacity="0" /></linearGradient></defs>
            <path d={`${path(cur)} L${x(cur.length - 1)},100 L${x(0)},100 Z`} fill="url(#adm-area)" />
            <path d={path(prev)} fill="none" stroke={LAST_WEEK} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path d={path(cur)} fill="none" stroke={SHADE[0]} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          {hover !== null && <span className="absolute inset-y-0 w-px bg-plum-100" style={{ left: `${x(hover)}%` }} />}
          {cur.map((d, i) => (
            <span key={d.day} className={`absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-plum-700 ${hover === i ? "scale-125" : ""}`}
              style={{ left: `${x(i)}%`, bottom: `${100 - y(d.users)}%` }} />
          ))}
          <div className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
            {cur.map((d, i) => (
              <button key={d.day} type="button" className="h-full flex-1" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)}
                aria-label={`${weekday(d.day)}: ${d.users} active this week, ${prev[i].users} last week`} />
            ))}
          </div>
        </div>
      </div>
      <div className="ml-9 mt-1.5 flex text-[11px] text-muted">{cur.map((d) => <span key={d.day} className="flex-1 text-center">{weekday(d.day)}</span>)}</div>
      {hover !== null && (
        <Tip at={(hover + 0.5) / cur.length}>
          <b className="block">{weekday(cur[hover].day)} · {shortDay(cur[hover].day)}</b>
          <span className="block tabular-nums">This week: {cur[hover].users} active</span>
          <span className="block tabular-nums opacity-80">Last week: {prev[hover].users} active</span>
        </Tip>
      )}
      <Legend items={[[SHADE[0], "This week"], [LAST_WEEK, "Last week"]]} />
    </div>
  );
}

/** Donut of feature usage (top 3 + Other), a 2px gap between slices; the centre names the hovered slice. */
function Donut({ usage }: { usage: AdminStats["usage"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = Object.entries(usage).map(([k, v]) => ({ label: USAGE_LABEL[k] ?? k, value: v.last_7d })).sort((a, b) => b.value - a.value);
  const slices = [...sorted.slice(0, 3), { label: "Other", value: sum(sorted.slice(3).map((s) => s.value)) }].filter((s) => s.value > 0);
  const total = sum(slices.map((s) => s.value));
  const R = 42, C = 2 * Math.PI * R, GAP = slices.length > 1 ? 1.2 : 0;
  let offset = 0;
  const focus = hover === null ? null : slices[hover];
  return (
    <div>
      <div className="relative mx-auto size-44">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#F6EEF3" strokeWidth="14" />
          {total > 0 && slices.map((s, i) => {
            const len = (s.value / total) * C;
            const el = (
              <circle key={s.label} cx="50" cy="50" r={R} fill="none" stroke={SHADE[i]} strokeWidth={hover === i ? 16 : 14}
                strokeDasharray={`${Math.max(0, len - GAP)} ${C}`} strokeDashoffset={-offset} className="cursor-pointer transition-[stroke-width]"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)} />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <b className="block font-display text-3xl leading-none tabular-nums">{focus ? focus.value : total}</b>
            <span className="mt-1 block max-w-24 text-xs text-muted">{focus ? focus.label : "actions this week"}</span>
          </div>
        </div>
      </div>
      {total === 0 ? <p className="mt-3 text-center text-sm text-muted">No activity this week yet.</p> : (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {slices.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: SHADE[i] }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <b className="tabular-nums">{Math.round((s.value / total) * 100)}%</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Funnel: each step a gradient bar, with its share of everyone who signed up. */
function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ul className="space-y-4">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between text-sm"><span>{s.label}</span><span><b className="tabular-nums">{s.value}</b>{i > 0 && <span className="ml-1.5 text-xs text-muted">{Math.round((s.value / top) * 100)}%</span>}</span></div>
          <div className="mt-1.5 h-3 rounded-full bg-plum-50">
            <div className="h-3 rounded-full bg-gradient-to-r from-plum-700 to-[#B97BA3]" style={{ width: `${(s.value / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const NAV = [["overview", "Overview", "grid"], ["activity", "Activity", "trend"], ["users", "Users", "user"], ["websites", "Websites", "globe"], ["messages", "Messages", "inbox"]] as const;

/** Platform owner's dashboard: users, sites, orders and feature usage. Only ADMIN_EMAILS can load it. */
export function Admin() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.adminStats()); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const { prev, cur } = useMemo(() => weeks(data?.daily ?? []), [data]);
  const users = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.users ?? []).filter((u) => !q || u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q));
  }, [data, query]);
  const topSites = useMemo(() => [...(data?.sites ?? [])].sort((a, b) => b.orders + b.enquiries - (a.orders + a.enquiries)).slice(0, 5), [data]);
  const t = data?.totals;
  const jump = (id: string) => document.getElementById(`adm-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="flex min-h-[calc(100dvh-64px)] bg-[#FBF8F4]">
      <aside className="sticky top-16 hidden h-[calc(100dvh-64px)] w-56 shrink-0 flex-col border-r border-line bg-gradient-to-b from-plum-50 to-[#FBF1E8] px-3 py-6 lg:flex">
        <span className="px-3 text-[11px] font-semibold uppercase tracking-widest text-muted">Admin</span>
        <nav className="mt-2 space-y-0.5">
          {NAV.map(([id, label, icon], i) => (
            <button key={id} onClick={() => jump(id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${i === 0 ? "bg-white font-semibold text-plum-700 shadow-card" : "text-muted hover:bg-white/70 hover:text-plum-700"}`}>
              <Icon name={icon} className="size-4" />{label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-plum-700 to-[#8A3F72] p-4 text-white">
          <b className="block text-sm">Saheli analytics</b>
          <span className="mt-1 block text-xs text-white/80">Counts only. No chat text is stored.</span>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div id="adm-overview" className="mb-6 flex scroll-mt-20 flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl">Dashboard</h1>
            <p className="text-sm text-muted">{cur.length ? `This week: ${shortDay(cur[0].day)} – ${shortDay(cur[cur.length - 1].day)}` : ""}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 sm:w-64 sm:flex-none">
              <svg viewBox="0 0 24 24" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <input value={query} onChange={(e) => { setQuery(e.target.value); if (e.target.value) jump("users"); }} placeholder="Search users" aria-label="Search users" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <button onClick={load} disabled={loading} className="grid size-10 place-items-center rounded-xl border border-line bg-white text-plum-700 hover:bg-plum-50" aria-label="Refresh">
              <Icon name="refresh" className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
          {NAV.map(([id, label]) => <button key={id} onClick={() => jump(id)} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-muted">{label}</button>)}
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        {!data && !error && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((k) => <div key={k} className="skeleton h-32 rounded-2xl" />)}</div>}

        {data && t && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="col-span-2 rounded-2xl bg-gradient-to-br from-plum-800 via-plum-700 to-[#9A4A80] p-4 text-white shadow-lift sm:col-span-1">
                <span className="flex items-center justify-between text-[13px] text-white/80">Users<Icon name="user" className="size-4" /></span>
                <b className="mt-2 block font-display text-4xl leading-none tabular-nums">{t.users}</b>
                <span className="mt-2 block text-xs text-white/85"><b className="text-white">+{t.users_new_7d}</b> new this week · {t.users_active_7d} active</span>
              </div>
              {([
                ["globe", "Websites live", t.sites, <><b className="text-leaf">+{t.sites_new_7d}</b> new this week</>, "from-leaf-50"],
                ["bag", "Orders", t.orders, <>{inr(t.order_value)} total value</>, "from-saffron-50"],
                ["inbox", "Enquiries", t.enquiries, <>{t.contact_messages} contact messages</>, "from-[#FCEFF1]"],
              ] as const).map(([icon, label, value, foot, from]) => (
                <div key={label} className={`rounded-2xl border border-line bg-gradient-to-br ${from} to-white p-4 shadow-card`}>
                  <span className="flex items-center justify-between text-[13px] text-muted">{label}<Icon name={icon} className="size-4 text-plum-700" /></span>
                  <b className="mt-2 block font-display text-4xl leading-none tabular-nums">{value}</b>
                  <span className="mt-2 block text-xs text-muted">{foot}</span>
                </div>
              ))}
            </div>

            <div id="adm-activity" className="grid scroll-mt-20 gap-4 xl:grid-cols-3">
              <Panel title="Actions" className="xl:col-span-2"
                sub="Chats, builds, edits, uploads, assistant and voice">
                <div className="-mt-1 mb-4 flex items-baseline gap-3"><b className="font-display text-3xl tabular-nums">{sum(cur.map((d) => d.events))}</b><Change now={sum(cur.map((d) => d.events))} before={sum(prev.map((d) => d.events))} /></div>
                <PairedBars prev={prev} cur={cur} />
              </Panel>
              <Panel title="Feature mix" sub="Share of actions, last 7 days"><Donut usage={data.usage} /></Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Growth funnel" sub="How far users get"><Funnel steps={[
                { label: "Signed up", value: t.users }, { label: "Built a website", value: t.users_with_site }, { label: "Received an order", value: t.users_with_order },
              ]} /></Panel>
              <Panel title="Top websites" sub="Most orders and enquiries">
                {topSites.length === 0 ? <p className="text-sm text-muted">No websites yet.</p> : (
                  <ul className="divide-y divide-line/70">
                    {topSites.map((s) => (
                      <li key={s.slug} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-plum-100 to-saffron-50 text-xs font-bold text-plum-700">{s.slug.slice(0, 2).toUpperCase()}</span>
                        <a href={`https://${s.slug}.saheliai.com`} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-medium hover:text-plum-700 hover:underline">{s.slug}</a>
                        <span className="shrink-0 text-right text-xs text-muted"><b className="text-ink">{s.orders}</b> orders · {s.enquiries} enq.</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Active people" sub="Per day, this week vs last week">
                <div className="-mt-1 mb-4 flex items-baseline gap-3"><b className="font-display text-3xl tabular-nums">{t.users_active_7d}</b><span className="text-xs text-muted">active this week</span></div>
                <Lines prev={prev} cur={cur} />
              </Panel>
            </div>

            <Panel id="adm-users" title={`Users · ${users.length}`} sub={query ? `Matching “${query}”` : "Most recently active first"} className="!p-0 [&>div:first-child]:px-4 [&>div:first-child]:pt-4 sm:[&>div:first-child]:px-5 sm:[&>div:first-child]:pt-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead><tr className="border-y border-line bg-[#FBF8F4] text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-5 py-2 font-semibold">User</th><th className="py-2 text-right font-semibold">Sites</th><th className="py-2 text-right font-semibold">Chats</th>
                    <th className="py-2 text-right font-semibold">Orders</th><th className="py-2 pl-5 font-semibold">Joined</th><th className="py-2 pl-4 pr-5 font-semibold">Last active</th></tr></thead>
                  <tbody>
                    {users.map((u) => {
                      const last = u.last_active ?? u.last_login_at;
                      return (
                        <tr key={u.id} className="border-t border-line/60 hover:bg-plum-50/40">
                          <td className="max-w-[260px] px-5 py-2.5">
                            <span className="flex items-center gap-3">
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-plum-100 to-saffron-50 text-xs font-semibold text-plum-700">{initials(u.name, u.email)}</span>
                              <span className="min-w-0"><b className="block truncate font-semibold">{u.name || "—"}</b><span className="block truncate text-xs text-muted">{u.email}</span></span>
                            </span>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{u.sites}</td>
                          <td className="py-2.5 text-right tabular-nums">{u.chats}</td>
                          <td className="py-2.5 text-right tabular-nums">{u.orders}</td>
                          <td className="whitespace-nowrap py-2.5 pl-5 text-muted">{when(u.created_at)}</td>
                          <td className="whitespace-nowrap py-2.5 pl-4 pr-5">
                            {recent(last) ? <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-2 py-0.5 text-xs font-medium text-leaf"><span className="size-1.5 rounded-full bg-leaf" />{when(last)}</span>
                              : <span className="text-muted">{when(last)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {users.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-muted">No users match.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-5">
              <Panel id="adm-websites" title={`Websites · ${data.sites.length}`} sub="Newest first" className="xl:col-span-3 !p-0 [&>div:first-child]:px-4 [&>div:first-child]:pt-4 sm:[&>div:first-child]:px-5 sm:[&>div:first-child]:pt-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead><tr className="border-y border-line bg-[#FBF8F4] text-left text-[11px] uppercase tracking-wider text-muted">
                      <th className="px-5 py-2 font-semibold">Site</th><th className="py-2 text-right font-semibold">Orders</th><th className="py-2 text-right font-semibold">Enquiries</th><th className="py-2 pl-5 pr-5 font-semibold">Created</th></tr></thead>
                    <tbody>
                      {data.sites.map((s) => (
                        <tr key={s.slug} className="border-t border-line/60 hover:bg-plum-50/40">
                          <td className="max-w-[240px] px-5 py-2.5">
                            <a href={`https://${s.slug}.saheliai.com`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-plum-700 hover:underline">{s.slug}<Icon name="external" className="size-3.5" /></a>
                            <span className="block truncate text-xs text-muted">{s.owner}</span>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{s.orders}</td>
                          <td className="py-2.5 text-right tabular-nums">{s.enquiries}</td>
                          <td className="whitespace-nowrap py-2.5 pl-5 pr-5 text-muted">{when(s.created_at)}</td>
                        </tr>
                      ))}
                      {data.sites.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-muted">No websites yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel id="adm-messages" title="Contact messages" sub={`Latest ${data.messages.length}`} className="xl:col-span-2">
                {data.messages.length === 0 ? <p className="text-sm text-muted">No messages yet.</p> : (
                  <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {data.messages.map((m, i) => (
                      <li key={i} className="rounded-xl border border-line/70 bg-[#FBF8F4] p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0"><b className="block truncate">{m.name}</b><a href={`mailto:${m.email}`} className="block truncate text-xs text-plum-700 hover:underline">{m.email}</a></span>
                          <span className="shrink-0 text-right text-xs text-muted">{when(m.received_at)}{m.topic && <span className="mt-1 block rounded-md bg-white px-1.5 py-0.5 text-ink">{m.topic}</span>}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-line break-words">{m.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
