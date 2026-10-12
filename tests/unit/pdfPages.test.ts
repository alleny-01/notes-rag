// @vitest-environment node
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("server PDF pages", () => {
  it("renders text, blank, and image-only PDF pages with claim-level debug boxes", () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "tests/fixtures/verifyPdfPages.ts"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({
      pages: 3,
      blankPage: true,
      imageOnly: true,
      citationRoundTrip: true,
    });
  }, 30_000);
});
