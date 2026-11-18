import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type ApiError } from "../api";
import { compressImage } from "../lib/image";
import { speak, stopSpeaking, useVoiceInput } from "../lib/speech";
import { load, save, uid } from "../lib/storage";
import type { ActivityItem, BuildResult, ChatMessage, DomainOption, Entry, Lang, Profile, ToolEvent } from "../types";
import { ApprovalCard, ExecutionLog, CatalogReview, DomainCards, PlanCard, ProfileCard, SuccessCard } from "./Cards";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";
import { Notice } from "./ui";
import { tx } from "../lib/i18n";

const STEPS: Record<Lang, string[]> = { hi: ["Baat", "Profile", "Naam", "Manzoori", "Live"], en: ["Chat", "Profile", "Name", "Approve", "Live"] };
const QUICK: Record<Lang, string[]> = {
  hi: ["Main ghar par achaar banati hoon", "Meri home bakery hai", "Main mehendi artist hoon", "Main tuition padhati hoon", "Mera boutique hai"],
  en: ["I make pickles at home", "I run a home bakery", "I'm a mehendi artist", "I teach tuition classes", "I own a boutique"],
};
const greeting = (lang: Lang, name?: string | null) => lang === "hi"
  ? `Namaste${name ? ` ${name} ji` : ""}! Main Saheli hoon — aapki business saheli. Aapka hunar hum milkar duniya tak pahunchayenge: naam, website, orders, sab. Chaliye shuru karte hain — aap kya banati ya bechti hain?`
  : `Namaste${name ? ` ${name}` : ""}! I'm Saheli — your business partner. Together we'll take your work to the world: a name, a website, orders, everything. Let's begin — what do you make or sell?`;

const GREETING_ID = "greeting"; // its text follows the language switch

export const sessionKey = (userId: number) => `saheli.session.v3.${userId}`;
interface Session { entries: Entry[]; profile: Profile | null; }

/** Turns the agent's real tool calls into a readable log. Nothing is invented: labels are derived from
 *  the actual tool name, input and output returned by the backend. */
function activityFrom(events: ToolEvent[]): ActivityItem[] {
  const failedAt = (e: ToolEvent) => !!(e.output && (e.output.error || e.output.ok === false));
  return events.map((e, idx) => {
    const o = e.output ?? {}, i = e.input ?? {};
    const failed = failedAt(e);
    // recovery: the same tool succeeded later in this turn
    const recovered = failed && events.slice(idx + 1).some((x) => x.tool === e.tool && !failedAt(x));
    const raw = { input: i, output: o };
    const base = { tool: e.tool, failed: failed && !recovered, recovered, raw, error: failed ? String(o.error ?? "failed") : undefined };
    switch (e.tool) {
      case "save_business_profile": return { ...base, label: "Business profile saved", detail: [i.business_name, i.category, i.city].filter(Boolean).join(" · ") || undefined };
      case "suggest_domains": { const n = ((o as SuggestOutput).suggestions ?? []).length; return { ...base, tool: "suggest_domains → GoDaddy", label: "Searched GoDaddy for available names", detail: failed ? "GoDaddy didn't answer" : `${n} option${n === 1 ? "" : "s"} found` }; }
      case "check_domain": return { ...base, tool: "check_domain → GoDaddy", label: `Checked ${i.domain ?? "domain"}`, detail: failed ? "Check failed" : o.available ? "Available" : "Taken" };
      case "propose_website": return { ...base, checkpoint: !failed, label: failed ? "Website proposal rejected" : "Approval checkpoint — waiting for your yes", detail: failed ? String(o.error) : `${i.slug}.saheliai.com · free` };
      case "create_growth_plan": return { ...base, label: "Wrote a growth plan" };
      default: return { ...base, label: e.tool.replace(/_/g, " ") };
    }
  });
}

