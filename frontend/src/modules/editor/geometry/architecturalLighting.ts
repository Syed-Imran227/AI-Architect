/**
 * architecturalLighting.ts
 * ============================================================================
 * Phase 5 Signature Architectural Visualization: Lighting & Camera Pipeline.
 *
 * Provides calibrated, reusable architectural lighting profiles (Daylight,
 * Warm Sunset, Night Glow) and deterministic, plot-aware camera framing
 * presets (Dollhouse, Isometric, Top-Down Plan Cut, Front/Side Elevations).
 *
 * Invariants:
 * 1. Single Authoritative Source: Geometry and coordinates strictly derive
 *    from CanonicalBuildingDocument and Generated3DBuilding.
 * 2. Visual Readability: Ambient fill and bounce illumination keep interior
 *    rooms and furniture legible without pitch-black shadows or blown-out whites.
 * 3. Soft Shadow Precision: Shadow camera frustum bounds tightly encompass
 *    the active site with PCF soft filtering and normal bias to eliminate shadow acne.
 * 4. Non-Mutating: Lighting and camera operations never mutate building geometry
 *    or saved document state.
 * ============================================================================
 */

export type TimeOfDay = 'morning' | 'noon' | 'golden_hour' | 'night' | 'day' | 'sunset';
export type CameraPreset = 'perspective' | 'isometric' | 'topdown' | 'front' | 'side' | 'exterior' | 'interior';
export type ViewMode = 'all' | 'single' | 'exploded' | 'active';

export interface DirectionalLightConfig {
  color: string;
  intensity: number;
  position: [number, number, number];
  castShadow: boolean;
  shadowMapSize: number;
  shadowBias: number;
  shadowNormalBias: number;
  shadowCameraNear: number;
  shadowCameraFar: number;
  shadowFrustumSize: number;
}

export interface HemisphereLightConfig {
  skyColor: string;
  groundColor: string;
  intensity: number;
}

export interface AmbientLightConfig {
  color: string;
  intensity: number;
}

export interface InteriorGlowConfig {
  color: string;
  intensity: number;
  distance: number;
}

export interface LightingRigConfig {
  timeOfDay: TimeOfDay;
  toneMappingExposure: number;
  backgroundColor: string;
  fogColor: string;
  fogDensity: number;
  sky: {
    sunPosition: [number, number, number];
    turbidity: number;
    rayleigh: number;
    mieCoefficient: number;
    mieDirectionalG: number;
  };
  directionalLight: DirectionalLightConfig;
  hemisphereLight: HemisphereLightConfig;
  ambientLight: AmbientLightConfig;
  interiorGlow: InteriorGlowConfig;
}

export interface CameraFramingInput {
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    depth: number;
    centerX: number;
    centerZ: number;
    maxDim: number;
    totalHeight: number;
  };
  plotBounds?: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    width: number;
    length: number;
    centerX: number;
    centerZ: number;
  };
  isLandscapingEnabled?: boolean;
  viewMode: ViewMode;
  activeFloorIndex: number;
  activeFloorElevation?: number;
  numFloors: number;
  preset: CameraPreset;
  fov?: number;
  focusRoomBounds?: { x: number; y: number; width: number; height: number };
  focusItem?: {
    positionFt: { x: number; y: number; z: number };
    dimensionsFt: { width: number; depth: number; height: number };
  };
}

export interface CameraFramingResult {
  targetLookAt: { x: number; y: number; z: number };
  targetPosition: { x: number; y: number; z: number };
  minDistance: number;
  maxDistance: number;
  near: number;
  far: number;
  effectiveDim: number;
  fitDistance: number;
}

// ── Sun Azimuth Resolver ─────────────────────────────────────────────────────

export function resolveSunAzimuthAngle(entryDir: string): number {
  const dir = (entryDir || 'east').toLowerCase().trim();
  if (dir.includes('north')) return Math.PI * 0.75;
  if (dir.includes('south')) return Math.PI * 1.35;
  if (dir.includes('west')) return Math.PI * 1.70;
  // Default East orientation
  return Math.PI * 0.35;
}

// ── Architectural Lighting Rig Configuration Generator ───────────────────────

