import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { generatePlans, exportDxf, exportReport, saveProject, updateProject, getProjectById } from '../../../shared/api-client/api';
import toast from 'react-hot-toast';
import type { Room, VastuResult, NbcResult, EnergyResult, SunlightResult, BomResult, LayoutData, LayoutUpdatePayload, Floor, FurnitureItem } from '../../../shared/api-client/api';
import InteractiveBlueprint from '../components/InteractiveBlueprint';
const FloorPlan3D = lazy(() => import('../components/FloorPlan3D'));
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { MultiFloorWizardModal } from '../components/MultiFloorWizardModal';
import { FurnitureCatalogDrawer } from '../components/FurnitureCatalogDrawer';
import type { FurnitureCatalogItem } from '../constants/furnitureCatalog';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/store/AuthContext';

import { AtelierWorkspaceHeader, type WorkspaceMode } from '../components/AtelierWorkspaceHeader';
import type { ThreeSceneBundle } from '../components/FloorPlan3D';
import {
  export3DSceneImage,
  export2DFloorPlanSVG,
  export2DFloorPlanPNG,
  exportArchitecturalPresentationSheet,
  type ExportResolutionPreset,
  calculateAuthoritativeBOM,
} from '../geometry';

import { ArchitecturalBriefWizard } from '../components/ArchitecturalBriefWizard';
import { ArchitecturalGenerationOverlay } from '../components/ArchitecturalGenerationOverlay';
import { RayonFloatingToolbar } from '../components/RayonFloatingToolbar';
import { ArchitecturalInspectorDrawer } from '../components/ArchitecturalInspectorDrawer';
import { ComparePlansStudio } from '../components/ComparePlansStudio';
import { AnalysisStudioView } from '../components/AnalysisStudioView';
import { Image as ImageIcon, X, SlidersHorizontal, Check } from 'lucide-react';
import { CommandEngine } from '../geometry/commandEngine';
import { migrateLegacyToCanonical, isCanonicalDocument } from '../geometry/migration';
import { validateCanonicalDocument } from '../geometry/validators';
import { canonicalToLegacyFloors } from '../geometry/selectors';
import {
  createUpdateRoomBoundsCommand,
  createPlaceItemCommand,
  createTransformItemCommand,
  createDeleteItemCommand,
  createUpdateItemDimensionsCommand,
  createApplyGeneratedPlanCommand,
  createApplyCopilotModificationCommand,
} from '../geometry/commands';
import type { Command, PlacedItem, CanonicalBuildingDocument } from '../geometry/types';
import { ftToM } from '../geometry/types';
import type { FurnitureAssetDefinition } from '../geometry/furnitureRegistry';

export type ValidationReportEntry = {
  severity?: string;
  room?: string;
  message?: string;
} | string;

export interface CandidateMetrics {
  hard_constraint_score?: number;
  coverage_score?: number;
  adjacency_score?: number;
  circulation_score?: number;
  usable_area_ratio?: number;
  usable_area_score?: number;
  compactness_score?: number;
  total_score?: number;
}

export interface Plan {
  id: string;
  variantId?: string;
  title?: string;
  tag?: string;
  badge?: string;
  rank?: number;
  hardConstraintsMet?: boolean;
  rejectionReasons?: string[];
  reasons?: string[];
  metrics?: CandidateMetrics;
  compositeScore?: number;
  imageUrl: string;
  layout: LayoutData & { error?: string; floors?: Floor[]; canonical_document?: CanonicalBuildingDocument };
  canonicalDocument?: CanonicalBuildingDocument;
  vastuScore: number;
  vastuResult?: VastuResult;
  nbcResult?: NbcResult;
  nbcScore?: number;
  energyResult?: EnergyResult;
  sunlightResult?: SunlightResult;
  bomResult?: BomResult;
  circulationWarnings?: string[];
  validationReport?: ValidationReportEntry[];
}

const INITIAL_FORM = {
  length: 40, width: 30, floors: 1,
  duplex: false, bedrooms: 2, bathrooms: 2,
  balcony: 0, terrace: false, lift: false,
  vastuToggle: true, entryDir: 'East',
};

