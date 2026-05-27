import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(repoRoot, ".github/workflows/dependabot-auto-merge.yml");

describe("Dependabot auto-merge workflow", () => {
  it("resets stale auto-merge before enqueueing clean merge-queue PRs", () => {
    const workflow = YAML.parse(readFileSync(workflowPath, "utf8"));
    const script = workflow.jobs.dependabot.steps.find((step: { name?: string }) => (
      step.name === "Enable auto-merge for non-major updates"
    )).run as string;

    expect(script).toContain("mergeStateStatus autoMergeRequest");
    expect(script).toContain('merge_state="$(jq -r \'.mergeStateStatus\' <<<"$pr_state")"');
    expect(script).toContain('auto_merge_enabled="$(jq -r \'.autoMergeRequest != null\' <<<"$pr_state")"');
    expect(script).toContain('if [ "$merge_state" != "CLEAN" ]; then');
    expect(script).toContain('gh pr merge --auto --match-head-commit "$HEAD_SHA" "$PR_URL"');
    expect(script).toContain('gh pr merge --disable-auto "$PR_URL"');
    expect(script).toContain('gh pr merge --match-head-commit "$HEAD_SHA" "$PR_URL"');
  });
});
