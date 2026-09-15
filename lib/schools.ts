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
  /**
   * The school's own published primary colour. Not used raw — lib/school-color.ts
   * holds the hue and negotiates the lightness so it stays legible on both
   * grounds. Columbia's light blue and Purdue's old gold are the cases that
   * prove why.
   */
  color?: string;
};

const BOS: City = "Boston, MA";
const NYC: City = "New York, NY";
const LA: City = "Los Angeles, CA";
const ATX: City = "Austin, TX";

/** The Boston schools HostKit started with, then the U.S. News top 50
 *  national universities (2026, ties included) and a few more with feeds. */
export const SCHOOLS: School[] = [
  { domain: "babson.edu", name: "Babson College", short: "Babson", city: BOS, color: "#006747" },
  { domain: "olin.edu", name: "Olin College", short: "Olin", city: BOS, color: "#c8102e" },
  { domain: "wellesley.edu", name: "Wellesley College", short: "Wellesley", city: BOS, color: "#002776" },
  { domain: "bu.edu", name: "Boston University", short: "BU", city: BOS, color: "#cc0000" },
  { domain: "bc.edu", name: "Boston College", short: "BC", city: BOS, color: "#8c2232" },
  { domain: "northeastern.edu", name: "Northeastern University", short: "Northeastern", city: BOS, color: "#d41b2c" },
  { domain: "harvard.edu", name: "Harvard University", short: "Harvard", city: BOS, color: "#a51c30" },
  { domain: "mit.edu", name: "MIT", short: "MIT", city: BOS, color: "#a31f34" },
  { domain: "tufts.edu", name: "Tufts University", short: "Tufts", city: BOS, color: "#3e8ede" },
  { domain: "brandeis.edu", name: "Brandeis University", short: "Brandeis", city: BOS, color: "#003478" },
  { domain: "princeton.edu", name: "Princeton University", short: "Princeton", city: null, color: "#e77500" },
  { domain: "stanford.edu", name: "Stanford University", short: "Stanford", city: null, color: "#8c1515" },
  { domain: "yale.edu", name: "Yale University", short: "Yale", city: null, color: "#00356b" },
  { domain: "caltech.edu", name: "Caltech", short: "Caltech", city: LA, color: "#ff6c0c" },
  { domain: "duke.edu", name: "Duke University", short: "Duke", city: null, color: "#00539b" },
  { domain: "jhu.edu", name: "Johns Hopkins University", short: "Johns Hopkins", city: null, color: "#002d72" },
  { domain: "northwestern.edu", name: "Northwestern University", short: "Northwestern", city: null, color: "#4e2a84" },
  { domain: "upenn.edu", name: "University of Pennsylvania", short: "Penn", city: null, color: "#011f5b" },
  { domain: "cornell.edu", name: "Cornell University", short: "Cornell", city: null, color: "#b31b1b" },
  { domain: "uchicago.edu", name: "University of Chicago", short: "UChicago", city: null, color: "#800000" },
  { domain: "brown.edu", name: "Brown University", short: "Brown", city: null, color: "#4e3629" },
  { domain: "columbia.edu", name: "Columbia University", short: "Columbia", city: NYC, color: "#b9d9eb" },
  { domain: "barnard.edu", name: "Barnard College", short: "Barnard", city: NYC, color: "#6cace4" },
  { domain: "dartmouth.edu", name: "Dartmouth College", short: "Dartmouth", city: null, color: "#00693e" },
  { domain: "ucla.edu", name: "UCLA", short: "UCLA", city: LA, color: "#2d68c4" },
  { domain: "berkeley.edu", name: "UC Berkeley", short: "Berkeley", city: null, color: "#003262" },
  { domain: "rice.edu", name: "Rice University", short: "Rice", city: null, color: "#00205b" },
  { domain: "nd.edu", name: "University of Notre Dame", short: "Notre Dame", city: null, color: "#0c2340" },
  { domain: "vanderbilt.edu", name: "Vanderbilt University", short: "Vanderbilt", city: null, color: "#866d4b" },
  { domain: "cmu.edu", name: "Carnegie Mellon University", short: "CMU", city: null, color: "#c41230" },
  { domain: "umich.edu", name: "University of Michigan", short: "Michigan", city: null, color: "#00274c" },
  { domain: "wustl.edu", name: "Washington University in St. Louis", short: "WashU", city: null, color: "#a51417" },
  { domain: "emory.edu", name: "Emory University", short: "Emory", city: null, color: "#012169" },
  { domain: "georgetown.edu", name: "Georgetown University", short: "Georgetown", city: null, color: "#041e42" },
  { domain: "virginia.edu", name: "University of Virginia", short: "UVA", city: null, color: "#232d4b" },
  { domain: "unc.edu", name: "UNC Chapel Hill", short: "UNC", city: null, color: "#4b9cd3" },
  { domain: "usc.edu", name: "USC", short: "USC", city: LA, color: "#990000" },
  { domain: "ucsd.edu", name: "UC San Diego", short: "UCSD", city: null, color: "#182b49" },
  { domain: "nyu.edu", name: "New York University", short: "NYU", city: NYC, color: "#57068c" },
  { domain: "ufl.edu", name: "University of Florida", short: "UF", city: null, color: "#0021a5" },
  { domain: "utexas.edu", name: "UT Austin", short: "UT Austin", city: ATX, color: "#bf5700" },
  { domain: "gatech.edu", name: "Georgia Tech", short: "Georgia Tech", city: null, color: "#003057" },
  { domain: "ucdavis.edu", name: "UC Davis", short: "UC Davis", city: null, color: "#022851" },
  { domain: "uci.edu", name: "UC Irvine", short: "UCI", city: null, color: "#0064a4" },
  { domain: "illinois.edu", name: "University of Illinois Urbana-Champaign", short: "UIUC", city: null, color: "#13294b" },
  { domain: "ucsb.edu", name: "UC Santa Barbara", short: "UCSB", city: null, color: "#003660" },
  { domain: "wisc.edu", name: "University of Wisconsin–Madison", short: "Wisconsin", city: null, color: "#c5050c" },
  { domain: "rutgers.edu", name: "Rutgers University", short: "Rutgers", city: null, color: "#cc0033" },
  { domain: "washington.edu", name: "University of Washington", short: "UW", city: null, color: "#4b2e83" },
  { domain: "osu.edu", name: "Ohio State University", short: "Ohio State", city: null, color: "#bb0000" },
  { domain: "purdue.edu", name: "Purdue University", short: "Purdue", city: null, color: "#ceb888" },
  { domain: "umd.edu", name: "University of Maryland", short: "Maryland", city: null, color: "#e21833" },
  { domain: "lehigh.edu", name: "Lehigh University", short: "Lehigh", city: null, color: "#653819" },
  { domain: "tamu.edu", name: "Texas A&M University", short: "Texas A&M", city: null, color: "#500000" },
  { domain: "uga.edu", name: "University of Georgia", short: "UGA", city: null, color: "#ba0c2f" },
  { domain: "rochester.edu", name: "University of Rochester", short: "Rochester", city: null, color: "#003b71" },
  { domain: "wfu.edu", name: "Wake Forest University", short: "Wake Forest", city: null, color: "#9e7e38" },
  { domain: "umn.edu", name: "University of Minnesota", short: "Minnesota", city: null, color: "#7a0019" },
  { domain: "fsu.edu", name: "Florida State University", short: "FSU", city: null, color: "#782f40" },
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
