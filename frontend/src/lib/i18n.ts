import type { Lang } from "../types";

/** Pick the Hinglish or English copy for the app's language switch. */
export const tx = (lang: Lang, hi: string, en: string) => (lang === "en" ? en : hi);
