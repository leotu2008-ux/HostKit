import { json } from "@/lib/api/http";
import { SCHOOLS } from "@/lib/schools";
import { SCHOOLS_WITH_FEEDS } from "@/lib/campus/sources";

/** The schools a person can pick in Settings, and which have official feeds. */
export async function GET() {
  return json({
    schools: SCHOOLS.map((s) => ({
      domain: s.domain,
      name: s.name,
      short: s.short,
      city: s.city,
      hasOfficialEvents: SCHOOLS_WITH_FEEDS.has(s.domain),
    })),
  });
}
