import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  Sparkles,
  Maximize2,
  Check
} from 'lucide-react';
import AtelierSignatureSequence from '../components/artwork/AtelierSignatureSequence';
import ConceptSketchArtwork from '../components/artwork/ConceptSketchArtwork';
import MeasuredPlanArtwork from '../components/artwork/MeasuredPlanArtwork';
import ExplodedAxoArtwork from '../components/artwork/ExplodedAxoArtwork';
import BuildingSectionArtwork from '../components/artwork/BuildingSectionArtwork';

export default function Landing() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--paper-warm)',
      color: 'var(--ink-primary)',
      fontFamily: 'var(--font-sans)',
      overflowX: 'hidden'
    }}>
      {/* ═══════════════════════════════════════════════════════════════════════
          QUIET EDITORIAL NAVIGATION BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <header style={{
        padding: '1.25rem 0',
        borderBottom: '1px solid var(--paper-border)',
        background: 'rgba(243, 240, 231, 0.95)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '0 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Brand Mark */}
          <Link to="/" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', textDecoration: 'none' }}>
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--ink-primary)',
              letterSpacing: '-0.02em'
            }}>
              AI Architect
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--ink-annotation)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}>
              ATELIER
            </span>
          </Link>

          {/* Nav Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', fontSize: '0.88rem', fontWeight: 500 }}>
            <a href="#site" style={{ color: 'var(--ink-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>
              01 Site & Requirements
            </a>
            <a href="#plan" style={{ color: 'var(--ink-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>
              02 Spatial Plan
            </a>
            <a href="#vertical" style={{ color: 'var(--ink-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>
              03 Vertical Massing
            </a>
            <a href="#intelligence" style={{ color: 'var(--ink-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>
              04 Computational Engine
            </a>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
              <Link to="/login" style={{
                color: 'var(--ink-secondary)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.88rem'
              }}>
                Sign In
              </Link>

              <Link to="/register" className="atelier-btn-primary" style={{ textDecoration: 'none' }}>
                Open Atelier <ArrowRight size={14} style={{ marginLeft: '6px' }} />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main>
        {/* ═══════════════════════════════════════════════════════════════════════
            THE OPENING VIEWPORT: EDITORIAL ASYMMETRIC HERO
        ═══════════════════════════════════════════════════════════════════════ */}
        <section style={{
          padding: '4rem 0 5rem 0',
          borderBottom: '1px solid var(--paper-border)'
        }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '4rem', alignItems: 'center' }}>
              
              {/* Left Column: Expressive Headline & Narrative */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-vermilion)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-annotation)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    VOLUMETRIC FLOOR PLAN SYNTHESIS
                  </span>
                </div>

                <h1 style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '4.2rem',
                  fontWeight: 500,
                  lineHeight: 1.05,
                  letterSpacing: '-0.035em',
                  color: 'var(--ink-primary)',
                  marginBottom: '1.5rem'
                }}>
                  Every place begins with a line.
                </h1>

                <p style={{
                  fontSize: '1.15rem',
                  color: 'var(--ink-primary)',
                  fontWeight: 500,
                  lineHeight: 1.7,
                  marginBottom: '2.5rem',
                  maxWidth: '520px'
                }}>
                  Turn plot dimensions, spatial programs, and building constraints into a living architectural floor plan. Explored in 2D and 3D, refined with conversational intelligence, and exported directly to AutoCAD.
                </p>

                {/* Primary & Secondary Actions */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '3.5rem', flexWrap: 'wrap' }}>
                  <Link to="/register" className="atelier-btn-primary" style={{ padding: '12px 28px', fontSize: '1rem', textDecoration: 'none' }}>
                    Create Your Floor Plan <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                  </Link>

                  <a href="#site" className="atelier-btn-secondary" style={{ padding: '12px 24px', fontSize: '1rem', textDecoration: 'none' }}>
                    Explore the Atelier
                  </a>
                </div>

                {/* Architectural Specifications Strip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1.5rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid var(--paper-border)'
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--ink-primary)' }}>1:50</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-annotation)' }}>CAD SCALE ACCURACY</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--accent-vermilion)' }}>NBC '16</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-annotation)' }}>SETBACK VALIDATION</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--success)' }}>Vastu</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-annotation)' }}>SOLAR HARMONY</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Original 5-Act Interactive Artwork Showcase */}
              <div>
                <AtelierSignatureSequence />
              </div>

            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 01: THE SITE (PLOT, ORIENTATION & REQUIREMENTS)
        ═══════════════════════════════════════════════════════════════════════ */}
        <section id="site" style={{
          padding: '6rem 0',
          borderBottom: '1px solid var(--paper-border)',
          background: 'var(--paper-sheet)'
        }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '4rem', alignItems: 'center' }}>
              <div>
                <ConceptSketchArtwork isAnimated={false} />
              </div>

              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent-vermilion)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '8px' }}>
                  SECTION 01 // THE SITE
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2.8rem', color: 'var(--ink-primary)', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                  Grounding the idea in physical constraints.
                </h2>
                <p style={{ fontSize: '1.05rem', color: 'var(--ink-secondary)', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                  Every building begins with a plot boundary, an orientation to the sun, and a set of living requirements. AI Architect takes your width, depth, setbacks, and room schedule—translating them into a mathematically non-overlapping spatial partition.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    'Parametric plot bounds from 20×30 ft urban plots to expansive estates',
                    'National Building Code (NBC 2016) front, rear, and side setback verification',
                    'Orientation-aware solar daylight paths across all four cardinal quadrants'
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem', color: 'var(--ink-secondary)' }}>
                      <span style={{ color: 'var(--accent-vermilion)', marginTop: '2px' }}><Check size={16} /></span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 02: THE PLAN (ROOM RELATIONSHIPS & SPATIAL GEOMETRY)
        ═══════════════════════════════════════════════════════════════════════ */}
        <section id="plan" style={{
          padding: '6rem 0',
          borderBottom: '1px solid var(--paper-border)',
          background: 'var(--paper-warm)'
        }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '4rem', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent-cobalt)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '8px' }}>
                  SECTION 02 // THE PLAN
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2.8rem', color: 'var(--ink-primary)', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                  Geometry with architectural purpose.
                </h2>
                <p style={{ fontSize: '1.05rem', color: 'var(--ink-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                  Rooms are not arbitrary boxes. Our deterministic geometry engine partitions space based on circulation clearances, aspect ratio standards, and functional adjacencies.
                </p>
                <p style={{ fontSize: '0.95rem', color: 'var(--ink-annotation)', lineHeight: 1.6, marginBottom: '2rem' }}>
                  Inspect walls, 90° door swing envelopes, triple-glazed window markers, and dimension strings rendered with the discipline of traditional blueprint sheets.
                </p>

                <Link to="/editor" className="atelier-btn-secondary" style={{ textDecoration: 'none' }}>
                  Try Drafting in Live Canvas →
                </Link>
              </div>

              <div>
                <div style={{ background: 'var(--paper-sheet)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--paper-border)', boxShadow: 'var(--shadow-elevated)' }}>
                  <MeasuredPlanArtwork isAnimated={false} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 03: THE VERTICAL IDEA (MULTI-FLOOR AXONOMETRIC)
        ═══════════════════════════════════════════════════════════════════════ */}
        <section id="vertical" style={{
          padding: '6rem 0',
          borderBottom: '1px solid var(--paper-border)',
          background: 'var(--paper-sheet)'
        }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem', alignItems: 'center' }}>
              <div>
                <ExplodedAxoArtwork isAnimated={false} />
              </div>

              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent-vermilion)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '8px' }}>
                  SECTION 03 // THE VERTICAL IDEA
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2.8rem', color: 'var(--ink-primary)', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                  Coordinated multi-floor stacking.
                </h2>
                <p style={{ fontSize: '1.05rem', color: 'var(--ink-secondary)', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                  Buildings exist in three dimensions. Ground floor stairwells align with upper floor stair voids with zero tolerance error. Duplex double-height voids are cross-hatched and protected across levels.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ borderLeft: '2px solid var(--accent-vermilion)', paddingLeft: '14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink-primary)' }}>Vertical Circulation Alignment</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>Stair treads, risers, and structural load-bearing walls match continuously from foundation plinth to roof terrace.</div>
                  </div>
                  <div style={{ borderLeft: '2px solid var(--accent-cobalt)', paddingLeft: '14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink-primary)' }}>Duplex Voids & Mezzanines</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>Light wells and double-height living spaces are seamlessly synchronized between active floor plates.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 04: THE INTELLIGENCE (COMPUTATIONAL GEOMETRY & AI COPILOT)
        ═══════════════════════════════════════════════════════════════════════ */}
        <section id="intelligence" style={{
          padding: '6rem 0',
          borderBottom: '1px solid var(--paper-border)',
          background: 'var(--paper-warm)'
        }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent-vermilion)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '8px' }}>
                SECTION 04 // THE INTELLIGENCE
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '3rem', color: 'var(--ink-primary)', marginBottom: '1rem' }}>
                Engineering rigor over LLM hallucination.
              </h2>
              <p style={{ fontSize: '1.1rem', color: 'var(--ink-secondary)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
                Unlike generic models that draw distorted, unbuildable floor plan images, AI Architect pairs structured LLM tool-calling with deterministic computational geometry.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
              {/* Feature 1 */}
              <div className="atelier-card" style={{ padding: '2rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(54,95,168,0.1)', color: 'var(--accent-cobalt)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Maximize2 size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: 'var(--ink-primary)' }}>
                  Deterministic Polygon Partitioning
                </h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                  Shapely geometry solver guarantees non-overlapping room polygons, proper wall thickness offsets (9" exterior, 4.5" interior), and structural enclosure.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="atelier-card" style={{ padding: '2rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(216,87,64,0.1)', color: 'var(--accent-vermilion)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Sparkles size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: 'var(--ink-primary)' }}>
                  Conversational AI Copilot
                </h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                  Speak to the design in plain English: "Expand master bedroom by 2 feet" or "Add a 3-seater sofa". The agent calls verified tools without guessing coordinates.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="atelier-card" style={{ padding: '2rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(67,122,93,0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Compass size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: 'var(--ink-primary)' }}>
                  Vastu & Solar Scoring
                </h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                  Continuous evaluation against the 8 cardinal Vastu Shastra quadrants (Ishan, Agni, Nairutya, Vayu) and solar daylight hours calculated via PySolar.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 05: THE FINISHED DESIGN (SECTION CUTAWAY & EXPORT)
        ═══════════════════════════════════════════════════════════════════════ */}
        <section style={{
          padding: '6rem 0',
          borderBottom: '1px solid var(--paper-border)',
          background: 'var(--paper-sheet)'
        }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem', alignItems: 'center' }}>
              <div>
                <BuildingSectionArtwork isAnimated={false} />
              </div>

              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-annotation)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '8px' }}>
                  SECTION 05 // PRODUCTION DELIVERABLES
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2.8rem', color: 'var(--ink-primary)', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                  Ready for the construction site.
                </h2>
                <p style={{ fontSize: '1.05rem', color: 'var(--ink-secondary)', lineHeight: 1.7, marginBottom: '1.75rem' }}>
                  When the design is complete, export standard AutoCAD R2010 DXF files organized by professional CAD layers (A-WALL, A-DOOR, A-GLAZ, A-STAIR) and multi-page architectural PDF dossiers with complete Bill of Materials.
                </p>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Link to="/register" className="atelier-btn-primary" style={{ textDecoration: 'none' }}>
                    Start Your Project Now
                  </Link>
                  <Link to="/login" className="atelier-btn-secondary" style={{ textDecoration: 'none' }}>
                    Access Workspace
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════
            FINAL SECTION: START MAKING SOMETHING
        ═══════════════════════════════════════════════════════════════════════ */}
        <section style={{
          padding: '7rem 0',
          background: 'var(--paper-warm)',
          textAlign: 'center'
        }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 2rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: '3.6rem',
              fontWeight: 500,
              color: 'var(--ink-primary)',
              marginBottom: '1.25rem',
              lineHeight: 1.1
            }}>
              Begin your next design.
            </h2>
            <p style={{ fontSize: '1.15rem', color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '2.5rem' }}>
              Join architects, designers, and builders crafting high-precision floor plans in seconds.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link to="/register" className="atelier-btn-primary" style={{ padding: '14px 36px', fontSize: '1.05rem', textDecoration: 'none' }}>
                Launch Floor Plan Atelier <ArrowRight size={16} style={{ marginLeft: '8px' }} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          ARCHITECTURAL FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer style={{
        padding: '3rem 0',
        background: 'var(--paper-sheet)',
        borderTop: '1px solid var(--paper-border)',
        fontSize: '0.85rem',
        color: 'var(--ink-annotation)'
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '1.15rem', color: 'var(--ink-primary)', fontWeight: 600 }}>
              AI Architect
            </span>
            <span style={{ marginLeft: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
              // THE ARCHITECTURAL ATELIER
            </span>
          </div>
          <div style={{ display: 'flex', gap: '2rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            <span>AUTOCAD R2010 DXF</span>
            <span>NBC 2016 COMPLIANT</span>
            <span>REPORTLAB PDF DOSSIER</span>
          </div>
          <div>
            &copy; 2026 AI Architect. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
