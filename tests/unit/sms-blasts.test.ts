import { describe, expect, it } from "vitest";
import { phoneRecipientsFor, SMS_CAP } from "@/lib/blasts";
import { smsText } from "@/lib/blast-send";

const verified = (phone: string) => ({ phone, phoneVerifiedAt: new Date("2026-09-01") });

describe("phoneRecipientsFor", () => {
  const guests = [
    { name: "Ada", rsvpStatus: "ATTENDING" as const, user: verified("+16175550100") },
    { name: "Grace", rsvpStatus: "ATTENDING" as const, user: { phone: "+16175550101", phoneVerifiedAt: null } },
    { name: "Alan", rsvpStatus: "INVITED" as const, user: verified("+16175550102") },
    { name: "Dup", rsvpStatus: "ATTENDING" as const, user: verified("+16175550100") },
    { name: "Nope", rsvpStatus: "DECLINED" as const, user: verified("+16175550103") },
    { name: "Typed in", rsvpStatus: "ATTENDING" as const, user: null },
  ];

  it("texts only verified phones in the segment, once each", () => {
    expect(phoneRecipientsFor("going", guests).map((r) => r.name)).toEqual(["Ada"]);
    expect(phoneRecipientsFor("everyone", guests).map((r) => r.name)).toEqual(["Ada", "Alan"]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: SMS_CAP + 20 }, (_, i) => ({
      name: `G${i}`,
      rsvpStatus: "ATTENDING" as const,
      user: verified(`+1617555${String(i).padStart(4, "0")}`),
    }));
    expect(phoneRecipientsFor("going", many)).toHaveLength(SMS_CAP);
  });
});

describe("smsText", () => {
  it("personalises and signs the message", () => {
    expect(smsText("Hi {name}, doors at 7.", "Ada Lovelace", "Sam")).toBe(
      "Hi Ada, doors at 7.\n— Sam via Student Events. Reply STOP to opt out.",
    );
  });
});
