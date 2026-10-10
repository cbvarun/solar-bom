export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="6" fill="#163527" />
        <circle cx="22" cy="10" r="4" fill="#f5c02c" />
        <path d="M6 24 L12 13 H26 L20 24 Z" fill="none" stroke="#dcece2" strokeWidth="1.6" />
        <path d="M9 18.5 H23 M16 13 L13 24 M19.5 13 L16.5 24" stroke="#dcece2" strokeWidth="1.1" />
      </svg>
      <span className={light ? "text-white" : "text-ink"}>
        <span className="block text-sm font-semibold leading-tight">Rooftop Solar BOM</span>
        <span className={light ? "block text-[11px] leading-tight text-brand-200" : "block text-[11px] leading-tight text-ink-muted"}>Catalogue · Configurator · Procurement</span>
      </span>
    </span>
  );
}
