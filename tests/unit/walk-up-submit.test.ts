import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: status.pending, data: null, method: null, action: null }),
}));

import { WalkUpSubmit } from "@/components/walk-up-submit";

beforeEach(() => {
  status.pending = false;
});

describe("<WalkUpSubmit>", () => {
  it("is a live submit button while nothing is in flight", () => {
    const html = renderToStaticMarkup(createElement(WalkUpSubmit));
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain("Add and check in");
  });

  it("disables itself while the walk-up is being added, so a second tap does nothing", () => {
    status.pending = true;
    const html = renderToStaticMarkup(createElement(WalkUpSubmit));
    expect(html).toContain('disabled=""');
    expect(html).toContain("Adding…");
  });
});
