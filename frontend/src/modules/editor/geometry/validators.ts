/**
 * validators.ts
 * ============================================================================
 * Pure Geometric & Architectural Validators for CanonicalBuildingDocument.
 *
 * Checks:
 *   1. Wall Non-Crossing (no intersections between non-adjacent walls)
 *   2. Opening Fit & Clearance (openings fit within wall bounds, no overlap)
 *   3. Room Polygon Non-Overlap (no spatial collisions between distinct rooms)
 *   4. Minimum Room Dimensions (habitable rooms meet NBC / minimum sizing)
 *   5. Site Plot Containment (all nodes remain within plot boundary polygon)
 *   6. Circulation Reachability (habitable rooms reachable via door graph)
 * ============================================================================
 */

import type {
  CanonicalBuildingDocument,
  Level,
  WallNode,
  Wall,
  Opening,
  CanonicalRoom,
  ValidationIssue,
  ValidationResult,
  Point2D,
} from './types';

// ── Math Helpers ─────────────────────────────────────────────────────────────

function getNode(level: Level, nodeId: string): WallNode | undefined {
  return level.nodes.find(n => n.id === nodeId);
}

function wallLength(w: Wall, level: Level): number {
  const n1 = getNode(level, w.startNodeId);
  const n2 = getNode(level, w.endNodeId);
  if (!n1 || !n2) return 0;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function ccw(A: Point2D, B: Point2D, C: Point2D): boolean {
  return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
}

/**
 * Returns true if line segment AB intersects line segment CD in 2D space.
 * Excludes shared endpoints and valid T-junction terminations (permitted in architectural graphs).
 */
export function doSegmentsIntersect(
  A: Point2D,
  B: Point2D,
  C: Point2D,
  D: Point2D,
  tolerance = 0.02
): boolean {
  // Check if endpoints are identical or coincident within coordinate tolerance
  const dAC = Math.hypot(A.x - C.x, A.y - C.y);
  const dAD = Math.hypot(A.x - D.x, A.y - D.y);
  const dBC = Math.hypot(B.x - C.x, B.y - C.y);
  const dBD = Math.hypot(B.x - D.x, B.y - D.y);
  if (dAC < tolerance || dAD < tolerance || dBC < tolerance || dBD < tolerance) {
    return false; // permitted shared vertex / corner
  }

  // Check if an endpoint touches or terminates on the other segment (T-junction)
  function pointToSegDist(p: Point2D, s1: Point2D, s2: Point2D): number {
    const dx = s2.x - s1.x;
    const dy = s2.y - s1.y;
    const lSq = dx * dx + dy * dy;
    if (lSq < 1e-9) return Math.hypot(p.x - s1.x, p.y - s1.y);
    const t = Math.max(0, Math.min(1, ((p.x - s1.x) * dx + (p.y - s1.y) * dy) / lSq));
    return Math.hypot(p.x - (s1.x + t * dx), p.y - (s1.y + t * dy));
  }

  if (
    pointToSegDist(C, A, B) < tolerance ||
    pointToSegDist(D, A, B) < tolerance ||
    pointToSegDist(A, C, D) < tolerance ||
    pointToSegDist(B, C, D) < tolerance
  ) {
    return false; // permitted T-junction
  }

  return (
    ccw(A, C, D) !== ccw(B, C, D) &&
    ccw(A, B, C) !== ccw(A, B, D)
  );
}

/**
 * Returns true if a 2D point is inside a polygon using ray-casting.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[], tolerance = 0.25): boolean {
  // Check if point lies on any boundary edge segment within tolerance
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const p1 = polygon[j];
    const p2 = polygon[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq > 1e-9) {
      const t = Math.max(0, Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq));
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      const dist = Math.hypot(point.x - projX, point.y - projY);
      if (dist < tolerance) {
        return true;
      }
    }
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes polygon area using the Shoelace formula.
 */
export function polygonArea(points: Point2D[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

// ── Validator 1: Wall Non-Crossing ──────────────────────────────────────────

export function validateWallNonCrossing(level: Level): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const walls = level.walls;
  const WALL_ENDPOINT_TOL = 0.02; // 2cm endpoint coincidence
  const WALL_TJ_TOL = 0.025;      // 2.5cm T-junction clearance

  for (let i = 0; i < walls.length; i++) {
    const w1 = walls[i];
    const a1 = getNode(level, w1.startNodeId);
    const b1 = getNode(level, w1.endNodeId);
    if (!a1 || !b1) continue;

    const dx1 = b1.x - a1.x;
    const dy1 = b1.y - a1.y;
    const len1Sq = dx1 * dx1 + dy1 * dy1;
    const len1 = Math.sqrt(len1Sq);
    if (len1 < 1e-4) continue;

    for (let j = i + 1; j < walls.length; j++) {
      const w2 = walls[j];
      const a2 = getNode(level, w2.startNodeId);
      const b2 = getNode(level, w2.endNodeId);
      if (!a2 || !b2) continue;

      const dx2 = b2.x - a2.x;
      const dy2 = b2.y - a2.y;
      const len2Sq = dx2 * dx2 + dy2 * dy2;
      const len2 = Math.sqrt(len2Sq);
      if (len2 < 1e-4) continue;

      // 1. Shared Node / Endpoint Coincidence
      const sharesNodeId =
        w1.startNodeId === w2.startNodeId ||
        w1.startNodeId === w2.endNodeId ||
        w1.endNodeId === w2.startNodeId ||
        w1.endNodeId === w2.endNodeId;

      const dA1A2 = Math.hypot(a1.x - a2.x, a1.y - a2.y);
      const dA1B2 = Math.hypot(a1.x - b2.x, a1.y - b2.y);
      const dB1A2 = Math.hypot(b1.x - a2.x, b1.y - a2.y);
      const dB1B2 = Math.hypot(b1.x - b2.x, b1.y - b2.y);
      const sharesEndpointGeom = Math.min(dA1A2, dA1B2, dB1A2, dB1B2) < WALL_ENDPOINT_TOL;

      if (sharesNodeId || sharesEndpointGeom) {
        continue; // Permitted shared vertex
      }

      // 2. Collinear / Parallel walls do not cross at an interior point
      const cross = dx1 * dy2 - dy1 * dx2;
      if (Math.abs(cross) / (len1 * len2) < 0.02) {
        continue; // Parallel or collinear along shared axis
      }

      // 3. T-junction Check (one endpoint touches or terminates on the other wall)
      function ptSegDist(p: Point2D, s1: Point2D, s2: Point2D, lSq: number): { dist: number; t: number } {
        const t = ((p.x - s1.x) * (s2.x - s1.x) + (p.y - s1.y) * (s2.y - s1.y)) / lSq;
        const clampedT = Math.max(0, Math.min(1, t));
        const px = s1.x + clampedT * (s2.x - s1.x);
        const py = s1.y + clampedT * (s2.y - s1.y);
        return { dist: Math.hypot(p.x - px, p.y - py), t };
      }

      const tjA2 = ptSegDist(a2, a1, b1, len1Sq);
      const tjB2 = ptSegDist(b2, a1, b1, len1Sq);
      const tjA1 = ptSegDist(a1, a2, b2, len2Sq);
      const tjB1 = ptSegDist(b1, a2, b2, len2Sq);

      if (
        (tjA2.dist < WALL_TJ_TOL && tjA2.t >= -0.01 && tjA2.t <= 1.01) ||
        (tjB2.dist < WALL_TJ_TOL && tjB2.t >= -0.01 && tjB2.t <= 1.01) ||
        (tjA1.dist < WALL_TJ_TOL && tjA1.t >= -0.01 && tjA1.t <= 1.01) ||
        (tjB1.dist < WALL_TJ_TOL && tjB1.t >= -0.01 && tjB1.t <= 1.01)
      ) {
        continue; // Permitted T-junction
      }

      // 4. True Interior Crossing Check
      if (Math.abs(cross) > 1e-5) {
        const qMinusP = { x: a2.x - a1.x, y: a2.y - a1.y };
        const t = (qMinusP.x * dy2 - qMinusP.y * dx2) / cross;
        const u = (qMinusP.x * dy1 - qMinusP.y * dx1) / cross;
        const margin1 = WALL_ENDPOINT_TOL / len1;
        const margin2 = WALL_ENDPOINT_TOL / len2;

        if (t > margin1 && t < 1 - margin1 && u > margin2 && u < 1 - margin2) {
          const ptX = Math.round((a1.x + t * dx1) * 1000) / 1000;
          const ptY = Math.round((a1.y + t * dy1) * 1000) / 1000;
          issues.push({
            code: 'WALL_INTERSECTION',
            severity: 'error',
            message: `Wall ${w1.id} intersects Wall ${w2.id} at (${ptX.toFixed(2)}, ${ptY.toFixed(2)}m) without a shared node.`,
            entityId: w1.id,
            levelId: level.id,
          });
        }
      }
    }
  }

  return issues;
}

// ── Validator 2: Opening Fit & Corner Clearance ──────────────────────────────

export function validateOpeningFit(level: Level): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const CORNER_MARGIN = 0.15; // 0.15m (~6 in) clearance from wall corners

  const openingsByWall = new Map<string, Opening[]>();
  for (const op of level.openings) {
    const list = openingsByWall.get(op.wallId) || [];
    list.push(op);
    openingsByWall.set(op.wallId, list);
  }

  for (const wall of level.walls) {
    const len = wallLength(wall, level);
    if (len <= 0) continue;

    const ops = openingsByWall.get(wall.id) || [];
    for (const op of ops) {
      const start = op.offset - op.width / 2;
      const end = op.offset + op.width / 2;

      // 1. Check if opening exceeds wall length
      if (start < CORNER_MARGIN || end > len - CORNER_MARGIN) {
        issues.push({
          code: 'OPENING_OUT_OF_BOUNDS',
          severity: 'error',
          message: `Opening '${op.name || op.id}' (${op.width.toFixed(2)}m) does not fit on Wall ${wall.id} (length ${len.toFixed(2)}m, required clearance 0.15m).`,
          entityId: op.id,
          levelId: level.id,
        });
      }
    }

    // 2. Check for overlapping openings on same wall
    for (let i = 0; i < ops.length; i++) {
      const op1 = ops[i];
      const s1 = op1.offset - op1.width / 2;
      const e1 = op1.offset + op1.width / 2;

      for (let j = i + 1; j < ops.length; j++) {
        const op2 = ops[j];
        const s2 = op2.offset - op2.width / 2;
        const e2 = op2.offset + op2.width / 2;

        if (Math.max(s1, s2) < Math.min(e1, e2)) {
          issues.push({
            code: 'OPENING_OVERLAP',
            severity: 'error',
            message: `Openings '${op1.name || op1.id}' and '${op2.name || op2.id}' overlap on Wall ${wall.id}.`,
            entityId: op1.id,
            levelId: level.id,
          });
        }
      }
    }
  }

  return issues;
}

// ── Strict Segment Crossing & Polygon Intersection ─────────────────────────

export function doSegmentsCrossStrictly(
  A: Point2D,
  B: Point2D,
  C: Point2D,
  D: Point2D,
  eps = 1e-4
): boolean {
  const cross = (p: Point2D, q: Point2D, r: Point2D) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  const c1 = cross(A, B, C);
  const c2 = cross(A, B, D);
  const c3 = cross(C, D, A);
  const c4 = cross(C, D, B);

  return (
    ((c1 > eps && c2 < -eps) || (c1 < -eps && c2 > eps)) &&
    ((c3 > eps && c4 < -eps) || (c3 < -eps && c4 > eps))
  );
}

export function doPolygonsCrossStrictly(poly1: Point2D[], poly2: Point2D[]): boolean {
  for (let i = 0; i < poly1.length; i++) {
    const a1 = poly1[i];
    const a2 = poly1[(i + 1) % poly1.length];
    for (let j = 0; j < poly2.length; j++) {
      const b1 = poly2[j];
      const b2 = poly2[(j + 1) % poly2.length];
      if (doSegmentsCrossStrictly(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

function isClockwise(poly: Point2D[]): boolean {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    sum += (poly[j].x - poly[i].x) * (poly[j].y + poly[i].y);
  }
  return sum > 0;
}

function ensureCCW(poly: Point2D[]): Point2D[] {
  return isClockwise(poly) ? [...poly].reverse() : [...poly];
}

function clipPolygonByEdge(polygon: Point2D[], A: Point2D, B: Point2D): Point2D[] {
  const output: Point2D[] = [];
  if (polygon.length === 0) return output;

  const isInside = (p: Point2D) => {
    return (B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x) >= -1e-6;
  };

  const lineIntersection = (p1: Point2D, p2: Point2D): Point2D => {
    const a1 = B.y - A.y;
    const b1 = A.x - B.x;
    const c1 = a1 * A.x + b1 * A.y;

    const a2 = p2.y - p1.y;
    const b2 = p1.x - p2.x;
    const c2 = a2 * p1.x + b2 * p1.y;

    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-9) return p1;
    return {
      x: (b2 * c1 - b1 * c2) / det,
      y: (a1 * c2 - a2 * c1) / det,
    };
  };

  let prev = polygon[polygon.length - 1];
  let prevInside = isInside(prev);

  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const currInside = isInside(curr);

    if (currInside) {
      if (!prevInside) {
        output.push(lineIntersection(prev, curr));
      }
      output.push(curr);
    } else if (prevInside) {
      output.push(lineIntersection(prev, curr));
    }
    prev = curr;
    prevInside = currInside;
  }

  return output;
}

export function polygonIntersectionArea(poly1: Point2D[], poly2: Point2D[]): number {
  if (poly1.length < 3 || poly2.length < 3) return 0;
  const p1 = ensureCCW(poly1);
  const p2 = ensureCCW(poly2);

  let clipped = p1;
  for (let i = 0; i < p2.length; i++) {
    const j = (i + 1) % p2.length;
    clipped = clipPolygonByEdge(clipped, p2[i], p2[j]);
    if (clipped.length < 3) return 0;
  }
  return polygonArea(clipped);
}

// ── Validator 3: Room Polygon Overlap ────────────────────────────────────────

export function validateRoomNoOverlap(level: Level): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rooms = level.rooms;

  const roomPolys: { room: CanonicalRoom; poly: Point2D[]; area: number }[] = [];

  for (const room of rooms) {
    const poly: Point2D[] = [];
    for (const nid of room.boundaryNodeIds) {
      const n = getNode(level, nid);
      if (n) poly.push({ x: n.x, y: n.y });
    }
    const area = poly.length >= 3 ? polygonArea(poly) : 0;
    roomPolys.push({ room, poly, area });
  }

  for (let i = 0; i < roomPolys.length; i++) {
    const r1 = roomPolys[i];
    if (r1.poly.length < 3) continue;

    for (let j = i + 1; j < roomPolys.length; j++) {
      const r2 = roomPolys[j];
      if (r2.poly.length < 3) continue;

      // Check if edges strictly cross, or if polygon intersection area > 0.02 m²
      const edgesCross = doPolygonsCrossStrictly(r1.poly, r2.poly);
      const isectArea = polygonIntersectionArea(r1.poly, r2.poly);
      const overlaps = edgesCross || isectArea > 0.02;

      if (overlaps) {
        issues.push({
          code: 'ROOM_OVERLAP',
          severity: 'error',
          message: `Room '${r1.room.name}' overlaps with Room '${r2.room.name}' (overlap area: ${isectArea.toFixed(2)}m²).`,
          entityId: r1.room.id,
          levelId: level.id,
        });
      }
    }
  }

  return issues;
}

// ── Validator 4: Minimum Room Dimensions ────────────────────────────────────

export function validateMinRoomDimensions(level: Level): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const MIN_DIMENSION_GENERAL = 1.5;   // 1.5m minimum for any space (bath, store)
  const MIN_DIMENSION_HABITABLE = 2.4; // 2.4m (~8ft) minimum for bedrooms, living, dining

  for (const room of level.rooms) {
    const poly: Point2D[] = [];
    for (const nid of room.boundaryNodeIds) {
      const n = getNode(level, nid);
      if (n) poly.push({ x: n.x, y: n.y });
    }
    if (poly.length < 3) continue;

    const xs = poly.map(p => p.x);
    const ys = poly.map(p => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);

    const name = room.name.toLowerCase();
    const isHabitable =
      name.includes('bed') || name.includes('living') || name.includes('dining') || name.includes('lounge');

    const minAllowed = isHabitable ? MIN_DIMENSION_HABITABLE : MIN_DIMENSION_GENERAL;

    if (spanX < minAllowed || spanY < minAllowed) {
      issues.push({
        code: 'MIN_ROOM_DIMENSION',
        severity: 'warning',
        message: `Room '${room.name}' dimension (${spanX.toFixed(2)}×${spanY.toFixed(2)}m) is below recommended minimum (${minAllowed}m).`,
        entityId: room.id,
        levelId: level.id,
      });
    }
  }

  return issues;
}

// ── Validator 5: Site Plot Containment ──────────────────────────────────────

export function validatePlotContainment(doc: CanonicalBuildingDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const plot = doc.site.plotPolygon;
  if (!plot || plot.length < 3) return issues;

  const BOUNDARY_TOLERANCE = 0.25; // 250mm (~10in) architectural tolerance for wall thickness and float precision

  for (const level of doc.levels) {
    for (const node of level.nodes) {
      if (!isPointInPolygon(node, plot, BOUNDARY_TOLERANCE)) {
        issues.push({
          code: 'PLOT_BOUNDARY_VIOLATION',
          severity: 'error',
          message: `WallNode ${node.id} at (${node.x.toFixed(2)}, ${node.y.toFixed(2)}m) is outside site plot boundaries.`,
          entityId: node.id,
          levelId: level.id,
        });
      }
    }
  }

  return issues;
}

// ── Validator 6: Circulation Reachability ───────────────────────────────────

export function validateCirculationReachability(level: Level): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const doorOpenings = level.openings.filter(op => {
    const t = String(op.type || (op as any).openingType || '');
    return t.includes('door') || t === 'opening';
  });

  if (level.rooms.length === 0 || doorOpenings.length === 0) {
    return issues;
  }

  // Find entrance room (Foyer, Entrance, Living Room, or first room)
  const entryRoom =
    level.rooms.find(r => {
      const n = r.name.toLowerCase();
      return n.includes('foyer') || n.includes('entrance') || n.includes('hall');
    }) || level.rooms[0];

  // Build room-to-wall mapping
  const roomWalls = new Map<string, Set<string>>();
  for (const room of level.rooms) {
    const wallSet = new Set<string>();
    const nids = room.boundaryNodeIds;
    for (let i = 0; i < nids.length; i++) {
      const n1 = nids[i];
      const n2 = nids[(i + 1) % nids.length];
      const matchingWall = level.walls.find(
        w => (w.startNodeId === n1 && w.endNodeId === n2) || (w.startNodeId === n2 && w.endNodeId === n1)
      );
      if (matchingWall) wallSet.add(matchingWall.id);
    }
    roomWalls.set(room.id, wallSet);
  }

  // Build room adjacency graph via doors
  const adj = new Map<string, Set<string>>();
  for (const room of level.rooms) {
    adj.set(room.id, new Set<string>());
  }

  for (const door of doorOpenings) {
    const hostWallId = door.wallId;
    const connectedRooms = level.rooms.filter(r => roomWalls.get(r.id)?.has(hostWallId));
    if (connectedRooms.length >= 2) {
      const rA = connectedRooms[0].id;
      const rB = connectedRooms[1].id;
      adj.get(rA)?.add(rB);
      adj.get(rB)?.add(rA);
    }
  }

  // BFS Reachability from entryRoom
  const visited = new Set<string>();
  const queue: string[] = [entryRoom.id];
  visited.add(entryRoom.id);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adj.get(curr) || new Set();
    for (const nb of neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }

  for (const room of level.rooms) {
    const name = room.name.toLowerCase();
    // Voids and outdoor balconies are exempt
    if (name.includes('void') || name.includes('terrace') || name.includes('balcony')) continue;

    if (!visited.has(room.id) && level.rooms.length > 2) {
      issues.push({
        code: 'LANDLOCKED_ROOM',
        severity: 'warning',
        message: `Habitable space '${room.name}' has no direct door connectivity to the main circulation path.`,
        entityId: room.id,
        levelId: level.id,
      });
    }
  }

  return issues;
}

