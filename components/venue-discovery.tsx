"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { WaveText } from "@/components/wave-text";
import {
  discoveryCamera,
  discoveryPhase,
  scanBand,
  venueVisibility,
  type DiscoveryPhase,
} from "@/lib/venue-discovery-camera";
import {
  AVENUES,
  BLOCKS,
  BRIDGES,
  BROADWAY_PATH,
  BROOKLYN_PATH,
  CROSS_STREETS,
  ISLAND_PATH,
  MAP_FOCUS,
  MAP_VIEW,
  NEIGHBORHOOD_LABELS,
  PARKS,
  STREET_LABELS,
  VENUES,
  WATER_LABELS,
} from "@/lib/venue-discovery-geometry";

/**
 * Scroll-driven venue search on the landing page.
 *
 * The drawing is downtown Manhattan only — Houston Street to the Brooklyn
 * Bridge, Hudson to the East River — so the widest frame is already a
 * neighborhood, not the five boroughs. Scrolling starts on the blocks and
 * zooms out until the neighborhood is in frame. That widest frame still
 * shows the streets. It then holds, scans, and marks example rooms.
 *
 * The server (and reduced motion) renders the neighborhood frame with the
 * rooms marked. The client only scrubs when motion is allowed.
 */

const PHASE_LABEL: Record<DiscoveryPhase, string> = {
  zoom: "Opening to the neighborhood",
  lock: "Neighborhood in view",
  scan: "Scanning the blocks",
  venues: "Marking rooms that fit",
  release: "SoHo, Lower Manhattan",
};

/** Released frame: rooms marked, camera still inside the neighborhood. */
const SETTLED = 1;