export default function Editor() {
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [dxfLoading, setDxfLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [isExporting3D, setIsExporting3D] = useState(false);
  const [isExporting2D, setIsExporting2D] = useState(false);
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const svgElementRef = useRef<SVGSVGElement | null>(null);
  const threeBundleRef = useRef<ThreeSceneBundle | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [previewPlan, setPreviewPlan] = useState<Plan | null>(null);

  const previewValidation = useMemo(() => {
    if (!previewPlan) return null;
    try {
      const doc: CanonicalBuildingDocument = previewPlan.canonicalDocument ||
        (previewPlan.layout?.canonical_document
          ? (previewPlan.layout.canonical_document as CanonicalBuildingDocument)
          : migrateLegacyToCanonical(previewPlan.layout));
      return validateCanonicalDocument(doc);
    } catch {
      return null;
    }
  }, [previewPlan]);
  const [floors, setFloors] = useState<Floor[]>([]);

  const effectivePlan = previewPlan || activePlan;
  const currentLayout = effectivePlan?.layout as Record<string, unknown> | undefined;
  const effectiveFloors = useMemo(() => {
    if (previewPlan) {
      if (previewPlan.canonicalDocument && isCanonicalDocument(previewPlan.canonicalDocument)) {
        return canonicalToLegacyFloors(previewPlan.canonicalDocument);
      }
      if (isCanonicalDocument((previewPlan.layout as any)?.canonical)) {
        return canonicalToLegacyFloors((previewPlan.layout as any).canonical);
      }
      if (isCanonicalDocument((previewPlan.layout as any)?.canonical_document)) {
        return canonicalToLegacyFloors((previewPlan.layout as any).canonical_document);
      }
      const pLayout = previewPlan.layout as any;
      const nestedPLayout = (pLayout?.layout && typeof pLayout.layout === 'object') ? pLayout.layout : null;
      const pFloors = (Array.isArray(pLayout?.floors) && pLayout.floors.length > 0)
        ? pLayout.floors
        : (nestedPLayout && Array.isArray(nestedPLayout.floors) && nestedPLayout.floors.length > 0 ? nestedPLayout.floors : null);
      if (pFloors) {
        return pFloors;
      }
      if (pLayout?.rooms) {
        return [{ level: 'Ground Floor', rooms: pLayout.rooms }];
      }
    }
    return floors;
  }, [previewPlan, floors]);
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [projectName, setProjectName] = useState('2BHK East-facing 40×30ft Residence');

  // Modes & workspace layout
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('brief');
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [showConceptSketchModal, setShowConceptSketchModal] = useState(false);
  const [showCirculation, setShowCirculation] = useState(false);
  const [showSunlight, setShowSunlight] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showFurniture, setShowFurniture] = useState(true);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [isFurnitureDrawerOpen, setIsFurnitureDrawerOpen] = useState(false);
  const [selectedFurnitureItem, setSelectedFurnitureItem] = useState<FurnitureItem | null>(null);
  const [targetBudget, setTargetBudget] = useState<number>(0);

  // Undo / Redo history
  const [history, setHistory] = useState<Floor[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Authoritative Geometry Engine (Canonical Building Document)
  const commandEngineRef = useRef<CommandEngine | null>(null);
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);
  const [blueprintZoom, setBlueprintZoom] = useState(1.0);
  const [blueprintPan, setBlueprintPan] = useState({ x: 0, y: 0 });

  const activeFloorIndexRef = useRef(0);
  useEffect(() => {
    activeFloorIndexRef.current = activeFloorIndex;
    setSelectedRoomIndex(null);
    setSelectedFurnitureItem(null);
  }, [activeFloorIndex]);

  const pendingAutoSaveRef = useRef<boolean>(false);
  const requestAutoSave = useCallback(() => {
    pendingAutoSaveRef.current = true;
    setSaveStatus('unsaved');
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('wizard') === 'true') {
      setShowWizardModal(true);
    }
    const modeParam = params.get('mode') || params.get('tab');
    if (modeParam === '3d') {
      setActiveMode('3d');
    } else if (modeParam === 'analysis' || modeParam === 'financial' || modeParam === 'bom') {
      setActiveMode('analysis');
    }
  }, [location.search]);


  // Update default project name when form changes if user hasn't custom renamed it
  useEffect(() => {
    const bhk = formData.bedrooms;
    const dir = formData.entryDir.charAt(0).toUpperCase() + formData.entryDir.slice(1);
    const dup = formData.duplex ? 'Duplex ' : '';
    setProjectName(`${bhk}BHK ${dup}${dir}-facing ${formData.length}×${formData.width}ft Residence`);
  }, [formData.bedrooms, formData.duplex, formData.entryDir, formData.length, formData.width]);

  const openPlan = (plan: Plan) => {
    setActivePlan(plan);
    setPreviewPlan(null);

    const planLayout = plan.layout as Record<string, unknown> | undefined;
    const nestedPlanLayout = (planLayout?.layout && typeof planLayout.layout === 'object') ? (planLayout.layout as Record<string, unknown>) : null;
    const effectivePlanFloors = (Array.isArray(planLayout?.floors) && planLayout.floors.length > 0)
      ? (planLayout.floors as Floor[])
      : (nestedPlanLayout && Array.isArray(nestedPlanLayout.floors) ? (nestedPlanLayout.floors as Floor[]) : undefined);

    const resolvedPlanLayout = {
      ...(planLayout || {}),
      ...(nestedPlanLayout || {}),
      floors: effectivePlanFloors,
    };

    // Initialize authoritative CommandEngine with CanonicalBuildingDocument
    const canonicalDoc = isCanonicalDocument((plan.layout as any)?.canonical)
      ? (plan.layout as any).canonical
      : (isCanonicalDocument((plan.layout as any)?.canonical_document)
          ? (plan.layout as any).canonical_document
          : (isCanonicalDocument(plan.canonicalDocument)
              ? plan.canonicalDocument
              : migrateLegacyToCanonical(
                  resolvedPlanLayout || { floors: [] },
                  formData.width,
                  formData.length,
                  formData.entryDir as any
                )));

    let newFloors: Floor[] = [];
    if (canonicalDoc && Array.isArray(canonicalDoc.levels) && canonicalDoc.levels.length >= (effectivePlanFloors?.length || 0) && canonicalDoc.levels.length > 0) {
      newFloors = canonicalToLegacyFloors(canonicalDoc);
    } else if (effectivePlanFloors && effectivePlanFloors.length > 0) {
      newFloors = effectivePlanFloors;
    } else if (plan.layout?.floors && plan.layout.floors.length > 0) {
      newFloors = plan.layout.floors;
    } else if (canonicalDoc && Array.isArray(canonicalDoc.levels) && canonicalDoc.levels.length > 0) {
      newFloors = canonicalToLegacyFloors(canonicalDoc);
    } else if (plan.layout?.rooms) {
      newFloors = [{ level: 'Ground Floor', rooms: plan.layout.rooms }];
    }
    setFloors(newFloors);
    if (newFloors.length > 1) {
      setFormData(prev => ({
        ...prev,
        floors: newFloors.length,
      }));
    }
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode') || urlParams.get('tab');
    if (modeParam === '3d') {
      setActiveMode('3d');
    } else if (modeParam === 'analysis' || modeParam === 'financial' || modeParam === 'bom') {
      setActiveMode('analysis');
    } else {
      setActiveMode('2d');
    }

    commandEngineRef.current = new CommandEngine(canonicalDoc);
    setCanUndoState(commandEngineRef.current.canUndo());
    setCanRedoState(commandEngineRef.current.canRedo());

    // Reset history for new plan
    setHistory([newFloors]);
    setHistoryIndex(0);

    const planBudget = Number(
      (plan.layout as any)?.budget_target ||
      (plan.layout as any)?.target_budget ||
      plan.bomResult?.budget?.target_budget ||
      0
    );
    if (planBudget > 0) {
      setTargetBudget(planBudget);
    }
  };

  const loadSavedProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const project = await getProjectById(id);
      const loadedBudget = Number(
        project.budget_target ||
        (project.layout_data as any)?.budget_target ||
        (project.layout_data as any)?.target_budget ||
        0
      );
      if (loadedBudget > 0) {
        setTargetBudget(loadedBudget);
      }
      const rawLayoutData = (project.layout_data || {}) as Record<string, unknown>;
      const nestedLayout = (rawLayoutData.layout && typeof rawLayoutData.layout === 'object') ? (rawLayoutData.layout as Record<string, unknown>) : null;
      const unwrappedFloors = (Array.isArray(rawLayoutData.floors) && rawLayoutData.floors.length > 0)
        ? (rawLayoutData.floors as Floor[])
        : (nestedLayout && Array.isArray(nestedLayout.floors) ? (nestedLayout.floors as Floor[]) : undefined);

      const unwrappedLayout = {
        ...rawLayoutData,
        ...(nestedLayout || {}),
        floors: unwrappedFloors || (rawLayoutData.floors as Floor[]) || (nestedLayout?.floors as Floor[]),
      };

      const restoredPlan: Plan = {
        id: project.id,
        imageUrl: project.image_url || "",
        layout: unwrappedLayout as any,
        vastuScore: project.layout_data?.vastuScore ?? project.layout_data?.vastuResult?.score ?? 0,
        vastuResult: project.layout_data?.vastuResult,
        nbcResult: project.layout_data?.nbcResult,
        energyResult: project.layout_data?.energyResult,
        sunlightResult: project.layout_data?.sunlightResult,
        bomResult: project.layout_data?.bomResult,
      };
      if (project.name) {
        setProjectName(project.name);
      }
      if (project.layout_data?.form) {
        setFormData(project.layout_data.form);
      }

      const canonicalFromDb = isCanonicalDocument((project.layout_data as any)?.canonical)
        ? (project.layout_data as any).canonical
        : (isCanonicalDocument(project.layout_data) ? project.layout_data : null);
      if (canonicalFromDb) {
        commandEngineRef.current = new CommandEngine(canonicalFromDb);
        setCanUndoState(commandEngineRef.current.canUndo());
        setCanRedoState(commandEngineRef.current.canRedo());
      }

      setPlans([restoredPlan]);
      openPlan(restoredPlan);
      toast.success('Loaded saved project archive', { id: 'load-project' });
    } catch (e: unknown) {

      console.error(e);
      setGenError("Failed to load saved project.");
      toast.error("Failed to load saved project.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectId = params.get("project");
    if (projectId) {
      loadSavedProject(projectId);
    }
  }, [location.search, loadSavedProject]);

  const handlePreviewPlan = useCallback((plan: Plan) => {
    setPreviewPlan(plan);
    setActiveMode('2d');
    toast.success(`Previewing: ${plan.title || 'Option ' + plan.id.slice(0, 8)}`, { id: 'preview-toast' });
  }, []);

  const handleCancelPreview = useCallback(() => {
    setPreviewPlan(null);
    toast('Exited preview mode. Authoritative design active.', { id: 'cancel-preview' });
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setGenError(null);
    try {
      const res = await generatePlans(formData);
      if (res?.candidates?.length) {
        const newPlans = res.candidates as Plan[];
        setPlans(newPlans);
        // Newly generated plan immediately becomes the editable active plan
        openPlan(newPlans[0]);
        setPreviewPlan(null);
        setActiveMode('2d');
        requestAutoSave();
        toast.success(`Generated ${newPlans.length} candidates! ${newPlans[0].title || 'Candidate #1'} is active and ready for editing.`, { id: 'gen-success' });
      } else {
        throw new Error('No architectural layout candidates returned by solver.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setGenError(msg || 'Generation failed. Check the backend is running.');
      toast.error(msg || 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutUpdate = useCallback((data: LayoutUpdatePayload, imageUrl?: string, targetFloor: number = 0) => {
    if (previewPlan) {
      setActivePlan(previewPlan);
      setPreviewPlan(null);
    }

    const computeNewFloors = (prevFloors: Floor[]) => {
      let newFloors = [...prevFloors];

      if (data && data.full_layout?.floors?.length) {
        newFloors = data.full_layout.floors;
      } else {
        const updatedRooms = data.rooms ?? data.fixed_layout;
        if (!updatedRooms || !Array.isArray(updatedRooms) || updatedRooms.length === 0) {
          return prevFloors;
        }

        const targetIdx = targetFloor;
        if (newFloors[targetIdx]) {
          newFloors[targetIdx] = {
            ...newFloors[targetIdx],
            rooms: JSON.parse(JSON.stringify(updatedRooms)),
          };
        }
      }

      if (imageUrl && newFloors[activeFloorIndexRef.current]) {
        newFloors[activeFloorIndexRef.current] = {
          ...newFloors[activeFloorIndexRef.current],
          imageUrl,
        };
      }

      return newFloors;
    };

    setFloors(prev => {
      const updated = computeNewFloors(prev);
      // Push into undo history
      setHistory(h => [...h.slice(0, historyIndex + 1), updated]);
      setHistoryIndex(i => i + 1);
      return updated;
    });

    if ((data as any)?.budget_target !== undefined) {
      setTargetBudget(Number((data as any).budget_target));
    }

    setActivePlan(prevPlan => prevPlan ? {
      ...prevPlan,
      sunlightResult: data.new_sunlight_result || prevPlan.sunlightResult,
      energyResult: data.new_energy_result || prevPlan.energyResult,
      bomResult: data.new_bom_result || prevPlan.bomResult,
      layout: {
        ...prevPlan.layout,
        floors: computeNewFloors(prevPlan.layout?.floors || []),
        sunlightResult: data.new_sunlight_result || prevPlan.layout?.sunlightResult,
        energyResult: data.new_energy_result || prevPlan.layout?.energyResult,
        bomResult: data.new_bom_result || prevPlan.layout?.bomResult,
        ...(data as any)?.budget_target !== undefined ? { budget_target: (data as any).budget_target } : {},
      },
      ...(imageUrl ? { imageUrl } : {}),
      ...(data.new_energy_result ? { energyResult: data.new_energy_result } : {}),
      ...(data.new_sunlight_result ? { sunlightResult: data.new_sunlight_result } : {}),
      ...(data.new_bom_result ? { bomResult: data.new_bom_result } : {})
    } : prevPlan);

    requestAutoSave();
  }, [historyIndex, previewPlan, requestAutoSave]);


  const executeGeometryCommand = useCallback((cmd: Command): boolean => {
    if (previewPlan) {
      // Auto-promote previewPlan to activePlan so that any edit immediately mutates the design
      // and is visible on screen without state shadowing!
      const candidateDoc = isCanonicalDocument(previewPlan.canonicalDocument)
        ? previewPlan.canonicalDocument
        : (isCanonicalDocument((previewPlan.layout as any)?.canonical)
            ? (previewPlan.layout as any).canonical
            : (isCanonicalDocument((previewPlan.layout as any)?.canonical_document)
                ? (previewPlan.layout as any).canonical_document
                : migrateLegacyToCanonical(
                    previewPlan.layout || { floors: effectiveFloors },
                    formData.width,
                    formData.length,
                    formData.entryDir as any
                  )));
      commandEngineRef.current = new CommandEngine(candidateDoc);
      setActivePlan({
        ...previewPlan,
        layout: {
          ...previewPlan.layout,
          canonical: candidateDoc,
        } as any,
      });
      setPreviewPlan(null);
    } else if (!commandEngineRef.current) {
      const initialDoc = migrateLegacyToCanonical({
        plot_width: formData.width,
        plot_length: formData.length,
        entry_direction: formData.entryDir,
        floors,
      });
      commandEngineRef.current = new CommandEngine(initialDoc);
    }

    const res = commandEngineRef.current.execute(cmd);
    setCanUndoState(commandEngineRef.current.canUndo());
    setCanRedoState(commandEngineRef.current.canRedo());

    if (res.success && res.candidateDocument) {
      const projectedFloors = canonicalToLegacyFloors(res.candidateDocument);
      setFloors(projectedFloors);
      setActivePlan(prev => prev ? {
        ...prev,
        layout: {
          ...prev.layout,
          floors: projectedFloors,
          canonical: res.candidateDocument,
        }
      } : prev);
      toast.success(res.message, { id: 'geom-cmd' });
      requestAutoSave();
      return true;
    } else {
      toast.error(res.message || 'Geometry validation rejected this change', { id: 'geom-cmd' });
      return false;
    }
  }, [floors, formData, previewPlan, effectiveFloors, requestAutoSave]);

  const handleAcceptPlan = useCallback((planToAccept: Plan) => {
    const candidateDoc = isCanonicalDocument(planToAccept.canonicalDocument)
      ? planToAccept.canonicalDocument
      : (isCanonicalDocument((planToAccept.layout as any)?.canonical)
          ? (planToAccept.layout as any).canonical
          : (isCanonicalDocument((planToAccept.layout as any)?.canonical_document)
              ? (planToAccept.layout as any).canonical_document
              : migrateLegacyToCanonical(
                  planToAccept.layout || { floors: [] },
                  formData.width,
                  formData.length,
                  formData.entryDir as any
                )));

    const candidateFloors = canonicalToLegacyFloors(candidateDoc);

    // If command engine is ready, dispatch command so change is undoable
    if (commandEngineRef.current) {
      const ok = executeGeometryCommand(
        createApplyGeneratedPlanCommand(
          candidateDoc,
          `Apply Generated Layout: ${planToAccept.title || planToAccept.id}`
        )
      );
      if (!ok) {
        toast.error('Failed to apply candidate geometry.');
        return;
      }
    } else {
      commandEngineRef.current = new CommandEngine(candidateDoc);
      setCanUndoState(commandEngineRef.current.canUndo());
      setCanRedoState(commandEngineRef.current.canRedo());
    }

    setActivePlan({
      ...planToAccept,
      layout: {
        ...planToAccept.layout,
        floors: candidateFloors,
        canonical: candidateDoc,
      } as any
    });
    setFloors(candidateFloors);
    setPreviewPlan(null);
    setHistory(h => [...h.slice(0, historyIndex + 1), candidateFloors]);
    setHistoryIndex(i => i + 1);
    requestAutoSave();
    toast.success('Accepted architectural candidate! Press Ctrl+Z to undo anytime.', { id: 'accept-success' });
  }, [formData, executeGeometryCommand, historyIndex, requestAutoSave]);

  const handleRoomUpdate = useCallback((index: number, updated: Room) => {
    const cmd = createUpdateRoomBoundsCommand(
      activeFloorIndexRef.current,
      updated.name,
      { x: updated.x, y: updated.y, width: updated.width, height: updated.height }
    );
    const ok = executeGeometryCommand(cmd);
    if (!ok) {
      return;
    }
    setSelectedRoomIndex(index);
  }, [executeGeometryCommand]);

  // Undo / Redo with CommandEngine
  const handleUndo = useCallback(() => {
    if (commandEngineRef.current && commandEngineRef.current.canUndo()) {
      const res = commandEngineRef.current.undo();
      setCanUndoState(commandEngineRef.current.canUndo());
      setCanRedoState(commandEngineRef.current.canRedo());
      if (res.success && res.candidateDocument) {
        const projectedFloors = canonicalToLegacyFloors(res.candidateDocument);
        setFloors(projectedFloors);
        setActivePlan(prev => prev ? {
          ...prev,
          layout: {
            ...prev.layout,
            floors: projectedFloors,
            canonical: res.candidateDocument,
          }
        } : prev);
        toast.success(res.message, { id: 'geom-undo' });
        requestAutoSave();
        return;
      }
    }
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setFloors(history[newIndex]);
      requestAutoSave();
    }
  }, [historyIndex, history, requestAutoSave]);

  const handleRedo = useCallback(() => {
    if (commandEngineRef.current && commandEngineRef.current.canRedo()) {
      const res = commandEngineRef.current.redo();
      setCanUndoState(commandEngineRef.current.canUndo());
      setCanRedoState(commandEngineRef.current.canRedo());
      if (res.success && res.candidateDocument) {
        const projectedFloors = canonicalToLegacyFloors(res.candidateDocument);
        setFloors(projectedFloors);
        setActivePlan(prev => prev ? {
          ...prev,
          layout: {
            ...prev.layout,
            floors: projectedFloors,
            canonical: res.candidateDocument,
          }
        } : prev);
        toast.success(res.message, { id: 'geom-redo' });
        requestAutoSave();
        return;
      }
    }
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setFloors(history[newIndex]);
      requestAutoSave();
    }
  }, [historyIndex, history, requestAutoSave]);

  const handleVastuUpdate = useCallback((result: VastuResult, score: number) => {
    setActivePlan(prev => prev ? {
      ...prev,
      vastuResult: result,
      vastuScore: score
    } : prev);
  }, []);

  const handleNbcUpdate = useCallback((result: NbcResult, score: number) => {
    setActivePlan(prev => prev ? {
      ...prev,
      nbcResult: result,
      nbcScore: score
    } : prev);
  }, []);

  const handleAddCatalogItem = useCallback((catalogItem: FurnitureAssetDefinition | FurnitureCatalogItem) => {
    const curFloors = effectiveFloors.length > 0 ? effectiveFloors : floors;
    const curRooms = curFloors[activeFloorIndexRef.current]?.rooms || [];
    if (!curRooms.length) {
      toast.error('No rooms available on this floor to place furniture.');
      return;
    }

    const targetRoomIndex = selectedRoomIndex !== null && selectedRoomIndex < curRooms.length
      ? selectedRoomIndex
      : 0;
    const targetRoom = curRooms[targetRoomIndex];

    const dims = 'dimensions' in catalogItem && 'widthFt' in catalogItem.dimensions
      ? { width: catalogItem.dimensions.widthFt, depth: catalogItem.dimensions.depthFt, height: catalogItem.dimensions.heightFt }
      : (catalogItem as FurnitureCatalogItem).dimensions;

    const itemW = dims.width;
    const itemD = dims.depth;

    const minX = 0.5;
    const minY = 0.5;
    const maxX = Math.max(minX, targetRoom.width - itemW - 0.5);
    const maxY = Math.max(minY, targetRoom.height - itemD - 0.5);

    // Stagger slightly if furniture already exists in this room so items do not completely stack
    const existingCount = targetRoom.furniture?.length || 0;
    const staggerOffset = (existingCount % 4) * 0.75;
    const rawX = Math.max(minX, Math.min(maxX, (targetRoom.width - itemW) / 2 + (staggerOffset - 1.1)));
    const rawY = Math.max(minY, Math.min(maxY, (targetRoom.height - itemD) / 2 + (staggerOffset - 1.1)));

    const snappedX = Math.round(rawX * 2) / 2;
    const snappedY = Math.round(rawY * 2) / 2;
    const relX = Math.max(minX, Math.min(maxX, snappedX));
    const relY = Math.max(minY, Math.min(maxY, snappedY));

    const itemXM = ftToM(targetRoom.x + relX);
    const itemYM = ftToM(targetRoom.y + relY);
    const defaultElev = 'defaultElevationFt' in catalogItem ? (catalogItem.defaultElevationFt || 0) : (catalogItem.elevation || 0);

    const placedItem: PlacedItem = {
      id: `furn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      assetId: catalogItem.id,
      name: catalogItem.name,
      x: itemXM,
      y: itemYM,
      elevation: ftToM(defaultElev),
      rotation: 'defaultRotation' in catalogItem ? (catalogItem.defaultRotation || 0) : 0,
      width: ftToM(itemW),
      depth: ftToM(itemD),
      height: ftToM(dims.height || 2.5),
      color: catalogItem.defaultColor,
      isLight: catalogItem.category === 'Lighting Fixtures' || ('isLight' in catalogItem && Boolean((catalogItem as any).isLight)),
      properties: {
        category: catalogItem.category,
        roomId: targetRoom.name,
        lightProperties: catalogItem.lightProperties,
      },
    };

    const cmd = createPlaceItemCommand(activeFloorIndexRef.current, placedItem);
    const ok = executeGeometryCommand(cmd);
    if (ok) {
      setSelectedRoomIndex(targetRoomIndex);
      setSelectedFurnitureItem({
        id: placedItem.id,
        catalogId: catalogItem.id,
        name: catalogItem.name,
        x: relX,
        y: relY,
        width: itemW,
        height: itemD,
        rotation: placedItem.rotation,
        elevation: defaultElev,
        color: catalogItem.defaultColor,
        isLight: placedItem.isLight,
        lightProperties: catalogItem.lightProperties,
      });
      toast.success(`Placed ${catalogItem.name} in ${targetRoom.name}`);
    }
  }, [floors, effectiveFloors, selectedRoomIndex, executeGeometryCommand]);

  const handleUpdateFurniture = useCallback((updated: FurnitureItem) => {
    if (!commandEngineRef.current) return;
    const doc = commandEngineRef.current.getDocument();
    const lvl = doc.levels[activeFloorIndexRef.current];
    if (!lvl) return;
    const existing = lvl.items.find(i => i.id === updated.id);
    if (!existing) return;

    if (updated.rotation !== undefined && updated.rotation !== existing.rotation) {
      const cmd = createTransformItemCommand(
        activeFloorIndexRef.current,
        updated.id || '',
        existing.x,
        existing.y,
        updated.rotation
      );
      executeGeometryCommand(cmd);
    }
    if (
      Math.abs(ftToM(updated.width) - existing.width) > 0.01 ||
      Math.abs(ftToM(updated.height) - existing.depth) > 0.01
    ) {
      const cmd = createUpdateItemDimensionsCommand(
        activeFloorIndexRef.current,
        updated.id || '',
        ftToM(updated.width),
        ftToM(updated.height),
        existing.height
      );
      executeGeometryCommand(cmd);
    }
    setSelectedFurnitureItem(updated);
  }, [executeGeometryCommand]);

  const handleDeleteSelectedFurniture = useCallback(() => {
    if (!selectedFurnitureItem) return;
    const cmd = createDeleteItemCommand(activeFloorIndexRef.current, selectedFurnitureItem.id || '');
    const ok = executeGeometryCommand(cmd);
    if (ok) {
      toast.success(`Deleted ${selectedFurnitureItem.name}`);
      setSelectedFurnitureItem(null);
    }
  }, [selectedFurnitureItem, executeGeometryCommand]);

  const handleExportDxf = async () => {
    if (!activePlan || !floors.length) return;
    setDxfLoading(true);
    toast.loading('📐 Generating multi-floor CAD DXF…', { id: 'dxf-export' });
    try {
      const fullLayoutPayload = {
        floors,
        form: formData,
        plot_width: plotContext.plotWidth,
        plot_height: plotContext.plotHeight,
      };
      await exportDxf(
        fullLayoutPayload,
        activePlan.id,
        plotContext.plotWidth,
        plotContext.plotHeight
      );
      toast.success('✅ Multi-floor CAD DXF downloaded! Arranged with standard layers.', { id: 'dxf-export', duration: 5000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`DXF export failed: ${msg}`, { id: 'dxf-export' });
    } finally {
      setDxfLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (!activePlan || !floors.length) return;
    setReportLoading(true);
    toast.loading('📑 Compiling Architectural Blueprint Dossier PDF…', { id: 'report-gen' });
    try {
      const bhk = formData.bedrooms;
      const dir = formData.entryDir.charAt(0).toUpperCase() + formData.entryDir.slice(1);
      const dupTag = formData.duplex ? ' Duplex' : '';
      const meta = {
        name: projectName || `${bhk}BHK${dupTag} ${dir}-facing ${formData.length}×${formData.width}ft`,
        length: formData.length,
        width: formData.width,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        entry_dir: formData.entryDir,
        vastu: formData.vastuToggle,
        duplex: formData.duplex,
        tier: 'Architectural Specification',
      };
      const enrichedLayout = {
        ...activePlan.layout,
        floors,
        nbcResult: activePlan.nbcResult,
        energyResult: activePlan.energyResult,
        sunlightResult: activePlan.sunlightResult,
        bomResult: activePlan.bomResult,
        vastuScore: activePlan.vastuScore,
      };
      await exportReport(
        enrichedLayout,
        activePlan.vastuResult,
        activePlan.id,
        meta,
      );
      toast.success('✅ Architectural Blueprint Dossier PDF downloaded!', { id: 'report-gen' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`PDF Dossier failed: ${msg}`, { id: 'report-gen' });
    } finally {
      setReportLoading(false);
    }
  };

  const handleExport3D = async (resolution: ExportResolutionPreset = '1080p') => {
    if (!threeBundleRef.current) {
      if (activeMode !== '3d') {
        toast('Switching to 3D Viewport to render spatial perspective...', { icon: '🏛️' });
        setActiveMode('3d');
        setTimeout(() => {
          if (threeBundleRef.current) {
            handleExport3D(resolution);
          } else {
            toast.error('3D scene is initializing. Please click EXPORT again once loaded.');
          }
        }, 500);
        return;
      }
      toast.error('3D graphics engine not ready');
      return;
    }
    const { gl, scene, camera } = threeBundleRef.current;
    setIsExporting3D(true);
    const toastId = toast.loading(`Synthesizing ${resolution.toUpperCase()} architectural render...`);
    try {
      await export3DSceneImage(gl, scene, camera, resolution, projectName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Architectural_3D');
      toast.success(`✅ ${resolution.toUpperCase()} render saved successfully!`, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`3D export failed: ${msg}`, { id: toastId });
    } finally {
      setIsExporting3D(false);
    }
  };

  const handleExport2D = async (format: 'svg' | 'png') => {
    if (!svgElementRef.current) {
      if (activeMode !== '2d') {
        toast('Switching to 2D Drafting sheet to capture blueprint...', { icon: '📐' });
        setActiveMode('2d');
        setTimeout(() => {
          if (svgElementRef.current) {
            handleExport2D(format);
          } else {
            toast.error('2D drafting sheet is loading. Please try again.');
          }
        }, 300);
        return;
      }
      toast.error('2D blueprint canvas not found');
      return;
    }
    setIsExporting2D(true);
    const prefix = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'FloorPlan'}_Level0${activeFloorIndex + 1}`;
    try {
      if (format === 'svg') {
        export2DFloorPlanSVG(svgElementRef.current, prefix);
        toast.success('✅ 2D Vector Blueprint (.SVG) downloaded!');
      } else {
        const toastId = toast.loading('Rasterizing 2D high-res blueprint...');
        await export2DFloorPlanPNG(svgElementRef.current, prefix, 2);
        toast.success('✅ 2D High-Res Blueprint (.PNG) downloaded!', { id: toastId });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`2D export failed: ${msg}`);
    } finally {
      setIsExporting2D(false);
    }
  };

  const handleExportPresentationSheet = async () => {
    if (!threeBundleRef.current) {
      toast('Switching to 3D perspective to compose architectural presentation sheet...', { icon: '📋' });
      setActiveMode('3d');
      setTimeout(() => {
        if (threeBundleRef.current) {
          handleExportPresentationSheet();
        } else {
          toast.error('3D scene is initializing. Please click Export again once loaded.');
        }
      }, 600);
      return;
    }

    const { gl, scene, camera } = threeBundleRef.current;
    setIsExportingSheet(true);
    const toastId = toast.loading('Composing 2560×1440 Master Architectural Presentation Sheet…');
    try {
      const currentFloorRooms = floors[activeFloorIndex]?.rooms || [];
      const totalAreaSqFt = currentFloorRooms.reduce((acc, r) => acc + (r.width * r.height), 0);
      const floorName = floors[activeFloorIndex]?.name || `Level 0${activeFloorIndex + 1}`;

      await exportArchitecturalPresentationSheet(
        gl,
        scene,
        camera,
        svgElementRef.current,
        {
          projectName: projectName || 'Residential Atelier Design',
          floorName,
          floorIndex: activeFloorIndex,
          plotWidthFt: formData.width,
          plotHeightFt: formData.length,
          entryDir: formData.entryDir,
          totalRooms: currentFloorRooms.length,
          totalAreaSqFt,
          vastuScore: activePlan?.vastuScore,
          date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        },
        'Architectural_Presentation_Sheet'
      );
      toast.success('✅ Architectural Presentation Sheet (.PNG) downloaded!', { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Presentation Sheet failed: ${msg}`, { id: toastId });
    } finally {
      setIsExportingSheet(false);
    }
  };

  const handleAgentLayoutUpdate = useCallback((
    updatedLayout: LayoutData,
    imageUrl?: string | null,
    compliance?: {
      vastu?: VastuResult;
      nbc?: NbcResult;
      energy?: EnergyResult;
      sunlight?: SunlightResult;
      bom?: BomResult;
    }
  ) => {
    const currentFloorIdx = activeFloorIndexRef.current;
    const currentFloorRooms =
      updatedLayout.floors?.[currentFloorIdx]?.rooms ||
      updatedLayout.rooms ||
      [];

    handleLayoutUpdate(
      {
        full_layout: updatedLayout.floors ? { floors: updatedLayout.floors } : undefined,
        rooms: currentFloorRooms,
        new_sunlight_result: compliance?.sunlight,
        new_energy_result: compliance?.energy,
        new_bom_result: compliance?.bom,
      },
      imageUrl || undefined,
      currentFloorIdx
    );

    if (compliance?.vastu) {
      handleVastuUpdate(compliance.vastu, compliance.vastu.score);
    }
    if (compliance?.nbc) {
      handleNbcUpdate(compliance.nbc, compliance.nbc.score);
    }
    requestAutoSave();
  }, [handleLayoutUpdate, handleVastuUpdate, handleNbcUpdate, requestAutoSave]);

  const handlePreviewCopilotProposal = useCallback((candidateLayout: LayoutData) => {
    const candidateDoc = migrateLegacyToCanonical(
      candidateLayout.floors ? { floors: candidateLayout.floors } : candidateLayout,
      formData.width,
      formData.length,
      formData.entryDir as any
    );
    const candidateFloors = canonicalToLegacyFloors(candidateDoc);

    const previewCandidatePlan: Plan = {
      id: `copilot-preview-${Date.now()}`,
      title: 'AI Copilot Proposal Preview',
      imageUrl: activePlan?.imageUrl || '',
      layout: {
        floors: candidateFloors,
        canonical: candidateDoc,
      } as any,
      canonicalDocument: candidateDoc,
      vastuScore: activePlan?.vastuScore ?? 0,
    };

    handlePreviewPlan(previewCandidatePlan);
  }, [formData, handlePreviewPlan, activePlan?.vastuScore, activePlan?.imageUrl]);

  const handleCancelCopilotPreview = useCallback(() => {
    handleCancelPreview();
  }, [handleCancelPreview]);

  const handleApplyCopilotProposal = useCallback((
    candidateLayout: LayoutData,
    imageUrl?: string | null,
    compliance?: any,
    changeSummary?: any
  ) => {
    if (previewPlan) {
      setPreviewPlan(null);
    }

    const candidateDoc = migrateLegacyToCanonical(
      candidateLayout.floors ? { floors: candidateLayout.floors } : candidateLayout,
      formData.width,
      formData.length,
      formData.entryDir as any
    );

    const actionDescription = changeSummary?.details || changeSummary?.action || 'AI Copilot Modification';
    const cmd = createApplyCopilotModificationCommand(candidateDoc, actionDescription);

    const ok = executeGeometryCommand(cmd);
    if (ok) {
      if (imageUrl) {
        setActivePlan(prev => prev ? { ...prev, imageUrl } : prev);
      }
      if (compliance?.vastu) {
        handleVastuUpdate(compliance.vastu, compliance.vastu.score);
      }
      if (compliance?.nbc) {
        handleNbcUpdate(compliance.nbc, compliance.nbc.score);
      }
      requestAutoSave();
      toast.success(`✓ Applied: ${actionDescription}`, { id: 'copilot-applied' });
    } else {
      toast.error('Candidate geometry rejected by architectural validation rules.');
    }
  }, [previewPlan, formData, executeGeometryCommand, handleVastuUpdate, handleNbcUpdate, requestAutoSave]);

  // Global Keyboard Shortcuts (Undo/Redo, Zoom, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setBlueprintZoom(z => Math.min(3.5, +(z * 1.25).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setBlueprintZoom(z => Math.max(0.4, +(z / 1.25).toFixed(2)));
      } else if (e.key === '0') {
        e.preventDefault();
        setBlueprintZoom(1.0);
        setBlueprintPan({ x: 0, y: 0 });
      } else if (e.key === 'Escape') {
        setSelectedRoomIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const effectiveLayout = useMemo(() => ({
    ...(currentLayout || {}),
    floors: effectiveFloors,
    budget_target: targetBudget,
  }), [currentLayout, effectiveFloors, targetBudget]);

  const authoritativeBom = useMemo<BomResult | undefined>(() => {
    if (!effectiveFloors || effectiveFloors.length === 0) {
      return activePlan?.bomResult;
    }
    return calculateAuthoritativeBOM(
      { floors: effectiveFloors, budget_target: targetBudget },
      { tier: 'standard', targetBudget }
    );
  }, [effectiveFloors, targetBudget, activePlan?.bomResult]);

  // Auto-save effect (inhibited during preview to guarantee preview immutability)
  useEffect(() => {
    if (pendingAutoSaveRef.current && activePlan?.id && floors.length > 0 && !previewPlan) {
      pendingAutoSaveRef.current = false;
      setSaveStatus('saving');
      const doAutoSave = async () => {
        try {
          const canonicalDoc = commandEngineRef.current?.getDocument() || migrateLegacyToCanonical({
            floors,
            plot_width: formData.width,
            plot_length: formData.length,
            entry_direction: formData.entryDir,
          });

          const payload = {
            name: projectName,
            budget_target: targetBudget,
            layout_data: { 
              floors,
              canonical: canonicalDoc,
              form: formData,
              vastuScore: activePlan.vastuScore,
              vastuResult: activePlan.vastuResult,
              nbcResult: activePlan.nbcResult,
              energyResult: activePlan.energyResult,
              sunlightResult: activePlan.sunlightResult,
              bomResult: authoritativeBom || activePlan.bomResult,
              budget_target: targetBudget,
            },
            image_url: activePlan.imageUrl
          };

          const isDbId = /^[0-9a-f]{24}$/i.test(activePlan.id) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activePlan.id);
          if (isDbId) {
            await updateProject(activePlan.id, payload);
          } else {
            const created = await saveProject(payload);
            setActivePlan(prev => prev ? { ...prev, id: created.id } : prev);
          }
          setSaveStatus('saved');
        } catch (e) {
          console.error('Auto-save error:', e);
          setSaveStatus('unsaved');
        }
      };
      doAutoSave();
    }
  }, [activePlan, floors, formData, projectName, previewPlan, targetBudget, authoritativeBom]);


  const effectiveCanonicalDoc = useMemo<CanonicalBuildingDocument | undefined>(() => {
    if (previewPlan) {
      if (previewPlan.canonicalDocument && isCanonicalDocument(previewPlan.canonicalDocument)) {
        return previewPlan.canonicalDocument;
      }
      if (isCanonicalDocument((previewPlan.layout as any)?.canonical)) {
        return (previewPlan.layout as any).canonical;
      }
      if (isCanonicalDocument((previewPlan.layout as any)?.canonical_document)) {
        return (previewPlan.layout as any).canonical_document;
      }
      return migrateLegacyToCanonical(
        previewPlan.layout || { floors: effectiveFloors },
        formData.width,
        formData.length,
        formData.entryDir as any
      );
    }
    if (commandEngineRef.current) {
      return commandEngineRef.current.getDocument();
    }
    if (isCanonicalDocument((currentLayout as any)?.canonical)) {
      return (currentLayout as any).canonical;
    }
    return migrateLegacyToCanonical(
      currentLayout || { floors },
      formData.width,
      formData.length,
      formData.entryDir as any
    );
  }, [previewPlan, effectiveFloors, floors, currentLayout, formData.width, formData.length, formData.entryDir]);

  // Ensure activeFloorIndex is strictly clamped to available floors
  useEffect(() => {
    if (activeFloorIndex >= effectiveFloors.length && effectiveFloors.length > 0) {
      setActiveFloorIndex(Math.max(0, effectiveFloors.length - 1));
      setSelectedRoomIndex(null);
    }
  }, [effectiveFloors.length, activeFloorIndex]);

  const currentRooms = effectiveFloors[activeFloorIndex]?.rooms || [];
  const floorCirculation = effectiveFloors[activeFloorIndex]?.circulation ?? null;

  const plotContext = {
    plotWidth: formData.width,
    plotHeight: formData.length,
    entryDir: formData.entryDir,
    bedrooms: formData.bedrooms,
    bathrooms: formData.bathrooms,
    floors: formData.floors,
    balcony: formData.balcony,
    terrace: formData.terrace ? 1 : 0,
    lift: formData.lift ? 1 : 0,
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#FAF8F2',
      overflow: 'hidden',
      color: '#252622',
    }}>
      {/* ── Compact Architectural Workspace Header ── */}
      <AtelierWorkspaceHeader
        projectName={projectName}
        onProjectNameChange={setProjectName}
        plotWidth={formData.width}
        plotHeight={formData.length}
        entryDir={formData.entryDir}
        activeFloorName={effectiveFloors[activeFloorIndex]?.name || `Level 0${activeFloorIndex + 1}`}
        totalFloors={effectiveFloors.length || formData.floors}
        activeFloorIndex={activeFloorIndex}
        floorNames={effectiveFloors.map((f: Floor) => String(f.name || f.level || 'Level'))}
        onSelectFloor={idx => {
          setActiveFloorIndex(idx);
          setSelectedRoomIndex(null);
        }}
        vastuScore={effectivePlan?.vastuScore}
        saveStatus={saveStatus}
        activeMode={activeMode}
        onModeChange={setActiveMode}
        hasActivePlan={!!effectivePlan}
        alternativeCount={plans.length}
        onBack={() => navigate('/dashboard')}
        onGenerate={handleGenerate}
        isGenerating={loading}
        onExportDxf={handleExportDxf}
        isExportingDxf={dxfLoading}
        onExportPdf={handleExportReport}
        isExportingPdf={reportLoading}
        onExport3D={handleExport3D}
        isExporting3D={isExporting3D}
        onExport2D={handleExport2D}
        isExporting2D={isExporting2D}
        onExportPresentationSheet={handleExportPresentationSheet}
        isExportingPresentationSheet={isExportingSheet}
        canUndo={canUndoState || historyIndex > 0}
        canRedo={canRedoState || historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        isFurnitureDrawerOpen={isFurnitureDrawerOpen}
        onToggleFurnitureDrawer={() => setIsFurnitureDrawerOpen(prev => !prev)}
      />

      {/* ── Candidate Preview & Acceptance Sticky Banner ── */}
      {previewPlan && (
        <div
          id="candidate-preview-banner"
          style={{
            background: 'linear-gradient(90deg, #1E293B 0%, #0F172A 100%)',
            color: '#F8FAFC',
            padding: '0.55rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #3B82F6',
            zIndex: 40,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.74rem',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              padding: '3px 8px',
              borderRadius: '4px',
              background: '#3B82F6',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.66rem',
              letterSpacing: '0.04em',
            }}>
              PREVIEW MODE
            </span>
            <span style={{ fontWeight: 600, color: '#F1F5F9' }}>
              {previewPlan.title || 'Candidate Variant'}
            </span>
            <span style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Rank: <strong style={{ color: '#FFFFFF' }}>#{previewPlan.rank || 1}</strong></span>
              <span>·</span>
              <span style={{
                background: 'rgba(56, 189, 248, 0.18)',
                border: '1px solid #38BDF8',
                color: '#FFFFFF',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
              }}>
                Score: {previewPlan.compositeScore ?? previewPlan.vastuScore}/100
              </span>
            </span>
            <span style={{
              padding: '2px 7px',
              borderRadius: '10px',
              background: previewPlan.hardConstraintsMet !== false ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: previewPlan.hardConstraintsMet !== false ? '#4ADE80' : '#F87171',
              fontSize: '0.65rem',
              fontWeight: 600,
            }}>
              {previewPlan.hardConstraintsMet !== false ? '✓ CONSTRAINTS PASSED' : '⚠ VIOLATIONS'}
            </span>

            {/* Quick switcher among candidates */}
            {plans.length > 1 && (
              <div style={{ display: 'flex', gap: '5px', marginLeft: '6px' }}>
                {plans.map((p, i) => (
                  <button
                    key={p.id}
                    id={`preview-switch-${i}`}
                    onClick={() => handlePreviewPlan(p)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '3px',
                      border: p.id === previewPlan.id ? '1px solid #38BDF8' : '1px solid #475569',
                      background: p.id === previewPlan.id ? '#1E3A8A' : '#1E293B',
                      color: p.id === previewPlan.id ? '#FFFFFF' : '#94A3B8',
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Option 0{i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              id="cancel-preview-plan-btn"
              onClick={handleCancelPreview}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #475569',
                background: 'transparent',
                color: '#E2E8F0',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.72rem',
              }}
            >
              CANCEL PREVIEW
            </button>

            <button
              id="accept-preview-plan-btn"
              disabled={Boolean(previewValidation && !previewValidation.valid) || previewPlan.hardConstraintsMet === false}
              onClick={() => handleAcceptPlan(previewPlan)}
              style={{
                padding: '6px 16px',
                borderRadius: '4px',
                border: 'none',
                background: (previewValidation && !previewValidation.valid) || previewPlan.hardConstraintsMet === false ? '#475569' : '#16A34A',
                color: '#FFFFFF',
                cursor: (previewValidation && !previewValidation.valid) || previewPlan.hardConstraintsMet === false ? 'not-allowed' : 'pointer',
                opacity: (previewValidation && !previewValidation.valid) || previewPlan.hardConstraintsMet === false ? 0.6 : 1,
                fontWeight: 700,
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: (previewValidation && !previewValidation.valid) || previewPlan.hardConstraintsMet === false ? 'none' : '0 2px 8px rgba(22, 163, 74, 0.4)',
              }}
              title={previewValidation && !previewValidation.valid ? `Violations: ${previewValidation.issues.filter(i => i.severity === 'error').map(i => i.message).join('; ')}` : 'Accept and apply candidate layout'}
            >
              <Check size={13} />
              <span>ACCEPT CANDIDATE</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Workspace Body (Full Viewport Height) ── */}
      <main style={{
        flex: 1,
        height: previewPlan ? 'calc(100vh - 96px)' : 'calc(100vh - 54px)',
        position: 'relative',
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* MODE 1: ARCHITECTURAL BRIEF WIZARD */}
        {activeMode === 'brief' && (
          <ArchitecturalBriefWizard
            formData={formData}
            onChange={updated => setFormData(prev => ({ ...prev, ...updated }))}
            onGenerate={handleGenerate}
            isGenerating={loading}
            onOpenMultiFloorModal={() => setShowWizardModal(true)}
          />
        )}

        {/* MODE 2: 2D TECHNICAL DRAFTING CANVAS */}
        {activeMode === '2d' && (
          <div style={{ flex: 1, height: '100%', display: 'flex', position: 'relative', overflow: 'hidden' }}>
            {/* Left Micro-Toolbar (Collapsible Layers & Floors) */}
            <div style={{
              width: '48px',
              height: '100%',
              background: '#F3F0E7',
              borderRight: '1px solid #E7E1D5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 0',
              gap: '12px',
              zIndex: 20,
              flexShrink: 0,
            }}>
              {/* Concept Sketch Thumbnail Button */}
              <button
                onClick={() => setShowConceptSketchModal(true)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  border: '1px solid #E7E1D5',
                  background: '#FFFFFF',
                  color: '#252622',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="View Architectural Concept Sketch Study"
              >
                <ImageIcon size={16} />
              </button>

              <div style={{ width: '20px', height: '1px', background: '#E7E1D5' }} />

              {/* Inspector Toggle */}
              <button
                onClick={() => setIsInspectorOpen(prev => !prev)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  border: isInspectorOpen ? '1px solid #252622' : '1px solid #E7E1D5',
                  background: isInspectorOpen ? '#252622' : '#FFFFFF',
                  color: isInspectorOpen ? '#FAF8F2' : '#777970',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Toggle Contextual Inspector (Properties / Vastu / Copilot)"
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>

            {/* Central Drawing Canvas Area */}
            <div style={{
              flex: 1,
              height: '100%',
              position: 'relative',
              background: '#FAF8F2',
              overflow: 'hidden',
            }}>
              {currentRooms.length > 0 ? (
                <InteractiveBlueprint
                  rooms={currentRooms}
                  selectedRoom={selectedRoomIndex !== null ? currentRooms[selectedRoomIndex] : null}
                  onRoomSelect={(_room, idx) => {
                    setSelectedRoomIndex(idx);
                    setIsInspectorOpen(true);
                  }}
                  onRoomDrop={(updatedRooms, img) => handleLayoutUpdate({ rooms: updatedRooms }, img, activeFloorIndexRef.current)}
                  onGeometryCommand={executeGeometryCommand}
                  onSelectFurniture={setSelectedFurnitureItem}
                  zoom={blueprintZoom}
                  onZoomChange={setBlueprintZoom}
                  pan={blueprintPan}
                  onPanChange={setBlueprintPan}
                  circulation={floorCirculation}
                  showCirculation={showCirculation}
                  sunlightResult={activePlan?.sunlightResult}
                  showSunlight={showSunlight}
                  entryDir={plotContext.entryDir}
                  floorIndex={activeFloorIndex}
                  plotWidth={plotContext.plotWidth}
                  plotHeight={plotContext.plotHeight}
                  activeFloorIndex={activeFloorIndex}
                  totalFloors={effectiveFloors.length}
                  floorNames={effectiveFloors.map((f: Floor) => String(f.name || f.level || 'Level'))}
                  onSelectFloor={(idx) => {
                    setActiveFloorIndex(idx);
                    setSelectedRoomIndex(null);
                  }}
                  onRegisterSvgRef={(ref) => { svgElementRef.current = ref; }}
                  onSwitchTo3D={() => setActiveMode('3d')}
                />
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem',
                  padding: '2rem',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '3rem', color: '#D85740' }}>⬡</div>
                  <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '1.4rem', color: '#252622', margin: 0 }}>
                    Ready for Architectural Synthesis
                  </h3>
                  <p style={{ color: '#777970', maxWidth: '380px', margin: 0, fontSize: '0.86rem' }}>
                    Configure your plot boundaries and room requirements in the Brief, then click Generate to draft your 1:50 technical CAD sheet.
                  </p>
                  <button
                    onClick={() => setActiveMode('brief')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '5px',
                      border: 'none',
                      background: '#252622',
                      color: '#FAF8F2',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    OPEN ARCHITECTURAL BRIEF →
                  </button>
                </div>
              )}

              {/* Rayon Floating CAD Toolbar Dock */}
              {currentRooms.length > 0 && (
                <RayonFloatingToolbar
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                  showDimensions={showDimensions}
                  onToggleDimensions={() => setShowDimensions(v => !v)}
                  showFurniture={showFurniture}
                  onToggleFurniture={() => {
                    setShowFurniture(prev => !prev);
                    setIsFurnitureDrawerOpen(prev => !prev);
                  }}
                  showSunlight={showSunlight}
                  onToggleSunlight={() => setShowSunlight(v => !v)}
                  showCirculation={showCirculation}
                  onToggleCirculation={() => setShowCirculation(v => !v)}
                  onZoomIn={() => setBlueprintZoom(z => Math.min(3.5, +(z * 1.25).toFixed(2)))}
                  onZoomOut={() => setBlueprintZoom(z => Math.max(0.4, +(z / 1.25).toFixed(2)))}
                  onFitView={() => {
                    setBlueprintZoom(1.0);
                    setBlueprintPan({ x: 0, y: 0 });
                    toast.success('Sheet fitted to canvas view', { id: 'fit-info' });
                  }}
                  activeFloorIndex={activeFloorIndex}
                  totalFloors={effectiveFloors.length}
                  floorNames={effectiveFloors.map((f: Floor) => String(f.name || f.level || 'Level'))}
                  onSelectFloor={idx => {
                    setActiveFloorIndex(idx);
                    setSelectedRoomIndex(null);
                  }}
                />
              )}
            </div>

            {/* Contextual Collapsible Inspector Drawer */}
            <ArchitecturalInspectorDrawer
              isOpen={isInspectorOpen}
              onToggleOpen={() => setIsInspectorOpen(prev => !prev)}
              selectedRoom={selectedRoomIndex !== null ? currentRooms[selectedRoomIndex] : null}
              selectedRoomIndex={selectedRoomIndex}
              allRooms={currentRooms}
              plotContext={plotContext}
              onRoomUpdate={handleRoomUpdate}
              onLayoutUpdate={(data, img) => handleLayoutUpdate(data, img, activeFloorIndexRef.current)}
              onDeselectRoom={() => setSelectedRoomIndex(null)}
              onSelectRoom={(_r, idx) => {
                setSelectedFurnitureItem(null);
                setSelectedRoomIndex(idx);
                setIsInspectorOpen(true);
              }}
              selectedFurniture={selectedFurnitureItem}
              onUpdateFurniture={handleUpdateFurniture}
              onDeleteFurniture={handleDeleteSelectedFurniture}
              onDeselectFurniture={() => setSelectedFurnitureItem(null)}
              vastuScore={activePlan?.vastuScore ?? 0}
              vastuResult={activePlan?.vastuResult}
              nbcResult={activePlan?.nbcResult}
              energyResult={activePlan?.energyResult}
              sunlightResult={activePlan?.sunlightResult}
              bomResult={authoritativeBom || activePlan?.bomResult}
              layoutData={effectiveLayout}
              onVastuUpdate={handleVastuUpdate}
              onNbcUpdate={handleNbcUpdate}
              onAutoSaveRequest={requestAutoSave}
              activePlanId={activePlan?.id}
              activeFloorIndex={activeFloorIndex}
              activeFloorName={String(effectiveFloors[activeFloorIndex]?.name || effectiveFloors[activeFloorIndex]?.level || `Floor ${activeFloorIndex}`)}
              onAgentLayoutUpdate={handleAgentLayoutUpdate}
              onPreviewCopilotProposal={handlePreviewCopilotProposal}
              onCancelCopilotPreview={handleCancelCopilotPreview}
              onApplyCopilotProposal={handleApplyCopilotProposal}
              onUndoCopilot={handleUndo}
              canUndo={canUndoState}
              isPreviewingCopilot={Boolean(previewPlan && previewPlan.id.startsWith('copilot-preview-'))}
            />
          </div>
        )}

        {/* MODE 3: 3D BUILDING MASSING VIEWPORT */}
        {activeMode === '3d' && (
          <div style={{ flex: 1, height: '100%', position: 'relative', background: '#1B1D1C' }}>
            {currentRooms.length > 0 ? (
              <ErrorBoundary fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#D85740' }}>3D WebGL viewport encountered an error.</div>}>
                <Suspense
                  fallback={
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        minHeight: '560px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#15171A',
                        color: '#94a3b8',
                        fontFamily: "'JetBrains Mono', monospace",
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          border: '3px solid #334155',
                          borderTopColor: '#38bdf8',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', letterSpacing: '0.06em' }}>INITIALIZING 3D GRAPHICS PIPELINE...</span>
                    </div>
                  }
                >
                  <FloorPlan3D
                  rooms={currentRooms}
                  floors={effectiveFloors}
                  canonicalDoc={effectiveCanonicalDoc}
                  activeFloorIndex={activeFloorIndex}
                  entryDir={plotContext.entryDir}
                  plotWidth={plotContext.plotWidth}
                  plotHeight={plotContext.plotHeight}
                  selectedRoomName={selectedRoomIndex !== null && currentRooms[selectedRoomIndex] ? currentRooms[selectedRoomIndex].name : undefined}
                  onSelectRoom={(name) => {
                    if (!name) {
                      setSelectedRoomIndex(null);
                      return;
                    }
                    const idx = currentRooms.findIndex((r: Room) => r.name === name);
                    if (idx !== -1) {
                      setSelectedRoomIndex(idx);
                      setIsInspectorOpen(true);
                    }
                  }}
                  onSelectFloor={(idx) => {
                    setActiveFloorIndex(idx);
                    setSelectedRoomIndex(null);
                  }}
                  onRegisterThreeBundle={(bundle) => { threeBundleRef.current = bundle; }}
                  selectedFurnitureId={selectedFurnitureItem?.id}
                  onSelectFurniture={(id) => {
                    if (!id) {
                      setSelectedFurnitureItem(null);
                      return;
                    }
                    const allItems = effectiveFloors[activeFloorIndex]?.rooms?.flatMap((r: Room) => r.furniture || []) || [];
                    const found = allItems.find((f: FurnitureItem) => f.id === id);
                    if (found) {
                      setSelectedFurnitureItem(found);
                    }
                  }}
                />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777970' }}>
                <p>Generate a design layout first to view 3D massing.</p>
              </div>
            )}
          </div>
        )}

        {/* MODE 4: COMPLIANCE & PERFORMANCE STUDIO */}
        {activeMode === 'analysis' && (
          <AnalysisStudioView
            vastuScore={activePlan?.vastuScore ?? 0}
            vastuResult={activePlan?.vastuResult}
            nbcResult={activePlan?.nbcResult}
            energyResult={activePlan?.energyResult}
            sunlightResult={activePlan?.sunlightResult}
            bomResult={authoritativeBom || activePlan?.bomResult}
            layout={effectiveLayout}
            plotContext={plotContext}
            circulation={floorCirculation}
            onLayoutUpdate={handleLayoutUpdate}
            onVastuUpdate={handleVastuUpdate}
            onNbcUpdate={handleNbcUpdate}
            onAutoSaveRequest={requestAutoSave}
          />
        )}

        {/* MODE 5: DESIGN VARIANTS COMPARISON */}
        {activeMode === 'compare' && (
          <ComparePlansStudio
            plans={plans}
            activePlanId={activePlan?.id || ''}
            previewPlanId={previewPlan?.id || null}
            onPreviewPlan={handlePreviewPlan}
            onAcceptPlan={handleAcceptPlan}
            onSelectPlan={handlePreviewPlan}
            onGenerateAlternative={handleGenerate}
            isGenerating={loading}
            onExportDxf={handleExportDxf}
          />
        )}
      </main>

      {/* ── Cinematic Generation Overlay (The Signature House Construction) ── */}
      <ArchitecturalGenerationOverlay
        isVisible={loading}
        plotWidth={formData.width}
        plotHeight={formData.length}
        bedrooms={formData.bedrooms}
        floors={formData.floors}
        entryDir={formData.entryDir}
        error={genError}
        onRetry={handleGenerate}
      />

      {/* ── Concept Study Modal (PiP) ── */}
      {showConceptSketchModal && activePlan && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(37,38,34,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '680px',
            background: '#FAF8F2',
            borderRadius: '10px',
            border: '1px solid #E7E1D5',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '1.3rem', margin: 0, color: '#252622' }}>
                Architectural Concept Study Drawing
              </h3>
              <button
                onClick={() => setShowConceptSketchModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#777970' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              width: '100%',
              height: '360px',
              borderRadius: '6px',
              border: '1px solid #E7E1D5',
              background: '#FFFFFF',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={floors[activeFloorIndex]?.imageUrl || activePlan.imageUrl}
                alt="Concept Sketch"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-Floor Architecture Review Modal ── */}
      <MultiFloorWizardModal
        isOpen={showWizardModal}
        onClose={() => setShowWizardModal(false)}
        initialPlotWidth={formData.width}
        initialPlotLength={formData.length}
        initialEntryDir={formData.entryDir.toLowerCase()}
        onGenerateSuccess={({ floors: genFloors, candidates: genCandidates, candidate, plotWidth, plotHeight, entryDir }) => {
          setFormData(prev => ({
            ...prev,
            width: plotWidth,
            length: plotHeight,
            entryDir: entryDir.charAt(0).toUpperCase() + entryDir.slice(1),
            floors: genFloors.length,
          }));
          const allCands = (genCandidates && genCandidates.length > 0 ? genCandidates : [candidate]) as Plan[];
          setPlans(allCands);
          openPlan(allCands[0]);
          setPreviewPlan(null);
          setActiveMode('2d');
          requestAutoSave();
          setShowWizardModal(false);
          toast.success(`Generated ${allCands.length} multi-floor candidates! ${allCands[0].title || 'Candidate #1'} is active and ready for editing.`, { id: 'mf-gen' });
        }}
      />

      {/* ── Furniture & Lighting Catalog Studio Drawer ── */}
      <FurnitureCatalogDrawer
        isOpen={isFurnitureDrawerOpen}
        onClose={() => setIsFurnitureDrawerOpen(false)}
        onAddItem={handleAddCatalogItem}
        selectedRoomName={selectedRoomIndex !== null && currentRooms[selectedRoomIndex] ? currentRooms[selectedRoomIndex].name : (currentRooms[0]?.name || undefined)}
        activeFloorName={String(effectiveFloors[activeFloorIndex]?.name || effectiveFloors[activeFloorIndex]?.level || `Level ${activeFloorIndex + 1}`)}
      />
    </div>
  );
}