export function getArchitecturalLightingConfig(
  timeOfDay: TimeOfDay,
  entryDir: string,
  centerX: number,
  centerZ: number,
  effectiveDim: number
): LightingRigConfig {
  const sunAngle = resolveSunAzimuthAngle(entryDir);
  const sunDist = Math.max(effectiveDim * 1.4, 85);
  const frustumSize = Math.max(effectiveDim * 1.3, 50);

  const sunX = centerX + Math.cos(sunAngle) * sunDist;
  const sunZ = centerZ + Math.sin(sunAngle) * sunDist;

  if (timeOfDay === 'night') {
    return {
      timeOfDay: 'night',
      toneMappingExposure: 1.05,
      backgroundColor: '#0a0f1d',
      fogColor: '#0d1326',
      fogDensity: 0.0016,
      sky: {
        sunPosition: [sunX, -25, sunZ], // Below horizon
        turbidity: 15,
        rayleigh: 0.1,
        mieCoefficient: 0.001,
        mieDirectionalG: 0.8,
      },
      directionalLight: {
        color: '#a5c9f3', // Cool soft silver-blue moonlight
        intensity: 0.68,
        position: [centerX + 35, 75, centerZ + 35],
        castShadow: true,
        shadowMapSize: 2048,
        shadowBias: -0.0003,
        shadowNormalBias: 0.025,
        shadowCameraNear: 1.0,
        shadowCameraFar: Math.max(effectiveDim * 5, 450),
        shadowFrustumSize: frustumSize,
      },
      hemisphereLight: {
        skyColor: '#1e293b', // Deep midnight blue sky bounce
        groundColor: '#0b1120', // Dark ground bounce
        intensity: 0.52,
      },
      ambientLight: {
        color: '#1e293b',
        intensity: 0.38,
      },
      interiorGlow: {
        color: '#ffedd5', // Warm 2700K incandescent interior architectural spill
        intensity: 1.25,
        distance: Math.max(effectiveDim * 0.85, 45),
      },
    };
  }

  if (timeOfDay === 'morning') {
    return {
      timeOfDay: 'morning',
      toneMappingExposure: 1.05,
      backgroundColor: '#0c1017',
      fogColor: '#0d131f',
      fogDensity: 0.0018,
      sky: {
        sunPosition: [sunX, 32, sunZ], // Early morning sun angle
        turbidity: 3.2,
        rayleigh: 0.52,
        mieCoefficient: 0.008,
        mieDirectionalG: 0.82,
      },
      directionalLight: {
        color: '#fff6e5', // Crisp morning gold
        intensity: 2.05,
        position: [sunX, 32, sunZ],
        castShadow: true,
        shadowMapSize: 2048,
        shadowBias: -0.0003,
        shadowNormalBias: 0.025,
        shadowCameraNear: 1.0,
        shadowCameraFar: Math.max(effectiveDim * 5, 450),
        shadowFrustumSize: frustumSize,
      },
      hemisphereLight: {
        skyColor: '#bae6fd',
        groundColor: '#364d25',
        intensity: 0.72,
      },
      ambientLight: {
        color: '#475569',
        intensity: 0.25,
      },
      interiorGlow: {
        color: '#fef3c7',
        intensity: 0.45,
        distance: Math.max(effectiveDim * 0.6, 35),
      },
    };
  }

  if (timeOfDay === 'sunset' || timeOfDay === 'golden_hour') {
    return {
      timeOfDay: timeOfDay === 'golden_hour' ? 'golden_hour' : 'sunset',
      toneMappingExposure: 1.02,
      backgroundColor: '#1f161a',
      fogColor: '#2b1719',
      fogDensity: 0.0022,
      sky: {
        sunPosition: [sunX, 14, sunZ], // Low golden-hour sun
        turbidity: 7.5,
        rayleigh: 2.6,
        mieCoefficient: 0.025,
        mieDirectionalG: 0.85,
      },
      directionalLight: {
        color: '#ff9c54', // Architectural honey amber
        intensity: 2.15,
        position: [sunX, 18, sunZ],
        castShadow: true,
        shadowMapSize: 2048,
        shadowBias: -0.0003,
        shadowNormalBias: 0.025,
        shadowCameraNear: 1.0,
        shadowCameraFar: Math.max(effectiveDim * 5, 450),
        shadowFrustumSize: frustumSize,
      },
      hemisphereLight: {
        skyColor: '#fb923c', // Warm sky bounce
        groundColor: '#3c2415', // Rich earthy ground reflection
        intensity: 0.68,
      },
      ambientLight: {
        color: '#78350f',
        intensity: 0.28,
      },
      interiorGlow: {
        color: '#fed7aa',
        intensity: 0.55,
        distance: Math.max(effectiveDim * 0.6, 35),
      },
    };
  }

  // Daylight / Noon (Clean crisp sunlight with balanced bounce)
  return {
    timeOfDay: timeOfDay === 'noon' ? 'noon' : 'day',
    toneMappingExposure: 1.08,
    backgroundColor: '#090a0f',
    fogColor: '#090a0f',
    fogDensity: 0.0016,
    sky: {
      sunPosition: [sunX, 65, sunZ],
      turbidity: 2.4,
      rayleigh: 0.32,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
    },
    directionalLight: {
      color: '#fffbf0', // High-noon crisp sunlight
      intensity: 1.95,
      position: [sunX, 65, sunZ],
      castShadow: true,
      shadowMapSize: 2048,
      shadowBias: -0.0004,
      shadowNormalBias: 0.025,
      shadowCameraNear: 1.0,
      shadowCameraFar: Math.max(effectiveDim * 5, 450),
      shadowFrustumSize: frustumSize,
    },
    hemisphereLight: {
      skyColor: '#e0f2fe', // Soft atmospheric sky blue
      groundColor: '#4d6836', // Grass green bounce onto floor ceilings
      intensity: 0.78,
    },
    ambientLight: {
      color: '#64748b',
      intensity: 0.24,
    },
    interiorGlow: {
      color: '#fef3c7',
      intensity: 0.35,
      distance: Math.max(effectiveDim * 0.5, 30),
    },
  };
}

