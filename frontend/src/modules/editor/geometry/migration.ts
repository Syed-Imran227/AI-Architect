/**
 * migration.ts
 * ============================================================================
 * Legacy Project Importer & Pure Migration Functions (v0 → v1).
 *
 * Guaranteed Invariants:
 *   1. Zero data loss: Original payload is preserved in `legacySnapshot`.
 *   2. Idempotency: Running migration on an already-canonical document returns it intact.
 *   3. Coordinate mapping: Feet are cleanly converted to metres (SI).
 * ============================================================================
 */

import type {
  CanonicalBuildingDocument,
  Level,
  WallNode,
  Wall,
  Opening,
  CanonicalRoom,
  PlacedItem,
} from './types';
import { SCHEMA_VERSION, ftToM } from './types';

/**
 * Type guard: Checks whether an object is already a CanonicalBuildingDocument.
 */
export function isCanonicalDocument(data: unknown): data is CanonicalBuildingDocument {
  if (!data || typeof data !== 'object') return false;
  const doc = data as Record<string, unknown>;
  return (
    doc.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(doc.levels) &&
    typeof doc.site === 'object'
  );
}

/**
 * Sanitizes a canonical building document by removing duplicate doorway openings
 * on host walls (e.g. shared walls between rooms where both rooms contributed a doorway).
 */
export function sanitizeCanonicalDocument(doc: CanonicalBuildingDocument): CanonicalBuildingDocument {
  const sanitizedLevels = doc.levels.map(lvl => {
    const deduplicatedOpenings: Opening[] = [];
    for (const op of lvl.openings) {
      const s = op.offset - op.width / 2;
      const e = op.offset + op.width / 2;
      const duplicate = deduplicatedOpenings.find(existing => {
        if (existing.wallId !== op.wallId) return false;
        const es = existing.offset - existing.width / 2;
        const ee = existing.offset + existing.width / 2;
        return (Math.min(e, ee) - Math.max(s, es)) > 0.1;
      });
      if (!duplicate) {
        deduplicatedOpenings.push(op);
      }
    }
    return {
      ...lvl,
      openings: deduplicatedOpenings,
    };
  });

  return {
    ...doc,
    levels: sanitizedLevels,
  };
}

/**
 * Pure migration function: Migrates legacy floor plan data (v0) to CanonicalBuildingDocument (v1).
 */
