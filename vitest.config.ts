import { configDefaults, defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "node",
    globals: true,
    // Git worktrees live under .claude/worktrees/, and each one is a full
    // checkout with its own tests/ directory. Vitest's default include is
    // repo-wide and its default excludes do not cover them, so every worktree
    // left on disk silently multiplies the suite: with two stale ones present
    // this ran 75 files / 626 tests instead of 30 / 302, the same assertions
    // three times over, against two other branches' code.
    //
    // That is worse than slow. A stale worktree can fail on code that is not
    // in this checkout, or pass and disguise how much was actually run.
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"]
  }
});
