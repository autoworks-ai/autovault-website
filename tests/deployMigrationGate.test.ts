import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

function readWorkflow(path: string) {
  return parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf-8"));
}

// yaml.parse turns the bare `on:` key into boolean `true` unless it's quoted,
// since `on` is YAML 1.1 shorthand for `true`. Both workflow files spell it
// unquoted, so look the jobs/steps up directly rather than via `.on`.

describe("D1 migrations only apply against production", () => {
  it("ci.yml's deploy-production job is gated to pushes on main", () => {
    const workflow = readWorkflow(".github/workflows/ci.yml");
    const job = workflow.jobs["deploy-production"];
    const migrateStep = job.steps.find((step: any) => step.name === "Apply pending D1 migrations");

    expect(migrateStep).toBeTruthy();
    expect(migrateStep.run).toContain("migrate:remote");
    // The job itself only runs on `push` to `refs/heads/main` -- deploy.yml
    // (a workflow_dispatch with an arbitrary branch input) needs its own gate
    // instead, checked below.
    expect(String(job.if)).toContain("refs/heads/main");
  });

  it("deploy.yml's migration step is gated to the main branch, not just any dispatched branch", () => {
    const workflow = readWorkflow(".github/workflows/deploy.yml");
    const job = workflow.jobs.deploy;
    const migrateStep = job.steps.find((step: any) => step.name === "Apply pending D1 migrations");

    expect(migrateStep).toBeTruthy();
    expect(migrateStep.run).toContain("migrate:remote");
    // This dispatcher accepts an arbitrary `branch` input and never swaps
    // wrangler.toml to a preview D1 binding -- without this gate, a manual
    // deploy of a feature branch would apply that branch's migration to the
    // production database while only previewing its code.
    expect(migrateStep.if).toBe("env.DEPLOY_BRANCH == 'main'");
  });

  it("ci.yml's deploy-preview job migrates the preview D1 database before deploying", () => {
    const workflow = readWorkflow(".github/workflows/ci.yml");
    const job = workflow.jobs["deploy-preview"];
    const stepNames = job.steps.map((step: any) => step.name);
    const configIndex = stepNames.indexOf("Write preview Pages config");
    const migrateIndex = stepNames.indexOf("Migrate preview D1 database");
    const deployIndex = stepNames.indexOf("Deploy preview to Cloudflare Pages");
    const migrateStep = job.steps[migrateIndex];

    // Order matters: wrangler.json must name the preview D1 binding (written
    // by the config step) before `wrangler d1 migrations apply` can target it,
    // and the schema must exist before Functions that depend on it deploy.
    expect(configIndex).toBeGreaterThan(-1);
    expect(migrateIndex).toBeGreaterThan(configIndex);
    expect(deployIndex).toBeGreaterThan(migrateIndex);

    expect(migrateStep.run).toContain("wrangler d1 migrations apply");
    expect(migrateStep.run).toContain("--remote");
    // Only runs when the preview bindings are actually configured -- same
    // guard as every other step in this job that touches the preview D1/KV.
    expect(migrateStep.if).toBe(
      "${{ env.CLOUDFLARE_PREVIEW_D1_DATABASE_ID != '' && env.CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID != '' }}"
    );
  });
});
