import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type LandingData, type ShowcaseSite } from "../api";
import type { Lang } from "../types";
import { DemoVideo, STORYBOARD } from "./DemoVideo";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";
import { ScaledFrame } from "./ScaledFrame";
import { Pill } from "./ui";
import { voiceSupported } from "../lib/speech";

/* ------------------------------------------------------------------ copy
   Voice: warm, confident, empowering — a capable business partner, not software explaining features. */
const C = {
  hi: {
    pill: "Bharat ki mahila udyamiyon ke liye",
    h1a: "Aapka hunar ek business ka haqdaar hai.", h1b: "Saheli use sach kar degi.",
    tag: "Aap hunar sambhaliye, digital duniya Saheli sambhalegi.",
    sub: "Saheli ko bataiye aap kya bechna chahti hain. Wo aapka brand banayegi, naam aur domain dhoondhegi, website aur online dukaan taiyaar karegi — ek-ek baat karke.",
    langNote: "Jaise ghar par baat karti hain, waise hi boliye — Hindi, Hinglish ya English. Typing ki zaroorat nahi.",
    speak: "Saheli se baat karein", type: "Apna idea likhiye",
    noVoice: "Is browser mein voice nahi chalti — Android ya computer par Chrome mein kholiye, ya likh kar shuru karein.",
    trust: ["Shuruaat bilkul free", "Har kharcha pehle, har faisla aapka", "Koi technical jaankari nahi chahiye"],
    vEyebrow: "Dekhiye kaise", vTitle: "Ek voice note se asli online business tak.",
    vSub: "Na lambe forms, na technical baatein. Bas Saheli ko apna idea bataiye aur apne business ko aakaar lete dekhiye.",
    vTag: "Bas apni kahani bataiye. Saheli use business bana degi.",
    jEyebrow: "Saheli kaise kaam karti hai", jTitle: "Aapke business ko bhi chahiye ek Saheli.",
    jSub: "Aapke products samajhne se lekar website launch karne tak — digital kaam Saheli sambhalti hai, aur har faisla aapke haath mein rehta hai.",
    jTag: "Har kadam par Saheli saath. Faisla hamesha aapka.",
    jFail: ["Kuch gadbad ho jaaye to?", "Saheli har nateeja khud check karti hai, jo theek ho sakta hai use sambhal leti hai, aur jahan aapki zaroorat ho wahan saaf-saaf batati hai."],
    wEyebrow: "Kiske liye", wTitle: ["Aapka hunar dikhna chahiye.", "Aapke sapne badhne chahiye."],
    wSub: "Chahe aap apni rasoi se khana banati hain, ghar se silai karti hain, khoobsurat mehendi lagati hain ya mohalle ke bachchon ko padhati hain — Saheli aapke kaam ko aapki dehleez se aage le jaati hai.",
    wCta: ["Aapka hunar kya hai?", "Khana, silai, padhai ya kala — aapka hunar mohalle se aage pehchaana jaana chahiye.", "Apni kahani bataiye"],
    pEyebrow: "Sirf tool nahi, saheli", pTitle: ["Aapke business ki saathi.", "Har kadam aapke saath."],
    pSub: "Wo aapka business yaad rakhti hai, aapki bhasha mein baat karti hai, aur aapko aage badhane ki zimmedaari leti hai — ek-ek kadam karke.",
    kTitle: ["Woh apna hunar jaanti hai.", "Saheli digital duniya jaanti hai."],
    kSub: "Mohalle ka sabse achha achaar ho, sabse saaf silai, ya wo bridal mehendi jiski sab baat karte hain — woh apna kaam jaanti hai. Use domain, hosting aur website seekhne ki zaroorat nahi honi chahiye, sirf apna hunar duniya tak pahunchane ke liye.",
    kShe: "Woh jaanti hai", kSaheli: "Saheli sambhalti hai",
    kLine: "Bas boliye. Baaki Saheli sambhalegi.", kLine2: "Technology ka tension chhodiye. Apne sapne par dhyaan dijiye.",
    sEyebrow: "Har business ki apni pehchaan", sTitle: "Ek idea. Business banane ke hazaar tareeke.",
    sSub: "Har business ki apni kahani hoti hai. Saheli aisi digital pehchaan banati hai jo aapki ho — copy-paste website nahi. Har preview asli demo website hai, kholkar dekhiye.",
    sTag: "Har hunar ki apni pehchaan. Har business ki apni website.",
    cEyebrow: "Launch ke baad", cTitle: "Pehla customer aakhri nahi hona chahiye.",
    cSub: "Sundar website to bas shuruaat hai. Saheli enquiries sambhalne, orders lene aur customers se jude rehne mein aapki madad karti hai.",
    cTag: "Pehla order ho ya sauvaan, Saheli rahegi aapke saath.",
    aEyebrow: "Pata aur kharcha", aTitle: "Shuruaat free. Har kharcha saaf. Control aapke haath.",
    aSub: "Business shuru karna apne aap mein bada kadam hai — usmein achanak kharche nahi hone chahiye. Faisla lene se pehle Saheli har daam dikhati hai.",
    aMoney: "Aapka paisa. Aapka faisla. Har kharide se pehle aapki manzoori.",
    aTag: "Shuruaat muft. Har kharcha saaf. Har faisla aapka.",
    rEyebrow: "Launch ke baad bhi saath", rTitle: "Live hona to bas shuruaat hai.",
    rSub: "Website launch hone ke baad Saheli gayab nahi hoti. Wo aapke business ki online taiyaari check karti hai aur batati hai ki aage kya behtar karna hai.",
    rQuote: "“Aapki website live hai! Chaliye, kuch aur product photos jodte hain, taaki customers dekh sakein ki aapke products kitne khaas hain.”",
    rTag: "Website live ho gayi. Ab business ko aage badhate hain.",
    final: "Aapka business online hone se bas ek baatcheet door hai.",
  },
  en: {
    pill: "Built for India's women entrepreneurs",
    h1a: "Your talent deserves a business.", h1b: "Saheli makes it happen.",
    tag: "Aap hunar sambhaliye, digital duniya Saheli sambhalegi.",
    sub: "Tell Saheli what you want to sell. She'll help you build your brand, find a domain, create your website and set up your online store — one conversation at a time.",
    langNote: "Speak the way you talk at home — Hindi, Hinglish or English. No typing needed.",
    speak: "Saheli se baat karein", type: "Type your business idea",
    noVoice: "Voice doesn't work in this browser — open it in Chrome on Android or a computer, or type your idea.",
    trust: ["Free to get started", "Every cost upfront, every decision yours", "No technical knowledge needed"],
    vEyebrow: "See it in action", vTitle: "From a voice note to a real online business.",
    vSub: "No complicated forms. No technical jargon. Just tell Saheli what you have in mind and watch your business take shape.",
    vTag: "Bas apni kahani bataiye. Saheli use business bana degi.",
    jEyebrow: "How Saheli works", jTitle: "Your business deserves a Saheli.",
    jSub: "From understanding your products to launching your website, Saheli handles the digital work while you stay in control of every decision.",
    jTag: "Har kadam par Saheli saath. Faisla hamesha aapka.",
    jFail: ["What if something goes wrong?", "Saheli checks the results, handles recoverable errors and guides you through anything that needs your attention."],
    wEyebrow: "Who it's for", wTitle: ["Your talent deserves to be seen.", "Your dreams deserve to grow."],
    wSub: "Whether you cook from your kitchen, stitch from home, create beautiful mehendi designs or teach children in your neighbourhood — Saheli helps take your work beyond your doorstep.",
    wCta: ["What's your craft?", "Whether you cook, stitch, teach or create — your talent deserves to be discovered beyond your neighbourhood.", "Tell Saheli your story"],
    pEyebrow: "More than a tool. A partner.", pTitle: ["A partner for your business.", "With you at every step."],
    pSub: "She remembers your business, speaks your language and takes responsibility for helping you move forward — one step at a time.",
    kTitle: ["She knows her craft.", "Saheli knows the digital world."],
    kSub: "The best achaar in the colony, the neatest stitching, the bridal mehendi everyone talks about — she knows her work. She shouldn't have to learn domains, hosting and websites to share it with the world.",
    kShe: "She knows", kSaheli: "Saheli handles",
    kLine: "Bas boliye. Baaki Saheli sambhalegi.", kLine2: "Technology ka tension chhodiye. Apne sapne par dhyaan dijiye.",
    sEyebrow: "Every business, its own identity", sTitle: "One idea. A thousand ways to build a business.",
    sSub: "Every business has its own story. Saheli creates a digital identity that reflects yours — not another copy-paste website. Every preview is a real demo site; open one and look around.",
    sTag: "Har hunar ki apni pehchaan. Har business ki apni website.",
    cEyebrow: "After launch", cTitle: "Your first customer shouldn't be your last.",
    cSub: "A beautiful website is just the beginning. Saheli helps you manage enquiries, receive orders and stay connected with your customers.",
    cTag: "Pehla order ho ya sauvaan, Saheli rahegi aapke saath.",
    aEyebrow: "Address & costs", aTitle: "Start free. Know every cost. Stay in control.",
    aSub: "Starting a business is exciting enough. Unexpected costs shouldn't be part of it. Saheli shows you every price before you make a decision.",
    aMoney: "Your money. Your decision. Every purchase requires your approval.",
    aTag: "Shuruaat muft. Har kharcha saaf. Har faisla aapka.",
    rEyebrow: "Still with you", rTitle: "Going live is just the beginning.",
    rSub: "Saheli doesn't disappear after your website launches. She checks your business's online readiness and helps you identify what needs improvement next.",
    rQuote: "“Your website is live! Let's add a few more product photographs so customers can see exactly what makes your products special.”",
    rTag: "Website live ho gayi. Ab business ko aage badhate hain.",
    final: "Your business is one conversation away from being online.",
  },
};

