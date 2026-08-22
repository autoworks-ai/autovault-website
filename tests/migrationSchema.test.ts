import { describe, expect, it } from "vitest";
import { createTestDb } from "./support/d1.js";

describe("migration schema", () => {
  it("keeps oauth_states present after the full migration chain", () => {
    // 0003 drops oauth_states in the same CI run that deploys the Functions
    // removing the legacy OAuth routes -- a same-run deploy failure after
    // that migration would otherwise leave the OLD Functions (still querying
    // the table) running against a schema where it no longer exists. 0004
    // recreates it as a forward migration (0003 itself is immutable once
    // committed) so the net effect of this release's migration chain is a
    // no-op for oauth_states -- it must still exist once every migration has
    // run, and only disappear in a later, separate release.
    const { db } = createTestDb();
    const row = db
      .prepare("select name from sqlite_master where type = 'table' and name = 'oauth_states'")
      .get();
    expect(row).toBeTruthy();
  });
});