export function VenueDiscovery() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(SETTLED);
  const [motion, setMotion] = useState(false);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const section = sectionRef.current;
    if (!section) return;

    // The tall track is what gives the zoom room. Set it before measuring.
    // Otherwise the section is only as tall as the frame, progress stays on
    // the finished neighborhood shot, and the block view never appears.
    section.setAttribute("data-motion", "on");
    setMotion(true);
    let frame = 0;
    const update = () => {
      frame = 0;
      const total = section.offsetHeight - window.innerHeight;
      const top = section.getBoundingClientRect().top;
      const next = total <= 0 ? 0 : Math.min(1, Math.max(0, -top / total));
      setProgress(next);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const camera = discoveryCamera(progress);
  const phase = discoveryPhase(progress);
  const scan = scanBand(progress);
  const cameraTransform = `translate(${camera.x} ${camera.y}) scale(${camera.scale}) translate(${-camera.x} ${-camera.y})`;

  return (
    <section
      ref={sectionRef}
      id="venue-discovery"
      className="venue-discovery"
      data-motion={motion ? "on" : undefined}
      data-phase={phase}
      data-scale={camera.scale.toFixed(2)}
      aria-labelledby="venue-discovery-title"
    >
      <div className="venue-discovery-pin mx-auto flex w-full max-w-6xl flex-col border-x border-line px-5 py-8 md:px-10 md:py-12">
        <Eyebrow>Venues</Eyebrow>
        <h2
          id="venue-discovery-title"
          className="font-display mt-3 block max-w-2xl text-[28px] leading-tight text-ink md:text-[40px]"
        >
          <WaveText text="It searches the neighborhood" />
        </h2>
        <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-soft">
          <WaveText
            by="word"
            text="From Houston Street to the Brooklyn Bridge, it locks onto the blocks and marks rooms that fit."
          />
        </p>

        <div className="venue-discovery-map relative mt-6 overflow-hidden rounded-card border border-line bg-sunk">
          <svg
            viewBox={`0 0 ${MAP_VIEW.width} ${MAP_VIEW.height}`}
            className="venue-map h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Illustrated map of downtown Manhattan. SoHo, Tribeca, and Chinatown between the Hudson River and the East River, with Broadway, Houston Street, Canal Street, and the Brooklyn, Manhattan, and Williamsburg bridges."
          >
            <title>Downtown Manhattan, SoHo to the Brooklyn Bridge</title>
            <defs>
              <clipPath id="venue-island">
                <path d={ISLAND_PATH} />
              </clipPath>
              <linearGradient id="venue-scan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#141414" stopOpacity="0" />
                <stop offset="0.45" stopColor="#141414" stopOpacity="0.16" />
                <stop offset="1" stopColor="#141414" stopOpacity="0" />
              </linearGradient>
            </defs>

            <rect width={MAP_VIEW.width} height={MAP_VIEW.height} fill="#f0efed" />
            <g transform={cameraTransform}>
              <path d={BROOKLYN_PATH} fill="#f8f8f7" />
              <path d={ISLAND_PATH} fill="#f8f8f7" />

              <g clipPath="url(#venue-island)">
                {BLOCKS.map((block) => (
                  <rect
                    key={`${block.x}-${block.y}`}
                    x={block.x}
                    y={block.y}
                    width={block.w}
                    height={block.h}
                    fill="#ffffff"
                  />
                ))}
                {PARKS.map((park) => (
                  <rect
                    key={park.name}
                    x={park.x}
                    y={park.y}
                    width={park.w}
                    height={park.h}
                    fill="#f0efed"
                  >
                    <title>{park.name}</title>
                  </rect>
                ))}
                {CROSS_STREETS.map((street) => (
                  <line
                    key={street.name}
                    x1={0}
                    y1={street.y}
                    x2={MAP_VIEW.width}
                    y2={street.y}
                    stroke="#141414"
                    strokeOpacity={street.major ? 0.82 : 0.62}
                    strokeWidth={street.major ? 1.75 : 1.4}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {AVENUES.map((avenue) => (
                  <line
                    key={avenue.name}
                    x1={avenue.x}
                    y1={0}
                    x2={avenue.x}
                    y2={MAP_VIEW.height}
                    stroke="#141414"
                    strokeOpacity={avenue.major ? 0.82 : 0.62}
                    strokeWidth={avenue.major ? 1.75 : 1.4}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <path
                  d={BROADWAY_PATH}
                  fill="none"
                  stroke="#141414"
                  strokeOpacity="0.9"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={0}
                  y={scan.y}
                  width={MAP_VIEW.width}
                  height={42}
                  fill="url(#venue-scan)"
                  opacity={scan.opacity}
                />
              </g>

              <path
                d={ISLAND_PATH}
                fill="none"
                stroke="#141414"
                strokeOpacity="0.7"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={BROOKLYN_PATH}
                fill="none"
                stroke="#141414"
                strokeOpacity="0.5"
                strokeWidth="1.4"
                vectorEffect="non-scaling-stroke"
              />

              {BRIDGES.map((bridge) => (
                <g key={bridge.name}>
                  <title>{bridge.name}</title>
                  <line
                    x1={bridge.x1}
                    y1={bridge.y1}
                    x2={bridge.x2}
                    y2={bridge.y2}
                    stroke="#141414"
                    strokeOpacity="0.75"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    className="venue-bridge"
                    x={(bridge.x1 + bridge.x2) / 2}
                    y={(bridge.y1 + bridge.y2) / 2 - 8}
                    textAnchor="middle"
                  >
                    {bridge.name}
                  </text>
                </g>
              ))}

              {WATER_LABELS.map((label) => (
                <text
                  key={label.text}
                  className="venue-water"
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  transform={`rotate(${label.rotate} ${label.x} ${label.y})`}
                >
                  {label.text}
                </text>
              ))}

              {STREET_LABELS.map((label) => (
                <text key={label.text} className="venue-street" x={label.x} y={label.y}>
                  {label.text}
                </text>
              ))}
              {camera.scale < 3.2
                ? NEIGHBORHOOD_LABELS.map((label) => (
                    <text key={label.text} className="venue-area" x={label.x} y={label.y}>
                      {label.text}
                    </text>
                  ))
                : null}

              <g transform={`translate(${MAP_FOCUS.x} ${MAP_FOCUS.y})`}>
                <circle r="28" fill="none" stroke="#1d4ed8" strokeOpacity="0.28" strokeWidth="1.4" />
                <g className="venue-ring">
                  <circle
                    r="28"
                    fill="none"
                    stroke="#1d4ed8"
                    strokeWidth="1.8"
                    strokeDasharray="22 120"
                    strokeLinecap="round"
                  />
                </g>
                <circle r="5.5" fill="#1d4ed8" />
                <circle r="2.2" fill="#ffffff" />
              </g>

              {VENUES.map((venue, index) => {
                const shown = venueVisibility(progress, index);
                if (shown <= 0) return null;
                return (
                  <g
                    key={venue.id}
                    opacity={shown}
                    transform={`translate(${venue.x} ${venue.y}) scale(${0.72 + shown * 0.28})`}
                  >
                    <circle r="9" fill="#1d4ed8" />
                    <circle r="3.2" fill="#ffffff" />
                    <text className="venue-pin-name" x={14} y={4}>
                      {venue.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="text-[13px] font-medium tracking-wide text-ink-soft uppercase" aria-live="polite">
            {PHASE_LABEL[phase]}
          </p>
          <ul className="flex flex-wrap gap-2">
            {VENUES.map((venue, index) => {
              const shown = venueVisibility(progress, index);
              return (
                <li
                  key={venue.id}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink"
                  style={{ opacity: 0.35 + shown * 0.65 }}
                >
                  <span className="font-medium">{venue.name}</span>
                  <span className="text-ink-mute"> · {venue.detail}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-3 text-[12px] text-ink-mute">Illustrated downtown. The rooms are examples.</p>
      </div>
    </section>
  );
}
