"use client";

import { useEffect, useId, useRef } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { NYC_BOROUGHS } from "./nyc-boroughs";
import styles from "./venue-discovery.module.css";

const VENUES = [
  { x: 305, y: 326, name: "Courtyard", fit: true },
  { x: 405, y: 245, name: "Studio", fit: true },
  { x: 386, y: 146, name: "Hall", fit: false },
  { x: 305, y: 226, name: "Café", fit: false },
  { x: 165, y: 412, name: "Garden", fit: true },
];
const BOROUGH_LABELS = [
  { name: "MANHATTAN", x: 190, y: 204 },
  { name: "BROOKLYN", x: 332, y: 377 },
  { name: "QUEENS", x: 451, y: 291 },
  { name: "THE BRONX", x: 395, y: 102 },
  { name: "STATEN ISLAND", x: 138, y: 464 },
];
const STEPS = ["Start with New York", "Set your search point", "Explore nearby spaces", "Find your kind of place"];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** NYC geography with fictional venue markers. Deterministic illustration. No location permissions or venue API calls. */
export function VenueDiscovery() {
  const mapId = useId().replace(/:/g, "");
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const paint = () => {
      frame = 0;
      const staticView = reduced.matches || innerHeight < 560;
      root.dataset.motion = staticView ? "static" : "scroll";
      const rect = root.getBoundingClientRect();
      const progress = staticView ? 1 : clamp(-rect.top / Math.max(1, rect.height - innerHeight));
      const zoom = ease(progress / 0.3);
      const lock = ease((progress - 0.3) / 0.16);
      const scan = ease((progress - 0.46) / 0.34);
      const match = ease((progress - 0.8) / 0.15);
      root.style.setProperty("--map-scale", String(1.18 - zoom * 0.18));
      root.style.setProperty("--map-angle", `${-2 + lock * 2}deg`);
      root.style.setProperty("--scan-scale", String(scan));
      root.style.setProperty("--scan-opacity", String(progress < 0.46 ? 0 : 0.65 - match * 0.5));
      root.style.setProperty("--lock-opacity", String(lock));
      root.style.setProperty("--match-opacity", String(match));
      root.style.setProperty("--progress", String(progress));
      root.querySelectorAll<SVGGElement>("[data-venue]").forEach((marker, i) => {
        const venue = VENUES[i];
        const distance = Math.hypot(venue.x - 285.1, venue.y - 278.2) / 360;
        const reveal = ease((scan - distance * 0.72) / 0.18);
        marker.style.opacity = String(reveal * (venue.fit ? 1 : 1 - match * 0.72));
      });
      const stage = progress < 0.3 ? 0 : progress < 0.46 ? 1 : progress < 0.8 ? 2 : 3;
      root.querySelectorAll<HTMLElement>("[data-step]").forEach((step, i) => {
        step.dataset.active = String(i === stage);
        if (i === stage) step.setAttribute("aria-current", "step");
        else step.removeAttribute("aria-current");
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <section ref={section} className={styles.section} aria-labelledby="venue-discovery-title">
      <div className={styles.pin}>
        <div className={styles.heading}>
          <div>
            <Eyebrow>A place for your people</Eyebrow>
            <h2 id="venue-discovery-title" className="font-display mt-3 text-[28px] leading-tight md:text-[40px]">Your next event starts nearby.</h2>
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-soft">An area, a headcount, a feel. Give your agent a starting point, then explore spaces that could fit your brief.</p>
          </div>
          <a href="#venue-discovery-end" className={styles.skip}>Skip the map <span aria-hidden>↘</span></a>
        </div>
        <div className={styles.map}>
          <div className={styles.mapCaption}><span className={styles.dot} /> NEW YORK CITY · ALL FIVE BOROUGHS</div>
          <svg viewBox="0 0 600 600" className={styles.scene} role="img" aria-label="Map of all five New York City boroughs: Manhattan, Brooklyn, Queens, the Bronx and Staten Island, with recognizable coastlines and waterways. A small location dot and five fictional venue markers illustrate discovery; three are example matches.">
            <defs>
              <pattern id={`${mapId}-blocks`} width="9" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
                <rect width="9" height="12" fill="#e2e2e2" />
                <rect x="1.2" y="1.2" width="6.6" height="9.6" rx=".5" fill="#d7d7d7" />
              </pattern>
            </defs>
            <g className={styles.world}>
              {NYC_BOROUGHS.map(borough => <path key={borough.name} data-borough={borough.name} d={borough.path} fill={`url(#${mapId}-blocks)`} stroke="#aaa" strokeWidth="1" strokeLinejoin="round" fillRule="evenodd" />)}
              <g className={styles.waterLabels}>
                <text x="214" y="289" transform="rotate(-62 214 289)">HUDSON RIVER</text>
                <text x="345" y="274" transform="rotate(-50 345 274)">EAST RIVER</text>
                <text x="254" y="427" textAnchor="middle">NEW YORK HARBOR</text>
                <text x="421" y="519" textAnchor="middle">ATLANTIC OCEAN</text>
              </g>
              <g className={styles.scan}><circle cx="285.1" cy="278.2" r="360" fill="#141414" fillOpacity=".025" stroke="#777" strokeWidth="1.3" /><circle cx="285.1" cy="278.2" r="325" fill="none" stroke="#aaa" strokeWidth=".6" /></g>
              <g className={styles.lock} fill="none" stroke="#141414" strokeWidth="1"><circle cx="285.1" cy="278.2" r="15" /></g>
              <g transform="translate(285.1 278.2)"><circle r="6" fill="white" stroke="#141414" strokeWidth="1.5" /><circle r="2.5" fill="#141414" /></g>
              <path d="M236 200H266L292 213" fill="none" stroke="#888" strokeWidth=".8" />
              <g className={styles.boroughLabels}>{BOROUGH_LABELS.map(label => <text key={label.name} x={label.x} y={label.y} textAnchor="middle">{label.name}</text>)}</g>
              {VENUES.map((venue, i) => <g key={venue.name} data-venue={i} className={styles.venue} transform={`translate(${venue.x} ${venue.y})`}>
                {venue.fit && <circle className={styles.matchRing} r="13" cy="-6" fill="none" stroke="#141414" strokeWidth="1" />}
                <path d="M0 6C-3 1-9-3-9-9a9 9 0 1 1 18 0C9-3 3 1 0 6Z" fill={venue.fit ? "#141414" : "white"} stroke="#141414" strokeWidth="1" />
                <circle cy="-9" r="2.5" fill={venue.fit ? "white" : "#141414"} />
              </g>)}
            </g>
          </svg>
          <div className={styles.mapSummary}>
            <div className={styles.brief}><span>THE BRIEF</span><strong>40 people. Room to mingle.</strong></div>
            <div className={styles.result}><span>EXAMPLE SHORTLIST</span><strong>3 spaces to explore</strong></div>
          </div>
        </div>
        <p className={styles.mapNote}>NYC geography · Illustrative venues · No live location tracking</p>
        <ol className={styles.steps}>{STEPS.map((step, i) => <li key={step} data-step={i}><span>0{i + 1}</span>{step}</li>)}</ol>
        <div className={styles.track} aria-hidden="true"><div /></div>
        <p className={styles.instruction}>Scroll to explore</p>
      </div>
      <div id="venue-discovery-end" className={styles.end} />
    </section>
  );
}
