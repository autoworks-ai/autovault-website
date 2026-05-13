export type TopbarSearchResult = {
  title: string;
  section: string;
  href: string;
  terms: string;
};

export const searchResults: TopbarSearchResult[] = [
  { title: "Quick start", section: "Get started", href: "/quick-start", terms: "install local vault doctor first skill scope run vault anatomy add-local autovault_skill_install bootstrap setup wizard adoption augment backup in-place" },
  { title: "Vault anatomy", section: "Get started", href: "/quick-start#vault-anatomy", terms: "vault folder tree anatomy signatures rendered profiles audit access map" },
  { title: "Authoring skills", section: "Authoring", href: "/authoring", terms: "skill md schema tools_required transformations capabilities agents admission gate propose_skill get_skill add_skill update_skill delete_skill include_resources scoping secrets env ssh keychain" },
  { title: "SKILL.md schema", section: "Authoring", href: "/authoring#schema", terms: "frontmatter fields schema tools_required transformations capabilities agents resources requires-secrets bin" },
  { title: "Secrets and .env", section: "Authoring", href: "/authoring#secrets", terms: "secrets env credentials credential vault keychain ssh agent 1password requires-secrets bin setup private keys api tokens" },
  { title: "Permissions model", section: "Permissions", href: "/permissions", terms: "permissions capabilities transforms install scope claude desktop project agents admission gate three layer model open skill md compat" },
  { title: "Capabilities", section: "Permissions", href: "/permissions#capabilities", terms: "capabilities network filesystem readonly readwrite tools declared author signal" },
  { title: "Transforms", section: "Permissions", href: "/permissions#transforms", terms: "transforms transform.md priority targets agents add remove tools per agent rendered profile" },
  { title: "Install scope", section: "Permissions", href: "/permissions#install-scope", terms: "install scope agents project device profile link symlink claude codex sync-profiles host policy" },
  { title: "Verify a skill", section: "Authoring", href: "/authoring#playground", terms: "paste url playground browser gate diagnostics verify check skill" },
  { title: "Skill examples", section: "Reference", href: "/skills-directory", terms: "examples vault inventory filters agent category source refs mit license" },
  { title: "API reference", section: "Reference", href: "/api", terms: "cli library http mcp endpoint load render verify resolve add_skill update_skill delete_skill propose_skill get_skill check_updates setup audit-repo import-autohub skill list skill which environment variables AUTOVAULT_STORAGE_PATH AUTOVAULT_MODE" },
  { title: "Deploy remote vault", section: "Reference", href: "/deploy", terms: "deploy remote mcp oauth pkce railway docker fly endpoint" },
  { title: "Compare alternatives", section: "Reference", href: "/compare", terms: "comparison skillfish tessl skillkit manual folders alternatives signing provenance scoping transforms instead of forks workspace-local deltas skillclone admission-time dedup" },
  { title: "skill-author", section: "Examples", href: "/skill/skill-author", terms: "skill author detail permissions provenance source" },
  { title: "autoworks-ai", section: "Examples", href: "/author-autoworks-ai", terms: "source author profile certificate maintainers skills examples" },
  { title: "Security & provenance", section: "Reference", href: "/security", terms: "security signature signing provenance denylist gate verifier oauth remote mcp secrets credentials keychain ssh env" },
  { title: "Troubleshooting", section: "Reference", href: "/troubleshooting", terms: "troubleshooting faq setup wizard adoption augment backup in-place no tty no terminal sync-profiles ENOENT doctor repair signature mismatch skill which import didn't install agent shell tool" },
  { title: "About AutoVault", section: "Team", href: "/about", terms: "jack arturo autojack jason coleman flint zack katz daniel iser team credits" },
  { title: "Changelog", section: "Reference", href: "/changelog", terms: "release notes remote mcp oauth add-local transforms resource drift" }
];