/* The women whose work deserves to be discovered — photos bundled in /public/women (boutique is downloaded on the server). */
const WOMEN = {
  homefood: { img: "/women/homefood.webp", tone: "#8A3B1E", pos: "center 35%",
    hi: ["Ghar ka khana & achaar", "Dadi ke haath ka swaad", "Peedhiyon purani recipes — ab har ghar ki thaali tak."],
    en: ["Home food & achaar", "A grandmother's recipe", "Recipes handed down for generations — now on tables across India."] },
  beauty: { img: "/women/beauty.webp", tone: "#7A3A4E", pos: "center",
    hi: ["Mehendi & beauty", "Har design ek kahani", "Wo kala jo poore shehar ki dulhanein dhoondhti hain."],
    en: ["Mehendi & beauty", "Every design tells a story", "Artistry that every bride in the city should be able to find."] },
  bakery: { img: "/women/bakery.webp", tone: "#5A3524", pos: "center 30%",
    hi: ["Home bakery", "Pyaar se bana, garv se parosa", "Uski rasoi, uski recipes, uske customers."],
    en: ["Home bakery", "Made with love, served with pride", "Her kitchen, her recipes, her customers."] },
  education: { img: "/women/education.webp", tone: "#1F4D5A", pos: "center 40%",
    hi: ["Tuition & classes", "Chaar deewaron se aage gyaan", "Wo teacher jis par poori colony bharosa karti hai."],
    en: ["Tuition & classes", "Knowledge beyond four walls", "The teacher every parent in the colony trusts."] },
  boutique: { img: null, tone: "#3A2E4A", pos: "center",
    hi: ["Boutique & handloom", "Har silai ek pehchaan", "Handloom aur block-print, ab poore desh ke liye."],
    en: ["Boutique & handloom", "Every stitch, a signature", "Handloom and block-print, ready for the whole country."] },
} as const;

/* Showcase personas (one per demo site) */
const PERSONA: Record<string, { hi: [string, string]; en: [string, string] }> = {
  bakery: { en: ["The Home Baker", "Made with love, served with pride."], hi: ["Home Baker", "Pyaar se bana, garv se parosa."] },
  homefood: { en: ["The Foodpreneur", "Traditional recipes, modern reach."], hi: ["Ghar ki rasoi se brand tak", "Purani recipes, nayi pahunch."] },
  boutique: { en: ["The Boutique Owner", "Every creation deserves a spotlight."], hi: ["Boutique ki maalkin", "Har creation ko spotlight milni chahiye."] },
  beauty: { en: ["The Beauty Entrepreneur", "Turn your artistry into bookings."], hi: ["Mehendi artist", "Apni kala ko bookings mein badaliye."] },
  education: { en: ["The Educator", "Take your knowledge beyond four walls."], hi: ["Teacher", "Apna gyaan chaar deewaron se aage le jaiye."] },
};
const ORDER = ["bakery", "homefood", "boutique", "beauty", "education"] as const;

const KNOWS = {
  hi: {
    she: [["Apna hunar", "Uske kaam ko khaas kya banata hai"], ["Apne customers", "Kaun kya pasand karta hai"], ["Apna daam", "Apni mehnat ki sahi keemat"], ["Apni quality", "Jo log yaad rakhte hain"], ["Apna sapna", "Business ko kahan tak le jaana hai"]],
    saheli: [["sparkle", "Brand identity"], ["globe", "Domain ki khoj"], ["grid", "Website banana"], ["store", "Product catalogue"], ["inbox", "Online enquiries"], ["check", "Order management"], ["wallet", "UPI payment initiation"], ["trend", "Digital business madad"]],
  },
  en: {
    she: [["Her craft", "What makes her work special"], ["Her customers", "Who likes what"], ["Her pricing", "The right price for her work"], ["Her quality", "What people remember"], ["Her dreams", "How far she wants to go"]],
    saheli: [["sparkle", "Brand identity"], ["globe", "Domain discovery"], ["grid", "Website creation"], ["store", "Product catalogue"], ["inbox", "Online enquiries"], ["check", "Order management"], ["wallet", "UPI payment initiation"], ["trend", "Digital business assistance"]],
  },
} as const;

