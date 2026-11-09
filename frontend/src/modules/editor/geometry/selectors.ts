/**
 * selectors.ts
 * ============================================================================
 * Pure Derived Selectors & Legacy Projections.
 *
 * Core rule:
 * Derived data (areas, centroids, schedules, adjacencies, legacy format)
 * is ALWAYS computed on-demand from the CanonicalBuildingDocument and
 * NEVER stored as authoritative state.
 * ============================================================================
 */

import type {
  CanonicalBuildingDocument,
  Level,
  CanonicalRoom,
  Point2D,
} from './types';
import { mToFt } from './types';
import { polygonArea } from './validators';
import type { Floor, Room as LegacyRoom, FurnitureItem, WindowSpec, LightProperties } from '../../../shared/api-client/api';

/**
 * Returns the ordered 2D vertices of a room polygon.
 */
export function deriveRoomPolygon(room: CanonicalRoom, level: Level): Point2D[] {
  const points: Point2D[] = [];
  const nodeMap = new Map(level.nodes.map(n => [n.id, n]));
  for (const nid of room.boundaryNodeIds) {
    const node = nodeMap.get(nid);
    if (node) points.push({ x: node.x, y: node.y });
  }
  return points;
}

/**
 * Computes room area in square metres and square feet.
 */
export function deriveRoomArea(
  room: CanonicalRoom,
  level: Level
): { sqMetres: number; sqFeet: number } {
  const poly = deriveRoomPolygon(room, level);
  const sqMetres = poly.length >= 3 ? polygonArea(poly) : 0;
  const sqFeet = sqMetres * 10.7639; // 1 m² = 10.7639 sqft
  return {
    sqMetres: Math.round(sqMetres * 100) / 100,
    sqFeet: Math.round(sqFeet),
  };
}

/**
 * Computes centroid point of a room polygon.
 */
export function deriveRoomCentroid(room: CanonicalRoom, level: Level): Point2D {
  const poly = deriveRoomPolygon(room, level);
  if (poly.length === 0) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  for (const p of poly) {
    sumX += p.x;
    sumY += p.y;
  }
  return {
    x: Math.round((sumX / poly.length) * 100) / 100,
    y: Math.round((sumY / poly.length) * 100) / 100,
  };
}

/**
 * Computes bounding box of a room polygon in metres.
 */
