import { CITIES, isCity, milesBetween, nearestCity } from "@/lib/catalog";

/**
 * Every US city a host can name, as opposed to the four Hosty scouts.
 *
 * lib/catalog.ts's CITIES is the short list with a seeded venue catalog and a
 * geocodable centre — venue search and vendor drafting still gate on it. This
 * is the much longer list the Brief tab's typeahead offers, because a brief is
 * complete the moment a city is named: the agent drafts a plan for Chicago
 * even though nothing here can search Chicago for a room.
 *
 * The four scouted names appear below with exactly the strings in CITIES, and
 * tests/unit/cities.test.ts holds that true — the typeahead writing "New York,
 * NY " or "New York City, NY" would silently un-scout an event.
 */

export type UsCity = { name: string; lat: number; lng: number };

/** The ~250 largest US cities by population, city-hall coordinates, in
 *  descending population order — which is also the order ties break in, so a
 *  three-letter query offers the city most hosts mean first. */
export const US_CITIES: readonly UsCity[] = [
  { name: "New York, NY", lat: 40.7128, lng: -74.006 },
  { name: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
  { name: "Houston, TX", lat: 29.7604, lng: -95.3698 },
  { name: "Phoenix, AZ", lat: 33.4484, lng: -112.074 },
  { name: "Philadelphia, PA", lat: 39.9526, lng: -75.1652 },
  { name: "San Antonio, TX", lat: 29.4241, lng: -98.4936 },
  { name: "San Diego, CA", lat: 32.7157, lng: -117.1611 },
  { name: "Dallas, TX", lat: 32.7767, lng: -96.797 },
  { name: "Jacksonville, FL", lat: 30.3322, lng: -81.6557 },
  { name: "Austin, TX", lat: 30.2672, lng: -97.7431 },
  { name: "Fort Worth, TX", lat: 32.7555, lng: -97.3308 },
  { name: "San Jose, CA", lat: 37.3382, lng: -121.8863 },
  { name: "Columbus, OH", lat: 39.9612, lng: -82.9988 },
  { name: "Charlotte, NC", lat: 35.2271, lng: -80.8431 },
  { name: "Indianapolis, IN", lat: 39.7684, lng: -86.1581 },
  { name: "San Francisco, CA", lat: 37.7749, lng: -122.4194 },
  { name: "Seattle, WA", lat: 47.6062, lng: -122.3321 },
  { name: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  { name: "Oklahoma City, OK", lat: 35.4676, lng: -97.5164 },
  { name: "Nashville, TN", lat: 36.1627, lng: -86.7816 },
  { name: "Washington, DC", lat: 38.9072, lng: -77.0369 },
  { name: "El Paso, TX", lat: 31.7619, lng: -106.485 },
  { name: "Las Vegas, NV", lat: 36.1699, lng: -115.1398 },
  { name: "Boston, MA", lat: 42.3601, lng: -71.0589 },
  { name: "Detroit, MI", lat: 42.3314, lng: -83.0458 },
  { name: "Portland, OR", lat: 45.5152, lng: -122.6784 },
  { name: "Louisville, KY", lat: 38.2527, lng: -85.7585 },
  { name: "Memphis, TN", lat: 35.1495, lng: -90.049 },
  { name: "Baltimore, MD", lat: 39.2904, lng: -76.6122 },
  { name: "Milwaukee, WI", lat: 43.0389, lng: -87.9065 },
  { name: "Albuquerque, NM", lat: 35.0844, lng: -106.6504 },
  { name: "Fresno, CA", lat: 36.7378, lng: -119.7871 },
  { name: "Tucson, AZ", lat: 32.2226, lng: -110.9747 },
  { name: "Sacramento, CA", lat: 38.5816, lng: -121.4944 },
  { name: "Mesa, AZ", lat: 33.4152, lng: -111.8315 },
  { name: "Kansas City, MO", lat: 39.0997, lng: -94.5786 },
  { name: "Atlanta, GA", lat: 33.749, lng: -84.388 },
  { name: "Colorado Springs, CO", lat: 38.8339, lng: -104.8214 },
  { name: "Omaha, NE", lat: 41.2565, lng: -95.9345 },
  { name: "Raleigh, NC", lat: 35.7796, lng: -78.6382 },
  { name: "Miami, FL", lat: 25.7617, lng: -80.1918 },
  { name: "Virginia Beach, VA", lat: 36.8529, lng: -75.978 },
  { name: "Long Beach, CA", lat: 33.7701, lng: -118.1937 },
  { name: "Oakland, CA", lat: 37.8044, lng: -122.2712 },
  { name: "Minneapolis, MN", lat: 44.9778, lng: -93.265 },
  { name: "Bakersfield, CA", lat: 35.3733, lng: -119.0187 },
  { name: "Tulsa, OK", lat: 36.154, lng: -95.9928 },
  { name: "Tampa, FL", lat: 27.9506, lng: -82.4572 },
  { name: "Arlington, TX", lat: 32.7357, lng: -97.1081 },
  { name: "Wichita, KS", lat: 37.6872, lng: -97.3301 },
  { name: "New Orleans, LA", lat: 29.9511, lng: -90.0715 },
  { name: "Cleveland, OH", lat: 41.4993, lng: -81.6944 },
  { name: "Aurora, CO", lat: 39.7294, lng: -104.8319 },
  { name: "Anaheim, CA", lat: 33.8366, lng: -117.9143 },
  { name: "Honolulu, HI", lat: 21.3069, lng: -157.8583 },
  { name: "Santa Ana, CA", lat: 33.7455, lng: -117.8677 },
  { name: "Riverside, CA", lat: 33.9806, lng: -117.3755 },
  { name: "Corpus Christi, TX", lat: 27.8006, lng: -97.3964 },
  { name: "Lexington, KY", lat: 38.0406, lng: -84.5037 },
  { name: "Henderson, NV", lat: 36.0395, lng: -114.9817 },
  { name: "Stockton, CA", lat: 37.9577, lng: -121.2908 },
  { name: "Saint Paul, MN", lat: 44.9537, lng: -93.09 },
  { name: "Cincinnati, OH", lat: 39.1031, lng: -84.512 },
  { name: "Saint Louis, MO", lat: 38.627, lng: -90.1994 },
  { name: "Pittsburgh, PA", lat: 40.4406, lng: -79.9959 },
  { name: "Greensboro, NC", lat: 36.0726, lng: -79.792 },
  { name: "Lincoln, NE", lat: 40.8136, lng: -96.7026 },
  { name: "Anchorage, AK", lat: 61.2181, lng: -149.9003 },
  { name: "Plano, TX", lat: 33.0198, lng: -96.6989 },
  { name: "Orlando, FL", lat: 28.5383, lng: -81.3792 },
  { name: "Irvine, CA", lat: 33.6846, lng: -117.8265 },
  { name: "Newark, NJ", lat: 40.7357, lng: -74.1724 },
  { name: "Durham, NC", lat: 35.994, lng: -78.8986 },
  { name: "Chula Vista, CA", lat: 32.6401, lng: -117.0842 },
  { name: "Toledo, OH", lat: 41.6528, lng: -83.5379 },
  { name: "Fort Wayne, IN", lat: 41.0793, lng: -85.1394 },
  { name: "Saint Petersburg, FL", lat: 27.7676, lng: -82.6403 },
  { name: "Laredo, TX", lat: 27.5306, lng: -99.4803 },
  { name: "Jersey City, NJ", lat: 40.7282, lng: -74.0776 },
  { name: "Chandler, AZ", lat: 33.3062, lng: -111.8413 },
  { name: "Madison, WI", lat: 43.0731, lng: -89.4012 },
  { name: "Lubbock, TX", lat: 33.5779, lng: -101.8552 },
  { name: "Scottsdale, AZ", lat: 33.4942, lng: -111.9261 },
  { name: "Reno, NV", lat: 39.5296, lng: -119.8138 },
  { name: "Buffalo, NY", lat: 42.8864, lng: -78.8784 },
  { name: "Gilbert, AZ", lat: 33.3528, lng: -111.789 },
  { name: "Glendale, AZ", lat: 33.5387, lng: -112.186 },
  { name: "North Las Vegas, NV", lat: 36.1989, lng: -115.1175 },
  { name: "Winston-Salem, NC", lat: 36.0999, lng: -80.2442 },
  { name: "Chesapeake, VA", lat: 36.7682, lng: -76.2875 },
  { name: "Norfolk, VA", lat: 36.8508, lng: -76.2859 },
  { name: "Fremont, CA", lat: 37.5485, lng: -121.9886 },
  { name: "Garland, TX", lat: 32.9126, lng: -96.6389 },
  { name: "Irving, TX", lat: 32.814, lng: -96.9489 },
  { name: "Hialeah, FL", lat: 25.8576, lng: -80.2781 },
  { name: "Richmond, VA", lat: 37.5407, lng: -77.436 },
  { name: "Boise, ID", lat: 43.615, lng: -116.2023 },
  { name: "Spokane, WA", lat: 47.6588, lng: -117.426 },
  { name: "Baton Rouge, LA", lat: 30.4515, lng: -91.1871 },
  { name: "Tacoma, WA", lat: 47.2529, lng: -122.4443 },
  { name: "San Bernardino, CA", lat: 34.1083, lng: -117.2898 },
  { name: "Modesto, CA", lat: 37.6391, lng: -120.9969 },
  { name: "Fontana, CA", lat: 34.0922, lng: -117.435 },
  { name: "Des Moines, IA", lat: 41.5868, lng: -93.625 },
  { name: "Moreno Valley, CA", lat: 33.9425, lng: -117.2297 },
  { name: "Santa Clarita, CA", lat: 34.3917, lng: -118.5426 },
  { name: "Fayetteville, NC", lat: 35.0527, lng: -78.8784 },
  { name: "Birmingham, AL", lat: 33.5186, lng: -86.8104 },
  { name: "Oxnard, CA", lat: 34.1975, lng: -119.1771 },
  { name: "Rochester, NY", lat: 43.1566, lng: -77.6088 },
  { name: "Port Saint Lucie, FL", lat: 27.273, lng: -80.3582 },
  { name: "Grand Rapids, MI", lat: 42.9634, lng: -85.6681 },
  { name: "Huntsville, AL", lat: 34.7304, lng: -86.5861 },
  { name: "Salt Lake City, UT", lat: 40.7608, lng: -111.891 },
  { name: "Frisco, TX", lat: 33.1507, lng: -96.8236 },
  { name: "Yonkers, NY", lat: 40.9312, lng: -73.8987 },
  { name: "Amarillo, TX", lat: 35.222, lng: -101.8313 },
  { name: "Glendale, CA", lat: 34.1425, lng: -118.2551 },
  { name: "Huntington Beach, CA", lat: 33.6595, lng: -117.9988 },
  { name: "McKinney, TX", lat: 33.1972, lng: -96.6398 },
  { name: "Montgomery, AL", lat: 32.3668, lng: -86.3 },
  { name: "Augusta, GA", lat: 33.4735, lng: -82.0105 },
  { name: "Aurora, IL", lat: 41.7606, lng: -88.3201 },
  { name: "Akron, OH", lat: 41.0814, lng: -81.519 },
  { name: "Little Rock, AR", lat: 34.7465, lng: -92.2896 },
  { name: "Tempe, AZ", lat: 33.4255, lng: -111.94 },
  { name: "Columbus, GA", lat: 32.461, lng: -84.9877 },
  { name: "Overland Park, KS", lat: 38.9822, lng: -94.6708 },
  { name: "Grand Prairie, TX", lat: 32.7459, lng: -96.9978 },
  { name: "Tallahassee, FL", lat: 30.4383, lng: -84.2807 },
  { name: "Cape Coral, FL", lat: 26.5629, lng: -81.9495 },
  { name: "Mobile, AL", lat: 30.6954, lng: -88.0399 },
  { name: "Knoxville, TN", lat: 35.9606, lng: -83.9207 },
  { name: "Shreveport, LA", lat: 32.5252, lng: -93.7502 },
  { name: "Worcester, MA", lat: 42.2626, lng: -71.8023 },
  { name: "Ontario, CA", lat: 34.0633, lng: -117.6509 },
  { name: "Vancouver, WA", lat: 45.6387, lng: -122.6615 },
  { name: "Sioux Falls, SD", lat: 43.546, lng: -96.7313 },
  { name: "Chattanooga, TN", lat: 35.0456, lng: -85.3097 },
  { name: "Brownsville, TX", lat: 25.9017, lng: -97.4975 },
  { name: "Fort Lauderdale, FL", lat: 26.1224, lng: -80.1373 },
  { name: "Providence, RI", lat: 41.824, lng: -71.4128 },
  { name: "Newport News, VA", lat: 37.0871, lng: -76.473 },
  { name: "Rancho Cucamonga, CA", lat: 34.1064, lng: -117.5931 },
  { name: "Santa Rosa, CA", lat: 38.4404, lng: -122.7141 },
  { name: "Peoria, AZ", lat: 33.5806, lng: -112.2374 },
  { name: "Oceanside, CA", lat: 33.1959, lng: -117.3795 },
  { name: "Elk Grove, CA", lat: 38.4088, lng: -121.3716 },
  { name: "Salem, OR", lat: 44.9429, lng: -123.0351 },
  { name: "Pembroke Pines, FL", lat: 26.0078, lng: -80.2963 },
  { name: "Eugene, OR", lat: 44.0521, lng: -123.0868 },
  { name: "Garden Grove, CA", lat: 33.7743, lng: -117.938 },
  { name: "Cary, NC", lat: 35.7915, lng: -78.7811 },
  { name: "Fort Collins, CO", lat: 40.5853, lng: -105.0844 },
  { name: "Corona, CA", lat: 33.8753, lng: -117.5664 },
  { name: "Springfield, MO", lat: 37.209, lng: -93.2923 },
  { name: "Jackson, MS", lat: 32.2988, lng: -90.1848 },
  { name: "Alexandria, VA", lat: 38.8048, lng: -77.0469 },
  { name: "Hayward, CA", lat: 37.6688, lng: -122.0808 },
  { name: "Clarksville, TN", lat: 36.5298, lng: -87.3595 },
  { name: "Lakewood, CO", lat: 39.7047, lng: -105.0814 },
  { name: "Lancaster, CA", lat: 34.6868, lng: -118.1542 },
  { name: "Salinas, CA", lat: 36.6777, lng: -121.6555 },
  { name: "Palmdale, CA", lat: 34.5794, lng: -118.1165 },
  { name: "Hollywood, FL", lat: 26.0112, lng: -80.1495 },
  { name: "Springfield, MA", lat: 42.1015, lng: -72.5898 },
  { name: "Macon, GA", lat: 32.8407, lng: -83.6324 },
  { name: "Kansas City, KS", lat: 39.1147, lng: -94.6275 },
  { name: "Sunnyvale, CA", lat: 37.3688, lng: -122.0363 },
  { name: "Pomona, CA", lat: 34.0551, lng: -117.75 },
  { name: "Killeen, TX", lat: 31.1171, lng: -97.7278 },
  { name: "Escondido, CA", lat: 33.1192, lng: -117.0864 },
  { name: "Pasadena, TX", lat: 29.6911, lng: -95.2091 },
  { name: "Naperville, IL", lat: 41.7508, lng: -88.1535 },
  { name: "Bellevue, WA", lat: 47.6101, lng: -122.2015 },
  { name: "Joliet, IL", lat: 41.525, lng: -88.0817 },
  { name: "Murfreesboro, TN", lat: 35.8456, lng: -86.3903 },
  { name: "Midland, TX", lat: 31.9973, lng: -102.0779 },
  { name: "Rockford, IL", lat: 42.2711, lng: -89.094 },
  { name: "Paterson, NJ", lat: 40.9168, lng: -74.1718 },
  { name: "Savannah, GA", lat: 32.0809, lng: -81.0912 },
  { name: "Bridgeport, CT", lat: 41.1792, lng: -73.1894 },
  { name: "Torrance, CA", lat: 33.8358, lng: -118.3406 },
  { name: "McAllen, TX", lat: 26.2034, lng: -98.23 },
  { name: "Syracuse, NY", lat: 43.0481, lng: -76.1474 },
  { name: "Surprise, AZ", lat: 33.6292, lng: -112.368 },
  { name: "Denton, TX", lat: 33.2148, lng: -97.1331 },
  { name: "Roseville, CA", lat: 38.7521, lng: -121.288 },
  { name: "Thornton, CO", lat: 39.868, lng: -104.9719 },
  { name: "Miramar, FL", lat: 25.9861, lng: -80.3035 },
  { name: "Pasadena, CA", lat: 34.1478, lng: -118.1445 },
  { name: "Mesquite, TX", lat: 32.7668, lng: -96.5992 },
  { name: "Olathe, KS", lat: 38.8814, lng: -94.8191 },
  { name: "Dayton, OH", lat: 39.7589, lng: -84.1916 },
  { name: "Carrollton, TX", lat: 32.9537, lng: -96.8903 },
  { name: "Waco, TX", lat: 31.5493, lng: -97.1467 },
  { name: "Orange, CA", lat: 33.7879, lng: -117.8531 },
  { name: "Fullerton, CA", lat: 33.8704, lng: -117.9243 },
  { name: "Charleston, SC", lat: 32.7765, lng: -79.9311 },
  { name: "West Valley City, UT", lat: 40.6916, lng: -112.0011 },
  { name: "Visalia, CA", lat: 36.3302, lng: -119.2921 },
  { name: "Hampton, VA", lat: 37.0299, lng: -76.3452 },
  { name: "Gainesville, FL", lat: 29.6516, lng: -82.3248 },
  { name: "Warren, MI", lat: 42.5145, lng: -83.0147 },
  { name: "Coral Springs, FL", lat: 26.2712, lng: -80.2706 },
  { name: "Cedar Rapids, IA", lat: 41.9779, lng: -91.6656 },
  { name: "Round Rock, TX", lat: 30.5083, lng: -97.6789 },
  { name: "Sterling Heights, MI", lat: 42.5803, lng: -83.0302 },
  { name: "Kent, WA", lat: 47.3809, lng: -122.2348 },
  { name: "Columbia, SC", lat: 34.0007, lng: -81.0348 },
  { name: "Santa Clara, CA", lat: 37.3541, lng: -121.9552 },
  { name: "New Haven, CT", lat: 41.3083, lng: -72.9279 },
  { name: "Stamford, CT", lat: 41.0534, lng: -73.5387 },
  { name: "Concord, CA", lat: 37.978, lng: -122.0311 },
  { name: "Elizabeth, NJ", lat: 40.664, lng: -74.2107 },
  { name: "Athens, GA", lat: 33.9519, lng: -83.3576 },
  { name: "Thousand Oaks, CA", lat: 34.1706, lng: -118.8376 },
  { name: "Lafayette, LA", lat: 30.2241, lng: -92.0198 },
  { name: "Simi Valley, CA", lat: 34.2694, lng: -118.7815 },
  { name: "Topeka, KS", lat: 39.0473, lng: -95.6752 },
  { name: "Norman, OK", lat: 35.2226, lng: -97.4395 },
  { name: "Fargo, ND", lat: 46.8772, lng: -96.7898 },
  { name: "Wilmington, NC", lat: 34.2257, lng: -77.9447 },
  { name: "Abilene, TX", lat: 32.4487, lng: -99.7331 },
  { name: "Odessa, TX", lat: 31.8457, lng: -102.3676 },
  { name: "Columbia, MO", lat: 38.9517, lng: -92.3341 },
  { name: "Pearland, TX", lat: 29.5636, lng: -95.286 },
  { name: "Victorville, CA", lat: 34.5362, lng: -117.2928 },
  { name: "Hartford, CT", lat: 41.7658, lng: -72.6734 },
  { name: "Vallejo, CA", lat: 38.1041, lng: -122.2566 },
  { name: "Allentown, PA", lat: 40.6023, lng: -75.4714 },
  { name: "Berkeley, CA", lat: 37.8715, lng: -122.273 },
  { name: "Richardson, TX", lat: 32.9483, lng: -96.7299 },
  { name: "Arvada, CO", lat: 39.8028, lng: -105.0875 },
  { name: "Ann Arbor, MI", lat: 42.2808, lng: -83.743 },
  { name: "Rochester, MN", lat: 44.0121, lng: -92.4802 },
  { name: "Cambridge, MA", lat: 42.3736, lng: -71.1097 },
  { name: "Sugar Land, TX", lat: 29.6197, lng: -95.6349 },
  { name: "Lansing, MI", lat: 42.7325, lng: -84.5555 },
  { name: "Evansville, IN", lat: 37.9716, lng: -87.5711 },
  { name: "College Station, TX", lat: 30.628, lng: -96.3344 },
  { name: "Fairfield, CA", lat: 38.2494, lng: -122.04 },
  { name: "Clearwater, FL", lat: 27.9659, lng: -82.8001 },
  { name: "Beaumont, TX", lat: 30.0802, lng: -94.1266 },
  { name: "Independence, MO", lat: 39.0911, lng: -94.4155 },
  { name: "Provo, UT", lat: 40.2338, lng: -111.6585 },
  { name: "West Jordan, UT", lat: 40.6097, lng: -111.9391 },
  { name: "Murrieta, CA", lat: 33.5539, lng: -117.2139 },
  { name: "Palm Bay, FL", lat: 28.0345, lng: -80.5887 },
];

const BY_NAME = new Map(US_CITIES.map((city) => [city.name, city]));

/** The words a query can match the start of: "New York, NY" offers "new",
 *  "york" and "ny", so a host who thinks of the city by its second word
 *  ("York", "Vegas", "Angeles") still finds it. */
function wordsOf(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
}

/**
 * The cities to offer for what the host has typed so far.
 *
 * Three tiers, best first: the name starts with the query, a word in the name
 * starts with it, the name merely contains it. Whatever matched, the scouted
 * four jump to the front in CITIES order — those are the cities Hosty can
 * actually scout a venue in, so they're the ones worth nudging towards.
 */
export function suggestCities(query: string, limit = 6): UsCity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const startsWithName: UsCity[] = [];
  const startsWithWord: UsCity[] = [];
  const contains: UsCity[] = [];
  for (const city of US_CITIES) {
    const name = city.name.toLowerCase();
    if (name.startsWith(q)) startsWithName.push(city);
    else if (wordsOf(name).some((word) => word.startsWith(q))) startsWithWord.push(city);
    else if (name.includes(q)) contains.push(city);
  }

  const matched = [...startsWithName, ...startsWithWord, ...contains];
  const matchedNames = new Set(matched.map((city) => city.name));
  const scouted = CITIES.filter((name) => matchedNames.has(name)).map(
    (name) => BY_NAME.get(name)!,
  );

  const seen = new Set<string>();
  const ranked: UsCity[] = [];
  for (const city of [...scouted, ...matched]) {
    if (seen.has(city.name)) continue;
    seen.add(city.name);
    ranked.push(city);
    if (ranked.length === limit) break;
  }
  return ranked;
}

/** The nearest city in the table to a point, or null when the closest one is
 *  further than `maxMiles` — the same 60-mile metro radius nearestCity uses,
 *  so a browser fix outside any of these reads as "we don't know" rather than
 *  as the nearest big city three states away. */
export function nearestUsCity(lat: number, lng: number, maxMiles = 60): UsCity | null {
  let best: { city: UsCity; miles: number } | null = null;
  for (const city of US_CITIES) {
    const miles = milesBetween(lat, lng, city.lat, city.lng);
    if (!best || miles < best.miles) best = { city, miles };
  }
  return best && best.miles <= maxMiles ? best.city : null;
}

/**
 * The city to put in the field for a browser's location fix.
 *
 * Nearest-by-distance is the wrong answer here. From Babson, Cambridge is
 * 10.7 miles away and Boston 12.7 — so `nearestUsCity` alone would fill
 * "Cambridge, MA" and silently cost that host venue and vendor drafting, for
 * a night they would themselves describe as being in Boston. `nearestCity`
 * already asks "which scouted metro is this point in?" with the same 60-mile
 * radius, so it gets first refusal; only a point in no scouted metro falls
 * through to the long table.
 */
export function detectCity(lat: number, lng: number): string | null {
  return nearestCity(lat, lng) ?? nearestUsCity(lat, lng)?.name ?? null;
}

/** Whether Hosty scouts venues and vendors in this city — the "Scouted"
 *  badge on a suggestion, and nothing more. Completeness (lib/brief.ts) and
 *  the agent's plan step don't ask. */
export function isScoutedCity(name: string): boolean {
  return isCity(name);
}