// Seven steps. `tool` = the real function behind the step (shown small, for the curious).
const JOURNEY = [
  { icon: "user", tool: "save_business_profile", hi: ["Aapka business samajhna", "Aapke products, customers, daam aur sapna"], en: ["Understand your business", "Your products, customers, pricing and vision"] },
  { icon: "camera", tool: "catalog.analyze", hi: ["Products ko jaan dena", "Product photos se sundar listings"], en: ["Bring your products to life", "Turn product photos into beautiful listings"] },
  { icon: "globe", tool: "suggest_domains · GoDaddy", hi: ["Brand ka naam dhoondhna", "Available domains aur unke daam"], en: ["Find your brand name", "Explore available domains and prices"] },
  { icon: "shield", tool: "propose_website", hi: ["Pehle aapki manzoori", "Kuch bhi hone se pehle har kharcha dekhiye"], en: ["Your approval comes first", "Review every cost before anything happens"] },
  { icon: "sparkle", tool: "sitegen.build_site", hi: ["Online dukaan banana", "Aapke business ke hisaab se bani website"], en: ["Build your online store", "A website designed around your business"] },
  { icon: "check", tool: "launch.verify", hi: ["Bharose ke saath launch", "Publish, aur check ki sab theek chal raha hai"], en: ["Launch with confidence", "Publish and check that everything works"] },
  { icon: "trend", tool: "launch.readiness", hi: ["Saheli ke saath aage badhna", "Behtar hone aur badhne ke sujhav"], en: ["Grow with Saheli", "Get suggestions to improve and grow"] },
];

// Saheli's own voice — what she actually says at each moment
const VOICE = {
  hi: [["Naam chunte waqt", "Chaliye, pehle aapke business ka naam sochte hain!"], ["Photos dekh kar", "Aapke products bahut acche hain. Inki photos se ek sundar catalogue banate hain."], ["Launch ke din", "Aapki website live ho gayi! Ab customers tak pahunchte hain."]],
  en: [["Choosing a name", "Chaliye, pehle aapke business ka naam sochte hain!"], ["Seeing her products", "Aapke products bahut acche hain. Inki photos se ek sundar catalogue banate hain."], ["Launch day", "Aapki website live ho gayi! Ab customers tak pahunchte hain."]],
} as const;

const CUSTOMER = {
  hi: [["external", "Customer aapki website kholta hai", "WhatsApp status ya Instagram ke link se"], ["store", "Products dekhta hai", "Photos, daam, details — sab saaf"], ["user", "Items chunta hai, details bharta hai", "Naam, phone, address — koi account nahi"],
       ["check", "Order ban jaata hai", "Order number ke saath, daam server par dobara check"], ["inbox", "Aapko turant khabar milti hai", "Dashboard mein, aur email par"], ["whatsapp", "Baat WhatsApp par aage badhti hai", "Order number ke saath ek click mein"]],
  en: [["external", "Customer visits your website", "From a WhatsApp status or Instagram link"], ["store", "They explore your products", "Photos, prices and details, clearly laid out"], ["user", "They add items and enter their details", "Name, phone, address — no account needed"],
       ["check", "An order is created", "With an order number; prices re-checked on the server"], ["inbox", "You receive the order notification", "In your dashboard, and by email"], ["whatsapp", "Continue the conversation on WhatsApp", "One tap, with the order number"]],
} as const;

const READY = {
  hi: ["Business ka naam aur pehchaan", "Products aur services ki listing", "Sahi daam", "Business ki kahani", "Asli product photos", "Contact aur delivery ki jaankari", "Website ki speed aur HTTPS", "WhatsApp aur UPI setup", "Launch announcements aur promotion"],
  en: ["Business name and identity", "Product and service listings", "Accurate product pricing", "Business story and description", "Original product photographs", "Contact and delivery information", "Website performance and HTTPS", "WhatsApp and UPI setup", "Launch announcements and promotional content"],
} as const;

/** A short Hinglish line that closes a section, in Saheli's voice. */
function Tagline({ children, dark = false, center = false }: { children: string; dark?: boolean; center?: boolean }) {
  return (
    <p data-reveal className={`mt-8 flex items-center gap-2.5 font-display text-[19px] italic sm:text-[22px] ${center ? "justify-center text-center" : ""} ${dark ? "text-saffron" : "text-plum-600"}`}>
      <LogoMark size={20} tile={false} className="not-italic" />{children}
    </p>
  );
}

const DEMO_STEPS = [
  { tool: "save_business_profile", text: "Home bakery · Pune · 6 products" },
  { tool: "suggest_domains", text: "GoDaddy · 6 available names" },
  { tool: "check_domain", text: "anayabakehouse.com · yearly price shown" },
  { tool: "propose_website", text: "Free Saheli address · waiting for “haan”" },
  { tool: "sitegen.build_site", text: "Bakery design · photos · catalogue" },
  { tool: "launch.verify", text: "200 OK · HTTPS · mobile-ready" },
  { tool: "orders.create", text: "Order #1001 · ₹780 · UPI" },
];

