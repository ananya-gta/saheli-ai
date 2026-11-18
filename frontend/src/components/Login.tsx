import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Lang, User } from "../types";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";
import { Button, Notice } from "./ui";

const T = {
  hi: {
    title: "Login kijiye", sub: "Apna email daaliye — hum ek 6-digit code bhejenge. Koi password yaad rakhne ki zaroorat nahi.",
    email: "Email address", send: "Code bhejo", codeTitle: "Code daaliye", codeSub: (e: string) => `Humne ${e} par 6-digit code bheja hai.`,
    verify: "Login karein", resend: "Code dobara bhejo", resendIn: (s: number) => `${s}s mein dobara bhej sakte hain`, change: "Email badlo",
    nameTitle: "Aapka naam?", nameSub: "Saheli aapko is naam se bulayegi.", nameCta: "Aage badhein", skip: "Baad mein",
    dev: "Dev mode: email abhi set nahi hai, isliye code yahan dikh raha hai:", privacy: "Hum aapka email sirf login aur aapki website ki enquiries ke liye use karte hain.",
  },
  en: {
    title: "Log in", sub: "Enter your email — we'll send a 6-digit code. No password to remember.",
    email: "Email address", send: "Send code", codeTitle: "Enter the code", codeSub: (e: string) => `We sent a 6-digit code to ${e}.`,
    verify: "Log in", resend: "Resend code", resendIn: (s: number) => `Resend in ${s}s`, change: "Change email",
    nameTitle: "Your name?", nameSub: "Saheli will greet you by this name.", nameCta: "Continue", skip: "Later",
    dev: "Dev mode: email isn't set up yet, so the code is shown here:", privacy: "We only use your email for login and for your website's enquiries.",
  },
};

export function Login({ lang, onDone }: { lang: Lang; onDone: (u: User) => void }) {
  const t = T[lang];
  const [step, setStep] = useState<"email" | "code" | "name">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(id); }, [wait]);
  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setError(undefined);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(lang === "hi" ? "Sahi email daaliye (jaise naam@gmail.com)" : "Enter a valid email"); return; }
    setBusy(true);
    try {
      const r = await api.requestCode(email.trim());
      setDevCode(r.dev_code); setStep("code"); setWait(60); setCode("");
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function verify(value = code) {
    if (value.length !== 6) return;
    setError(undefined); setBusy(true);
    try {
      const r = await api.verifyCode(email.trim(), value);
      setUser(r.user);
      if (r.user.name) onDone(r.user); else setStep("name");
    } catch (err) { setError((err as Error).message); setCode(""); codeRef.current?.focus(); } finally { setBusy(false); }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { onDone(user); return; }
    setBusy(true);
    try { const r = await api.setName(name.trim()); onDone(r.user); } catch { onDone(user); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-10 sm:items-center">
      <div className="animate-rise w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-lift sm:p-8">
        <LogoMark size={48} />

        {step === "email" && (
          <form onSubmit={sendCode} noValidate>
            <h1 className="mt-5 font-display text-3xl">{t.title}</h1>
            <p className="mt-1.5 text-[15px] text-muted">{t.sub}</p>
            <label className="mt-6 block text-sm font-semibold" htmlFor="email">{t.email}</label>
            <input id="email" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@gmail.com" aria-invalid={!!error}
              className="mt-1.5 min-h-12 w-full rounded-xl border border-line px-3.5 text-base focus:border-plum-600 focus:outline-none focus:ring-4 focus:ring-plum-100" />
            {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
            <Button type="submit" className="mt-5 w-full min-h-12" loading={busy} icon="arrow">{t.send}</Button>
            <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Icon name="shield" className="mt-0.5 size-4 shrink-0" />{t.privacy}</p>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={(e) => { e.preventDefault(); verify(); }}>
            <h1 className="mt-5 font-display text-3xl">{t.codeTitle}</h1>
            <p className="mt-1.5 text-[15px] text-muted">{t.codeSub(email.trim())}</p>
            {devCode && <div className="mt-4"><Notice tone="warn">{t.dev} <b className="font-mono tracking-widest">{devCode}</b></Notice></div>}
            <input ref={codeRef} value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code"
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) verify(v); }}
              className="mt-5 min-h-14 w-full rounded-xl border border-line text-center font-mono text-3xl tracking-[.5em] focus:border-plum-600 focus:outline-none focus:ring-4 focus:ring-plum-100" placeholder="••••••" />
            {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
            <Button type="submit" className="mt-5 w-full min-h-12" loading={busy} disabled={code.length !== 6} icon="check">{t.verify}</Button>
            <div className="mt-4 flex items-center justify-between text-sm">
              <button type="button" className="font-semibold text-muted hover:text-plum-700" onClick={() => { setStep("email"); setError(undefined); }}>{t.change}</button>
              <button type="button" disabled={wait > 0 || busy} onClick={() => sendCode()} className="font-semibold text-plum-700 disabled:text-muted">{wait > 0 ? t.resendIn(wait) : t.resend}</button>
            </div>
          </form>
        )}

        {step === "name" && (
          <form onSubmit={saveName}>
            <h1 className="mt-5 font-display text-3xl">{t.nameTitle}</h1>
            <p className="mt-1.5 text-[15px] text-muted">{t.nameSub}</p>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Sonali"
              className="mt-5 min-h-12 w-full rounded-xl border border-line px-3.5 text-base focus:border-plum-600 focus:outline-none focus:ring-4 focus:ring-plum-100" />
            <div className="mt-5 flex gap-2">
              <Button type="submit" className="flex-1 min-h-12" loading={busy} icon="arrow">{t.nameCta}</Button>
              <Button type="button" variant="secondary" className="min-h-12" onClick={() => user && onDone(user)}>{t.skip}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
