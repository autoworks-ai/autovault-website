import { writeFileSync } from "node:fs";

const previewDatabaseId = process.env.CLOUDFLARE_PREVIEW_D1_DATABASE_ID;
const previewKvNamespaceId = process.env.CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID;

if (!previewDatabaseId || !previewKvNamespaceId) {
  throw new Error(
    "CLOUDFLARE_PREVIEW_D1_DATABASE_ID and CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID are required."
  );
}

const config = {
  $schema: "./node_modules/wrangler/config-schema.json",
  name: "autovault-website",
  pages_build_output_dir: ".vitepress/dist",
  compatibility_date: "2026-05-06",
  vars: {
    AUTOVAULT_ENVIRONMENT: "preview",
    AUTOVAULT_INSTALLER_URL:
      "https://raw.githubusercontent.com/autoworks-ai/autovault/main/scripts/install.sh",
    STRIPE_BRAND_DISPLAY_NAME: "AutoVault",
    STRIPE_BRAND_BACKGROUND_COLOR: "#0b1014",
    STRIPE_BRAND_BUTTON_COLOR: "#5ad6c0",
    STRIPE_BRAND_BORDER_STYLE: "rounded",
    STRIPE_BRAND_FONT_FAMILY: "inter"
  },
  d1_databases: [
    {
      binding: "AUTOVAULT_DB",
      database_name: process.env.CLOUDFLARE_PREVIEW_D1_DATABASE_NAME || "autovault-hosted-preview",
      database_id: previewDatabaseId
    }
  ],
  kv_namespaces: [
    {
      binding: "AUTOVAULT_VAULT_OBJECTS",
      id: previewKvNamespaceId
    }
  ]
};

writeFileSync("wrangler.json", `${JSON.stringify(config, null, 2)}\n`);