export function deriveRoomBoundingBox(
  room: CanonicalRoom,
  level: Level
): { x: number; y: number; width: number; height: number } {
  const poly = deriveRoomPolygon(room, level);
  if (poly.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = poly.map(p => p.x);
  const ys = poly.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Computes room adjacency graph connected via door openings.
 */
export function deriveDoorAdjacency(level: Level): Map<string, string[]> {
  const adj = new Map<string, Set<string>>();
  for (const r of level.rooms) adj.set(r.id, new Set());

  const doorOpenings = level.openings.filter(o => o.type.includes('door') || o.type === 'opening');

  // Map each wall to incident rooms
  const wallRooms = new Map<string, string[]>();
  for (const room of level.rooms) {
    const nids = room.boundaryNodeIds;
    for (let i = 0; i < nids.length; i++) {
      const a = nids[i];
      const b = nids[(i + 1) % nids.length];
      for (const w of level.walls) {
        if ((w.startNodeId === a && w.endNodeId === b) || (w.startNodeId === b && w.endNodeId === a)) {
          const list = wallRooms.get(w.id) || [];
          list.push(room.id);
          wallRooms.set(w.id, list);
        }
      }
    }
  }

  for (const door of doorOpenings) {
    const rooms = wallRooms.get(door.wallId) || [];
    if (rooms.length >= 2) {
      adj.get(rooms[0])?.add(rooms[1]);
      adj.get(rooms[1])?.add(rooms[0]);
    }
  }

  const result = new Map<string, string[]>();
  for (const [k, v] of adj.entries()) {
    result.set(k, Array.from(v));
  }
  return result;
}

/**
 * PROJECTION ADAPTER:
 * Converts a CanonicalBuildingDocument into the legacy Floor[] structure (in feet).
 * Guarantees 100% backward compatibility with existing 2D and 3D viewers and exporters.
 */
export function canonicalToLegacyFloors(doc: CanonicalBuildingDocument): Floor[] {
  return doc.levels.map(level => {
    const nodeMap = new Map(level.nodes.map(n => [n.id, n]));

    // Precalculate bounding boxes for all rooms on this level
    const roomBboxes = level.rooms.map(room => ({
      room,
      bboxM: deriveRoomBoundingBox(room, level),
    }));

    // Pre-assign every level item to the most appropriate room so no furniture is lost
    const TOL = 0.25; // 25cm tolerance margin for boundary items
    const roomItemMap = new Map<string, typeof level.items>();
    for (const r of level.rooms) {
      roomItemMap.set(r.id, []);
    }

    for (const item of level.items || []) {
      const itemW = item.width || 0.5;
      const itemD = item.depth || 0.5;
      const cx = item.x + itemW / 2;
      const cy = item.y + itemD / 2;

      // 1. Direct roomId match (name or ID) — only if item is actually within/near that room
      const explicitRoomId = item.properties?.roomId as string | undefined;
      let matchedRoom = roomBboxes.find(
        rb => (rb.room.id === explicitRoomId || rb.room.name === explicitRoomId) &&
          cx >= rb.bboxM.x - TOL &&
          cx <= rb.bboxM.x + rb.bboxM.width + TOL &&
          cy >= rb.bboxM.y - TOL &&
          cy <= rb.bboxM.y + rb.bboxM.height + TOL
      );

      // 2. Spatial containment or overlap with tolerance margin
      if (!matchedRoom) {
        matchedRoom = roomBboxes.find(rb => {
          const { x, y, width, height } = rb.bboxM;
          return (
            cx >= x - TOL &&
            cx <= x + width + TOL &&
            cy >= y - TOL &&
            cy <= y + height + TOL
          );
        });
      }

      // 3. Fallback: assign to closest room on this level
      if (!matchedRoom && roomBboxes.length > 0) {
        const itemW = item.width || 0.5;
        const itemD = item.depth || 0.5;
        const cx = item.x + itemW / 2;
        const cy = item.y + itemD / 2;

        let bestDist = Infinity;
        let closest = roomBboxes[0];
        for (const rb of roomBboxes) {
          const rcx = rb.bboxM.x + rb.bboxM.width / 2;
          const rcy = rb.bboxM.y + rb.bboxM.height / 2;
          const d = Math.hypot(cx - rcx, cy - rcy);
          if (d < bestDist) {
            bestDist = d;
            closest = rb;
          }
        }
        matchedRoom = closest;
      }

      if (matchedRoom) {
        roomItemMap.get(matchedRoom.room.id)?.push(item);
      }
    }

    const legacyRooms: LegacyRoom[] = level.rooms.map(room => {
      const bboxM = deriveRoomBoundingBox(room, level);
      const bboxFt = {
        x: mToFt(bboxM.x),
        y: mToFt(bboxM.y),
        width: mToFt(bboxM.width),
        height: mToFt(bboxM.height),
      };

      // Map openings that belong to boundary walls of this room
      const legacyDoors: { wall: 'top' | 'bottom' | 'left' | 'right'; position: number; width: number }[] = [];
      const legacyWindows: WindowSpec[] = [];

      const nids = room.boundaryNodeIds;
      for (let i = 0; i < nids.length; i++) {
        const n1 = nodeMap.get(nids[i]);
        const n2 = nodeMap.get(nids[(i + 1) % nids.length]);
        if (!n1 || !n2) continue;

        // Find matching wall
        const matchingWall = level.walls.find(
          w => (w.startNodeId === n1.id && w.endNodeId === n2.id) || (w.startNodeId === n2.id && w.endNodeId === n1.id)
        );
        if (!matchingWall) continue;

        const wallOpenings = level.openings.filter(o => o.wallId === matchingWall.id);

        // Determine edge orientation relative to bounding box
        const midX = (n1.x + n2.x) / 2;
        const midY = (n1.y + n2.y) / 2;
        let edgeSide: 'top' | 'bottom' | 'left' | 'right' = 'top';

        if (Math.abs(midY - bboxM.y) < 0.2) edgeSide = 'top';
        else if (Math.abs(midY - (bboxM.y + bboxM.height)) < 0.2) edgeSide = 'bottom';
        else if (Math.abs(midX - bboxM.x) < 0.2) edgeSide = 'left';
        else if (Math.abs(midX - (bboxM.x + bboxM.width)) < 0.2) edgeSide = 'right';

        for (const op of wallOpenings) {
          const posFt = mToFt(op.offset);
          const widthFt = mToFt(op.width);

          if (op.type.includes('door') || op.type === 'opening') {
            legacyDoors.push({
              wall: edgeSide,
              position: Math.max(0.5, posFt),
              width: widthFt,
            });
          } else {
            legacyWindows.push({
              wall: edgeSide,
              position: Math.max(0.5, posFt),
              width: widthFt,
            });
          }
        }
      }

      // Map assigned furniture items
      const roomItems = roomItemMap.get(room.id) || [];
      const legacyFurn: FurnitureItem[] = roomItems.map(item => ({
        id: item.id,
        catalogId: item.assetId,
        name: item.name,
        x: mToFt(item.x - bboxM.x), // relative to room origin
        y: mToFt(item.y - bboxM.y),
        width: mToFt(item.width),
        height: mToFt(item.depth),
        rotation: item.rotation,
        elevation: mToFt(item.elevation),
        color: item.color,
        isLight: item.isLight,
        lightProperties: item.properties?.lightProperties as LightProperties | undefined,
      }));

      const rNameLower = (room.name || '').toLowerCase();
      const rTypeLower = (room.roomType || '').toLowerCase();
      const isShaft =
        rNameLower.includes('shaft') ||
        rNameLower.includes('duct') ||
        rNameLower.includes('mep') ||
        rNameLower.includes('lightwell') ||
        rNameLower.includes('ventilation') ||
        rNameLower.includes('chase') ||
        rTypeLower.includes('shaft') ||
        rTypeLower.includes('lightwell') ||
        rTypeLower.includes('duct');

      const isExplicitExt =
        rNameLower.includes('ext') ||
        rNameLower.includes('lightwell') ||
        rNameLower.includes('courtyard') ||
        rTypeLower.includes('ext') ||
        rTypeLower.includes('lightwell');
      const isExteriorShaft = isShaft && isExplicitExt;
      const isInteriorShaft = isShaft && !isExteriorShaft;
      const isVoid = rNameLower.includes('void') || room.roomType === 'duplex_void' || isShaft;

      return {
        name: room.name,
        x: bboxFt.x,
        y: bboxFt.y,
        width: bboxFt.width,
        height: bboxFt.height,
        doors: legacyDoors,
        windows: legacyWindows,
        furniture: legacyFurn,
        roomType: room.roomType,
        isShaft,
        isInteriorShaft,
        isExteriorShaft,
        isVoid,
      };
    });

    return {
      level: level.levelIndex,
      name: level.name,
      rooms: legacyRooms,
      plot_width: mToFt(doc.site.width),
      plot_height: mToFt(doc.site.length),
    };
  });
}
