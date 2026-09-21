"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { SPLASH_STORAGE_KEY } from "@/lib/splash";

const FALLBACK_MS = 1400;

/**
 * First-load splash: black screen, HostKit mark pops in (scale + fade),
 * briefly holds, then logo and overlay fade out together. Visibility is
 * driven by `data-splash` on `<html>` (set before paint); this component
 * only records that the session has seen it once the overlay animation
 * finishes.
 */
export function LaunchSplash() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // A redirect straight out of a Server Action (Create event, sign-in, …)
  // can land here with `data-splash` missing rather than "done" — the
  // bootstrap script that stamps it only ever runs on a real document
  // parse, and this kind of redirect doesn't always give it one. Left
  // alone, the overlay's base CSS (display: flex, pointer-events: auto)
  // then blocks the whole page, on every render, forever. Re-assert "done"
  // on every navigation the session has already earned it, so the flag
  // can't get stuck missing.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SPLASH_STORAGE_KEY) === "1";
    } catch {
      // Private browsing can throw; nothing to reassert this visit.
    }
    if (seen) document.documentElement.dataset.splash = "done";
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.splash !== "pending") return;

    const overlay = overlayRef.current;
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      try {
        sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
      } catch {
        // Private browsing can throw; the overlay still goes away this visit.
      }
      root.dataset.splash = "done";
    }

    function onEnd(event: AnimationEvent) {
      if (event.target !== overlay) return;
      if (event.animationName !== "launch-splash-overlay") return;
      finish();
    }

    overlay?.addEventListener("animationend", onEnd);
    const timeout = window.setTimeout(finish, FALLBACK_MS);
    return () => {
      overlay?.removeEventListener("animationend", onEnd);
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="launch-splash no-print"
      data-testid="launch-splash"
      aria-hidden="true"
    >
      <Image
        src="/brand/HostKit_Logo.png"
        alt=""
        width={1024}
        height={1024}
        sizes="(max-width: 430px) 70vw, 280px"
        preload
        className="launch-splash-logo"
      />
    </div>
  );
}
