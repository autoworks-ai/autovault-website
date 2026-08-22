import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const scriptUrl = new URL("../scripts/stripe-listen.mjs", import.meta.url);
const script = readFileSync(scriptUrl, "utf-8");

function run(env: Record<string, string>) {
  try {
    execFileSync("node", [scriptUrl.pathname], {
      env: { ...process.env, ...env },
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 10_000,
    });
    return { code: 0, output: "" };
  } catch (error) {
    const e = error as { status?: number; stderr?: string; stdout?: string };
    return { code: e.status ?? -1, output: `${e.stderr ?? ""}${e.stdout ?? ""}` };
  }
}

describe("stripe listen wrapper", () => {
  it("refuses a live key outright", () => {
    // This forwards real Stripe events at a local webhook that writes to the
    // dev database. A warning is not enough.
    const { code, output } = run({ STRIPE_API_KEY: "sk_live_notarealkey" });
    expect(code).toBe(1);
    expect(output).toMatch(/Refusing to run/);
  });

  it("never passes the key as an argv flag", () => {
    // argv is visible in `ps` output and can land in shell history. The key
    // goes through the child's environment instead.
    expect(script).not.toContain('"--api-key"');
    expect(script).toContain("STRIPE_API_KEY: apiKey");
  });

  it("points at the non-expiring key source when none is configured", () => {
    // The whole reason this wrapper exists: `stripe login`'s key expires
    // after 90 days and fails far from its cause.
    expect(script).toContain("Dashboard");
    expect(script).toMatch(/expires that one 90 days/i);
  });
});
