/**
 * furnitureRegistry.ts
 * ============================================================================
 * Maintainable Furniture & Fixture Asset Registry.
 *
 * Provides a single authoritative registry mapping each furniture item to:
 * - Stable asset ID and display name
 * - Architectural category
 * - Explicit dimensions in both Imperial (ft) and SI Metric (metres)
 * - Default rotation, elevation, and color
 * - 2D plan footprint definition and vector symbol keys
 * - 3D procedural representation status and lighting properties
 * - Licensing and source information
 * ============================================================================
 */

import { ftToM } from './types';

export type FurnitureCategory =
  | 'Living Room'
  | 'Bedroom'
  | 'Kitchen & Dining'
  | 'Bathroom'
  | 'Outdoor / Terrace'
  | 'Lighting Fixtures';

export interface CatalogDimensions {
  widthFt: number;
  depthFt: number;
  heightFt: number;
  widthM: number;
  depthM: number;
  heightM: number;
}

export interface CatalogLightSpec {
  intensity: number;
  color: string;
  radius: number; // in feet
  type: 'point' | 'spot';
}

export interface FurnitureAssetDefinition {
  id: string;
  name: string;
  category: FurnitureCategory;
  dimensions: CatalogDimensions;
  defaultColor: string;
  defaultRotation: number; // degrees [0, 360)
  defaultElevationFt: number; // feet above level floor
  isLight?: boolean;
  lightProperties?: CatalogLightSpec;
  description: string;
  unitCostINR?: number;
  // 3D representation specification
  representation3D: 'procedural' | 'gltf' | 'fallback_box';
  gltfModelPath?: string | null;
  modelStatus: 'built_in_procedural' | 'verified_gltf' | 'fallback';
  // 2D footprint classification
  footprintType: 'rect' | 'l_shape' | 'circle' | 'complex_cad';
  licensing: {
    source: string;
    license: string;
  };
}

function createDim(wFt: number, dFt: number, hFt: number): CatalogDimensions {
  return {
    widthFt: wFt,
    depthFt: dFt,
    heightFt: hFt,
    widthM: ftToM(wFt),
    depthM: ftToM(dFt),
    heightM: ftToM(hFt),
  };
}

export const FURNITURE_CATEGORIES: readonly FurnitureCategory[] = [
  'Living Room',
  'Bedroom',
  'Kitchen & Dining',
  'Bathroom',
  'Outdoor / Terrace',
  'Lighting Fixtures',
] as const;

