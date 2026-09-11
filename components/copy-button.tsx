"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

/** Copies `text` and says so for a moment. */
export function CopyButton({
  text,
  label = "Copy",
  variant = "secondary",
  size = "sm",
  className,
}: {
  text: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  return (
    <button type="button" onClick={copy} className={buttonClass(variant, size, className)}>
      {copied ? "Copied" : label}
    </button>
  );
}
