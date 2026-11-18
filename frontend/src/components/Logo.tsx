/**
 * Saheli brand mark: two petals rising from one root — two companions in conversation, and a sprouting idea —
 * with a saffron dot for the idea she speaks. `tile` = plum app-icon tile; otherwise the bare mark for light backgrounds.
 */
export function LogoMark({ size = 36, tile = true, className = "" }: { size?: number; tile?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={`shrink-0 ${className}`} role="img" aria-label="Saheli AI">
      {tile && <rect width="48" height="48" rx="14" fill="#5B1F4A" />}
      <g transform="translate(24 25) scale(1.1) translate(-24 -25)">
        <path d="M23.2 38.5C14.6 35.6 10.2 27.4 12.6 14.2C20.6 17.4 24.6 25.4 23.2 38.5Z" fill={tile ? "#FBF7F2" : "#5B1F4A"} />
        <path d="M24.8 38.5C33.4 35.6 37.8 27.4 35.4 14.2C27.4 17.4 23.4 25.4 24.8 38.5Z" fill={tile ? "#F2C9D2" : "#B4475F"} />
        <circle cx="24" cy="11.2" r="3.1" fill="#E3A447" />
      </g>
    </svg>
  );
}

export function Logo({ size = 36, sub = true, dark = false }: { size?: number; sub?: boolean; dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="whitespace-nowrap text-left leading-tight">
        <b className={`block font-display text-lg font-semibold ${dark ? "text-ivory" : "text-ink"}`}>Saheli<span className={`hidden min-[400px]:inline ${dark ? "text-[#F2C9D2]" : "text-plum-600"}`}> AI</span></b>
        {sub && <span className={`hidden text-[11px] sm:block ${dark ? "text-ivory/60" : "text-muted"}`}>Business launch partner</span>}
      </span>
    </span>
  );
}