/* ------------------------------------------------------------------ hero agent preview */
function AgentDemo({ preview, lang }: { preview?: ShowcaseSite; lang: Lang }) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [step, setStep] = useState(reduce ? DEMO_STEPS.length + 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const wait = step === 0 ? 1400 : step === 4 ? 2200 : step > DEMO_STEPS.length ? 6000 : 950; // pauses at the approval checkpoint
    const t = setTimeout(() => setStep((s) => (s > DEMO_STEPS.length ? 0 : s + 1)), wait);
    return () => clearTimeout(t);
  }, [step, reduce]);
  const live = step > DEMO_STEPS.length;
  const approving = step === 4;

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -inset-6 -z-10 rounded-[40px] blur-xl" style={{ background: "radial-gradient(60% 60% at 70% 20%,rgba(217,150,58,.18),transparent),radial-gradient(60% 60% at 20% 80%,rgba(122,46,99,.16),transparent)" }} />
      <div className="rounded-[28px] border border-line bg-white/90 p-4 shadow-lift backdrop-blur sm:p-5">
        <div className="flex items-center gap-2.5 border-b border-line pb-3">
          <LogoMark size={32} />
          <div className="leading-tight"><b className="text-sm">Saheli</b><span className="block text-[11px] text-muted">{live ? (lang === "hi" ? "Ho gaya — business live hai" : "Done — business is live") : approving ? (lang === "hi" ? "Aapki manzoori ka intezaar" : "Waiting for your approval") : (lang === "hi" ? "Kaam chal raha hai…" : "Working on it…")}</span></div>
          <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${live ? "bg-leaf-50 text-leaf" : approving ? "bg-plum-50 text-plum-700" : "bg-saffron-50 text-[#9A6420]"}`}>
            <span className={`size-1.5 rounded-full ${live ? "bg-leaf" : approving ? "bg-plum-600" : "animate-pulse bg-saffron"}`} />{live ? "LIVE" : approving ? "APPROVAL" : "AGENT"}</span>
        </div>
        <p className="ml-auto mt-3 w-fit max-w-[88%] rounded-2xl rounded-br-md bg-plum-700 px-3.5 py-2 text-[13.5px] text-ivory">Mujhe Pune mein ghar se bakery shuru karni hai. Online orders chahiye.</p>
        <ol className="mt-3 space-y-1.5">
          {DEMO_STEPS.map((s, i) => {
            const state = i < step - 1 ? "done" : i === step - 1 ? "now" : "todo";
            return (
              <li key={s.tool} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all duration-500 ${state === "todo" ? "opacity-30" : "opacity-100"} ${state === "now" ? "bg-plum-50" : ""}`}>
                <span className={`grid size-5 shrink-0 place-items-center rounded-full transition ${state === "done" ? "bg-leaf text-white" : state === "now" ? "bg-plum-700 text-white" : "bg-sand"}`}>
                  {state === "done" ? <Icon name="check" className="size-3" strokeWidth={2.6} /> : state === "now" ? <span className="size-1.5 animate-pulse rounded-full bg-white" /> : null}
                </span>
                <code className="w-[128px] shrink-0 truncate text-[10.5px] text-plum-600 sm:w-[150px] sm:text-[11px]">{s.tool}</code>
                <span className="truncate text-[12.5px] text-ink">{state !== "todo" ? s.text : ""}</span>
              </li>
            );
          })}
        </ol>
        {approving && <div className="mt-2 flex items-center justify-between rounded-xl border border-plum-100 bg-plum-50 px-3 py-2 text-[12.5px] animate-rise"><span>{lang === "hi" ? "Free Saheli address · ₹0" : "Free Saheli address · ₹0"}</span><span className="rounded-full bg-plum-700 px-3 py-1 font-semibold text-ivory">{lang === "hi" ? "Haan, banao" : "Yes, build it"}</span></div>}
        <div className={`mt-3 overflow-hidden rounded-2xl border transition-all duration-700 ${live ? "max-h-56 border-leaf/40 opacity-100" : "max-h-0 border-transparent opacity-0"}`}>
          {preview ? <ScaledFrame src={preview.url} title="Live website" height={170} /> : (
            <div className="grid h-[170px] place-items-center bg-cream text-sm text-muted">anaya-bake-house.saheliai.com</div>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">{lang === "hi" ? "Udaharan · neeche ka preview Saheli ki banayi asli demo website hai" : "Example · the preview is a real Saheli-built demo website"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ showcase card */
function SiteCard({ s, lang }: { s: ShowcaseSite; lang: Lang }) {
  const persona = PERSONA[s.archetype]?.[lang];
  return (
    <article className="flex w-[300px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[.04] transition duration-300 hover:-translate-y-1 hover:border-white/25 sm:w-[440px]">
      {persona && <div className="px-5 pb-3 pt-4"><p className="font-display text-[19px] leading-tight text-ivory">{persona[0]}</p><p className="mt-0.5 text-[13px] text-ivory/60">{persona[1]}</p></div>}
      <div className="flex items-center gap-1.5 border-y border-white/10 px-4 py-2.5">
        {["#E8B4B8", "#E9D3A3", "#B9D7C4"].map((c) => <span key={c} className="size-2 rounded-full" style={{ background: c }} />)}
        <span className="ml-2 truncate rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] text-ivory/60">{s.slug}.saheliai.com</span>
      </div>
      <ScaledFrame src={s.url} title={s.name} height={260} />
      <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
        <b className="min-w-0 flex-1 truncate font-display text-lg">{s.name}</b>
        {s.readiness && <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-ivory/80" title="Launch readiness — computed from real checks">{s.readiness.score}/100</span>}
        <a href={s.url} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ivory px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white">{lang === "hi" ? "Kholiye" : "Open"}<Icon name="external" className="size-3.5" /></a>
      </div>
    </article>
  );
}

/** Counts up to `to` the first time it scrolls into view. */
function CountUp({ to, ms = 1300 }: { to: number; ms?: number }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { setV(to); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, ms]);
  return <span ref={ref}>{v}</span>;
}

const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/* ------------------------------------------------------------------ page */
export function Landing({ lang, onStart, onVoice, onDashboard, hasSites, footer }: { lang: Lang; onStart: () => void; onVoice: () => void; onDashboard: () => void; hasSites: boolean; footer?: ReactNode }) {
  const t = C[lang];
  const [sites, setSites] = useState<ShowcaseSite[] | null>(null);
  const [data, setData] = useState<LandingData | null>(null);
  const voiceOk = voiceSupported();

  useEffect(() => {
    let tries = 0, timer: ReturnType<typeof setTimeout>;
    // demo sites build in the background on first start — poll briefly until they appear
    const load = () => api.showcase().then((r) => { setSites(r.sites); if (r.sites.length < 5 && ++tries < 12) timer = setTimeout(load, 10000); }).catch(() => setSites([]));
    load();
    api.landing().then(setData).catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  // scroll reveal: one observer for every [data-reveal] element (re-run when async content appears)
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sites, data, lang]);

  const byType = (k: string) => sites?.find((s) => s.archetype === k);
  const ordered = ORDER.map(byType).filter(Boolean) as ShowcaseSite[];
  const rail = useRef<HTMLDivElement>(null);
  const slide = (dir: 1 | -1) => {
    const el = rail.current;
    const card = el?.firstElementChild as HTMLElement | null;
    el?.scrollBy({ left: dir * ((card?.offsetWidth ?? 440) + 20), behavior: "smooth" });
  };
  const bakery = byType("bakery");
  const price = data?.pricing;
  const domainInr = price?.live && price.price ? (price.price.approx_inr ?? (price.price.currency === "INR" ? price.price.amount : null)) : null;
  const doneSet = new Set(bakery?.readiness?.done_labels ?? []);
  const readyDone = (i: number) => (i === 7 ? doneSet.has("WhatsApp ordering setup") && doneSet.has("UPI payment setup") : doneSet.has(READY.en[i]));

  const Eyebrow = ({ children, tone = "text-rose" }: { children: string; tone?: string }) => <p className={`text-[11.5px] font-bold uppercase tracking-[.16em] ${tone}`}>{children}</p>;

  const MicCta = ({ dark = false }: { dark?: boolean }) => (
    <button onClick={voiceOk ? onVoice : onStart} className="group inline-flex items-center gap-3.5 rounded-full py-1.5 pl-1.5 pr-6 text-base font-semibold transition active:scale-[.98]"
      style={{ background: dark ? "rgba(255,255,255,.1)" : "#fff", boxShadow: dark ? "none" : "var(--shadow-lift)" }} aria-describedby={voiceOk ? undefined : "novoice"}>
      <span className="relative grid size-14 place-items-center rounded-full text-white" style={{ background: "linear-gradient(140deg,#7A2E63,#B4475F)" }}>
        {voiceOk && <><span className="absolute inset-0 animate-ring rounded-full bg-rose/35" /><span className="absolute inset-0 animate-ring rounded-full bg-rose/25 [animation-delay:.8s]" /></>}
        <Icon name="mic" className="relative size-6" />
      </span>
      <span className={dark ? "text-white" : "text-plum-700"}>{t.speak}</span>
    </button>
  );

  const boutiqueImg = data?.photos?.boutique?.src_small ?? byType("boutique")?.image ?? null;
  const WomanCard = ({ k, className, i, small = false }: { k: keyof typeof WOMEN; className: string; i: number; small?: boolean }) => {
    const w = WOMEN[k], [tag, title, line] = w[lang];
    const img = k === "boutique" ? boutiqueImg : w.img;
    return (
      <figure data-reveal className={`group relative overflow-hidden rounded-[28px] ${className}`} style={{ background: w.tone, ["--d" as string]: `${i * 90}ms` }}>
        {img ? <img src={img} alt={title} decoding="async" width={900} height={700}
            // fade in once loaded (the card's colour shows meanwhile) instead of popping in
            className="absolute inset-0 size-full object-cover opacity-0 transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.05]" style={{ objectPosition: w.pos }}
            onLoad={(e) => e.currentTarget.classList.remove("opacity-0")} ref={(el) => { if (el?.complete && el.naturalWidth) el.classList.remove("opacity-0"); }}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 24px 24px,rgba(227,164,71,.75) 3px,transparent 3.5px),radial-gradient(circle at 24px 24px,transparent 9px,rgba(242,201,210,.45) 9.5px,rgba(242,201,210,.45) 11px,transparent 11.5px),radial-gradient(circle at 0 0,rgba(227,164,71,.4) 2px,transparent 2.5px)", backgroundSize: "48px 48px" }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(20,10,16,0) 30%,rgba(20,10,16,.55) 60%,rgba(20,10,16,.9))" }} />
        <figcaption className={`absolute inset-x-0 bottom-0 text-white ${small ? "p-4" : "p-5 sm:p-6"}`}>
          <span className="inline-block rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{tag}</span>
          <b className={`mt-2 block font-display font-normal leading-tight ${small ? "text-[18px] sm:text-[20px]" : "text-[22px] sm:text-[28px]"}`}>{title}</b>
          <span className={`mt-1 block max-w-md text-white/80 ${small ? "hidden text-[12.5px] sm:block" : "text-[13.5px]"}`}>{line}</span>
        </figcaption>
      </figure>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {/* ================= hero ================= */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(50% 60% at 85% 10%,rgba(217,150,58,.14),transparent),radial-gradient(45% 55% at 0% 100%,rgba(122,46,99,.10),transparent)" }} />
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 pb-16 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:pb-24">
          <div className="animate-rise">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold text-plum-700 backdrop-blur sm:text-xs">
              <span className="size-1.5 shrink-0 rounded-full bg-saffron" />{t.pill}</p>
            <h1 className="mt-6 font-display text-[40px] leading-[1.05] tracking-[-0.02em] text-ink sm:text-[56px] lg:text-[clamp(44px,4.2vw,60px)]">
              <span className="hero-line">{t.h1a} </span>
              <span className="hero-line text-plum-700" style={{ animationDelay: ".1s" }}><span className="hero-mark">{t.h1b}</span></span>
            </h1>
            <p className="hero-line mt-5 block font-display text-[20px] italic text-plum-600 sm:text-[23px]" style={{ animationDelay: ".2s" }}>{t.tag}</p>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">{t.sub}</p>

            <div className="mt-6 rounded-2xl border border-line bg-white/70 p-3.5 sm:max-w-xl">
              <div className="flex flex-wrap gap-1.5">
                {["हिंदी", "Hinglish", "English"].map((a) => <span key={a} className="rounded-full bg-plum-50 px-3 py-1 text-xs font-semibold text-plum-700">{a}</span>)}
              </div>
              <p className="mt-2 text-sm text-muted">{t.langNote}</p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <MicCta />
              <button onClick={onStart} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-white/60 px-5 text-[15px] font-semibold text-ink transition hover:border-plum-600 hover:text-plum-700">{t.type}<Icon name="arrow" className="size-4" /></button>
            </div>
            {!voiceOk && <p id="novoice" className="mt-3 max-w-xl text-xs text-muted">{t.noVoice}</p>}
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {t.trust.map((x) => <li key={x} className="flex items-center gap-1.5"><Icon name="check" className="size-4 text-leaf" />{x}</li>)}
            </ul>
            {hasSites && <button onClick={onDashboard} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-plum-700 hover:underline"><Icon name="grid" className="size-4" />{lang === "hi" ? "Meri websites" : "My websites"}</button>}
          </div>
          <div className="animate-rise [animation-delay:.15s]"><AgentDemo preview={bakery} lang={lang} /></div>
        </div>
      </section>

      {/* ================= ticker ================= */}
      <div className="ticker border-y border-line bg-white/60 py-3.5" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((k) => (
            <span key={k} className="flex shrink-0 items-center">
              {(lang === "hi" ? ["Ghar ka achaar", "Tiffin service", "Home bakery", "Block-print kurtis", "Bridal mehendi", "Home tuition", "Papad & masale", "Handloom sarees", "Cake orders", "Silai & alteration"]
                : ["Homemade achaar", "Tiffin service", "Home bakery", "Block-print kurtis", "Bridal mehendi", "Home tuition", "Papad & masala", "Handloom sarees", "Custom cakes", "Tailoring"]).map((x) => (
                <span key={x} className="flex items-center gap-6 pr-6 font-display text-lg text-ink/70"><LogoMark size={14} tile={false} />{x}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ================= demo video ================= */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <div className="max-w-3xl" data-reveal>
          <Eyebrow>{t.vEyebrow}</Eyebrow>
          <h2 className="mt-2 font-display text-[34px] leading-tight sm:text-5xl">{t.vTitle}</h2>
          <p className="mt-3 text-[17px] text-muted">{t.vSub}</p>
        </div>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <DemoVideo lang={lang} onTry={onStart} />
          <ol className="grid content-start gap-1 self-start rounded-3xl border border-line bg-white p-4 sm:p-5">
            {STORYBOARD[lang].map(([a, b], i) => (
              <li key={a} className="flex gap-3 rounded-xl px-2 py-1.5">
                <span className="mt-0.5 w-6 shrink-0 text-right font-display text-sm text-plum-600">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm"><b className="block font-semibold">{a}</b><span className="text-muted">{b}</span></span>
              </li>
            ))}
          </ol>
        </div>
        <Tagline>{t.vTag}</Tagline>
      </section>

      {/* ================= how Saheli works ================= */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="max-w-2xl" data-reveal>
          <Eyebrow>{t.jEyebrow}</Eyebrow>
          <h2 className="mt-2 font-display text-[34px] leading-tight sm:text-5xl">{t.jTitle}</h2>
          <p className="mt-3 text-[17px] text-muted">{t.jSub}</p>
        </div>
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY.map((j, i) => {
            const [title, desc] = j[lang];
            return (
              <li key={j.tool} data-reveal style={{ ["--d" as string]: `${i * 70}ms` }} className="group relative flex flex-col rounded-3xl border border-line bg-white p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="flex items-center justify-between">
                  <span className={`grid size-11 place-items-center rounded-2xl transition ${i === 3 ? "bg-plum-700 text-ivory" : "bg-plum-50 text-plum-700 group-hover:bg-plum-700 group-hover:text-ivory"}`}><Icon name={j.icon} /></span>
                  <span className="font-display text-3xl text-sand">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-[17px] font-semibold">{title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{desc}</p>
                <code className="mt-4 block break-words text-[10.5px] text-muted/80" title="The real function behind this step">{j.tool}()</code>
              </li>
            );
          })}
          <li data-reveal style={{ ["--d" as string]: "490ms" }} className="flex flex-col justify-between rounded-3xl bg-plum-700 p-5 text-ivory">
            <Icon name="shield" className="size-7" />
            <div><p className="font-display text-2xl leading-tight">{t.jFail[0]}</p>
              <p className="mt-2 text-sm text-ivory/75">{t.jFail[1]}</p></div>
          </li>
        </ol>
        <Tagline>{t.jTag}</Tagline>
      </section>

      {/* ================= who it's for: a celebration ================= */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="max-w-3xl" data-reveal>
          <Eyebrow>{t.wEyebrow}</Eyebrow>
          <h2 className="mt-2 font-display text-[36px] leading-[1.06] sm:text-[56px]">{t.wTitle[0]} <span className="text-plum-700">{t.wTitle[1]}</span></h2>
          <p className="mt-4 text-[17.5px] leading-relaxed text-muted">{t.wSub}</p>
        </div>
        <div className="mt-10 grid auto-rows-[230px] grid-cols-2 gap-3 sm:gap-4 lg:auto-rows-[270px] lg:grid-cols-4">
          <WomanCard k="homefood" i={0} className="col-span-2 row-span-2" />
          <WomanCard k="beauty" i={1} className="col-span-2" />
          <WomanCard k="bakery" i={2} className="col-span-1" small />
          <WomanCard k="education" i={3} className="col-span-1" small />
          <WomanCard k="boutique" i={4} className="col-span-2" />
          <div data-reveal style={{ ["--d" as string]: "450ms" }} className="col-span-2 flex flex-col justify-between rounded-[28px] bg-plum-700 p-6 text-ivory sm:p-7">
            <div><p className="font-display text-[26px] leading-tight sm:text-[30px]">{t.wCta[0]}</p>
              <p className="mt-2 max-w-md text-[15px] text-ivory/75">{t.wCta[1]}</p></div>
            <button onClick={voiceOk ? onVoice : onStart} className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-ivory px-5 py-2.5 text-sm font-semibold text-plum-700 transition hover:bg-white">
              <Icon name="mic" className="size-4" />{t.wCta[2]}</button>
          </div>
        </div>
      </section>

      {/* ================= not a tool, a partner ================= */}
      <section className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-10 px-5 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div data-reveal>
          <Eyebrow>{t.pEyebrow}</Eyebrow>
          <h2 className="mt-2 font-display text-[34px] leading-[1.08] sm:text-5xl">{t.pTitle[0]} <span className="text-plum-700">{t.pTitle[1]}</span></h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">{t.pSub}</p>
        </div>
        <ol className="space-y-4">
          {VOICE[lang].map(([when, line], i) => (
            <li key={when} data-reveal style={{ ["--d" as string]: `${150 + i * 220}ms` }} className={`flex items-end gap-3 ${i === 1 ? "lg:ml-10" : ""}`}>
              <LogoMark size={38} />
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">{when}</p>
                <p className="rounded-3xl rounded-bl-md border border-line bg-white px-5 py-3.5 font-display text-[19px] leading-snug text-ink shadow-card sm:text-[21px]">{line}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= philosophy ================= */}
      <section className="px-5 pb-20">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-[#1F1219] px-6 py-14 text-ivory sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(45% 60% at 0% 0%,rgba(217,150,58,.22),transparent),radial-gradient(45% 60% at 100% 100%,rgba(180,71,95,.28),transparent)" }} />
          <div className="relative">
            <h2 data-reveal className="max-w-4xl font-display text-[34px] leading-[1.08] sm:text-[56px]">{t.kTitle[0]} <span className="text-saffron">{t.kTitle[1]}</span></h2>
            <p className="mt-5 max-w-2xl text-[17.5px] leading-relaxed text-ivory/75">{t.kSub}</p>
            <div className="mt-10 grid gap-4 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
                <p className="text-[11.5px] font-bold uppercase tracking-[.16em] text-saffron">{t.kShe}</p>
                <ul className="mt-4 space-y-3.5">
                  {KNOWS[lang].she.map(([a, b], i) => <li key={a} data-reveal style={{ ["--d" as string]: `${i * 80}ms` }} className="flex items-start gap-3"><Icon name="leaf" className="mt-1.5 size-4 shrink-0 text-saffron" /><span><b className="block font-display text-[20px] font-normal leading-snug">{a}</b><span className="text-sm text-ivory/60">{b}</span></span></li>)}
                </ul>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
                <p className="text-[11.5px] font-bold uppercase tracking-[.16em] text-[#E8A3B5]">{t.kSaheli}</p>
                <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {KNOWS[lang].saheli.map(([ic, x], i) => <li key={x} data-reveal style={{ ["--d" as string]: `${200 + i * 70}ms` }} className="flex items-center gap-2.5 rounded-2xl bg-white/[.06] px-3 py-3 text-[14px] transition hover:bg-white/[.12]"><Icon name={ic} className="size-4 shrink-0 text-[#E8A3B5]" />{x}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-12 text-center" data-reveal>
              <p className="font-display text-[34px] leading-tight sm:text-5xl">{t.kLine}</p>
              <p className="mt-3 font-display text-[19px] italic text-saffron sm:text-[22px]">{t.kLine2}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= showcase ================= */}
      <section className="bg-[#1F1219] pb-10 pt-16 text-ivory">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-5" data-reveal>
          <div>
            <Eyebrow tone="text-saffron">{t.sEyebrow}</Eyebrow>
            <h2 className="mt-2 max-w-3xl font-display text-[34px] leading-tight sm:text-5xl">{t.sTitle}</h2>
            <p className="mt-3 max-w-2xl text-[17px] text-ivory/70">{t.sSub}</p>
          </div>
          {ordered.length > 1 && (
            <div className="hidden shrink-0 gap-2 sm:flex">
              {([-1, 1] as const).map((dir) => (
                <button key={dir} type="button" onClick={() => slide(dir)} aria-label={dir < 0 ? "Previous website" : "Next website"}
                  className="grid size-11 place-items-center rounded-full border border-white/20 text-ivory transition hover:border-saffron hover:text-saffron">
                  <Icon name="arrow" className={`size-5 ${dir < 0 ? "rotate-180" : ""}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        {sites === null ? (
          <div className="mt-10 flex gap-5 overflow-hidden px-5 sm:px-[max(20px,calc((100vw-1152px)/2+20px))]">{[0, 1, 2].map((i) => <div key={i} className="h-[380px] w-[300px] shrink-0 rounded-3xl bg-white/5 sm:w-[440px]" />)}</div>
        ) : ordered.length ? (
          <div ref={rail} className="mt-8 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 [scrollbar-width:none] sm:scroll-px-[max(20px,calc((100vw-1152px)/2+20px))] sm:px-[max(20px,calc((100vw-1152px)/2+20px))] [&::-webkit-scrollbar]:hidden">
            {ordered.map((s, i) => <div key={s.slug} data-reveal className="shrink-0 snap-start" style={{ ["--d" as string]: `${i * 90}ms` }}><SiteCard s={s} lang={lang} /></div>)}
          </div>
        ) : (
          <div className="mx-auto mt-10 max-w-6xl px-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-ivory/80">
              {lang === "hi" ? "Demo websites server par ban rahi hain (pehli baar 1–2 minute, internet chahiye). Ye section apne aap update ho jaayega." : "The demo websites are being built on the server (first start takes 1–2 minutes and needs internet). This section updates automatically."}
            </div>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-5"><Tagline dark center>{t.sTag}</Tagline></div>
      </section>

      {/* ================= first customer ================= */}
      <section className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)]">
        <div>
          <div data-reveal>
            <Eyebrow tone="text-leaf">{t.cEyebrow}</Eyebrow>
            <h2 className="mt-2 font-display text-[34px] leading-tight sm:text-5xl">{t.cTitle}</h2>
            <p className="mt-3 text-[17px] text-muted">{t.cSub}</p>
          </div>
          <ol className="mt-8 grid gap-2.5 sm:grid-cols-2">
            {CUSTOMER[lang].map(([ic, a, b], i) => (
              <li key={a} data-reveal style={{ ["--d" as string]: `${i * 70}ms` }} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-leaf-50 text-leaf"><Icon name={ic} className="size-[18px]" /></span>
                <span className="text-sm"><b className="block"><span className="mr-1 text-muted">{String(i + 1).padStart(2, "0")}</span>{a}</b><span className="text-muted">{b}</span></span>
              </li>
            ))}
          </ol>
          <div data-reveal className="mt-5 rounded-2xl border border-line bg-white p-4">
            <p className="text-sm font-semibold">{lang === "hi" ? "Payments — seedha aur saaf" : "Payments — simple and transparent"}</p>
            <ul className="mt-2.5 space-y-2 text-sm">
              <li className="flex gap-2"><Icon name="wallet" className="mt-0.5 size-4 shrink-0 text-leaf" /><span><b>{lang === "hi" ? "UPI payment initiation" : "UPI payment initiation"}</b> — <span className="text-muted">{lang === "hi" ? "customer ka UPI app order ki rakam aur details ke saath khulta hai; paisa seedha aapke UPI ID mein." : "customers can open their UPI app with the order amount and details; money goes straight to your UPI ID."}</span></span></li>
              <li className="flex gap-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-leaf" /><span><b>{lang === "hi" ? "Aapki confirmation" : "Owner confirmation"}</b> — <span className="text-muted">{lang === "hi" ? "aap apne UPI app mein payment dekh kar order update karti hain." : "you verify the payment in your UPI app and update the order."}</span></span></li>
              <li className="flex gap-2"><Icon name="shield" className="mt-0.5 size-4 shrink-0 text-leaf" /><span><b>{lang === "hi" ? "Koi jhoothi confirmation nahi" : "No false payment confirmation"}</b> — <span className="text-muted">{lang === "hi" ? "aapki pakki confirmation ke bina Saheli kabhi kisi order ko 'paid' nahi maanti." : "Saheli never marks an order paid without verified confirmation from you."}</span></span></li>
            </ul>
          </div>
          <Tagline>{t.cTag}</Tagline>
        </div>
        <div className="relative mx-auto w-full max-w-[360px]" data-reveal>
          <div className="rounded-[40px] border-[10px] border-[#1F1219] bg-[#FBF5EE] p-5 shadow-lift">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-[#1F1219]/15" />
            <span className="grid size-12 place-items-center rounded-full bg-[#1E9E57] text-white"><Icon name="check" className="size-6" strokeWidth={2.4} /></span>
            <p className="mt-3 font-display text-[26px] leading-tight text-[#2B1D14]">Order #1001 placed</p>
            <p className="mt-1 text-[13px] text-[#7A6A5E]">Saved. Complete the payment below, then send it on WhatsApp.</p>
            <div className="mt-4 space-y-1.5 border-y border-[#E8DCCD] py-3 text-[13.5px] text-[#2B1D14]">
              <p className="flex justify-between"><span>Raw mango pickle × 2</span><span>₹500</span></p>
              <p className="flex justify-between"><span>Stuffed red chilli × 1</span><span>₹280</span></p>
            </div>
            <p className="mt-3 flex items-baseline justify-between text-[#2B1D14]"><span className="text-sm">Total</span><b className="font-display text-3xl font-normal">₹780</b></p>
            <div className="mt-4 rounded-full bg-[#9E3B1B] py-3 text-center text-[14px] font-semibold text-white">Pay ₹780 via UPI</div>
            <div className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[#1E9E57] py-3 text-[14px] font-semibold text-white"><Icon name="whatsapp" className="size-4" />Send order on WhatsApp</div>
          </div>
          <div className="absolute -right-3 -top-6 w-[220px] rounded-2xl border border-line bg-white p-3.5 shadow-lift sm:-right-16 sm:top-24">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-leaf"><span className="size-1.5 rounded-full bg-leaf" />{lang === "hi" ? "Naya order" : "New order"}</p>
            <p className="mt-1 text-sm"><b>#1001</b> · Priya · <b>₹780</b></p>
            <p className="text-xs text-[#9A6420]">UPI payment pending</p>
          </div>
          <p className="mt-4 text-center text-[11px] text-muted">{lang === "hi" ? "Saheli website ka asli checkout screen" : "The real checkout screen of a Saheli website"}</p>
        </div>
      </section>

      {/* ================= pricing ================= */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div data-reveal>
          <Eyebrow>{t.aEyebrow}</Eyebrow>
          <h2 className="mt-2 max-w-3xl font-display text-[34px] leading-tight sm:text-5xl">{t.aTitle}</h2>
          <p className="mt-3 max-w-2xl text-[17px] text-muted">{t.aSub}</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div data-reveal className="lift rounded-3xl border-2 border-leaf/40 bg-white p-7">
            <div className="flex items-center justify-between"><Pill tone="leaf">{lang === "hi" ? "Free plan" : "Free plan"}</Pill><span className="font-display text-4xl">₹0</span></div>
            <ul className="mt-5 grid gap-2.5 text-[15px] sm:grid-cols-2">
              {(lang === "hi" ? ["Aapke hisaab se onboarding", "Business profile", "Free Saheli subdomain", "Basic online dukaan", "Product catalogue", "Order management", "Customer enquiries", "UPI payment initiation"]
                : ["Personalised business onboarding", "Business profile creation", "Free Saheli subdomain", "Basic online storefront", "Product catalogue", "Order management", "Customer enquiries", "UPI payment initiation"]).map((a) => (
                <li key={a} className="flex gap-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-leaf" />{a}</li>
              ))}
            </ul>
            <p className="mt-5 rounded-xl bg-cream px-3 py-2 font-mono text-[13px] text-plum-700">aapka-business.saheliai.com</p>
          </div>
          <div data-reveal style={{ ["--d" as string]: "120ms" }} className="lift rounded-3xl border border-line bg-white p-7">
            <div className="flex items-center justify-between"><Pill tone="saffron">{lang === "hi" ? "Optional · paid" : "Optional · paid"}</Pill><span className="text-right text-xs text-muted">{lang === "hi" ? "daam hamesha pehle" : "price always shown first"}</span></div>
            <ul className="mt-5 space-y-3.5 text-[15px]">
              <li className="flex gap-2.5"><Icon name="globe" className="mt-0.5 size-5 shrink-0 text-saffron" /><span className="min-w-0">
                <b className="font-semibold">{lang === "hi" ? "Aapka apna .com domain" : "Your own .com domain"}</b>
                <span className="block text-sm text-muted">
                  {price?.live ? (<>{price.domain}: {price.available ? (domainInr ? `${lang === "hi" ? "available · pehla saal lagbhag" : "available · first year approx."} ${rupees(domainInr)}` : "available") : (lang === "hi" ? "le liya gaya — chat mein dusre naam milte hain" : "taken — chat shows other names")}
                    {" "}<span className="text-xs">({lang === "hi" ? "GoDaddy se live" : "live from GoDaddy"})</span></>)
                    : (lang === "hi" ? "Har naam ka saal ka daam chat mein GoDaddy se live dikhta hai." : "Each name's yearly price is shown live from GoDaddy in the chat.")}
                </span></span></li>
              <li className="flex gap-2.5"><Icon name="shield" className="mt-0.5 size-5 shrink-0 text-saffron" /><span><b className="font-semibold">{lang === "hi" ? "Premium hosting (agar zaroorat ho)" : "Premium hosting (if applicable)"}</b><span className="block text-sm text-muted">{lang === "hi" ? "Abhi koi paid plan nahi. Aaya to daam pehle." : "No paid plan today. If one is added, its price comes first."}</span></span></li>
              <li className="flex gap-2.5"><Icon name="inbox" className="mt-0.5 size-5 shrink-0 text-saffron" /><span><b className="font-semibold">{lang === "hi" ? "Business email" : "Business email"}</b><span className="block text-sm text-muted">{lang === "hi" ? "Jaise naam@aapkabusiness.com — provider ka daam pehle." : "Like you@yourbusiness.com — the provider's price, shown first."}</span></span></li>
              <li className="flex gap-2.5"><Icon name="wallet" className="mt-0.5 size-5 shrink-0 text-saffron" /><span><b className="font-semibold">{lang === "hi" ? "Payment gateway" : "Third-party payment gateway"}</b><span className="block text-sm text-muted">{lang === "hi" ? "Jab automatic payment confirmation chahiye ho." : "For when you want automatic payment confirmation."}</span></span></li>
            </ul>
            <p className="mt-5 text-xs text-muted">{lang === "hi" ? "Farak: Saheli subdomain free aur turant milta hai. .com aapke naam par registered alag naam hai." : "The difference: your Saheli subdomain is free and instant. A .com is a separate name registered to you."}</p>
          </div>
        </div>
        <p data-reveal className="mt-6 flex items-center justify-center gap-2 text-center text-[15px] font-semibold text-ink"><Icon name="shield" className="size-5 text-leaf" />{t.aMoney}</p>
        <Tagline center>{t.aTag}</Tagline>
      </section>

      {/* ================= readiness ================= */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div data-reveal className="grid gap-8 rounded-[32px] border border-line bg-white p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Eyebrow>{t.rEyebrow}</Eyebrow>
            <h2 className="mt-2 font-display text-[32px] leading-tight sm:text-[42px]">{t.rTitle}</h2>
            <p className="mt-3 text-muted">{t.rSub}</p>
            <div className="mt-6 flex items-start gap-3">
              <LogoMark size={38} />
              <p className="rounded-3xl rounded-tl-md bg-plum-50 px-5 py-4 font-display text-[18px] leading-snug text-ink">{t.rQuote}</p>
            </div>
            <Tagline>{t.rTag}</Tagline>
          </div>
          <div className="rounded-3xl border border-line p-6">
            {bakery?.readiness && (
              <div className="mb-5 flex items-center gap-4 border-b border-line pb-5">
                <div className="relative size-20 shrink-0">
                  <svg viewBox="0 0 36 36" className="size-20 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="#E9DDCF" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={bakery.readiness.score >= 80 ? "#2F7D5B" : bakery.readiness.score >= 55 ? "#D9963A" : "#B4475F"} strokeWidth="3" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset={97.4 * (1 - bakery.readiness.score / 100)} className="ring-fill" /></svg>
                  <span className="absolute inset-0 grid place-items-center font-display text-2xl"><CountUp to={bakery.readiness.score} /></span>
                </div>
                <p className="text-sm"><b>{bakery.name}</b><span className="block text-muted">{lang === "hi" ? "Demo website ka abhi ka asli score" : "Live score of a demo site, right now"}</span></p>
              </div>
            )}
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-muted">{lang === "hi" ? "Saheli kya check karti hai" : "What Saheli checks"}</p>
            <ul className="mt-3 space-y-2 text-[14.5px]">
              {READY[lang].map((x, i) => {
                const done = bakery?.readiness ? readyDone(i) : null;
                return (
                  <li key={x} className="flex items-center gap-2.5">
                    {done === null ? <Icon name="check" className="size-4 text-plum-600" /> : done
                      ? <span className="grid size-[18px] place-items-center rounded-full bg-leaf text-white"><Icon name="check" className="size-3" strokeWidth={3} /></span>
                      : <span className="size-[18px] rounded-full border-2 border-sand" />}
                    <span className={done === false ? "text-muted" : ""}>{x}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= final CTA ================= */}
      <section className="px-5 pb-16">
        <div data-reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-plum-700 px-6 py-14 text-center sm:py-20">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(40% 70% at 10% 0%,rgba(217,150,58,.35),transparent),radial-gradient(40% 70% at 100% 100%,rgba(180,71,95,.45),transparent)" }} />
          <LogoMark size={56} className="relative mx-auto" />
          <h2 className="relative mx-auto mt-6 max-w-3xl font-display text-[34px] leading-tight text-ivory sm:text-5xl">{t.final}</h2>
          <p className="relative mt-3 font-display text-[19px] italic text-saffron sm:text-[22px]">{t.tag}</p>
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-4">
            <MicCta dark />
            <button onClick={onStart} className="min-h-12 rounded-full bg-ivory px-6 font-semibold text-plum-700 transition hover:bg-white">{t.type}</button>
          </div>
        </div>
      </section>

      {footer}
    </div>
  );
}
