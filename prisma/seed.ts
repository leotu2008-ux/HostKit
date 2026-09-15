import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import type {
  ListingCategory,
  PriceUnit,
} from "../generated/prisma/enums";
import { generatePlan } from "../lib/plan";

/**
 * Seeds the venue and vendor catalog.
 *
 * IMPORTANT: every business below is invented. None of these are real
 * companies, and the prices and ratings are plausible fiction chosen to
 * exercise the scoring logic — cheap and expensive, large and small, some
 * with lead times long enough to disqualify a rushed event.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type CityKey = "NYC" | "LA" | "ATX";

const CITIES: Record<CityKey, { name: string; lat: number; lng: number }> = {
  NYC: { name: "New York, NY", lat: 40.7128, lng: -74.006 },
  LA: { name: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
  ATX: { name: "Austin, TX", lat: 30.2672, lng: -97.7431 },
};

type VenueSeed = {
  city: CityKey;
  name: string;
  neighborhood: string;
  description: string;
  /** Cents per hour. */
  hourly: number;
  capacityMin: number;
  capacityMax: number;
  leadTimeDays: number;
  amenities: string[];
  tags: string[];
  rating: number;
  reviewCount: number;
};

const VENUES: VenueSeed[] = [
  // --- New York ------------------------------------------------------------
  { city: "NYC", name: "The Foundry Room", neighborhood: "Long Island City", description: "A restored iron foundry with 30-foot ceilings, a skylit main hall and an ivy courtyard that takes the overflow in summer.", hourly: 92_000, capacityMin: 60, capacityMax: 180, leadTimeDays: 120, amenities: ["Courtyard", "In-house AV", "Green room", "Step-free access"], tags: ["industrial", "photogenic", "outdoor space"], rating: 4.8, reviewCount: 212 },
  { city: "NYC", name: "Grand Street Loft", neighborhood: "SoHo", description: "A white-box loft on the fifth floor with cast-iron columns, enormous west-facing windows and a freight lift that vendors actually fit in.", hourly: 64_000, capacityMin: 30, capacityMax: 110, leadTimeDays: 45, amenities: ["Freight elevator", "Blackout blinds", "Catering kitchen"], tags: ["loft", "blank canvas", "natural light"], rating: 4.6, reviewCount: 148 },
  { city: "NYC", name: "Hudson & Vine", neighborhood: "Tribeca", description: "A wine cellar turned dining room. Low vaults, long communal tables, and a sommelier who will happily run the pairing.", hourly: 48_000, capacityMin: 14, capacityMax: 48, leadTimeDays: 21, amenities: ["Wine list", "Private entrance", "In-house catering"], tags: ["intimate", "dinner", "wine"], rating: 4.9, reviewCount: 96 },
  { city: "NYC", name: "The Greenpoint Glasshouse", neighborhood: "Greenpoint", description: "A working greenhouse with a cleared central nave, string lights year-round and a skyline view through the east wall.", hourly: 78_000, capacityMin: 40, capacityMax: 140, leadTimeDays: 90, amenities: ["Climate control", "Garden", "Parking"], tags: ["garden", "romantic", "photogenic"], rating: 4.7, reviewCount: 174 },
  { city: "NYC", name: "Penrose Hall", neighborhood: "Brooklyn Heights", description: "A 1912 masonic hall with original oak panelling, a balcony and a stage that has hosted everything from string quartets to product keynotes.", hourly: 110_000, capacityMin: 120, capacityMax: 400, leadTimeDays: 150, amenities: ["Stage", "Balcony", "Green room", "In-house AV"], tags: ["grand", "historic", "large"], rating: 4.5, reviewCount: 263 },
  { city: "NYC", name: "Chelsea Annex", neighborhood: "Chelsea", description: "A ground-floor gallery space that clears completely between shows. Concrete, daylight, and a roller door onto the street.", hourly: 55_000, capacityMin: 25, capacityMax: 90, leadTimeDays: 30, amenities: ["Street access", "Gallery lighting", "Step-free access"], tags: ["gallery", "modern", "blank canvas"], rating: 4.3, reviewCount: 71 },
  { city: "NYC", name: "The Rooftop at Lyle", neighborhood: "Lower East Side", description: "Twelve floors up with a retractable roof, so the weather stops being your problem in October.", hourly: 86_000, capacityMin: 40, capacityMax: 120, leadTimeDays: 60, amenities: ["Retractable roof", "Bar", "Heaters", "City views"], tags: ["rooftop", "drinks", "views"], rating: 4.4, reviewCount: 189 },
  { city: "NYC", name: "Carroll Gardens Supper Club", neighborhood: "Carroll Gardens", description: "A neighborhood restaurant that closes for private hire. Twelve tables, one open kitchen, no corkage.", hourly: 32_000, capacityMin: 10, capacityMax: 36, leadTimeDays: 14, amenities: ["In-house catering", "No corkage", "Sound system"], tags: ["intimate", "dinner", "affordable"], rating: 4.8, reviewCount: 118 },

  // --- Los Angeles ---------------------------------------------------------
  { city: "LA", name: "Villa Arroyo", neighborhood: "Pasadena", description: "A 1920s Spanish colonial with terracotta courtyards, olive trees and a fountain that everyone photographs.", hourly: 96_000, capacityMin: 50, capacityMax: 200, leadTimeDays: 150, amenities: ["Courtyard", "Green room", "Parking", "Gardens"], tags: ["romantic", "outdoor space", "photogenic"], rating: 4.9, reviewCount: 301 },
  { city: "LA", name: "The Arts District Warehouse", neighborhood: "Arts District", description: "Ten thousand square feet of polished concrete and roof trusses. Loading dock, three-phase power, and absolutely no décor.", hourly: 74_000, capacityMin: 80, capacityMax: 450, leadTimeDays: 75, amenities: ["Loading dock", "Three-phase power", "Parking"], tags: ["industrial", "blank canvas", "large"], rating: 4.4, reviewCount: 133 },
  { city: "LA", name: "Canyon House", neighborhood: "Laurel Canyon", description: "A mid-century home cut into the hillside, with a deck that runs the length of the canyon view and a kitchen caterers like.", hourly: 68_000, capacityMin: 20, capacityMax: 80, leadTimeDays: 45, amenities: ["Deck", "Catering kitchen", "Pool", "Views"], tags: ["intimate", "views", "outdoor space"], rating: 4.7, reviewCount: 87 },
  { city: "LA", name: "The Echo Park Boathouse", neighborhood: "Echo Park", description: "A lakeside pavilion with wraparound windows, string lights over the terrace and swans that turn up uninvited.", hourly: 52_000, capacityMin: 30, capacityMax: 120, leadTimeDays: 40, amenities: ["Terrace", "Waterfront", "Step-free access"], tags: ["waterfront", "romantic", "outdoor space"], rating: 4.5, reviewCount: 142 },
  { city: "LA", name: "Sunset Sound Stage 4", neighborhood: "Hollywood", description: "A working sound stage available between productions. Full grid, blackout, and an AV team that comes with the room.", hourly: 130_000, capacityMin: 100, capacityMax: 500, leadTimeDays: 90, amenities: ["Lighting grid", "In-house AV", "Blackout", "Green room"], tags: ["production", "large", "blank canvas"], rating: 4.6, reviewCount: 98 },
  { city: "LA", name: "Casa Marisol", neighborhood: "Venice", description: "A courtyard restaurant two blocks from the beach. Bougainvillea, long tables, and a bar that stays open late.", hourly: 44_000, capacityMin: 20, capacityMax: 70, leadTimeDays: 21, amenities: ["Courtyard", "In-house catering", "Bar"], tags: ["outdoor space", "dinner", "relaxed"], rating: 4.7, reviewCount: 156 },
  { city: "LA", name: "The Wiltern Annex", neighborhood: "Koreatown", description: "An art deco side hall with original terrazzo and a mezzanine. Grand without being stuffy.", hourly: 82_000, capacityMin: 60, capacityMax: 220, leadTimeDays: 100, amenities: ["Mezzanine", "Stage", "Bar", "In-house AV"], tags: ["grand", "historic", "photogenic"], rating: 4.4, reviewCount: 119 },
  { city: "LA", name: "Silver Lake Studio 9", neighborhood: "Silver Lake", description: "A photographer's daylight studio with cycloramas and a small garden. Ideal for daytime events that need to look good.", hourly: 38_000, capacityMin: 10, capacityMax: 45, leadTimeDays: 14, amenities: ["Natural light", "Garden", "Parking"], tags: ["natural light", "intimate", "affordable"], rating: 4.6, reviewCount: 64 },

  // --- Austin --------------------------------------------------------------
  { city: "ATX", name: "Pecan Grove Ranch", neighborhood: "Dripping Springs", description: "Forty acres, a restored barn and a pecan grove strung with lights. Ceremony under the trees, dinner in the barn.", hourly: 70_000, capacityMin: 60, capacityMax: 250, leadTimeDays: 150, amenities: ["Barn", "Gardens", "Parking", "Green room"], tags: ["rustic", "outdoor space", "romantic"], rating: 4.8, reviewCount: 224 },
  { city: "ATX", name: "The Rainey Street Bungalow", neighborhood: "Rainey Street", description: "A converted craftsman bungalow with a deck, a yard and a bar in what used to be the front room.", hourly: 36_000, capacityMin: 20, capacityMax: 90, leadTimeDays: 21, amenities: ["Yard", "Bar", "Deck"], tags: ["relaxed", "drinks", "outdoor space"], rating: 4.5, reviewCount: 167 },
  { city: "ATX", name: "East Sixth Warehouse", neighborhood: "East Austin", description: "A clear-span warehouse with a mural wall, roller doors at both ends and enough power for a full production rig.", hourly: 58_000, capacityMin: 70, capacityMax: 320, leadTimeDays: 60, amenities: ["Loading dock", "Three-phase power", "Step-free access"], tags: ["industrial", "blank canvas", "large"], rating: 4.3, reviewCount: 91 },
  { city: "ATX", name: "Barton Springs Pavilion", neighborhood: "Zilker", description: "An open-sided pavilion by the water with ceiling fans, a covered terrace and a short walk from downtown.", hourly: 42_000, capacityMin: 40, capacityMax: 160, leadTimeDays: 45, amenities: ["Covered terrace", "Waterfront", "Parking"], tags: ["outdoor space", "waterfront", "relaxed"], rating: 4.6, reviewCount: 138 },
  { city: "ATX", name: "The Driskill Ballroom", neighborhood: "Downtown", description: "A restored 1886 ballroom with chandeliers, a mezzanine and staff who have done this a thousand times.", hourly: 104_000, capacityMin: 100, capacityMax: 380, leadTimeDays: 120, amenities: ["Stage", "In-house catering", "In-house AV", "Mezzanine"], tags: ["grand", "historic", "large"], rating: 4.7, reviewCount: 288 },
  { city: "ATX", name: "South Congress Studio", neighborhood: "South Congress", description: "A daylight studio above a record shop. White walls, wooden floors, and a roof terrace for the smokers.", hourly: 30_000, capacityMin: 12, capacityMax: 50, leadTimeDays: 14, amenities: ["Natural light", "Roof terrace", "Sound system"], tags: ["natural light", "intimate", "affordable"], rating: 4.4, reviewCount: 58 },
  { city: "ATX", name: "Hill Country Vineyard", neighborhood: "Driftwood", description: "Terraced vines, a tasting room that opens onto the hillside, and a sunset that does most of the work.", hourly: 88_000, capacityMin: 50, capacityMax: 180, leadTimeDays: 120, amenities: ["Gardens", "Wine list", "Parking", "Views"], tags: ["romantic", "views", "wine"], rating: 4.9, reviewCount: 196 },
  { city: "ATX", name: "The Mueller Hangar", neighborhood: "Mueller", description: "A decommissioned airfield hangar. Vast, echoey and surprisingly good for anything with a screen and a sound system.", hourly: 50_000, capacityMin: 100, capacityMax: 600, leadTimeDays: 75, amenities: ["Loading dock", "Blackout", "Parking", "Three-phase power"], tags: ["industrial", "large", "blank canvas"], rating: 4.2, reviewCount: 77 },
];

