import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { tx } from "../lib/i18n";
import type { Lang } from "../types";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";
import { Button, Notice } from "./ui";

export type Page = "home" | "about" | "contact";
type Nav = (p: Page | "how" | "start") => void;

/* ------------------------------------------------------------------ footer (every public page) */
export function SiteFooter({ lang, setLang, nav }: { lang: Lang; setLang: (l: Lang) => void; nav: Nav }) {
  const link = "text-left hover:text-plum-700";
  return (
    <footer className="border-t border-line bg-white/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-sm text-muted sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3"><LogoMark size={36} /><b className="font-display text-lg text-ink">Saheli AI</b></div>
          <p className="mt-3 max-w-xs">{tx(lang, "Har chhote business ke liye — khaas taur par mahila udyamiyon ke liye.", "For every small business — designed first for women entrepreneurs.")}</p>
        </div>
        <div>
          <p className="font-semibold text-ink">{tx(lang, "Saheli", "Product")}</p>
          <ul className="mt-3 space-y-2">
            <li><button className={link} onClick={() => nav("how")}>{tx(lang, "Kaise kaam karti hai", "How it works")}</button></li>
            <li><button className={link} onClick={() => nav("start")}>{tx(lang, "Shuru karein — free", "Get started — free")}</button></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink">{tx(lang, "Hamare baare mein", "Company")}</p>
          <ul className="mt-3 space-y-2">
            <li><button className={link} onClick={() => nav("about")}>{tx(lang, "Apni Saheli ko jaaniye", "Know your Saheli")}</button></li>
            <li><button className={link} onClick={() => nav("contact")}>{tx(lang, "Sampark karein", "Contact us")}</button></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink">{tx(lang, "Bhasha chuniye", "Choose your language")}</p>
          <div className="mt-3 inline-flex rounded-xl border border-line bg-white p-0.5 text-xs font-semibold" role="group" aria-label="Language">
            {(["hi", "en"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-lg px-3 py-1.5 ${lang === l ? "bg-plum-700 text-ivory" : "text-muted"}`}>{l === "hi" ? "हिंदी" : "English"}</button>
            ))}
          </div>
          <p className="mt-2 text-xs">{tx(lang, "Saheli se aap Hindi, Hinglish ya English — kisi mein bhi baat kar sakti hain.", "You can talk to Saheli in Hindi, Hinglish or English.")}</p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-muted">
          <p>© 2026 Ananya Gupta. {tx(lang, "Sabhi adhikaar surakshit.", "All rights reserved.")}</p>
          <p>Powered by <b className="font-semibold text-ink">Anthropic × GoDaddy</b></p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ about: Know your Saheli */
const ABOUT = {
  hi: {
    eyebrow: "Apni Saheli ko jaaniye",
    h1: "Har hunar ko ek dukaan milni chahiye.",
    lead: "Bharat mein lakhon auratein ghar se achaar, kapde, tiffin, mehendi, tuition jaisa kaam karti hain. Hunar unke paas hai — par website, domain, payment aur marketing ki duniya angrezi aur tech se bhari hai. Saheli isi faasle ko mitane ke liye bani hai.",
    whoT: "Saheli kaun hai?",
    who: "Saheli ek AI business saathi hai. Aap use apni bhasha mein — bolkar ya likhkar — bataiye ki aap kya karti hain. Wo sawaal poochti hai, aapka business samajhti hai, aur ek-ek kadam mein aapko online le aati hai.",
    doesT: "Saheli aapke liye kya karti hai",
    does: [
      ["chat", "Aapki bhasha mein baat", "Hindi, Hinglish ya English — jaise aap ghar par baat karti hain."],
      ["globe", "Naam aur domain", "Brand naam sujhati hai aur GoDaddy se asli availability aur daam dikhati hai."],
      ["store", "Website aur online dukaan", "Products, daam, photos, WhatsApp aur UPI ordering ke saath — free Saheli address par."],
      ["camera", "Photos se catalogue", "Product ki photo lijiye — Saheli naam aur jaankari pehchaan leti hai."],
      ["inbox", "Orders aur enquiries", "Sab ek dashboard mein, aur aapke email par."],
      ["trend", "Aage badhne ki yojana", "Instagram posts, WhatsApp messages aur 30/60/90 din ka growth plan."],
    ],
    promiseT: "Hamare vaade",
    promises: [
      ["check", "Aapki manzoori pehle", "Saheli aapki haan ke bina kuch publish ya kharid nahi karti."],
      ["shield", "Sach, sirf sach", "Daam, reviews ya payment kabhi banaye nahi jaate. Jo pata nahi, wo saaf bataya jaata hai."],
      ["user", "Aapka data aapka hai", "Kabhi bhi apna saara data download ya account delete kar sakti hain."],
      ["wallet", "Shuru karna free", "Website, hosting aur ordering free. Paid cheez ka daam hamesha pehle."],
    ],
    builtT: "Kis par bani hai",
    built: "Saheli ki samajh Anthropic ke Claude se aati hai, aur domain ki jaankari GoDaddy se. Ise GoDaddy Inclusive Innovation Hackathon 2026 ke liye banaya gaya hai — is soch ke saath ki technology har aurat ke kaam aaye.",
    cta: "Saheli se baat karein",
  },
  en: {
    eyebrow: "Know your Saheli",
    h1: "Every craft deserves a shop.",
    lead: "Across India, millions of women run businesses from home — pickles, clothes, tiffin, mehendi, tuition. They have the skill, but the world of websites, domains, payments and marketing is full of English and jargon. Saheli exists to close that gap.",
    whoT: "Who is Saheli?",
    who: "Saheli is an AI business partner. Tell her what you do in your own language — by voice or text. She asks simple questions, understands your business, and takes you online one step at a time.",
    doesT: "What Saheli does for you",
    does: [
      ["chat", "Talks in your language", "Hindi, Hinglish or English — the way you talk at home."],
      ["globe", "Name and domain", "Suggests brand names and shows real availability and prices from GoDaddy."],
      ["store", "Website and online shop", "Products, prices, photos, WhatsApp and UPI ordering — on a free Saheli address."],
      ["camera", "Catalogue from photos", "Snap a product photo — Saheli recognises the name and details."],
      ["inbox", "Orders and enquiries", "All in one dashboard, and in your email."],
      ["trend", "A plan to grow", "Instagram posts, WhatsApp messages and a 30/60/90-day growth plan."],
    ],
    promiseT: "Our promises",
    promises: [
      ["check", "Your approval first", "Saheli never publishes or buys anything without your yes."],
      ["shield", "Only the truth", "Prices, reviews and payments are never made up. What we don't know, we say."],
      ["user", "Your data is yours", "Download all your data or delete your account at any time."],
      ["wallet", "Free to start", "Website, hosting and ordering are free. Anything paid shows its price first."],
    ],
    builtT: "What she's built on",
    built: "Saheli's understanding comes from Anthropic's Claude, and domain information from GoDaddy. She was built for the GoDaddy Inclusive Innovation Hackathon 2026 — so that technology works for every woman.",
    cta: "Talk to Saheli",
  },
};

export function About({ lang, nav }: { lang: Lang; nav: Nav }) {
  const t = ABOUT[lang];
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
      <p className="text-[11.5px] font-bold uppercase tracking-[.16em] text-rose">{t.eyebrow}</p>
      <h1 className="mt-3 max-w-3xl font-display text-[38px] leading-[1.08] sm:text-[52px]">{t.h1}</h1>
      <p className="mt-5 max-w-3xl text-[17px] leading-relaxed text-muted">{t.lead}</p>

      <div className="mt-12 grid gap-8 rounded-[28px] bg-plum-700 p-7 text-ivory sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
        <LogoMark size={72} />
        <div><h2 className="font-display text-3xl">{t.whoT}</h2><p className="mt-2 text-[16px] leading-relaxed text-ivory/80">{t.who}</p></div>
      </div>

      <h2 className="mt-14 font-display text-3xl">{t.doesT}</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.does.map(([ic, a, b]) => (
          <li key={a} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <span className="grid size-10 place-items-center rounded-xl bg-plum-50 text-plum-700"><Icon name={ic} /></span>
            <b className="mt-3 block text-[17px]">{a}</b><p className="mt-1 text-sm text-muted">{b}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 font-display text-3xl">{t.promiseT}</h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {t.promises.map(([ic, a, b]) => (
          <li key={a} className="flex gap-4 rounded-2xl bg-cream/70 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-leaf"><Icon name={ic} /></span>
            <span><b className="block text-[17px]">{a}</b><span className="text-sm text-muted">{b}</span></span>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 font-display text-3xl">{t.builtT}</h2>
      <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-muted">{t.built}</p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button icon="mic" onClick={() => nav("start")}>{t.cta}</Button>
        <Button variant="secondary" icon="inbox" onClick={() => nav("contact")}>{tx(lang, "Sampark karein", "Contact us")}</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ contact */
const TOPICS: [string, string, string][] = [
  ["question", "Sawaal poochna hai", "A question"], ["help", "Website mein madad", "Help with my website"],
  ["partnership", "Saath kaam karna", "Partnership"], ["press", "Media / press", "Media / press"], ["other", "Kuch aur", "Something else"],
];

export function Contact({ lang }: { lang: Lang }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", topic: "question", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [mailbox, setMailbox] = useState<string | null>(null);
  useEffect(() => { api.contactInfo().then((r) => setMailbox(r.email)).catch(() => {}); }, []);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim()) || form.message.trim().length < 5) {
      setError(tx(lang, "Naam, sahi email aur apna sandesh (kam se kam 5 akshar) bhariye.", "Please fill in your name, a valid email and your message (at least 5 characters)."));
      return;
    }
    setBusy(true);
    try { await api.contact({ ...form, phone: form.phone || undefined }); setSent(true); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  const field = "mt-1.5 min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base focus:border-plum-600 focus:outline-none focus:ring-4 focus:ring-plum-100";
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 sm:py-16 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <div>
        <p className="text-[11.5px] font-bold uppercase tracking-[.16em] text-rose">{tx(lang, "Sampark karein", "Contact us")}</p>
        <h1 className="mt-3 font-display text-[38px] leading-[1.08] sm:text-[48px]">{tx(lang, "Hum sun rahe hain.", "We're listening.")}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">{tx(lang,
          "Koi sawaal, sujhaav ya madad chahiye? Humein likhiye — hum jaldi jawab denge.",
          "A question, an idea, or need help? Write to us — we'll reply soon.")}</p>
        <ul className="mt-8 space-y-4 text-[15px]">
          {mailbox && <li className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-plum-50 text-plum-700"><Icon name="inbox" /></span>
            <a href={`mailto:${mailbox}`} className="font-semibold text-plum-700 hover:underline">{mailbox}</a></li>}
          <li className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-plum-50 text-plum-700"><Icon name="chat" /></span>
            <span className="text-muted">{tx(lang, "Website ke baare mein? Login karke Saheli se seedha poochiye.", "About your website? Log in and ask Saheli directly.")}</span></li>
          <li className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-plum-50 text-plum-700"><Icon name="pin" /></span>
            <span className="text-muted">{tx(lang, "Bharat mein, Bharat ke liye", "In India, for India")}</span></li>
        </ul>
      </div>

      <div className="rounded-3xl border border-line bg-white p-6 shadow-lift sm:p-8">
        {sent ? (
          <div className="py-10 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-leaf-50 text-leaf"><Icon name="check" className="size-7" /></span>
            <h2 className="mt-4 font-display text-2xl">{tx(lang, "Sandesh mil gaya!", "Message received!")}</h2>
            <p className="mt-1 text-muted">{tx(lang, "Dhanyavaad. Hum aapke email par jawab denge.", "Thank you. We'll reply to your email.")}</p>
            <Button variant="secondary" className="mt-6" onClick={() => { setSent(false); setForm((f) => ({ ...f, message: "" })); }}>{tx(lang, "Ek aur sandesh", "Send another")}</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">{tx(lang, "Naam", "Name")}<input value={form.name} onChange={set("name")} autoComplete="name" maxLength={100} className={field} /></label>
              <label className="block text-sm font-semibold">Email<input type="email" inputMode="email" value={form.email} onChange={set("email")} autoComplete="email" maxLength={120} placeholder="naam@gmail.com" className={field} /></label>
              <label className="block text-sm font-semibold">{tx(lang, "Phone (zaroori nahi)", "Phone (optional)")}<input inputMode="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" maxLength={20} className={field} /></label>
              <label className="block text-sm font-semibold">{tx(lang, "Vishay", "Topic")}
                <select value={form.topic} onChange={set("topic")} className={field}>{TOPICS.map(([v, hi, en]) => <option key={v} value={v}>{tx(lang, hi, en)}</option>)}</select></label>
            </div>
            <label className="mt-4 block text-sm font-semibold">{tx(lang, "Aapka sandesh", "Your message")}
              <textarea value={form.message} onChange={set("message")} rows={5} maxLength={3000} className={`${field} py-3`} /></label>
            <input value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
            <Button type="submit" className="mt-5 w-full min-h-12" loading={busy} icon="send">{tx(lang, "Bhejiye", "Send message")}</Button>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Icon name="shield" className="mt-0.5 size-4 shrink-0" />{tx(lang,
              "Aapki jaankari sirf jawab dene ke liye use hoti hai.", "Your details are used only to reply to you.")}</p>
          </form>
        )}
      </div>
    </div>
  );
}
