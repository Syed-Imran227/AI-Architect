import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, SlidersHorizontal, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import type { GeneratePlansPayload } from '../../../shared/api-client/api';
import { StudioPlanPreviewSvg } from './StudioPlanPreviewSvg';

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
  budget_target?: number;
  layout_data: {
    rooms?: any[];
    floors?: any[];
    form?: any;
    plot_width?: number;
    plot_length?: number;
    plot_height?: number;
    budget_target?: number;
    target_budget?: number;
    bomResult?: any;
  };
  image_url?: string;
}

interface StudioHeroOpeningProps {
  onGenerate: (payload: GeneratePlansPayload) => Promise<void>;
  isGenerating: boolean;
  mostRecentProject: ProjectSummary | null;
  onOpenProject: (id: string) => void;
  onOpenWizard?: () => void;
}

const ORIENTATIONS = ['North', 'East', 'South', 'West'];

export default function StudioHeroOpening({
  onGenerate,
  isGenerating,
  mostRecentProject,
  onOpenProject,
  onOpenWizard,
}: StudioHeroOpeningProps) {
  const prefersReducedMotion = useReducedMotion();

  // Form State
  const [brief, setBrief] = useState('');
  const [plotWidth, setPlotWidth] = useState<number>(30);
  const [plotLength, setPlotLength] = useState<number>(40);
  const [orientation, setOrientation] = useState<string>('East');
  const [floors, setFloors] = useState<number>(1);
  const [bedrooms, setBedrooms] = useState<number>(2);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [vastuToggle, setVastuToggle] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (plotWidth < 15 || plotWidth > 150) {
      setFormError('Plot width must be between 15 and 150 feet.');
      return;
    }
    if (plotLength < 15 || plotLength > 150) {
      setFormError('Plot length must be between 15 and 150 feet.');
      return;
    }

    const payload: GeneratePlansPayload = {
      length: Number(plotLength),
      width: Number(plotWidth),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      floors: Number(floors),
      duplex: floors > 1,
      balcony: floors > 1 ? 1 : 0,
      terrace: floors > 1,
      lift: floors >= 3,
      vastuToggle: Boolean(vastuToggle),
      entryDir: orientation,
    };

    onGenerate(payload);
  };

  // Recent project metrics
  const recentRooms = mostRecentProject?.layout_data?.rooms || 
    (mostRecentProject?.layout_data?.floors?.[0]?.rooms) || [];
  const recentArea = recentRooms.reduce((sum: number, r: any) => sum + (r.width * r.height), 0);
  const recentFloors = mostRecentProject?.layout_data?.floors?.length || 
    mostRecentProject?.layout_data?.form?.floors || 1;
  const recentDate = mostRecentProject?.created_at ? 
    new Date(mostRecentProject.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <section
      id="studio"
      style={{
        background: 'var(--stage-bg)',
        color: 'var(--stage-text-primary)',
        borderBottom: '1px solid var(--stage-hairline)',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-labelledby="studio-heading"
    >
      {/* Subtle lighting falloff overlay */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '10%',
          width: '60vw',
          height: '60vh',
          background: 'radial-gradient(circle, rgba(200, 80, 30, 0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '48px 24px 64px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          columnGap: '32px',
          rowGap: '40px',
          alignItems: 'center',
          minHeight: 'min(68vh, 720px)',
        }}
        className="hero-grid-container"
      >
        {/* Left Column: Brief Input & Parameter Controls (Cols 1-7) */}
        <div
          style={{
            gridColumn: 'span 7',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            zIndex: 2,
          }}
          className="hero-left-column"
        >
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--accent-oxide)',
                fontWeight: 600,
              }}
            >
              01 / ARCHITECTURAL SYNTHESIS
            </span>
          </div>

          {/* Declarative Headline */}
          <motion.h1
            id="studio-heading"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.1rem, 3.8vw, 3.6rem)',
              lineHeight: 1.12,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              margin: 0,
              color: 'var(--stage-text-primary)',
            }}
          >
            Design a house. <br />
            <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--stage-text-secondary)' }}>
              Then walk through it.
            </span>
          </motion.h1>

          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '1rem',
              lineHeight: 1.5,
              color: 'var(--stage-text-secondary)',
              margin: 0,
              maxWidth: '560px',
            }}
          >
            Synthesize structurally valid floor plans with spatial circulation, Vastu compliance, and real-time construction bills of materials.
          </p>

          {/* Quick-Start Architectural Wizard & Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {onOpenWizard && (
                <button
                  type="button"
                  onClick={onOpenWizard}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, rgba(216, 87, 64, 0.28) 0%, rgba(245, 158, 11, 0.22) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    borderRadius: '24px',
                    padding: '8px 18px',
                    color: '#fed7aa',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(245, 158, 11, 0.2)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Sparkles size={15} color="#fbbf24" />
                  <span>✦ OPEN ARCHITECTURAL WIZARD</span>
                </button>
              )}
              <span style={{ fontSize: '0.74rem', color: 'var(--stage-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Guided spatial configuration & room program
              </span>
            </div>

            {/* Architectural Presets Bar */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--stage-text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                Typology:
              </span>
              {[
                { label: '30×40 East 2BHK', w: 30, l: 40, o: 'East', f: 1, b: 2 },
                { label: '30×50 North 3BHK', w: 30, l: 50, o: 'North', f: 2, b: 3 },
                { label: '40×60 Duplex Villa', w: 40, l: 60, o: 'East', f: 2, b: 4 },
                { label: '35×45 Vastu Courtyard', w: 35, l: 45, o: 'North', f: 2, b: 3 },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPlotWidth(p.w);
                    setPlotLength(p.l);
                    setOrientation(p.o);
                    setFloors(p.f);
                    setBedrooms(p.b);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--stage-hairline)',
                    borderRadius: '16px',
                    padding: '4px 10px',
                    color: 'var(--stage-text-secondary)',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Apply ${p.label} presets`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Brief Console */}
          <form
            id="create"
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'var(--stage-surface)',
              border: '1px solid var(--stage-hairline)',
              borderRadius: '8px',
              padding: '20px',
            }}
            aria-label="Floor plan generation parameters"
          >
            {/* Multi-line brief field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="design-brief"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--stage-text-muted)',
                }}
              >
                Design Brief or Typology (Optional)
              </label>
              <textarea
                id="design-brief"
                rows={2}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. Modern 3BHK East-facing residence with central double-height courtyard and master suite"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--stage-hairline)',
                  borderRadius: '4px',
                  color: 'var(--stage-text-primary)',
                  padding: '10px 12px',
                  fontSize: '0.92rem',
                  fontFamily: 'var(--font-sans)',
                  resize: 'none',
                }}
                disabled={isGenerating}
              />
            </div>

            {/* Parameter Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                alignItems: 'end',
              }}
            >
              {/* Plot Dimensions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="plot-width"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--stage-text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Width (ft)
                </label>
                <input
                  id="plot-width"
                  type="number"
                  min={15}
                  max={150}
                  value={plotWidth}
                  onChange={(e) => setPlotWidth(Number(e.target.value))}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--stage-hairline)',
                    color: 'var(--stage-text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    padding: '8px 10px',
                    borderRadius: '4px',
                  }}
                  disabled={isGenerating}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="plot-length"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--stage-text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Length (ft)
                </label>
                <input
                  id="plot-length"
                  type="number"
                  min={15}
                  max={150}
                  value={plotLength}
                  onChange={(e) => setPlotLength(Number(e.target.value))}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--stage-hairline)',
                    color: 'var(--stage-text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    padding: '8px 10px',
                    borderRadius: '4px',
                  }}
                  disabled={isGenerating}
                />
              </div>

              {/* Orientation Segmented Control */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--stage-text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Facing
                </span>
                <div
                  style={{
                    display: 'flex',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--stage-hairline)',
                    borderRadius: '4px',
                    padding: '2px',
                    height: '38px',
                  }}
                  role="radiogroup"
                  aria-label="Entry Orientation"
                >
                  {ORIENTATIONS.map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      role="radio"
                      aria-checked={orientation === dir}
                      onClick={() => setOrientation(dir)}
                      style={{
                        flex: 1,
                        background: orientation === dir ? 'var(--accent-oxide)' : 'transparent',
                        color: orientation === dir ? '#FFFFFF' : 'var(--stage-text-secondary)',
                        border: 'none',
                        borderRadius: '2px',
                        fontSize: '0.74rem',
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: orientation === dir ? 600 : 400,
                      }}
                      disabled={isGenerating}
                    >
                      {dir[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Floor Stepper */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--stage-text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Floors
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--stage-hairline)',
                    borderRadius: '4px',
                    height: '38px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFloors(Math.max(1, floors - 1))}
                    style={{
                      width: '32px',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--stage-text-primary)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                    disabled={isGenerating || floors <= 1}
                    aria-label="Decrease floors"
                  >
                    -
                  </button>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      color: 'var(--stage-text-primary)',
                    }}
                  >
                    {floors}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFloors(Math.min(4, floors + 1))}
                    style={{
                      width: '32px',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--stage-text-primary)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                    disabled={isGenerating || floors >= 4}
                    aria-label="Increase floors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Advanced Reveal */}
            {showAdvanced && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--stage-hairline)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="bedrooms-input"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: 'var(--stage-text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Bedrooms
                  </label>
                  <input
                    id="bedrooms-input"
                    type="number"
                    min={1}
                    max={6}
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--stage-hairline)',
                      color: 'var(--stage-text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.88rem',
                      padding: '8px 10px',
                      borderRadius: '4px',
                    }}
                    disabled={isGenerating}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="bathrooms-input"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: 'var(--stage-text-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Bathrooms
                  </label>
                  <input
                    id="bathrooms-input"
                    type="number"
                    min={1}
                    max={6}
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--stage-hairline)',
                      color: 'var(--stage-text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.88rem',
                      padding: '8px 10px',
                      borderRadius: '4px',
                    }}
                    disabled={isGenerating}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '18px' }}>
                  <input
                    type="checkbox"
                    id="vastu-check"
                    checked={vastuToggle}
                    onChange={(e) => setVastuToggle(e.target.checked)}
                    style={{ accentColor: 'var(--accent-oxide)', width: '16px', height: '16px' }}
                    disabled={isGenerating}
                  />
                  <label
                    htmlFor="vastu-check"
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.82rem',
                      color: 'var(--stage-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Vastu Shastra validation
                  </label>
                </div>
              </div>
            )}

            {/* Validation Error Message */}
            {formError && (
              <div
                role="alert"
                style={{
                  color: 'var(--error-text)',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-sans)',
                  background: 'rgba(220, 38, 38, 0.1)',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                }}
              >
                {formError}
              </div>
            )}

            {/* Submit Action Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--stage-text-muted)',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <SlidersHorizontal size={13} />
                <span>{showAdvanced ? 'Fewer options' : 'More options'}</span>
                {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {onOpenWizard && (
                  <button
                    type="button"
                    onClick={onOpenWizard}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#fed7aa',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: '6px',
                      padding: '10px 16px',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                      cursor: 'pointer',
                      minHeight: '44px',
                      transition: 'all 0.15s ease',
                    }}
                    title="Open Step-by-Step Architectural Wizard"
                  >
                    <Sparkles size={14} color="#f59e0b" />
                    <span>Open Wizard</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isGenerating}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: isGenerating ? 'var(--stage-hairline)' : 'var(--accent-oxide)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  minHeight: '44px',
                  boxShadow: isGenerating ? 'none' : '0 2px 8px rgba(200, 80, 30, 0.3)',
                  transition: 'background var(--dur-fast) var(--ease-standard)',
                }}
                aria-busy={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span>Synthesizing spaces...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Generate design</span>
                  </>
                )}
              </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Focal Visual (Cols 8-12) */}
        <div
          style={{
            gridColumn: 'span 5',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
          className="hero-right-column"
        >
          <div
            style={{
              background: 'var(--stage-surface)',
              border: '1px solid var(--stage-hairline)',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
              aspectRatio: '4/3',
              position: 'relative',
            }}
          >
            {mostRecentProject ? (
              <div
                style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative' }}
                onClick={() => onOpenProject(mostRecentProject.id)}
                role="button"
                tabIndex={0}
                aria-label={`Open recent design: ${mostRecentProject.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onOpenProject(mostRecentProject.id);
                  }
                }}
              >
                <StudioPlanPreviewSvg
                  rooms={recentRooms}
                  floors={mostRecentProject.layout_data?.floors}
                  plotWidth={mostRecentProject.layout_data?.plot_width || mostRecentProject.layout_data?.form?.width || 30}
                  plotLength={mostRecentProject.layout_data?.plot_length || mostRecentProject.layout_data?.form?.length || 40}
                  projectName={mostRecentProject.name}
                  showControls={false}
                />

                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(11, 12, 13, 0.88)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--stage-hairline)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-oxide)',
                    letterSpacing: '0.04em',
                  }}
                >
                  RECENT DRAFT
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: '#0D0F12',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  color: 'var(--stage-text-muted)',
                  textAlign: 'center',
                  position: 'relative',
                }}
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 100 80"
                  style={{ position: 'absolute', opacity: 0.12 }}
                  aria-hidden="true"
                >
                  <line x1="10" y1="10" x2="90" y2="70" stroke="#38bdf8" strokeWidth="0.5" />
                  <line x1="90" y1="10" x2="10" y2="70" stroke="#38bdf8" strokeWidth="0.5" />
                  <rect x="25" y="15" width="50" height="50" fill="none" stroke="#38bdf8" strokeWidth="0.8" />
                </svg>
                <Layers size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--stage-text-secondary)',
                  }}
                >
                  Architectural Canvas
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.78rem',
                    color: 'var(--stage-text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Enter brief parameters on the left to begin your first floor plan layout.
                </span>
              </div>
            )}
          </div>

          {/* Focal Caption */}
          {mostRecentProject && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.76rem',
                color: 'var(--stage-text-secondary)',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--stage-text-primary)' }}>
                  {mostRecentProject.name}
                </span>
                <span>·</span>
                <span className="tabular-nums">{recentFloors} {recentFloors > 1 ? 'Floors' : 'Floor'}</span>
                <span>·</span>
                <span className="tabular-nums">{recentArea} sqft</span>
              </div>

              {recentDate && (
                <span style={{ color: 'var(--stage-text-muted)' }}>{recentDate}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 1024px) {
          .hero-grid-container {
            grid-template-columns: 1fr !important;
          }
          .hero-left-column {
            grid-column: 1 / -1 !important;
          }
          .hero-right-column {
            grid-column: 1 / -1 !important;
          }
        }
      `}</style>
    </section>
  );
}
