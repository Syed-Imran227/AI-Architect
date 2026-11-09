import { ArrowRight, Clock } from 'lucide-react';
import { StudioPlanPreviewSvg } from './StudioPlanPreviewSvg';
import type { ProjectSummary } from './StudioHeroOpening';

interface StudioContinueStripProps {
  projects: ProjectSummary[];
  onOpenProject: (id: string) => void;
}

export default function StudioContinueStrip({
  projects,
  onOpenProject,
}: StudioContinueStripProps) {
  if (!projects || projects.length === 0) {
    return null;
  }

  // Take up to 3 most recent projects
  const recentThree = projects.slice(0, 3);

  return (
    <section
      aria-label="Continue recent projects"
      style={{
        background: 'var(--paper-warm)',
        borderBottom: '1px solid var(--border-color)',
        padding: '24px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={13} color="var(--ink-annotation)" />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-secondary)',
              fontWeight: 600,
            }}
          >
            CONTINUE RECENT WORK
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {recentThree.map((project) => {
            const rooms = project.layout_data?.rooms || 
              (project.layout_data?.floors?.[0]?.rooms) || [];
            const area = rooms.reduce((sum: number, r: any) => sum + (r.width * r.height), 0);
            const floors = project.layout_data?.floors?.length || 
              project.layout_data?.form?.floors || 1;
            const pw = project.layout_data?.plot_width || project.layout_data?.form?.width || 30;
            const pl = project.layout_data?.plot_length || project.layout_data?.form?.length || 40;

            return (
              <div
                key={project.id}
                onClick={() => onOpenProject(project.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onOpenProject(project.id);
                  }
                }}
                style={{
                  background: 'var(--paper-sheet)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  cursor: 'pointer',
                  transition: 'transform var(--dur-fast) ease, box-shadow var(--dur-fast) ease, border-color var(--dur-fast) ease',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ink-secondary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                aria-label={`Continue editing ${project.name}`}
              >
                {/* Thumbnail Plan */}
                <div
                  style={{
                    width: '68px',
                    height: '52px',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <StudioPlanPreviewSvg
                    rooms={rooms}
                    floors={project.layout_data?.floors}
                    plotWidth={pw}
                    plotLength={pl}
                    projectName={project.name}
                    showControls={false}
                  />
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '0.98rem',
                      fontWeight: 600,
                      color: 'var(--ink-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {project.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: 'var(--ink-annotation)',
                      marginTop: '2px',
                    }}
                  >
                    <span className="tabular-nums">{pw}×{pl} ft</span> · <span className="tabular-nums">{area} sqft</span> · {floors}F
                  </div>
                </div>

                {/* Continue affordance */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--accent-oxide)',
                    flexShrink: 0,
                  }}
                >
                  <span>Continue</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
