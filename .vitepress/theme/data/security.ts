export const denyRows = [
  { sev: "crit", id: "CVE-2026-0142", pat: "/eval\\(.*atob\\(.*\\)/", src: "internal-research", age: "2d" },
  { sev: "crit", id: "AV-2026-007", pat: "/curl.*\\|.*sh.*&/", src: "@elvissun", age: "5d" },
  { sev: "high", id: "AV-2026-006", pat: "/process\\.env\\.\\*/", src: "internal-research", age: "1w" },
  { sev: "high", id: "CVE-2026-0098", pat: "/data:.*;base64,.*upload/", src: "nvd", age: "2w" },
  { sev: "med", id: "AV-2026-005", pat: "/fork\\(\\)\\s*{/", src: "@sky-w", age: "3w" },
  { sev: "high", id: "AV-2026-004", pat: "/aws_secret.*=/", src: "internal-research", age: "1mo" },
  { sev: "med", id: "AV-2026-003", pat: "/\\.bash_history.*read/", src: "@iris-d", age: "1mo" },
  { sev: "crit", id: "CVE-2025-9923", pat: "/keylog.*xinput/", src: "nvd", age: "2mo" }
];

export const gateStages = [
  { title: "YAML auto-repair", desc: "Frontmatter is the main source of breakage. We fix it before storage.", status: "fix" },
  { title: "Security denylist", desc: "Known-bad patterns: credential reads, fork bombs, exfiltration.", status: "scan" },
  { title: "Capability vs. behavior", desc: "Does the skill actually do what its frontmatter claims?", status: "verify" },
  { title: "Dedup", desc: "Text similarity in V1, embedding-space matching in V2.", status: "match" },
  { title: "Ed25519 sign", desc: "Provenance becomes a first-class artifact, not a hope.", status: "sign" }
];
