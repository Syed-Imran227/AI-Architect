import { FURNITURE_PRICES_INR } from '../geometry/furnitureRegistry';

export interface CatalogItemDimensions {
  width: number;  // feet (x dimension in 2D)
  depth: number;  // feet (y dimension in 2D)
  height: number; // feet (z dimension in 3D)
}

export interface CatalogLightProperties {
  intensity: number;
  color: string;
  radius: number;
  type: 'point' | 'spot';
}

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: 'Living Room' | 'Bedroom' | 'Kitchen & Dining' | 'Bathroom' | 'Outdoor / Terrace' | 'Lighting Fixtures';
  dimensions: CatalogItemDimensions;
  defaultColor: string;
  icon: string;
  elevation?: number; // feet above floor (useful for sconces, chandeliers, wall cabinets)
  lightProperties?: CatalogLightProperties;
  description?: string;
  unitCostINR?: number;
}


export const FURNITURE_CATEGORIES = [
  'All',
  'Living Room',
  'Bedroom',
  'Kitchen & Dining',
  'Bathroom',
  'Outdoor / Terrace',
  'Lighting Fixtures'
] as const;

export type FurnitureCategory = typeof FURNITURE_CATEGORIES[number];

const RAW_FURNITURE_CATALOG: FurnitureCatalogItem[] = [

  // ── Living Room ─────────────────────────────────────────────────────────────
  {
    id: 'sofa_3_seater',
    name: '3-Seater Sofa',
    category: 'Living Room',
    dimensions: { width: 7.0, depth: 3.0, height: 2.8 },
    defaultColor: '#5c6e94',
    icon: 'Armchair',
    description: 'Plush 3-person living room sofa with armrests and back cushions.'
  },
  {
    id: 'sectional_l_shape',
    name: 'L-Shape Sectional',
    category: 'Living Room',
    dimensions: { width: 8.5, depth: 6.5, height: 2.8 },
    defaultColor: '#475569',
    icon: 'Sofa',
    description: 'Corner sectional lounge sofa with comfortable chaise lounge return.'
  },
  {
    id: 'armchair',
    name: 'Accent Armchair',
    category: 'Living Room',
    dimensions: { width: 3.0, depth: 3.0, height: 3.0 },
    defaultColor: '#7c3aed',
    icon: 'Armchair',
    description: 'Modern upholstered reading armchair.'
  },
  {
    id: 'coffee_table',
    name: 'Coffee Table',
    category: 'Living Room',
    dimensions: { width: 4.0, depth: 2.2, height: 1.5 },
    defaultColor: '#c0a070',
    icon: 'Table',
    description: 'Low wood and metal coffee table for central living space.'
  },
  {
    id: 'tv_console',
    name: 'TV Unit & Console',
    category: 'Living Room',
    dimensions: { width: 6.0, depth: 1.6, height: 4.8 },
    defaultColor: '#2a2a2a',
    icon: 'Tv',
    description: 'Media console unit with wall-mounted flat-screen TV display.'
  },
  {
    id: 'bookshelf',
    name: 'Bookshelf & Display',
    category: 'Living Room',
    dimensions: { width: 4.0, depth: 1.2, height: 6.5 },
    defaultColor: '#7a5a2a',
    icon: 'BookOpen',
    description: 'Tall 4-tier wooden bookshelf for living and study spaces.'
  },

  // ── Bedroom ─────────────────────────────────────────────────────────────────
  {
    id: 'bed_king',
    name: 'King Bed with Nightstands',
    category: 'Bedroom',
    dimensions: { width: 7.5, depth: 6.8, height: 3.5 },
    defaultColor: '#6e4e28',
    icon: 'BedDouble',
    description: 'Luxury king-sized bed with plush mattress, headboard, and dual side tables.'
  },
  {
    id: 'bed_queen',
    name: 'Queen Bed',
    category: 'Bedroom',
    dimensions: { width: 6.5, depth: 5.5, height: 3.5 },
    defaultColor: '#854d0e',
    icon: 'Bed',
    description: 'Standard queen-sized bed with upholstered headboard and pillows.'
  },
  {
    id: 'wardrobe_3_door',
    name: '3-Door Wardrobe',
    category: 'Bedroom',
    dimensions: { width: 6.0, depth: 2.0, height: 7.0 },
    defaultColor: '#8b5a2b',
    icon: 'Folder',
    description: 'Spacious 3-door clothes closet with full-length storage.'
  },
  {
    id: 'wardrobe_2_door',
    name: '2-Door Wardrobe',
    category: 'Bedroom',
    dimensions: { width: 4.0, depth: 2.0, height: 7.0 },
    defaultColor: '#78350f',
    icon: 'Folder',
    description: 'Compact 2-door bedroom wardrobe.'
  },
  {
    id: 'desk_study',
    name: 'Study Desk & Chair',
    category: 'Bedroom',
    dimensions: { width: 4.5, depth: 2.2, height: 2.6 },
    defaultColor: '#a07840',
    icon: 'Laptop',
    description: 'Workstation desk with ergonomic swivel chair.'
  },
  {
    id: 'dressing_table',
    name: 'Dressing Table with Mirror',
    category: 'Bedroom',
    dimensions: { width: 3.5, depth: 1.8, height: 5.5 },
    defaultColor: '#b45309',
    icon: 'Sparkles',
    description: 'Vanity makeup desk with tall vanity mirror.'
  },

  // ── Kitchen & Dining ────────────────────────────────────────────────────────
  {
    id: 'dining_table_6',
    name: '6-Seater Dining Table',
    category: 'Kitchen & Dining',
    dimensions: { width: 6.0, depth: 3.2, height: 2.6 },
    defaultColor: '#8a5a2a',
    icon: 'Utensils',
    description: 'Solid wood dining table accompanied by 6 matching dining chairs.'
  },
  {
    id: 'dining_table_4',
    name: '4-Seater Dining Table',
    category: 'Kitchen & Dining',
    dimensions: { width: 4.0, depth: 3.0, height: 2.6 },
    defaultColor: '#a16207',
    icon: 'Utensils',
    description: 'Compact 4-person breakfast / dining table.'
  },
  {
    id: 'kitchen_island',
    name: 'Kitchen Island Counter',
    category: 'Kitchen & Dining',
    dimensions: { width: 5.5, depth: 2.8, height: 3.0 },
    defaultColor: '#334155',
    icon: 'Square',
    description: 'Central kitchen prep island with granite countertop and breakfast overhang.'
  },
  {
    id: 'cooking_range',
    name: 'Cooking Range & Stove',
    category: 'Kitchen & Dining',
    dimensions: { width: 3.0, depth: 2.2, height: 3.0 },
    defaultColor: '#1e293b',
    icon: 'Flame',
    description: '4-burner gas stove range and oven console.'
  },
  {
    id: 'refrigerator',
    name: 'Double-Door Refrigerator',
    category: 'Kitchen & Dining',
    dimensions: { width: 3.0, depth: 2.8, height: 6.0 },
    defaultColor: '#cbd5e1',
    icon: 'Box',
    description: 'Stainless steel French-door refrigerator.'
  },
  {
    id: 'sink_counter',
    name: 'Dishwasher & Sink Counter',
    category: 'Kitchen & Dining',
    dimensions: { width: 4.5, depth: 2.2, height: 3.0 },
    defaultColor: '#e2e8f0',
    icon: 'Droplet',
    description: 'Dual-basin stainless sink unit and integrated dishwasher counter.'
  },

  // ── Bathroom ────────────────────────────────────────────────────────────────
  {
    id: 'vanity_sink',
    name: 'Vanity Counter & Sink',
    category: 'Bathroom',
    dimensions: { width: 3.5, depth: 1.8, height: 2.8 },
    defaultColor: '#ffffff',
    icon: 'Droplet',
    description: 'Modern ceramic washbasin mounted on a wood cabinet vanity.'
  },
  {
    id: 'toilet_wc',
    name: 'Water Closet (Toilet)',
    category: 'Bathroom',
    dimensions: { width: 1.8, depth: 2.4, height: 2.6 },
    defaultColor: '#f8fafc',
    icon: 'CircleDot',
    description: 'Porcelain water closet with rear flush cistern.'
  },
  {
    id: 'shower_enclosure',
    name: 'Shower Enclosure',
    category: 'Bathroom',
    dimensions: { width: 3.2, depth: 3.2, height: 6.5 },
    defaultColor: '#bae6fd',
    icon: 'Shield',
    description: 'Tempered glass walk-in shower cubicle with chrome showerhead.'
  },
  {
    id: 'bathtub',
    name: 'Soaking Bathtub',
    category: 'Bathroom',
    dimensions: { width: 5.5, depth: 2.8, height: 2.0 },
    defaultColor: '#ffffff',
    icon: 'Layers',
    description: 'Freestanding acrylic soaking bathtub.'
  },

  // ── Outdoor / Terrace ───────────────────────────────────────────────────────
  {
    id: 'patio_lounge',
    name: 'Patio Lounge Set',
    category: 'Outdoor / Terrace',
    dimensions: { width: 6.5, depth: 5.0, height: 2.5 },
    defaultColor: '#965d33',
    icon: 'Coffee',
    description: 'All-weather wicker outdoor sectional sofa and teak coffee table.'
  },
  {
    id: 'sunbed_lounger',
    name: 'Sunbed Lounger',
    category: 'Outdoor / Terrace',
    dimensions: { width: 2.2, depth: 6.2, height: 1.5 },
    defaultColor: '#f8fafc',
    icon: 'Sun',
    description: 'Reclining poolside sunbed lounger with padded cushion.'
  },
  {
    id: 'bistro_table',
    name: 'Coffee Bistro Table & Chairs',
    category: 'Outdoor / Terrace',
    dimensions: { width: 2.5, depth: 2.5, height: 2.5 },
    defaultColor: '#334155',
    icon: 'Coffee',
    description: 'Compact 2-person wrought-iron bistro table set.'
  },
  {
    id: 'planter_box',
    name: 'Planter Box & Foliage',
    category: 'Outdoor / Terrace',
    dimensions: { width: 3.5, depth: 1.2, height: 1.8 },
    defaultColor: '#453229',
    icon: 'Trees',
    description: 'Cedar wood planter trough filled with decorative evergreen shrubs.'
  },
  {
    id: 'bbq_grill',
    name: 'Barbecue Grill Station',
    category: 'Outdoor / Terrace',
    dimensions: { width: 3.5, depth: 2.0, height: 3.8 },
    defaultColor: '#1e293b',
    icon: 'Flame',
    description: 'Stainless steel outdoor gas barbecue grill on rolling cart.'
  },

  // ── Lighting Fixtures ───────────────────────────────────────────────────────
  {
    id: 'chandelier_warm',
    name: 'Warm Ceiling Chandelier',
    category: 'Lighting Fixtures',
    dimensions: { width: 2.5, depth: 2.5, height: 2.5 },
    defaultColor: '#fef08a',
    elevation: 8.0, // hung from 10ft ceiling
    icon: 'SunMedium',
    lightProperties: {
      intensity: 2.5,
      color: '#fffae0',
      radius: 14.0,
      type: 'point'
    },
    description: 'Decorative brass and frosted glass chandelier with warm ambient glow.'
  },
  {
    id: 'downlight_recessed',
    name: 'Recessed Downlight',
    category: 'Lighting Fixtures',
    dimensions: { width: 0.8, depth: 0.8, height: 0.3 },
    defaultColor: '#ffffff',
    elevation: 9.8, // flush in ceiling
    icon: 'Lightbulb',
    lightProperties: {
      intensity: 1.6,
      color: '#fff5d6',
      radius: 9.0,
      type: 'spot'
    },
    description: 'Architectural flush-mount LED spot downlight.'
  },
  {
    id: 'wall_sconce',
    name: 'Wall Sconce Light',
    category: 'Lighting Fixtures',
    dimensions: { width: 0.8, depth: 0.8, height: 1.2 },
    defaultColor: '#ca8a04',
    elevation: 6.5, // wall mounted eye level
    icon: 'Sparkle',
    lightProperties: {
      intensity: 1.3,
      color: '#ffd699',
      radius: 7.5,
      type: 'point'
    },
    description: 'Brushed gold wall sconce casting upward and downward warm accent light.'
  },
  {
    id: 'floor_lamp',
    name: 'Modern Floor Lamp',
    category: 'Lighting Fixtures',
    dimensions: { width: 1.5, depth: 1.5, height: 5.5 },
    defaultColor: '#475569',
    elevation: 0.0,
    icon: 'Lamp',
    description: 'Tall contemporary arc floor lamp with linen drum lampshade.',
    lightProperties: {
      intensity: 1.8,
      color: '#ffe6b3',
      radius: 10.0,
      type: 'point'
    }
  },
  {
    id: 'terrace_lantern',
    name: 'Terrace Post Lantern',
    category: 'Lighting Fixtures',
    dimensions: { width: 1.2, depth: 1.2, height: 4.0 },
    defaultColor: '#1e293b',
    elevation: 0.0,
    icon: 'Sun',
    description: 'Outdoor weatherproof post lantern for balconies and rooftop gardens.',
    lightProperties: {
      intensity: 2.0,
      color: '#fef08a',
      radius: 12.0,
      type: 'point'
    }
  }
];

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = RAW_FURNITURE_CATALOG.map(item => ({
  ...item,
  unitCostINR: FURNITURE_PRICES_INR[item.id],
}));