export const FURNITURE_REGISTRY: Record<string, FurnitureAssetDefinition> = {
  // ── Living Room ─────────────────────────────────────────────────────────────
  sofa_3_seater: {
    id: 'sofa_3_seater',
    name: '3-Seater Sofa',
    category: 'Living Room',
    dimensions: createDim(7.0, 3.0, 2.8),
    defaultColor: '#5c6e94',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Plush 3-person living room sofa with armrests and back cushions.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  sectional_l_shape: {
    id: 'sectional_l_shape',
    name: 'L-Shape Sectional',
    category: 'Living Room',
    dimensions: createDim(8.5, 6.5, 2.8),
    defaultColor: '#475569',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'l_shape',
    description: 'Corner sectional lounge sofa with comfortable chaise lounge return.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  armchair: {
    id: 'armchair',
    name: 'Accent Armchair',
    category: 'Living Room',
    dimensions: createDim(3.0, 3.0, 3.0),
    defaultColor: '#7c3aed',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Modern upholstered reading armchair with flared armrests.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  coffee_table: {
    id: 'coffee_table',
    name: 'Coffee Table',
    category: 'Living Room',
    dimensions: createDim(4.0, 2.2, 1.5),
    defaultColor: '#c0a070',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Low wood and metal coffee table for central living space.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  tv_console: {
    id: 'tv_console',
    name: 'TV Unit & Console',
    category: 'Living Room',
    dimensions: createDim(6.0, 1.6, 4.8),
    defaultColor: '#2a2a2a',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Media console unit with wall-mounted flat-screen TV display.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  bookshelf: {
    id: 'bookshelf',
    name: 'Bookshelf & Display',
    category: 'Living Room',
    dimensions: createDim(4.0, 1.2, 6.5),
    defaultColor: '#7a5a2a',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Tall 4-tier wooden bookshelf for living and study spaces.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },

  // ── Bedroom ─────────────────────────────────────────────────────────────────
  bed_king: {
    id: 'bed_king',
    name: 'King Bed with Nightstands',
    category: 'Bedroom',
    dimensions: createDim(7.5, 6.8, 3.5),
    defaultColor: '#6e4e28',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Luxury king-sized bed with plush mattress, headboard, and dual side tables.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  bed_queen: {
    id: 'bed_queen',
    name: 'Queen Bed',
    category: 'Bedroom',
    dimensions: createDim(6.5, 5.5, 3.5),
    defaultColor: '#854d0e',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Standard queen-sized bed with upholstered headboard and pillows.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  wardrobe_3_door: {
    id: 'wardrobe_3_door',
    name: '3-Door Wardrobe',
    category: 'Bedroom',
    dimensions: createDim(6.0, 2.0, 7.0),
    defaultColor: '#8b5a2b',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Spacious 3-door clothes closet with full-length storage.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  wardrobe_2_door: {
    id: 'wardrobe_2_door',
    name: '2-Door Wardrobe',
    category: 'Bedroom',
    dimensions: createDim(4.0, 2.0, 7.0),
    defaultColor: '#78350f',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Compact 2-door bedroom wardrobe.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  desk_study: {
    id: 'desk_study',
    name: 'Study Desk & Chair',
    category: 'Bedroom',
    dimensions: createDim(4.5, 2.2, 2.6),
    defaultColor: '#a07840',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Workstation desk with ergonomic swivel chair.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  dressing_table: {
    id: 'dressing_table',
    name: 'Dressing Table with Mirror',
    category: 'Bedroom',
    dimensions: createDim(3.5, 1.8, 5.5),
    defaultColor: '#b45309',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Vanity makeup desk with tall vanity mirror.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },

  // ── Kitchen & Dining ────────────────────────────────────────────────────────
  dining_table_6: {
    id: 'dining_table_6',
    name: '6-Seater Dining Table',
    category: 'Kitchen & Dining',
    dimensions: createDim(6.0, 3.2, 2.6),
    defaultColor: '#8a5a2a',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Solid wood dining table accompanied by 6 matching dining chairs.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  dining_table_4: {
    id: 'dining_table_4',
    name: '4-Seater Dining Table',
    category: 'Kitchen & Dining',
    dimensions: createDim(4.0, 3.0, 2.6),
    defaultColor: '#a16207',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Compact 4-person breakfast / dining table with chairs.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  kitchen_island: {
    id: 'kitchen_island',
    name: 'Kitchen Island Counter',
    category: 'Kitchen & Dining',
    dimensions: createDim(5.5, 2.8, 3.0),
    defaultColor: '#334155',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Central kitchen prep island with countertop and breakfast overhang.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  cooking_range: {
    id: 'cooking_range',
    name: 'Cooking Range & Stove',
    category: 'Kitchen & Dining',
    dimensions: createDim(3.0, 2.2, 3.0),
    defaultColor: '#1e293b',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: '4-burner gas stove range and oven console.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  refrigerator: {
    id: 'refrigerator',
    name: 'Double-Door Refrigerator',
    category: 'Kitchen & Dining',
    dimensions: createDim(3.0, 2.8, 6.0),
    defaultColor: '#cbd5e1',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Stainless steel French-door refrigerator.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  sink_counter: {
    id: 'sink_counter',
    name: 'Dishwasher & Sink Counter',
    category: 'Kitchen & Dining',
    dimensions: createDim(4.5, 2.2, 3.0),
    defaultColor: '#e2e8f0',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Dual-basin stainless sink unit and integrated counter.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },

  // ── Bathroom ────────────────────────────────────────────────────────────────
  vanity_sink: {
    id: 'vanity_sink',
    name: 'Vanity Counter & Sink',
    category: 'Bathroom',
    dimensions: createDim(3.5, 1.8, 2.8),
    defaultColor: '#ffffff',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Modern ceramic washbasin mounted on a wood cabinet vanity.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  toilet_wc: {
    id: 'toilet_wc',
    name: 'Water Closet (Toilet)',
    category: 'Bathroom',
    dimensions: createDim(1.8, 2.4, 2.6),
    defaultColor: '#f8fafc',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'complex_cad',
    description: 'Porcelain water closet with rear flush cistern.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  shower_enclosure: {
    id: 'shower_enclosure',
    name: 'Shower Enclosure',
    category: 'Bathroom',
    dimensions: createDim(3.2, 3.2, 6.5),
    defaultColor: '#bae6fd',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Tempered glass walk-in shower cubicle with chrome showerhead.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  bathtub: {
    id: 'bathtub',
    name: 'Soaking Bathtub',
    category: 'Bathroom',
    dimensions: createDim(5.5, 2.8, 2.0),
    defaultColor: '#ffffff',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'complex_cad',
    description: 'Freestanding acrylic soaking bathtub with rolled rim.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },

  // ── Outdoor / Terrace ───────────────────────────────────────────────────────
  patio_lounge: {
    id: 'patio_lounge',
    name: 'Patio Lounge Set',
    category: 'Outdoor / Terrace',
    dimensions: createDim(6.5, 5.0, 2.5),
    defaultColor: '#965d33',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'complex_cad',
    description: 'All-weather wicker outdoor sectional sofa and teak coffee table.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  sunbed_lounger: {
    id: 'sunbed_lounger',
    name: 'Sunbed Lounger',
    category: 'Outdoor / Terrace',
    dimensions: createDim(2.2, 6.2, 1.5),
    defaultColor: '#f8fafc',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Reclining poolside sunbed lounger with padded cushion.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  bistro_table: {
    id: 'bistro_table',
    name: 'Coffee Bistro Table & Chairs',
    category: 'Outdoor / Terrace',
    dimensions: createDim(2.5, 2.5, 2.5),
    defaultColor: '#334155',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'circle',
    description: 'Compact 2-person wrought-iron bistro table set.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  planter_box: {
    id: 'planter_box',
    name: 'Planter Box & Foliage',
    category: 'Outdoor / Terrace',
    dimensions: createDim(3.5, 1.2, 1.8),
    defaultColor: '#453229',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Cedar wood planter trough filled with decorative evergreen shrubs.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  bbq_grill: {
    id: 'bbq_grill',
    name: 'Barbecue Grill Station',
    category: 'Outdoor / Terrace',
    dimensions: createDim(3.5, 2.0, 3.8),
    defaultColor: '#1e293b',
    defaultRotation: 0,
    defaultElevationFt: 0,
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Stainless steel outdoor gas barbecue grill on rolling cart.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },

  // ── Lighting Fixtures ───────────────────────────────────────────────────────
  chandelier_warm: {
    id: 'chandelier_warm',
    name: 'Warm Ceiling Chandelier',
    category: 'Lighting Fixtures',
    dimensions: createDim(2.5, 2.5, 2.5),
    defaultColor: '#fef08a',
    defaultRotation: 0,
    defaultElevationFt: 8.0,
    isLight: true,
    lightProperties: {
      intensity: 2.5,
      color: '#fffae0',
      radius: 14.0,
      type: 'point',
    },
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'circle',
    description: 'Decorative brass and frosted glass chandelier with warm ambient glow.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  downlight_recessed: {
    id: 'downlight_recessed',
    name: 'Recessed Downlight',
    category: 'Lighting Fixtures',
    dimensions: createDim(0.8, 0.8, 0.3),
    defaultColor: '#ffffff',
    defaultRotation: 0,
    defaultElevationFt: 9.8,
    isLight: true,
    lightProperties: {
      intensity: 1.6,
      color: '#fff5d6',
      radius: 9.0,
      type: 'spot',
    },
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'circle',
    description: 'Architectural flush-mount LED spot downlight.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  wall_sconce: {
    id: 'wall_sconce',
    name: 'Wall Sconce Light',
    category: 'Lighting Fixtures',
    dimensions: createDim(0.8, 0.8, 1.2),
    defaultColor: '#ca8a04',
    defaultRotation: 0,
    defaultElevationFt: 6.5,
    isLight: true,
    lightProperties: {
      intensity: 1.3,
      color: '#ffd699',
      radius: 7.5,
      type: 'point',
    },
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'circle',
    description: 'Brushed gold wall sconce casting upward and downward warm accent light.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  floor_lamp: {
    id: 'floor_lamp',
    name: 'Modern Floor Lamp',
    category: 'Lighting Fixtures',
    dimensions: createDim(1.5, 1.5, 5.5),
    defaultColor: '#475569',
    defaultRotation: 0,
    defaultElevationFt: 0.0,
    isLight: true,
    lightProperties: {
      intensity: 1.8,
      color: '#ffe6b3',
      radius: 10.0,
      type: 'point',
    },
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'circle',
    description: 'Tall contemporary arc floor lamp with linen drum lampshade.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
  terrace_lantern: {
    id: 'terrace_lantern',
    name: 'Terrace Post Lantern',
    category: 'Lighting Fixtures',
    dimensions: createDim(1.2, 1.2, 4.0),
    defaultColor: '#1e293b',
    defaultRotation: 0,
    defaultElevationFt: 0.0,
    isLight: true,
    lightProperties: {
      intensity: 2.0,
      color: '#fef08a',
      radius: 12.0,
      type: 'point',
    },
    representation3D: 'procedural',
    modelStatus: 'built_in_procedural',
    footprintType: 'rect',
    description: 'Outdoor weatherproof post lantern for balconies and rooftop gardens.',
    licensing: {
      source: 'AI Architect Studio Design System',
      license: 'MIT',
    },
  },
};

/**
 * Authoritative Indian Market Unit Cost Table (INR, 2026 Baseline).
 * Directly matches backend FURNITURE_RATES in cost_rates.py.
 */
export const FURNITURE_PRICES_INR: Record<string, number> = {
  // Living Room
  sofa_3_seater: 38000,
  sectional_l_shape: 65000,
  armchair: 16000,
  coffee_table: 12000,
  tv_console: 22000,
  bookshelf: 18000,

  // Bedroom
  bed_king: 48000,
  bed_queen: 36000,
  wardrobe_3_door: 42000,
  wardrobe_2_door: 28000,
  desk_study: 15000,
  dressing_table: 19000,

  // Kitchen & Dining
  dining_table_6: 45000,
  dining_table_4: 28000,
  kitchen_island: 35000,
  cooking_range: 26000,
  refrigerator: 52000,
  sink_counter: 24000,

  // Bathroom
  vanity_sink: 14000,
  toilet_wc: 12000,
  shower_enclosure: 25000,
  bathtub: 38000,

  // Outdoor / Terrace
  patio_lounge: 32000,
  sunbed_lounger: 14000,
  bistro_table: 9000,
  planter_box: 4500,
  bbq_grill: 22000,

  // Lighting Fixtures
  chandelier_warm: 18000,
  downlight_recessed: 1200,
  wall_sconce: 2800,
  floor_lamp: 6500,
  terrace_lantern: 4200,
};

/**
 * Resolve unit cost for an asset ID. Returns undefined if unpriced or missing.
 */
export function getFurniturePriceINR(id?: string): number | undefined {
  if (!id) return undefined;
  const cleanId = id.trim().toLowerCase();
  if (FURNITURE_PRICES_INR[cleanId] !== undefined) {
    return FURNITURE_PRICES_INR[cleanId];
  }
  // Check without instance suffix (e.g. sofa_3_seater_1)
  const base = cleanId.replace(/(_\d+|_copy.*|-instance.*)$/, '');
  if (FURNITURE_PRICES_INR[base] !== undefined) {
    return FURNITURE_PRICES_INR[base];
  }
  return undefined;
}

/**
 * Registry Lookup Helpers
 */
export function getFurnitureAsset(id: string): FurnitureAssetDefinition | undefined {
  const asset = FURNITURE_REGISTRY[id];
  if (!asset) return undefined;
  return {
    ...asset,
    unitCostINR: FURNITURE_PRICES_INR[asset.id],
  };
}

export function getAllFurnitureAssets(): FurnitureAssetDefinition[] {
  return Object.values(FURNITURE_REGISTRY).map(a => ({
    ...a,
    unitCostINR: FURNITURE_PRICES_INR[a.id],
  }));
}

export function getAssetsByCategory(category: FurnitureCategory): FurnitureAssetDefinition[] {
  return getAllFurnitureAssets().filter(a => a.category === category);
}