export function migrateLegacyToCanonical(
  legacyData: unknown,
  fallbackPlotWidthFt = 30,
  fallbackPlotLengthFt = 40,
  fallbackEntryDir: 'north' | 'south' | 'east' | 'west' = 'east'
): CanonicalBuildingDocument {
  if (isCanonicalDocument(legacyData)) {
    return sanitizeCanonicalDocument(legacyData);
  }

  const raw = (legacyData && typeof legacyData === 'object' ? legacyData : {}) as Record<string, unknown>;

  // Resolve legacy floors
  let rawFloors: Record<string, unknown>[] = [];
  const nestedLayout = (raw.layout && typeof raw.layout === 'object') ? (raw.layout as Record<string, unknown>) : null;
  const nestedLayoutData = (raw.layout_data && typeof raw.layout_data === 'object') ? (raw.layout_data as Record<string, unknown>) : null;

  if (Array.isArray(raw.floors) && raw.floors.length > 0) {
    rawFloors = raw.floors as Record<string, unknown>[];
  } else if (nestedLayout && Array.isArray(nestedLayout.floors) && nestedLayout.floors.length > 0) {
    rawFloors = nestedLayout.floors as Record<string, unknown>[];
  } else if (nestedLayoutData && Array.isArray(nestedLayoutData.floors) && nestedLayoutData.floors.length > 0) {
    rawFloors = nestedLayoutData.floors as Record<string, unknown>[];
  } else if (Array.isArray(raw.rooms)) {
    rawFloors = [{ level: 0, name: 'Ground Floor', rooms: raw.rooms }];
  } else if (nestedLayout && Array.isArray(nestedLayout.rooms)) {
    rawFloors = [{ level: 0, name: 'Ground Floor', rooms: nestedLayout.rooms }];
  } else {
    rawFloors = [{ level: 0, name: 'Ground Floor', rooms: [] }];
  }

  // Resolve explicit plot dimensions from all possible legacy/canonical formats
  const rawExplicitWFt = Number(
    raw.plot_width ||
    raw.plotWidth ||
    (rawFloors[0] && (rawFloors[0].plot_width || rawFloors[0].plotWidth)) ||
    (raw.form as any)?.width ||
    (raw.dimensions as any)?.width
  );

  const rawExplicitLFt = Number(
    raw.plot_length ||
    raw.plot_height ||
    raw.plotLength ||
    (rawFloors[0] && (rawFloors[0].plot_height || rawFloors[0].plot_length || rawFloors[0].plotLength)) ||
    (raw.form as any)?.length ||
    (raw.dimensions as any)?.length
  );

  // Scan all floors to find the maximum extent of rooms and placed furniture items (used only for untyped legacy plans)
  let maxExtentXFt = 0;
  let maxExtentYFt = 0;
  for (const fl of rawFloors) {
    const rms = Array.isArray(fl.rooms) ? (fl.rooms as Record<string, unknown>[]) : [];
    for (const r of rms) {
      const rx = Number(r.x) || 0;
      const ry = Number(r.y) || 0;
      const rw = Number(r.width) || 0;
      const rh = Number(r.height) || 0;
      if (rx + rw > maxExtentXFt) maxExtentXFt = rx + rw;
      if (ry + rh > maxExtentYFt) maxExtentYFt = ry + rh;

      if (Array.isArray(r.furniture)) {
        for (const f of r.furniture as Record<string, unknown>[]) {
          const fx = rx + (Number(f.x) || 0);
          const fy = ry + (Number(f.y) || 0);
          const fw = Number(f.width) || 2;
          const fh = Number(f.height) || 2;
          if (fx + fw > maxExtentXFt) maxExtentXFt = fx + fw;
          if (fy + fh > maxExtentYFt) maxExtentYFt = fy + fh;
        }
      }
    }
  }

  // Authoritative plot dimensions:
  // If explicitly declared in the input payload, respect them strictly without silent expansion.
  // Only for untyped legacy payloads lacking any declared plot dimensions do we infer from room extents.
  const plotWFt = rawExplicitWFt > 0
    ? rawExplicitWFt
    : Math.max(fallbackPlotWidthFt || 30, maxExtentXFt > 0 ? Math.ceil(maxExtentXFt) : 30);

  const plotLFt = rawExplicitLFt > 0
    ? rawExplicitLFt
    : Math.max(fallbackPlotLengthFt || 40, maxExtentYFt > 0 ? Math.ceil(maxExtentYFt) : 40);

  const entryDir = (String(raw.entry_direction || raw.entryDir || fallbackEntryDir).toLowerCase()) as
    | 'north'
    | 'south'
    | 'east'
    | 'west';

  const plotWM = ftToM(plotWFt);
  const plotLM = ftToM(plotLFt);

  const levels: Level[] = rawFloors.map((fl, flIdx) => {
    const levelId = `lvl_${flIdx}`;
    const levelName = String(
      fl.name ||
      (typeof fl.level === 'string' && isNaN(Number(fl.level)) ? fl.level : '') ||
      (flIdx === 0 ? 'Ground Floor' : flIdx === 1 ? 'First Floor' : flIdx === 2 ? 'Second Floor' : `Level ${flIdx}`)
    );
    const rawRooms = Array.isArray(fl.rooms) ? (fl.rooms as Record<string, unknown>[]) : [];

    // Sanitize legacy phantom rooms: if a room (such as a clamped Terrace or Balcony)
    // is >= 85% covered by other rooms on the same floor, it was an artifact of the
    // legacy boundary clamp defect and must be excluded to prevent overlapping walls.
    const validRooms = rawRooms.filter((r, idx) => {
      const rx1 = Number(r.x) || 0;
      const ry1 = Number(r.y) || 0;
      const rw = Number(r.width) || 0;
      const rh = Number(r.height) || 0;
      const rx2 = rx1 + rw;
      const ry2 = ry1 + rh;
      const rArea = rw * rh;
      if (rArea <= 0) return false;

      let coveredArea = 0;
      for (let j = 0; j < rawRooms.length; j++) {
        if (j === idx) continue;
        const o = rawRooms[j];
        const ox1 = Number(o.x) || 0;
        const oy1 = Number(o.y) || 0;
        const ow = Number(o.width) || 0;
        const oh = Number(o.height) || 0;
        const ox2 = ox1 + ow;
        const oy2 = oy1 + oh;

        const ix1 = Math.max(rx1, ox1);
        const iy1 = Math.max(ry1, oy1);
        const ix2 = Math.min(rx2, ox2);
        const iy2 = Math.min(ry2, oy2);

        if (ix2 > ix1 && iy2 > iy1) {
          coveredArea += (ix2 - ix1) * (iy2 - iy1);
        }
      }

      const rNameLower = String(r.name || '').toLowerCase();
      if (coveredArea >= rArea * 0.85 && (rNameLower.includes('terrace') || rNameLower.includes('balcony'))) {
        return false;
      }
      return true;
    });

    const nodes: WallNode[] = [];
    const walls: Wall[] = [];
    const openings: Opening[] = [];
    const rooms: CanonicalRoom[] = [];
    const items: PlacedItem[] = [];

    // Node deduplication map: key = `${round(x, 2)}_${round(y, 2)}`
    const nodeCoordMap = new Map<string, WallNode>();

    function getOrCreateNode(xM: number, yM: number): WallNode {
      const key = `${Math.round(xM * 100) / 100}_${Math.round(yM * 100) / 100}`;
      const existing = nodeCoordMap.get(key);
      if (existing) return existing;
      const newNode: WallNode = {
        id: `n_${levelId}_${nodeCoordMap.size + 1}`,
        x: Math.round(xM * 1000) / 1000,
        y: Math.round(yM * 1000) / 1000,
      };
      nodeCoordMap.set(key, newNode);
      nodes.push(newNode);
      return newNode;
    }

    function getOrCreateWall(n1: WallNode, n2: WallNode, isExt: boolean): Wall {
      const existing = walls.find(
        w => (w.startNodeId === n1.id && w.endNodeId === n2.id) || (w.startNodeId === n2.id && w.endNodeId === n1.id)
      );
      if (existing) return existing;

      const newWall: Wall = {
        id: `w_${levelId}_${walls.length + 1}`,
        startNodeId: n1.id,
        endNodeId: n2.id,
        thickness: isExt ? 0.23 : 0.115,
        height: 3.05,
        kind: isExt ? 'exterior' : 'interior',
      };
      walls.push(newWall);
      return newWall;
    }

    validRooms.forEach((r, rIdx) => {
      const rxM = ftToM(Number(r.x) || 0);
      const ryM = ftToM(Number(r.y) || 0);
      const rwM = ftToM(Number(r.width) || 10);
      const rhM = ftToM(Number(r.height) || 10);
      const rName = String(r.name || `Room ${rIdx + 1}`);
      const roomId = `room_${levelId}_${rIdx + 1}`;

      // Create 4 bounding corner nodes (Clockwise: Top-Left, Top-Right, Bottom-Right, Bottom-Left)
      const tl = getOrCreateNode(rxM, ryM);
      const tr = getOrCreateNode(rxM + rwM, ryM);
      const br = getOrCreateNode(rxM + rwM, ryM + rhM);
      const bl = getOrCreateNode(rxM, ryM + rhM);

      // Create walls
      const isExtTop = Math.abs(ryM) < 0.1;
      const isExtBottom = Math.abs(ryM + rhM - plotLM) < 0.1;
      const isExtLeft = Math.abs(rxM) < 0.1;
      const isExtRight = Math.abs(rxM + rwM - plotWM) < 0.1;

      const wallTop = getOrCreateWall(tl, tr, isExtTop);
      const wallRight = getOrCreateWall(tr, br, isExtRight);
      const wallBottom = getOrCreateWall(br, bl, isExtBottom);
      const wallLeft = getOrCreateWall(bl, tl, isExtLeft);

      const rType = typeof r.roomType === 'string' && r.roomType ? r.roomType : rName.toLowerCase().replace(/\s+/g, '_');
      rooms.push({
        id: roomId,
        name: rName,
        roomType: rType,
        boundaryNodeIds: [tl.id, tr.id, br.id, bl.id],
      });

      // Map Doors
      if (Array.isArray(r.doors)) {
        r.doors.forEach((d: any, dIdx: number) => {
          const side = String(d.wall || 'bottom').toLowerCase();
          const targetWall = side === 'top' ? wallTop : side === 'right' ? wallRight : side === 'left' ? wallLeft : wallBottom;
          const n1 = nodes.find(n => n.id === targetWall.startNodeId);
          const n2 = nodes.find(n => n.id === targetWall.endNodeId);
          const wallLenM = (n1 && n2) ? Math.hypot(n2.x - n1.x, n2.y - n1.y) : (side === 'top' || side === 'bottom' ? rwM : rhM);

          let chosenWall = targetWall;
          let chosenWallLen = wallLenM;

          if (chosenWallLen < 0.80) {
            // Target wall is too short to host a door with required 0.15m margins.
            // Check adjacent walls of this room that have sufficient length.
            const candidateWalls = [wallBottom, wallRight, wallLeft, wallTop];
            for (const cw of candidateWalls) {
              const cn1 = nodes.find(n => n.id === cw.startNodeId);
              const cn2 = nodes.find(n => n.id === cw.endNodeId);
              const clen = (cn1 && cn2) ? Math.hypot(cn2.x - cn1.x, cn2.y - cn1.y) : 0;
              if (clen >= 0.90) {
                chosenWall = cw;
                chosenWallLen = clen;
                break;
              }
            }
          }

          if (chosenWallLen < 0.80) return;

          const CORNER_MARGIN = 0.15;
          const maxAllowedWidth = chosenWallLen - 2 * CORNER_MARGIN;
          let widthM = ftToM(Number(d.width) || 3);
          widthM = Math.max(0.50, Math.min(widthM, maxAllowedWidth));
          if (widthM > maxAllowedWidth) {
            widthM = maxAllowedWidth;
          }

          const posM = ftToM(Number(d.position) || 3);
          const minOffset = CORNER_MARGIN + widthM / 2;
          const maxOffset = chosenWallLen - CORNER_MARGIN - widthM / 2;
          const opOffset = minOffset >= maxOffset ? chosenWallLen / 2 : Math.max(minOffset, Math.min(maxOffset, posM));

          // Deduplicate shared doorway: check if an opening on chosenWall already covers this exact doorway
          const s = opOffset - widthM / 2;
          const e = opOffset + widthM / 2;
          const isDuplicate = openings.some(existingOp => {
            if (existingOp.wallId !== chosenWall.id) return false;
            const es = existingOp.offset - existingOp.width / 2;
            const ee = existingOp.offset + existingOp.width / 2;
            return (Math.min(e, ee) - Math.max(s, es)) > 0.1;
          });

          if (!isDuplicate) {
            const isEntrance = Boolean(
              d.is_entrance ||
              d.name?.toLowerCase().includes('entrance') ||
              (levelId === 'lvl_0' && chosenWall.kind === 'exterior' && (rName.toLowerCase().includes('foyer') || rName.toLowerCase().includes('entrance') || rName.toLowerCase().includes('living')))
            );

            openings.push({
              id: `op_door_${roomId}_${dIdx + 1}`,
              wallId: chosenWall.id,
              offset: Math.round(opOffset * 1000) / 1000,
              width: Math.round(widthM * 1000) / 1000,
              height: 2.13,
              sill: 0,
              type: 'single_door',
              name: isEntrance ? 'Main Entrance Door' : `${rName} Door`,
            });
          }
        });
      }

      // Map Windows
      if (Array.isArray(r.windows)) {
        r.windows.forEach((w: any, wIdx: number) => {
          const side = String(w.wall || 'top').toLowerCase();
          const targetWall = side === 'top' ? wallTop : side === 'right' ? wallRight : side === 'left' ? wallLeft : wallBottom;
          const n1 = nodes.find(n => n.id === targetWall.startNodeId);
          const n2 = nodes.find(n => n.id === targetWall.endNodeId);
          const wallLenM = (n1 && n2) ? Math.hypot(n2.x - n1.x, n2.y - n1.y) : (side === 'top' || side === 'bottom' ? rwM : rhM);

          if (wallLenM < 0.90) return;

          const CORNER_MARGIN = 0.15;
          const maxAllowedWidth = wallLenM - 2 * CORNER_MARGIN;
          let widthM = ftToM(Number(w.width) || 4);
          widthM = Math.max(0.60, Math.min(widthM, maxAllowedWidth));
          if (widthM > maxAllowedWidth) {
            widthM = maxAllowedWidth;
          }

          const posM = ftToM(Number(w.position) || 3);
          const minOffset = CORNER_MARGIN + widthM / 2;
          const maxOffset = wallLenM - CORNER_MARGIN - widthM / 2;
          const opOffset = minOffset >= maxOffset ? wallLenM / 2 : Math.max(minOffset, Math.min(maxOffset, posM));

          const s = opOffset - widthM / 2;
          const e = opOffset + widthM / 2;
          const isDuplicate = openings.some(existingOp => {
            if (existingOp.wallId !== targetWall.id) return false;
            const es = existingOp.offset - existingOp.width / 2;
            const ee = existingOp.offset + existingOp.width / 2;
            return (Math.min(e, ee) - Math.max(s, es)) > 0.1;
          });

          if (!isDuplicate) {
            openings.push({
              id: `op_win_${roomId}_${wIdx + 1}`,
              wallId: targetWall.id,
              offset: Math.round(opOffset * 1000) / 1000,
              width: Math.round(widthM * 1000) / 1000,
              height: 1.22,
              sill: 0.91,
              type: 'window',
              name: `${rName} Window`,
            });
          }
        });
      }

      // Map Furniture
      if (Array.isArray(r.furniture)) {
        r.furniture.forEach((f: any, fIdx: number) => {
          const relXM = ftToM(Number(f.x) || 0);
          const relYM = ftToM(Number(f.y) || 0);
          items.push({
            id: String(f.id || `item_${roomId}_${fIdx + 1}`),
            assetId: String(f.catalogId || f.name?.toLowerCase().replace(/\s+/g, '_') || 'custom_item'),
            name: String(f.name || 'Furniture'),
            x: Math.round((rxM + relXM) * 1000) / 1000,
            y: Math.round((ryM + relYM) * 1000) / 1000,
            elevation: ftToM(Number(f.elevation) || 0),
            rotation: Number(f.rotation) || 0,
            width: ftToM(Number(f.width) || 3),
            depth: ftToM(Number(f.height) || 3),
            height: ftToM(Number(f.zHeight) || 2.5),
            color: f.color,
            isLight: Boolean(f.isLight),
          });
        });
      }
    });

    // Topological Wall Classification:
    // Determine exterior building envelope vs interior dividing partitions based on room incidence
    for (const w of walls) {
      let incidentCount = 0;
      let bordersOpen = false;

      for (const rm of rooms) {
        const nids = rm.boundaryNodeIds;
        const i1 = nids.indexOf(w.startNodeId);
        const i2 = nids.indexOf(w.endNodeId);
        if (i1 !== -1 && i2 !== -1) {
          const diff = Math.abs(i1 - i2);
          if (diff === 1 || diff === nids.length - 1) {
            incidentCount++;
            const rn = rm.name.toLowerCase();
            if (
              rn.includes('balcony') ||
              rn.includes('terrace') ||
              rn.includes('patio') ||
              rn.includes('sundeck') ||
              rn.includes('garden')
            ) {
              bordersOpen = true;
            }
          }
        }
      }

      if (incidentCount <= 1 || bordersOpen) {
        w.kind = 'exterior';
        w.thickness = 0.23; // 230mm (9 in) exterior envelope
      } else {
        w.kind = 'interior';
        w.thickness = 0.115; // 115mm (4.5 in) interior partition
      }
    }

    return {
      id: levelId,
      levelIndex: flIdx,
      name: levelName,
      elevation: flIdx * 3.3, // 3.3m per story
      height: 3.05,
      slabThickness: 0.25,
      nodes,
      walls,
      openings,
      rooms,
      items,
    };
  });

  return sanitizeCanonicalDocument({
    schemaVersion: SCHEMA_VERSION,
    id: String(raw.id || `proj_${Date.now()}`),
    metadata: {
      name: String(raw.name || `${plotWFt}×${plotLFt}ft Residence`),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entryDirection: entryDir,
      displayUnits: 'ft',
    },
    site: {
      plotPolygon: [
        { x: 0, y: 0 },
        { x: plotWM, y: 0 },
        { x: plotWM, y: plotLM },
        { x: 0, y: plotLM },
      ],
      width: plotWM,
      length: plotLM,
      entrySide: entryDir,
      northAngle: 0,
      setbacks: { front: 1.5, rear: 1.5, left: 1.0, right: 1.0 },
    },
    levels,
    legacySnapshot: raw,
  });
}