/** The build endpoint's real result, step by step (sitegen.build_site, then launch.verify). */
function buildActivity(site: BuildResult): ActivityItem[] {
  const v = site.verification;
  return [
    { tool: "sitegen.build_site", label: "Wrote content and built the website", detail: `${site.design.archetype} design · ${site.photos.count} photos`,
      raw: { design: site.design, photos: site.photos, integrations: site.integrations } },
    { tool: "publish", label: "Published to the free Saheli address", detail: site.url.replace(/^https?:\/\//, ""), raw: { url: site.url } },
    { tool: "launch.verify", label: v?.ok ? "Opened the live site and confirmed it works" : "Live check could not confirm the site",
      detail: v ? `${v.status ?? "no response"}${v.ms ? ` · ${v.ms} ms` : ""}` : "not run", failed: v ? !v.ok : true, error: v && !v.ok ? (v.error ?? `HTTP ${v.status}`) : undefined, raw: v ?? null },
  ];
}

/** Shapes of the GoDaddy tool outputs (backend godaddy.suggest_domains / check_availability). */
type Price = DomainOption["price"];
interface SuggestOutput { suggestions?: { domain: string; price?: Price }[] }
interface CheckOutput { domain?: string; available?: boolean; price?: Price; error?: string }

function domainsFrom(events: ToolEvent[]): DomainOption[] {
  const out: DomainOption[] = [];
  for (const e of events) {
    if (e.tool === "suggest_domains") for (const s of (e.output as SuggestOutput)?.suggestions ?? []) out.push({ domain: s.domain, available: true, price: s.price });
    const c = e.output as CheckOutput;
    if (e.tool === "check_domain" && c?.domain && !c.error) out.push({ domain: c.domain, available: !!c.available, price: c.price });
  }
  const seen = new Set<string>();
  return out.filter((d) => d.domain && !seen.has(d.domain) && seen.add(d.domain));
}

export function Chat({ lang, onDashboard, resetKey, userId, userName, isAdmin = false }: { lang: Lang; onDashboard: () => void; resetKey: number; userId: number; userName?: string | null; isAdmin?: boolean }) {
  const KEY = sessionKey(userId); // each user's conversation is kept separately on this device
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey is the signal to re-read the saved session
  const initial = useMemo(() => load<Session>(KEY, { entries: [], profile: null }), [resetKey, KEY]);
  const [entries, setEntries] = useState<Entry[]>(initial.entries.length ? initial.entries : [{ kind: "msg", id: GREETING_ID, role: "assistant", content: greeting(lang, userName) }]);
  const [profile, setProfile] = useState<Profile | null>(initial.profile);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<false | "thinking" | "photos">(false);
  const viaVoice = useRef(false);            // last message was spoken -> Saheli answers aloud
  const [speaking, setSpeaking] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [buildError, setBuildError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; save(KEY, { entries, profile }); }, [entries, profile, KEY]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [entries.length, busy]);

  const history = (list: Entry[]): ChatMessage[] => {
    const msgs = list.filter((e): e is Extract<Entry, { kind: "msg" }> => e.kind === "msg").map((e) => ({ role: e.role, content: e.content }));
    while (msgs.length && msgs[0].role === "assistant") msgs.shift(); // API conversation starts with the user
    return msgs;
  };

  /** Sends the conversation so far to Saheli. Used for new messages and for "Dobara bhejiye" after a failure. */
  const run = useCallback(async (next: Entry[], extraProfile?: Profile | null) => {
    setBusy("thinking");
    try {
      const res = await api.chat(history(next), extraProfile ?? profile, lang);
      const add: Entry[] = [];
      const acts = activityFrom(res.events ?? []);
      if (acts.length) add.push({ kind: "activity", id: uid(), items: acts });
      if (res.reply) add.push({ kind: "msg", id: uid(), role: "assistant", content: res.reply });
      if (res.reply && viaVoice.current && speak(res.reply, lang, () => setSpeaking(false))) setSpeaking(true);
      viaVoice.current = false;
      const doms = domainsFrom(res.events ?? []);
      if (doms.length) add.push({ kind: "domains", id: uid(), domains: doms });
      // her details are shown once, right before she approves the website — not in the middle of the conversation
      if (res.approval) add.push({ kind: "profile", id: uid(), profile: res.profile ?? profile ?? {} }, { kind: "approval", id: uid(), approval: res.approval, status: "pending" });
      if (res.growth_plan) add.push({ kind: "plan", id: uid(), plan: res.growth_plan });
      if (res.profile) setProfile(res.profile);
      setEntries((cur) => [...cur, ...add]);
    } catch (err) {
      const e = err as ApiError;
      setEntries((cur) => [...cur, { kind: "error", id: uid(), message: e.message, retry: e.retryable === false ? undefined : "chat", code: e.code, requestId: e.requestId }]);
    } finally {
      setBusy(false);
    }
  }, [profile, lang]);

  const send = useCallback(async (text: string, extraProfile?: Profile | null) => {
    const content = text.trim();
    if (!content || busy) return;
    const userEntry: Entry = { kind: "msg", id: uid(), role: "user", content };
    const next: Entry[] = [...entriesRef.current.filter((e) => e.kind !== "error"), userEntry];
    entriesRef.current = next;
    // functional update: keeps changes made just before sending (e.g. a card marked confirmed/done)
    setEntries((cur) => [...cur.filter((e) => e.kind !== "error"), userEntry]);
    setInput("");
    await run(next, extraProfile);
  }, [busy, run]);

  /** Retry the last turn without repeating her message. */
  const retry = useCallback(() => {
    if (busy) return;
    const next = entriesRef.current.filter((e) => e.kind !== "error");
    entriesRef.current = next;
    setEntries((cur) => cur.filter((e) => e.kind !== "error"));
    run(next);
  }, [busy, run]);

  const voice = useVoiceInput(lang, useCallback((t: string) => { viaVoice.current = true; send(t); }, [send]));
  const startListening = () => { stopSpeaking(); setSpeaking(false); voice.start(); };
  const allActivity = entries.flatMap((e) => (e.kind === "activity" ? e.items : []));

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 8);
    setBusy("photos");
    try {
      const images = await Promise.all(list.map((f) => compressImage(f)));
      const up = await api.uploadPhotos(images);
      const ctx = [profile?.category, profile?.business_name, profile?.city].filter(Boolean).join(", ");
      const res = await api.analyze(up.photo_ids, ctx);
      if (!res.items.length) throw new Error("Photos mein koi product nahi dikha. Product ko roshni mein, paas se kheenchiye.");
      setEntries((cur) => [...cur, { kind: "catalog", id: uid(), items: res.items }]);
      if (up.errors.length) setEntries((cur) => [...cur, { kind: "error", id: uid(), message: `${up.errors.length} photo nahi chal paayi: ${up.errors[0].error}` }]);
    } catch (err) {
      setEntries((cur) => [...cur, { kind: "error", id: uid(), message: (err as Error).message }]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function catalogDone(entryId: string, rows: { name: string; price_inr?: number; unit?: string; photo_id: string; category: string }[]) {
    const existing = profile?.products ?? [];
    const merged: Profile = { ...(profile ?? {}), products: [...existing.filter((p) => !rows.some((r) => r.name.toLowerCase() === p.name.toLowerCase())), ...rows] };
    setProfile(merged);
    setEntries((cur) => cur.map((e) => (e.id === entryId && e.kind === "catalog" ? { ...e, done: true } : e)));
    const summary = tx(lang, "Maine photos se ye products add kiye hain: ", "I added these products from photos: ") + rows.map((r) => `${r.name}${r.unit ? ` (${r.unit})` : ""} — ₹${r.price_inr}`).join("; ") + ".";
    send(summary, merged);
  }

  async function approve(entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.kind !== "approval" || !profile) return;
    setBuildError(undefined);
    setEntries((cur) => cur.map((e) => (e.id === entryId && e.kind === "approval" ? { ...e, status: "building" } : e)));
    try {
      const site = await api.build(entry.approval.slug, profile);
      setEntries((cur) => [...cur.map((e) => (e.id === entryId && e.kind === "approval" ? { ...e, status: "done" as const } : e)),
        { kind: "activity", id: uid(), items: buildActivity(site) },
        { kind: "site", id: uid(), site },
        { kind: "msg", id: uid(), role: "assistant", content: tx(lang,
          `Aapki website live ho gayi! ${site.content.business_name} ab poori duniya ke liye khuli hai. Chaliye, ab customers tak pahunchte hain — link apne WhatsApp contacts aur status par bhejiye. Kuch badalna ho to Dashboard se bas bol dijiye.`,
          `Your website is live! ${site.content.business_name} is now open to the world. Let's reach customers — share the link with your WhatsApp contacts and status. To change anything, just tell the Dashboard.`) }]);
    } catch (err) {
      setBuildError((err as Error).message);
      setEntries((cur) => cur.map((e) => (e.id === entryId && e.kind === "approval" ? { ...e, status: "pending" } : e)));
    }
  }

  const step = useMemo(() => {
    const has = (k: Entry["kind"]) => entries.some((e) => e.kind === k);
    if (has("site")) return 5;
    if (has("approval")) return 3;
    if (has("domains")) return 2;
    if (profile) return 1;
    return 0;
  }, [entries, profile]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* progress */}
      <div className="border-b border-line bg-ivory/90 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
        <ol className="flex min-w-0 flex-1 items-center gap-1.5" aria-label="Progress">
          {STEPS[lang].map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-1.5">
              <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition
                ${i < step ? "bg-leaf text-white" : i === step ? "bg-plum-700 text-white" : "bg-sand text-muted"}`}>{i < step ? "✓" : i + 1}</span>
              <span className={`hidden truncate text-xs sm:inline ${i === step ? "font-semibold text-plum-700" : "text-muted"}`}>{s}</span>
              {i < STEPS[lang].length - 1 && <span className={`h-px flex-1 ${i < step ? "bg-leaf" : "bg-line"}`} />}
            </li>
          ))}
        </ol>
        <button onClick={() => setLogOpen(true)} className="shrink-0 rounded-lg border border-line bg-white px-2 py-1 font-mono text-[10.5px] text-muted hover:text-plum-700" title="Developer execution log">log · {allActivity.length}</button>
        </div>
      </div>

      {/* timeline */}
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5">
        <div className="mx-auto flex min-w-0 max-w-2xl flex-col gap-3">
          {entries.map((e) => {
            switch (e.kind) {
              case "msg":
                return e.role === "assistant" ? (
                  <div key={e.id} className="animate-rise flex items-end gap-2">
                    <LogoMark size={32} />
                    <div className="min-w-0 max-w-[85%] break-words rounded-2xl rounded-bl-md border border-line bg-white px-4 py-2.5 text-[15.5px] leading-relaxed shadow-card">
                      <Rich text={e.id === GREETING_ID ? greeting(lang, userName) : e.content} />
                    </div>
                    <button onClick={() => speak(e.id === GREETING_ID ? greeting(lang, userName) : e.content, lang)} aria-label="Sunao" className="mb-1 rounded-full p-1.5 text-muted transition hover:bg-plum-50 hover:text-plum-700"><Icon name="speaker" className="size-4" /></button>
                  </div>
                ) : (
                  <div key={e.id} className="animate-rise ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-plum-700 px-4 py-2.5 text-[15.5px] leading-relaxed text-ivory">{e.content}</div>
                );
              case "profile": return <ProfileCard key={e.id} profile={e.profile} compact lang={lang} />;
              case "domains": return <DomainCards key={e.id} lang={lang} domains={e.domains} onPick={(d) => send(lang === "hi" ? `Mujhe ${d} pasand hai` : `I like ${d}`)} />;
              case "catalog": return <CatalogReview key={e.id} lang={lang} items={e.items} done={e.done} onDone={(rows) => catalogDone(e.id, rows)} />;
              case "approval": return <ApprovalCard key={e.id} lang={lang} approval={e.approval} status={e.status} error={e.status === "pending" ? buildError : undefined}
                onApprove={() => approve(e.id)} onDecline={() => { setEntries((cur) => cur.map((x) => (x.id === e.id && x.kind === "approval" ? { ...x, status: "declined" } : x))); send(lang === "hi" ? "Mujhe koi doosra naam chahiye" : "I'd like a different name"); }} />;
              case "site": return <SuccessCard key={e.id} lang={lang} site={e.site} onDashboard={onDashboard} />;
              case "activity": return null; // tool calls stay in the "log" panel, not in her conversation
              case "plan": return <PlanCard key={e.id} plan={e.plan} />;
              case "error": return (
                <div key={e.id} className="animate-rise" role="alert">
                  <Notice tone="error">
                    <span className="block">{e.message}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-3">
                      {e.retry && <button onClick={retry} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-plum-700 shadow-card"><Icon name="refresh" className="size-4" />{tx(lang, "Dobara bhejiye", "Try again")}</button>}
                      {e.requestId && <span className="font-mono text-[11px] text-muted">ref {e.requestId}</span>}
                    </span>
                  </Notice>
                </div>);
            }
          })}

          {entries.length === 1 && (
            <div className="animate-rise flex flex-wrap gap-2 pl-10">
              {QUICK[lang].map((q) => <button key={q} onClick={() => send(q)} className="rounded-full border border-plum-600/30 bg-white px-3.5 py-2 text-sm font-medium text-plum-700 transition hover:bg-plum-50">{q}</button>)}
            </div>
          )}

          {busy && (
            <div className="animate-rise flex items-end gap-2">
              <LogoMark size={32} />
              <div className="rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 shadow-card">
                {busy === "photos" ? <span className="text-sm text-muted">{lang === "hi" ? "Aapke products dekh rahi hoon…" : "Looking at your photos…"}</span> :
                  <span className="flex items-center gap-2.5 text-sm text-muted" role="status"><span className="flex gap-1">{[0, 1, 2].map((k) => <span key={k} className="size-2 animate-bounce rounded-full bg-plum-600/60" style={{ animationDelay: `${k * 0.15}s` }} />)}</span>{lang === "hi" ? "Samajh rahi hoon…" : "Thinking…"}</span>}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      {/* speaking state */}
      {speaking && !voice.listening && (
        <div className="animate-rise border-t border-line bg-plum-50 px-4 py-3" role="status">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <LogoMark size={32} />
            <div className="hidden h-4 items-center gap-1 sm:flex" aria-hidden="true">{Array.from({ length: 10 }).map((_, k) => <span key={k} className="h-full w-1 origin-center animate-bar rounded-full bg-plum-600/70" style={{ animationDelay: `${(k % 5) * 0.11}s` }} />)}</div>
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-plum-700">{lang === "hi" ? "Saheli bol rahi hai…" : "Saheli is speaking…"}</p>
            <button onClick={() => { stopSpeaking(); setSpeaking(false); }} className="shrink-0 whitespace-nowrap rounded-xl border border-plum-100 bg-white px-3 py-1.5 text-sm font-semibold text-plum-700">{lang === "hi" ? "Roko" : "Stop"}</button>
            <button onClick={startListening} className="shrink-0 whitespace-nowrap rounded-xl bg-plum-700 px-3 py-1.5 text-sm font-semibold text-ivory">{lang === "hi" ? "Jawab boliye" : "Reply"}</button>
          </div>
        </div>
      )}

      {/* developer execution log: every real tool call this session, with raw input/output */}
      {logOpen && <ExecutionLog items={allActivity} onClose={() => setLogOpen(false)} isAdmin={isAdmin} />}

      {/* listening overlay */}
      {voice.listening && (
        <div className="animate-rise border-t border-line bg-white px-4 py-4">
          <div className="mx-auto flex max-w-2xl items-center gap-4">
            <div className="relative grid size-14 shrink-0 place-items-center">
              <span className="absolute inset-0 animate-ring rounded-full bg-rose/30" />
              <span className="absolute inset-0 animate-ring rounded-full bg-rose/20 [animation-delay:.6s]" />
              <span className="relative grid size-14 place-items-center rounded-full bg-rose text-white"><Icon name="mic" className="size-6" /></span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex h-5 items-center gap-1" aria-hidden="true">{Array.from({ length: 14 }).map((_, k) => <span key={k} className="h-full w-1 origin-center animate-bar rounded-full bg-rose/70" style={{ animationDelay: `${(k % 7) * 0.09}s` }} />)}</div>
              <p className="mt-1 truncate text-[15px]">{voice.interim || (lang === "hi" ? "Sun rahi hoon… boliye" : "Listening… go ahead")}</p>
            </div>
            <button onClick={voice.stop} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold">{lang === "hi" ? "Ho gaya" : "Done"}</button>
          </div>
        </div>
      )}

      {/* composer */}
      <div className="border-t border-line bg-ivory px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        {voice.error && <div className="mx-auto mb-2 max-w-2xl"><Notice tone="warn">{voice.error}</Notice></div>}
        <form className="mx-auto flex max-w-2xl items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); viaVoice.current = false; send(input); }}>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(ev) => onPhotos(ev.target.files)} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} aria-label="Product photos"
            className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-white text-plum-700 transition hover:bg-plum-50 disabled:opacity-50"><Icon name="camera" /></button>
          <div className="flex min-h-12 flex-1 items-center rounded-2xl border border-line bg-white px-3 focus-within:border-plum-600 focus-within:ring-4 focus-within:ring-plum-100">
            <textarea rows={1} value={input} onChange={(ev) => setInput(ev.target.value)} placeholder={lang === "hi" ? "Likhiye, ya mic dabakar boliye…" : "Type, or tap the mic to speak…"}
              onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); viaVoice.current = false; send(input); } }}
              className="max-h-32 w-full resize-none bg-transparent py-3 text-[15.5px] placeholder:text-muted/80 focus:outline-none" />
            {input.trim() && <button type="submit" disabled={!!busy} aria-label="Bhejo" className="ml-1 grid size-9 shrink-0 place-items-center rounded-xl bg-plum-700 text-ivory disabled:opacity-50"><Icon name="send" className="size-4" /></button>}
          </div>
          <button type="button" onClick={voice.listening ? voice.stop : startListening} disabled={!!busy} aria-label={lang === "hi" ? "Bol kar likhiye" : "Speak"}
            className={`grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-lift transition disabled:opacity-50 ${voice.listening ? "bg-rose" : "bg-plum-700 hover:bg-plum-800"}`}><Icon name="mic" /></button>
        </form>
      </div>
    </div>
  );
}

/** Renders **bold** safely (no HTML injection). */
function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold">{part}</strong> : <span key={i} className="whitespace-pre-wrap">{part}</span>))}</>;
}
