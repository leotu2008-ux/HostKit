import { describe, expect, it } from "vitest";
import { mineRoleLabel } from "@/lib/mine-format";

describe("mineRoleLabel", () => {
  it("names each role on a Your events tile", () => {
    expect(mineRoleLabel("hosting", true)).toBe("Hosting");
    expect(mineRoleLabel("hosting", false)).toBe("Draft");
    expect(mineRoleLabel("going", true)).toBe("Going");
    expect(mineRoleLabel("pending", true)).toBe("Requested");
    expect(mineRoleLabel("waitlisted", true)).toBe("Waitlist");
  });
});
