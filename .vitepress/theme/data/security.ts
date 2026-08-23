// Mirrored verbatim from the AutoVault CLI's denylist at
// `scripts/security/patterns.json` (schema version 2). These were previously
// invented rows — fabricated CVE ids, fabricated researcher handles and
// fabricated "age" values — rendered under a heading that invites the reader
// to mirror and audit them. Keep this in sync with the source of truth; the
// v1Content test asserts the count matches what the page claims.
export const DENYLIST_SCHEMA_VERSION = 2;

export const denyRows = [
  { id: "ssh-read", pat: "cat\\s+~\\/\\.ssh\\/", reason: "Reads SSH private material" },
  { id: "aws-read", pat: "cat\\s+~\\/\\.aws\\/(credentials|config)", reason: "Reads AWS credentials" },
  { id: "curl-upload", pat: "curl\\s+.*(-d|--data|-F|--form)\\s+\\S*@", reason: "Potential file exfiltration via curl upload" },
  { id: "obfuscated-shell-base64", pat: "base64\\s+-d\\s+\\|\\s*(sh|bash|zsh)", reason: "Obfuscated command execution via base64 decode" },
  { id: "obfuscated-shell-hex", pat: "xxd\\s+-r\\s+-p\\s*\\|\\s*(sh|bash|zsh)", reason: "Obfuscated command execution via hex decode" },
  { id: "no-verify", pat: "--no-verify", reason: "Bypasses verification checks" },
  { id: "rm-rf-root", pat: "rm\\s+-rf\\s+(/|~|\\$HOME)(/|\\s|$)?", reason: "Destructive recursive delete of home or root" },
  { id: "curl-pipe-shell", pat: "curl\\s+[^|]*\\|\\s*(sh|bash|zsh)", reason: "Pipes remote content directly into a shell" },
  { id: "wget-pipe-shell", pat: "wget\\s+[^|]*-O-\\s*\\|\\s*(sh|bash|zsh)", reason: "Pipes remote content directly into a shell via wget" },
  { id: "eval-untrusted-var", pat: "\\beval\\s+\"?\\$[A-Za-z_][A-Za-z0-9_]*\"?", reason: "Evaluates a shell variable without sanitization" },
  { id: "setuid-setgid", pat: "chmod\\s+[0-9]*[ug]\\+s\\b", reason: "Grants setuid/setgid which can escalate privileges" },
  { id: "disable-ssl-verify", pat: "\\b(curl|wget)\\b[^|\\n]*?\\s(-k|--insecure|--no-check-certificate)\\b", reason: "Disables SSL verification" }
];

export const gateStages = [
  { title: "YAML auto-repair", desc: "Frontmatter is the main source of breakage. We fix it before storage.", status: "fix" },
  { title: "Security denylist", desc: "Known-bad patterns: credential reads, fork bombs, exfiltration.", status: "scan" },
  { title: "Capability vs. behavior", desc: "Does the skill actually do what its frontmatter claims?", status: "verify" },
  { title: "Dedup", desc: "Text similarity in V1, embedding-space matching in V2.", status: "match" },
  { title: "Ed25519 sign", desc: "Provenance becomes a first-class artifact, not a hope.", status: "sign" }
];
