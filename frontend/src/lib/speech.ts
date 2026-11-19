import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "../types";

/** The part of the Web Speech API we use (not in TypeScript's DOM types; Chrome ships it as webkitSpeechRecognition). */
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
interface Rec {
  lang: string; interimResults: boolean; continuous: boolean;
  onstart: (() => void) | null; onend: (() => void) | null;
  onresult: ((e: SpeechResultEvent) => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void; abort?(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };

function recognizer(): (new () => Rec) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as SpeechWindow;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export const voiceSupported = (): boolean => !!recognizer();

/** Voice input via the browser's Web Speech API (Chrome on Android/desktop supports hi-IN and en-IN). */
export function useVoiceInput(lang: Lang, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Rec | null>(null);
  const supported = voiceSupported();

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  const start = useCallback(() => {
    setError(null);
    const en = lang === "en";
    const SR = recognizer();
    if (!SR) { setError(en ? "Voice isn't supported in this browser — open it in Chrome." : "Is browser mein voice support nahi hai — Chrome mein kholiye."); return; }
    const rec: Rec = new SR();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onstart = () => { setListening(true); setInterim(""); };
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else text += e.results[i][0].transcript;
      }
      setInterim(finalText + text);
    };
    rec.onerror = (e) => {
      setError(e.error === "not-allowed" ? (en ? "Please allow the microphone (tap the lock icon in the address bar)." : "Microphone ki permission dijiye (address bar mein lock icon dabaiye).") :
        e.error === "no-speech" ? (en ? "I didn't hear anything — please try again." : "Kuch sunai nahi diya — dobara koshish kijiye.") : (en ? "Something went wrong with voice, please try again." : "Voice mein dikkat aayi, dobara try kijiye."));
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      if (finalText.trim()) onFinal(finalText.trim());
    };
    recRef.current = rec;
    rec.start();
  }, [lang, onFinal]);

  useEffect(() => () => recRef.current?.abort?.(), []);
  return { supported, listening, interim, error, start, stop, clearError: () => setError(null) };
}

/* Saheli speaks with a woman's voice. Browsers don't say which voices are female, so we pick by name:
   the natural ("Natural", "Neural", Google, Siri/Enhanced) Indian women's voices first, and never a known male one. */
const FEMALE = ["swara", "neerja", "lekha", "kalpana", "heera", "veena", "aditi", "raveena", "google हिन्दी", "google hindi",
  "kiyara", "ananya", "aarohi", "female", "woman", "samantha", "karen", "moira", "tessa", "zira", "aria", "jenny", "sonia", "libby"];
const MALE = ["madhur", "hemant", "rishi", "prabhat", "ravi", "aarav", "kunal", "male", "man", "daniel", "alex", "fred", "david", "mark", "guy", "ryan"];
const NATURAL = ["natural", "neural", "online", "enhanced", "premium", "siri", "google"];

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() { voices = window.speechSynthesis?.getVoices() ?? []; }
if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

/** The sweetest-sounding woman's voice this device has for the language (Hindi first, then Indian English). */
export function saheliVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  if (!voices.length) loadVoices();
  const has = (v: SpeechSynthesisVoice, words: string[]) => words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, "i").test(v.name));
  const score = (v: SpeechSynthesisVoice) => {
    const l = v.lang.replace("_", "-").toLowerCase();
    const langScore = lang === "hi" ? (l === "hi-in" ? 40 : l === "en-in" ? 25 : l.startsWith("en") ? 5 : -100)
      : (l === "en-in" ? 40 : l.startsWith("en") ? 25 : l === "hi-in" ? 10 : -100);
    return langScore + (has(v, FEMALE) ? 30 : 0) - (has(v, MALE) ? 80 : 0) + (has(v, NATURAL) ? 15 : 0) + (v.localService ? 0 : 3);
  };
  return [...voices].sort((a, b) => score(b) - score(a)).find((v) => score(v) > 0);
}

/** Read text aloud in Saheli's voice: warm, a little slower, slightly higher pitch.
 *  Returns false when the browser can't speak. `onEnd` fires when speech finishes or is stopped. */
export function speak(text: string, lang: Lang = "hi", onEnd?: () => void): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const clean = text.replace(/\*\*/g, "").replace(/https?:\/\/\S+/g, "link").replace(/\p{Extended_Pictographic}/gu, "");
  const u = new SpeechSynthesisUtterance(clean);
  const voice = saheliVoice(lang);
  u.lang = voice?.lang ?? (lang === "hi" ? "hi-IN" : "en-IN");
  if (voice) u.voice = voice;
  u.rate = 0.92;
  // a gentle lift; if we only found a voice of unknown gender, lift a little more so it never sounds like a man
  u.pitch = voice && /swara|neerja|lekha|kalpana|google/i.test(voice.name) ? 1.08 : 1.2;
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
