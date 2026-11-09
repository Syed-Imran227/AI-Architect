import { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  LayoutGrid,
  List as ListIcon,
  Search,
  Trash2,
  Layers,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';
import type { ProjectSummary } from './StudioHeroOpening';
import { StudioPlanPreviewSvg } from './StudioPlanPreviewSvg';
import { calculateAuthoritativeBOM } from '../../editor/geometry/bomCalculator';

interface StudioProjectArchiveProps {
  projects: ProjectSummary[];
  loading: boolean;
  onOpenProject: (id: string, mode?: '2d' | '3d' | 'analysis') => void;
  onDeleteProject: (id: string, name: string) => void;
  onPreview3D?: (project: ProjectSummary) => void;
  onCreateTrigger: () => void;
}

export default function StudioProjectArchive({
  projects,
  loading,
  onOpenProject,
  onDeleteProject,
  onPreview3D,
  onCreateTrigger,
}: StudioProjectArchiveProps) {
  const prefersReducedMotion = useReducedMotion();

  // View Mode: persisted in localStorage, defaults to 'grid'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('studio_archive_view_mode');
      return saved === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('studio_archive_view_mode', mode);
    } catch {
      // ignore localStorage quota errors
    }
  };

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState<'all' | '1' | '2+'>('all');
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'within' | 'over'>('all');
  const [sortField, setSortField] = useState<'date' | 'name' | 'area' | 'cost'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Compute enriched metadata with authoritative BOM for each project
  const enrichedProjects = useMemo(() => {
    return projects.map((proj) => {
      const rooms = proj.layout_data?.rooms || 
        (proj.layout_data?.floors?.[0]?.rooms) || [];
      const totalArea = rooms.reduce((sum: number, r: any) => sum + (r.width * r.height), 0);
      const floorCount = proj.layout_data?.floors?.length || proj.layout_data?.form?.floors || 1;
      const pw = proj.layout_data?.plot_width || proj.layout_data?.form?.width || 30;
      const pl = proj.layout_data?.plot_length || proj.layout_data?.form?.length || 40;

      // Authoritative BOM computation (mirrors bom_engine.py)
      const bom = calculateAuthoritativeBOM(proj.layout_data);

      return {
        ...proj,
        rooms,
        totalArea,
        floorCount,
        plotWidth: pw,
        plotLength: pl,
        bom,
      };
    });
  }, [projects]);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    return enrichedProjects
      .filter((p) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchDim = `${p.plotWidth}x${p.plotLength}`.includes(q);
          if (!matchName && !matchDim) return false;
        }

        // Floor filter
        if (floorFilter === '1' && p.floorCount !== 1) return false;
        if (floorFilter === '2+' && p.floorCount < 2) return false;

        // Budget filter
        if (budgetFilter === 'within' && p.bom.budget?.is_over_budget) return false;
        if (budgetFilter === 'over' && !p.bom.budget?.is_over_budget) return false;

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'date') {
          diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } else if (sortField === 'name') {
          diff = a.name.localeCompare(b.name);
        } else if (sortField === 'area') {
          diff = b.totalArea - a.totalArea;
        } else if (sortField === 'cost') {
          diff = (b.bom.summary?.grand_total || 0) - (a.bom.summary?.grand_total || 0);
        }
        return sortOrder === 'desc' ? diff : -diff;
      });
  }, [enrichedProjects, searchQuery, floorFilter, budgetFilter, sortField, sortOrder]);

  return (
    <section
      id="archive"
      aria-labelledby="archive-heading"
      style={{
        background: 'var(--paper-warm)',
        borderBottom: '1px solid var(--border-color)',
        padding: '64px 24px 96px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        {/* Archive Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
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
              ARCHIVE
            </span>
            <h2
              id="archive-heading"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(1.8rem, 2.5vw, 2.4rem)',
                fontWeight: 500,
                color: 'var(--ink-primary)',
                margin: '4px 0 0 0',
              }}
            >
              Selected Designs{' '}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1rem',
                  color: 'var(--ink-annotation)',
                  fontWeight: 400,
                }}
              >
                ({projects.length})
              </span>
            </h2>
          </div>

          {/* Controls: Search, Filters, View Mode */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--paper-sheet)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 12px',
                width: '220px',
              }}
            >
              <Search size={14} color="var(--ink-annotation)" />
              <input
                type="text"
                placeholder="Search archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: '0.84rem',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ink-primary)',
                  width: '100%',
                }}
                aria-label="Search designs"
              />
            </div>

            {/* Floor filter chips */}
            <div
              style={{
                display: 'flex',
                background: 'var(--paper-sheet)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setFloorFilter('all')}
                style={{
                  background: floorFilter === 'all' ? '#252622' : 'transparent',
                  color: floorFilter === 'all' ? '#FFFFFF' : 'var(--ink-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFloorFilter('1')}
                style={{
                  background: floorFilter === '1' ? '#252622' : 'transparent',
                  color: floorFilter === '1' ? '#FFFFFF' : 'var(--ink-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                1 Floor
              </button>
              <button
                type="button"
                onClick={() => setFloorFilter('2+')}
                style={{
                  background: floorFilter === '2+' ? '#252622' : 'transparent',
                  color: floorFilter === '2+' ? '#FFFFFF' : 'var(--ink-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Multi-floor
              </button>
            </div>

            {/* Sort Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                style={{
                  background: 'var(--paper-sheet)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '0.74rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-secondary)',
                  cursor: 'pointer',
                }}
                aria-label="Sort designs by"
              >
                <option value="date">Sort: Date</option>
                <option value="name">Sort: Name</option>
                <option value="area">Sort: Area</option>
                <option value="cost">Sort: Cost</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{
                  background: 'var(--paper-sheet)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '5px',
                  cursor: 'pointer',
                  color: 'var(--ink-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                aria-label="Toggle sort order"
              >
                <ArrowUpDown size={13} />
              </button>
            </div>

            {/* Budget Filter */}
            <select
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value as any)}
              style={{
                background: 'var(--paper-sheet)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '0.74rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-secondary)',
                cursor: 'pointer',
              }}
              aria-label="Filter by budget status"
            >
              <option value="all">Budget: All</option>
              <option value="within">Within Target</option>
              <option value="over">Over Budget</option>
            </select>

            {/* List / Grid Toggle */}
            <div
              style={{
                display: 'flex',
                background: 'var(--paper-sheet)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '2px',
              }}
              role="radiogroup"
              aria-label="Archive view mode"
            >
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'grid'}
                onClick={() => handleViewModeChange('grid')}
                style={{
                  background: viewMode === 'grid' ? '#252622' : 'transparent',
                  color: viewMode === 'grid' ? '#FFFFFF' : 'var(--ink-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  minHeight: '32px',
                }}
                aria-label="Grid layout view"
              >
                <LayoutGrid size={13} />
                <span>Grid</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'list'}
                onClick={() => handleViewModeChange('list')}
                style={{
                  background: viewMode === 'list' ? '#252622' : 'transparent',
                  color: viewMode === 'list' ? '#FFFFFF' : 'var(--ink-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  minHeight: '32px',
                }}
                aria-label="List table view"
              >
                <ListIcon size={13} />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: '24px',
            }}
          >
            <div style={{ gridColumn: 'span 8', height: '340px' }} className="studio-skeleton" />
            <div style={{ gridColumn: 'span 4', height: '340px' }} className="studio-skeleton" />
            <div style={{ gridColumn: 'span 4', height: '260px' }} className="studio-skeleton" />
            <div style={{ gridColumn: 'span 4', height: '260px' }} className="studio-skeleton" />
            <div style={{ gridColumn: 'span 4', height: '260px' }} className="studio-skeleton" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProjects.length === 0 && (
          <div
            style={{
              padding: '64px 24px',
              textAlign: 'center',
              background: 'var(--paper-sheet)',
              border: '1px dashed var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Layers size={36} color="var(--ink-annotation)" style={{ opacity: 0.6 }} />
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.4rem',
                margin: 0,
                color: 'var(--ink-primary)',
              }}
            >
              No designs found
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9rem',
                color: 'var(--ink-secondary)',
                margin: 0,
                maxWidth: '420px',
              }}
            >
              {searchQuery ? 'Try clearing your search query or adjusting your filters.' : 'Your project archive is currently empty. Generate your first architectural layout to begin.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={onCreateTrigger}
                style={{
                  background: 'var(--accent-oxide)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  marginTop: '8px',
                }}
              >
                Create your first design →
              </button>
            )}
          </div>
        )}

        {/* Grid Mode View */}
        {!loading && filteredProjects.length > 0 && viewMode === 'grid' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: '28px',
            }}
            className="archive-grid"
          >
            {filteredProjects.map((project, index) => {
              const isFeatured = index === 0 && !searchQuery && floorFilter === 'all';
              const colSpan = isFeatured ? 'span 8' : 'span 4';
              const isTall = !isFeatured && (project.floorCount > 1 || project.plotLength > project.plotWidth * 1.3);
              const cardHeight = isFeatured ? '360px' : isTall ? '300px' : '240px';

              const createdYear = new Date(project.created_at).getFullYear();
              const grandTotal = project.bom.summary?.grand_total || 0;
              const isOverBudget = project.bom.budget?.is_over_budget;

              return (
                <motion.article
                  key={project.id}
                  initial={prefersReducedMotion || index >= 12 ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.48, delay: index < 12 ? index * 0.05 : 0 }}
                  style={{
                    gridColumn: colSpan,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative',
                  }}
                  className="archive-card"
                >
                  {/* Visual Plan / Image Container */}
                  <div
                    onClick={() => onOpenProject(project.id, '2d')}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open project: ${project.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onOpenProject(project.id, '2d');
                      }
                    }}
                    style={{
                      height: cardHeight,
                      borderRadius: '4px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)',
                      position: 'relative',
                      background: '#FAF8F2',
                      transition: 'transform var(--dur-slow) ease, box-shadow var(--dur-base) ease, border-color var(--dur-base) ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ink-secondary)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                  >
                    <StudioPlanPreviewSvg
                      rooms={project.rooms}
                      floors={project.layout_data?.floors}
                      plotWidth={project.plotWidth}
                      plotLength={project.plotLength}
                      projectName={project.name}
                      showControls={true}
                    />

                    {/* Featured or multi-floor pill */}
                    {isFeatured && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          background: 'rgba(37, 38, 34, 0.88)',
                          color: '#FFFFFF',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.66rem',
                          padding: '3px 8px',
                          borderRadius: '3px',
                          letterSpacing: '0.06em',
                        }}
                      >
                        FEATURED DESIGN
                      </div>
                    )}
                  </div>

                  {/* Editorial Meta & Title */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <h3
                        onClick={() => onOpenProject(project.id, '2d')}
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: isFeatured ? '1.35rem' : '1.1rem',
                          fontWeight: 600,
                          color: 'var(--ink-primary)',
                          margin: 0,
                          cursor: 'pointer',
                        }}
                      >
                        {project.name}
                      </h3>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          color: 'var(--ink-annotation)',
                        }}
                      >
                        {createdYear}
                      </span>
                    </div>

                    {/* Technical Metadata Line */}
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.74rem',
                        color: 'var(--ink-secondary)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        alignItems: 'center',
                      }}
                    >
                      <span className="tabular-nums">{project.plotWidth}×{project.plotLength} ft</span>
                      <span>·</span>
                      <span className="tabular-nums">{project.floorCount} {project.floorCount > 1 ? 'Floors' : 'Floor'}</span>
                      <span>·</span>
                      <span className="tabular-nums">{project.totalArea} sqft</span>
                      {grandTotal > 0 && (
                        <>
                          <span>·</span>
                          <span className="tabular-nums">₹{grandTotal.toLocaleString()}</span>
                          {isOverBudget && (
                            <span title="Over target budget" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '2px' }}>
                              <AlertTriangle size={12} color="var(--error-text)" />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Link Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      paddingTop: '4px',
                      borderTop: '1px solid var(--border-subtle)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProject(project.id, '2d')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-oxide)',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      Open plan →
                    </button>

                    <button
                      type="button"
                      onClick={() => onPreview3D ? onPreview3D(project) : onOpenProject(project.id, '3d')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--ink-secondary)',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      3D Model
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenProject(project.id, 'analysis')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--ink-secondary)',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      Finance
                    </button>

                    {/* Delete action right-aligned */}
                    <button
                      type="button"
                      onClick={() => onDeleteProject(project.id, project.name)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--ink-annotation)',
                        marginLeft: 'auto',
                        padding: '4px',
                        cursor: 'pointer',
                      }}
                      title="Archive / Delete project"
                      aria-label={`Delete ${project.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {/* List Mode View (Dense Ledger) */}
        {!loading && filteredProjects.length > 0 && viewMode === 'list' && (
          <div
            style={{
              background: 'var(--paper-sheet)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 2.2fr 1.2fr 1fr 1fr 1.4fr 120px',
                padding: '12px 16px',
                background: 'rgba(37, 38, 34, 0.03)',
                borderBottom: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ink-annotation)',
                fontWeight: 600,
              }}
              className="list-header"
            >
              <div>#</div>
              <div>Project</div>
              <div>Plot Size</div>
              <div>Floors</div>
              <div>Area</div>
              <div>Estimate</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredProjects.map((project, idx) => {
                const grandTotal = project.bom.summary?.grand_total || 0;
                const isOverBudget = project.bom.budget?.is_over_budget;

                return (
                  <div
                    key={project.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 2.2fr 1.2fr 1fr 1fr 1.4fr 120px',
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      alignItems: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      color: 'var(--ink-primary)',
                      transition: 'background var(--dur-fast) ease',
                    }}
                    className="list-row"
                  >
                    <div style={{ color: 'var(--ink-annotation)' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '32px',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <StudioPlanPreviewSvg
                          rooms={project.rooms}
                          floors={project.layout_data?.floors}
                          plotWidth={project.plotWidth}
                          plotLength={project.plotLength}
                          projectName={project.name}
                          showControls={false}
                        />
                      </div>
                      <span
                        onClick={() => onOpenProject(project.id, '2d')}
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: 'var(--ink-primary)',
                        }}
                      >
                        {project.name}
                      </span>
                    </div>

                    <div className="tabular-nums">{project.plotWidth}×{project.plotLength} ft</div>
                    <div>{project.floorCount} Level{project.floorCount > 1 ? 's' : ''}</div>
                    <div className="tabular-nums">{project.totalArea} sqft</div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="tabular-nums">₹{grandTotal.toLocaleString()}</span>
                      {isOverBudget && (
                        <span title="Over target budget" style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <AlertTriangle size={13} color="var(--error-text)" />
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => onOpenProject(project.id, '2d')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-oxide)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '0.8rem',
                        }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(project.id, project.name)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--ink-annotation)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        aria-label={`Delete ${project.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .archive-grid {
            grid-template-columns: repeat(6, 1fr) !important;
          }
          .archive-grid > article {
            grid-column: span 6 !important;
          }
        }
        @media (max-width: 768px) {
          .list-header, .list-row {
            grid-template-columns: 40px 1fr 1fr 80px !important;
          }
        }
      `}</style>
    </section>
  );
}