type VendorSpec = {
  category: ListingCategory;
  priceUnit: PriceUnit;
  /** Cents. Rotated across the names below to give a spread of price bands. */
  prices: number[];
  leadTimeDays: number;
  tags: string[];
  /** `%s` is replaced with the business name. */
  description: string;
  /** One name per city, in NYC / LA / ATX order. */
  names: [string, string, string];
};

const VENDOR_SPECS: VendorSpec[] = [
  { category: "CATERING", priceUnit: "PERSON", prices: [9_500, 14_500, 6_500], leadTimeDays: 30, tags: ["seasonal", "plated"], description: "%s cooks a short seasonal menu and does it properly. Plated or family style, staff included.", names: ["Sorrel & Ash", "Marigold Table", "Bluebonnet Kitchen"] },
  { category: "CATERING", priceUnit: "PERSON", prices: [4_200, 5_800, 3_600], leadTimeDays: 14, tags: ["casual", "buffet"], description: "%s does generous, unfussy food at volume — the kind people actually go back for seconds of.", names: ["Two Doors Catering", "Grand Central Grill", "Smoke & Sides"] },
  { category: "PHOTOGRAPHY", priceUnit: "FLAT", prices: [420_000, 560_000, 280_000], leadTimeDays: 45, tags: ["documentary", "full day"], description: "%s shoots documentary-style, full day, with a second shooter and a gallery back inside three weeks.", names: ["Halliday Studio", "June & Co Photography", "Ruby Lane Photo"] },
  { category: "PHOTOGRAPHY", priceUnit: "HOUR", prices: [32_000, 38_000, 24_000], leadTimeDays: 10, tags: ["hourly", "events"], description: "%s covers events by the hour — arrivals, speeches, the room before anyone touches it.", names: ["Frame & Field", "Westside Frames", "Congress Ave Photo"] },
  { category: "VIDEOGRAPHY", priceUnit: "FLAT", prices: [380_000, 450_000, 260_000], leadTimeDays: 45, tags: ["highlight film"], description: "%s delivers a short highlight film and the full ceremony, color graded, no drone unless you ask.", names: ["Northlight Films", "Sunset Reel", "Lonestar Motion"] },
  { category: "FLORALS", priceUnit: "FLAT", prices: [240_000, 310_000, 160_000], leadTimeDays: 30, tags: ["seasonal", "installation"], description: "%s works with whatever is actually in season and builds installations that don't look like every other one.", names: ["Wilder Stems", "Bloomfield & Co", "Thistle & Thorn"] },
  { category: "MUSIC_DJ", priceUnit: "FLAT", prices: [180_000, 220_000, 140_000], leadTimeDays: 30, tags: ["dj", "sound included"], description: "%s brings the rig, reads the room, and will honour your do-not-play list without sulking.", names: ["Nightshift DJs", "Echo Park Sound", "Red River Records DJs"] },
  { category: "MUSIC_DJ", priceUnit: "FLAT", prices: [320_000, 380_000, 260_000], leadTimeDays: 60, tags: ["live band"], description: "%s is a seven-piece that plays the standards well and the requests gamely.", names: ["The Brass Union", "The Palisade Six", "The Barton Brass"] },
  { category: "AV_PRODUCTION", priceUnit: "FLAT", prices: [280_000, 340_000, 210_000], leadTimeDays: 21, tags: ["screens", "technician"], description: "%s handles screens, mics and lighting with a technician on site for the whole event — which is the point.", names: ["Meridian AV", "Vector Stage", "Capital AV Works"] },
  { category: "RENTALS", priceUnit: "FLAT", prices: [140_000, 165_000, 95_000], leadTimeDays: 14, tags: ["tables", "delivery"], description: "%s delivers tables, chairs, linen and glassware, sets them out, and comes back for them.", names: ["Hudson Event Hire", "Pacific Party Rentals", "Hill Country Hire"] },
  { category: "BAR_SERVICE", priceUnit: "PERSON", prices: [4_500, 5_500, 3_200], leadTimeDays: 21, tags: ["licensed", "cocktails"], description: "%s runs a licensed bar with two cocktails on batch and bartenders who keep the queue moving.", names: ["The Standing Room", "Ministry of Mixing", "Rainey Street Bar Co"] },
  { category: "CAKE_DESSERT", priceUnit: "FLAT", prices: [65_000, 78_000, 44_000], leadTimeDays: 21, tags: ["custom"], description: "%s bakes to order, delivers assembled, and does a dairy-free tier without making it a whole thing.", names: ["Linden Bakehouse", "Almond & Oak", "Sugarbird Bakery"] },
  { category: "TRANSPORT", priceUnit: "FLAT", prices: [125_000, 145_000, 88_000], leadTimeDays: 14, tags: ["shuttle"], description: "%s shuttles guests on a loop so nobody has to think about parking or driving home.", names: ["Metro Coach Co", "Westbound Shuttles", "Lone Star Coaches"] },
  { category: "STAFFING", priceUnit: "PERSON", prices: [3_800, 4_400, 2_900], leadTimeDays: 14, tags: ["servers", "coordinator"], description: "%s supplies servers and a floor lead who has run this kind of room before.", names: ["Front of House NYC", "Golden State Staffing", "Austin Event Crew"] },
  { category: "DECOR_STYLING", priceUnit: "FLAT", prices: [195_000, 240_000, 130_000], leadTimeDays: 30, tags: ["styling", "install"], description: "%s styles the room end to end — linen, lighting, table settings — and strikes it afterwards.", names: ["Studio Lorne", "Marlowe Styling", "Field & Fold"] },
  { category: "INVITATIONS", priceUnit: "FLAT", prices: [58_000, 70_000, 38_000], leadTimeDays: 45, tags: ["letterpress", "digital"], description: "%s designs and prints the suite, handles the digital RSVP, and addresses the envelopes if you ask nicely.", names: ["Pressfold Paper", "Sable & Salt", "Armadillo Press"] },
];

