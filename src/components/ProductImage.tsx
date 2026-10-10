/**
 * Schematic product illustrations by category. Used instead of product photos
 * until verified manufacturer images are uploaded, so the catalogue never
 * shows a photo of a different product.
 */
export function ProductImage({ category, imageUrl, alt, className = "" }: { category: string; imageUrl?: string | null; alt: string; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={alt} className={`h-full w-full object-contain ${className}`} />;
  }
  return (
    <svg viewBox="0 0 160 110" role="img" aria-label={`${alt} (schematic illustration)`} className={`h-full w-full ${className}`}>
      <rect width="160" height="110" fill="#f4f7f5" />
      <g stroke="#22523c" strokeWidth="1.6" fill="none" strokeLinejoin="round">{ICONS[category] ?? ICONS.default}</g>
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  "pv-modules": (
    <>
      <rect x="40" y="15" width="80" height="80" fill="#e4ede8" />
      {[35, 55, 75].map((y) => <line key={y} x1="40" y1={y} x2="120" y2={y} />)}
      {[60, 80, 100].map((x) => <line key={x} x1={x} y1="15" x2={x} y2="95" />)}
    </>
  ),
  inverters: (
    <>
      <rect x="50" y="18" width="60" height="76" rx="4" fill="#e4ede8" />
      <rect x="62" y="30" width="36" height="14" rx="2" fill="#fff" />
      <path d="M68 62 q6 -8 12 0 t12 0" />
      <line x1="62" y1="94" x2="62" y2="100" /><line x1="98" y1="94" x2="98" y2="100" />
    </>
  ),
  "mounting-structures": (
    <>
      <path d="M25 85 L135 85" />
      <path d="M35 50 L125 30" strokeWidth="3" />
      <path d="M45 48 L45 85 M80 40 L80 85 M115 32 L115 85" />
      <path d="M45 85 L80 40 M80 85 L115 32" strokeDasharray="3 3" />
    </>
  ),
  "dc-cables-connectors": (
    <>
      <path d="M20 70 C50 30, 80 90, 110 50" strokeWidth="4" stroke="#b91c1c" />
      <path d="M20 80 C50 40, 80 100, 110 60" strokeWidth="4" />
      <rect x="110" y="42" width="24" height="12" rx="3" fill="#e4ede8" />
      <rect x="110" y="54" width="24" height="12" rx="3" fill="#e4ede8" />
    </>
  ),
  "ac-cables-accessories": (
    <>
      <circle cx="80" cy="55" r="28" fill="#e4ede8" />
      <circle cx="70" cy="48" r="7" /><circle cx="90" cy="48" r="7" /><circle cx="80" cy="66" r="7" />
    </>
  ),
  "dc-protection": (
    <>
      <rect x="45" y="20" width="70" height="72" rx="4" fill="#e4ede8" />
      <rect x="58" y="38" width="12" height="28" fill="#fff" /><rect x="90" y="38" width="12" height="28" fill="#fff" />
      <line x1="64" y1="44" x2="64" y2="56" /><line x1="96" y1="44" x2="96" y2="56" />
    </>
  ),
  "ac-distribution": (
    <>
      <rect x="40" y="20" width="80" height="72" rx="4" fill="#e4ede8" />
      {[52, 68, 84, 100].map((x) => <rect key={x} x={x - 5} y="40" width="10" height="26" fill="#fff" />)}
    </>
  ),
  "surge-protection": (
    <>
      <rect x="55" y="20" width="50" height="72" rx="3" fill="#e4ede8" />
      <path d="M84 30 L72 56 H86 L76 82" stroke="#b9860b" strokeWidth="2.4" />
    </>
  ),
  "earthing-bonding": (
    <>
      <line x1="80" y1="15" x2="80" y2="60" strokeWidth="3" />
      <line x1="55" y1="60" x2="105" y2="60" /><line x1="63" y1="70" x2="97" y2="70" /><line x1="71" y1="80" x2="89" y2="80" />
    </>
  ),
  "lightning-protection": (
    <>
      <line x1="80" y1="10" x2="80" y2="95" strokeWidth="2.5" />
      <path d="M100 15 L88 40 H100 L86 66" stroke="#b9860b" strokeWidth="2.4" />
      <line x1="60" y1="95" x2="100" y2="95" />
    </>
  ),
  metering: (
    <>
      <rect x="50" y="15" width="60" height="80" rx="4" fill="#e4ede8" />
      <rect x="60" y="28" width="40" height="16" fill="#fff" />
      <text x="80" y="40" textAnchor="middle" fontSize="9" fill="#22523c" stroke="none">kWh</text>
      <circle cx="80" cy="68" r="10" />
    </>
  ),
  monitoring: (
    <>
      <rect x="35" y="22" width="90" height="58" rx="3" fill="#e4ede8" />
      <path d="M45 68 L62 52 L78 60 L95 38 L115 46" />
      <line x1="70" y1="92" x2="90" y2="92" /><line x1="80" y1="80" x2="80" y2="92" />
    </>
  ),
  "cable-management": (
    <>
      <path d="M20 45 L140 45 L140 70 L20 70 Z" fill="#e4ede8" />
      {[35, 55, 75, 95, 115].map((x) => <rect key={x} x={x} y="52" width="8" height="10" />)}
    </>
  ),
  "roof-anchoring": (
    <>
      <rect x="20" y="70" width="120" height="22" fill="#e4ede8" />
      <rect x="62" y="56" width="36" height="14" />
      <line x1="72" y1="62" x2="72" y2="88" strokeWidth="2.4" /><line x1="88" y1="62" x2="88" y2="88" strokeWidth="2.4" />
    </>
  ),
  "battery-storage": (
    <>
      <rect x="45" y="22" width="70" height="72" rx="5" fill="#e4ede8" />
      <rect x="66" y="16" width="28" height="6" />
      <path d="M84 36 L72 60 H86 L76 82" />
    </>
  ),
  "installation-safety": (
    <>
      <path d="M80 15 L125 92 H35 Z" fill="#fff3c4" />
      <line x1="80" y1="42" x2="80" y2="70" strokeWidth="3" /><circle cx="80" cy="80" r="2.5" fill="#22523c" />
    </>
  ),
  default: <rect x="45" y="25" width="70" height="60" rx="4" fill="#e4ede8" />,
};
