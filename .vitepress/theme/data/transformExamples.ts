// Mirrors `TransformCapabilityOverrides` from autovault/src/transforms/index.ts.
// Keep `apply` aligned with `applyCapabilityOverrides` semantics: priority-sorted,
// `targets.agents = []` matches every agent, otherwise only the listed ones.

export type CapabilityFilesystem = "readonly" | "readwrite";

export type DeclaredCapabilities = {
  network: boolean;
  filesystem: CapabilityFilesystem;
  tools: string[];
};

export type CapabilityOverrides = {
  network?: boolean;
  filesystem?: CapabilityFilesystem;
  tools?: {
    add: string[];
    remove: string[];
  };
};

export type TransformExample = {
  id: string;
  name: string;
  description: string;
  priority: number;
  targets: { agents: string[] };
  capability_overrides: CapabilityOverrides;
};

export type AgentChoice = "claude-code" | "codex" | "cursor";

export const baseSkill = {
  name: "extract-pdf",
  description: "Extract structured text from PDF files.",
  capabilities: {
    network: false,
    filesystem: "readwrite",
    tools: ["fs.read", "fs.write"]
  } satisfies DeclaredCapabilities
};

export const transformExamples: TransformExample[] = [
  {
    id: "claude-code-defaults",
    name: "claude-code-defaults",
    description: "Rename canonical fs tools to Claude Code's native names.",
    priority: 10,
    targets: { agents: ["claude-code"] },
    capability_overrides: {
      tools: {
        add: ["read", "write"],
        remove: ["fs.read", "fs.write"]
      }
    }
  },
  {
    id: "codex-defaults",
    name: "codex-defaults",
    description: "Rename canonical fs tools to Codex's native names.",
    priority: 10,
    targets: { agents: ["codex"] },
    capability_overrides: {
      tools: {
        add: ["file_read", "file_write"],
        remove: ["fs.read", "fs.write"]
      }
    }
  },
  {
    id: "network-egress-allow",
    name: "network-egress-allow",
    description: "Open the network and add an HTTP fetch tool for every agent.",
    priority: 20,
    targets: { agents: [] },
    capability_overrides: {
      network: true,
      tools: {
        add: ["http.fetch"],
        remove: []
      }
    }
  },
  {
    id: "readonly-clamp",
    name: "readonly-clamp",
    description: "Clamp Codex to read-only filesystem and strip write tools.",
    priority: 100,
    targets: { agents: ["codex"] },
    capability_overrides: {
      filesystem: "readonly",
      tools: {
        add: [],
        remove: ["fs.write", "file_write", "write"]
      }
    }
  }
];

function transformMatchesAgent(transform: TransformExample, agent: AgentChoice): boolean {
  return transform.targets.agents.length === 0 || transform.targets.agents.includes(agent);
}

function sortTransforms(transforms: TransformExample[]): TransformExample[] {
  return [...transforms].sort((a, b) => {
    const priority = a.priority - b.priority;
    if (priority !== 0) return priority;
    return a.name.localeCompare(b.name);
  });
}

export type AppliedTransform = {
  transform: TransformExample;
  matched: boolean;
  reason: "agent-not-targeted" | "applied" | "disabled";
};

export type StackResult = {
  rendered: DeclaredCapabilities;
  applied: AppliedTransform[];
};

export function stackTransforms(
  base: DeclaredCapabilities,
  agent: AgentChoice,
  enabled: Set<string>,
  transforms: TransformExample[] = transformExamples
): StackResult {
  const sorted = sortTransforms(transforms);
  const rendered: DeclaredCapabilities = {
    network: base.network,
    filesystem: base.filesystem,
    tools: [...base.tools]
  };
  const applied: AppliedTransform[] = [];

  for (const transform of sorted) {
    if (!enabled.has(transform.id)) {
      applied.push({ transform, matched: false, reason: "disabled" });
      continue;
    }
    if (!transformMatchesAgent(transform, agent)) {
      applied.push({ transform, matched: false, reason: "agent-not-targeted" });
      continue;
    }
    const override = transform.capability_overrides;
    if (override.network !== undefined) rendered.network = override.network;
    if (override.filesystem !== undefined) rendered.filesystem = override.filesystem;
    if (override.tools) {
      const remove = new Set(override.tools.remove.map((tool) => tool.toLowerCase()));
      rendered.tools = rendered.tools.filter((tool) => !remove.has(tool.toLowerCase()));
      for (const tool of override.tools.add) {
        if (!rendered.tools.some((existing) => existing.toLowerCase() === tool.toLowerCase())) {
          rendered.tools.push(tool);
        }
      }
    }
    applied.push({ transform, matched: true, reason: "applied" });
  }

  return { rendered, applied };
}

export function formatCapabilitiesYaml(caps: DeclaredCapabilities): string {
  const lines = [
    "capabilities:",
    `  network: ${caps.network}`,
    `  filesystem: ${caps.filesystem}`,
    "  tools:"
  ];
  if (caps.tools.length === 0) {
    lines[lines.length - 1] = "  tools: []";
  } else {
    for (const tool of caps.tools) {
      lines.push(`    - ${tool}`);
    }
  }
  return lines.join("\n");
}

export const agentOptions: AgentChoice[] = ["claude-code", "codex", "cursor"];
