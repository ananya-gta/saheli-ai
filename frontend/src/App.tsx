import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Chat, sessionKey } from "./components/Chat";
import { Dashboard } from "./components/Dashboard";
import { Icon } from "./components/Icon";
import { Login } from "./components/Login";
import { Landing } from "./components/Landing";
import { Logo } from "./components/Logo";
import { Notice } from "./components/ui";
import { clear, load, save } from "./lib/storage";
import type { Lang, User } from "./types";

type View = "home" | "login" | "chat" | "dashboard";
type Gated = "chat" | "dashboard";

export default function App() {
  const [lang, setLang] = useState<Lang>(() => load<Lang>("saheli.lang", "hi"));
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = still checking
  const [view, setView] = useState<View>("home");
  const [after, setAfter] = useState<Gated>("chat");
  const [chatKey, setChatKey] = useState(0);
  const [autoVoice, setAutoVoice] = useState(false);
  const [health, setHealth] = useState<{ ok: boolean; missing: string[] } | null>(null);
  const [hasSites, setHasSites] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { save("saheli.lang", lang); document.documentElement.lang = lang === "hi" ? "hi" : "en"; }, [lang]);

  // who is logged in? (cookie session) — resume where she left off
  useEffect(() => {
    api.me().then((r) => {
      setUser(r.user);
      if (r.user && load(sessionKey(r.user.id), { entries: [] as unknown[] }).entries.length > 1) setView("chat");
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

  function newChat() { if (user) clear(sessionKey(user.id)); setChatKey((k) => k + 1); go("chat"); }
  async function deleteAccount() {
    setMenu(false);
    if (!user) return;
    const typed = window.prompt(
      "Aapka account, saari websites, orders, enquiries aur photos hamesha ke liye delete ho jaayenge. Ye wapas nahi hoga.\n\nConfirm karne ke liye apna email likhiye:\n" + user.email);
    if (typed === null) return;
    try {
      const r = await api.deleteAccount(typed);
      window.alert(`Account delete ho gaya (${r.websites} website, ${r.photos} photo).`);
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
                      <div className="px-3 py-2"><b className="block truncate text-sm">{user.name || "Saheli user"}</b><span className="block truncate text-xs text-muted">{user.email}</span></div>
                      <button role="menuitem" onClick={() => { setMenu(false); go("dashboard"); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-plum-50"><Icon name="grid" className="size-4" />Meri websites</button>
                      <a role="menuitem" href={api.exportUrl} download onClick={() => setMenu(false)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-plum-50"><Icon name="arrow" className="size-4 rotate-90" />Mera data download karein</a>
                      <button role="menuitem" onClick={deleteAccount} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose hover:bg-[#FCEFF1]"><Icon name="x" className="size-4" />Account delete karein</button>
                      <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose hover:bg-[#FCEFF1]"><Icon name="back" className="size-4" />Logout</button>
                    </div>
                  )}
                </div>
              </>
            ) : view !== "login" && (
              <button onClick={() => { setAfter("dashboard"); setView("login"); }} className="rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-plum-700 hover:bg-plum-50">Login</button>
            )}
          </nav>
        </div>
      </header>

      {health && !health.ok && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-3">
          <Notice tone="error">{health.missing.includes("server") ? "Backend se connect nahi ho paaya. Terminal mein `python -m uvicorn app.main:app --reload --port 8000` chalaiye." : `.env mein ye settings missing hain: ${health.missing.join(", ")}`}</Notice>
        </div>
      )}

      {view === "home" && <Landing lang={lang} hasSites={!!user && hasSites} onStart={() => go("chat")} onVoice={() => go("chat", true)} onDashboard={() => go("dashboard")} />}
      {view === "login" && <Login lang={lang} onDone={(u) => { setUser(u); setView(after); }} />}
      {view === "chat" && user && <Chat key={`${user.id}-${chatKey}`} resetKey={chatKey} userId={user.id} userName={user.name} isAdmin={!!user.is_admin} lang={lang} onDashboard={() => go("dashboard")} />}
      {view === "dashboard" && user && <Dashboard lang={lang} onNew={newChat} onChat={() => go("chat")} />}
    </div>
  );
}
