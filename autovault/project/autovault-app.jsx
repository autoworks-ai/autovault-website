/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle */
const { useState, useEffect, useRef, useMemo } = React;

/* ============================================================ */
/* SHARED ICONS                                                  */
/* ============================================================ */
const Icon = {
  Check: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
  Github: (p) => (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" {...p}>
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.7 7.7 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.07-1.87 3.74-3.65 3.94.29.25.54.74.54 1.5v2.22c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  ),
  Lock: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="7" width="10" height="7" rx="1.2"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 1.5 2.5 4v4.5C2.5 11.5 5 14 8 14.5c3-.5 5.5-3 5.5-6V4L8 1.5z"/>
      <path d="M5.5 8 7 9.5 10.5 6"/>
    </svg>
  ),
};

/* ============================================================ */
/* BRAND MARK — abstract gate (not a vault)                      */
/* ============================================================ */
const BrandMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* outer frame */}
    <rect x="2.5" y="2.5" width="19" height="19" rx="2" stroke="var(--accent)" strokeWidth="1.4" />
    {/* gate slit */}
    <path d="M12 4v16" stroke="var(--accent)" strokeWidth="1.4" />
    {/* check inside */}
    <path d="M7 12.5l2.2 2.2L13.5 9.5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ============================================================ */
/* TOPBAR                                                        */
/* ============================================================ */
const Topbar = ({ active, onNav }) => {
  const items = [
    ["overview", "Overview"],
    ["how", "How it works"],
    ["concepts", "Concepts"],
    ["start", "Quick start"],
    ["compare", "Compare"],
  ];
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark"><BrandMark /></span>
          <span className="brand-name"><span className="auto">Auto</span><span className="vault">Vault</span></span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", marginLeft: 6, letterSpacing: "0.04em" }}>v0.4.1</span>
        </div>
        <nav className="nav">
          {items.map(([id, label]) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => onNav(id)}>{label}</button>
          ))}
        </nav>
        <div className="topbar-right">
          <button className="icon-btn" title="GitHub"><Icon.Github /></button>
          <button className="pill-btn">
            <span className="status-dot" />
            <span>Docs</span>
          </button>
          <button className="pill-btn primary">
            Install
            <Icon.Arrow />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================ */
/* INSTALL CARD                                                  */
/* ============================================================ */
const InstallCard = () => {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard?.writeText("curl -fsSL autovault.sh | sh");
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="install">
      <div className="install-head">
        <span className="dot live" />
        <span className="dot" />
        <span className="dot" />
        <span className="label">~ &nbsp;bash</span>
      </div>
      <div className="install-body">
        <span className="prompt">$</span>
        <code className="cmd">
          curl <span className="arg">-fsSL</span> autovault.sh <span className="pipe">|</span> sh
        </code>
        <button className={"copy-btn" + (copied ? " copied" : "")} onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
};

