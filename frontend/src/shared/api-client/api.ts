import { isSupabaseAuth, supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";


export interface LightProperties {
  intensity: number;
  color: string;
  radius: number;
  type: 'point' | 'spot';
}

export interface FurnitureItem {
  id?: string;
  catalogId?: string;
  catalog_id?: string;
  category?: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  elevation?: number;
  color?: string;
  isLight?: boolean;
  lightProperties?: LightProperties;
}

interface DoorSpec {
  wall: 'top' | 'bottom' | 'left' | 'right';
  position: number;
  width: number;
}

export interface WindowSpec {
  wall: 'top' | 'bottom' | 'left' | 'right';
  position: number;
  width: number;
}

export interface Room {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  furniture?: FurnitureItem[];
  doors?: DoorSpec[];
  windows?: WindowSpec[];
  roomType?: string;
  isShaft?: boolean;
  isInteriorShaft?: boolean;
  isExteriorShaft?: boolean;
  isVoid?: boolean;
}

export interface VastuRule {
  rule: string;
  status: 'pass' | 'warn' | 'fail';
  points: number;
  max: number;
  detail: string;
}

export interface VastuResult {
  score: number;
  grade: string;
  rules: VastuRule[];
}

export interface VastuFixResult {
  status: string;
  before_score: number;
  after_score: number;
  new_vastu_result?: VastuResult;
  fixed_layout?: Room[];
  full_layout?: { floors: Floor[] };
  design_rationale?: string;
  converged?: boolean;
  message?: string;
  imageUrl?: string;
  new_energy_result?: EnergyResult;
  new_sunlight_result?: SunlightResult;
  new_bom_result?: BomResult;
}

export interface NbcFixResult {
  status: string;
  before_score: number;
  after_score: number;
  new_nbc_result?: NbcResult;
  fixed_layout?: Room[];
  full_layout?: { floors: Floor[] };
  design_rationale?: string;
  converged?: boolean;
  message?: string;
  imageUrl?: string;
  new_energy_result?: EnergyResult;
  new_sunlight_result?: SunlightResult;
  new_bom_result?: BomResult;
}

export interface NbcRule {
  rule: string;
  status: 'pass' | 'warn' | 'fail';
  points: number;
  max: number;
  detail: string;
}

export interface NbcResult {
  score: number;
  grade: string;
  rules: NbcRule[];
}

export interface EnergyRule {
  rule: string;
  status: 'pass' | 'warn' | 'fail';
  points: number;
  max: number;
  detail: string;
}

export interface EnergyResult {
  score: number;
  grade: string;
  rules: EnergyRule[];
}

export interface SunlightRule {
  rule: string;
  status: 'pass' | 'warn' | 'fail';
  points: number;
  max: number;
  detail: string;
}

export interface SunlightResult {
  score: number;
  grade: string;
  rules: SunlightRule[];
  insights: string[];
  windows_sunlight: Record<string, { direction: string; intensity: number }>;
}

export interface BomFurnitureItemDetail {
  id: string;
  catalog_id: string;
  name: string;
  unit_price: number | null;
  is_available: boolean;
}

export interface BomScheduleItem {
  catalog_id: string;
  name: string;
  quantity: number;
  unit_price: number | null;
  total_cost: number | null;
  is_price_available: boolean;
  is_available?: boolean;
}

export interface BomCategories {
  structural: number;
  masonry_and_plaster: number;
  flooring: number;
  ceiling: number;
  electrical: number;
  plumbing: number;
  painting: number;
  doors_and_windows: number;
  labour: number;
  furniture: number;
}

export interface BomBudgetSummary {
  target_budget: number;
  estimated_total: number;
  construction_total: number;
  furniture_total: number;
  remaining_budget: number;
  overrun_amount: number;
  budget_consumed_pct: number;
  is_over_budget: boolean;
  currency: string;
  currency_symbol: string;
}

export interface BomRoomCost {
  wall: number;
  flooring: number;
  ceiling: number;
  electrical: number;
  plumbing: number;
  painting: number;
  doors: number;
  windows: number;
  structure: number;
  material: number;
  labour: number;
  construction_total?: number;
  furniture?: number;
  total: number;
}

export interface BomRoom {
  name: string;
  area_sqft: number;
  wall_area_sqft: number;
  num_doors: number;
  num_windows: number;
  furniture_count?: number;
  furniture_items?: BomFurnitureItemDetail[];
  costs: BomRoomCost;
}

export interface BomSummary {
  total_area_sqft: number;
  material_total: number;
  labour_total: number;
  construction_total?: number;
  furniture_total?: number;
  grand_total: number;
  rate_per_sqft: number;
}

export interface BomResult {
  rooms: BomRoom[];
  summary: BomSummary;
  furniture_schedule?: BomScheduleItem[];
  categories?: BomCategories;
  budget?: BomBudgetSummary;
}


export interface CirculationPath {
  to: string;
  waypoints: [number, number][];
}

export interface FloorCirculation {
  paths: CirculationPath[];
  unreachable: string[];
}

export interface Floor {
  level: string | number;
  name?: string;
  floor_type?: string;
  floor_height?: number;
  rooms: Room[];
  walls?: Array<{
    room?: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    orientation?: string;
    type?: string;
  }>;
  doors?: Array<{
    room?: string;
    wall?: string;
    position?: number;
    width?: number;
    type?: string;
  }>;
  windows?: Array<{
    room?: string;
    wall?: string;
    position?: number;
    width?: number;
    sill_height?: number;
  }>;
  stairs?: { x: number; y: number; width: number; depth: number } | null;
  imageUrl?: string;
  circulation?: FloorCirculation;
  plot_width?: number;
  plot_height?: number;
}

export interface FloorRoomSpec {
  type: string;
  name: string;
  min_area?: number;
  attached_bath?: boolean;
}

export interface FloorConfigSpec {
  level: number;
  name: string;
  floor_type: 'ground' | 'upper' | 'duplex_upper' | 'terrace' | 'rooftop';
  required_rooms: FloorRoomSpec[];
  has_terrace?: boolean;
  has_garden?: boolean;
}

export interface MultiFloorGenerationRequest {
  plot_width: number;
  plot_length: number;
  measurement_unit: 'ft' | 'm';
  entry_direction: string;
  budget_tier: 'economy' | 'standard' | 'luxury';
  floors_count: number;
  is_duplex: boolean;
  floors: FloorConfigSpec[];
}

export interface LayoutUpdatePayload {
  rooms?: Room[];
  fixed_layout?: Room[];
  full_layout?: { floors: Floor[] };
  imageUrl?: string;
  status?: string;
  design_rationale?: string;
  new_energy_result?: EnergyResult;
  new_sunlight_result?: SunlightResult;
  new_bom_result?: BomResult;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
export interface RegisterPayload { email: string; password: string; name?: string; }
export interface LoginPayload { email: string; password: string; }

export interface SaveProjectPayload {
  name: string;
  layout_data: LayoutData;
  image_url?: string;
  budget_target?: number;
  plot_width?: number;
  plot_length?: number;
}

export interface GeneratePlansPayload {
  length: number;
  width: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  duplex: boolean;
  balcony: number;
  terrace: boolean;
  lift: boolean;
  vastuToggle: boolean;
  entryDir: string;
}

export interface LayoutData {
  form?: Record<string, unknown>;
  rooms?: Room[];
  plot_width?: number;
  plot_height?: number;
  floors?: Floor[];
  vastuScore?: number;
  vastuResult?: VastuResult;
  nbcResult?: NbcResult;
  energyResult?: EnergyResult;
  sunlightResult?: SunlightResult;
  bomResult?: BomResult;
  budget_target?: number;
  target_budget?: number;
}

export interface ProjectMeta {
  name?: string;
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  entry_dir?: string;
  length?: number;
  width?: number;
}

export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Wraps fetch with an AbortController timeout to prevent infinite hangs.
// AI generation calls can be slow; 120s for those, 30s for data calls.
const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 30_000,
): Promise<Response> => {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. The server may be overloaded.`, { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timerId);
  }
};


const authFetch = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 30_000) => {
  const res = await fetchWithTimeout(input, init, timeoutMs);
  if (res.status === 401) {
    localStorage.removeItem('token');
    if (isSupabaseAuth() && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    window.location.href = '/login';
  }
  return res;
};

export const register = async (data: RegisterPayload) => {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const login = async (data: LoginPayload) => {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const fetchMe = async () => {
  const res = await authFetch(`${API_BASE_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
};

// ── Projects ─────────────────────────────────────────────────────────────────
export const getProjects = async () => {
  const res = await authFetch(`${API_BASE_URL}/projects`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
};

export const getProjectById = async (id: string) => {
  const res = await authFetch(`${API_BASE_URL}/projects/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
};

export const saveProject = async (data: SaveProjectPayload) => {
  const res = await authFetch(`${API_BASE_URL}/projects`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save project");
  return res.json();
};

export const updateProject = async (id: string, data: SaveProjectPayload) => {
  const res = await authFetch(`${API_BASE_URL}/projects/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return res.json();
};

export const deleteProject = async (id: string) => {
  const res = await authFetch(`${API_BASE_URL}/projects/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    let errDetail = "Failed to delete project";
    try {
      const errJson = await res.json();
      if (errJson?.detail) errDetail = errJson.detail;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errDetail);
  }
  return res.json();
};

// ── Generation ───────────────────────────────────────────────────────────────
export const generatePlans = async (data: GeneratePlansPayload): Promise<{ candidates: LayoutData[] }> => {
  const res = await authFetch(`${API_BASE_URL}/generate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }, 120_000);  // AI generation can take up to 2 min
  if (!res.ok) throw new Error(`Generation failed: ${await res.text()}`);
  return res.json();
};

export const generateMultiFloorPlans = async (data: MultiFloorGenerationRequest): Promise<{
  status: string;
  project_id: string;
  floors: Floor[];
  candidates: LayoutData[];
}> => {
  const res = await authFetch(`${API_BASE_URL}/generate/multi-floor`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  }, 120_000);
  if (!res.ok) throw new Error(`Multi-floor generation failed: ${await res.text()}`);
  return res.json();
};

export const exportDxf = async (
  layoutOrRooms: any,
  planId: string,
  plotWidth: number,
  plotHeight: number
): Promise<void> => {
  const isLayout = typeof layoutOrRooms === 'object' && !Array.isArray(layoutOrRooms);
  const payload = isLayout
    ? { layout: layoutOrRooms, plan_id: planId, plot_width: plotWidth, plot_height: plotHeight }
    : { rooms: layoutOrRooms, plan_id: planId, plot_width: plotWidth, plot_height: plotHeight };

  const res = await authFetch(`${API_BASE_URL}/api/export/dxf`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`DXF export failed: ${await res.text()}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cad_blueprint_${planId}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const regenerateRoom = async (
  rooms: Room[],
  roomName: string,
  instruction: string,
  plotContext: {
    plotWidth: number;
    plotHeight: number;
    entryDir: string;
    bedrooms: number;
    bathrooms: number;
    floors: number;
  }
): Promise<LayoutUpdatePayload> => {
  const res = await authFetch(`${API_BASE_URL}/regenerate-room`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      rooms,
      room_name: roomName,
      instruction,
      plot_width: plotContext.plotWidth,
      plot_height: plotContext.plotHeight,
      entry_dir: plotContext.entryDir,
      bedrooms: plotContext.bedrooms,
      bathrooms: plotContext.bathrooms,
      floors: plotContext.floors,
    }),
  }, 120_000);  // AI regeneration can be slow
  if (!res.ok) throw new Error(`AI editing failed: ${await res.text()}`);
  return res.json();
};

export const vastuFix = async (
  layout: LayoutData,
  vastuResult: VastuResult | undefined,
  plotContext: {
    plotWidth: number;
    plotHeight: number;
    entryDir: string;
    bedrooms: number;
    bathrooms: number;
    floors: number;
  }
): Promise<VastuFixResult> => {
  const res = await authFetch(`${API_BASE_URL}/vastu/fix`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      layout,
      vastu_result: vastuResult ?? {},
      plot_width: plotContext.plotWidth,
      plot_height: plotContext.plotHeight,
      entry_dir: plotContext.entryDir,
      bedrooms: plotContext.bedrooms,
      bathrooms: plotContext.bathrooms,
      floors: plotContext.floors,
    }),
  }, 120_000);  // LLM topology fix can be slow
  if (!res.ok) throw new Error(`Vastu fix failed: ${await res.text()}`);
  return res.json();
};

export const nbcFix = async (
  layout: LayoutData,
  nbcResult: NbcResult | undefined,
  plotContext: {
    plotWidth: number;
    plotHeight: number;
    entryDir: string;
    bedrooms: number;
    bathrooms: number;
    floors: number;
  }
): Promise<NbcFixResult> => {
  const res = await authFetch(`${API_BASE_URL}/nbc/fix`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      layout,
      nbc_result: nbcResult ?? {},
      plot_width: plotContext.plotWidth,
      plot_height: plotContext.plotHeight,
      entry_dir: plotContext.entryDir,
      bedrooms: plotContext.bedrooms,
      bathrooms: plotContext.bathrooms,
      floors: plotContext.floors,
    }),
  }, 120_000);  // LLM topology fix can be slow
  if (!res.ok) throw new Error(`NBC fix failed: ${await res.text()}`);
  return res.json();
};

export const exportReport = async (
  layout: LayoutData,
  vastuResult: VastuResult | undefined,
  planId: string,
  projectMeta: ProjectMeta
): Promise<void> => {
  const res = await authFetch(`${API_BASE_URL}/api/export/pdf`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      layout,
      vastu_result: vastuResult ?? { score: 0, grade: "N/A", rules: [] },
      plan_id: planId,
      project_meta: projectMeta,
    }),
  });
  if (!res.ok) throw new Error(`Report export failed: ${await res.text()}`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `dossier_${planId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const recalculateBOM = async (
  layout: LayoutData,
  sqft: number,
  tier: string,
  targetBudget?: number
): Promise<{ status: string; bomResult: BomResult }> => {
  const res = await authFetch(`${API_BASE_URL}/bom/recalculate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      layout,
      sqft,
      tier,
      target_budget: targetBudget || 0,
    }),
  });
  if (!res.ok) throw new Error(`BOM recalculation failed: ${await res.text()}`);
  return res.json();
};


export interface ArchitecturalOperation {
  action:
    | "resize_room"
    | "move_room"
    | "add_room"
    | "remove_room"
    | "place_furniture"
    | "remove_furniture"
    | "swap_rooms"
    | "change_room_type"
    | "ambiguous_request"
    | "general_advice";
  target_floor_level: number;
  target_room_name?: string | null;
  parameters: Record<string, any>;
  explanation: string;
}

export interface AgentChatMessage {
  id?: string;
  conversation_id?: string;
  sender: "user" | "agent" | "system";
  content: string;
  operation?: ArchitecturalOperation | null;
  created_at?: string;
}

export interface AgentChatResponse {
  conversation_id: string;
  reply: string;
  operation: ArchitecturalOperation;
  success: boolean;
  updated_layout?: LayoutData | null;
  change_summary?: {
    action: string;
    target_room?: string | null;
    target_floor_level?: number;
    details?: string;
    is_destructive?: boolean;
    before?: Record<string, any>;
    after?: Record<string, any>;
    [key: string]: any;
  };
  imageUrl?: string | null;
  warnings?: string[];
  compliance?: {
    vastu?: VastuResult;
    nbc?: NbcResult;
    energy?: EnergyResult;
    sunlight?: SunlightResult;
    bom?: BomResult;
  };
}

export const sendAgentChat = async (payload: {
  project_id?: string;
  message: string;
  current_layout: LayoutData;
  active_floor_level?: number;
  plot_width?: number;
  plot_height?: number;
  entry_dir?: string;
  conversation_id?: string;
}): Promise<AgentChatResponse> => {
  const res = await authFetch(`${API_BASE_URL}/api/agent/chat`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  }, 90_000);
  if (!res.ok) throw new Error(`Agent request failed: ${await res.text()}`);
  return res.json();
};

export const getAgentHistory = async (
  projectId?: string,
  conversationId?: string
): Promise<{ conversation_id: string | null; messages: AgentChatMessage[] }> => {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (conversationId) params.set("conversation_id", conversationId);
  const res = await authFetch(`${API_BASE_URL}/api/agent/history?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load chat history: ${await res.text()}`);
  return res.json();
};
