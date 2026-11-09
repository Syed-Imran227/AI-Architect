import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { ProjectSummary } from './StudioHeroOpening';
import { calculateAuthoritativeBOM } from '../../editor/geometry/bomCalculator';

interface StudioFinancialSectionProps {
  projects: ProjectSummary[];
  onOpenProject: (id: string, mode?: '2d' | '3d' | 'analysis') => void;
}

export default function StudioFinancialSection({
  projects,
  onOpenProject,
}: StudioFinancialSectionProps) {
  // Selected project for detailed financial ledger; defaults to first project
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return projects[0]?.id || '';
  });

  // Keep selected project updated if projects change
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // Compute authoritative BOM for active project
  const bomResult = useMemo(() => {
    if (!activeProject) return null;
    return calculateAuthoritativeBOM(activeProject.layout_data);
  }, [activeProject]);

  if (!activeProject || !bomResult) {
    return null;
  }

  const grandTotal = bomResult.summary.grand_total || 0;
  const constructionTotal = bomResult.summary.construction_total || 0;
  const furnitureTotal = bomResult.summary.furniture_total || 0;
  const labourTotal = bomResult.summary.labour_total || 0;
  const budget = bomResult.budget;
  const hasTarget = budget && budget.target_budget > 0;
  const isOverBudget = budget?.is_over_budget;

  // Percentage calculations for stacked horizontal bar
  const constructionPct = grandTotal > 0 ? Math.round((constructionTotal / grandTotal) * 100) : 0;
  const furniturePct = grandTotal > 0 ? Math.round((furnitureTotal / grandTotal) * 100) : 0;
  const labourPct = grandTotal > 0 ? Math.round((labourTotal / grandTotal) * 100) : 0;

  const categories = bomResult.categories || {
    structural: 0,
    masonry_and_plaster: 0,
    flooring: 0,
    ceiling: 0,
    electrical: 0,
    plumbing: 0,
    painting: 0,
    doors_and_windows: 0,
    labour: 0,
    furniture: 0,
  };

  const lineItems = [
    { label: 'Structural RCC Framing & Slab', amount: categories.structural },
    { label: 'Masonry & Wall Plastering', amount: categories.masonry_and_plaster },
    { label: 'Floor Finishes & Tiling', amount: categories.flooring },
    { label: 'Ceilings & Soffits', amount: categories.ceiling },
    { label: 'Electrical Infrastructure', amount: categories.electrical },
    { label: 'Plumbing & Wet Services', amount: categories.plumbing },
    { label: 'Architectural Paint Finishes', amount: categories.painting },
    { label: 'Doors & Glazed Openings', amount: categories.doors_and_windows },
    { label: 'On-Site Construction Labour (30%)', amount: categories.labour },
    { label: 'Placed FF&E Catalog Furniture', amount: categories.furniture },
  ];

  return (
    <section
      id="finance"
      aria-labelledby="finance-heading"
      style={{
        background: 'var(--paper-sheet)',
        borderBottom: '1px solid var(--border-color)',
        padding: '72px 24px 96px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '36px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '20px',
          }}
        >
          <div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-annotation)',
                fontWeight: 600,
              }}
            >
              FINANCIAL STUDIO
            </span>
            <h2
              id="finance-heading"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
                fontWeight: 500,
                color: 'var(--ink-primary)',
                margin: '4px 0 0 0',
              }}
            >
              Bill of Materials & Cost Intelligence
            </h2>
          </div>

          {/* Project Selector dropdown if multi-project */}
          {projects.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label
                htmlFor="finance-project-select"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  color: 'var(--ink-annotation)',
                  textTransform: 'uppercase',
                }}
              >
                Project:
              </label>
              <select
                id="finance-project-select"
                value={activeProject.id}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  background: 'var(--paper-crisp)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.84rem',
                  color: 'var(--ink-primary)',
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Ledger Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: '32px',
          }}
          className="finance-grid"
        >
          {/* Left Column: Ledger Summary & Stacked Bar (Cols 1-7) */}
          <div
            style={{
              gridColumn: 'span 7',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
            className="finance-left"
          >
            {/* Primary Mono Grand Total */}
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-annotation)',
                }}
              >
                ESTIMATED REALIZATION COST · {activeProject.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
                  fontWeight: 600,
                  color: 'var(--ink-primary)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  marginTop: '6px',
                }}
                className="tabular-nums"
              >
                ₹{grandTotal.toLocaleString()}
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--ink-secondary)',
                  marginTop: '4px',
                }}
              >
                Rate: <span className="tabular-nums">₹{bomResult.summary.rate_per_sqft} / sqft</span> · Total Construction Area: <span className="tabular-nums">{bomResult.summary.total_area_sqft} sqft</span>
              </div>
            </div>

            {/* Horizontal Stacked Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  height: '14px',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  display: 'flex',
                  background: 'rgba(37, 38, 34, 0.08)',
                  width: '100%',
                }}
                role="progressbar"
                aria-label="Cost allocation breakdown"
                aria-valuenow={100}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  style={{
                    width: `${constructionPct}%`,
                    background: '#252622',
                    transition: 'width 0.48s ease',
                  }}
                  title={`Construction & Finishes: ${constructionPct}%`}
                />
                <div
                  style={{
                    width: `${labourPct}%`,
                    background: '#B89A64',
                    transition: 'width 0.48s ease',
                  }}
                  title={`Construction Labour: ${labourPct}%`}
                />
                <div
                  style={{
                    width: `${furniturePct}%`,
                    background: 'var(--accent-oxide)',
                    transition: 'width 0.48s ease',
                  }}
                  title={`FF&E Furniture: ${furniturePct}%`}
                />
              </div>

              {/* Stacked Bar Legend */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  color: 'var(--ink-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', background: '#252622', borderRadius: '1px' }} />
                  <span>Construction (₹{constructionTotal.toLocaleString()})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', background: '#B89A64', borderRadius: '1px' }} />
                  <span>Labour (₹{labourTotal.toLocaleString()})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', background: 'var(--accent-oxide)', borderRadius: '1px' }} />
                  <span>FF&E Furniture (₹{furnitureTotal.toLocaleString()})</span>
                </div>
              </div>
            </div>

            {/* Budget Status Alert Panel */}
            {hasTarget ? (
              <div
                role={isOverBudget ? 'alert' : 'status'}
                style={{
                  background: isOverBudget ? 'rgba(220, 38, 38, 0.06)' : 'rgba(46, 125, 50, 0.06)',
                  border: `1px solid ${isOverBudget ? 'rgba(220, 38, 38, 0.25)' : 'rgba(46, 125, 50, 0.25)'}`,
                  borderRadius: '6px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                {isOverBudget ? (
                  <AlertTriangle size={20} color="var(--error-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <CheckCircle2 size={20} color="var(--success-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: isOverBudget ? 'var(--error-text)' : 'var(--success-text)',
                    }}
                  >
                    {isOverBudget
                      ? `Target Budget Exceeded by ₹${budget.overrun_amount.toLocaleString()}`
                      : `Within Target Budget — ₹${budget.remaining_budget.toLocaleString()} Remaining`}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.76rem',
                      color: 'var(--ink-secondary)',
                    }}
                  >
                    Target: <span className="tabular-nums">₹{budget.target_budget.toLocaleString()}</span> · Consumed: <span className="tabular-nums">{budget.budget_consumed_pct}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--paper-warm)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '14px 16px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.84rem',
                  color: 'var(--ink-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={16} color="var(--ink-annotation)" />
                <span>No target budget specified. Configure target budget in the Financial Studio.</span>
              </div>
            )}

            {/* Link to Full Financial Studio in Editor */}
            <div>
              <button
                type="button"
                onClick={() => onOpenProject(activeProject.id, 'analysis')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: 'var(--ink-primary)',
                  cursor: 'pointer',
                  transition: 'background var(--dur-fast) ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-warm)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>Open detailed cost matrix in Financial Studio</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Right Column: Line Item Table (Cols 8-12) */}
          <div
            style={{
              gridColumn: 'span 5',
              background: 'var(--paper-warm)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
            className="finance-right"
          >
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(37, 38, 34, 0.03)',
                borderBottom: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ink-annotation)',
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Trade Category</span>
              <span>Subtotal</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lineItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderBottom: idx < lineItems.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    color: 'var(--ink-primary)',
                  }}
                >
                  <span style={{ color: 'var(--ink-secondary)' }}>{item.label}</span>
                  <span className="tabular-nums" style={{ fontWeight: 500 }}>
                    ₹{item.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .finance-grid {
            grid-template-columns: 1fr !important;
          }
          .finance-left, .finance-right {
            grid-column: 1 / -1 !important;
          }
        }
      `}</style>
    </section>
  );
}