// ── Camera Framing Calculation ───────────────────────────────────────────────

export function calculateCameraFraming(input: CameraFramingInput): CameraFramingResult {
  const {
    bounds,
    plotBounds,
    isLandscapingEnabled = false,
    viewMode,
    activeFloorIndex,
    numFloors,
    preset,
    fov = 45,
  } = input;

  // Resolve 2D bounding span across X and Z
  let minX = bounds.minX;
  let maxX = bounds.maxX;
  let minZ = bounds.minZ;
  let maxZ = bounds.maxZ;

  // Include subtle landscaping breathing room when enabled, without pushing building into distance
  if (isLandscapingEnabled && plotBounds) {
    minX = Math.min(minX, bounds.minX - Math.min(8, Math.max(0, (bounds.minX - plotBounds.minX) * 0.25)));
    maxX = Math.max(maxX, bounds.maxX + Math.min(8, Math.max(0, (plotBounds.maxX - bounds.maxX) * 0.25)));
    minZ = Math.min(minZ, bounds.minZ - Math.min(8, Math.max(0, (bounds.minZ - plotBounds.minZ) * 0.25)));
    maxZ = Math.max(maxZ, bounds.maxZ + Math.min(8, Math.max(0, (plotBounds.maxZ - bounds.maxZ) * 0.25)));
  }

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const spanX = bounds.width !== undefined ? bounds.width : (maxX - minX);
  const spanZ = bounds.depth !== undefined ? bounds.depth : (maxZ - minZ);
  const effectiveDim = Math.max(spanX, spanZ, 20);

  // Determine vertical framing center (targetY) and height
  const safeTotalHeight = typeof bounds.totalHeight === 'number' && !isNaN(bounds.totalHeight)
    ? bounds.totalHeight
    : ((bounds as any).height ?? (bounds.maxZ !== undefined && bounds.minZ !== undefined ? Math.abs(bounds.maxZ - bounds.minZ) : 10.0));

  let targetY = 5.0; // Half standard 10ft room
  let effectiveHeight = 10.0;

  if (viewMode === 'single') {
    // Single isolated floor sits at grade Y = 0
    targetY = input.activeFloorElevation !== undefined ? input.activeFloorElevation : 5.0;
    effectiveHeight = 10.0;
  } else if (viewMode === 'active') {
    // Focus on active floor at its elevation
    const floorElevation = input.activeFloorElevation ?? ((activeFloorIndex ?? 0) * 10.83);
    targetY = floorElevation + 5.0;
    effectiveHeight = 10.0;
  } else if (viewMode === 'exploded') {
    // Multi-floor exploded stack
    const explodedPitch = 10.83 + 14.0; // 24.83 ft per floor
    const totalExplodedHeight = Math.max((numFloors ?? 1) * explodedPitch, 20);
    targetY = totalExplodedHeight / 2;
    effectiveHeight = totalExplodedHeight;
  } else {
    // Stacked full building
    targetY = Math.max(safeTotalHeight / 2, 5.0);
    effectiveHeight = Math.max(safeTotalHeight, 10.0);
  }

  const fovRad = (fov * Math.PI) / 180;
  const halfFovTan = Math.tan(fovRad / 2);

  // ── SPECIALIZED FOCUS MODES ───────────────────────────────────────────────
  // Focus Room Mode
  if (input.focusRoomBounds) {
    const { x, y, width, height } = input.focusRoomBounds;
    const roomCenterX = x + width / 2;
    const roomCenterZ = y + height / 2;
    const roomRadius = Math.hypot(width / 2, height / 2, 5.0);
    const roomFitDist = Math.max(16, (roomRadius / halfFovTan) * 1.15);
    const elevRad = (36 * Math.PI) / 180;
    const azimRad = (45 * Math.PI) / 180;
    return {
      targetLookAt: { x: roomCenterX, y: targetY, z: roomCenterZ },
      targetPosition: {
        x: roomCenterX + roomFitDist * Math.cos(elevRad) * Math.sin(azimRad),
        y: targetY + roomFitDist * Math.sin(elevRad),
        z: roomCenterZ + roomFitDist * Math.cos(elevRad) * Math.cos(azimRad),
      },
      minDistance: 2.0,
      maxDistance: 600,
      near: 0.5,
      far: 3500,
      effectiveDim: Math.max(width, height),
      fitDistance: roomFitDist,
    };
  }

  // Focus Furniture Item Mode
  if (input.focusItem) {
    const { positionFt, dimensionsFt } = input.focusItem;
    const itemCenterX = positionFt.x + dimensionsFt.width / 2;
    const itemCenterY = positionFt.y + dimensionsFt.height / 2;
    const itemCenterZ = positionFt.z + dimensionsFt.depth / 2;
    const itemRadius = Math.hypot(dimensionsFt.width / 2, dimensionsFt.depth / 2, dimensionsFt.height / 2);
    const itemFitDist = Math.max(8, (itemRadius / halfFovTan) * 1.25);
    const elevRad = (32 * Math.PI) / 180;
    const azimRad = (45 * Math.PI) / 180;
    return {
      targetLookAt: { x: itemCenterX, y: itemCenterY, z: itemCenterZ },
      targetPosition: {
        x: itemCenterX + itemFitDist * Math.cos(elevRad) * Math.sin(azimRad),
        y: itemCenterY + itemFitDist * Math.sin(elevRad),
        z: itemCenterZ + itemFitDist * Math.cos(elevRad) * Math.cos(azimRad),
      },
      minDistance: 1.0,
      maxDistance: 600,
      near: 0.5,
      far: 3500,
      effectiveDim: Math.max(dimensionsFt.width, dimensionsFt.depth),
      fitDistance: itemFitDist,
    };
  }

  // ── STANDARD BUILDING FRAMING ─────────────────────────────────────────────
  // Frustum fit distance based on 3D bounding sphere
  const sphereRadius = Math.hypot(spanX / 2, spanZ / 2, effectiveHeight / 2);
  const baseFitDistance = (sphereRadius / halfFovTan) * 1.15;
  const fitDistance = Math.max(baseFitDistance, 28);

  // Preset positions
  let camX = centerX;
  let camY = targetY;
  let camZ = centerZ;

  if (preset === 'topdown') {
    // Top-down Orthographic-style Plan View
    camX = centerX + 0.001; // Slight epsilon prevents lookAt singularity along Y axis
    camY = targetY + fitDistance * 1.05;
    camZ = centerZ;
  } else if (preset === 'isometric') {
    // True Axonometric 45° elevation angle
    const isoSpan = fitDistance * 0.72;
    camX = centerX + isoSpan;
    camY = targetY + fitDistance * 0.62;
    camZ = centerZ + isoSpan;
  } else if (preset === 'front') {
    // South / Front Elevation View
    camX = centerX;
    camY = targetY + 1.5;
    camZ = centerZ - fitDistance * 0.95;
  } else if (preset === 'side') {
    // East / Side Elevation View
    camX = centerX - fitDistance * 0.95;
    camY = targetY + 1.5;
    camZ = centerZ;
  } else if (preset === 'exterior') {
    // Cinematic Low-Angle Exterior Beauty View (Architectural Photograph Framing)
    const extDist = fitDistance * 0.88;
    camX = centerX + extDist * 0.72;
    camY = Math.max(3.5, bounds.totalHeight * 0.28);
    camZ = centerZ + extDist * 0.72;
  } else if (preset === 'interior') {
    // Interior Eye-Level View (5.5 ft above active floor level)
    camX = centerX;
    camY = targetY + 0.5;
    camZ = centerZ + Math.min(spanZ * 0.25, 6.0);
  } else {
    // Perspective / Dollhouse 3D view (36° elevation, 45° azimuth)
    const elevRad = (36 * Math.PI) / 180;
    const azimRad = (45 * Math.PI) / 180;
    camX = centerX + fitDistance * Math.cos(elevRad) * Math.sin(azimRad);
    camY = targetY + fitDistance * Math.sin(elevRad);
    camZ = centerZ + fitDistance * Math.cos(elevRad) * Math.cos(azimRad);
  }

  const minDistance = 4.0;
  const maxDistance = Math.max(fitDistance * 4.5, 600);
  const near = 0.5;
  const far = Math.max(fitDistance * 10, 3000);

  return {
    targetLookAt: { x: centerX, y: targetY, z: centerZ },
    targetPosition: { x: camX, y: camY, z: camZ },
    minDistance,
    maxDistance,
    near,
    far,
    effectiveDim,
    fitDistance,
  };
}
