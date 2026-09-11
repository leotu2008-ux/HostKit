import type { City } from "@/lib/catalog";

/**
 * Schools HostKit knows by email domain.
 *
 * A student is anyone who signed up with a `.edu` address; the domain is
 * trusted, not verified (yet). Known schools get a proper name and a home
 * city so Discover can default to it. Any other `.edu` still counts as a
 * student, named from the domain, with no home city.
 */

export type School = {
  domain: string;
  name: string;
  /** How the school is referred to on chips and in sentences. */
  short: string;
  city: City | null;
};

export const SCHOOLS: School[] = [
  { domain: "babson.edu", name: "Babson College", short: "Babson", city: "Boston, MA" },
  { domain: "olin.edu", name: "Olin College", short: "Olin", city: "Boston, MA" },
  { domain: "wellesley.edu", name: "Wellesley College", short: "Wellesley", city: "Boston, MA" },
  { domain: "bu.edu", name: "Boston University", short: "BU", city: "Boston, MA" },
  { domain: "bc.edu", name: "Boston College", short: "BC", city: "Boston, MA" },
  { domain: "northeastern.edu", name: "Northeastern University", short: "Northeastern", city: "Boston, MA" },
  { domain: "harvard.edu", name: "Harvard University", short: "Harvard", city: "Boston, MA" },
  { domain: "mit.edu", name: "MIT", short: "MIT", city: "Boston, MA" },
  { domain: "tufts.edu", name: "Tufts University", short: "Tufts", city: "Boston, MA" },
  { domain: "nyu.edu", name: "New York University", short: "NYU", city: "New York, NY" },
  { domain: "columbia.edu", name: "Columbia University", short: "Columbia", city: "New York, NY" },
  { domain: "ucla.edu", name: "UCLA", short: "UCLA", city: "Los Angeles, CA" },
  { domain: "usc.edu", name: "USC", short: "USC", city: "Los Angeles, CA" },
  { domain: "utexas.edu", name: "UT Austin", short: "UT Austin", city: "Austin, TX" },
];

/** "babson.edu" from "sam@babson.edu" or "sam@mail.babson.edu"; null if not .edu. */
export function schoolDomainFor(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 0) return null;
  const host = normalized.slice(at + 1);
  if (!host.endsWith(".edu")) return null;
  // Collapse mail subdomains (mail.babson.edu → babson.edu) so one school
  // doesn't split into several.
  const parts = host.split(".");
  return parts.slice(-2).join(".");
}

/** The school behind a domain. Unknown `.edu` domains get a name from the
 *  domain itself ("stateu.edu" → "Stateu"). */
export function schoolFor(domain: string | null | undefined): School | null {
  if (!domain) return null;
  const known = SCHOOLS.find((s) => s.domain === domain);
  if (known) return known;
  if (!domain.endsWith(".edu")) return null;
  const stem = domain.slice(0, -".edu".length);
  const short = stem.charAt(0).toUpperCase() + stem.slice(1);
  return { domain, name: short, short, city: null };
}

export function schoolForEmail(email: string): School | null {
  return schoolFor(schoolDomainFor(email));
}
