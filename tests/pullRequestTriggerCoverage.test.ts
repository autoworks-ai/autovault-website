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

// Probe commit: verifies CI fires for a PR based on a feature branch.
