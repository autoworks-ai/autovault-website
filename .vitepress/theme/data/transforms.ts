export const transforms = {
  "claude-code": {
    color: "#d6a85a",
    rows: [
      { from: "browser.fill_form", to: "chrome-devtools" },
      { from: "browser.click", to: "chrome-devtools" },
      { from: "fs.read", to: "read" },
      { from: "fs.write", to: "write" }
    ]
  },
  codex: {
    color: "#5a9dd6",
    rows: [
      { from: "browser.fill_form", to: "browser_form" },
      { from: "browser.click", to: "browser_click" },
      { from: "fs.read", to: "file_read" },
      { from: "fs.write", to: "file_write" }
    ]
  },
  cursor: {
    color: "#b48ad6",
    rows: [
      { from: "browser.fill_form", to: "playwright_fill_form" },
      { from: "browser.click", to: "playwright_click" },
      { from: "fs.read", to: "fs_read" },
      { from: "fs.write", to: "fs_write" }
    ]
  }
};

export type TransformTarget = keyof typeof transforms;
