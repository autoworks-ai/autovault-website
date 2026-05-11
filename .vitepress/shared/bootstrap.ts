export const AUTOVAULT_BOOTSTRAP_SKILL_URL = "https://autovault.dev/skill.md";

export const AUTOVAULT_BOOTSTRAP_INSTALL_PATH = "~/.claude/skills/autovault-bootstrap/SKILL.md";

export const AUTOVAULT_AGENT_SETUP_PROMPT =
  `Fetch ${AUTOVAULT_BOOTSTRAP_SKILL_URL}, show me what it will do, install it into ${AUTOVAULT_BOOTSTRAP_INSTALL_PATH} if approved, then run /autovault-bootstrap.`;

export const AUTOVAULT_INSTALL_COMMAND = "curl -fsSL https://autovault.sh | sh";