// ── Composite Validator ─────────────────────────────────────────────────────

export function validateCanonicalDocument(doc: CanonicalBuildingDocument): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Plot containment
  issues.push(...validatePlotContainment(doc));

  // Per-level checks
  for (const level of doc.levels) {
    issues.push(...validateWallNonCrossing(level));
    issues.push(...validateOpeningFit(level));
    issues.push(...validateRoomNoOverlap(level));
    issues.push(...validateMinRoomDimensions(level));
    issues.push(...validateCirculationReachability(level));
  }

  const hasCriticalErrors = issues.some(i => i.severity === 'error');
  return {
    valid: !hasCriticalErrors,
    issues,
  };
}

// ── Dedicated Furniture Command Validator ───────────────────────────────────

export function validateFurnitureCommand(
  doc: CanonicalBuildingDocument,
  _command?: any
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const level of doc.levels) {
    for (const item of level.items) {
      // 1. Dimensions must be positive, finite numbers
      if (
        !Number.isFinite(item.width) || item.width <= 0 ||
        !Number.isFinite(item.depth) || item.depth <= 0 ||
        !Number.isFinite(item.height) || item.height <= 0
      ) {
        issues.push({
          code: 'INVALID_FURNITURE_DIMENSIONS',
          severity: 'error',
          message: `Furniture '${item.name || item.id}' must have positive dimensions (got ${item.width}×${item.depth}×${item.height}m).`,
          entityId: item.id,
          levelId: level.id,
        });
      }

      // 2. Position must be finite
      if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) {
        issues.push({
          code: 'INVALID_FURNITURE_POSITION',
          severity: 'error',
          message: `Furniture '${item.name || item.id}' has non-finite position (${item.x}, ${item.y}).`,
          entityId: item.id,
          levelId: level.id,
        });
      }

      // 3. Containment within authoritative site plot boundaries (0.15m tolerance for perimeter wall thickness & precision)
      const plotWM = doc.site.width || 0;
      const plotLM = doc.site.length || 0;
      const TOLERANCE = 0.30; // 300mm (~12in) architectural tolerance for exterior wall envelope thickness & float precision

      // Validate item center and rotated corner footprint
      const halfW = (item.width || 1) / 2;
      const halfD = (item.depth || 1) / 2;
      const rad = (((item.rotation || 0) % 360) * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const boundHalfX = halfW * cos + halfD * sin;
      const boundHalfY = halfW * sin + halfD * cos;

      const itemMinX = item.x - boundHalfX;
      const itemMaxX = item.x + boundHalfX;
      const itemMinY = item.y - boundHalfY;
      const itemMaxY = item.y + boundHalfY;

      let isOutOfBounds = false;
      if (plotWM > 0 && plotLM > 0) {
        if (
          itemMinX < -TOLERANCE || itemMaxX > plotWM + TOLERANCE ||
          itemMinY < -TOLERANCE || itemMaxY > plotLM + TOLERANCE
        ) {
          isOutOfBounds = true;
        }
      }

      // If a polygonal plot is defined, also verify all 4 rotated footprint corners
      if (!isOutOfBounds && doc.site.plotPolygon && doc.site.plotPolygon.length >= 3) {
        const radExact = (((item.rotation || 0) % 360) * Math.PI) / 180;
        const cCos = Math.cos(radExact);
        const cSin = Math.sin(radExact);
        const corners: Point2D[] = [
          { x: item.x - halfW * cCos + halfD * cSin, y: item.y - halfW * cSin - halfD * cCos },
          { x: item.x + halfW * cCos + halfD * cSin, y: item.y + halfW * cSin - halfD * cCos },
          { x: item.x + halfW * cCos - halfD * cSin, y: item.y + halfW * cSin + halfD * cCos },
          { x: item.x - halfW * cCos - halfD * cSin, y: item.y - halfW * cSin + halfD * cCos },
        ];
        for (const pt of corners) {
          if (!isPointInPolygon(pt, doc.site.plotPolygon, TOLERANCE)) {
            isOutOfBounds = true;
            break;
          }
        }
      }

      if (isOutOfBounds) {
        issues.push({
          code: 'FURNITURE_OUT_OF_BOUNDS',
          severity: 'error',
          message: `Furniture '${item.name || item.id}' is placed outside the site plot boundary.`,
          entityId: item.id,
          levelId: level.id,
        });
      }
    }
  }

  const hasCriticalErrors = issues.some(i => i.severity === 'error');
  return {
    valid: !hasCriticalErrors,
    issues,
  };
}
