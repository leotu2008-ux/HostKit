import { Eyebrow } from "@/components/eyebrow";
import { WaveText } from "@/components/wave-text";
import { NYC_LABELS, NYC_LAND, NYC_SEARCH, NYC_VIEW } from "@/lib/nyc-borough-map";

/**
 * The landing's place to start: an illustrated New York, all five boroughs,
 * and the brief the agent searches from. The drawing is a picture of the
 * city — geography, not a live location — with one search point in lower
 * Manhattan.
 */

const STEPS = [
  { n: "01", label: "Start with New York" },
  { n: "02", label: "Set your search point" },
  { n: "03", label: "Explore nearby spaces" },
  { n: "04", label: "Find your kind of place" },
] as const;

export function VenueDiscovery() {
  return (
    <section
      id="venue-discovery"
      className="venue-discovery"
      aria-labelledby="venue-discovery-title"
    >
      <div className="mx-auto w-full max-w-6xl border-x border-line px-5 py-16 md:px-10 md:py-24">
        <div className="max-w-2xl">
          <div className="flex items-start justify-between gap-6">
            <Eyebrow>A place for your people</Eyebrow>
            <a
              href="#connect-agent"
              className="shrink-0 text-[14px] text-ink underline decoration-ink/30 underline-offset-[5px]"
            >
              Skip the map <span aria-hidden="true">↘</span>
            </a>
          </div>

          <h2
            id="venue-discovery-title"
            className="font-display mt-5 text-[40px] leading-[1.05] tracking-[-0.03em] text-ink md:text-[52px]"
          >
            <span className="sr-only">Your next event starts nearby.</span>
            <span aria-hidden="true">
              <WaveText text="Your next event" />
              <br />
              <WaveText text="starts nearby." />
            </span>
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-soft">
            <WaveText
              by="word"
              text="An area, a headcount, a feel. Give your agent a starting point, then explore spaces that could fit your brief."
            />
          </p>

          <div className="mt-8 overflow-hidden rounded-[1.25rem] border border-line bg-[#fafafa]">
            <div className="flex items-center gap-2.5 px-5 pt-5 md:px-6">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-ink" aria-hidden="true" />
              <p className="text-[11px] font-medium tracking-[0.16em] text-ink uppercase">
                New York City · All five boroughs
              </p>
            </div>

            <svg
              viewBox={`0 0 ${NYC_VIEW.width} ${NYC_VIEW.height}`}
              className="venue-map mt-1 block w-full"
              role="img"
              aria-label="Illustrated map of New York City, all five boroughs, with a search point in lower Manhattan"
            >
              <defs>
                <pattern
                  id="nyc-hatch"
                  width="7"
                  height="7"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="7" height="7" fill="#d7d7d7" />
                  <path d="M0 0 V7" stroke="#e4e4e4" strokeWidth="1.45" />
                </pattern>
                <clipPath id="nyc-land">
                  {NYC_LAND.map((land) => (
                    <path key={land.name} d={land.d} />
                  ))}
                </clipPath>
              </defs>
              <rect width={NYC_VIEW.width} height={NYC_VIEW.height} fill="#fafafa" />
              <rect
                width={NYC_VIEW.width}
                height={NYC_VIEW.height}
                fill="url(#nyc-hatch)"
                clipPath="url(#nyc-land)"
              />
              {NYC_LAND.map((land) => (
                <path
                  key={land.name}
                  d={land.d}
                  fill="none"
                  stroke="#fafafa"
                  strokeWidth="8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {NYC_LABELS.map((label) => (
                <text
                  key={label.text}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  transform={`rotate(${label.rotate} ${label.x} ${label.y})`}
                >
                  {label.text}
                </text>
              ))}
              <g aria-hidden="true">
                <circle
                  cx={NYC_SEARCH.x}
                  cy={NYC_SEARCH.y}
                  r="9"
                  fill="none"
                  stroke="#141414"
                  strokeWidth="1.6"
                />
                <circle cx={NYC_SEARCH.x} cy={NYC_SEARCH.y} r="2.8" fill="#141414" />
              </g>
            </svg>

            <div className="border-t border-line px-5 py-4 md:px-6">
              <p className="text-[11px] font-medium tracking-[0.16em] text-ink-mute uppercase">
                The brief
              </p>
              <p className="mt-1.5 text-[18px] font-medium text-ink">40 people. Room to mingle.</p>
            </div>
          </div>

          <p className="mt-4 text-[13px] text-ink-mute">
            NYC geography · Illustrative venues · No live location tracking
          </p>

          <ol className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-[15px]">
            {STEPS.map((step, index) => (
              <li key={step.n} className={index === 0 ? "font-medium text-ink" : "text-ink-mute"}>
                <span className="tabular-nums">{step.n}</span> {step.label}
              </li>
            ))}
          </ol>

          <p className="mt-12 text-center text-[13px] text-ink-mute">Scroll to explore</p>
        </div>
      </div>
    </section>
  );
}
