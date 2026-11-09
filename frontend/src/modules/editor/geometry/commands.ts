/**
 * commands.ts
 * ============================================================================
 * Atomic Reversible Architectural Commands.
 *
 * All edits (2D handles, numeric fields, shortcuts, Copilot) use these commands.
 * Every command produces a candidate document and an inverse patch for undo.
 * Propagation rules:
 *   - Moving a node updates all incident walls, room loops, and clamps openings.
 *   - Furniture transforms never mutate walls.
 *   - Structural edits never silently delete furniture (flags them).
 * ============================================================================
 */

import type {
  CanonicalBuildingDocument,
  Level,
  Command,
  WallNode,
  Opening,
  PlacedItem,
} from './types';
import { mToFt } from './types';
import { migrateLegacyToCanonical } from './migration';
import { canonicalToLegacyFloors, deriveRoomBoundingBox } from './selectors';
import { propagateRoomBoundsWithSharedWalls, resizeRoomDirectly } from './layoutConstraints';
import { validateCanonicalDocument } from './validators';
import type { Room as LegacyRoom } from '../../../shared/api-client/api';

// Helper: Deep clone document
export function cloneDoc(doc: CanonicalBuildingDocument): CanonicalBuildingDocument {
  const cloned = JSON.parse(JSON.stringify(doc));
  if (!cloned.metadata) {
    cloned.metadata = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return cloned;
}

// ── 1. Move Wall Node Command ────────────────────────────────────────────────

export function createMoveWallNodeCommand(
  levelIndex: number,
  nodeId: string,
  newX: number,
  newY: number
): Command {
  let prevX = 0;
  let prevY = 0;

  return {
    id: `move_node_${nodeId}_${Date.now()}`,
    name: 'Move Wall Node',
    category: 'geometry',
    description: `Move node ${nodeId} to (${newX.toFixed(2)}, ${newY.toFixed(2)}m)`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;

      const node = lvl.nodes.find(n => n.id === nodeId);
      if (!node) return doc;

      prevX = node.x;
      prevY = node.y;
      node.x = Math.round(newX * 1000) / 1000;
      node.y = Math.round(newY * 1000) / 1000;

      // Incident walls automatically stretch because they reference nodeId
      // Openings on incident walls: clamp offsets to new wall length
      for (const wall of lvl.walls) {
        if (wall.startNodeId === nodeId || wall.endNodeId === nodeId) {
          const n1 = lvl.nodes.find(n => n.id === wall.startNodeId);
          const n2 = lvl.nodes.find(n => n.id === wall.endNodeId);
          if (n1 && n2) {
            const len = Math.hypot(n2.x - n1.x, n2.y - n1.y);
            const ops = lvl.openings.filter(o => o.wallId === wall.id);
            for (const op of ops) {
              const maxOffset = Math.max(0.2, len - op.width / 2);
              const minOffset = Math.min(maxOffset, op.width / 2);
              op.offset = Math.max(minOffset, Math.min(maxOffset, op.offset));
            }
          }
        }
      }

      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl) return doc;
      const node = lvl.nodes.find(n => n.id === nodeId);
      if (!node) return doc;
      node.x = prevX;
      node.y = prevY;
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 2. Add Opening Command ───────────────────────────────────────────────────

export function createAddOpeningCommand(
  levelIndex: number,
  opening: Opening
): Command {
  return {
    id: `add_opening_${opening.id}_${Date.now()}`,
    name: 'Add Opening',
    category: 'opening',
    description: `Add ${opening.type} to wall ${opening.wallId}`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;
      lvl.openings.push(JSON.parse(JSON.stringify(opening)));
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl) return doc;
      lvl.openings = lvl.openings.filter(o => o.id !== opening.id);
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 3. Move Opening Command ──────────────────────────────────────────────────

export function createMoveOpeningCommand(
  levelIndex: number,
  openingId: string,
  newOffset: number
): Command {
  let prevOffset = 0;

  return {
    id: `move_opening_${openingId}_${Date.now()}`,
    name: 'Move Opening',
    description: `Move opening ${openingId} along wall to ${newOffset.toFixed(2)}m`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;
      const op = lvl.openings.find(o => o.id === openingId);
      if (!op) return doc;
      prevOffset = op.offset;
      op.offset = Math.round(newOffset * 1000) / 1000;
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl) return doc;
      const op = lvl.openings.find(o => o.id === openingId);
      if (!op) return doc;
      op.offset = prevOffset;
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 4. Delete Opening Command ────────────────────────────────────────────────

export function createDeleteOpeningCommand(
  levelIndex: number,
  openingId: string
): Command {
  let deletedOpening: Opening | null = null;

  return {
    id: `del_opening_${openingId}_${Date.now()}`,
    name: 'Delete Opening',
    description: `Delete opening ${openingId}`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;
      const found = lvl.openings.find(o => o.id === openingId);
      if (found) deletedOpening = JSON.parse(JSON.stringify(found));
      lvl.openings = lvl.openings.filter(o => o.id !== openingId);
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      if (!deletedOpening) return doc;
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl) return doc;
      lvl.openings.push(JSON.parse(JSON.stringify(deletedOpening)));
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 5. Place Furniture Item Command ──────────────────────────────────────────

export function createPlaceItemCommand(
  levelIndex: number,
  item: PlacedItem
): Command {
  return {
    id: `place_item_${item.id}_${Date.now()}`,
    name: 'Place Item',
    category: 'furniture',
    description: `Place ${item.name} at (${item.x.toFixed(2)}, ${item.y.toFixed(2)}m)`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;
      lvl.items.push(JSON.parse(JSON.stringify(item)));
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl) return doc;
      lvl.items = lvl.items.filter(i => i.id !== item.id);
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 6. Transform Furniture Item Command ──────────────────────────────────────

export function createTransformItemCommand(
  levelIndex: number,
  itemId: string,
  newX: number,
  newY: number,
  newRotation: number,
  newRoomId?: string
): Command {
  let prevX = 0;
  let prevY = 0;
  let prevRotation = 0;
  let prevRoomId: string | undefined = undefined;

  return {
    id: `transform_item_${itemId}_${Date.now()}`,
    name: 'Transform Item',
    category: 'furniture',
    description: `Move ${itemId} to (${newX.toFixed(2)}, ${newY.toFixed(2)}m), rot ${newRotation}°`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;
      const item = lvl.items.find(i => i.id === itemId);
      if (!item) return doc;
      prevX = item.x;
      prevY = item.y;
      prevRotation = item.rotation;
      prevRoomId = item.properties?.roomId as string | undefined;

      item.x = Math.round(newX * 1000) / 1000;
      item.y = Math.round(newY * 1000) / 1000;
      item.rotation = (newRotation % 360 + 360) % 360;

      if (!item.properties) item.properties = {};
      if (newRoomId) {
        item.properties.roomId = newRoomId;
      } else {
        const itemW = item.width || 0.5;
        const itemD = item.depth || 0.5;
        const cx = item.x + itemW / 2;
        const cy = item.y + itemD / 2;
        const roomBboxes = lvl.rooms.map(r => ({
          room: r,
          bbox: deriveRoomBoundingBox(r, lvl),
        }));
        const containing = roomBboxes.find(rb =>
          cx >= rb.bbox.x - 0.25 &&
          cx <= rb.bbox.x + rb.bbox.width + 0.25 &&
          cy >= rb.bbox.y - 0.25 &&
          cy <= rb.bbox.y + rb.bbox.height + 0.25
        );
        if (containing) {
          item.properties.roomId = containing.room.name || containing.room.id;
        }
      }

      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl) return doc;
      const item = lvl.items.find(i => i.id === itemId);
      if (!item) return doc;
      item.x = prevX;
      item.y = prevY;
      item.rotation = prevRotation;
      if (!item.properties) item.properties = {};
      item.properties.roomId = prevRoomId;
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 7. Delete Furniture Item Command ─────────────────────────────────────────

export function createDeleteItemCommand(
  levelIndex: number,
  itemId: string
): Command {
  let deletedItem: PlacedItem | null = null;

  return {
    id: `del_item_${itemId}_${Date.now()}`,
    name: 'Delete Item',
    category: 'furniture',
    description: `Delete item ${itemId}`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;
      const found = lvl.items.find(i => i.id === itemId);
      if (found) deletedItem = JSON.parse(JSON.stringify(found));
      lvl.items = lvl.items.filter(i => i.id !== itemId);
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      if (!deletedItem) return doc;
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl) return doc;
      lvl.items.push(JSON.parse(JSON.stringify(deletedItem)));
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 8. Update Furniture Item Dimensions Command ──────────────────────────────

export function createUpdateItemDimensionsCommand(
  levelIndex: number,
  itemId: string,
  newWidth: number,
  newDepth: number,
  newHeight: number,
  newX?: number,
  newY?: number,
  newRoomId?: string
): Command {
  let prevWidth = 0;
  let prevDepth = 0;
  let prevHeight = 0;
  let prevX: number | undefined = undefined;
  let prevY: number | undefined = undefined;
  let prevRoomId: string | undefined = undefined;

  return {
    id: `resize_item_${itemId}_${Date.now()}`,
    name: 'Resize Item',
    category: 'furniture',
    description: `Resize item ${itemId} to ${newWidth.toFixed(2)}x${newDepth.toFixed(2)}m${newX !== undefined ? ` at (${newX.toFixed(2)}, ${newY?.toFixed(2)}m)` : ''}`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;
      const item = lvl.items.find(i => i.id === itemId);
      if (!item) return doc;
      prevWidth = item.width;
      prevDepth = item.depth;
      prevHeight = item.height;
      prevX = item.x;
      prevY = item.y;
      prevRoomId = item.properties?.roomId as string | undefined;

      item.width = Math.max(0.1, Math.round(newWidth * 1000) / 1000);
      item.depth = Math.max(0.1, Math.round(newDepth * 1000) / 1000);
      item.height = Math.max(0.1, Math.round(newHeight * 1000) / 1000);

      if (newX !== undefined && !isNaN(newX)) {
        item.x = Math.round(newX * 1000) / 1000;
      }
      if (newY !== undefined && !isNaN(newY)) {
        item.y = Math.round(newY * 1000) / 1000;
      }
      if (!item.properties) item.properties = {};
      if (newRoomId) {
        item.properties.roomId = newRoomId;
      }
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl) return doc;
      const item = lvl.items.find(i => i.id === itemId);
      if (!item) return doc;
      item.width = prevWidth;
      item.depth = prevDepth;
      item.height = prevHeight;
      if (prevX !== undefined) item.x = prevX;
      if (prevY !== undefined) item.y = prevY;
      if (!item.properties) item.properties = {};
      item.properties.roomId = prevRoomId;
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 8. Resize Room Boundary Command ─────────────────────────────────────────

export function createResizeRoomCommand(
  levelIndex: number,
  roomId: string,
  deltaWidthM: number,
  deltaHeightM: number
): Command {
  let originalNodes: WallNode[] = [];

  return {
    id: `resize_room_${roomId}_${Date.now()}`,
    name: 'Resize Room Boundary',
    category: 'geometry',
    description: `Resize room ${roomId} by (+${deltaWidthM.toFixed(2)}m, +${deltaHeightM.toFixed(2)}m)`,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;
      const room = lvl.rooms.find(r => r.id === roomId);
      if (!room) return doc;

      originalNodes = JSON.parse(JSON.stringify(lvl.nodes));

      // Find boundary nodes
      const bNodes = lvl.nodes.filter(n => room.boundaryNodeIds.includes(n.id));
      if (bNodes.length < 3) return doc;

      const minX = Math.min(...bNodes.map(n => n.x));
      const minY = Math.min(...bNodes.map(n => n.y));

      // Shift nodes that are on the right or bottom boundary of this room
      for (const node of bNodes) {
        if (deltaWidthM !== 0 && node.x > minX + 0.1) {
          node.x = Math.round((node.x + deltaWidthM) * 1000) / 1000;
        }
        if (deltaHeightM !== 0 && node.y > minY + 0.1) {
          node.y = Math.round((node.y + deltaHeightM) * 1000) / 1000;
        }
      }

      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      const prev = cloneDoc(doc);
      const lvl = prev.levels[levelIndex];
      if (!lvl || originalNodes.length === 0) return doc;
      lvl.nodes = JSON.parse(JSON.stringify(originalNodes));
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 9. Update Floor Rooms Command ───────────────────────────────────────────

export function createUpdateFloorRoomsCommand(
  levelIndex: number,
  newRooms: LegacyRoom[],
  description = 'Update Floor Layout'
): Command {
  let previousLevelSnapshot: Level | null = null;

  return {
    id: `update_rooms_lvl_${levelIndex}_${Date.now()}`,
    name: 'Update Floor Rooms',
    category: 'geometry',
    description,
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;

      previousLevelSnapshot = JSON.parse(JSON.stringify(lvl));

      const tempLegacy = {
        plot_width: mToFt(doc.site.width),
        plot_length: mToFt(doc.site.length),
        entry_direction: doc.site.entrySide,
        floors: [
          {
            level: lvl.levelIndex,
            name: lvl.name,
            rooms: newRooms,
          },
        ],
      };
      const migrated = migrateLegacyToCanonical(tempLegacy);
      if (migrated.levels[0]) {
        next.levels[levelIndex] = {
          ...migrated.levels[0],
          id: lvl.id,
          levelIndex: lvl.levelIndex,
          name: lvl.name,
          elevation: lvl.elevation,
          height: lvl.height,
          slabThickness: lvl.slabThickness,
          items: migrated.levels[0].items.length > 0 ? migrated.levels[0].items : lvl.items,
        };
      }
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      if (!previousLevelSnapshot) return doc;
      const prev = cloneDoc(doc);
      prev.levels[levelIndex] = JSON.parse(JSON.stringify(previousLevelSnapshot));
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 10. Update Room Bounds Command ──────────────────────────────────────────

export function createUpdateRoomBoundsCommand(
  levelIndex: number,
  roomIdentifier: string,
  newBoundsFt: { x: number; y: number; width: number; height: number },
  syncSharedWalls: boolean = true
): Command {
  let previousLevelSnapshot: Level | null = null;
  let propagationError: string | null = null;

  return {
    id: `update_room_bounds_${Date.now()}`,
    name: 'Update Room Dimensions',
    category: 'geometry',
    description: `Resize ${roomIdentifier} to ${newBoundsFt.width}×${newBoundsFt.height} ft at (${newBoundsFt.x}, ${newBoundsFt.y})`,
    validate: (candidate: CanonicalBuildingDocument) => {
      if (newBoundsFt.width < 2.5 || newBoundsFt.height < 2.5) {
        return {
          valid: false,
          issues: [{
            code: 'MIN_ROOM_DIMENSION',
            severity: 'error' as const,
            message: `Room dimension must be at least 2.5 ft (requested ${newBoundsFt.width}×${newBoundsFt.height} ft).`,
            levelId: candidate.levels[levelIndex]?.id,
          }],
        };
      }
      if (propagationError) {
        return {
          valid: false,
          issues: [{
            code: 'PROPAGATION_FAILED',
            severity: 'error' as const,
            message: propagationError,
            levelId: candidate.levels[levelIndex]?.id,
          }],
        };
      }
      return validateCanonicalDocument(candidate);
    },
    execute: (doc: CanonicalBuildingDocument) => {
      const next = cloneDoc(doc);
      const lvl = next.levels[levelIndex];
      if (!lvl) return doc;

      previousLevelSnapshot = JSON.parse(JSON.stringify(lvl));

      const legacyFloors = canonicalToLegacyFloors(next);
      const currentRooms = legacyFloors[levelIndex]?.rooms || [];
      const plotWFt = mToFt(doc.site.width);
      const plotLFt = mToFt(doc.site.length);

      let propRes = syncSharedWalls
        ? propagateRoomBoundsWithSharedWalls(
            currentRooms,
            roomIdentifier,
            newBoundsFt,
            plotWFt,
            plotLFt
          )
        : resizeRoomDirectly(
            currentRooms,
            roomIdentifier,
            newBoundsFt,
            plotWFt,
            plotLFt
          );

      // If synced propagation encounters a collision, fallback to direct independent resize
      if (!propRes.success && syncSharedWalls) {
        const directRes = resizeRoomDirectly(
          currentRooms,
          roomIdentifier,
          newBoundsFt,
          plotWFt,
          plotLFt
        );
        if (directRes.success) {
          propRes = directRes;
        }
      }

      if (!propRes.success) {
        propagationError = propRes.message;
      } else {
        propagationError = null;
      }

      const updatedRooms = propRes.success
        ? propRes.rooms
        : currentRooms.map(r => {
            if (
              r.name === roomIdentifier ||
              r.name.toLowerCase() === roomIdentifier.toLowerCase()
            ) {
              return {
                ...r,
                x: newBoundsFt.x,
                y: newBoundsFt.y,
                width: newBoundsFt.width,
                height: newBoundsFt.height,
              };
            }
            return r;
          });

      const tempLegacy = {
        plot_width: plotWFt,
        plot_length: plotLFt,
        entry_direction: doc.site.entrySide,
        floors: [
          {
            level: lvl.levelIndex,
            name: lvl.name,
            rooms: updatedRooms,
          },
        ],
      };
      const migrated = migrateLegacyToCanonical(tempLegacy);
      if (migrated.levels[0]) {
        next.levels[levelIndex] = {
          ...migrated.levels[0],
          id: lvl.id,
          levelIndex: lvl.levelIndex,
          name: lvl.name,
          elevation: lvl.elevation,
          height: lvl.height,
          slabThickness: lvl.slabThickness,
          items: migrated.levels[0].items.length > 0 ? migrated.levels[0].items : lvl.items,
        };
      }
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      if (!previousLevelSnapshot) return doc;
      const prev = cloneDoc(doc);
      prev.levels[levelIndex] = JSON.parse(JSON.stringify(previousLevelSnapshot));
      prev.metadata.updatedAt = new Date().toISOString();
      return prev;
    },
  };
}

// ── 11. Apply Generated Plan Command ────────────────────────────────────────

export function createApplyGeneratedPlanCommand(
  newDoc: CanonicalBuildingDocument,
  description: string = 'Apply Generated Floor Plan'
): Command {
  let previousDocSnapshot: CanonicalBuildingDocument | null = null;

  return {
    id: `apply_generated_plan_${Date.now()}`,
    name: 'Apply Generated Floor Plan',
    category: 'geometry',
    description,
    execute: (doc: CanonicalBuildingDocument) => {
      previousDocSnapshot = cloneDoc(doc);
      const next = cloneDoc(newDoc);
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (doc: CanonicalBuildingDocument) => {
      if (!previousDocSnapshot) return doc;
      return cloneDoc(previousDocSnapshot);
    },
  };
}

// ── 12. Apply Copilot Modification Command ─────────────────────────────────────

export function createApplyCopilotModificationCommand(
  newDoc: CanonicalBuildingDocument,
  description: string = 'Apply AI Copilot Modification'
): Command {
  let previousDocSnapshot: CanonicalBuildingDocument | null = null;

  return {
    id: `apply_copilot_mod_${Date.now()}`,
    name: 'Apply AI Copilot Modification',
    category: 'geometry',
    description,
    execute: (doc: CanonicalBuildingDocument) => {
      previousDocSnapshot = cloneDoc(doc);
      const next = cloneDoc(newDoc);
      next.metadata.updatedAt = new Date().toISOString();
      return next;
    },
    inverse: (_doc: CanonicalBuildingDocument) => {
      if (!previousDocSnapshot) return _doc;
      return cloneDoc(previousDocSnapshot);
    },
  };
}

