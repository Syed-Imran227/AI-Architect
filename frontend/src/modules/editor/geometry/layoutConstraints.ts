/**
 * layoutConstraints.ts
 * ============================================================================
 * Pure geometric constraint propagation for room resizing and movement.
 *
 * Enforces architectural invariants:
 * 1. Shared walls between adjacent rooms move consistently (no gaps, no overlaps).
 * 2. Plot boundary containment is strictly verified.
 * 3. Minimum room dimensions (>= 2.5 ft) are preserved for all affected spaces.
 * 4. Openings (doors, windows) and placed furniture stay within valid room bounds.
 * ============================================================================
 */

import type { Room } from '../../../shared/api-client/api';
import { validateRoomPlacement } from '../../../shared/utils/validateRooms';

export const MIN_ROOM_DIM_FT = 2.5;
export const SHARED_WALL_TOLERANCE_FT = 0.5;

export interface RoomBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PropagationResult {
  success: boolean;
  rooms: Room[];
  message: string;
}

/**
 * Direct independent room resizer:
 * Resizes the target room separately without shifting neighboring rooms.
 * Validates plot boundaries, clamps openings and placed furniture.
 */
export function resizeRoomDirectly(
  rooms: Room[],
  targetIdentifier: string | number,
  newBounds: RoomBounds,
  plotWidth: number,
  plotHeight: number
): PropagationResult {
  if (!rooms || rooms.length === 0) {
    return { success: false, rooms, message: 'No rooms to modify' };
  }

  const targetIndex = typeof targetIdentifier === 'number'
    ? targetIdentifier
    : rooms.findIndex(r => r.name === targetIdentifier || r.name.toLowerCase() === String(targetIdentifier).toLowerCase());

  if (targetIndex < 0 || targetIndex >= rooms.length) {
    return { success: false, rooms, message: `Room '${targetIdentifier}' not found` };
  }

  const origTarget = rooms[targetIndex];

  if (newBounds.width < MIN_ROOM_DIM_FT || newBounds.height < MIN_ROOM_DIM_FT) {
    return {
      success: false,
      rooms,
      message: `Dimensions must be at least ${MIN_ROOM_DIM_FT} ft (requested ${newBounds.width}×${newBounds.height} ft).`,
    };
  }

  // Clamp within plot boundary
  const clampedX = Math.max(0, Math.min(plotWidth - newBounds.width, newBounds.x));
  const clampedY = Math.max(0, Math.min(plotHeight - newBounds.height, newBounds.y));
  const clampedW = Math.max(MIN_ROOM_DIM_FT, Math.min(plotWidth - clampedX, newBounds.width));
  const clampedH = Math.max(MIN_ROOM_DIM_FT, Math.min(plotHeight - clampedY, newBounds.height));

  const candidateRooms: Room[] = JSON.parse(JSON.stringify(rooms));
  const target = candidateRooms[targetIndex];

  target.x = Math.round(clampedX * 10) / 10;
  target.y = Math.round(clampedY * 10) / 10;
  target.width = Math.round(clampedW * 10) / 10;
  target.height = Math.round(clampedH * 10) / 10;

  // Clamp doors and windows to fit modified room walls
  if (target.doors && target.doors.length > 0) {
    target.doors = target.doors.map(d => {
      const wallLen = d.wall === 'top' || d.wall === 'bottom' ? target.width : target.height;
      const maxDoorW = Math.max(1.8, wallLen - 0.6);
      const fittedW = Math.min(d.width || 3.0, maxDoorW);
      const minPos = 0.3;
      const maxPos = Math.max(minPos, wallLen - fittedW - 0.3);
      const clampedPos = Math.max(minPos, Math.min(maxPos, d.position || 1.0));
      return {
        ...d,
        width: Math.round(fittedW * 10) / 10,
        position: Math.round(clampedPos * 10) / 10,
      };
    });
  }

  if (target.windows && target.windows.length > 0) {
    target.windows = target.windows.map(w => {
      const wallLen = w.wall === 'top' || w.wall === 'bottom' ? target.width : target.height;
      const maxWinW = Math.max(2.0, wallLen - 0.8);
      const fittedW = Math.min(w.width || 3.0, maxWinW);
      const minPos = 0.4;
      const maxPos = Math.max(minPos, wallLen - fittedW - 0.4);
      const clampedPos = Math.max(minPos, Math.min(maxPos, w.position || 1.0));
      return {
        ...w,
        width: Math.round(fittedW * 10) / 10,
        position: Math.round(clampedPos * 10) / 10,
      };
    });
  }

  // Keep furniture items inside the modified room
  if (target.furniture && target.furniture.length > 0) {
    target.furniture = target.furniture.map(f => {
      const maxX = Math.max(0.2, target.width - f.width - 0.2);
      const maxY = Math.max(0.2, target.height - f.height - 0.2);
      return {
        ...f,
        x: Math.max(0.2, Math.min(maxX, f.x)),
        y: Math.max(0.2, Math.min(maxY, f.y)),
      };
    });
  }

  return {
    success: true,
    rooms: candidateRooms,
    message: `Resized ${origTarget.name} independently to ${target.width}×${target.height} ft.`,
  };
}

