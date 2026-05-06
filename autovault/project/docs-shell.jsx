/* global React */
const { useState, useEffect } = React;

/* Shared icons */
window.Icon = {
  Check: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 8.5 6.5 12 13 4.5"/></svg>,
  X: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M4 4l8 8M12 4l-8 8"/></svg>,
  Arrow: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 8h10M9 4l4 4-4 4"/></svg>,
  ArrowL: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 8H3M7 4l-4 4 4 4"/></svg>,
  Github: (p) => <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" {...p}><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.7 7.7 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.07-1.87 3.74-3.65 3.94.29.25.54.74.54 1.5v2.22c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>,
  Search: (p) => <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="7" cy="7" r="4.5"/><path d="m13 13-2.5-2.5" strokeLinecap="round"/></svg>,
  Tip: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11v.01" strokeLinecap="round"/></svg>,
  Shield: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" {...p}><path d="M8 1.5 2.5 3.5v4c0 3 2.4 5.6 5.5 7 3.1-1.4 5.5-4 5.5-7v-4L8 1.5z"/></svg>,
  Lock: (p) => <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 1 1 6 0v2"/></svg>,
};

window.BrandMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="2.5" width="19" height="19" rx="2" stroke="var(--accent)" strokeWidth="1.4"/>
    <path d="M12 4v16" stroke="var(--accent)" strokeWidth="1.4"/>
    <path d="M7 12.5l2.2 2.2L13.5 9.5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

window.Topbar = ({ active }) => {
  const items = [
    ["Overview", "AutoVault.html"],
    ["How it works", "AutoVault.html#how"],
    ["Quick start", "quick-start.html"],
    ["Authoring", "authoring.html"],
    ["Skills", "skills-directory.html"],
    ["Security", "security.html"],
    ["Changelog", "changelog.html"],
  ];
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="AutoVault.html">
          <window.BrandMark/>
          <span className="brand-name"><span className="auto">Auto</span><span className="vault">Vault</span></span>
          <span className="tb-version">v0.4.1</span>
        </a>
        <nav className="nav">
          {items.map(([label, href]) => (
            <a key={label} href={href} className={active === label ? "active" : ""}>{label}</a>
          ))}
        </nav>
        <div className="search-bar">
          <window.Icon.Search/>
          <span>Search docs…</span>
          <span className="kbd">⌘K</span>
        </div>
        <div className="tb-right">
          <button className="icon-btn" title="GitHub"><window.Icon.Github/></button>
          <button className="pill-btn primary">Install <window.Icon.Arrow/></button>
        </div>
      </div>
    </div>
  );
};

window.Sidebar = ({ active }) => {
  const groups = [
    { title: "Get started", items: [
      ["Quick start", "quick-start.html", "5 min"],
      ["Installation", "quick-start.html#install", null],
      ["Your first skill", "quick-start.html#first", null],
    ]},
    { title: "Authoring", items: [
      ["Anatomy of a SKILL.md", "authoring.html", null],
      ["Transformation manifest", "authoring.html#manifest", null],
      ["Permissions", "authoring.html#perms", null],
      ["Publishing", "authoring.html#publish", null],
    ]},
    { title: "Reference", items: [
      ["Skills directory", "skills-directory.html", null],
      ["Security & provenance", "security.html", null],
      ["Changelog", "changelog.html", "v0.4.1"],
    ]},
    { title: "Concepts", items: [
      ["Validation gate", "AutoVault.html#concepts", null],
      ["Per-caller transform", "AutoVault.html#how", null],
      ["Four-axis scoping", "AutoVault.html", null],
    ]},
  ];
  return (
    <aside className="docs-sidebar">
      {groups.map(g => (
        <div className="group" key={g.title}>
          <div className="group-title">{g.title}</div>
          {g.items.map(([label, href, badge]) => (
            <a key={label} href={href} className={active === label ? "active" : ""}>
              {label}
              {badge && <span className="badge">{badge}</span>}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
};

window.TOC = ({ items }) => (
  <aside className="docs-toc">
    <div className="toc-title">On this page</div>
    {items.map(([label, id]) => (
      <a key={id} href={`#${id}`}>{label}</a>
    ))}
  </aside>
);

window.Code = ({ lang = "bash", file, children }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <div className="code-head">
        <span className="lang">{lang}</span>
        {file && <span style={{ color: "var(--ink-3)" }}>{file}</span>}
        <button className="copy" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
};

window.Callout = ({ kind = "tip", title, children }) => (
  <div className={"callout " + kind}>
    <span className="icn"><window.Icon.Tip/></span>
    <div>
      {title && <div style={{ color: "var(--ink)", fontWeight: 500, marginBottom: 4 }}>{title}</div>}
      {children}
    </div>
  </div>
);

window.Breadcrumbs = ({ trail }) => (
  <div className="breadcrumbs">
    {trail.map((t, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="sep">/</span>}
        {t.href ? <a href={t.href}>{t.label}</a> : <span style={{ color: "var(--ink-2)" }}>{t.label}</span>}
      </React.Fragment>
    ))}
  </div>
);

window.Pager = ({ prev, next }) => (
  <div className="pager">
    {prev ? <a href={prev.href}><div className="lbl">← Previous</div><div className="ttl">{prev.label}</div></a> : <span/>}
    {next ? <a className="next" href={next.href}><div className="lbl">Next →</div><div className="ttl">{next.label}</div></a> : <span/>}
  </div>
);
