"use client";

import { useState, type CSSProperties } from "react";
import { HostyGlyphs } from "@/components/hosty-glyphs";
import { WaveText } from "@/components/wave-text";

/**
 * The landing's headline. Hovering a line makes its letters rise one after
 * another; hovering anywhere on it turns Hosty into characters. Nothing
 * scrambles or swaps the words.
 *
 * Hosty is pinned to "the work." — kept whole, so a phone wraps before it —
 * rather than to the line, so he stays beside the word wherever the
 * headline breaks. His size is in em, so he scales with the headline.
 */
export function HeroHeadline({ className, style }: { className?: string; style?: CSSProperties }) {
  const [active, setActive] = useState(false);
  return (
    <h1
      className={className}
      style={style}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <WaveText text="Plan the event." className="font-hero text-[#182038]" />
      <br />
      <WaveText text="Let the agent do" className="font-display tracking-[-0.03em] text-black" />
      <span className="font-display tracking-[-0.03em]"> </span>
      <span className="relative inline-block">
        <WaveText text="the work." className="font-display tracking-[-0.03em] text-black" />
        <HostyGlyphs
          active={active}
          className="hosty-pop pointer-events-none absolute -top-[0.1em] -right-[1.95em] h-[1.75em] w-[1.75em] text-ink md:-top-[0.42em]"
        />
      </span>
    </h1>
  );
}
