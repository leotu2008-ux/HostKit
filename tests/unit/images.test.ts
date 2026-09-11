import { describe, expect, it } from "vitest";
import { validateImage, MAX_IMAGE_BYTES } from "@/lib/images";

describe("validateImage", () => {
  it("accepts jpeg, png and webp up to the limit", () => {
    expect(validateImage("image/jpeg", 1024)).toBeNull();
    expect(validateImage("image/png; charset=binary", 1024)).toBeNull();
    expect(validateImage("IMAGE/WEBP", MAX_IMAGE_BYTES)).toBeNull();
  });

  it("rejects other types, empty bodies and oversized files", () => {
    expect(validateImage("image/heic", 1024)).toMatch(/JPEG, PNG or WebP/);
    expect(validateImage(null, 1024)).toMatch(/JPEG/);
    expect(validateImage("image/jpeg", 0)).toMatch(/empty/);
    expect(validateImage("image/jpeg", MAX_IMAGE_BYTES + 1)).toMatch(/5 MB/);
  });
});
