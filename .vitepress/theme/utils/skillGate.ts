import { parseDocument } from "yaml";

export type GateCheckKind = "ok" | "warn" | "fail" | "pending";

export type GateCheck = {
  name: string;
  detail: string;
  kind: GateCheckKind;
};

export type GateIssueSeverity = "warn" | "fail";

export type GateIssue = {
  check: string;
  severity: GateIssueSeverity;
  message: string;
  lineStart: number;
  lineEnd: number;
};

export type ParsedSkill = {
  name: string;
  version: string;
  description: string;
  tools: string[];
  transforms: string[];
  body: string;
  sourceLabel: string;
  byteSize: number;
};

export type GateEvaluation = {
  checks: GateCheck[];
  issues: GateIssue[];
  passed: boolean;
  warningCount: number;
  failCount: number;
  skill: ParsedSkill | null;
  signature: string | null;
  installLines: string[];
};

type FrontmatterResult =
  | { ok: true; frontmatter: string; body: string; normalized: string; lines: string[]; closingLine: number }
  | { ok: false; reason: string; normalized: string; lines: string[]; lineStart: number; lineEnd: number };

const REQUIRED_FIELDS = ["name", "version", "description", "tools_required"];

const DENYLIST_PATTERNS = [
  { label: "shell pipe install", pattern: /curl\s+[^|\n]+\|\s*(?:sh|bash)/i },
  { label: "destructive root delete", pattern: /rm\s+-rf\s+\/(?:\s|$)/i },
  { label: "dynamic JavaScript eval", pattern: /\beval\s*\(/i },
  { label: "Node child process", pattern: /\bchild_process\b/i },
  { label: "inline script tag", pattern: /<script[\s>]/i },
  { label: "secret environment access", pattern: /\b(?:AWS_SECRET_ACCESS_KEY|OPENAI_API_KEY|process\.env)\b/i }
];

export function extractFrontmatter(source: string): FrontmatterResult {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trimEnd();
  const lines = normalized.split("\n");

  if (lines[0]?.trim() !== "---") {
    return { ok: false, reason: "missing opening --- delimiter", normalized, lines, lineStart: 1, lineEnd: 1 };
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex === -1) {
    return { ok: false, reason: "missing closing --- delimiter", normalized, lines, lineStart: lines.length, lineEnd: lines.length };
  }

  return {
    ok: true,
    frontmatter: lines.slice(1, closingIndex).join("\n"),
    body: lines.slice(closingIndex + 1).join("\n").trim(),
    normalized,
    lines,
    closingLine: closingIndex + 1
  };
}

export function normalizeSkillUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "github.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const blobIndex = parts.indexOf("blob");
      if (parts.length > 4 && blobIndex === 2) {
        const [owner, repo] = parts;
        const branch = parts[3];
        const path = parts.slice(4).join("/");
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function evaluateSkillDocument(source: string, sourceLabel = "pasted SKILL.md"): GateEvaluation {
  const extracted = extractFrontmatter(source);
  const checks: GateCheck[] = [];
  const issues: GateIssue[] = [];
  let metadata: Record<string, unknown> | null = null;
  let body = "";

  if (!extracted.ok) {
    checks.push({ name: "yaml-repair", detail: extracted.reason, kind: "fail" });
    checks.push({ name: "schema", detail: "frontmatter unavailable", kind: "fail" });
    issues.push(createIssue("yaml-repair", "fail", extracted.reason, extracted.lineStart, extracted.lineEnd));
    return finishEvaluation(checks, null, extracted.normalized, issues);
  }

  body = extracted.body;
  const document = parseDocument(extracted.frontmatter, { prettyErrors: false });
  const yamlErrors = [...document.errors, ...document.warnings];

  if (yamlErrors.length) {
    const detail = yamlErrors[0]?.message.replace(/\s+/g, " ") ?? "invalid YAML frontmatter";
    const line = yamlIssueLine(yamlErrors[0], 1);
    checks.push({
      name: "yaml-repair",
      detail,
      kind: "fail"
    });
    checks.push({ name: "schema", detail: "blocked by invalid YAML", kind: "fail" });
    issues.push(createIssue("yaml-repair", "fail", detail, line, line));
    return finishEvaluation(checks, null, extracted.normalized, issues);
  }

  const parsed = document.toJS({ mapAsMap: false });
  if (!isRecord(parsed)) {
    checks.push({ name: "yaml-repair", detail: "frontmatter is not a YAML mapping", kind: "fail" });
    checks.push({ name: "schema", detail: "expected key/value frontmatter", kind: "fail" });
    issues.push(createIssue("yaml-repair", "fail", "frontmatter is not a YAML mapping", 2, Math.max(2, extracted.closingLine - 1)));
    return finishEvaluation(checks, null, extracted.normalized, issues);
  }

  metadata = parsed;
  checks.push({ name: "yaml-repair", detail: "frontmatter clean · 0 fixes applied", kind: "ok" });

  const missing = REQUIRED_FIELDS.filter((field) => !(field in metadata!));
  const name = readString(metadata.name);
  const version = readString(metadata.version);
  const description = readString(metadata.description);
  const tools = readStringArray(metadata.tools_required);
  const transforms = readTransformTargets(metadata.transformations);
  const schemaProblems: string[] = [];

  missing.forEach((field) => {
    schemaProblems.push(`missing ${field}`);
    issues.push(createIssue("schema", "fail", `missing required frontmatter field: ${field}`, insertionLine(extracted), insertionLine(extracted)));
  });

  if (name && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
    schemaProblems.push("name must be kebab-case");
    const line = findYamlKeyLine(extracted.lines, "name", extracted.closingLine) ?? 2;
    issues.push(createIssue("schema", "fail", "name must be kebab-case", line, line));
  }

  if (version && !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    schemaProblems.push("version must be semver-like");
    const line = findYamlKeyLine(extracted.lines, "version", extracted.closingLine) ?? 2;
    issues.push(createIssue("schema", "fail", "version must be semver-like", line, line));
  }

  if (tools.length === 0) {
    const message = Array.isArray(metadata.tools_required) ? "tools_required must list at least one tool" : "tools_required must be a YAML list";
    schemaProblems.push(message);
    const line = findYamlKeyLine(extracted.lines, "tools_required", extracted.closingLine) ?? insertionLine(extracted);
    issues.push(createIssue("schema", "fail", message, line, line));
  }

  checks.push({
    name: "schema",
    detail: schemaProblems.length ? schemaProblems.slice(0, 2).join(" · ") : "name/version/tools valid",
    kind: schemaProblems.length ? "fail" : "ok"
  });

  const denied = DENYLIST_PATTERNS.filter((item) => item.pattern.test(extracted.normalized)).map((item) => {
    const line = findPatternLine(extracted.lines, item.pattern) ?? 1;
    issues.push(createIssue("denylist", "fail", `matched known-bad pattern: ${item.label}`, line, line));
    return item.label;
  });
  checks.push({
    name: "denylist",
    detail: denied.length ? denied.slice(0, 2).join(" · ") : "no known-bad patterns matched",
    kind: denied.length ? "fail" : "ok"
  });

  const unusedTools = tools.filter((tool) => !bodyMentionsCapability(body, tool));
  unusedTools.forEach((tool) => {
    const line = findListItemLine(extracted.lines, tool, extracted.closingLine) ?? findYamlKeyLine(extracted.lines, "tools_required", extracted.closingLine) ?? 2;
    issues.push(createIssue("capability/behavior", "warn", `${tool} is declared but not described in the skill body`, line, line));
  });
  checks.push({
    name: "capability/behavior",
    detail: unusedTools.length ? `${unusedTools.slice(0, 2).join(", ")} not observed in body` : "declared = observed",
    kind: unusedTools.length ? "warn" : "ok"
  });

  const capabilityResult = validateCapabilities(metadata.capabilities, extracted.lines, extracted.closingLine);
  checks.push(capabilityResult.check);
  issues.push(...capabilityResult.issues);
  checks.push({
    name: "transformation manifest",
    detail: transforms.length ? `${transforms.length} render target${transforms.length === 1 ? "" : "s"} mapped` : "canonical-only · no transform targets",
    kind: transforms.length ? "ok" : "warn"
  });

  const skill: ParsedSkill = {
    name: name || "unnamed-skill",
    version: version || "0.0.0",
    description: description || "No description",
    tools,
    transforms,
    body,
    sourceLabel,
    byteSize: new TextEncoder().encode(extracted.normalized).length
  };

  checks.push({ name: "dedup (text)", detail: `0 near matches · hash ${stableHash(extracted.normalized).slice(0, 8)}`, kind: "ok" });
  return finishEvaluation(checks, skill, extracted.normalized, issues);
}

function finishEvaluation(checks: GateCheck[], skill: ParsedSkill | null, source: string, issues: GateIssue[]): GateEvaluation {
  const failCount = checks.filter((check) => check.kind === "fail").length;
  const warningCount = checks.filter((check) => check.kind === "warn").length;
  const passed = failCount === 0;
  const signature = passed ? `0x${stableHash(`${source}:${skill?.name ?? "blocked"}`)}…${stableHash(`${skill?.version ?? "0"}:${source}`).slice(0, 4)}` : null;
  const installLines = buildInstallLines(skill, signature, warningCount, passed);

  return {
    checks: [
      ...checks,
      {
        name: "vault admission simulation",
        detail: passed ? "dry-run bundle prepared" : "blocked until failures are fixed",
        kind: passed ? (warningCount ? "warn" : "ok") : "fail"
      },
      {
        name: "ed25519 sign",
        detail: signature ?? "not signed",
        kind: passed ? "ok" : "fail"
      }
    ],
    issues: dedupeIssues(issues),
    passed,
    warningCount,
    failCount,
    skill,
    signature,
    installLines
  };
}

function buildInstallLines(skill: ParsedSkill | null, signature: string | null, warningCount: number, passed: boolean): string[] {
  if (!skill || !passed || !signature) {
    return [
      "browser gate preview",
      "↳ gate rejected bundle",
      "✕ vault admission blocked"
    ];
  }

  const size = skill.byteSize < 1024 ? `${skill.byteSize}b` : `${(skill.byteSize / 1024).toFixed(1)}kb`;
  const source = skill.sourceLabel.startsWith("http") ? `url:${skill.sourceLabel}` : "pasted-skill";
  const targets = skill.transforms.length ? skill.transforms.join(", ") : "canonical-only";

  return [
    `browser gate preview · ${source}`,
    `↳ fetched ${skill.name}@${skill.version} · ${size}`,
    `↳ gate passed · ${warningCount} warning${warningCount === 1 ? "" : "s"}`,
    `↳ signed ${signature}`,
    `↳ rendered views: ${targets}`,
    `✓ vault preview ready · ${skill.name} · ${skill.tools.length} tool${skill.tools.length === 1 ? "" : "s"}`
  ];
}

// Validates the `capabilities` block against the canonical AutoVault schema:
// network is a boolean, filesystem is the "readonly" | "readwrite" enum, and
// tools is a string[]. Earlier copies of this gate validated a richer
// `permissions: { network, egress, fs_scope }` shape that does not exist in
// autovault/src/validation/schema.ts — a SKILL.md the website said was clean
// could be admitted by the real vault with zero capability metadata. The
// rename keeps the docs and the runtime gate honest.
function validateCapabilities(
  value: unknown,
  lines: string[],
  closingLine: number
): { check: GateCheck; issues: GateIssue[] } {
  const issues: GateIssue[] = [];
  const capabilitiesLine = findYamlKeyLine(lines, "capabilities", closingLine) ?? insertionLine({ closingLine });

  if (value === undefined) {
    issues.push(
      createIssue("capabilities", "warn", "capabilities not declared; host will prompt broadly", capabilitiesLine, capabilitiesLine)
    );
    return {
      check: { name: "capabilities", detail: "not declared · host will prompt broadly", kind: "warn" },
      issues
    };
  }

  if (!isRecord(value)) {
    issues.push(createIssue("capabilities", "fail", "capabilities must be a mapping", capabilitiesLine, capabilitiesLine));
    return { check: { name: "capabilities", detail: "capabilities must be a mapping", kind: "fail" }, issues };
  }

  if ("network" in value && typeof value.network !== "boolean") {
    const line = findNestedYamlKeyLine(lines, "capabilities", "network", closingLine) ?? capabilitiesLine;
    issues.push(createIssue("capabilities", "fail", "network must be true or false", line, line));
    return { check: { name: "capabilities", detail: "network must be true or false", kind: "fail" }, issues };
  }

  if ("filesystem" in value && value.filesystem !== "readonly" && value.filesystem !== "readwrite") {
    const line = findNestedYamlKeyLine(lines, "capabilities", "filesystem", closingLine) ?? capabilitiesLine;
    issues.push(
      createIssue("capabilities", "fail", 'filesystem must be "readonly" or "readwrite"', line, line)
    );
    return {
      check: { name: "capabilities", detail: 'filesystem must be "readonly" or "readwrite"', kind: "fail" },
      issues
    };
  }

  if ("tools" in value && !Array.isArray(value.tools)) {
    const line = findNestedYamlKeyLine(lines, "capabilities", "tools", closingLine) ?? capabilitiesLine;
    issues.push(createIssue("capabilities", "fail", "tools must be a YAML list", line, line));
    return { check: { name: "capabilities", detail: "tools must be a YAML list", kind: "fail" }, issues };
  }

  return { check: { name: "capabilities", detail: "boundaries declared", kind: "ok" }, issues };
}

function bodyMentionsCapability(body: string, tool: string): boolean {
  const haystack = body.toLowerCase();
  const [namespace, action = ""] = tool.toLowerCase().split(".");
  const aliases: Record<string, string[]> = {
    http: ["http", "fetch", "api", "request", "url", "weather"],
    browser: ["browser", "page", "click", "form", "fill", "navigate", "dom"],
    fs: ["file", "path", "read", "write", "pdf", "csv", "directory"],
    shell: ["shell", "command", "terminal", "process", "script"]
  };
  return [tool.toLowerCase(), namespace, action, ...(aliases[namespace] ?? [])].some((term) => term && haystack.includes(term));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function readTransformTargets(value: unknown): string[] {
  return isRecord(value) ? Object.keys(value).filter((key) => isRecord(value[key])) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function createIssue(check: string, severity: GateIssueSeverity, message: string, lineStart: number, lineEnd = lineStart): GateIssue {
  return {
    check,
    severity,
    message,
    lineStart: Math.max(1, lineStart),
    lineEnd: Math.max(lineStart, lineEnd)
  };
}

function dedupeIssues(issues: GateIssue[]): GateIssue[] {
  const seen = new Set<string>();
  return issues
    .sort((a, b) => a.lineStart - b.lineStart || (a.severity === "fail" ? -1 : 1))
    .filter((issue) => {
      const key = `${issue.check}:${issue.severity}:${issue.message}:${issue.lineStart}:${issue.lineEnd}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function yamlIssueLine(error: unknown, sourceOffset: number): number {
  const linePos = (error as { linePos?: Array<{ line?: number }> } | undefined)?.linePos;
  const line = linePos?.[0]?.line;
  return typeof line === "number" ? Math.max(1, line + sourceOffset) : 2;
}

function insertionLine(extracted: { closingLine: number }): number {
  return Math.max(2, extracted.closingLine - 1);
}

function findYamlKeyLine(lines: string[], key: string, closingLine: number): number | null {
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`);
  for (let lineNumber = 2; lineNumber < closingLine; lineNumber += 1) {
    if (pattern.test(lines[lineNumber - 1] ?? "")) return lineNumber;
  }
  return null;
}

function findNestedYamlKeyLine(lines: string[], parent: string, child: string, closingLine: number): number | null {
  const parentLine = findYamlKeyLine(lines, parent, closingLine);
  if (!parentLine) return null;

  const childPattern = new RegExp(`^\\s+${escapeRegExp(child)}\\s*:`);
  for (let lineNumber = parentLine + 1; lineNumber < closingLine; lineNumber += 1) {
    const line = lines[lineNumber - 1] ?? "";
    if (/^\S/.test(line)) break;
    if (childPattern.test(line)) return lineNumber;
  }
  return null;
}

function findListItemLine(lines: string[], value: string, closingLine: number): number | null {
  for (let lineNumber = 2; lineNumber < closingLine; lineNumber += 1) {
    if ((lines[lineNumber - 1] ?? "").trim() === `- ${value}`) return lineNumber;
  }
  return null;
}

function findPatternLine(lines: string[], pattern: RegExp): number | null {
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) return index + 1;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
