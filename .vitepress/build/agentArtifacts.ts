import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAgentsIndex, buildLlmsFullTxt, buildLlmsTxt, pageDocs } from "../shared/pageDocs";

export async function writeAgentArtifacts(outDir: string): Promise<void> {
  const agentsDir = path.join(outDir, "agents");
  await mkdir(agentsDir, { recursive: true });

  await Promise.all([
    ...pageDocs.map(async (doc) => {
      const destination = path.join(outDir, doc.agentPath.replace(/^\//, ""));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, `${doc.markdown}\n`, "utf8");
    }),
    writeFile(path.join(agentsDir, "index.json"), `${JSON.stringify(buildAgentsIndex(), null, 2)}\n`, "utf8"),
    writeFile(path.join(outDir, "llms.txt"), buildLlmsTxt(), "utf8"),
    writeFile(path.join(outDir, "llms-full.txt"), buildLlmsFullTxt(), "utf8")
  ]);
}
