import { useEffect, useRef, useState } from "react";
import type { Lang } from "../types";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";

/**
 * Product demo video. Configure with (frontend/.env):
 *   VITE_DEMO_VIDEO_URL=/demo/saheli-demo.mp4        (default; put the file in frontend/public/demo/)
 *   VITE_DEMO_POSTER_URL=/demo/poster.jpg            (thumbnail, default)
 *   VITE_DEMO_CAPTIONS_URL=/demo/saheli-demo.hi.vtt  (only for a video WITHOUT burned-in captions)
 * The player first checks that a real video file exists. If it doesn't, it says so and shows the storyboard —
 * it never shows a play button for a video that isn't there. No autoplay; sound only after the user presses play.
 */
const env = import.meta.env;
const SRC: string = env.VITE_DEMO_VIDEO_URL || "/demo/saheli-demo.mp4";
// The bundled walkthrough has Hindi captions burned in. Set VITE_DEMO_CAPTIONS_URL only for a video without them.
const CAPTIONS: string | undefined = env.VITE_DEMO_CAPTIONS_URL || undefined;
const POSTER: string = env.VITE_DEMO_POSTER_URL || "/demo/poster.jpg";

export const STORYBOARD = {
  hi: [
    ["Aapka sapna samajhna", "“Mere paas 20 tarah ke achaar hain…” — Saheli dhyaan se sunti hai"],
    ["Aapke business ko jaanna", "Daam, delivery, WhatsApp, UPI — ek-ek sawaal"],
    ["Business ko pehchaan dena", "Naam, tagline aur aapke hisaab ka design"],
    ["Products ka catalogue", "Photos se sundar listings"],
    ["Business ka apna naam", "GoDaddy par available domains"],
    ["Har kharcha pehle", "Free Saheli address ₹0 · .com ka asli daam"],
    ["Faisla aapka. Hamesha.", "“Haan, banao” ke bina kuch nahi hota"],
    ["Online dukaan taiyaar", "Website, catalogue aur order flow"],
    ["Live, aur check bhi", "Saheli khud website khol kar dekhti hai"],
    ["Pehla customer", "Order #1001 — seedha dashboard mein"],
  ],
  en: [
    ["Understand your dream", "“I have 20 kinds of achaar…” — Saheli listens"],
    ["Get to know your business", "Prices, delivery, WhatsApp, UPI — one question at a time"],
    ["Give your business an identity", "Name, tagline and a design made for you"],
    ["Turn products into a catalogue", "Beautiful listings from your photos"],
    ["Find your business its own name", "Available domains from GoDaddy"],
    ["Know every cost upfront", "Free Saheli address ₹0 · real .com price"],
    ["You decide. Always.", "Nothing happens without your “yes”"],
    ["Build your online store", "Website, catalogue and order flow"],
    ["Go live and verify", "Saheli opens your website to check it"],
    ["Your first customer", "Order #1001 — straight to your dashboard"],
  ],
} as const;

type State = "checking" | "ready" | "missing";

export function DemoVideo({ lang, onTry }: { lang: Lang; onTry: () => void }) {
  const [state, setState] = useState<State>("checking");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let alive = true;
    // dev servers and SPA hosts answer unknown paths with index.html — only a real video content-type counts
    fetch(SRC, { method: "HEAD" })
      .then((r) => { if (alive) setState(r.ok && (r.headers.get("content-type") || "").startsWith("video/") ? "ready" : "missing"); })
      .catch(() => alive && setState("missing"));
    return () => { alive = false; };
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const play = () => { setPlaying(true); requestAnimationFrame(() => ref.current?.play().catch(() => setPlaying(false))); };

  return (
    <div className="relative self-start overflow-hidden rounded-[28px] border border-line bg-[#1F1219] shadow-lift">
      <div className="relative aspect-video w-full">
        {state === "ready" && (
          <video ref={ref} className={`absolute inset-0 size-full bg-black object-contain ${playing ? "" : "invisible"}`} controls={playing} preload="metadata"
            playsInline poster={POSTER} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onEnded={() => setPlaying(false)}>
            <source src={SRC} />
            {CAPTIONS && <track kind="subtitles" srcLang="hi" label="हिंदी / Hinglish" src={CAPTIONS} default />}
          </video>
        )}

        {!playing && state === "ready" && (
          <button onClick={play} className="group absolute inset-0 block text-left" aria-label={lang === "hi" ? "Demo video chalaiye" : "Play demo video"}>
            <img src={POSTER} alt="" className="absolute inset-0 size-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <span className="absolute bottom-3 right-3 grid size-12 place-items-center rounded-full bg-plum-700 text-ivory shadow-lift transition duration-300 group-hover:scale-110 sm:bottom-[12%] sm:left-1/2 sm:right-auto sm:size-20 sm:-translate-x-1/2">
              <span className="absolute inset-0 animate-ring rounded-full bg-plum-600/40" />
              <svg viewBox="0 0 24 24" className="relative ml-0.5 size-5 sm:ml-1 sm:size-9" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
            </span>
            <span className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-plum-700 sm:bottom-4 sm:left-4 sm:text-xs">
              <span className="hidden rounded-full bg-plum-50 px-2.5 py-1 sm:inline">Product walkthrough</span>
              <span className="rounded-full bg-plum-50 px-2.5 py-1">Hindi captions</span>
              {duration && <span className="rounded-full bg-plum-50 px-2.5 py-1 font-mono">{fmt(duration)}</span>}
            </span>
          </button>
        )}

        {!playing && state !== "ready" && (
          <div className="absolute inset-0">
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 80% at 15% 20%,rgba(217,150,58,.28),transparent),radial-gradient(60% 80% at 90% 90%,rgba(180,71,95,.35),transparent),#1F1219" }} />
            <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-9">
              <div className="flex items-center gap-2.5 text-ivory/85"><LogoMark size={30} /><span className="text-sm font-semibold">Saheli AI · demo</span></div>
              <p className="max-w-xl rounded-3xl rounded-bl-md bg-white/95 px-4 py-3 font-display text-[15px] leading-snug text-ink shadow-lift sm:px-5 sm:py-4 sm:text-[24px]">
                “Mere paas 20 tarah ke achaar hain. Main Jaipur se poore India mein bhejna chahti hoon.”</p>
              {state === "missing" ? (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-black/35 p-3 backdrop-blur sm:p-3.5">
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ivory/90 sm:text-sm"><b className="block">{lang === "hi" ? "Demo video abhi upload nahi hua hai" : "The demo video hasn't been uploaded yet"}</b>
                    <span className="text-ivory/65">{lang === "hi" ? "Poora flow bagal mein step-by-step hai." : "The full flow is listed step by step."}</span></span>
                  <button onClick={onTry} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ivory px-4 py-2 text-sm font-semibold text-plum-700">{lang === "hi" ? "Khud try karein" : "Try it yourself"}<Icon name="arrow" className="size-4" /></button>
                </div>
              ) : <span />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