const CITY_ORDER: CityKey[] = ["NYC", "LA", "ATX"];

/** Spreads listings around the city centre so the map isn't one stack of pins. */
function jitter(base: number, seed: number, spread = 0.09) {
  const wave = Math.sin(seed * 12.9898) * 43758.5453;
  return base + (wave - Math.floor(wave) - 0.5) * spread;
}

async function main() {
  const existing = await db.listing.count();
  if (existing > 0) {
    console.log(`Catalog already has ${existing} listings; skipping catalog seed.`);
  } else {
    await seedCatalog();
  }
  await seedDemoNights();
  await seedCampusDemo();
}

async function seedCatalog() {
  console.log("Seeding catalog…");

  const rows: Array<Parameters<typeof db.listing.create>[0]["data"]> = [];

  VENUES.forEach((v, index) => {
    const city = CITIES[v.city];
    rows.push({
      kind: "VENUE",
      category: "VENUE",
      name: v.name,
      description: v.description,
      city: city.name,
      neighborhood: v.neighborhood,
      lat: jitter(city.lat, index + 1),
      lng: jitter(city.lng, index + 101),
      priceCents: v.hourly,
      priceUnit: "HOUR",
      capacityMin: v.capacityMin,
      capacityMax: v.capacityMax,
      leadTimeDays: v.leadTimeDays,
      amenities: v.amenities,
      tags: v.tags,
      rating: v.rating,
      reviewCount: v.reviewCount,
    });
  });

  VENDOR_SPECS.forEach((spec, specIndex) => {
    CITY_ORDER.forEach((cityKey, cityIndex) => {
      const city = CITIES[cityKey];
      const name = spec.names[cityIndex];
      const seed = specIndex * 7 + cityIndex * 31;
      rows.push({
        kind: "VENDOR",
        category: spec.category,
        name,
        description: spec.description.replace("%s", name),
        city: city.name,
        neighborhood: null,
        lat: jitter(city.lat, seed + 1),
        lng: jitter(city.lng, seed + 201),
        priceCents: spec.prices[cityIndex],
        priceUnit: spec.priceUnit,
        capacityMin: null,
        capacityMax: null,
        leadTimeDays: spec.leadTimeDays,
        amenities: [],
        tags: spec.tags,
        // Ratings between 4.1 and 4.9, deterministic per listing.
        rating: Math.round((4.1 + ((seed * 13) % 9) / 10) * 10) / 10,
        reviewCount: 20 + ((seed * 17) % 180),
      });
    });
  });

  for (const data of rows) {
    await db.listing.create({ data });
  }

  const byCity = await db.listing.groupBy({ by: ["city"], _count: true });
  const byKind = await db.listing.groupBy({ by: ["kind"], _count: true });
  console.log(`Seeded ${rows.length} listings.`);
  for (const row of byCity) console.log(`  ${row.city}: ${row._count}`);
  for (const row of byKind) console.log(`  ${row.kind}: ${row._count}`);
}

