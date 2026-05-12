export type ComparisonMark = "yes" | "partial" | "no";

export interface ComparisonPlayer {
  key: "av" | "sf" | "ts" | "sk" | "mn";
  name: string;
  href?: string;
  sourceLabel?: string;
  us?: boolean;
}

export const homepageGateMetrics = {
  reject: {
    value: "~1 in 9",
    label: "held in the demo fixture"
  },
  latency: {
    value: "<1s",
    label: "local validation fixture"
  },
  render: {
    value: "4ms",
    label: "render per caller"
  }
};

export const comparisonPlayers: ComparisonPlayer[] = [
  { key: "av", name: "AutoVault", us: true },
  { key: "sf", name: "Skillfish", href: "https://www.skill.fish/", sourceLabel: "Skill.Fish" },
  { key: "ts", name: "Tessl", href: "https://docs.tessl.io/create/creating-skills", sourceLabel: "Tessl docs" },
  { key: "sk", name: "SkillKit / Agent Skills", href: "https://skillkit.io/", sourceLabel: "SkillKit" },
  { key: "mn", name: "Manual" }
];

export const comparisonSources = [
  { label: "Skill.Fish", href: "https://www.skill.fish/" },
  { label: "Tessl docs", href: "https://docs.tessl.io/create/creating-skills" },
  { label: "Agent Skills GitHub", href: "https://github.com/agentskills" },
  { label: "SkillKit", href: "https://skillkit.io/" },
  { label: "SkillClone", href: "https://arxiv.org/abs/2603.22447" },
  { label: "ClawHub docs", href: "https://clawdhub.mintlify.app/tools/clawhub" },
  { label: "Cloudflare obfuscation docs", href: "https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/" }
];

export const homepageComparisonRows: [string, ComparisonMark, ComparisonMark, ComparisonMark, ComparisonMark, ComparisonMark][] = [
  ["Local admission gate", "yes", "partial", "partial", "no", "no"],
  ["Signed local provenance", "yes", "no", "no", "no", "no"],
  ["Per-caller rendered output", "yes", "partial", "partial", "partial", "no"],
  ["Project/agent/device scoping", "yes", "partial", "no", "no", "no"],
  ["Broad public discovery", "partial", "yes", "yes", "yes", "no"],
  ["Broad agent/runtime coverage", "partial", "yes", "partial", "yes", "partial"],
  ["Mature team/package workflow", "partial", "yes", "yes", "partial", "no"],
  ["Local-first, no required cloud", "yes", "yes", "partial", "partial", "yes"]
];
