"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades a block up as it scrolls into view, once.
 *
 * The server renders the block plainly visible: no data attribute, no
 * hidden state. Only after hydration, and only if the block is still below
 * the fold at that moment, does it hide itself and wait for the viewport.
 * So the page reads in full without JavaScript, nothing already on screen
 * flickers, and a reader who prefers reduced motion never sees it move.
 *
 * `index` staggers siblings by stepping the CSS transition delay. The CSS
 * lives in app/globals.css under "Landing motion".
 */

type Phase = "static" | "pending" | "in";

let observer: IntersectionObserver | null = null;
const listeners = new WeakMap<Element, () => void>();

/** One observer for every Reveal on the page, not one per block. */
function observe(element: Element, onEnter: () => void) {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          listeners.get(entry.target)?.();
          observer?.unobserve(entry.target);
          listeners.delete(entry.target);
        }
      },
      // Fire a little before the block's top edge crosses the bottom of the
      // viewport, so the rise is underway by the time the eye gets there.
      { rootMargin: "0px 0px -8% 0px" },
    );
  }
  listeners.set(element, onEnter);
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    listeners.delete(element);
  };
}

export function Reveal({
  as = "div",
  index = 0,
  className,
  children,
}: {
  as?: "div" | "section" | "li" | "ol" | "ul";
  index?: number;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>("static");

  // Layout effect, not effect: this must run before the first client paint,
  // so a block can go from "visible" to "pending" without ever having been
  // drawn.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;

    setPhase("pending");
    return observe(element, () => setPhase("in"));
  }, []);

  // One intrinsic tag stands in for the union so JSX accepts the dynamic
  // element; every option is a plain flow element with the same props.
  const Tag = as as "div";
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={className ? `reveal ${className}` : "reveal"}
      style={{ "--i": index } as React.CSSProperties}
      {...(phase === "static" ? {} : { "data-reveal": phase })}
    >
      {children}
    </Tag>
  );
}
