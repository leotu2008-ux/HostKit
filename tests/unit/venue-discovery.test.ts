import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement("img", { src, alt, className }),
}));
vi.mock("@/lib/actions/events", () => ({ createBlankEventAction: vi.fn() }));

import { Landing } from "@/components/landing";
import { discoveryCamera, venueVisibility } from "@/lib/venue-discovery-camera";
import { MAP_CAMERA, MAP_VIEW } from "@/lib/venue-discovery-geometry";

describe("downtown venue map camera", () => {
  it("starts on the blocks and zooms out to a neighborhood that still shows streets", () => {
    const start = discoveryCamera(0);
    const end = discoveryCamera(1);
    expect(start.scale).toBe(MAP_CAMERA.block);
    expect(end.scale).toBe(MAP_CAMERA.neighborhood);
    expect(start.scale).toBeGreaterThan(end.scale);
    expect(MAP_CAMERA.neighborhood).toBeGreaterThan(1.3);

    for (let step = 0; step <= 20; step++) {
      const camera = discoveryCamera(step / 20);
      expect(camera.scale).toBeGreaterThanOrEqual(MAP_CAMERA.neighborhood - 0.001);
      expect(camera.scale).toBeLessThanOrEqual(MAP_CAMERA.block + 0.001);
      expect(camera.x).toBeGreaterThan(0);
      expect(camera.x).toBeLessThan(MAP_VIEW.width);
      expect(camera.y).toBeGreaterThan(0);
      expect(camera.y).toBeLessThan(MAP_VIEW.height);
    }
    // Most of the scroll is the zoom-out. Halfway is still pulling back.
    expect(discoveryCamera(0.5).scale).toBeGreaterThan(MAP_CAMERA.neighborhood);
    expect(discoveryCamera(0.5).scale).toBeLessThan(MAP_CAMERA.block);
    expect(discoveryCamera(0.8).scale).toBe(MAP_CAMERA.neighborhood);
  });

  it("marks the example rooms only after the scan", () => {
    expect(venueVisibility(0.2, 0)).toBe(0);
    expect(venueVisibility(0.7, 0)).toBe(0);
    expect(venueVisibility(1, 0)).toBe(1);
    expect(venueVisibility(1, 3)).toBe(1);
    expect(venueVisibility(0.82, 0)).toBeGreaterThan(0);
    expect(venueVisibility(0.82, 3)).toBe(0);
  });
});

describe("venue discovery on the landing", () => {
  const html = renderToStaticMarkup(createElement(Landing, { canCreate: false }));

  it("sits between the stages and Connect an agent", () => {
    const stages = html.indexOf("The agent works every stage");
    const map = html.indexOf('id="venue-discovery"');
    const connect = html.indexOf("Connect an agent");
    expect(stages).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(stages);
    expect(connect).toBeGreaterThan(map);
  });

  it("draws downtown Manhattan, with streets, both rivers, and example rooms", () => {
    expect(html).toContain("HUDSON RIVER");
    expect(html).toContain("EAST RIVER");
    expect(html).toContain("SOHO");
    expect(html).toContain("TRIBECA");
    expect(html).toContain("CHINATOWN");
    expect(html).toContain("BROADWAY");
    expect(html).toContain("HOUSTON ST");
    expect(html).toContain("CANAL ST");
    expect(html).toContain("Brooklyn Bridge");
    expect(html).toContain("Mercer Loft");
    expect(html).toContain("Hudson Rooms");
    expect(html).toContain("Illustrated downtown. The rooms are examples.");
    // The released frame is what the server sends. Scroll motion is client-only.
    expect(html).not.toContain('data-motion="on"');
    expect(html).toContain("It searches the neighborhood");
  });
});
