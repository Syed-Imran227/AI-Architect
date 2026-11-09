import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/store/AuthContext';
import type { GeneratePlansPayload, Floor } from '../../../shared/api-client/api';
import {
  getProjects,
  deleteProject,
  generatePlans,
  saveProject,
} from '../../../shared/api-client/api';

import StudioHeader from '../components/StudioHeader';
import StudioHeroOpening, { type ProjectSummary } from '../components/StudioHeroOpening';
import StudioContinueStrip from '../components/StudioContinueStrip';
import StudioProjectArchive from '../components/StudioProjectArchive';
import StudioFinancialSection from '../components/StudioFinancialSection';
import { MultiFloorWizardModal } from '../../editor/components/MultiFloorWizardModal';

// Code-split 3D massing preview to ensure Three.js is NEVER in the initial dashboard bundle
const Project3DPreviewModal = lazy(() => import('../components/Project3DPreviewModal'));

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  // Primary Data State
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Active section indicator
  const [activeSection, setActiveSection] = useState<'studio' | 'archive' | 'create' | 'finance'>('studio');

  // Modals & Dialogs
  const [projectPendingDelete, setProjectPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [preview3DProject, setPreview3DProject] = useState<ProjectSummary | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Fetch Projects from API (Real data only)
  const fetchProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        setProjects([]);
      }
    } catch (e: unknown) {
      console.error('Failed to fetch projects:', e);
      toast.error('Session expired or connection failed. Please log in again.');
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handle New Generation via Solver API
  const handleGenerate = async (payload: GeneratePlansPayload) => {
    setIsGenerating(true);
    const toastId = toast.loading('Synthesizing spatial constraints & partition boundaries...');

    try {
      const genResult = await generatePlans(payload);

      if (!genResult?.candidates || genResult.candidates.length === 0) {
        throw new Error('Spatial solver generated no valid candidates. Please check boundary dimensions.');
      }

      toast.loading('Committing architectural document to studio archive...', { id: toastId });
      const bestCandidate = genResult.candidates[0];
      const projectName = `${payload.width}×${payload.length}ft ${payload.bedrooms}BHK ${payload.entryDir}-facing Residence`;

      const savedProj = await saveProject({
        name: projectName,
        layout_data: {
          ...bestCandidate,
          form: {
            width: payload.width,
            length: payload.length,
            floors: payload.floors,
            entryDir: payload.entryDir,
            bedrooms: payload.bedrooms,
            bathrooms: payload.bathrooms,
            duplex: payload.duplex,
          },
        },
      });

      toast.success('Floor plan synthesized! Opening in 2D Drafting Studio...', { id: toastId });
      navigate(`/editor?project=${savedProj.id}&mode=2d`);
    } catch (err: unknown) {
      console.error('Generation synthesis failed:', err);
      const msg = err instanceof Error ? err.message : 'Generation failed. Check the backend server.';
      toast.error(msg, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  // Open Project in specific workspace mode
  const handleOpenProject = (id: string, mode: '2d' | '3d' | 'analysis' = '2d') => {
    if (mode === '3d') {
      const target = projects.find((p) => p.id === id);
      if (target) {
        setPreview3DProject(target);
        return;
      }
    }
    navigate(`/editor?project=${id}&mode=${mode}`);
  };

  // Delete project request
  const handleDeleteRequest = (id: string, name: string) => {
    setProjectPendingDelete({ id, name });
  };

  // Confirm delete project
  const handleConfirmDelete = async () => {
    if (!projectPendingDelete) return;
    setIsDeleting(true);

    try {
      await deleteProject(projectPendingDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectPendingDelete.id));
      toast.success(`Project "${projectPendingDelete.name}" deleted from archive`);
      setProjectPendingDelete(null);
    } catch (err: unknown) {
      console.error('Delete project failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to delete project.';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigate section helper
  const handleNavigateSection = (section: 'studio' | 'archive' | 'create' | 'finance') => {
    setActiveSection(section);
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  };

  // Most recent project for hero focal visual
  const mostRecentProject = projects.length > 0 ? projects[0] : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper-warm)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          APPLICATION SHELL HEADER
      ═══════════════════════════════════════════════════════════════════════ */}
      <StudioHeader
        user={user}
        onLogout={logout}
        onNewDesign={() => handleNavigateSection('create')}
        onOpenWizard={() => setIsWizardOpen(true)}
        activeSection={activeSection}
        onNavigateSection={handleNavigateSection}
      />

      {/* Main Content Landmark */}
      <main id="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* ═══════════════════════════════════════════════════════════════════
            ZONE 1: THE STUDIO OPENING (STAGE ZONE — DARK & CINEMATIC)
        ═══════════════════════════════════════════════════════════════════ */}
        <StudioHeroOpening
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          mostRecentProject={mostRecentProject}
          onOpenProject={(id) => handleOpenProject(id, '2d')}
          onOpenWizard={() => setIsWizardOpen(true)}
        />

        {/* ═══════════════════════════════════════════════════════════════════
            ZONE 2: THE STUDIO DESK (PAPER ZONE — WARM & TACTILE)
        ═══════════════════════════════════════════════════════════════════ */}
        {/* Continue Strip: Instant 1-click continuation for returning architects */}
        <StudioContinueStrip
          projects={projects}
          onOpenProject={(id) => handleOpenProject(id, '2d')}
        />

        {/* Curated Project Archive: Grid & List Modes, Filters, Real BOM Figures */}
        <StudioProjectArchive
          projects={projects}
          loading={loading}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteRequest}
          onPreview3D={(proj) => setPreview3DProject(proj)}
          onCreateTrigger={() => handleNavigateSection('create')}
        />

        {/* Financial Studio: Authoritative Cost Intelligence & Stacked Allocation Bar */}
        {projects.length > 0 && (
          <StudioFinancialSection
            projects={projects}
            onOpenProject={handleOpenProject}
          />
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          QUIET APP FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer
        role="contentinfo"
        style={{
          borderTop: '1px solid var(--border-color)',
          background: 'var(--paper-sheet)',
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.74rem',
          color: 'var(--ink-annotation)',
        }}
      >
        <div>AI ARCHITECT // PRECISION SPATIAL SYNTHESIZER</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>DATABASE: MONGODB</span>
          <span>·</span>
          <span>AUTH: JWT</span>
          <span>·</span>
          <span>BOM ENGINE V3</span>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════════
          LAZY-LOADED 3D VIEWPORT MODAL (Zero Three.js in initial bundle)
      ═══════════════════════════════════════════════════════════════════════ */}
      {preview3DProject && (
        <Suspense
          fallback={
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(3, 7, 18, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-oxide)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.84rem',
                zIndex: 1000,
              }}
            >
              INITIALIZING THREE.JS ARCHITECTURAL ENGINE...
            </div>
          }
        >
          <Project3DPreviewModal
            project={preview3DProject as any}
            onClose={() => setPreview3DProject(null)}
          />
        </Suspense>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ACCESSIBLE DELETE CONFIRMATION MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {projectPendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 19, 15, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setProjectPendingDelete(null);
            }
          }}
        >
          <div
            style={{
              background: 'var(--paper-sheet)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: 'var(--shadow-hover)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(220, 38, 38, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--error-text)',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <h3
                id="delete-dialog-title"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--ink-primary)',
                }}
              >
                Archive Design?
              </h3>
            </div>

            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                color: 'var(--ink-secondary)',
                margin: 0,
              }}
            >
              Are you sure you want to delete <strong style={{ color: 'var(--ink-primary)' }}>{projectPendingDelete.name}</strong>?
              This action permanently removes the stored floor plan geometry and associated bills of materials.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={() => setProjectPendingDelete(null)}
                disabled={isDeleting}
                style={{
                  background: 'var(--paper-warm)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--ink-primary)',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  minHeight: '38px',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  background: 'var(--error)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  minHeight: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Design'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          GUIDED ARCHITECTURAL WIZARD MODAL (Multi-floor & Typology Configurator)
      ═══════════════════════════════════════════════════════════════════════ */}
      {isWizardOpen && (
        <MultiFloorWizardModal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onGenerateSuccess={async (result) => {
            setIsWizardOpen(false);
            const toastId = toast.loading('Synthesizing & saving architectural project...');
            try {
              const bestCandidate = (result.candidates && result.candidates[0]) || result.candidate;
              const candLayout = ((bestCandidate as Record<string, unknown>)?.layout as Record<string, unknown>) || {};
              const floorsList = result.floors && result.floors.length > 0 ? result.floors : ((candLayout.floors as Floor[]) || []);
              const projectName = `${result.plotWidth || 30}×${result.plotHeight || 40}ft ${floorsList.length}-Floor ${result.entryDir || 'East'}-facing Residence`;

              const savedProj = await saveProject({
                name: projectName,
                layout_data: {
                  ...bestCandidate,
                  floors: floorsList,
                  form: {
                    width: result.plotWidth || 30,
                    length: result.plotHeight || 40,
                    floors: floorsList.length,
                    entryDir: result.entryDir || 'east',
                  },
                } as any,
              });
              toast.success(`Synthesized ${floorsList.length}-floor design! Opening...`, { id: toastId });
              navigate(`/editor?project=${savedProj.id}&mode=2d`);
            } catch (err) {
              console.error('Failed to save wizard project:', err);
              toast.success('Opening synthesized design in editor...', { id: toastId });
              navigate(`/editor?project=${result.projectId}&mode=2d`);
            }
          }}
          initialPlotWidth={30}
          initialPlotLength={40}
          initialEntryDir="east"
        />
      )}
    </div>
  );
}
