import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

function readWorkflow(path: string) {
  return parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf-8"));
}

// `on` is YAML 1.1 shorthand for boolean true, but the `yaml` package defaults
// to YAML 1.2 core schema, where it stays the string key "on". Assert that here
// rather than in each test -- a schema change would otherwise turn every
// trigger assertion below into a silent pass against `undefined`.
function readTriggers(path: string) {
  const triggers = readWorkflow(path).on;
  expect(triggers, `${path} has no parsed trigger map`).toBeTruthy();
  return triggers;
}

// A `branches:` filter on a `pull_request` trigger matches the PR's BASE
// branch. With `branches: [main]`, a stacked PR -- one based on another feature
// branch -- fired no workflow event at all, so it displayed an all-green checks
// list while never having been built, tested, scanned or previewed.
describe("pull_request triggers cover stacked PRs", () => {
  for (const path of [".github/workflows/ci.yml", ".github/workflows/security.yml"]) {
    it(`${path} runs on pull requests against any base branch`, () => {
      const triggers = readTriggers(path);

      // `pull_request:` with no value parses to null, so check key presence
      // separately -- otherwise deleting the trigger outright would pass.
      expect(Object.keys(triggers)).toContain("pull_request");
      expect(triggers.pull_request?.branches).toBeUndefined();
    });
  }

  it("pr-title.yml lints every PR title, not just PRs based on main", () => {
    const workflow = readWorkflow(".github/workflows/pr-title.yml");

    // `pull_request_target` takes no branches filter, so the job-level `if` was
    // the only thing skipping stacked PRs.
    expect(Object.keys(readTriggers(".github/workflows/pr-title.yml"))).toContain(
      "pull_request_target"
    );
    expect(workflow.jobs["conventional-pr-title"].if).toBeUndefined();
  });

  it("ci.yml still restricts production deploys to pushes on main", () => {
    // This is what makes dropping the base-branch filter safe: build-test and
    // deploy-preview now run for every PR, but the only job that touches the
    // production Pages project and the production D1 database is unreachable
    // from a `pull_request` event.
    const condition = String(readWorkflow(".github/workflows/ci.yml").jobs["deploy-production"].if);

    expect(condition).toContain("github.event_name == 'push'");
    expect(condition).toContain("refs/heads/main");
  });
});

// Branch protection on `main` requires these checks by name. GitHub matches
// them as opaque strings: a required context that never reports does not fail,
// it simply never arrives, and the pull request waits.
//
// The list is duplicated from a GitHub setting, which is the weak part of this
// — there is no API the test suite can read at build time. It is still worth
// pinning, because both ways it drifts are silent, and both were hit in one
// night: renaming a job orphans the requirement, and enabling a merge queue (a
// settings toggle, no code change) makes every workflow without a `merge_group`
// trigger unable to report at all.
const REQUIRED_CHECKS = [
  { context: "build-test", workflow: ".github/workflows/ci.yml", job: "build-test" },
  {
    context: "Dependency Audit (production)",
    workflow: ".github/workflows/security.yml",
    job: "audit-prod"
  }
] as const;

describe("workflows can satisfy the checks main requires of them", () => {
  for (const { context, workflow, job } of REQUIRED_CHECKS) {
    it(`${workflow} still reports "${context}"`, () => {
      // The reported context is the job's `name` when it has one and the job
      // key otherwise. Renaming either detaches the job from the requirement,
      // and the PR then waits on a check nothing produces.
      const definition = readWorkflow(workflow).jobs?.[job];
      expect(definition, `${workflow} has no job "${job}"`).toBeTruthy();
      expect(definition.name ?? job).toBe(context);
    });

    it(`${workflow} runs on merge_group, so a queue cannot wedge on it`, () => {
      // Observed 2026-08-23: security.yml had no merge_group trigger while
      // "Dependency Audit (production)" was required, so a queue branch only
      // ever carried ci.yml's checks. The queue sat in AWAITING_CHECKS waiting
      // for a check that could not run, and would have done so for the whole
      // 3600-minute checkResponseTimeout.
      //
      // Asserted even though the queue is disabled again: re-enabling it is a
      // settings toggle, and this is what makes that toggle safe.
      expect(Object.keys(readTriggers(workflow))).toContain("merge_group");
    });
  }
});
