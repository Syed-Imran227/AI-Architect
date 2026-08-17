import { useRef } from 'react';
import { Link } from 'react-router-dom';

import ThemeToggle from '../components/ThemeToggle';
import FloatingOrbs from '../components/FloatingOrbs';



export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const ctaGlowRef = useRef<HTMLDivElement>(null);

  const heroWords = "Design intelligent floor plans with Generative AI.".split(' ');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <FloatingOrbs />

      {/* Nav */}
      <header style={{ padding: '1.5rem 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10, background: 'var(--nav-bg)', borderBottom: '1px solid var(--nav-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.6rem', background: 'linear-gradient(135deg, var(--accent-color), #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>⬡</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>AI Architect</span>
        </div>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
            Log in
          </Link>
          <Link to="/register" style={{ background: 'var(--accent-gradient)', color: 'var(--text-primary)', padding: '0.6rem 1.5rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem', boxShadow: 'var(--accent-glow)' }}>
            Get Started
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      {/* Hero */}
      <main ref={heroRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6rem 2rem 4rem', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(138,255,196,0.1)', border: '1px solid rgba(138,255,196,0.2)', borderRadius: '20px', padding: '0.4rem 1rem', marginBottom: '2rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0070f3', display: 'inline-block' }} />
          Powered by DeepSeek AI · MongoDB Atlas
        </div>

        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)', lineHeight: 1.05, marginBottom: '1.5rem', maxWidth: '900px', fontWeight: 800, letterSpacing: '-0.03em' }}>
          {heroWords.map((word, i) => (
            <span key={i} className="hero-word" style={{ display: 'inline-block', marginRight: '0.3em', color: ['Generative', 'AI.'].includes(word) ? 'transparent' : 'var(--text-primary)', background: ['Generative', 'AI.'].includes(word) ? 'linear-gradient(135deg, var(--accent-color), #22d3ee)' : 'none', WebkitBackgroundClip: ['Generative', 'AI.'].includes(word) ? 'text' : 'unset', backgroundClip: ['Generative', 'AI.'].includes(word) ? 'text' : 'unset' }}>
              {word}
            </span>
          ))}
        </h1>

        <p className="hero-sub" style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '580px', lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Enter your constraints, enforce Vastu compliance, and instantly generate precision CAD-ready blueprints. Welcome to the future of architecture.
        </p>

        <div className="hero-cta" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div ref={ctaGlowRef} style={{ borderRadius: '10px' }}>
            <Link to="/register" style={{ background: 'linear-gradient(135deg, var(--accent-color), #22d3ee)', color: 'var(--text-primary)', padding: '1rem 2.5rem', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '1.05rem', display: 'inline-block', boxShadow: '0 8px 30px rgba(138,255,196,0.35)' }}>
              Start Designing Free →
            </Link>
          </div>
          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              const target = document.getElementById('features');
              if (target) {
                // Find the exact heading element to align it
                const heading = target.querySelector('h2');
                let topPos = target.offsetTop;
                if (heading) {
                  const rect = heading.getBoundingClientRect();
                  topPos = window.scrollY + rect.top;
                }

                // Subtract approximate sticky header height + breathing room (140px)
                topPos = topPos - 140;

                window.scrollTo({
                  top: topPos,
                  behavior: 'smooth'
                });
              }
            }}
            style={{ color: 'var(--text-secondary)', padding: '1rem 2rem', borderRadius: '10px', textDecoration: 'none', fontWeight: 500, fontSize: '1.05rem', border: '1px solid var(--glass-border)', backdropFilter: 'blur(8px)' }}
          >
            How it works ↓
          </a>
        </div>

        {/* Mock blueprint preview */}
        <div style={{ marginTop: '4rem', width: '100%', maxWidth: '900px', position: 'relative' }}>
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '2rem', backdropFilter: 'blur(8px)', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', width: '100%' }}>
              {[
                { name: 'Master Bedroom', dim: '14×12' },
                { name: 'Living Room', dim: '18×14' },
                { name: 'Kitchen', dim: '12×10' },
                { name: 'Bathroom', dim: '8×6' },
                { name: 'Balcony', dim: '10×5' },
                { name: 'Parking', dim: '12×10' }
              ].map((room, i) => (
                <div key={i} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', boxShadow: 'var(--glass-shadow)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{room.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{room.dim} ft</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'absolute', inset: -1, borderRadius: '20px', background: 'linear-gradient(180deg, transparent 60%, var(--bg-primary) 100%)', pointerEvents: 'none' }} />
        </div>
      </main>

      {/* Features */}
      <section id="features" style={{ padding: '8rem 2rem', position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '1rem' }}>Everything you need</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>From idea to AutoCAD in under 60 seconds.</p>
        </div>
        <div ref={featuresRef} style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {[
            { icon: '🤖', title: 'AI Layout Engine', desc: 'Powered by DeepSeek-V3, calculating mathematically precise room coordinates from your requirements.', color: '#0070f3' },
            { icon: '⛩️', title: 'Vastu Compliance', desc: 'Auto-aligns Master Bedroom (SW), Kitchen (SE), and Entry for perfect Vastu Shastra harmony.', color: '#7928ca' },
            { icon: '📐', title: 'AutoCAD Export', desc: 'One-click .DXF export ready to drop into AutoCAD. Your engineers will thank you.', color: '#00c896' },
            { icon: '🖱️', title: 'Drag & Drop Editor', desc: 'Click and drag rooms in the interactive SVG blueprint. Edits sync to the JSON in real-time.', color: '#f59e0b' },
            { icon: '☁️', title: 'Cloud Storage', desc: 'All designs saved to MongoDB Atlas. Access your projects from anywhere, on any device.', color: '#ef4444' },
            { icon: '🔒', title: 'JWT Authentication', desc: 'Secure user accounts with bcrypt password hashing and JWT tokens. Your data stays private.', color: '#10b981' },
          ].map((f, i) => (
            <div key={i} className="feature-card" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '2rem', backdropFilter: 'blur(12px)', transition: 'border-color 0.25s, transform 0.25s' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = f.color + '40';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--glass-border)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.5rem', color: f.color }}>{f.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section style={{ padding: '6rem 2rem', textAlign: 'center', position: 'relative', zIndex: 10, background: 'rgba(138,255,196,0.04)', borderTop: '1px solid rgba(138,255,196,0.1)', borderBottom: '1px solid rgba(138,255,196,0.1)' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '1rem' }}>Ready to build smarter?</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem' }}>Join architects, engineers, and students designing the future.</p>
        <Link to="/register" style={{ background: 'linear-gradient(135deg, var(--accent-color), #22d3ee)', color: 'var(--text-primary)', padding: '1.1rem 3rem', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem', boxShadow: '0 8px 30px rgba(0,112,243,0.35)', display: 'inline-block' }}>
          Create Free Account →
        </Link>
      </section>

      <footer style={{ padding: '2rem 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.9rem', position: 'relative', zIndex: 10 }}>
        <span>⬡ AI Architect · Final Year Project 2026</span>
        <span style={{ display: 'flex', gap: '1.5rem' }}>
          <Link to="/login" style={{ color: 'inherit', textDecoration: 'none' }}>Login</Link>
          <Link to="/register" style={{ color: 'inherit', textDecoration: 'none' }}>Register</Link>
        </span>
      </footer>
    </div>
  );
}
