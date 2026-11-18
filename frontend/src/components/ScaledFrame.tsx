import { useEffect, useRef, useState } from "react";

/**
 * Shows a live website as a scaled-down desktop preview that always fits its container.
 * While loading it shows a skeleton; if the page doesn't load within `timeoutMs` it shows a clear
 * fallback with a link instead of a blank box.
 */
export function ScaledFrame({ src, title, height, interactive = false, pageWidth = 1280, lazy = false, timeoutMs = 12000 }:
  { src: string; title: string; height: number; interactive?: boolean; pageWidth?: number; lazy?: boolean; timeoutMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width) setScale(e.contentRect.width / pageWidth); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageWidth]);

  useEffect(() => {
    setState("loading");
    const t = setTimeout(() => setState((s) => (s === "loading" ? "failed" : s)), timeoutMs);
    return () => clearTimeout(t);
  }, [src, timeoutMs]);

  return (
    <div ref={ref} className="relative w-full overflow-hidden bg-cream" style={{ height }}>
      {state !== "failed" && (
        <iframe title={title} src={src} loading={lazy ? "lazy" : "eager"} tabIndex={interactive ? 0 : -1} onLoad={() => setState("loaded")}
          className={`absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-500 ${interactive ? "" : "pointer-events-none"} ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
          style={{ width: pageWidth, height: height / scale, transform: `scale(${scale})` }} />
      )}
      {state === "loading" && <div className="skeleton absolute inset-0" aria-label="Loading preview" />}
      {state === "failed" && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center">
          <div>
            <p className="text-sm font-semibold text-ink">Preview load nahi hua</p>
            <a href={src} target="_blank" rel="noopener" className="mt-1 inline-block text-sm font-semibold text-plum-700 underline">Website kholiye</a>
          </div>
        </div>
      )}
    </div>
  );
}
