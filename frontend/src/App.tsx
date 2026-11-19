import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Chat, sessionKey } from "./components/Chat";
import { Dashboard } from "./components/Dashboard";
import { Icon } from "./components/Icon";
import { Login } from "./components/Login";
import { Landing } from "./components/Landing";
import { Logo } from "./components/Logo";
import { Notice } from "./components/ui";
import { About, Contact, SiteFooter } from "./components/Pages";
import { tx } from "./lib/i18n";
import { clear, load, save } from "./lib/storage";
import type { Lang, User } from "./types";

type View = "home" | "about" | "contact" | "login" | "chat" | "dashboard";
const PUBLIC: View[] = ["home", "about", "contact"];
const fromHash = (): View | null => { const h = location.hash.replace(/^#\/?/, ""); return h === "about" || h === "contact" ? h : null; };
type Gated = "chat" | "dashboard";

export default function App() {
  const [lang, setLang] = useState<Lang>(() => load<Lang>("saheli.lang", "hi"));
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = still checking
  const [view, setView] = useState<View>(() => fromHash() ?? "home");
  const [navOpen, setNavOpen] = useState(false);
  const [after, setAfter] = useState<Gated>("chat");
  const [chatKey, setChatKey] = useState(0);
  const [autoVoice, setAutoVoice] = useState(false);
  const [health, setHealth] = useState<{ ok: boolean; missing: string[] } | null>(null);
  const [hasSites, setHasSites] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { save("saheli.lang", lang); document.documentElement.lang = lang === "hi" ? "hi" : "en"; }, [lang]);

  // public pages have their own address (saheliai.com/#/about), so they can be shared and the back button works
  useEffect(() => {
    const want = view === "about" || view === "contact" ? `#/${view}` : "";
    if (location.hash !== want) history.pushState(null, "", want || location.pathname + location.search);
    setNavOpen(false);
  }, [view]);
  useEffect(() => {
    const onPop = () => setView((v) => fromHash() ?? (v === "about" || v === "contact" ? "home" : v));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // who is logged in? (cookie session) — resume where she left off (not when she opened a public page by its link)
  useEffect(() => {
    api.me().then((r) => {
      setUser(r.user);
      if (r.user && !fromHash() && load(sessionKey(r.user.id), { entries: [] as unknown[] }).entries.length > 1) setView("chat");
    }).catch(() => setUser(null));
    api.health().then((h) => setHealth({ ok: h.ok, missing: h.missing_settings })).catch(() => setHealth({ ok: false, missing: ["server"] }));
  }, []);

  useEffect(() => { if (user) api.sites().then((r) => setHasSites(r.sites.length > 0)).catch(() => {}); }, [user, view]);

  // any 401 from the API (session expired) -> back to login
  useEffect(() => {
    const onUnauth = () => { setUser(null); setView((v) => { if (v === "chat" || v === "dashboard") setAfter(v); return "login"; }); };
    window.addEventListener("saheli:unauthorized", onUnauth);
    return () => window.removeEventListener("saheli:unauthorized", onUnauth);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const go = useCallback((v: Gated, voice = false) => {
    if (voice) setAutoVoice(true);
    if (user) setView(v); else { setAfter(v); setView("login"); }
  }, [user]);

  // "just speak": open the mic as soon as the chat is visible
  useEffect(() => {
    if (view === "chat" && autoVoice) {
      setAutoVoice(false);
      setTimeout(() => document.querySelector<HTMLButtonElement>('[aria-label="Bol kar likhiye"],[aria-label="Speak"]')?.click(), 350);
    }
  }, [view, autoVoice]);

  /** Footer / header links on the public pages. */
  const nav = useCallback((p: "home" | "about" | "contact" | "how" | "start") => {
    if (p === "start") { go("chat"); return; }
    if (p === "how") { setView("home"); setTimeout(() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }), 80); return; }
    setView(p);
    document.getElementById("page")?.scrollTo({ top: 0 });
  }, [go]);
  const footer = <SiteFooter lang={lang} setLang={setLang} nav={nav} />;

  function newChat() { if (user) clear(sessionKey(user.id)); setChatKey((k) => k + 1); go("chat"); }
  async function deleteAccount() {
    setMenu(false);
    if (!user) return;
    const typed = window.prompt(tx(lang,
      "Aapka account, saari websites, orders, enquiries aur photos hamesha ke liye delete ho jaayenge. Ye wapas nahi hoga.\n\nConfirm karne ke liye apna email likhiye:\n",
      "Your account, all websites, orders, enquiries and photos will be deleted forever. This cannot be undone.\n\nType your email to confirm:\n") + user.email);
    if (typed === null) return;
    try {
      const r = await api.deleteAccount(typed);
      window.alert(tx(lang, `Account delete ho gaya (${r.websites} website, ${r.photos} photo).`, `Account deleted (${r.websites} websites, ${r.photos} photos).`));
      setUser(null); setHasSites(false); setView("home");
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function logout() { setMenu(false); try { await api.logout(); } catch { /* ignore */ } setUser(null); setHasSites(false); setView("home"); }

  if (user === undefined) {
    return <div className="grid h-dvh place-items-center"><span className="size-8 animate-spin rounded-full border-2 border-plum-700 border-r-transparent" aria-label="Loading" /></div>;
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-20 border-b border-line bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          {view !== "home" && <button onClick={() => setView("home")} className="-ml-1 rounded-lg p-1.5 text-muted hover:bg-plum-50 sm:hidden" aria-label="Home"><Icon name="back" /></button>}
          <button onClick={() => setView("home")} className="flex items-center gap-2.5" aria-label="Saheli AI home">
            <Logo size={36} />
          </button>
          {PUBLIC.includes(view) && (
            <div className="ml-6 hidden items-center gap-1 text-sm font-semibold md:flex">
              {([["how", "Kaise kaam karti hai", "How it works"], ["about", "Apni Saheli ko jaaniye", "Know your Saheli"], ["contact", "Sampark", "Contact"]] as const).map(([k, hi, en]) => (
                <button key={k} onClick={() => nav(k)} className={`rounded-lg px-3 py-2 transition hover:text-plum-700 ${view === k ? "text-plum-700" : "text-muted"}`}>{tx(lang, hi, en)}</button>
              ))}
            </div>
          )}
          <nav className="ml-auto flex items-center gap-1.5">
            <div className="flex rounded-xl border border-line bg-white p-0.5 text-xs font-semibold" role="group" aria-label="Language">
              {(["hi", "en"] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-lg px-2.5 py-1.5 transition ${lang === l ? "bg-plum-700 text-ivory" : "text-muted"}`}>
                  <span className="sm:hidden">{l === "hi" ? "हिं" : "EN"}</span><span className="hidden sm:inline">{l === "hi" ? "हिंदी" : "English"}</span></button>
              ))}
            </div>
            {user ? (
              <>
                <button onClick={() => go("dashboard")} className={`hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold sm:inline-flex ${view === "dashboard" ? "bg-plum-50 text-plum-700" : "text-muted hover:text-plum-700"}`}><Icon name="grid" className="size-4" />Dashboard</button>
                {view === "dashboard"
                  ? <button onClick={() => go("chat")} className="rounded-xl p-2 text-muted hover:text-plum-700" aria-label="Saheli se baat" title="Saheli se baat"><Icon name="chat" /></button>
                  : <button onClick={() => go("dashboard")} className="rounded-xl p-2 text-muted sm:hidden" aria-label="Dashboard"><Icon name="grid" /></button>}
                {view === "chat" && <button onClick={newChat} className="rounded-xl p-2 text-muted hover:text-plum-700" aria-label="Nayi baatcheet" title="Nayi baatcheet"><Icon name="refresh" /></button>}
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account"
                    className="grid size-9 place-items-center rounded-full bg-plum-100 font-semibold text-plum-700 transition hover:ring-4 hover:ring-plum-50">{(user.name || user.email)[0].toUpperCase()}</button>
                  {menu && (
                    <div role="menu" className="animate-rise absolute right-0 top-11 w-60 rounded-2xl border border-line bg-white p-2 shadow-lift">
                      <div className="px-3 py-2"><b className="block truncate text-sm">{user.name || tx(lang, "Saheli user", "Saheli user")}</b><span className="block truncate text-xs text-muted">{user.email}</span></div>
                      <button role="menuitem" onClick={() => { setMenu(false); go("dashboard"); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-plum-50"><Icon name="grid" className="size-4" />{tx(lang, "Meri websites", "My websites")}</button>
                      <button role="menuitem" onClick={() => { setMenu(false); go("chat"); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-plum-50"><Icon name="chat" className="size-4" />{tx(lang, "Saheli se baat", "Chat with Saheli")}</button>
                      <button role="menuitem" onClick={() => { setMenu(false); nav("contact"); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-plum-50"><Icon name="inbox" className="size-4" />{tx(lang, "Madad / sampark", "Help / contact")}</button>
                      <a role="menuitem" href={api.exportUrl} download onClick={() => setMenu(false)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-plum-50"><Icon name="arrow" className="size-4 rotate-90" />{tx(lang, "Mera data download karein", "Download my data")}</a>
                      <button role="menuitem" onClick={deleteAccount} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose hover:bg-[#FCEFF1]"><Icon name="x" className="size-4" />{tx(lang, "Account delete karein", "Delete account")}</button>
                      <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose hover:bg-[#FCEFF1]"><Icon name="back" className="size-4" />Logout</button>
                    </div>
                  )}
                </div>
              </>
            ) : view !== "login" && (
              <button onClick={() => { setAfter("dashboard"); setView("login"); }} className="rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-plum-700 hover:bg-plum-50">{tx(lang, "Login", "Log in")}</button>
            )}
            {PUBLIC.includes(view) && (
              <button onClick={() => setNavOpen((o) => !o)} className="rounded-xl p-2 text-muted md:hidden" aria-label="Menu" aria-expanded={navOpen}><Icon name={navOpen ? "x" : "menu"} /></button>
            )}
          </nav>
        </div>
        {navOpen && PUBLIC.includes(view) && (
          <div className="animate-rise border-t border-line bg-ivory px-4 py-3 md:hidden">
            {([["home", "Home", "Home"], ["how", "Kaise kaam karti hai", "How it works"], ["about", "Apni Saheli ko jaaniye", "Know your Saheli"], ["contact", "Sampark karein", "Contact us"]] as const).map(([k, hi, en]) => (
              <button key={k} onClick={() => { setNavOpen(false); nav(k); }} className={`block w-full rounded-xl px-3 py-3 text-left text-[16px] font-semibold ${view === k ? "bg-plum-50 text-plum-700" : "text-ink"}`}>{tx(lang, hi, en)}</button>
            ))}
            <button onClick={() => { setNavOpen(false); go("chat"); }} className="mt-2 w-full rounded-xl bg-plum-700 px-3 py-3 text-[16px] font-semibold text-ivory">{tx(lang, "Saheli se baat karein", "Talk to Saheli")}</button>
          </div>
        )}
      </header>

      {health && !health.ok && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-3">
          <Notice tone="error">{health.missing.includes("server") ? tx(lang, "Server se connect nahi ho paaya. Thodi der baad dobara kholiye.", "Couldn't reach the server. Please try again in a moment.") : tx(lang, `Server par ye settings missing hain: ${health.missing.join(", ")}`, `These server settings are missing: ${health.missing.join(", ")}`)}</Notice>
        </div>
      )}

      {view === "home" && <Landing lang={lang} hasSites={!!user && hasSites} onStart={() => go("chat")} onVoice={() => go("chat", true)} onDashboard={() => go("dashboard")} footer={footer} />}
      {(view === "about" || view === "contact") && (
        <div id="page" className="flex-1 overflow-y-auto overflow-x-hidden">
          {view === "about" ? <About lang={lang} nav={nav} /> : <Contact lang={lang} />}
          {footer}
        </div>
      )}
      {view === "login" && <Login lang={lang} onDone={(u) => { setUser(u); setView(after); }} />}
      {view === "chat" && user && <Chat key={`${user.id}-${chatKey}`} resetKey={chatKey} userId={user.id} userName={user.name} isAdmin={!!user.is_admin} lang={lang} onDashboard={() => go("dashboard")} />}
      {view === "dashboard" && user && <Dashboard lang={lang} onNew={newChat} onChat={() => go("chat")} />}
    </div>
  );
}
