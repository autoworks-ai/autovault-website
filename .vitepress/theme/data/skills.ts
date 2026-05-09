export type AgentId = "cc" | "cx" | "cu" | "ah";
export type SkillCategory = "files" | "text" | "data" | "code" | "browser" | "integrations" | "infra";

export interface Skill {
  name: string;
  org: string;
  icon: string;
  category: SkillCategory;
  agents: AgentId[];
  desc: string;
  v: string;
  references: number;
  license: string;
  featured?: boolean;
}

export const agents = [
  { id: "cc" as const, label: "Claude Code", color: "#d6a85a" },
  { id: "cx" as const, label: "Codex", color: "#5a9dd6" },
  { id: "cu" as const, label: "Cursor", color: "#b48ad6" },
  { id: "ah" as const, label: "AutoHub", color: "#5ad6c0" }
];

export const categories = [
  { id: "files" as const, label: "Files" },
  { id: "text" as const, label: "Text" },
  { id: "data" as const, label: "Data" },
  { id: "code" as const, label: "Code" },
  { id: "browser" as const, label: "Browser" },
  { id: "integrations" as const, label: "Integrations" },
  { id: "infra" as const, label: "Infrastructure" }
];

export const orgs = [
  { id: "autoworks-ai", label: "autoworks-ai" },
  { id: "community/elvissun", label: "community/elvissun" },
  { id: "community/sky-w", label: "community/sky-w" },
  { id: "community/iris-d", label: "community/iris-d" }
];

export const skills: Skill[] = [
  { name: "extract-pdf", org: "autoworks-ai", icon: "PD", category: "files", agents: ["cc", "cx", "cu", "ah"], desc: "Extract structured text from PDF files. Preserves headings, lists, and table layout where possible.", v: "1.4.0", references: 18, license: "MIT", featured: true },
  { name: "summarize-doc", org: "autoworks-ai", icon: "SD", category: "text", agents: ["cc", "cx", "cu", "ah"], desc: "Recursive multi-pass summarization with configurable depth and target length.", v: "0.9.2", references: 15, license: "MIT", featured: true },
  { name: "github-issues", org: "autoworks-ai", icon: "GH", category: "integrations", agents: ["cc", "cx", "cu"], desc: "Read, search, and create GitHub issues. Scoped to repos you've authorized via gh-cli.", v: "2.1.0", references: 13, license: "MIT", featured: true },
  { name: "parse-csv", org: "autoworks-ai", icon: "CV", category: "files", agents: ["cc", "cx", "cu", "ah"], desc: "Parse CSV with type inference, quoted fields, and configurable dialects.", v: "1.0.4", references: 11, license: "MIT" },
  { name: "extract-table", org: "autoworks-ai", icon: "TB", category: "files", agents: ["cc", "cx"], desc: "Pull structured tables from HTML, PDF, and image sources into normalized rows.", v: "0.7.0", references: 9, license: "MIT" },
  { name: "ocr-image", org: "autoworks-ai", icon: "OC", category: "files", agents: ["cc", "cx", "cu", "ah"], desc: "OCR an image to text with bounding-box output. Wraps tesseract locally; never sends pixels off-device.", v: "1.2.1", references: 10, license: "MIT" },
  { name: "linear-tasks", org: "autoworks-ai", icon: "LN", category: "integrations", agents: ["cc", "cx"], desc: "Read and update Linear tasks scoped to a workspace.", v: "0.4.0", references: 6, license: "MIT" },
  { name: "slack-search", org: "autoworks-ai", icon: "SL", category: "integrations", agents: ["cc", "cx", "cu"], desc: "Search a Slack workspace and return formatted thread context.", v: "0.3.1", references: 6, license: "MIT" },
  { name: "git-blame", org: "autoworks-ai", icon: "GB", category: "code", agents: ["cc", "cx", "cu"], desc: "Annotate git blame across a repo with author plus commit summary.", v: "1.1.0", references: 8, license: "MIT" },
  { name: "diff-summarize", org: "autoworks-ai", icon: "DS", category: "code", agents: ["cc", "cx", "cu", "ah"], desc: "Walk a diff and produce a structured summary of intent and risk per hunk.", v: "0.6.0", references: 8, license: "MIT" },
  { name: "screenshot-page", org: "community/elvissun", icon: "SC", category: "browser", agents: ["cc", "cx", "cu"], desc: "Capture a screenshot of a rendered web page with viewport options.", v: "1.0.0", references: 7, license: "MIT" },
  { name: "fill-web-form", org: "community/elvissun", icon: "FF", category: "browser", agents: ["cc", "cx", "cu"], desc: "Interactive form-filling skill with validation prompts before submission.", v: "0.8.0", references: 7, license: "MIT" },
  { name: "regex-extract", org: "autoworks-ai", icon: "RX", category: "text", agents: ["cc", "cx", "cu", "ah"], desc: "Test, refine, and run regex against sample text with a tight feedback loop.", v: "1.5.0", references: 12, license: "MIT" },
  { name: "json-validate", org: "autoworks-ai", icon: "JV", category: "data", agents: ["cc", "cx", "cu", "ah"], desc: "Validate JSON against a schema, with structured error reporting.", v: "1.2.0", references: 10, license: "MIT" },
  { name: "yaml-validate", org: "autoworks-ai", icon: "YV", category: "data", agents: ["cc", "cx", "cu", "ah"], desc: "Validate YAML with auto-repair suggestions; same engine as the AutoVault gate.", v: "0.9.0", references: 10, license: "MIT" },
  { name: "summarize-pr", org: "community/sky-w", icon: "PR", category: "code", agents: ["cc", "cx"], desc: "Generate a PR description from the diff with structured sections: intent, risk, tests.", v: "0.5.2", references: 5, license: "MIT" },
  { name: "kubectl-helper", org: "community/iris-d", icon: "K8", category: "infra", agents: ["cc", "cx"], desc: "Wrap kubectl with safer defaults and explain-as-you-go output.", v: "0.3.0", references: 4, license: "MIT" },
  { name: "tf-plan-explain", org: "autoworks-ai", icon: "TF", category: "infra", agents: ["cc", "cx"], desc: "Read a terraform plan and produce a human-readable change summary with risk flags.", v: "0.4.0", references: 4, license: "MIT" }
];

export interface SkillFilters {
  query?: string;
  agents?: Iterable<AgentId>;
  categories?: Iterable<SkillCategory>;
  orgs?: Iterable<string>;
}

export type SkillSort = "references" | "recent" | "name";

export function filterSkills(input: Skill[], filters: SkillFilters): Skill[] {
  const query = (filters.query ?? "").trim().toLowerCase();
  const agentSet = new Set(filters.agents ?? []);
  const categorySet = new Set(filters.categories ?? []);
  const orgSet = new Set(filters.orgs ?? []);

  return input.filter((skill) => {
    const matchesQuery = !query || [skill.name, skill.org, skill.desc, skill.category].some((field) => field.toLowerCase().includes(query));
    const matchesAgents = agentSet.size === 0 || skill.agents.some((agent) => agentSet.has(agent));
    const matchesCategories = categorySet.size === 0 || categorySet.has(skill.category);
    const matchesOrgs = orgSet.size === 0 || orgSet.has(skill.org);
    return matchesQuery && matchesAgents && matchesCategories && matchesOrgs;
  });
}

export function sortSkills(input: Skill[], sort: SkillSort): Skill[] {
  const copy = [...input];
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "recent") return copy.sort((a, b) => b.v.localeCompare(a.v, undefined, { numeric: true }));
  return copy.sort((a, b) => b.references - a.references);
}
