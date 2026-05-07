import { describe, expect, it } from "vitest";
import { getTerminalLineDelay, type TerminalReplayLine } from "../.vitepress/theme/composables/useTerminalReplay";

describe("terminal replay helpers", () => {
  it("matches the prototype timing by terminal line type", () => {
    const cases: Array<[TerminalReplayLine, number]> = [
      [{ type: "cmd", text: "autovault add" }, 700],
      [{ type: "ok", text: "signed" }, 250],
      [{ type: "out", text: "fetching" }, 130],
      [{ type: "err", text: "rejected" }, 130],
      [{ type: "blank" }, 130]
    ];

    for (const [line, delay] of cases) {
      expect(getTerminalLineDelay(line)).toBe(delay);
    }
  });
});