const DEMO_EMAIL = "maya@hostkit.demo";

/**
 * Confirms a demo account that was seeded before seeded accounts were born
 * confirmed.
 *
 * Sign-in refuses an address that was never confirmed, and a demo account has
 * no inbox to confirm from. Creating them confirmed fixes a fresh database,
 * but not the ones already out there: both seed steps below return early when
 * the account already has its nights, so an existing unconfirmed demo account
 * would stay locked out of production forever. This runs before that check.
 */
async function confirmDemoAccount(email: string): Promise<void> {
  const { count } = await db.user.updateMany({
    where: { email, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  if (count > 0) console.log(`Confirmed ${email} so it can sign in.`);
}

async function seedDemoNights() {
  await confirmDemoAccount(DEMO_EMAIL);
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    const nights = await db.event.count({ where: { ownerId: existing.id } });
    if (nights > 0) {
      console.log("Demo nights already seeded; skipping.");
      return;
    }
  }

  const passwordHash = await bcrypt.hash("hostkit-demo", 10);
  const host =
    existing ??
    (await db.user.create({
      data: {
        email: DEMO_EMAIL,
        name: "Maya Chen",
        passwordHash,
        // Seeded accounts have no inbox to confirm from, and sign-in refuses
        // an unconfirmed address, so they are born confirmed.
        emailVerifiedAt: new Date(),
      },
    }));

  const samples = [
    {
      title: "Rooftop Jazz Night",
      type: "LAUNCH_PARTY" as const,
      city: "New York, NY",
      guestCount: 90,
      durationHours: 4,
      budget: 12_000_00,
      vibe: "Warm lights, a quartet, and the city as the backdrop.",
      daysFromNow: 18,
    },
    {
      title: "Harvest Supper",
      type: "DINNER_PARTY" as const,
      city: "Austin, TX",
      guestCount: 36,
      durationHours: 4,
      budget: 4_800_00,
      vibe: "Long tables, seasonal plates, no speeches.",
      daysFromNow: 32,
    },
    {
      title: "Founders & Friends Mixer",
      type: "CORPORATE_OFFSITE" as const,
      city: "Los Angeles, CA",
      guestCount: 80,
      durationHours: 3,
      budget: 6_000_00,
      vibe: "Short demos, long conversations, and enough food to skip dinner.",
      daysFromNow: 24,
    },
  ];

  for (const sample of samples) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + sample.daysFromNow);
    const plan = generatePlan({
      type: sample.type,
      date,
      budgetTotalCents: sample.budget,
    });

    const created = await db.event.create({
      data: {
        ownerId: host.id,
        title: sample.title,
        type: sample.type,
        date,
        durationHours: sample.durationHours,
        guestCount: sample.guestCount,
        city: sample.city,
        budgetTotalCents: sample.budget,
        vibe: sample.vibe,
        description: sample.vibe,
        published: true,
        visibility: "PUBLIC",
        ticketType: "FREE",
      },
    });

    await db.budgetCategory.createMany({
      data: plan.categories.map((c) => ({
        eventId: created.id,
        category: c.category,
        name: c.name,
        allocatedCents: c.allocatedCents,
      })),
    });
    await db.task.createMany({
      data: plan.tasks.map((t) => ({
        eventId: created.id,
        title: t.title,
        notes: t.notes ?? null,
        offsetDays: t.offsetDays,
        category: t.category ?? null,
        dueDate: t.dueDate,
      })),
    });
  }

  console.log(`Seeded ${samples.length} public demo nights for ${DEMO_EMAIL}.`);
}

