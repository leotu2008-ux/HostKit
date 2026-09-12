import type { City } from "@/lib/catalog";

/**
 * Schools HostKit knows by email domain.
 *
 * A student is anyone who signed up with a `.edu` address; the domain is
 * trusted, not verified (yet). Known schools get a proper name and a home
 * city so Discover can default to it. Any other `.edu` still counts as a
 * student, named from the domain, with no home city. Anyone can also pick
 * a school in Settings. Official calendars per school live in
 * lib/campus/sources.ts.
 */

export type School = {
  domain: string;
  name: string;
  /** How the school is referred to on chips and in sentences. */
  short: string;
  city: City | null;
};

const BOS: City = "Boston, MA";
const NYC: City = "New York, NY";
const LA: City = "Los Angeles, CA";
const ATX: City = "Austin, TX";

/** The Boston schools HostKit started with, then the U.S. News top 50
 *  national universities (2026, ties included) and a few more with feeds. */
export const SCHOOLS: School[] = [
  { domain: "babson.edu", name: "Babson College", short: "Babson", city: BOS },
  { domain: "olin.edu", name: "Olin College", short: "Olin", city: BOS },
  { domain: "wellesley.edu", name: "Wellesley College", short: "Wellesley", city: BOS },
  { domain: "bu.edu", name: "Boston University", short: "BU", city: BOS },
  { domain: "bc.edu", name: "Boston College", short: "BC", city: BOS },
  { domain: "northeastern.edu", name: "Northeastern University", short: "Northeastern", city: BOS },
  { domain: "harvard.edu", name: "Harvard University", short: "Harvard", city: BOS },
  { domain: "mit.edu", name: "MIT", short: "MIT", city: BOS },
  { domain: "tufts.edu", name: "Tufts University", short: "Tufts", city: BOS },
  { domain: "brandeis.edu", name: "Brandeis University", short: "Brandeis", city: BOS },
  { domain: "princeton.edu", name: "Princeton University", short: "Princeton", city: null },
  { domain: "stanford.edu", name: "Stanford University", short: "Stanford", city: null },
  { domain: "yale.edu", name: "Yale University", short: "Yale", city: null },
  { domain: "caltech.edu", name: "Caltech", short: "Caltech", city: LA },
  { domain: "duke.edu", name: "Duke University", short: "Duke", city: null },
  { domain: "jhu.edu", name: "Johns Hopkins University", short: "Johns Hopkins", city: null },
  { domain: "northwestern.edu", name: "Northwestern University", short: "Northwestern", city: null },
  { domain: "upenn.edu", name: "University of Pennsylvania", short: "Penn", city: null },
  { domain: "cornell.edu", name: "Cornell University", short: "Cornell", city: null },
  { domain: "uchicago.edu", name: "University of Chicago", short: "UChicago", city: null },
  { domain: "brown.edu", name: "Brown University", short: "Brown", city: null },
  { domain: "columbia.edu", name: "Columbia University", short: "Columbia", city: NYC },
  { domain: "dartmouth.edu", name: "Dartmouth College", short: "Dartmouth", city: null },
  { domain: "ucla.edu", name: "UCLA", short: "UCLA", city: LA },
  { domain: "berkeley.edu", name: "UC Berkeley", short: "Berkeley", city: null },
  { domain: "rice.edu", name: "Rice University", short: "Rice", city: null },
  { domain: "nd.edu", name: "University of Notre Dame", short: "Notre Dame", city: null },
  { domain: "vanderbilt.edu", name: "Vanderbilt University", short: "Vanderbilt", city: null },
  { domain: "cmu.edu", name: "Carnegie Mellon University", short: "CMU", city: null },
  { domain: "umich.edu", name: "University of Michigan", short: "Michigan", city: null },
  { domain: "wustl.edu", name: "Washington University in St. Louis", short: "WashU", city: null },
  { domain: "emory.edu", name: "Emory University", short: "Emory", city: null },
  { domain: "georgetown.edu", name: "Georgetown University", short: "Georgetown", city: null },
  { domain: "virginia.edu", name: "University of Virginia", short: "UVA", city: null },
  { domain: "unc.edu", name: "UNC Chapel Hill", short: "UNC", city: null },
  { domain: "usc.edu", name: "USC", short: "USC", city: LA },
  { domain: "ucsd.edu", name: "UC San Diego", short: "UCSD", city: null },
  { domain: "nyu.edu", name: "New York University", short: "NYU", city: NYC },
  { domain: "ufl.edu", name: "University of Florida", short: "UF", city: null },
  { domain: "utexas.edu", name: "UT Austin", short: "UT Austin", city: ATX },
  { domain: "gatech.edu", name: "Georgia Tech", short: "Georgia Tech", city: null },
  { domain: "ucdavis.edu", name: "UC Davis", short: "UC Davis", city: null },
  { domain: "uci.edu", name: "UC Irvine", short: "UCI", city: null },
  { domain: "illinois.edu", name: "University of Illinois Urbana-Champaign", short: "UIUC", city: null },
  { domain: "ucsb.edu", name: "UC Santa Barbara", short: "UCSB", city: null },
  { domain: "wisc.edu", name: "University of Wisconsin–Madison", short: "Wisconsin", city: null },
  { domain: "rutgers.edu", name: "Rutgers University", short: "Rutgers", city: null },
  { domain: "washington.edu", name: "University of Washington", short: "UW", city: null },
  { domain: "osu.edu", name: "Ohio State University", short: "Ohio State", city: null },
  { domain: "purdue.edu", name: "Purdue University", short: "Purdue", city: null },
  { domain: "umd.edu", name: "University of Maryland", short: "Maryland", city: null },
  { domain: "lehigh.edu", name: "Lehigh University", short: "Lehigh", city: null },
  { domain: "tamu.edu", name: "Texas A&M University", short: "Texas A&M", city: null },
  { domain: "uga.edu", name: "University of Georgia", short: "UGA", city: null },
  { domain: "rochester.edu", name: "University of Rochester", short: "Rochester", city: null },
  { domain: "wfu.edu", name: "Wake Forest University", short: "Wake Forest", city: null },
  { domain: "umn.edu", name: "University of Minnesota", short: "Minnesota", city: null },
  { domain: "fsu.edu", name: "Florida State University", short: "FSU", city: null },
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
