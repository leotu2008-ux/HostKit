import { describe, expect, it } from "vitest";
import { normalizePlace } from "@/lib/venues/apple-maps";

describe("normalizePlace", () => {
  it("flattens an Apple place into a venue", () => {
    expect(
      normalizePlace({
        name: "The Lantern Roof",
        coordinate: { latitude: 42.3601, longitude: -71.0589 },
        formattedAddressLines: ["12 W 29th St", "Boston, MA 02116", "United States"],
        poiCategory: "Nightlife",
        phoneNumber: "+1 (617) 555-0100",
        url: "https://lantern.example",
      }),
    ).toEqual({
      id: "The Lantern Roof@42.36010,-71.05890",
      name: "The Lantern Roof",
      address: "12 W 29th St, Boston, MA 02116, United States",
      phone: "+1 (617) 555-0100",
      website: "https://lantern.example",
      lat: 42.3601,
      lng: -71.0589,
      category: "Nightlife",
    });
  });

  it("copes with missing contact details", () => {
    const venue = normalizePlace({
      name: "Somewhere",
      coordinate: { latitude: 1, longitude: 2 },
    });
    expect(venue).toMatchObject({ address: "", phone: null, website: null, category: null });
  });

  it("drops places with no name or coordinate", () => {
    expect(normalizePlace({ name: "Nameless" })).toBeNull();
    expect(normalizePlace({ coordinate: { latitude: 1, longitude: 2 } })).toBeNull();
  });
});
