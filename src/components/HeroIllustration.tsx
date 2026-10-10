/** Schematic rooftop array on an RCC building — a technical illustration, not a photograph. */
export function HeroIllustration() {
  return (
    <svg viewBox="0 0 520 340" role="img" aria-label="Illustration of a rooftop solar array on an RCC flat roof in Bengaluru" className="h-auto w-full">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#eef5f1" /><stop offset="1" stopColor="#ffffff" /></linearGradient>
        <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#1c4231" /><stop offset="1" stopColor="#2b6649" /></linearGradient>
      </defs>
      <rect width="520" height="340" fill="url(#sky)" rx="12" />
      <circle cx="430" cy="70" r="30" fill="#f5c02c" opacity="0.9" />
      <rect x="60" y="190" width="400" height="130" fill="#dfe6e2" stroke="#8bbfa1" />
      {[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => (
        <rect key={`${r}${c}`} x={92 + c * 70} y={210 + r * 26} width="22" height="16" fill="#fff" stroke="#b9d9c6" />
      )))}
      <rect x="50" y="180" width="420" height="12" fill="#b9d9c6" />
      {[0, 1].map((row) => (
        <g key={row} transform={`translate(${90 + row * 0}, ${118 + row * 34})`}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i} transform={`translate(${i * 56}, 0) skewX(-18)`}>
              <rect width="52" height="28" fill="url(#panel)" stroke="#dcece2" strokeWidth="1" />
              <line x1="0" y1="14" x2="52" y2="14" stroke="#5a9e7a" strokeWidth="0.6" />
              <line x1="17" y1="0" x2="17" y2="28" stroke="#5a9e7a" strokeWidth="0.6" />
              <line x1="35" y1="0" x2="35" y2="28" stroke="#5a9e7a" strokeWidth="0.6" />
            </g>
          ))}
          {[0, 2, 4].map((i) => <line key={i} x1={i * 56 + 12} y1="28" x2={i * 56 + 12} y2={62 - row * 34} stroke="#5b6660" strokeWidth="1.5" />)}
        </g>
      ))}
      <g transform="translate(400,150)">
        <rect width="34" height="40" rx="3" fill="#fff" stroke="#22523c" />
        <path d="M8 26 q4 -6 9 0 t9 0" stroke="#22523c" fill="none" />
        <text x="17" y="14" fontSize="7" textAnchor="middle" fill="#22523c">INV</text>
      </g>
      <text x="64" y="334" fontSize="10" fill="#5b6660">Schematic illustration · RCC flat roof · elevated structure</text>
    </svg>
  );
}
