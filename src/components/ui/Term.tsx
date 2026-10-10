import { GLOSSARY } from "@/lib/glossary";

/** Inline engineering term with an accessible tooltip. Works with keyboard focus and hover. */
export function Term({ k, children }: { k: keyof typeof GLOSSARY; children?: React.ReactNode }) {
  const def = GLOSSARY[k];
  const id = `term-${String(k)}`;
  return (
    <span className="group relative inline-flex items-center">
      <span tabIndex={0} aria-describedby={id} className="cursor-help border-b border-dotted border-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-solar-400">
        {children ?? def.term}
      </span>
      <span id={id} role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1 w-64 rounded-md bg-brand-950 px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <strong className="block font-semibold">{def.term}</strong>
        {def.definition}
      </span>
    </span>
  );
}
