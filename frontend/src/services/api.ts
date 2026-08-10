const API_BASE_URL = "http://localhost:8000";

interface FurnitureItem {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DoorSpec {
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

// ── Auth helpers ─────────────────────────────────────────────────────────────
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const register = async (data: Record<string, unknown>) => {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const login = async (data: Record<string, unknown>) => {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const fetchMe = async () => {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
};

// ── Projects ─────────────────────────────────────────────────────────────────
export const getProjects = async () => {
  const res = await fetch(`${API_BASE_URL}/projects`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
};

export const getProjectById = async (id: string) => {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
};

export const saveProject = async (data: Record<string, unknown>) => {
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save project");
  return res.json();
};

export const deleteProject = async (id: string) => {
  const res = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete project");
  return res.json();
};

// ── Generation ───────────────────────────────────────────────────────────────
export const generatePlans = async (data: Record<string, unknown>): Promise<{ candidates: unknown[] }> => {
  const res = await fetch(`${API_BASE_URL}/generate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Generation failed: ${await res.text()}`);
  return res.json();
};

export const exportDxf = async (rooms: Room[], planId: string): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/export/dxf`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rooms, plan_id: planId }),
  });
  if (!res.ok) throw new Error(`DXF export failed: ${await res.text()}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `floorplan_${planId}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const regenerateRoom = async (
  rooms: Room[],
  roomName: string,
  instruction: string
): Promise<{ rooms: Room[] }> => {
  const res = await fetch(`${API_BASE_URL}/regenerate-room`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rooms, room_name: roomName, instruction }),
  });
  if (!res.ok) throw new Error(`AI editing failed: ${await res.text()}`);
  return res.json();
};

export const vastuFix = async (
  rooms: Room[],
  length: number,
  width: number,
  entryDir: string,
  vastuRules: VastuRule[]
): Promise<{ rooms: Room[]; vastuScore: number; vastuResult: VastuResult; imageUrl: string }> => {
  const res = await fetch(`${API_BASE_URL}/vastu-fix`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ rooms, length, width, entry_dir: entryDir, vastu_rules: vastuRules }),
  });
  if (!res.ok) throw new Error(`Vastu fix failed: ${await res.text()}`);
  return res.json();
};
