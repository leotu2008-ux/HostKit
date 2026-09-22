import { GlitchText } from "@/components/glitch-text";
import { ButtonLink } from "@/components/ui";

/** What Cursor and Claude can read once they are connected. */
const READS = ["Events", "Guests", "Campus events", "Discover"] as const;

/**
 * The first scroll section under the landing hero.
 *
 * This copy says Hosty. The rest of the page still says HostKit until that
 * rebrand lands — don't rename those lines from here.
 */
export function ConnectAgentSection() {
  return (
    <section className="py-16 md:py-24">
      <p className="font-event text-[12px] tracking-[0.14em] text-ink-mute uppercase">
        Cursor and Claude
      </p>
      <GlitchText
        as="h2"
        className="font-display mt-3 block max-w-2xl text-[28px] leading-tight text-ink md:text-[40px]"
      >
        Connect an agent
      </GlitchText>
      <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-soft">
        Cursor and Claude can connect to Hosty to read events, guests, campus
        events, and Discover.
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {READS.map((item) => (
          <li
            key={item}
            className="rounded-card border border-line bg-surface px-4 py-4 text-[15px] font-medium text-ink"
          >
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <ButtonLink
          href="/mcp"
          variant="secondary"
          size="lg"
          className="max-w-full whitespace-normal text-center"
        >
          Endpoint, token generation, and setup config
          <span aria-hidden>→</span>
        </ButtonLink>
      </div>
    </section>
  );
}
