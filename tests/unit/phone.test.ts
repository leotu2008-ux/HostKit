import { describe, expect, it } from "vitest";
import { codeMessage, formatPhone, normalizePhone } from "@/lib/phone-format";

describe("normalizePhone", () => {
  it("assumes the US for ten digits, however they're typed", () => {
    expect(normalizePhone("(617) 555-0100")).toBe("+16175550100");
    expect(normalizePhone("617.555.0100")).toBe("+16175550100");
    expect(normalizePhone("1 617 555 0100")).toBe("+16175550100");
  });

  it("keeps international numbers that start with +", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone(" +1 (617) 555-0100 ")).toBe("+16175550100");
  });

  it("rejects things that aren't phone numbers", () => {
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizePhone("+12")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("prints US numbers the familiar way and others with spacing", () => {
    expect(formatPhone("+16175550100")).toBe("(617) 555-0100");
    expect(formatPhone("+442079460958")).toBe("+442 079 460 958");
  });
});

describe("codeMessage", () => {
  it("names the app and the expiry", () => {
    expect(codeMessage("123456")).toBe("Your Hosty code is 123456. It expires in 10 minutes.");
  });
});