const STUDENT_EMAIL = "sam@babson.edu";

/** A demo Babson student with a couple of campus nights, so the student side
 *  of Discover has something to show. Same password as the demo host. */
async function seedCampusDemo() {
  await confirmDemoAccount(STUDENT_EMAIL);
  const existing = await db.user.findUnique({ where: { email: STUDENT_EMAIL } });
  if (existing) {
    const nights = await db.event.count({ where: { ownerId: existing.id } });
    if (nights > 0) {
      console.log("Campus demo already seeded; skipping.");
      return;
    }
  }

  const student =
    existing ??
    (await db.user.create({
      data: {
        email: STUDENT_EMAIL,
        name: "Sam Okafor",
        passwordHash: await bcrypt.hash("hostkit-demo", 10),
        // As above: no inbox, so confirm at creation or it can never sign in.
        emailVerifiedAt: new Date(),
        schoolDomain: "babson.edu",
        classYear: new Date().getFullYear() + 2,
        bio: "Runs the entrepreneurship club's Thursday nights.",
      },
    }));

  const samples = [
    {
      title: "Thursday Pitch Night",
      type: "LAUNCH_PARTY" as const,
      guestCount: 60,
      durationHours: 3,
      budget: 800_00,
      vibe: "Five student founders, three minutes each, one very loud crowd. Free pizza, no slides longer than ten.",
      address: "Olin Hall, Babson Park",
      daysFromNow: 5,
    },
    {
      title: "End-of-Term Rooftop Social",
      type: "BIRTHDAY" as const,
      guestCount: 120,
      durationHours: 4,
      budget: 2_500_00,
      vibe: "Exams are done. A DJ, a taco truck, and the whole class on one roof.",
      address: "Roger's Pub, Babson Park",
      daysFromNow: 19,
    },
  ];

  for (const sample of samples) {
    const date = new Date();
    date.setHours(19, 0, 0, 0);
    date.setDate(date.getDate() + sample.daysFromNow);
    const plan = generatePlan({ type: sample.type, date, budgetTotalCents: sample.budget });

    const created = await db.event.create({
      data: {
        ownerId: student.id,
        schoolDomain: "babson.edu",
        title: sample.title,
        type: sample.type,
        date,
        durationHours: sample.durationHours,
        guestCount: sample.guestCount,
        city: "Boston, MA",
        address: sample.address,
        budgetTotalCents: sample.budget,
        vibe: sample.vibe,
        description: sample.vibe,
        published: true,
        visibility: "PUBLIC",
        ticketType: "FREE",
      },
    });
    await db.budgetCategory.createMany({
      data: plan.categories.map((c) => ({
        eventId: created.id,
        category: c.category,
        name: c.name,
        allocatedCents: c.allocatedCents,
      })),
    });
    await db.task.createMany({
      data: plan.tasks.map((t) => ({
        eventId: created.id,
        title: t.title,
        notes: t.notes ?? null,
        offsetDays: t.offsetDays,
        category: t.category ?? null,
        dueDate: t.dueDate,
      })),
    });
  }

  console.log(`Seeded ${samples.length} campus nights for ${STUDENT_EMAIL}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
