import type { ReactNode } from "react";

/** Small-caps section label, the way the reference introduces each block. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-event text-[12px] tracking-[0.14em] text-ink-mute uppercase">
      {children}
    </p>
  );
}