/* ============================================================ */
/* HERO + GATE STAGE                                             */
/* ============================================================ */
const GateStage = () => {
  // Simple animated diagram: dirty skills enter left, get verified at center, fan out right.
  return (
    <div className="gate-stage">
      <span className="gate-label l">// dirty</span>
      <span className="gate-label r">// scoped</span>
      <svg viewBox="0 0 400 400" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineFade" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--ink-4)" stopOpacity="0.0"/>
            <stop offset="40%" stopColor="var(--ink-3)" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="1"/>
          </linearGradient>
          <linearGradient id="lineFanOut" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="1"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.15"/>
          </linearGradient>
          <radialGradient id="gateGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35"/>
            <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.06"/>
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* incoming lines */}
        {[80, 140, 200, 260, 320].map((y, i) => (
          <g key={"in"+i}>
            <path d={`M0 ${y} C 80 ${y}, 140 200, 200 200`} stroke="url(#lineFade)" strokeWidth="1" fill="none"/>
            <circle r="2.5" fill="var(--accent)" opacity="0.9">
              <animateMotion dur={`${2.4 + i*0.3}s`} repeatCount="indefinite" begin={`${i*0.4}s`}>
                <mpath href={`#in-${i}`} />
              </animateMotion>
            </circle>
            <path id={`in-${i}`} d={`M0 ${y} C 80 ${y}, 140 200, 200 200`} fill="none" style={{display:"none"}}/>
          </g>
        ))}

        {/* gate glow */}
        <circle cx="200" cy="200" r="80" fill="url(#gateGlow)" />

        {/* gate */}
        <g transform="translate(200,200)">
          <rect x="-32" y="-44" width="64" height="88" rx="3" stroke="var(--accent)" strokeWidth="1.4" fill="rgba(90,214,192,0.04)"/>
          <line x1="0" y1="-40" x2="0" y2="40" stroke="var(--accent)" strokeWidth="1.2" />
          <path d="M-12 0 l8 8 16 -16" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </g>

        {/* outgoing fanout, three platforms */}
        {[
          { y: 100, label: "claude-code" },
          { y: 200, label: "codex" },
          { y: 300, label: "cursor" },
        ].map((p, i) => (
          <g key={"out"+i}>
            <path d={`M232 200 C 280 200, 320 ${p.y}, 400 ${p.y}`} stroke="url(#lineFanOut)" strokeWidth="1.2" fill="none"/>
            <path id={`out-${i}`} d={`M232 200 C 280 200, 320 ${p.y}, 400 ${p.y}`} fill="none" style={{display:"none"}}/>
            <circle r="2.5" fill="var(--accent)" opacity="1">
              <animateMotion dur="2.6s" repeatCount="indefinite" begin={`${0.6 + i*0.5}s`}>
                <mpath href={`#out-${i}`} />
              </animateMotion>
            </circle>
            <text x="350" y={p.y - 8} fill="var(--ink-2)" fontFamily="var(--mono)" fontSize="10" textAnchor="end">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const Hero = () => (
  <section className="section hero" id="overview">
    <div className="hero-grid">
      <div>
        <div className="hero-tag">
          <span className="badge">v0.4</span>
          <span>First public release · May 2026</span>
        </div>
        <h1>
          The skill registry<br />
          with a <span className="ital">gate</span>.
        </h1>
        <p className="hero-sub">
          Curated skills for AI agents — validated at the door, signed with provenance, scoped per caller, and transformed to fit every agent platform without forking. Local-first. Self-hostable.
        </p>
        <InstallCard />
        <div className="hero-meta">
          <span><Icon.Check className="check" /> Ed25519 signed</span>
          <span><Icon.Check className="check" /> MCP-native + bridge</span>
          <span><Icon.Check className="check" /> Apache-2.0</span>
        </div>
      </div>
      <GateStage />
    </div>
  </section>
);

/* ============================================================ */
/* PROBLEMS                                                      */
/* ============================================================ */
const Problems = () => {
  const items = [
    { num: "01", title: "Skill drift", body: "The same SKILL.md gets copy-pasted across repos and adapted locally. No upstream tracking, no merge story. Vendored code without a lockfile.", badge: "no provenance" },
    { num: "02", title: "Supply chain attacks", body: "Public registries have shipped credential stealers disguised as utilities. No code signing, no permission manifests, no isnad chain.", badge: "shipping malware" },
    { num: "03", title: "Duplicate explosion", body: "Agents write skills on the fly with no dedup. You end up with seventeen variants of extract-pdf-text and the agent picks one at random.", badge: "no dedup" },
    { num: "04", title: "Platform inconsistency", body: "Same skill, three forks — each calling agent expects different tool names. Fork once, maintain three.", badge: "fork × 3" },
    { num: "05", title: "Context bloat", body: "Every agent loads every SKILL.md at startup. Forty skills means thousands of tokens burned before the conversation begins.", badge: "token tax" },
    { num: "06", title: "No permission scoping", body: "Skills load globally. No per-project, per-device, per-tool gating. Dev-machine skills leak into prod, client A skills leak to client B.", badge: "leaks by default" },
  ];
  return (
    <section className="section" id="problems">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, gap: 32 }}>
        <div>
          <div className="eyebrow"><span className="dash" /> The state of skills</div>
          <h2 style={{ marginTop: 16, maxWidth: 720 }}>
            Six concrete holes in how skills work today.
          </h2>
        </div>
        <p className="lede" style={{ maxWidth: 360 }}>
          The format works. The ecosystem around the format is a hot mess. Each of these is a separate fix to a separate hole.
        </p>
      </div>
      <div className="problems">
        {items.map(p => (
          <div className="problem" key={p.num}>
            <div className="num">PROBLEM / {p.num}</div>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
            <span className="badge">{p.badge}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ============================================================ */
/* TRANSFORMATION DIAGRAM                                        */
/* ============================================================ */
const TRANSFORMS = {
  "claude-code": {
    color: "#d6a85a",
    rows: [
      { from: "browser.fill_form", to: "chrome-devtools" },
      { from: "browser.click", to: "chrome-devtools" },
      { from: "fs.read", to: "read" },
      { from: "fs.write", to: "write" },
    ],
  },
  "codex": {
    color: "#5a9dd6",
    rows: [
      { from: "browser.fill_form", to: "browser_form" },
      { from: "browser.click", to: "browser_click" },
      { from: "fs.read", to: "file_read" },
      { from: "fs.write", to: "file_write" },
    ],
  },
  "cursor": {
    color: "#b48ad6",
    rows: [
      { from: "browser.fill_form", to: "playwright_fill_form" },
      { from: "browser.click", to: "playwright_click" },
      { from: "fs.read", to: "fs_read" },
      { from: "fs.write", to: "fs_write" },
    ],
  },
};

const TransformationDiagram = () => {
  const [target, setTarget] = useState("claude-code");
  const t = TRANSFORMS[target];

  return (
    <section className="section" id="how">
      <div className="eyebrow"><span className="dash" /> The actually clever part</div>
      <h2 style={{ marginTop: 16, maxWidth: 760 }}>
        One canonical skill.<br/>
        <span className="ital">Three rendered views.</span>
      </h2>
      <p className="lede" style={{ marginTop: 16 }}>
        Authors write the skill once against canonical capability names. AutoVault holds a transformation manifest that maps to whatever the calling agent actually understands — at delivery time, not author time.
      </p>

      <div className="xform-wrap">
        <div className="xform-head">
          <div>
            <h3>Transformation manifest in flight</h3>
            <p>Hover the platforms to see the rendered view change. The skill on the left never moves.</p>
          </div>
          <div className="xform-toggle">
            {Object.keys(TRANSFORMS).map(k => (
              <button key={k} className={target === k ? "active" : ""} onClick={() => setTarget(k)} onMouseEnter={() => setTarget(k)}>
                <span className="swatch" style={{ background: TRANSFORMS[k].color }} />
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="xform-stage">
          {/* connecting svg */}
          <svg className="flow" viewBox="0 0 1000 400" preserveAspectRatio="none">
            <defs>
              <linearGradient id="flow1" x1="0" x2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0"/>
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.7"/>
              </linearGradient>
              <linearGradient id="flow2" x1="0" x2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.7"/>
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* left set */}
            {[120, 170, 220, 270].map((y, i) => (
              <g key={"l"+i}>
                <path d={`M280 ${y} L500 200`} stroke="url(#flow1)" strokeWidth="0.8" fill="none"/>
              </g>
            ))}
            {/* right set */}
            {[120, 170, 220, 270].map((y, i) => (
              <g key={"r"+i}>
                <path d={`M500 200 L720 ${y}`} stroke="url(#flow2)" strokeWidth="0.8" fill="none"/>
              </g>
            ))}
          </svg>

          {/* COLUMN 1: source skill */}
          <div className="xform-col">
            <div className="xform-col-head"><span className="num">1</span> Canonical skill</div>
            <div className="skill-card">
              <div className="skill-card-head">
                <span className="file">extract-pdf<span className="ext">/SKILL.md</span></span>
                <span className="verified"><Icon.Check /> SIGNED</span>
              </div>
              <div className="skill-card-body">
                <div><span className="yaml-key">name:</span> <span className="yaml-str">extract-pdf</span></div>
                <div><span className="yaml-key">version:</span> <span className="yaml-val">1.4.0</span></div>
                <div><span className="yaml-key">tools_required:</span></div>
                <div className="yaml-list">&nbsp;&nbsp;- browser.fill_form</div>
                <div className="yaml-list">&nbsp;&nbsp;- browser.click</div>
                <div className="yaml-list">&nbsp;&nbsp;- fs.read</div>
                <div className="yaml-list">&nbsp;&nbsp;- fs.write</div>
                <div className="yaml-comment"># transformations:</div>
                <div className="yaml-comment"># &nbsp;&nbsp;applied at delivery</div>
              </div>
            </div>
          </div>

          <div className="xform-spacer" />

          {/* COLUMN 2: engine */}
          <div className="xform-col" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="xform-col-head" style={{ justifyContent: "center" }}><span className="num">2</span> Engine</div>
            <div className="xform-engine">
              <div className="ring">
                <BrandMark size={26} />
              </div>
            </div>
            <div className="platforms">
              {Object.keys(TRANSFORMS).map(k => (
                <div key={k}
                     className={"platform" + (target === k ? " active" : "")}
                     onMouseEnter={() => setTarget(k)}>
                  <span className="platform-mark">{k[0].toUpperCase()}</span>
                  <span className="name">{k}</span>
                  <span className="tool">→ render</span>
                </div>
              ))}
            </div>
          </div>

          <div className="xform-spacer" />

          {/* COLUMN 3: rendered tool */}
          <div className="xform-col">
            <div className="xform-col-head"><span className="num">3</span> Rendered for caller</div>
            <div className="rendered-tool">
              <div className="rt-head">
                <span className="agent" style={{ color: t.color }}>● {target}</span>
                <span style={{ marginLeft: "auto", color: "var(--ink-3)" }}>SKILL.md (rewritten)</span>
              </div>
              <div className="rt-body">
                <div style={{ color: "var(--ink-3)", marginBottom: 8 }}>tools_required:</div>
                {t.rows.map((r, i) => (
                  <div className="row" key={r.from + i}>
                    <span className="key">{r.from}</span>
                    <span style={{ color: "var(--ink-4)" }}>→</span>
                    <span className="val">{r.to}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.6 }}>
              <span style={{ color: "var(--accent)" }}>✓</span> Skill author wrote one file.<br/>
              <span style={{ color: "var(--accent)" }}>✓</span> Agent receives its native tool names.<br/>
              <span style={{ color: "var(--accent)" }}>✓</span> No fork, no drift, no duplicate.
            </div>
          </div>
        </div>

        <div className="xform-footnote">
          <div className="item">
            <div className="lbl">Manifest format</div>
            <div className="val">YAML in skill frontmatter, validated at <strong>install</strong> and <strong>render</strong></div>
          </div>
          <div className="item">
            <div className="lbl">Resolution latency</div>
            <div className="val"><strong>&lt; 4ms</strong> per skill, cached after first render</div>
          </div>
          <div className="item">
            <div className="lbl">Agents supported today</div>
            <div className="val"><strong>Claude Code, Codex, Cursor, AutoHub</strong> + bridge skill for the rest</div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ============================================================ */
/* VALIDATION GATE — animated pipeline                           */
/* ============================================================ */
const GATE_STEPS = [
  { title: "YAML auto-repair", desc: "Frontmatter is the #1 source of breakage. We fix it before storage.", status: "fix" },
  { title: "Security denylist", desc: "Known-bad patterns: credential stealers, fork bombs, exfiltration.", status: "scan" },
  { title: "Capability vs. behavior", desc: "Does the skill actually do what its frontmatter claims?", status: "verify" },
  { title: "Dedup", desc: "Text similarity in V1, embedding-space matching in V2.", status: "match" },
  { title: "Ed25519 sign", desc: "Provenance becomes a first-class artifact, not a hope.", status: "sign" },
];

const ValidationGate = () => {
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(t => (t + 1) % (GATE_STEPS.length + 2)), 1100);
    return () => clearInterval(id);
  }, [running]);

  const stepState = (i) => {
    if (tick === 0) return "";
    if (tick > GATE_STEPS.length) return "done";
    if (i < tick - 1) return "done";
    if (i === tick - 1) return "active";
    return "";
  };

  return (
    <section className="section" id="concepts">
      <div className="gate-section">
        <div>
          <div className="eyebrow"><span className="dash" /> The wedge</div>
          <h2 style={{ marginTop: 16 }}>
            Skills enter dirty.<br/>
            They leave <span className="ital">signed.</span>
          </h2>
          <p className="lede" style={{ marginTop: 16 }}>
            Existing registries are <em>publish-and-pray</em>. AutoVault is <em>gate-and-sign</em> — every skill, whether installed from a source adapter or proposed by an agent at runtime, runs the same five-step validation pipeline before it touches the vault.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
            <button className="pill-btn" onClick={() => { setTick(0); setRunning(true); }}>
              ▶ Replay
            </button>
            <button className="pill-btn" onClick={() => setRunning(r => !r)}>
              {running ? "❚❚ Pause" : "▶ Resume"}
            </button>
          </div>

          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 460 }}>
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Reject rate</div>
              <div style={{ fontSize: 28, fontWeight: 500, marginTop: 4, letterSpacing: "-0.02em" }}>11.4%</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>of submissions in private beta</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Avg. gate latency</div>
              <div style={{ fontSize: 28, fontWeight: 500, marginTop: 4, letterSpacing: "-0.02em" }}>820ms</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>per skill, fully validated</div>
            </div>
          </div>
        </div>

        <div className="gate-pipeline">
          <div className="gate-input">
            <span className="tag">UNTRUSTED</span>
            <span style={{ flex: 1 }}>weather-skill@1.2.0 from clawdhub-mirror</span>
            <span style={{ color: "var(--bad)", opacity: 0.7 }}>?</span>
          </div>

          <div className="gate-track">
            {GATE_STEPS.map((s, i) => {
              const st = stepState(i);
              return (
                <div key={i} className={"gate-step " + st}>
                  <span className="num">{st === "done" ? <Icon.Check /> : (i + 1)}</span>
                  <div>
                    <div className="title">{s.title}</div>
                    <div className="desc">{s.desc}</div>
                  </div>
                  <span className="status">
                    {st === "active" ? "RUNNING…" : st === "done" ? "PASSED" : "QUEUED"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="gate-output" style={{ opacity: tick > GATE_STEPS.length ? 1 : 0.4, transition: "opacity 300ms" }}>
            <span className="tag">VERIFIED</span>
            <span style={{ flex: 1 }}>weather-skill@1.2.0 — admitted</span>
            <span className="sig">sig:0x9af4…2c81</span>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ============================================================ */
/* PERMISSIONS                                                   */
/* ============================================================ */
const Permissions = () => (
  <section className="section">
    <div className="eyebrow"><span className="dash" /> Four-axis scoping</div>
    <h2 style={{ marginTop: 16, maxWidth: 760 }}>
      The skill exists.<br />
      <span className="ital">Whether you can see it</span> is a separate question.
    </h2>
    <p className="lede" style={{ marginTop: 16 }}>
      Every request carries a context. Same vault, filtered four ways — agent, device, project, tool. Dev-machine skills don't surface on a CI runner. Client A skills don't leak into Client B's project.
    </p>

    <div className="perm-grid">
      <div className="perm-card">
        <span className="axis">Axis 01 / Agent</span>
        <h4>Per-caller profiles</h4>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13.5 }}>Codex, Claude Code, Cursor, AutoHub, custom — each gets its own filtered view, transformed to its native tool names.</p>
        <div className="examples">
          <span className="chip on">claude-code</span>
          <span className="chip on">codex</span>
          <span className="chip">cursor</span>
          <span className="chip">autohub</span>
        </div>
      </div>
      <div className="perm-card">
        <span className="axis">Axis 02 / Device</span>
        <h4>Machine-bound skills</h4>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13.5 }}>Laptop, server, ephemeral CI runner — different sets per machine. Production never sees the dev sandbox.</p>
        <div className="examples">
          <span className="chip on">laptop-jack</span>
          <span className="chip">prod-runner-3</span>
          <span className="chip">ci-ephemeral</span>
        </div>
      </div>
      <div className="perm-card">
        <span className="axis">Axis 03 / Project</span>
        <h4>Project boundaries</h4>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13.5 }}>Project-scoped skills don't leak across repos. Client work stays inside the client's namespace.</p>
        <div className="examples">
          <span className="chip on">autovault</span>
          <span className="chip">client-foo</span>
          <span className="chip">internal/ops</span>
        </div>
      </div>
      <div className="perm-card">
        <span className="axis">Axis 04 / Tool · User</span>
        <h4>Fine-grained access</h4>
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 13.5 }}>Per-tool permissions, role-based access. Read-only roles see read-only skills.</p>
        <div className="examples">
          <span className="chip on">role:engineer</span>
          <span className="chip">role:design</span>
          <span className="chip">role:ops</span>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================ */
/* COMPARISON TABLE                                              */
/* ============================================================ */
const ROWS = [
  ["Validation gate at install",         "yes",      "no",        "no",         "partial",  "no"],
  ["Ed25519 signed provenance",          "yes",      "no",        "no",         "no",       "no"],
  ["Per-caller transformation",          "yes",      "no",        "no",         "no",       "no"],
  ["Four-axis permission scoping",       "yes",      "no",        "partial",    "no",       "no"],
  ["Dedup at submission",                "yes",      "no",        "no",         "no",       "no"],
  ["Local-first (no required cloud)",    "yes",      "no",        "no",         "yes",      "yes"],
  ["Self-hostable team mode",            "yes",      "no",        "yes",        "no",       "partial"],
  ["MCP-native + non-MCP bridge",        "yes",      "partial",   "no",         "yes",      "no"],
  ["Progressive disclosure (no bloat)",  "yes",      "no",        "no",         "no",       "no"],
];

const Mark = ({ k }) => {
  if (k === "yes") return <span className="yes">●</span>;
  if (k === "partial") return <span className="partial">◐</span>;
  return <span className="no">○</span>;
};

const Comparison = () => (
  <section className="section" id="compare">
    <div className="eyebrow"><span className="dash" /> Honest deltas</div>
    <h2 style={{ marginTop: 16 }}>How AutoVault differs.</h2>
    <p className="lede" style={{ marginTop: 16 }}>
      Specific features, not vibes. We're not faster or cheaper — we're a primitive that doesn't exist yet. Other registries are <em>publish-and-pray</em>; AutoVault is <em>gate-and-sign</em>. That's a categorical difference, not a feature delta.
    </p>

    <div className="compare">
      <table>
        <thead>
          <tr>
            <th style={{ width: "34%" }}>Capability</th>
            <th className="us">AutoVault</th>
            <th>Tessl</th>
            <th>ClawdHub</th>
            <th>agentskills.io</th>
            <th>TLC registry</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, i) => (
            <tr key={i}>
              <td className="feat">{r[0]}</td>
              <td className="us"><Mark k={r[1]} /></td>
              <td><Mark k={r[2]} /></td>
              <td><Mark k={r[3]} /></td>
              <td><Mark k={r[4]} /></td>
              <td><Mark k={r[5]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 24, justifyContent: "center" }}>
      <span><span className="yes">●</span> shipped</span>
      <span><span className="partial">◐</span> partial</span>
      <span><span className="no">○</span> absent</span>
    </div>
  </section>
);

/* ============================================================ */
/* QUICK START                                                   */
/* ============================================================ */
const QuickStart = () => (
  <section className="section" id="start">
    <div className="eyebrow"><span className="dash" /> Five minutes, two agents</div>
    <h2 style={{ marginTop: 16, maxWidth: 760 }}>Same skill, two callers, zero forks.</h2>

    <div className="qs-grid">
      <div className="qs-step">
        <div className="qs-step-head">
          <span className="qs-step-num">STEP / 01</span>
          <span className="qs-step-title">Install the local vault</span>
        </div>
        <div className="qs-step-body">
          <div className="row"><span className="pmt">$</span><span>curl -fsSL autovault.sh | sh</span></div>
          <div className="out" style={{ marginTop: 6 }}>↳ installed → ~/.autovault</div>
          <div className="out">↳ profile dirs symlinked: ~/.claude/skills, ~/.codex/skills</div>
          <div className="row" style={{ marginTop: 10 }}><span className="pmt">$</span><span>autovault status</span></div>
          <div className="ok" style={{ marginTop: 6 }}>● vault healthy · 0 skills · ed25519 keypair generated</div>
        </div>
      </div>

      <div className="qs-step">
        <div className="qs-step-head">
          <span className="qs-step-num">STEP / 02</span>
          <span className="qs-step-title">Add a validated skill</span>
        </div>
        <div className="qs-step-body">
          <div className="row"><span className="pmt">$</span><span>autovault add github:autoworks-ai/skills/extract-pdf</span></div>
          <div className="out" style={{ marginTop: 6 }}>↳ fetching… 1.4kb</div>
          <div className="out">↳ <span className="ok">[1/5]</span> yaml-repair: ok</div>
          <div className="out">↳ <span className="ok">[2/5]</span> denylist: ok</div>
          <div className="out">↳ <span className="ok">[3/5]</span> capability/behavior: ok</div>
          <div className="out">↳ <span className="ok">[4/5]</span> dedup: ok (no near matches)</div>
          <div className="out">↳ <span className="ok">[5/5]</span> sign: 0x9af4…2c81</div>
          <div className="ok" style={{ marginTop: 6 }}>✓ admitted to vault</div>
        </div>
      </div>

      <div className="qs-step">
        <div className="qs-step-head">
          <span className="qs-step-num">STEP / 03</span>
          <span className="qs-step-title">Scope to a project</span>
        </div>
        <div className="qs-step-body">
          <div className="row"><span className="pmt">$</span><span>autovault scope extract-pdf --project autovault-website --agent claude-code,codex</span></div>
          <div className="out" style={{ marginTop: 6 }}>↳ scoped: 2 agents × 1 project</div>
          <div className="out">↳ rendering for claude-code → fs.read → read</div>
          <div className="out">↳ rendering for codex → fs.read → file_read</div>
          <div className="ok" style={{ marginTop: 6 }}>✓ ready · cached</div>
        </div>
      </div>

      <div className="qs-step">
        <div className="qs-step-head">
          <span className="qs-step-num">STEP / 04</span>
          <span className="qs-step-title">Run from either agent</span>
        </div>
        <div className="qs-step-body">
          <div style={{ color: "var(--ink-3)" }}># in claude-code</div>
          <div>&gt; use extract-pdf to summarize report.pdf</div>
          <div className="ok" style={{ marginTop: 4 }}>✓ tool resolved: chrome-devtools, read</div>
          <div style={{ color: "var(--ink-3)", marginTop: 12 }}># in codex</div>
          <div>&gt; use extract-pdf to summarize report.pdf</div>
          <div className="ok" style={{ marginTop: 4 }}>✓ tool resolved: browser_form, file_read</div>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================ */
/* CTA + FOOTER                                                  */
/* ============================================================ */
const CTA = () => (
  <section className="section" style={{ paddingBottom: 48 }}>
    <div className="cta">
      <div className="eyebrow" style={{ justifyContent: "center", display: "inline-flex" }}>
        <span className="dash" /> Ship one
      </div>
      <h2 style={{ marginTop: 16 }}>
        Signed skills. Real provenance.<br/>
        <span className="ital">No mystery code.</span>
      </h2>
      <p>One vault. Every agent. No drift. Self-host the team mode, or run local-only — same engine, same gate.</p>
      <div className="row">
        <button className="pill-btn primary">
          Install AutoVault <Icon.Arrow />
        </button>
        <button className="pill-btn">
          <Icon.Github /> github.com/autoworks-ai/autovault
        </button>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer>
    <div className="footer-inner">
      <div className="footer-col">
        <div className="brand" style={{ marginBottom: 14 }}>
          <span className="brand-mark"><BrandMark /></span>
          <span className="brand-name"><span className="auto">Auto</span><span className="vault">Vault</span></span>
        </div>
        <div style={{ color: "var(--ink-3)", fontSize: 13, maxWidth: 320, lineHeight: 1.55 }}>
          A curated skills layer for AI agents. Validated at the door, signed with provenance, scoped per caller.
        </div>
        <div style={{ marginTop: 18, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-4)", letterSpacing: "0.04em" }}>
          PART OF THE AUTOWORKS-AI FAMILY
        </div>
      </div>
      <div className="footer-col">
        <h5>Product</h5>
        <a>Overview</a>
        <a>How it works</a>
        <a>Concepts</a>
        <a>Skills directory</a>
        <a>Changelog</a>
      </div>
      <div className="footer-col">
        <h5>Develop</h5>
        <a>Quick start</a>
        <a>Authoring skills</a>
        <a>Transformation manifest</a>
        <a>Permission scoping</a>
        <a>Self-hosting</a>
      </div>
      <div className="footer-col">
        <h5>Org</h5>
        <a>autoworks-ai</a>
        <a>AutoMem</a>
        <a>AutoHub</a>
        <a>AutoJack</a>
        <a>Security policy</a>
      </div>
    </div>
    <div className="footer-bottom">
      <span>© 2026 autoworks-ai · Apache-2.0</span>
      <span>autovault.dev</span>
    </div>
  </footer>
);

/* ============================================================ */
/* TWEAKS                                                        */
/* ============================================================ */
const ACCENT_PRESETS = {
  "teal":   { accent: "#5ad6c0", ink: "#062821" },
  "cyan":   { accent: "#5ac4d6", ink: "#062628" },
  "amber":  { accent: "#e8a866", ink: "#2a1a08" },
  "lime":   { accent: "#9bd65a", ink: "#0d2606" },
  "violet": { accent: "#a89af0", ink: "#160e2e" },
};

const SURFACE_PRESETS = {
  "deep slate":   { bg: "#0b1014", bg2: "#0f161c", panel: "#131c24", panel2: "#18222b", line: "#1f2c37", line2: "#283744" },
  "ink black":    { bg: "#08090a", bg2: "#0c0e10", panel: "#111316", panel2: "#15181c", line: "#1c2025", line2: "#262b31" },
  "warm graphite": { bg: "#0e0c0a", bg2: "#13110f", panel: "#1a1714", panel2: "#1f1c18", line: "#2a2520", line2: "#352f29" },
};

const TweakControls = () => {
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "teal",
    "surface": "deep slate",
    "density": "comfortable",
    "showGrid": true
  }/*EDITMODE-END*/);

  useEffect(() => {
    const root = document.documentElement;
    const a = ACCENT_PRESETS[t.accent] || ACCENT_PRESETS.teal;
    root.style.setProperty("--accent", a.accent);
    root.style.setProperty("--accent-ink", a.ink);
    root.style.setProperty("--accent-soft", hexToRgba(a.accent, 0.12));

    const s = SURFACE_PRESETS[t.surface] || SURFACE_PRESETS["deep slate"];
    root.style.setProperty("--bg", s.bg);
    root.style.setProperty("--bg-2", s.bg2);
    root.style.setProperty("--panel", s.panel);
    root.style.setProperty("--panel-2", s.panel2);
    root.style.setProperty("--line", s.line);
    root.style.setProperty("--line-2", s.line2);

    document.body.dataset.density = t.density;
    document.body.dataset.grid = String(t.showGrid);
  }, [t]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Accent">
        <TweakColor
          label="Accent color"
          value={t.accent}
          options={Object.keys(ACCENT_PRESETS).map(k => ACCENT_PRESETS[k].accent)}
          onChange={(hex) => {
            const key = Object.keys(ACCENT_PRESETS).find(k => ACCENT_PRESETS[k].accent === hex);
            setTweak("accent", key || "teal");
          }}
        />
      </TweakSection>
      <TweakSection title="Surface">
        <TweakRadio
          label="Background"
          value={t.surface}
          options={Object.keys(SURFACE_PRESETS)}
          onChange={(v) => setTweak("surface", v)}
        />
      </TweakSection>
      <TweakSection title="Layout">
        <TweakRadio
          label="Density"
          value={t.density}
          options={["compact", "comfortable"]}
          onChange={(v) => setTweak("density", v)}
        />
        <TweakToggle
          label="Show diagram grid"
          value={t.showGrid}
          onChange={(v) => setTweak("showGrid", v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
};

function hexToRgba(hex, a) {
  const m = hex.replace("#","");
  const r = parseInt(m.substr(0,2),16), g = parseInt(m.substr(2,2),16), b = parseInt(m.substr(4,2),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ============================================================ */
/* APP                                                           */
/* ============================================================ */
const App = () => {
  const [active, setActive] = useState("overview");
  const onNav = (id) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // density CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      body[data-density="compact"] .section { padding: 64px 0; }
      body[data-density="compact"] h1 { font-size: 52px; }
      body[data-density="compact"] h2 { font-size: 32px; }
      body[data-grid="false"] .gate-stage::before { display: none; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <>
      <Topbar active={active} onNav={onNav} />
      <main className="page" data-screen-label="01 Home">
        <Hero />
        <Problems />
        <TransformationDiagram />
        <ValidationGate />
        <Permissions />
        <Comparison />
        <QuickStart />
        <CTA />
      </main>
      <Footer />
      <TweakControls />
    </>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
