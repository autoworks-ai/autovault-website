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

describe("set-dev-var helper", () => {
  const setter = readFileSync(new URL("../scripts/set-dev-var.mjs", import.meta.url), "utf-8");

  it("takes the secret from stdin or clipboard, never from argv", () => {
    // A sed one-liner puts the credential in argv, where it lands in shell
    // history, ps output, and any transcript of the session that ran it.
    expect(setter).toContain("pbpaste");
    expect(setter).toContain("readFileSync(0");
    expect(setter).not.toMatch(/process\.argv\[3\]/);
  });

  it("refuses live keys and only writes known variable names", () => {
    expect(setter).toMatch(/\^\(sk\|rk\)_live_/);
    expect(setter).toContain("ALLOWED");
    expect(setter).toContain("Refusing: that is a LIVE Stripe key");
  });

  it("prints only a masked confirmation", () => {
    expect(setter).toContain("const masked");
    expect(setter).not.toMatch(/console\.log\(\s*value\s*\)/);
  });
});