/**
 * Checks if two 1D intervals [a1, a2] and [b1, b2] overlap by at least minOverlap.
 */
export function intervalsOverlap(a1: number, a2: number, b1: number, b2: number, minOverlap = 0.5): boolean {
  const overlap = Math.min(a2, b2) - Math.max(a1, b1);
  return overlap >= minOverlap;
}

/**
 * Pure constraint propagator:
 * Resizes or moves a room while updating all neighboring rooms sharing its boundary walls.
 */
export function propagateRoomBoundsWithSharedWalls(
  rooms: Room[],
  targetIdentifier: string | number,
  newBounds: RoomBounds,
  plotWidth: number,
  plotHeight: number
): PropagationResult {
  if (!rooms || rooms.length === 0) {
    return { success: false, rooms, message: 'No rooms to modify' };
  }

  // 1. Locate target room
  const targetIndex = typeof targetIdentifier === 'number'
    ? targetIdentifier
    : rooms.findIndex(r => r.name === targetIdentifier || r.name.toLowerCase() === String(targetIdentifier).toLowerCase());

  if (targetIndex < 0 || targetIndex >= rooms.length) {
    return { success: false, rooms, message: `Room '${targetIdentifier}' not found` };
  }

  const origTarget = rooms[targetIndex];

  // 2. Validate requested dimensions for target room
  if (newBounds.width < MIN_ROOM_DIM_FT || newBounds.height < MIN_ROOM_DIM_FT) {
    return {
      success: false,
      rooms,
      message: `Dimensions must be at least ${MIN_ROOM_DIM_FT} ft (requested ${newBounds.width}×${newBounds.height} ft).`,
    };
  }

  // 3. Check target room plot containment
  if (
    newBounds.x < -0.05 ||
    newBounds.y < -0.05 ||
    newBounds.x + newBounds.width > plotWidth + 0.05 ||
    newBounds.y + newBounds.height > plotHeight + 0.05
  ) {
    return {
      success: false,
      rooms,
      message: `Room would extend outside the plot boundary (${plotWidth}×${plotHeight} ft).`,
    };
  }

  // Deep clone rooms for candidate state
  const candidateRooms: Room[] = JSON.parse(JSON.stringify(rooms));

  const origLeft = origTarget.x;
  const origRight = origTarget.x + origTarget.width;
  const origTop = origTarget.y;
  const origBottom = origTarget.y + origTarget.height;

  const newLeft = newBounds.x;
  const newRight = newBounds.x + newBounds.width;
  const newTop = newBounds.y;
  const newBottom = newBounds.y + newBounds.height;

  const deltaLeft = newLeft - origLeft;
  const deltaRight = newRight - origRight;
  const deltaTop = newTop - origTop;
  const deltaBottom = newBottom - origBottom;

  // Apply target room bounds
  candidateRooms[targetIndex] = {
    ...candidateRooms[targetIndex],
    x: Math.round(newLeft * 10) / 10,
    y: Math.round(newTop * 10) / 10,
    width: Math.round(newBounds.width * 10) / 10,
    height: Math.round(newBounds.height * 10) / 10,
  };

  // 4. Propagate shared walls to adjacent rooms
  for (let i = 0; i < candidateRooms.length; i++) {
    if (i === targetIndex) continue;
    const origNeighbor = rooms[i];
    const n = candidateRooms[i];

    const nLeft = origNeighbor.x;
    const nRight = origNeighbor.x + origNeighbor.width;
    const nTop = origNeighbor.y;
    const nBottom = origNeighbor.y + origNeighbor.height;

    // Check if neighbor shares vertical overlap with target room
    const sharesVerticalSpan = intervalsOverlap(origTop, origBottom, nTop, nBottom, 0.5);
    // Check if neighbor shares horizontal overlap with target room
    const sharesHorizontalSpan = intervalsOverlap(origLeft, origRight, nLeft, nRight, 0.5);

    // Case A: Neighbor is to the RIGHT of target (neighbor's left edge matches target's right edge)
    if (sharesVerticalSpan && Math.abs(nLeft - origRight) <= SHARED_WALL_TOLERANCE_FT && Math.abs(deltaRight) > 0.05) {
      const updatedLeft = newRight;
      const updatedWidth = nRight - updatedLeft;
      if (updatedWidth < MIN_ROOM_DIM_FT) {
        return {
          success: false,
          rooms,
          message: `Cannot expand ${origTarget.name}: adjacent room '${origNeighbor.name}' would shrink below ${MIN_ROOM_DIM_FT} ft.`,
        };
      }
      n.x = Math.round(updatedLeft * 10) / 10;
      n.width = Math.round(updatedWidth * 10) / 10;
    }

    // Case B: Neighbor is to the LEFT of target (neighbor's right edge matches target's left edge)
    if (sharesVerticalSpan && Math.abs(nRight - origLeft) <= SHARED_WALL_TOLERANCE_FT && Math.abs(deltaLeft) > 0.05) {
      const updatedWidth = newLeft - nLeft;
      if (updatedWidth < MIN_ROOM_DIM_FT) {
        return {
          success: false,
          rooms,
          message: `Cannot move/expand ${origTarget.name}: adjacent room '${origNeighbor.name}' would shrink below ${MIN_ROOM_DIM_FT} ft.`,
        };
      }
      n.width = Math.round(updatedWidth * 10) / 10;
    }

    // Case C: Neighbor is BELOW target (neighbor's top edge matches target's bottom edge)
    if (sharesHorizontalSpan && Math.abs(nTop - origBottom) <= SHARED_WALL_TOLERANCE_FT && Math.abs(deltaBottom) > 0.05) {
      const updatedTop = newBottom;
      const updatedHeight = nBottom - updatedTop;
      if (updatedHeight < MIN_ROOM_DIM_FT) {
        return {
          success: false,
          rooms,
          message: `Cannot expand ${origTarget.name}: adjacent room '${origNeighbor.name}' would shrink below ${MIN_ROOM_DIM_FT} ft.`,
        };
      }
      n.y = Math.round(updatedTop * 10) / 10;
      n.height = Math.round(updatedHeight * 10) / 10;
    }

    // Case D: Neighbor is ABOVE target (neighbor's bottom edge matches target's top edge)
    if (sharesHorizontalSpan && Math.abs(nBottom - origTop) <= SHARED_WALL_TOLERANCE_FT && Math.abs(deltaTop) > 0.05) {
      const updatedHeight = newTop - nTop;
      if (updatedHeight < MIN_ROOM_DIM_FT) {
        return {
          success: false,
          rooms,
          message: `Cannot move/expand ${origTarget.name}: adjacent room '${origNeighbor.name}' would shrink below ${MIN_ROOM_DIM_FT} ft.`,
        };
      }
      n.height = Math.round(updatedHeight * 10) / 10;
    }
  }

  // 5. Constrain doors and windows to fit modified room walls
  for (const r of candidateRooms) {
    if (r.doors && r.doors.length > 0) {
      r.doors = r.doors.map(d => {
        const wallLen = d.wall === 'top' || d.wall === 'bottom' ? r.width : r.height;
        const maxDoorW = Math.max(1.8, wallLen - 0.6);
        const fittedW = Math.min(d.width || 3.0, maxDoorW);
        const minPos = 0.3;
        const maxPos = Math.max(minPos, wallLen - fittedW - 0.3);
        const clampedPos = Math.max(minPos, Math.min(maxPos, d.position || 1.0));
        return {
          ...d,
          width: Math.round(fittedW * 10) / 10,
          position: Math.round(clampedPos * 10) / 10,
        };
      });
    }

    if (r.windows && r.windows.length > 0) {
      r.windows = r.windows.map(w => {
        const wallLen = w.wall === 'top' || w.wall === 'bottom' ? r.width : r.height;
        const maxWinW = Math.max(2.0, wallLen - 0.8);
        const fittedW = Math.min(w.width || 3.0, maxWinW);
        const minPos = 0.4;
        const maxPos = Math.max(minPos, wallLen - fittedW - 0.4);
        const clampedPos = Math.max(minPos, Math.min(maxPos, w.position || 1.0));
        return {
          ...w,
          width: Math.round(fittedW * 10) / 10,
          position: Math.round(clampedPos * 10) / 10,
        };
      });
    }

    // Keep furniture items inside the modified room
    if (r.furniture && r.furniture.length > 0) {
      r.furniture = r.furniture.map(f => {
        const maxX = Math.max(0.2, r.width - f.width - 0.2);
        const maxY = Math.max(0.2, r.height - f.height - 0.2);
        return {
          ...f,
          x: Math.max(0.2, Math.min(maxX, f.x)),
          y: Math.max(0.2, Math.min(maxY, f.y)),
        };
      });
    }
  }

  // 6. Validate resulting arrangement against overlap and plot boundaries
  const violations = validateRoomPlacement(candidateRooms, plotWidth, plotHeight);
  if (violations.length > 0) {
    return {
      success: false,
      rooms,
      message: `Invalid geometry: ${violations[0].reason} (${violations[0].roomName}).`,
    };
  }

  return {
    success: true,
    rooms: candidateRooms,
    message: `Resized ${origTarget.name} to ${newBounds.width}×${newBounds.height} ft with synchronized walls.`,
  };
}
