import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";

/* ─── Palette ──────────────────────────────────────────────────────── */
function palette(isDark: boolean) {
  return isDark
    ? { bg: "#0a0a0a", bgSub: "#111111", bgFooter: "#050505", border: "#2a2a2a", text: "#f0f0f0", textMuted: "#888888", accent: "#5e6ad2", accentText: "#ffffff", grid: "#1a1a1a" }
    : { bg: "#f5f5f5", bgSub: "#ffffff", bgFooter: "#eeeeee", border: "#e0e0e0", text: "#111111", textMuted: "#555555", accent: "#2563eb", accentText: "#ffffff", grid: "#e5e5e5" };
}

/* ─── Injected CSS ─────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  .al * { box-sizing: border-box; }
  .al { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .al h1,.al h2,.al h3 { font-family: 'Inter', system-ui, sans-serif; font-weight: 400; margin: 0; letter-spacing: -0.04em; line-height: 1.1; }
  .al p { margin: 0; }
  @media (prefers-reduced-motion: no-preference) {
    .al-fade { opacity: 0; transform: translateY(6px); transition: opacity 350ms ease-out, transform 350ms ease-out; }
    .al-fade.v { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) { .al-fade { opacity: 1 !important; transform: none !important; } }
  .al-btn-p { display: inline-flex; align-items: center; justify-content: center; padding: 8px 20px; font-size: 14px; font-weight: 500; border: none; border-radius: 9999px; cursor: pointer; text-decoration: none; font-family: 'Inter', sans-serif; transition: filter 150ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1); }
  .al-btn-p:hover { filter: brightness(1.12); transform: scale(1.04); }
  .al-btn-p:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .al-btn-g { display: inline-flex; align-items: center; justify-content: center; padding: 8px 20px; font-size: 14px; font-weight: 500; border: 1px solid rgba(0,0,0,0.2); border-radius: 9999px; cursor: pointer; text-decoration: none; font-family: 'Inter', sans-serif; background: transparent; transition: filter 150ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1); }
  .al-btn-g:hover { filter: brightness(0.92); transform: scale(1.04); }
  .al-btn-g:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .al-nav-link { font-size: 14px; text-decoration: none; font-family: 'Inter', sans-serif; opacity: 0.7; transition: opacity 100ms; }
  .al-nav-link:hover { opacity: 1; }
  .al-footer-link { font-size: 13px; text-decoration: none; opacity: 0.5; font-family: 'Inter', sans-serif; transition: opacity 100ms; }
  .al-footer-link:hover { opacity: 1; }
  .al-code { font-family: 'JetBrains Mono', 'Menlo', monospace; font-size: 13px; line-height: 1.75; }
  .al-marquee { overflow: hidden; white-space: nowrap; }
  .al-marquee-inner { display: inline-flex; gap: 64px; animation: marquee 28s linear infinite; }
  @media (prefers-reduced-motion: reduce) { .al-marquee-inner { animation: none; } }
  @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .al-pixel-border { image-rendering: pixelated; }
  .metric-num { font-size: 56px; font-family: 'Inter', system-ui, sans-serif; font-weight: 400; letter-spacing: -0.04em; line-height: 1; }
  @media (max-width: 768px) {
    .hero-h1 { font-size: 34px !important; letter-spacing: -1px !important; }
    .hero-sub { font-size: 16px !important; }
    .al-two-col { flex-direction: column !important; }
    .al-two-col-r { flex-direction: column !important; }
    .al-metrics { grid-template-columns: 1fr 1fr !important; }
    .al-nav-desk { display: none !important; }
    .al-mob-btn { display: flex !important; }
    .al-mob-menu.open { display: flex !important; }
    .metric-num { font-size: 40px !important; }
    .al-feat-vis { min-height: 180px !important; }
  }
`;

/* ─── Canvas Hero ──────────────────────────────────────────────────── */
function PixelCanvas({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CELL = 28;
    const cols = () => Math.ceil(canvas.width / CELL) + 1;
    const rows = () => Math.ceil(canvas.height / CELL) + 1;

    const dotColor = isDark ? "rgba(255,255,255," : "rgba(0,0,0,";
    const bgColor = isDark ? "#0a0a0a" : "#f5f5f5";

    let W = 0, H = 0;
    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let t = 0;
    const draw = () => {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
      const mx = mouse.current.x, my = mouse.current.y;
      const c = cols(), r = rows();
      for (let row = 0; row < r; row++) {
        for (let col = 0; col < c; col++) {
          const x = col * CELL, y = row * CELL;
          const dx = x - mx, dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const wave = Math.sin(t * 0.018 + col * 0.35 + row * 0.35) * 0.4;
          const proximity = Math.max(0, 1 - dist / 220);
          const alpha = Math.max(0.04, Math.min(0.35, 0.06 + wave * 0.12 + proximity * 0.55));
          const size = 2 + proximity * 3;
          ctx.fillStyle = `${dotColor}${alpha.toFixed(2)})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      t++;
      raf.current = requestAnimationFrame(draw);
    };
    draw();

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener("mousemove", onMove);
    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      aria-hidden="true"
    />
  );
}

/* ─── Section fade wrapper ─────────────────────────────────────────── */
function Fade({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null!);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`al-fade${v ? " v" : ""}`} style={style}>{children}</div>;
}

/* ─── Terminal block ───────────────────────────────────────────────── */
function Terminal({ isDark }: { isDark: boolean }) {
  const P = palette(isDark);
  const lines = [
    { t: "comment", s: "# AI Architect — generate a floor plan" },
    { t: "cmd", s: "$ architect generate --plot 40x60 --floors 2 --vastu" },
    { t: "out", s: "  Connecting to DeepSeek-V3..." },
    { t: "out", s: "  Topology resolved: 8 rooms across 2 bays" },
    { t: "success", s: "  Vastu score: 91/100 (SW master ✓, SE kitchen ✓)" },
    { t: "out", s: "  Drafter: 0 overlaps, 0 constraint violations" },
    { t: "cmd", s: "$ architect export --format dxf --layers all" },
    { t: "success", s: "  floor_plan_v1.dxf exported (6 layers, 1:100 scale)" },
    { t: "cmd", s: "$ architect report --format pdf" },
    { t: "success", s: "  report.pdf generated (4 pages, BOM included)" },
  ];
  const colors: Record<string, string> = {
    comment: P.textMuted,
    cmd: isDark ? "#d7d7d0" : "#1a1614",
    out: P.textMuted,
    success: isDark ? "#8fb87a" : "#3a6630",
  };
  return (
    <div style={{ background: isDark ? "#0f0e0c" : "#1a1614", border: `1px solid ${P.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ background: isDark ? "#252220" : "#2a2825", padding: "10px 16px", display: "flex", gap: 6, alignItems: "center", borderBottom: `1px solid ${P.border}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
        ))}
        <span style={{ fontSize: 12, color: "#606060", marginLeft: 8, fontFamily: "JetBrains Mono, monospace" }}>architect — zsh</span>
      </div>
      <div style={{ padding: "20px 24px" }}>
        {lines.map((l, i) => (
          <div key={i} className="al-code" style={{ color: colors[l.t], marginBottom: 4 }}>{l.s}</div>
        ))}
        <div className="al-code" style={{ color: P.textMuted, marginTop: 8 }}>
          <span style={{ color: isDark ? "#8fb87a" : "#3a6630" }}>▋</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function Landing() {
  const { isDark } = useTheme();
  const P = palette(isDark);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const MAX = { maxWidth: 1280, margin: "0 auto" };

  const btnP: React.CSSProperties = {
    background: P.accent, color: P.accentText,
    padding: "8px 20px", fontSize: 14, fontWeight: 500,
    border: "none", borderRadius: 9999, cursor: "pointer",
    textDecoration: "none", display: "inline-flex", alignItems: "center",
    fontFamily: "Inter, sans-serif",
    transition: "filter 150ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
  };

  const btnG: React.CSSProperties = {
    background: "transparent", color: P.text,
    padding: "8px 20px", fontSize: 14, fontWeight: 500,
    border: `1px solid ${P.border}`, borderRadius: 9999, cursor: "pointer",
    textDecoration: "none", display: "inline-flex", alignItems: "center",
    fontFamily: "Inter, sans-serif",
    transition: "filter 150ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
  };

  const eyebrow: React.CSSProperties = {
    fontSize: 11, fontWeight: 500, letterSpacing: "0.1em",
    textTransform: "uppercase", color: P.textMuted, display: "block", marginBottom: 16,
  };

  const partners = ["Infosys", "L&T", "Shapoorji", "Godrej", "DLF", "Sobha"];

  const metrics = [
    { n: "< 8s", label: "avg generation time" },
    { n: "10/10", label: "Vastu rule coverage" },
    { n: "0", label: "geometry overlaps" },
    { n: "6", label: "DXF export layers" },
  ];

  const features = [
    {
      eyebrow: "Topology Engine",
      title: "AI decides. Math delivers.",
      copy: "DeepSeek-V3 resolves room adjacencies in a 3-bay grid. Our Python drafter converts topology decisions into pixel-perfect geometry — no hallucinated coordinates.",
      visual: (
        <div style={{ padding: 24, background: isDark ? "#0f0e0c" : "#1a1614", borderRadius: 8, width: "100%", minHeight: 200 }}>
          {[["left_bay", "Master Bed, Bath"], ["spine", "Foyer, Corridor"], ["right_bay", "Kitchen, Living"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: `1px solid rgba(255,255,255,0.08)`, alignItems: "center" }}>
              <span className="al-code" style={{ color: "#909078", width: 90, flexShrink: 0, fontSize: 12 }}>{k}</span>
              <span className="al-code" style={{ color: isDark ? "#d7d7d0" : "#c8c8c0", fontSize: 12 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, fontSize: 11, color: "#606060", fontFamily: "JetBrains Mono, monospace" }}>drafter resolves x / y / w / h ↓</div>
        </div>
      ),
      flip: false,
    },
    {
      eyebrow: "Vastu Engine",
      title: "Rules, scored and fixed.",
      copy: "Ten geometric constraints measured on a 3x3 compass grid. Auto-Fix calls the LLM, repositions failing rooms, and re-runs the drafter in one click.",
      visual: (
        <div style={{ background: isDark ? "#252220" : "#c8c8c0", border: `1px solid ${P.border}`, borderRadius: 8, overflow: "hidden", width: "100%", minHeight: 200 }}>
          {[
            { rule: "Master Bed SW", pass: true },
            { rule: "Kitchen SE", pass: true },
            { rule: "Entry East/North", pass: false },
            { rule: "Toilet not NE", pass: true },
          ].map(r => (
            <div key={r.rule} style={{ display: "flex", justifyContent: "space-between", padding: "11px 20px", borderBottom: `1px solid ${P.border}`, fontSize: 13, color: P.text }}>
              <span>{r.rule}</span>
              <span style={{ fontSize: 11, fontWeight: 600, background: r.pass ? (isDark ? "rgba(143,184,122,0.15)" : "rgba(58,102,48,0.12)") : "rgba(180,60,60,0.12)", color: r.pass ? (isDark ? "#8fb87a" : "#3a6630") : "#b43c3c", padding: "2px 10px", borderRadius: 4 }}>
                {r.pass ? "PASS" : "FAIL"}
              </span>
            </div>
          ))}
          <div style={{ padding: "16px 20px" }}>
            <span style={{ fontSize: 32, fontFamily: "Inter, sans-serif", color: P.text, letterSpacing: "-0.04em" }}>91</span>
            <span style={{ fontSize: 12, color: P.textMuted, marginLeft: 8 }}>/ 100 Vastu score</span>
          </div>
        </div>
      ),
      flip: true,
    },
    {
      eyebrow: "Export Suite",
      title: "Files engineers actually open.",
      copy: "Multi-layer DXF at 1 ft = 304.8 mm. Separate WALLS, DOORS, WINDOWS, FURNITURE, and DIMENSIONS layers. Drop it into AutoCAD or ZWCAD unchanged.",
      visual: (
        <div style={{ background: isDark ? "#252220" : "#c8c8c0", border: `1px solid ${P.border}`, borderRadius: 8, padding: 20, width: "100%", minHeight: 200 }}>
          {[["WALLS", 90], ["DOORS", 65], ["WINDOWS", 50], ["FURNITURE", 75], ["DIMENSIONS", 40]].map(([layer, w]) => (
            <div key={layer as string} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span className="al-code" style={{ fontSize: 11, color: P.textMuted }}>{layer}</span>
              </div>
              <div style={{ height: 4, background: isDark ? "#1a1614" : "#b8b8b0", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${w}%`, background: P.accent, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      ),
      flip: false,
    },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="al" style={{ background: P.bg, color: P.text, minHeight: "100vh" }}>

        {/* ── HEADER ── */}
        <header style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 72,
          display: "flex", alignItems: "center", padding: "0 40px",
          background: scrolled ? P.bg : "transparent",
          borderBottom: scrolled ? `1px solid ${P.border}` : "1px solid transparent",
          transition: "background 200ms, border-color 200ms",
        }}>
          <div style={{ ...MAX, width: "100%", display: "flex", alignItems: "center", gap: 32 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: P.text, letterSpacing: "-0.3px", flexShrink: 0, fontFamily: "Inter, sans-serif" }}>
              AI Architect
            </span>
            <nav className="al-nav-desk" style={{ display: "flex", gap: 24, alignItems: "center", flex: 1 }}>
              {["How it works", "Features", "Blog"].map(l => (
                <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} className="al-nav-link" style={{ color: P.text }}>{l}</a>
              ))}
              <Link to="/login" className="al-nav-link" style={{ color: P.text }}>Sign in</Link>
            </nav>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              <ThemeToggle />
              <Link to="/register" className="al-btn-p" style={{ ...btnP }}>Book a demo</Link>
              <button
                className="al-mob-btn"
                aria-label="Menu"
                onClick={() => setMobileOpen(o => !o)}
                style={{ display: "none", background: "none", border: `1px solid ${P.border}`, color: P.text, cursor: "pointer", padding: 8, borderRadius: 6, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {mobileOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></>}
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile menu */}
        <div className={`al-mob-menu${mobileOpen ? " open" : ""}`} style={{ display: "none", position: "fixed", inset: 0, zIndex: 99, background: P.bg, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: "0 40px", gap: 28 }}>
          {["How it works", "Features", "Blog"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} onClick={() => setMobileOpen(false)} style={{ fontSize: 28, color: P.text, textDecoration: "none", fontFamily: "Inter, sans-serif", fontWeight: 400 }}>{l}</a>
          ))}
          <Link to="/login" onClick={() => setMobileOpen(false)} style={{ fontSize: 28, color: P.text, textDecoration: "none", fontFamily: "Inter, sans-serif" }}>Sign in</Link>
          <Link to="/register" className="al-btn-p" onClick={() => setMobileOpen(false)} style={{ ...btnP, fontSize: 16, padding: "12px 28px", marginTop: 8 }}>Book a demo</Link>
        </div>

        <main>
          {/* ── HERO ── */}
          <section style={{ position: "relative", minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 24px 96px", textAlign: "center", overflow: "hidden" }}>
            <PixelCanvas isDark={isDark} />
            <div style={{ position: "relative", zIndex: 2, maxWidth: 760 }}>
              {/* blinking cursor eyebrow */}
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: P.textMuted, marginBottom: 24, letterSpacing: "0.06em" }}>
                <span>$ architect init --prod</span>
                <span style={{ display: "inline-block", width: 8, height: 14, background: P.textMuted, marginLeft: 4, verticalAlign: "middle", animation: "blink 1s step-end infinite" }} />
              </div>
              <h1 className="hero-h1" style={{ fontSize: 54, letterSpacing: "-1.998px", lineHeight: 1.08, fontWeight: 400, color: P.text, marginBottom: 24 }}>
                Production that runs itself.
              </h1>
              <p className="hero-sub" style={{ fontSize: 20, lineHeight: 1.5, color: P.textMuted, marginBottom: 40, maxWidth: 540, margin: "0 auto 40px" }}>
                Describe any building. Get regulation-aware, Vastu-compliant floor plans with AutoCAD export in seconds.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link to="/register" className="al-btn-p" style={{ ...btnP, padding: "10px 28px", fontSize: 15 }}>Start for free</Link>
                <Link to="/login" className="al-btn-g" style={{ ...btnG, padding: "10px 28px", fontSize: 15 }}>Sign in</Link>
              </div>
            </div>
            <style>{`@keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }`}</style>
          </section>

          {/* ── SOCIAL PROOF ── */}
          <Fade>
            <section style={{ padding: "0 24px 96px" }}>
              <div style={{ ...MAX, borderTop: `1px solid ${P.border}`, paddingTop: 48 }}>
                <span style={{ ...eyebrow, textAlign: "center", display: "block", marginBottom: 32 }}>Trusted by teams at</span>
                <div className="al-marquee">
                  <div className="al-marquee-inner">
                    {[...partners, ...partners].map((name, i) => (
                      <span key={i} style={{ fontSize: 14, fontWeight: 600, color: P.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.5, flexShrink: 0 }}>{name}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </Fade>

          {/* ── CODE PROOF ── */}
          <Fade>
            <section id="how-it-works" style={{ padding: "0 24px 96px" }}>
              <div style={{ ...MAX }}>
                <span style={eyebrow}>In action</span>
                <h2 style={{ fontSize: 24, color: P.text, marginBottom: 40, maxWidth: 480 }}>From terminal to title block in seconds.</h2>
                <Terminal isDark={isDark} />
              </div>
            </section>
          </Fade>

          {/* ── METRICS ── */}
          <Fade>
            <section style={{ background: P.bgSub, borderTop: `1px solid ${P.border}`, borderBottom: `1px solid ${P.border}` }}>
              <div style={{ ...MAX, padding: "96px 24px" }}>
                <div className="al-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
                  {metrics.map((m, i) => (
                    <div key={i} style={{ padding: "0 32px", borderRight: i < 3 ? `1px solid ${P.border}` : "none", textAlign: "center" }}>
                      <div className="metric-num" style={{ color: P.text }}>{m.n}</div>
                      <div style={{ fontSize: 12, color: P.textMuted, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </Fade>

          {/* ── FEATURES ── */}
          <div id="features">
            {features.map((f, i) => (
              <Fade key={i}>
                <section style={{ padding: "96px 24px" }}>
                  <div style={{ ...MAX }}>
                    <div className={f.flip ? "al-two-col-r" : "al-two-col"} style={{ display: "flex", gap: 64, alignItems: "center", flexDirection: f.flip ? "row-reverse" : "row" }}>
                      <div style={{ flex: "1 1 400px" }}>
                        <span style={eyebrow}>{f.eyebrow}</span>
                        <h2 style={{ fontSize: 24, color: P.text, marginBottom: 16 }}>{f.title}</h2>
                        <p style={{ fontSize: 16, lineHeight: 1.65, color: P.textMuted, maxWidth: 400 }}>{f.copy}</p>
                        <Link to="/register" className="al-btn-p" style={{ ...btnP, marginTop: 32, display: "inline-flex" }}>Try it free</Link>
                      </div>
                      <div className="al-feat-vis" style={{ flex: "1 1 420px", minHeight: 240, display: "flex" }}>
                        {f.visual}
                      </div>
                    </div>
                  </div>
                </section>
              </Fade>
            ))}
          </div>

          {/* ── FINAL CTA ── */}
          <Fade>
            <section style={{ background: P.bgSub, borderTop: `1px solid ${P.border}` }}>
              <div style={{ ...MAX, padding: "96px 24px", textAlign: "center" }}>
                <span style={{ ...eyebrow, textAlign: "center", display: "block" }}>Get started</span>
                <h2 style={{ fontSize: 40, color: P.text, marginBottom: 16, letterSpacing: "-0.04em" }}>Production that runs itself.</h2>
                <p style={{ fontSize: 16, color: P.textMuted, marginBottom: 40 }}>Used for final-year projects, client pitches, and real construction planning.</p>
                <Link to="/register" className="al-btn-p" style={{ ...btnP, fontSize: 15, padding: "12px 36px" }}>Start for free</Link>
                <div style={{ marginTop: 16, fontSize: 13, color: P.textMuted }}>Free plan · No credit card · Export up to 3 designs</div>
              </div>
            </section>
          </Fade>
        </main>

        {/* ── FOOTER ── */}
        <footer style={{ background: P.bgFooter, borderTop: `1px solid ${P.border}` }}>
          <div style={{ ...MAX, padding: "48px 24px" }}>
            <div style={{ display: "flex", gap: 64, justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap" }}>
              <div style={{ maxWidth: 240 }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 600, color: P.text, marginBottom: 12 }}>AI Architect</div>
                <p style={{ fontSize: 13, color: P.textMuted, lineHeight: 1.65 }}>AI-generated, regulation-aware floor plans. The infrastructure for architectural automation.</p>
              </div>
              {[
                { head: "Product", links: [["How it works", "#how-it-works"], ["Features", "#features"], ["Export", "#features"]] },
                { head: "Account", links: [["Sign in", "/login"], ["Register", "/register"]] },
                { head: "Project", links: [["GitHub", "https://github.com/Syed-Imran227/AI-Architect"], ["IEEE Paper", "#"]] },
              ].map(col => (
                <div key={col.head}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: P.textMuted, marginBottom: 16 }}>{col.head}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {col.links.map(([label, href]) => {
                      const isRoute = href.startsWith("/");
                      return isRoute
                        ? <Link key={label} to={href} className="al-footer-link" style={{ color: P.text }}>{label}</Link>
                        : <a key={label} href={href} className="al-footer-link" style={{ color: P.text }} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{label}</a>;
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: P.textMuted }}>2026 AI Architect - Final Year Project, DSATM</span>
              <span style={{ fontSize: 12, color: P.textMuted }}>Powered by DeepSeek AI - MongoDB Atlas</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}