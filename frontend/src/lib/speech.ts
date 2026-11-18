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
    const SR = recognizer();
    if (!SR) { setError("Is browser mein voice support nahi hai — Chrome mein kholiye."); return; }
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
      setError(e.error === "not-allowed" ? "Microphone ki permission dijiye (address bar mein lock icon dabaiye)." :
        e.error === "no-speech" ? "Kuch sunai nahi diya — dobara koshish kijiye." : "Voice mein dikkat aayi, dobara try kijiye.");
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

/** Read text aloud. Devanagari reads best with a Hindi voice; Hinglish falls back gracefully.
 *  Returns false when the browser can't speak. `onEnd` fires when speech finishes or is stopped. */
export function speak(text: string, lang: Lang = "hi", onEnd?: () => void): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, "").replace(/https?:\/\/\S+/g, "link"));
  u.lang = lang === "hi" ? "hi-IN" : "en-IN";
  u.rate = 0.96;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === u.lang);
  if (voice) u.voice = voice;
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
