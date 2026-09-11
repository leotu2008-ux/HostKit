"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { SPLASH_STORAGE_KEY } from "@/lib/splash";

const FALLBACK_MS = 2600;

/**
 * First-load splash: black screen, HostKit mark fades in, holds, fades out,
 * then the phone shell is revealed. Visibility is driven by `data-splash` on
 * `<html>` (set before paint); this component only records that the session
 * has seen it once the overlay animation finishes.
 */
export function LaunchSplash() {
  const overlayRef = useRef<HTMLDivElement>(null);

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
