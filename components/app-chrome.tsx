"use client";

import { usePathname } from "next/navigation";

/**
 * The event workspace is the one place in HostKit that is an *app* rather
 * than a page, and an app doesn't carry the marketing nav around inside the
 * product: once you're in a night's workspace the floating top bar and the
 * bottom tab bar are replaced by the workspace's own sidebar and app bar,
 * which point at this event's six stages instead of at Discover.
 *
 * A client component because the decision is the current URL, and AppFrame
 * is rendered once by the root layout for the whole tree — there is no
 * server-side place that knows which route is beneath it.
 *
 * `/events/new` and `/events/claim` are not workspaces (they're a redirect
 * and a claim screen that belong to the marketing-framed app), so they keep
 * the chrome; `/events/<id>` and everything under it loses it.
 */
const WORKSPACE = /^\/events\/(?!new$|claim$)[^/]+(\/|$)/;

export function AppChrome({ children }: { children: React.ReactNode }) {
  return WORKSPACE.test(usePathname()) ? null : children;
}
