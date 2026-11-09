import React, { useState, useRef, useEffect } from 'react';
import type { Room, FloorCirculation, SunlightResult, FurnitureItem } from '../../../shared/api-client/api';
import CirculationOverlay, { CirculationEgressHud } from './CirculationOverlay';
import SunlightOverlay, { SunlightStudyHud, type SolarTimeline } from './SunlightOverlay';
import { validateRoomPlacement } from '../../../shared/utils/validateRooms';
import { toast } from 'react-hot-toast';
import type { Command, PlacedItem } from '../geometry/types';
import { ftToM } from '../geometry/types';
import {
  createUpdateFloorRoomsCommand,
  createPlaceItemCommand,
  createTransformItemCommand,
  createDeleteItemCommand,
  createUpdateItemDimensionsCommand,
} from '../geometry/commands';
import {
  intervalsOverlap,
  SHARED_WALL_TOLERANCE_FT,
  propagateRoomBoundsWithSharedWalls,
} from '../geometry/layoutConstraints';

interface Props {
  rooms: Room[];
  selectedRoom: Room | null;
  onRoomSelect?: (room: Room, index: number) => void;
  onRoomDrop?: (updatedRooms: Room[], imageUrl?: string) => void;
  onGeometryCommand?: (cmd: Command) => boolean;
  circulation?: FloorCirculation | null;
  showCirculation?: boolean;
  sunlightResult?: SunlightResult | null;
  showSunlight?: boolean;
  entryDir?: string;
  plotWidth?: number;
  plotHeight?: number;
  floorIndex?: number;
  onSelectFurniture?: (item: FurnitureItem | null) => void;
  zoom?: number;
  onZoomChange?: (newZoom: number) => void;
  pan?: { x: number; y: number };
  onPanChange?: (newPan: { x: number; y: number }) => void;
  onRegisterSvgRef?: (ref: SVGSVGElement | null) => void;
  onSwitchTo3D?: () => void;
  activeFloorIndex?: number;
  totalFloors?: number;
  floorNames?: string[];
  onSelectFloor?: (index: number) => void;
}

// Architectural Atelier color scheme per room type — tactile washes on warm drafting paper
function getRoomStyle(name: string): { fill: string; stroke: string; labelColor: string; icon: string } {
  const n = name.toLowerCase();
  const primaryInk = '#252622';
  if (n.includes('master') || (n.includes('bedroom') && n.includes('1')))
    return { fill: 'rgba(216, 87, 64, 0.06)', stroke: primaryInk, labelColor: primaryInk, icon: '🛏' };
  if (n.includes('bedroom'))
    return { fill: 'rgba(184, 154, 100, 0.07)', stroke: primaryInk, labelColor: primaryInk, icon: '🛏' };
  if (n.includes('bath') || n.includes('toilet') || n.includes('wc'))
    return { fill: 'rgba(54, 95, 168, 0.06)', stroke: primaryInk, labelColor: primaryInk, icon: '🚿' };
  if (n.includes('kitchen'))
    return { fill: 'rgba(184, 154, 100, 0.10)', stroke: primaryInk, labelColor: primaryInk, icon: '🍳' };
  if (n.includes('living') || n.includes('lounge'))
    return { fill: 'rgba(231, 225, 213, 0.35)', stroke: primaryInk, labelColor: primaryInk, icon: '🛋' };
  if (n.includes('dining'))
    return { fill: 'rgba(184, 154, 100, 0.08)', stroke: primaryInk, labelColor: primaryInk, icon: '🍽' };
  if (n.includes('balcony') || n.includes('terrace'))
    return { fill: 'rgba(161, 174, 151, 0.16)', stroke: '#474943', labelColor: primaryInk, icon: '🌿' };
  if (n.includes('stair'))
    return { fill: 'rgba(184, 154, 100, 0.14)', stroke: primaryInk, labelColor: primaryInk, icon: '◤' };
  if (n.includes('parking') || n.includes('garage'))
    return { fill: 'rgba(37, 38, 34, 0.05)', stroke: primaryInk, labelColor: primaryInk, icon: '🚗' };
  if (n.includes('hall') || n.includes('lobby') || n.includes('foyer') || n.includes('entrance'))
    return { fill: 'rgba(231, 225, 213, 0.45)', stroke: primaryInk, labelColor: primaryInk, icon: '🚪' };
  if (n.includes('corridor'))
    return { fill: 'rgba(231, 225, 213, 0.25)', stroke: 'rgba(37, 38, 34, 0.4)', labelColor: '#777970', icon: '' };
  if (n.includes('store') || n.includes('utility') || n.includes('laundry'))
    return { fill: 'rgba(37, 38, 34, 0.04)', stroke: primaryInk, labelColor: primaryInk, icon: '📦' };
  if (n.includes('void'))
    return { fill: 'rgba(255, 255, 255, 0.9)', stroke: '#365FA8', labelColor: '#365FA8', icon: '⬚' };
  if (n.includes('pooja'))
    return { fill: 'rgba(184, 154, 100, 0.12)', stroke: primaryInk, labelColor: primaryInk, icon: '🪔' };
  if (n.includes('garden') || n.includes('lawn'))
    return { fill: 'rgba(161, 174, 151, 0.22)', stroke: '#474943', labelColor: primaryInk, icon: '🌺' };
  if (n.includes('gazebo'))
    return { fill: 'rgba(184, 154, 100, 0.12)', stroke: primaryInk, labelColor: primaryInk, icon: '🏛️' };
  if (n.includes('solar'))
    return { fill: 'rgba(184, 154, 100, 0.15)', stroke: primaryInk, labelColor: primaryInk, icon: '☀️' };
  if (n.includes('sundeck'))
    return { fill: 'rgba(161, 174, 151, 0.18)', stroke: primaryInk, labelColor: primaryInk, icon: '⛱️' };
  if (n.includes('landing'))
    return { fill: 'rgba(231, 225, 213, 0.3)', stroke: primaryInk, labelColor: primaryInk, icon: '' };
  return { fill: 'rgba(255, 255, 255, 0.6)', stroke: primaryInk, labelColor: primaryInk, icon: '◻' };
}

// Architectural flooring material patterns inspired by FloorPlanDrawer / Rayon
function getFlooringPatternId(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('living') || n.includes('hall') || n.includes('lounge') || n.includes('family')) return 'url(#pattern-wood-planks)';
  if (n.includes('kitchen') || n.includes('dining')) return 'url(#pattern-tile-kitchen)';
  if (n.includes('bath') || n.includes('toilet') || n.includes('powder') || n.includes('wc')) return 'url(#pattern-tile-bath)';
  if (n.includes('bed') || n.includes('guest') || n.includes('study')) return 'url(#pattern-bedroom-weave)';
  if (n.includes('balcony') || n.includes('terrace') || n.includes('deck') || n.includes('patio')) return 'url(#pattern-deck-balcony)';
  return null;
}

// Draw a simple furniture symbol inside a room
function FurnitureSymbol({ room, cx, cy }: { room: Room; cx: number; cy: number }) {
  const n = room.name.toLowerCase();
  const strokeW = 0.12;
  const stroke = '#94a3b8';

  if (n.includes('bedroom') || n.includes('master')) {
    // Simple bed rectangle
    const bw = Math.min(room.width * 0.55, 6);
    const bh = Math.min(room.height * 0.45, 4.5);
    return (
      <g>
        <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh}
          fill="white" stroke={stroke} strokeWidth={strokeW} rx={0.2} />
        <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh * 0.28}
          fill="#cbd5e1" stroke={stroke} strokeWidth={strokeW} rx={0.2} />
        <circle cx={cx - bw * 0.18} cy={cy - bh * 0.14} r={bh * 0.12}
          fill="#e2e8f0" stroke={stroke} strokeWidth={strokeW} />
        <circle cx={cx + bw * 0.18} cy={cy - bh * 0.14} r={bh * 0.12}
          fill="#e2e8f0" stroke={stroke} strokeWidth={strokeW} />
      </g>
    );
  }
  if (n.includes('living') || n.includes('lounge')) {
    // Simple sofa L-shape
    const sw = Math.min(room.width * 0.6, 7);
    const sh = Math.min(room.height * 0.35, 3);
    return (
      <g>
        <rect x={cx - sw / 2} y={cy} width={sw} height={sh}
          fill="white" stroke={stroke} strokeWidth={strokeW} rx={0.3} />
        <rect x={cx - sw / 2} y={cy} width={sw * 0.18} height={sh}
          fill="#e2e8f0" stroke={stroke} strokeWidth={strokeW} rx={0.3} />
        <rect x={cx + sw / 2 - sw * 0.18} y={cy} width={sw * 0.18} height={sh}
          fill="#e2e8f0" stroke={stroke} strokeWidth={strokeW} rx={0.3} />
        <rect x={cx - sw * 0.2} y={cy - sh * 0.7} width={sw * 0.4} height={sh * 0.6}
          fill="white" stroke={stroke} strokeWidth={strokeW} rx={0.2} />
      </g>
    );
  }
  if (n.includes('kitchen')) {
    // Counter/sink symbol
    const kw = Math.min(room.width * 0.65, 6);
    const kh = Math.min(room.height * 0.25, 2);
    return (
      <g>
        <rect x={cx - kw / 2} y={cy + room.height * 0.15} width={kw} height={kh}
          fill="white" stroke={stroke} strokeWidth={strokeW} />
        <circle cx={cx - kw * 0.15} cy={cy + room.height * 0.15 + kh / 2} r={kh * 0.32}
          fill="none" stroke={stroke} strokeWidth={strokeW} />
        <rect x={cx + kw * 0.05} y={cy + room.height * 0.15 + kh * 0.15} width={kw * 0.35} height={kh * 0.7}
          fill="#e2e8f0" stroke={stroke} strokeWidth={strokeW} rx={0.1} />
      </g>
    );
  }
  if (n.includes('bath') || n.includes('toilet') || n.includes('wc')) {
    // Toilet + bath symbol
    const bw = Math.min(room.width * 0.45, 3.5);
    const bh = Math.min(room.height * 0.55, 4.5);
    return (
      <g>
        <ellipse cx={cx - room.width * 0.12} cy={cy + room.height * 0.05} rx={bw * 0.35} ry={bh * 0.28}
          fill="white" stroke={stroke} strokeWidth={strokeW} />
        <ellipse cx={cx - room.width * 0.12} cy={cy + room.height * 0.05} rx={bw * 0.2} ry={bh * 0.16}
          fill="#e0f4f7" stroke={stroke} strokeWidth={strokeW * 0.7} />
        <rect x={cx + room.width * 0.08} y={cy - room.height * 0.2} width={bw * 0.7} height={bh * 0.55}
          fill="white" stroke={stroke} strokeWidth={strokeW} rx={bw * 0.15} />
      </g>
    );
  }
  if (n.includes('dining')) {
    // Round table + chairs
    const r = Math.min(room.width, room.height) * 0.22;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="white" stroke={stroke} strokeWidth={strokeW} />
        {[0, 90, 180, 270].map(angle => {
          const rad = (angle * Math.PI) / 180;
          const chx = cx + (r + r * 0.55) * Math.cos(rad);
          const chy = cy + (r + r * 0.55) * Math.sin(rad);
          return <circle key={angle} cx={chx} cy={chy} r={r * 0.3}
            fill="white" stroke={stroke} strokeWidth={strokeW} />;
        })}
      </g>
    );
  }
  return null;
}

// Color palette per furniture type — defined outside component to avoid recreation
function getFurnFill(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('bed'))                                      return '#c8daf0';
  if (n.includes('sofa') || n.includes('couch'))             return '#c4baf2';
  if (n.includes('dining table') || n.includes('coffee table')) return '#f0d8a0';
  if (n.includes('wardrobe') || n.includes('cabinet'))       return '#c0d4b8';
  if (n.includes('toilet') || n.includes('bath') || n.includes('shower')) return '#b0d8e8';
  if (n.includes('island') || n.includes('counter'))         return '#f0e0b0';
  if (n.includes('desk') || n.includes('study chair'))       return '#d0e8c0';
  if (n.includes('tv'))                                       return '#303840';
  if (n.includes('car'))                                      return '#b0c0d8';
  if (n.includes('plant') || n.includes('pot'))              return '#a0d0a0';
  if (n.includes('shelf') || n.includes('bookshelf'))        return '#c8b888';
  return '#d4dce8';
}

// ── Coordinate Furniture & Lighting CAD Renderer ─────────────────────────────
function renderDetailedFurniture(furn: FurnitureItem, x: number, y: number, w: number, h: number, fill: string, stroke: string) {
  const n = (furn.name || '').toLowerCase();
  const isHoriz = w >= h;

  // 1. Lighting Fixtures
  if (furn.isLight || n.includes('light') || n.includes('sconce') || n.includes('chandelier') || n.includes('lamp') || n.includes('lantern')) {
    const radius = furn.lightProperties?.radius || 6.0;
    const cx = x + w / 2;
    const cy = y + h / 2;
    return (
      <g>
        {/* Dashed outer illumination radius */}
        <circle cx={cx} cy={cy} r={radius} fill="rgba(254, 240, 138, 0.06)" stroke="#fde047" strokeWidth={0.12} strokeDasharray="0.4 0.2" />
        {/* Luminous glow circle */}
        <circle cx={cx} cy={cy} r={Math.max(w, h) * 0.75} fill="rgba(250, 204, 21, 0.22)" stroke="#eab308" strokeWidth={0.14} />
        {/* Core fixture disc */}
        <circle cx={cx} cy={cy} r={Math.max(w, h) * 0.42} fill="#fef08a" stroke="#ca8a04" strokeWidth={0.18} />
        {/* Filament crosshair */}
        <line x1={cx - 0.35} y1={cy} x2={cx + 0.35} y2={cy} stroke="#a16207" strokeWidth={0.1} />
        <line x1={cx} y1={cy - 0.35} x2={cx} y2={cy + 0.35} stroke="#a16207" strokeWidth={0.1} />
      </g>
    );
  }

  // 2. Bed
  if (n.includes('bed')) {
    const isKing = n.includes('king');
    const pW = isHoriz ? w * 0.16 : w * 0.36;
    const pH = isHoriz ? h * 0.36 : h * 0.16;
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.14} rx={0.2} />
        {isHoriz ? (
          <rect x={x} y={y} width={w * 0.12} height={h} fill="#475569" stroke={stroke} strokeWidth={0.1} rx={0.1} />
        ) : (
          <rect x={x} y={y} width={w} height={h * 0.12} fill="#475569" stroke={stroke} strokeWidth={0.1} rx={0.1} />
        )}
        {isHoriz ? (
          <line x1={x + w * 0.32} y1={y} x2={x + w * 0.32} y2={y + h} stroke={stroke} strokeWidth={0.08} />
        ) : (
          <line x1={x} y1={y + h * 0.32} x2={x + w} y2={y + h * 0.32} stroke={stroke} strokeWidth={0.08} />
        )}
        {isHoriz ? (
          <>
            <rect x={x + w * 0.15} y={y + h * 0.1} width={pW} height={pH} fill="#ffffff" stroke={stroke} strokeWidth={0.08} rx={0.12} />
            <rect x={x + w * 0.15} y={y + h * 0.54} width={pW} height={pH} fill="#ffffff" stroke={stroke} strokeWidth={0.08} rx={0.12} />
          </>
        ) : (
          <>
            <rect x={x + w * 0.1} y={y + h * 0.15} width={pW} height={pH} fill="#ffffff" stroke={stroke} strokeWidth={0.08} rx={0.12} />
            <rect x={x + w * 0.54} y={y + h * 0.15} width={pW} height={pH} fill="#ffffff" stroke={stroke} strokeWidth={0.08} rx={0.12} />
          </>
        )}
        {isKing && (
          isHoriz ? (
            <>
              <rect x={x} y={y - 1.1} width={1.3} height={1.0} fill="#e2e8f0" stroke={stroke} strokeWidth={0.08} rx={0.1} />
              <rect x={x} y={y + h + 0.1} width={1.3} height={1.0} fill="#e2e8f0" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            </>
          ) : (
            <>
              <rect x={x - 1.1} y={y} width={1.0} height={1.3} fill="#e2e8f0" stroke={stroke} strokeWidth={0.08} rx={0.1} />
              <rect x={x + w + 0.1} y={y} width={1.0} height={1.3} fill="#e2e8f0" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            </>
          )
        )}
      </g>
    );
  }

  // 3. Sofa & Sectional
  if (n.includes('sofa') || n.includes('couch') || n.includes('sectional') || n.includes('l_shape') || n.includes('l-shape')) {
    const isSectional = n.includes('sectional') || n.includes('l_shape') || n.includes('l-shape');
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.14} rx={0.25} />
        {isHoriz ? (
          <>
            <rect x={x} y={y} width={w} height={h * 0.28} fill="rgba(0,0,0,0.12)" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            <rect x={x} y={y + h * 0.28} width={w * 0.14} height={h * 0.72} fill="rgba(0,0,0,0.12)" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            <rect x={x + w * 0.86} y={y + h * 0.28} width={w * 0.14} height={h * 0.72} fill="rgba(0,0,0,0.12)" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            {isSectional && (
              <rect x={x + w * 0.65} y={y + h * 0.28} width={w * 0.35} height={h * 0.72} fill="rgba(0,0,0,0.06)" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            )}
          </>
        ) : (
          <>
            <rect x={x + w * 0.72} y={y} width={w * 0.28} height={h} fill="rgba(0,0,0,0.12)" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            <rect x={x} y={y} width={w * 0.72} height={h * 0.14} fill="rgba(0,0,0,0.12)" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            <rect x={x} y={y + h * 0.86} width={w * 0.72} height={h * 0.14} fill="rgba(0,0,0,0.12)" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            {isSectional && (
              <rect x={x} y={y + h * 0.65} width={w * 0.72} height={h * 0.35} fill="rgba(0,0,0,0.06)" stroke={stroke} strokeWidth={0.08} rx={0.1} />
            )}
          </>
        )}
      </g>
    );
  }

  // 4. Dining Table
  if (n.includes('dining')) {
    const rx = isHoriz ? w * 0.08 : h * 0.08;
    return (
      <g>
        {isHoriz ? (
          <>
            <circle cx={x + w * 0.2} cy={y - 0.4} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x + w * 0.5} cy={y - 0.4} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x + w * 0.8} cy={y - 0.4} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x + w * 0.2} cy={y + h + 0.4} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x + w * 0.5} cy={y + h + 0.4} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x + w * 0.8} cy={y + h + 0.4} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
          </>
        ) : (
          <>
            <circle cx={x - 0.4} cy={y + h * 0.2} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x - 0.4} cy={y + h * 0.5} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x - 0.4} cy={y + h * 0.8} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x + w + 0.4} cy={y + h * 0.2} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x + w + 0.4} cy={y + h * 0.5} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
            <circle cx={x + w + 0.4} cy={y + h * 0.8} r={0.52} fill="#ffffff" stroke={stroke} strokeWidth={0.08} />
          </>
        )}
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.14} rx={rx} />
      </g>
    );
  }

  // 5. Toilet / Sanitary
  if (n.includes('toilet') || n.includes('wc')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h * 0.35} fill="#f1f5f9" stroke={stroke} strokeWidth={0.1} rx={0.1} />
        <ellipse cx={x + w / 2} cy={y + h * 0.65} rx={w * 0.42} ry={h * 0.32} fill="#ffffff" stroke={stroke} strokeWidth={0.1} />
        <ellipse cx={x + w / 2} cy={y + h * 0.65} rx={w * 0.25} ry={h * 0.2} fill="#e0f2fe" stroke={stroke} strokeWidth={0.08} />
      </g>
    );
  }

  // 6. Vanity / Sink
  if (n.includes('vanity') || n.includes('sink')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.12} rx={0.15} />
        <ellipse cx={x + w / 2} cy={y + h / 2} rx={w * 0.32} ry={h * 0.28} fill="#ffffff" stroke={stroke} strokeWidth={0.1} />
        <circle cx={x + w / 2} cy={y + h * 0.25} r={0.15} fill="#94a3b8" />
      </g>
    );
  }

  // 7. Bathtub / Shower
  if (n.includes('bath') || n.includes('tub') || n.includes('shower')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#e0f2fe" stroke={stroke} strokeWidth={0.14} rx={0.3} />
        <rect x={x + 0.2} y={y + 0.2} width={w - 0.4} height={h - 0.4} fill="#ffffff" stroke={stroke} strokeWidth={0.1} rx={0.25} />
        <circle cx={x + w * 0.2} cy={y + h / 2} r={0.18} fill="#94a3b8" />
      </g>
    );
  }

  // 8. Stove / Range
  if (n.includes('cook') || n.includes('range') || n.includes('stove')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#1e293b" stroke={stroke} strokeWidth={0.14} rx={0.15} />
        <circle cx={x + w * 0.3} cy={y + h * 0.3} r={0.32} fill="#475569" stroke="#94a3b8" strokeWidth={0.08} />
        <circle cx={x + w * 0.7} cy={y + h * 0.3} r={0.32} fill="#475569" stroke="#94a3b8" strokeWidth={0.08} />
        <circle cx={x + w * 0.3} cy={y + h * 0.7} r={0.32} fill="#475569" stroke="#94a3b8" strokeWidth={0.08} />
        <circle cx={x + w * 0.7} cy={y + h * 0.7} r={0.32} fill="#475569" stroke="#94a3b8" strokeWidth={0.08} />
      </g>
    );
  }

  // 9. Refrigerator
  if (n.includes('fridge') || n.includes('refrigerator')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#cbd5e1" stroke={stroke} strokeWidth={0.14} rx={0.15} />
        <line x1={x} y1={y + h * 0.3} x2={x + w} y2={y + h * 0.3} stroke="#64748b" strokeWidth={0.12} />
      </g>
    );
  }

  // 10. Wardrobe
  if (n.includes('wardrobe') || n.includes('closet')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.14} rx={0.15} />
        <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke={stroke} strokeWidth={0.1} />
        <circle cx={x + w / 2 - 0.25} cy={y + h / 2} r={0.1} fill="#475569" />
        <circle cx={x + w / 2 + 0.25} cy={y + h / 2} r={0.1} fill="#475569" />
      </g>
    );
  }

  // 11. Desk / Study
  if (n.includes('desk') || n.includes('study')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.14} rx={0.15} />
        <circle cx={x + w / 2} cy={y + h + 0.45} r={0.6} fill="#ffffff" stroke={stroke} strokeWidth={0.1} />
      </g>
    );
  }

  // 12. Outdoor / BBQ / Planter / Lounger
  if (n.includes('planter')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#5c4033" stroke={stroke} strokeWidth={0.14} rx={0.15} />
        <circle cx={x + w * 0.25} cy={y + h / 2} r={h * 0.35} fill="#22c55e" opacity={0.8} />
        <circle cx={x + w * 0.5} cy={y + h / 2} r={h * 0.35} fill="#16a34a" opacity={0.8} />
        <circle cx={x + w * 0.75} cy={y + h / 2} r={h * 0.35} fill="#15803d" opacity={0.8} />
      </g>
    );
  }

  if (n.includes('grill') || n.includes('bbq')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#1e293b" stroke={stroke} strokeWidth={0.14} rx={0.2} />
        <rect x={x + 0.2} y={y + 0.2} width={w - 0.4} height={h - 0.4} fill="#334155" stroke="#94a3b8" strokeWidth={0.08} />
        <line x1={x + 0.4} y1={y + h / 2} x2={x + w - 0.4} y2={y + h / 2} stroke="#f8fafc" strokeWidth={0.12} />
      </g>
    );
  }

  if (n.includes('lounger') || n.includes('sunbed')) {
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke={stroke} strokeWidth={0.14} rx={0.2} />
        <rect x={x + 0.15} y={y + 0.15} width={w - 0.3} height={h * 0.22} fill="#f1f5f9" stroke={stroke} strokeWidth={0.08} rx={0.1} />
      </g>
    );
  }

  return <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.12} rx={0.15} />;
}

export type FurnitureResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

function FurnitureLayer({
  room,
  roomIndex,
  selectedFurniture,
  isResizing,
  onFurniturePointerDown,
  onRotateFurniture,
  onDuplicateFurniture,
  onDeleteFurniture,
  onResizeFurnitureDown,
}: {
  room: Room;
  roomIndex: number;
  selectedFurniture: { roomIndex: number; furnitureIndex: number } | null;
  isResizing?: boolean;
  onFurniturePointerDown: (e: React.PointerEvent, roomIndex: number, furnitureIndex: number, furn: FurnitureItem) => void;
  onRotateFurniture: (roomIndex: number, furnitureIndex: number, deltaDeg: number) => void;
  onDuplicateFurniture: (roomIndex: number, furnitureIndex: number) => void;
  onDeleteFurniture: (roomIndex: number, furnitureIndex: number) => void;
  onResizeFurnitureDown?: (e: React.PointerEvent, roomIndex: number, furnitureIndex: number, furn: FurnitureItem, handle: FurnitureResizeHandle) => void;
}) {
  const items = room.furniture;

  if (!items || items.length === 0) {
    return <FurnitureSymbol room={room} cx={room.x + room.width / 2} cy={room.y + room.height / 2} />;
  }

  return (
    <g>
      {items.map((furn, idx) => {
        const ax = room.x + furn.x;
        const ay = room.y + furn.y;
        const fw = furn.width;
        const fh = furn.height;
        const fcx = ax + fw / 2;
        const fcy = ay + fh / 2;
        const labelSize = Math.max(0.48, Math.min(fw, fh) * 0.15);
        const fill = furn.color || getFurnFill(furn.name);
        const stroke = "rgba(90,110,150,0.75)";
        const isSelected = selectedFurniture?.roomIndex === roomIndex && selectedFurniture?.furnitureIndex === idx;

        return (
          <g
            key={furn.id || idx}
            style={{ cursor: 'grab', pointerEvents: 'auto' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onFurniturePointerDown(e, roomIndex, idx, furn);
            }}
          >
            {/* Rotated Furniture Shape */}
            <g transform={`rotate(${furn.rotation || 0} ${fcx} ${fcy})`}>
              {renderDetailedFurniture(furn, ax, ay, fw, fh, fill, stroke)}
              {/* Furniture name label */}
              {!furn.isLight && fw > 2 && fh > 1.4 && (
                <text
                  x={fcx} y={fcy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={labelSize}
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight="600"
                  fill="rgba(30,45,75,0.9)"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {furn.name}
                </text>
              )}

              {/* Selection Bounding Box & 8 Interactive CAD Resize Handles */}
              {isSelected && (
                <g>
                  {/* Bounding box outline */}
                  <rect
                    x={ax - 0.25}
                    y={ay - 0.25}
                    width={fw + 0.5}
                    height={fh + 0.5}
                    fill="rgba(37, 99, 235, 0.08)"
                    stroke="#2563EB"
                    strokeWidth={0.16}
                    strokeDasharray="0.6 0.3"
                    rx={0.2}
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* ── 4 Corner Handles ── */}
                  {/* NW Resize Handle */}
                  <g
                    style={{ cursor: 'nwse-resize' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeFurnitureDown?.(e, roomIndex, idx, furn, 'nw');
                    }}
                  >
                    <circle cx={ax - 0.25} cy={ay - 0.25} r={0.75} fill="transparent" />
                    <circle cx={ax - 0.25} cy={ay - 0.25} r={0.38} fill="#FAF8F2" stroke="#2563EB" strokeWidth={0.14} />
                    <circle cx={ax - 0.25} cy={ay - 0.25} r={0.16} fill="#2563EB" />
                  </g>

                  {/* NE Resize Handle */}
                  <g
                    style={{ cursor: 'nesw-resize' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeFurnitureDown?.(e, roomIndex, idx, furn, 'ne');
                    }}
                  >
                    <circle cx={ax + fw + 0.25} cy={ay - 0.25} r={0.75} fill="transparent" />
                    <circle cx={ax + fw + 0.25} cy={ay - 0.25} r={0.38} fill="#FAF8F2" stroke="#2563EB" strokeWidth={0.14} />
                    <circle cx={ax + fw + 0.25} cy={ay - 0.25} r={0.16} fill="#2563EB" />
                  </g>

                  {/* SW Resize Handle */}
                  <g
                    style={{ cursor: 'nesw-resize' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeFurnitureDown?.(e, roomIndex, idx, furn, 'sw');
                    }}
                  >
                    <circle cx={ax - 0.25} cy={ay + fh + 0.25} r={0.75} fill="transparent" />
                    <circle cx={ax - 0.25} cy={ay + fh + 0.25} r={0.38} fill="#FAF8F2" stroke="#2563EB" strokeWidth={0.14} />
                    <circle cx={ax - 0.25} cy={ay + fh + 0.25} r={0.16} fill="#2563EB" />
                  </g>

                  {/* SE Resize Handle */}
                  <g
                    style={{ cursor: 'nwse-resize' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeFurnitureDown?.(e, roomIndex, idx, furn, 'se');
                    }}
                  >
                    <circle cx={ax + fw + 0.25} cy={ay + fh + 0.25} r={0.75} fill="transparent" />
                    <circle cx={ax + fw + 0.25} cy={ay + fh + 0.25} r={0.38} fill="#FAF8F2" stroke="#2563EB" strokeWidth={0.14} />
                    <circle cx={ax + fw + 0.25} cy={ay + fh + 0.25} r={0.16} fill="#2563EB" />
                  </g>

                  {/* ── 4 Midpoint Edge Handles ── */}
                  {/* North Edge Handle */}
                  <g
                    style={{ cursor: 'ns-resize' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeFurnitureDown?.(e, roomIndex, idx, furn, 'n');
                    }}
                  >
                    <rect x={ax + fw / 2 - 0.6} y={ay - 0.5} width={1.2} height={0.6} fill="transparent" />
                    <rect x={ax + fw / 2 - 0.45} y={ay - 0.38} width={0.9} height={0.26} rx={0.1} fill="#FAF8F2" stroke="#2563EB" strokeWidth={0.12} />
                  </g>

                  {/* South Edge Handle */}
                  <g
                    style={{ cursor: 'ns-resize' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeFurnitureDown?.(e, roomIndex, idx, furn, 's');
                    }}
                  >
                    <rect x={ax + fw / 2 - 0.6} y={ay + fh - 0.1} width={1.2} height={0.6} fill="transparent" />
                    <rect x={ax + fw / 2 - 0.45} y={ay + fh + 0.12} width={0.9} height={0.26} rx={0.1} fill="#FAF8F2" stroke="#2563EB" strokeWidth={0.12} />
                  </g>

                  {/* East Edge Handle */}
                  <g
                    style={{ cursor: 'ew-resize' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeFurnitureDown?.(e, roomIndex, idx, furn, 'e');
                    }}
                  >
                    <rect x={ax + fw - 0.1} y={ay + fh / 2 - 0.6} width={0.6} height={1.2} fill="transparent" />
                    <rect x={ax + fw + 0.12} y={ay + fh / 2 - 0.45} width={0.26} height={0.9} rx={0.1} fill="#FAF8F2" stroke="#2563EB" strokeWidth={0.12} />
                  </g>

                  {/* West Edge Handle */}
                  <g
                    style={{ cursor: 'ew-resize' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeFurnitureDown?.(e, roomIndex, idx, furn, 'w');
                    }}
                  >
                    <rect x={ax - 0.5} y={ay + fh / 2 - 0.6} width={0.6} height={1.2} fill="transparent" />
                    <rect x={ax - 0.38} y={ay + fh / 2 - 0.45} width={0.26} height={0.9} rx={0.1} fill="#FAF8F2" stroke="#2563EB" strokeWidth={0.12} />
                  </g>
                </g>
              )}
            </g>

            {/* Live Real-time Dimension HUD Badge while Resizing */}
            {isSelected && isResizing && (
              <g transform={`translate(${fcx}, ${ay - 1.6})`} style={{ pointerEvents: 'none' }}>
                <rect
                  x={-4.5} y={-0.85} width={9.0} height={1.7} rx={0.4}
                  fill="#1E293B" stroke="#2563EB" strokeWidth={0.12}
                />
                <text
                  x={0} y={0.05} textAnchor="middle" dominantBaseline="middle"
                  fill="#FAF8F2" fontSize={0.65} fontFamily="'JetBrains Mono', monospace" fontWeight="700"
                >
                  {Math.round(fw * 10) / 10} × {Math.round(fh * 10) / 10} FT · {(fw * 0.3048).toFixed(2)} × {(fh * 0.3048).toFixed(2)} M
                </text>
              </g>
            )}

            {/* Floating CAD Transform Action Bar above the selected item (when not actively resizing) */}
            {isSelected && !isResizing && (
              <g transform={`translate(${fcx}, ${ay - 1.25})`} style={{ pointerEvents: 'auto' }}>
                <rect x={-4.4} y={-0.8} width={8.8} height={1.6} rx={0.8} fill="#1E293B" stroke="#64748B" strokeWidth={0.12} />
                {/* Rotate -45 */}
                <g style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onRotateFurniture(roomIndex, idx, -45); }}>
                  <rect x={-4.1} y={-0.65} width={1.4} height={1.3} rx={0.25} fill="#334155" />
                  <text x={-3.4} y={0.08} textAnchor="middle" dominantBaseline="middle" fill="#38BDF8" fontSize={0.62} fontWeight="700">⟲-45°</text>
                </g>
                {/* Rotate +45 */}
                <g style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onRotateFurniture(roomIndex, idx, 45); }}>
                  <rect x={-2.45} y={-0.65} width={1.4} height={1.3} rx={0.25} fill="#334155" />
                  <text x={-1.75} y={0.08} textAnchor="middle" dominantBaseline="middle" fill="#38BDF8" fontSize={0.62} fontWeight="700">⟳+45°</text>
                </g>
                {/* Flip 90 */}
                <g style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onRotateFurniture(roomIndex, idx, 90); }}>
                  <rect x={-0.8} y={-0.65} width={1.4} height={1.3} rx={0.25} fill="#334155" />
                  <text x={-0.1} y={0.08} textAnchor="middle" dominantBaseline="middle" fill="#38BDF8" fontSize={0.62} fontWeight="700">↻90°</text>
                </g>
                {/* Clone */}
                <g style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onDuplicateFurniture(roomIndex, idx); }}>
                  <rect x={0.85} y={-0.65} width={1.4} height={1.3} rx={0.25} fill="#334155" />
                  <text x={1.55} y={0.08} textAnchor="middle" dominantBaseline="middle" fill="#F8FAFC" fontSize={0.62} fontWeight="700">⧉</text>
                </g>
                {/* Delete */}
                <g style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onDeleteFurniture(roomIndex, idx); }}>
                  <rect x={2.5} y={-0.65} width={1.4} height={1.3} rx={0.25} fill="#DC2626" />
                  <text x={3.2} y={0.08} textAnchor="middle" dominantBaseline="middle" fill="#FFFFFF" fontSize={0.62} fontWeight="700">✕</text>
                </g>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}


function DoorArcs({ room, doorAttributes }: { room: Room, doorAttributes: { claims: Map<string, string>, stairs: Set<string> } }) {
  if (!room.doors || room.doors.length === 0) return null;

  return (
    <g>
      {room.doors.map((door, idx) => {
        const getDoorGeometry = () => {
          const rawDw = door.width || 3;
          const wallLen = (door.wall === 'top' || door.wall === 'bottom') ? room.width : room.height;
          const minPos = 0.2;
          const maxPos = Math.max(minPos, wallLen - 1.5);
          const pos = Math.max(minPos, Math.min(maxPos, door.position || 0));
          const maxSwing = (door.wall === 'top' || door.wall === 'bottom' ? room.height : room.width) * 0.75;
          const dw = Math.min(rawDw, Math.max(1.2, wallLen - pos - 0.2), Math.max(1.2, maxSwing));

          if (door.wall === 'top') {
            const hx = room.x + pos;
            const hy = room.y;
            return {
              dw, hx, hy,
              gapX1: hx, gapY1: hy, gapX2: hx + dw, gapY2: hy,
              leafX: hx, leafY: hy + dw,
              arcEndX: hx + dw, arcEndY: hy,
              sweepFlag: 1
            };
          }
          if (door.wall === 'bottom') {
            const hx = room.x + pos;
            const hy = room.y + room.height;
            return {
              dw, hx, hy,
              gapX1: hx, gapY1: hy, gapX2: hx + dw, gapY2: hy,
              leafX: hx, leafY: hy - dw,
              arcEndX: hx + dw, arcEndY: hy,
              sweepFlag: 0
            };
          }
          if (door.wall === 'left') {
            const hx = room.x;
            const hy = room.y + pos;
            return {
              dw, hx, hy,
              gapX1: hx, gapY1: hy, gapX2: hx, gapY2: hy + dw,
              leafX: hx + dw, leafY: hy,
              arcEndX: hx, arcEndY: hy + dw,
              sweepFlag: 1
            };
          }
          if (door.wall === 'right') {
            const hx = room.x + room.width;
            const hy = room.y + pos;
            return {
              dw, hx, hy,
              gapX1: hx, gapY1: hy, gapX2: hx, gapY2: hy + dw,
              leafX: hx - dw, leafY: hy,
              arcEndX: hx, arcEndY: hy + dw,
              sweepFlag: 0
            };
          }
          return null;
        };

        const geom = getDoorGeometry();
        if (!geom || geom.dw <= 0) return null;

        const { hx, hy, leafX, leafY, dw, sweepFlag, arcEndX, arcEndY, gapX1, gapY1, gapX2, gapY2 } = geom;

        // Compute exact world coordinates of the hinge
        const hingeX = (door.wall === 'left' || door.wall === 'right') 
          ? (door.wall === 'left' ? room.x : room.x + room.width) 
          : hx;
        const hingeY = (door.wall === 'top' || door.wall === 'bottom')
          ? (door.wall === 'top' ? room.y : room.y + room.height)
          : hy;
        
        const key = `${Math.round(hingeX * 10)},${Math.round(hingeY * 10)}`;
        const isDrawn = doorAttributes.claims.get(key) !== room.name;
        const isStairDoor = doorAttributes.stairs.has(key);

        return (
          <g key={`door-${idx}`}>
            {/* Paper gap in wall = door opening */}
            <line x1={gapX1} y1={gapY1} x2={gapX2} y2={gapY2}
              stroke="#FAF8F2" strokeWidth={0.65} />
            
            {!isDrawn && !isStairDoor && (
              <>
                <path d={`M ${hx} ${hy} L ${leafX} ${leafY} A ${dw} ${dw} 0 0 ${sweepFlag} ${arcEndX} ${arcEndY}`}
                  fill="rgba(37,38,34,0.04)" stroke="#777970" strokeWidth={0.12} strokeDasharray="0.4 0.2" />
                <line x1={hx} y1={hy} x2={leafX} y2={leafY} stroke="#252622" strokeWidth={0.24} />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}


// Window marks on exterior walls — driven by room.windows[] from backend.
// Draws the standard architectural window symbol: double line (glass pane) + end ticks.
function WindowMarks({ room }: { room: Room }) {
  const wins = room.windows;
  // No windows data → nothing to draw (no invented defaults)
  if (!wins || wins.length === 0) return null;

  return (
    <g>
      {wins.map((w, idx) => {
        const wallLen = (w.wall === 'top' || w.wall === 'bottom') ? room.width : room.height;
        const minPos = 0.2;
        const maxPos = Math.max(minPos, wallLen - 1.5);
        const pos = Math.max(minPos, Math.min(maxPos, w.position ?? 0));
        const ww  = Math.min(w.width ?? 3, Math.max(1.0, wallLen - pos - 0.2));

        // Pure declarative geometry — returns null if wall is unknown
        const geom = (() => {
          const TICK = 0.35;
          const GLASS = 0.18;
          if (w.wall === 'top') {
            const x1 = room.x + pos, y1 = room.y, x2 = room.x + pos + ww, y2 = room.y;
            return { x1, y1, x2, y2, gx1: x1, gy1: y1 + GLASS, gx2: x2, gy2: y2 + GLASS,
              t1: [x1, y1 - TICK, x1, y1 + TICK] as const, t2: [x2, y2 - TICK, x2, y2 + TICK] as const };
          }
          if (w.wall === 'bottom') {
            const x1 = room.x + pos, y1 = room.y + room.height, x2 = room.x + pos + ww, y2 = room.y + room.height;
            return { x1, y1, x2, y2, gx1: x1, gy1: y1 - GLASS, gx2: x2, gy2: y2 - GLASS,
              t1: [x1, y1 - TICK, x1, y1 + TICK] as const, t2: [x2, y2 - TICK, x2, y2 + TICK] as const };
          }
          if (w.wall === 'left') {
            const x1 = room.x, y1 = room.y + pos, x2 = room.x, y2 = room.y + pos + ww;
            return { x1, y1, x2, y2, gx1: x1 + GLASS, gy1: y1, gx2: x2 + GLASS, gy2: y2,
              t1: [x1 - TICK, y1, x1 + TICK, y1] as const, t2: [x2 - TICK, y2, x2 + TICK, y2] as const };
          }
          if (w.wall === 'right') {
            const x1 = room.x + room.width, y1 = room.y + pos, x2 = room.x + room.width, y2 = room.y + pos + ww;
            return { x1, y1, x2, y2, gx1: x1 - GLASS, gy1: y1, gx2: x2 - GLASS, gy2: y2,
              t1: [x1 - TICK, y1, x1 + TICK, y1] as const, t2: [x2 - TICK, y2, x2 + TICK, y2] as const };
          }
          return null;
        })();

        if (!geom) return null;
        const { x1, y1, x2, y2, gx1, gy1, gx2, gy2, t1, t2 } = geom;

        return (
          <g key={`win-${room.name}-${idx}`}>
            {/* Paper gap on wall (matches door gap style) */}
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#FAF8F2" strokeWidth={0.55} />
            {/* Outer window line (wall face) */}
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#365FA8" strokeWidth={0.22} />
            {/* Inner glass line */}
            <line x1={gx1} y1={gy1} x2={gx2} y2={gy2}
              stroke="#365FA8" strokeWidth={0.12} strokeDasharray="0.3 0.15" />
            {/* End ticks */}
            <line x1={t1[0]} y1={t1[1]} x2={t1[2]} y2={t1[3]}
              stroke="#365FA8" strokeWidth={0.18} />
            <line x1={t2[0]} y1={t2[1]} x2={t2[2]} y2={t2[3]}
              stroke="#365FA8" strokeWidth={0.18} />
          </g>
        );
      })}
    </g>
  );
}

// Helper: Clamps openings (doors/windows) and contained furniture inside room walls
function clampOpeningsAndFurnitureToRoom(r: Room): void {
  if (r.doors && r.doors.length > 0) {
    r.doors = r.doors.map(d => {
      const wallLen = (d.wall === 'top' || d.wall === 'bottom') ? r.width : r.height;
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
      const wallLen = (w.wall === 'top' || w.wall === 'bottom') ? r.width : r.height;
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

const InteractiveBlueprint: React.FC<Props> = React.memo(({
  rooms,
  selectedRoom,
  onRoomSelect,
  onRoomDrop,
  onGeometryCommand,
  circulation,
  showCirculation,
  sunlightResult,
  showSunlight,
  entryDir = 'north',
  plotWidth,
  plotHeight,
  floorIndex = 0,
  onSelectFurniture,
  zoom,
  onZoomChange,
  pan,
  onPanChange,
  onRegisterSvgRef,
  onSwitchTo3D,
  activeFloorIndex,
  totalFloors,
  floorNames,
  onSelectFloor,
}) => {
  // Drag overlay: only maintain local state during an active drag.
  // When not dragging, the parent prop is the source of truth (no sync needed).
  const [dragRooms, setDragRooms] = useState<Room[] | null>(null);
  const displayRooms = dragRooms ?? rooms;
  const [solarTimeline, setSolarTimeline] = useState<SolarTimeline>('morning');

  const [draggingRoomIndex, setDraggingRoomIndex] = useState<number | null>(null);
  const [draggingEdge, setDraggingEdge] = useState<'top' | 'right' | 'bottom' | 'left' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null>(null);
  const [roomResizeMode, setRoomResizeMode] = useState<'synced' | 'independent'>('synced');
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);
  const dragOriginalRooms = useRef<Room[] | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasActuallyDraggedRef = useRef<boolean>(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Track shift key for rapid independent room resizing shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Expose SVG element reference for 2D floor-plan export
  useEffect(() => {
    onRegisterSvgRef?.(svgRef.current);
    return () => {
      onRegisterSvgRef?.(null);
    };
  }, [onRegisterSvgRef]);

  // ── Zoom & Pan State ──
  const [localZoom, setLocalZoom] = useState(1.0);
  const [localPan, setLocalPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, clientX: 0, clientY: 0 });

  const effectiveZoom = zoom ?? localZoom;
  const effectivePan = pan ?? localPan;

  // ViewBox dimensions computed early for exact pan/zoom math
  const PAD = 6;
  const WALL = 0.4;
  const allX = displayRooms.flatMap(r => [r.x, r.x + r.width]);
  const allY = displayRooms.flatMap(r => [r.y, r.y + r.height]);
  const minX = (allX.length > 0 ? Math.min(...allX) : 0) - PAD;
  const minY = (allY.length > 0 ? Math.min(...allY) : 0) - PAD;
  const maxX = (allX.length > 0 ? Math.max(...allX) : 40) + PAD;
  const maxY = (allY.length > 0 ? Math.max(...allY) : 30) + PAD;
  const baseW = Math.max(10, maxX - minX);
  const baseH = Math.max(10, maxY - minY);
  const vbW = baseW / effectiveZoom;
  const vbH = baseH / effectiveZoom;
  const vbX = minX + (baseW - vbW) / 2 - effectivePan.x;
  const vbY = minY + (baseH - vbH) / 2 - effectivePan.y;
  const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

  // ── Snapping & Alignment Guides ──
  const [alignmentGuides, setAlignmentGuides] = useState<Array<{ type: 'x' | 'y'; val: number }>>([]);

  // ── Selected Furniture & Dragging State ──
  const [selectedFurniture, setSelectedFurniture] = useState<{
    roomIndex: number;
    furnitureIndex: number;
  } | null>(null);

  const [draggingFurniture, setDraggingFurniture] = useState<{
    roomIndex: number;
    furnitureIndex: number;
    origX: number;
    origY: number;
    worldX: number;
    worldY: number;
    startPt: { x: number; y: number };
  } | null>(null);

  const [resizingFurniture, setResizingFurniture] = useState<{
    roomIndex: number;
    furnitureIndex: number;
    handle: FurnitureResizeHandle;
    origWidth: number;
    origHeight: number;
    origX: number;
    origY: number;
    anchorRoomX: number;
    anchorRoomY: number;
    startPt: { x: number; y: number };
    furn: FurnitureItem;
  } | null>(null);

  // Sync selected furniture outwards
  useEffect(() => {
    if (!onSelectFurniture) return;
    if (selectedFurniture && displayRooms[selectedFurniture.roomIndex]?.furniture?.[selectedFurniture.furnitureIndex]) {
      onSelectFurniture(displayRooms[selectedFurniture.roomIndex].furniture![selectedFurniture.furnitureIndex]);
    } else {
      onSelectFurniture(null);
    }
  }, [selectedFurniture, displayRooms, onSelectFurniture]);

  // Global map to deduplicate door swing drawing across adjacent rooms purely (Strict Mode safe)
  const doorAttributes = React.useMemo(() => {
    const claims = new Map<string, string>();
    const stairs = new Set<string>();
    
    displayRooms.forEach(room => {
      // Only suppress door arcs ON the staircase room itself — not on neighbours like Balcony/Landing
      const isStairRoom = room.name.toLowerCase().includes('stair');
      room.doors?.forEach(door => {
        const pos = door.position || 0;
        let hx = 0, hy = 0;
        if (door.wall === 'top') { hx = room.x + pos; hy = room.y; }
        else if (door.wall === 'bottom') { hx = room.x + pos; hy = room.y + room.height; }
        else if (door.wall === 'left') { hx = room.x; hy = room.y + pos; }
        else if (door.wall === 'right') { hx = room.x + room.width; hy = room.y + pos; }
        
        const hingeX = (door.wall === 'left' || door.wall === 'right') ? (door.wall === 'left' ? room.x : room.x + room.width) : hx;
        const hingeY = (door.wall === 'top' || door.wall === 'bottom') ? (door.wall === 'top' ? room.y : room.y + room.height) : hy;
        
        const key = `${Math.round(hingeX * 10)},${Math.round(hingeY * 10)}`;
        
        // Only mark as stair door if the door belongs to the Staircase room itself
        if (isStairRoom) stairs.add(key);
        
        if (!claims.has(key)) claims.set(key, room.name);
      });
    });
    return { claims, stairs };
  }, [displayRooms]);

  const getSvgCoordinates = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  };

  const handlePointerDown = (e: React.PointerEvent, _room: Room, index: number, edge?: 'top' | 'right' | 'bottom' | 'left' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight') => {
    setDraggingRoomIndex(index);
    setDraggingEdge(edge || null);
    hasActuallyDraggedRef.current = false;
    setDragRooms(rooms); // snapshot current rooms as drag base
    dragOriginalRooms.current = JSON.parse(JSON.stringify(rooms));
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStartPos.current = getSvgCoordinates(e.clientX, e.clientY);
  };

  // ── Furniture Handlers ──
  const handleFurniturePointerDown = (e: React.PointerEvent, roomIndex: number, furnitureIndex: number, furn: FurnitureItem) => {
    const r = displayRooms[roomIndex];
    const initialWorldX = r ? r.x + furn.x : furn.x;
    const initialWorldY = r ? r.y + furn.y : furn.y;
    setDraggingFurniture({
      roomIndex,
      furnitureIndex,
      origX: furn.x,
      origY: furn.y,
      worldX: initialWorldX,
      worldY: initialWorldY,
      startPt: getSvgCoordinates(e.clientX, e.clientY),
    });
    setDragRooms(rooms);
    dragOriginalRooms.current = JSON.parse(JSON.stringify(rooms));
    setSelectedFurniture({ roomIndex, furnitureIndex });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleFurnitureResizeDown = (
    e: React.PointerEvent,
    roomIndex: number,
    furnitureIndex: number,
    furn: FurnitureItem,
    handle: FurnitureResizeHandle
  ) => {
    const rotRad = ((furn.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);
    const u = { x: cos, y: sin };
    const v = { x: -sin, y: cos };

    const c0x = furn.x + furn.width / 2;
    const c0y = furn.y + furn.height / 2;
    const halfW = furn.width / 2;
    const halfH = furn.height / 2;

    let anchorX = c0x;
    let anchorY = c0y;

    switch (handle) {
      case 'nw':
        anchorX = c0x + halfW * u.x + halfH * v.x;
        anchorY = c0y + halfW * u.y + halfH * v.y;
        break;
      case 'ne':
        anchorX = c0x - halfW * u.x + halfH * v.x;
        anchorY = c0y - halfW * u.y + halfH * v.y;
        break;
      case 'se':
        anchorX = c0x - halfW * u.x - halfH * v.x;
        anchorY = c0y - halfW * u.y - halfH * v.y;
        break;
      case 'sw':
        anchorX = c0x + halfW * u.x - halfH * v.x;
        anchorY = c0y + halfW * u.y - halfH * v.y;
        break;
      case 'n':
        anchorX = c0x + halfH * v.x;
        anchorY = c0y + halfH * v.y;
        break;
      case 's':
        anchorX = c0x - halfH * v.x;
        anchorY = c0y - halfH * v.y;
        break;
      case 'e':
        anchorX = c0x - halfW * u.x;
        anchorY = c0y - halfW * u.y;
        break;
      case 'w':
        anchorX = c0x + halfW * u.x;
        anchorY = c0y + halfW * u.y;
        break;
    }

    setResizingFurniture({
      roomIndex,
      furnitureIndex,
      handle,
      origWidth: furn.width,
      origHeight: furn.height,
      origX: furn.x,
      origY: furn.y,
      anchorRoomX: anchorX,
      anchorRoomY: anchorY,
      startPt: getSvgCoordinates(e.clientX, e.clientY),
      furn,
    });
    setDragRooms(rooms);
    dragOriginalRooms.current = JSON.parse(JSON.stringify(rooms));
    setSelectedFurniture({ roomIndex, furnitureIndex });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleRotateFurniture = (roomIndex: number, furnitureIndex: number, deltaDeg: number) => {
    const newRooms = JSON.parse(JSON.stringify(rooms)) as Room[];
    const room = newRooms[roomIndex];
    if (room?.furniture?.[furnitureIndex]) {
      const furn = room.furniture[furnitureIndex];
      const curRot = furn.rotation || 0;
      const newRot = (curRot + deltaDeg + 360) % 360;
      furn.rotation = newRot;
      if (onGeometryCommand) {
        const itemXM = ftToM(room.x + furn.x);
        const itemYM = ftToM(room.y + furn.y);
        const cmd = createTransformItemCommand(floorIndex, furn.id || '', itemXM, itemYM, newRot);
        onGeometryCommand(cmd);
      } else if (onRoomDrop) {
        onRoomDrop(newRooms);
      }
    }
  };

  const handleDuplicateFurniture = (roomIndex: number, furnitureIndex: number) => {
    const newRooms = JSON.parse(JSON.stringify(rooms)) as Room[];
    const room = newRooms[roomIndex];
    if (room?.furniture?.[furnitureIndex]) {
      const orig = room.furniture[furnitureIndex];
      const cloneId = `furn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newX = Math.max(0, Math.min(room.width - orig.width, orig.x + 1.0));
      const newY = Math.max(0, Math.min(room.height - orig.height, orig.y + 1.0));

      if (onGeometryCommand) {
        const itemXM = ftToM(room.x + newX);
        const itemYM = ftToM(room.y + newY);
        const placedItem: PlacedItem = {
          id: cloneId,
          assetId: orig.catalogId || orig.name.toLowerCase().replace(/\s+/g, '_'),
          name: orig.name,
          x: itemXM,
          y: itemYM,
          elevation: ftToM(orig.elevation || 0),
          rotation: orig.rotation || 0,
          width: ftToM(orig.width),
          depth: ftToM(orig.height),
          height: ftToM(2.5),
          color: orig.color,
          isLight: orig.isLight,
          properties: {
            roomId: room.name,
            lightProperties: orig.lightProperties,
          },
        };
        const cmd = createPlaceItemCommand(floorIndex, placedItem);
        onGeometryCommand(cmd);
      } else {
        const clone: FurnitureItem = {
          ...orig,
          id: cloneId,
          x: newX,
          y: newY,
        };
        room.furniture.push(clone);
        if (onRoomDrop) {
          onRoomDrop(newRooms);
        }
      }
      setSelectedFurniture({ roomIndex, furnitureIndex: (room.furniture?.length || 1) - 1 });
      toast.success(`Duplicated ${orig.name}`);
    }
  };

  const handleDeleteFurniture = (roomIndex: number, furnitureIndex: number) => {
    const newRooms = JSON.parse(JSON.stringify(rooms)) as Room[];
    const room = newRooms[roomIndex];
    if (room?.furniture?.[furnitureIndex]) {
      const removed = room.furniture[furnitureIndex];
      if (onGeometryCommand) {
        const cmd = createDeleteItemCommand(floorIndex, removed.id || '');
        onGeometryCommand(cmd);
      } else {
        room.furniture.splice(furnitureIndex, 1);
        if (onRoomDrop) {
          onRoomDrop(newRooms);
        }
      }
      setSelectedFurniture(null);
      toast.success(`Removed ${removed.name}`);
    }
  };

  // Keyboard shortcut listener for selected furniture (Delete / Backspace / R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedFurniture) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteFurniture(selectedFurniture.roomIndex, selectedFurniture.furnitureIndex);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRotateFurniture(selectedFurniture.roomIndex, selectedFurniture.furnitureIndex, 45);
      } else if (e.key === 'Escape') {
        setSelectedFurniture(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFurniture, rooms]);

  // Drop handler for items dragged from the Furniture Catalog Drawer
  const handleDropFromCatalog = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const catItem = JSON.parse(rawData);
      if (!catItem || !catItem.name) return;

      const pt = getSvgCoordinates(e.clientX, e.clientY);
      let targetRoomIdx = displayRooms.findIndex(r =>
        pt.x >= r.x && pt.x <= r.x + r.width &&
        pt.y >= r.y && pt.y <= r.y + r.height
      );

      if (targetRoomIdx === -1 && selectedRoom) {
        targetRoomIdx = displayRooms.findIndex(r => r.name === selectedRoom.name);
      }
      if (targetRoomIdx === -1) {
        let minD = Infinity;
        for (let ri = 0; ri < displayRooms.length; ri++) {
          const r = displayRooms[ri];
          const rcx = r.x + r.width / 2;
          const rcy = r.y + r.height / 2;
          const d = Math.hypot(pt.x - rcx, pt.y - rcy);
          if (d < minD) {
            minD = d;
            targetRoomIdx = ri;
          }
        }
        if (targetRoomIdx === -1) targetRoomIdx = 0;
      }

      const room = displayRooms[targetRoomIdx];
      if (!room) return;

      const fw = catItem.dimensions?.widthFt ?? catItem.dimensions?.width ?? 3;
      const fh = catItem.dimensions?.depthFt ?? catItem.dimensions?.depth ?? 3;

      const rawRelX = pt.x - room.x - fw / 2;
      const rawRelY = pt.y - room.y - fh / 2;
      const relX = Math.max(0, Math.min(Math.max(0, room.width - fw), Math.round(rawRelX * 2) / 2));
      const relY = Math.max(0, Math.min(Math.max(0, room.height - fh), Math.round(rawRelY * 2) / 2));

      const itemId = `furn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const itemXM = ftToM(room.x + relX);
      const itemYM = ftToM(room.y + relY);

      if (onGeometryCommand) {
        const placedItem: PlacedItem = {
          id: itemId,
          assetId: catItem.id,
          name: catItem.name,
          x: itemXM,
          y: itemYM,
          elevation: ftToM(catItem.defaultElevationFt ?? catItem.elevation ?? 0),
          rotation: catItem.defaultRotation ?? 0,
          width: ftToM(fw),
          depth: ftToM(fh),
          height: ftToM(catItem.dimensions?.heightFt ?? catItem.dimensions?.height ?? 2.5),
          color: catItem.defaultColor,
          isLight: catItem.category === 'Lighting Fixtures' || Boolean(catItem.isLight),
          properties: {
            category: catItem.category,
            roomId: room.name,
            lightProperties: catItem.lightProperties,
          },
        };
        const cmd = createPlaceItemCommand(floorIndex, placedItem);
        onGeometryCommand(cmd);
      } else {
        const newFurn: FurnitureItem = {
          id: itemId,
          catalogId: catItem.id,
          name: catItem.name,
          x: relX,
          y: relY,
          width: fw,
          height: fh,
          rotation: 0,
          elevation: catItem.defaultElevationFt ?? catItem.elevation ?? 0,
          color: catItem.defaultColor,
          isLight: catItem.category === 'Lighting Fixtures' || Boolean(catItem.isLight),
          lightProperties: catItem.lightProperties,
        };

        const newRooms = JSON.parse(JSON.stringify(displayRooms)) as Room[];
        if (!newRooms[targetRoomIdx].furniture) {
          newRooms[targetRoomIdx].furniture = [];
        }
        newRooms[targetRoomIdx].furniture!.push(newFurn);

        if (onRoomDrop) {
          onRoomDrop(newRooms);
        }
      }
      setSelectedFurniture({ roomIndex: targetRoomIdx, furnitureIndex: (room.furniture?.length || 1) - 1 });
      toast.success(`Placed ${catItem.name} in ${room.name}`);
    } catch (err) {
      console.error('Error handling catalog drop:', err);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // 0. Check Furniture Resizing
    if (resizingFurniture !== null) {
      const room = (dragOriginalRooms.current || rooms)[resizingFurniture.roomIndex];
      if (!room) return;

      const currentPos = getSvgCoordinates(e.clientX, e.clientY);
      // Pointer position in room space:
      const pRoomX = currentPos.x - room.x;
      const pRoomY = currentPos.y - room.y;

      const rotRad = ((resizingFurniture.furn.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);
      const u = { x: cos, y: sin };
      const v = { x: -sin, y: cos };

      const dx = pRoomX - resizingFurniture.anchorRoomX;
      const dy = pRoomY - resizingFurniture.anchorRoomY;
      const du = dx * u.x + dy * u.y;
      const dv = dx * v.x + dy * v.y;

      const MIN_DIM = 0.5;
      let newW = resizingFurniture.origWidth;
      let newH = resizingFurniture.origHeight;
      const handle = resizingFurniture.handle;

      if (handle === 'se') {
        newW = Math.max(MIN_DIM, Math.round(du * 2) / 2);
        newH = Math.max(MIN_DIM, Math.round(dv * 2) / 2);
      } else if (handle === 'nw') {
        newW = Math.max(MIN_DIM, Math.round(-du * 2) / 2);
        newH = Math.max(MIN_DIM, Math.round(-dv * 2) / 2);
      } else if (handle === 'ne') {
        newW = Math.max(MIN_DIM, Math.round(du * 2) / 2);
        newH = Math.max(MIN_DIM, Math.round(-dv * 2) / 2);
      } else if (handle === 'sw') {
        newW = Math.max(MIN_DIM, Math.round(-du * 2) / 2);
        newH = Math.max(MIN_DIM, Math.round(dv * 2) / 2);
      } else if (handle === 'e') {
        newW = Math.max(MIN_DIM, Math.round(du * 2) / 2);
      } else if (handle === 'w') {
        newW = Math.max(MIN_DIM, Math.round(-du * 2) / 2);
      } else if (handle === 's') {
        newH = Math.max(MIN_DIM, Math.round(dv * 2) / 2);
      } else if (handle === 'n') {
        newH = Math.max(MIN_DIM, Math.round(-dv * 2) / 2);
      }

      // Recompute new center from anchor point
      let newCx = resizingFurniture.anchorRoomX;
      let newCy = resizingFurniture.anchorRoomY;
      const halfW = newW / 2;
      const halfH = newH / 2;

      switch (handle) {
        case 'se':
          newCx += halfW * u.x + halfH * v.x;
          newCy += halfW * u.y + halfH * v.y;
          break;
        case 'nw':
          newCx -= halfW * u.x + halfH * v.x;
          newCy -= halfW * u.y + halfH * v.y;
          break;
        case 'ne':
          newCx += halfW * u.x - halfH * v.x;
          newCy += halfW * u.y - halfH * v.y;
          break;
        case 'sw':
          newCx -= halfW * u.x - halfH * v.x;
          newCy -= halfW * u.y - halfH * v.y;
          break;
        case 'e':
          newCx += halfW * u.x;
          newCy += halfW * u.y;
          break;
        case 'w':
          newCx -= halfW * u.x;
          newCy -= halfW * u.y;
          break;
        case 's':
          newCx += halfH * v.x;
          newCy += halfH * v.y;
          break;
        case 'n':
          newCx -= halfH * v.x;
          newCy -= halfH * v.y;
          break;
      }

      const newX = Math.round((newCx - halfW) * 100) / 100;
      const newY = Math.round((newCy - halfH) * 100) / 100;

      const newRooms = JSON.parse(JSON.stringify(dragOriginalRooms.current || rooms)) as Room[];
      const curRoom = newRooms[resizingFurniture.roomIndex];
      if (curRoom && curRoom.furniture && curRoom.furniture[resizingFurniture.furnitureIndex]) {
        const item = curRoom.furniture[resizingFurniture.furnitureIndex];
        item.width = newW;
        item.height = newH;
        item.x = newX;
        item.y = newY;
        setDragRooms(newRooms);

        if (onSelectFurniture) {
          onSelectFurniture({ ...item });
        }
      }
      return;
    }

    // 1. Check Furniture Dragging
    if (draggingFurniture !== null) {
      const currentPos = getSvgCoordinates(e.clientX, e.clientY);
      const totalDx = currentPos.x - draggingFurniture.startPt.x;
      const totalDy = currentPos.y - draggingFurniture.startPt.y;

      const dx = Math.round(totalDx * 2) / 2;
      const dy = Math.round(totalDy * 2) / 2;

      const currentWorldX = Math.round((draggingFurniture.worldX + dx) * 2) / 2;
      const currentWorldY = Math.round((draggingFurniture.worldY + dy) * 2) / 2;

      const newRooms = JSON.parse(JSON.stringify(dragOriginalRooms.current || rooms)) as Room[];
      const sourceRoom = newRooms[draggingFurniture.roomIndex];
      if (sourceRoom && sourceRoom.furniture && sourceRoom.furniture[draggingFurniture.furnitureIndex]) {
        const furn = sourceRoom.furniture[draggingFurniture.furnitureIndex];
        const fcx = currentWorldX + furn.width / 2;
        const fcy = currentWorldY + furn.height / 2;

        let targetRoomIdx = newRooms.findIndex(r =>
          fcx >= r.x && fcx <= r.x + r.width &&
          fcy >= r.y && fcy <= r.y + r.height
        );
        if (targetRoomIdx === -1) {
          let minD = Infinity;
          for (let ri = 0; ri < newRooms.length; ri++) {
            const r = newRooms[ri];
            const rcx = r.x + r.width / 2;
            const rcy = r.y + r.height / 2;
            const d = Math.hypot(fcx - rcx, fcy - rcy);
            if (d < minD) { minD = d; targetRoomIdx = ri; }
          }
        }

        const activeRoom = newRooms[targetRoomIdx];
        if (activeRoom) {
          furn.x = Math.round((currentWorldX - activeRoom.x) * 2) / 2;
          furn.y = Math.round((currentWorldY - activeRoom.y) * 2) / 2;
          if (targetRoomIdx !== draggingFurniture.roomIndex) {
            sourceRoom.furniture.splice(draggingFurniture.furnitureIndex, 1);
            if (!activeRoom.furniture) activeRoom.furniture = [];
            activeRoom.furniture.push(furn);
            const newFurnitureIdx = activeRoom.furniture.length - 1;
            setDraggingFurniture({
              ...draggingFurniture,
              roomIndex: targetRoomIdx,
              furnitureIndex: newFurnitureIdx,
            });
            setSelectedFurniture({ roomIndex: targetRoomIdx, furnitureIndex: newFurnitureIdx });
          }
        } else {
          furn.x = Math.round((currentWorldX - sourceRoom.x) * 2) / 2;
          furn.y = Math.round((currentWorldY - sourceRoom.y) * 2) / 2;
        }
        setDragRooms(newRooms);
      }
      return;
    }

    // 0. Check Canvas Panning (Exact screen-to-viewBox 1:1 cursor tracking)
    if (isPanning) {
      const rect = svgRef.current ? svgRef.current.getBoundingClientRect() : null;
      const scaleX = rect && rect.width > 0 ? vbW / rect.width : (baseW / (effectiveZoom * 800));
      const scaleY = rect && rect.height > 0 ? vbH / rect.height : (baseH / (effectiveZoom * 600));
      const dx = (e.clientX - panStartRef.current.clientX) * scaleX;
      const dy = (e.clientY - panStartRef.current.clientY) * scaleY;
      const newPan = { x: panStartRef.current.x + dx, y: panStartRef.current.y + dy };
      if (onPanChange) onPanChange(newPan);
      else setLocalPan(newPan);
      return;
    }

    // 2. Check Room Wall / Vertex / Body Dragging
    if (draggingRoomIndex === null || !dragOriginalRooms.current) return;
    const currentPos = getSvgCoordinates(e.clientX, e.clientY);
    
    // Calculate total movement since the drag started
    const totalDx = currentPos.x - dragStartPos.current.x;
    const totalDy = currentPos.y - dragStartPos.current.y;

    if (Math.hypot(totalDx, totalDy) > 0.25) {
      hasActuallyDraggedRef.current = true;
    }

    if (!draggingEdge) {
      const dx = Math.round(totalDx * 2) / 2;
      const dy = Math.round(totalDy * 2) / 2;
      if (dx === 0 && dy === 0) return;

      const newRooms = JSON.parse(JSON.stringify(dragOriginalRooms.current)) as Room[];
      const origTarget = dragOriginalRooms.current[draggingRoomIndex];
      const targetRoom = newRooms[draggingRoomIndex];
      const newX = origTarget.x + dx;
      const newY = origTarget.y + dy;
      const maxPlotW = plotWidth || 100;
      const maxPlotH = plotHeight || 100;

      const hasSharedWalls = dragOriginalRooms.current.some((other, idx) => {
        if (idx === draggingRoomIndex) return false;
        const sharesV = intervalsOverlap(origTarget.y, origTarget.y + origTarget.height, other.y, other.y + other.height, 0.5);
        const sharesH = intervalsOverlap(origTarget.x, origTarget.x + origTarget.width, other.x, other.x + other.width, 0.5);
        const sharesLeft = sharesV && Math.abs(origTarget.x - (other.x + other.width)) <= SHARED_WALL_TOLERANCE_FT;
        const sharesRight = sharesV && Math.abs((origTarget.x + origTarget.width) - other.x) <= SHARED_WALL_TOLERANCE_FT;
        const sharesTop = sharesH && Math.abs(origTarget.y - (other.y + other.height)) <= SHARED_WALL_TOLERANCE_FT;
        const sharesBottom = sharesH && Math.abs((origTarget.y + origTarget.height) - other.y) <= SHARED_WALL_TOLERANCE_FT;
        return sharesLeft || sharesRight || sharesTop || sharesBottom;
      });

      if (!hasSharedWalls) {
        targetRoom.x = Math.max(0, Math.min(maxPlotW - targetRoom.width, newX));
        targetRoom.y = Math.max(0, Math.min(maxPlotH - targetRoom.height, newY));
        setDragRooms(newRooms);
      } else {
        const propRes = propagateRoomBoundsWithSharedWalls(
          dragOriginalRooms.current,
          origTarget.name,
          { x: newX, y: newY, width: origTarget.width, height: origTarget.height },
          maxPlotW,
          maxPlotH
        );
        if (propRes.success) {
          setDragRooms(propRes.rooms);
        }
      }
      return;
    } else {
      // Wall / Handle dragging logic:
      const dx = Math.round(totalDx * 2) / 2;
      const dy = Math.round(totalDy * 2) / 2;

      const newRooms = JSON.parse(JSON.stringify(dragOriginalRooms.current)) as Room[];
      const targetRoom = newRooms[draggingRoomIndex];
      const origTarget = dragOriginalRooms.current[draggingRoomIndex];
      const maxPlotW = plotWidth || 100;
      const maxPlotH = plotHeight || 100;
      const isIndependent = roomResizeMode === 'independent' || isShiftPressed || e.shiftKey || e.altKey;

      if (isIndependent) {
        // Direct Independent Room Resizing: expand or decrease only this room
        if (draggingEdge?.includes('right')) {
          targetRoom.width = Math.max(2.5, Math.min(maxPlotW - targetRoom.x, origTarget.width + dx));
        } else if (draggingEdge?.includes('left')) {
          const maxShift = origTarget.width - 2.5;
          const minShift = -origTarget.x;
          const shift = Math.max(minShift, Math.min(maxShift, dx));
          targetRoom.x = origTarget.x + shift;
          targetRoom.width = origTarget.width - shift;
        }

        if (draggingEdge?.includes('bottom')) {
          targetRoom.height = Math.max(2.5, Math.min(maxPlotH - targetRoom.y, origTarget.height + dy));
        } else if (draggingEdge?.includes('top')) {
          const maxShift = origTarget.height - 2.5;
          const minShift = -origTarget.y;
          const shift = Math.max(minShift, Math.min(maxShift, dy));
          targetRoom.y = origTarget.y + shift;
          targetRoom.height = origTarget.height - shift;
        }

        clampOpeningsAndFurnitureToRoom(targetRoom);
        setDragRooms(newRooms);
        return;
      }

      // Synced Partition Mode:
      let sharedX: number | null = null;
      let sharedY: number | null = null;
      let newSharedX: number | null = null;
      let newSharedY: number | null = null;

      if (draggingEdge?.includes('right')) {
        targetRoom.width = Math.max(2.5, Math.min(maxPlotW - targetRoom.x, origTarget.width + dx));
        sharedX = origTarget.x + origTarget.width;
        newSharedX = targetRoom.x + targetRoom.width;
      } else if (draggingEdge?.includes('left')) {
        const maxShift = origTarget.width - 2.5;
        const minShift = -origTarget.x;
        const shift = Math.max(minShift, Math.min(maxShift, dx));
        targetRoom.x = origTarget.x + shift;
        targetRoom.width = origTarget.width - shift;
        sharedX = origTarget.x;
        newSharedX = targetRoom.x;
      }
      
      if (draggingEdge?.includes('bottom')) {
        targetRoom.height = Math.max(2.5, Math.min(maxPlotH - targetRoom.y, origTarget.height + dy));
        sharedY = origTarget.y + origTarget.height;
        newSharedY = targetRoom.y + targetRoom.height;
      } else if (draggingEdge?.includes('top')) {
        const maxShift = origTarget.height - 2.5;
        const minShift = -origTarget.y;
        const shift = Math.max(minShift, Math.min(maxShift, dy));
        targetRoom.y = origTarget.y + shift;
        targetRoom.height = origTarget.height - shift;
        sharedY = origTarget.y;
        newSharedY = targetRoom.y;
      }

      // Snapping & Alignment Guides Calculation
      const ALIGN_TOL = 0.6;
      const newGuides: Array<{ type: 'x' | 'y'; val: number }> = [];

      if (newSharedX !== null) {
        for (let j = 0; j < newRooms.length; j++) {
          if (j === draggingRoomIndex) continue;
          const other = newRooms[j];
          if (Math.abs(newSharedX - other.x) <= ALIGN_TOL) {
            newSharedX = other.x;
            newGuides.push({ type: 'x', val: other.x });
          } else if (Math.abs(newSharedX - (other.x + other.width)) <= ALIGN_TOL) {
            newSharedX = other.x + other.width;
            newGuides.push({ type: 'x', val: other.x + other.width });
          }
        }
      }

      if (newSharedY !== null) {
        for (let j = 0; j < newRooms.length; j++) {
          if (j === draggingRoomIndex) continue;
          const other = newRooms[j];
          if (Math.abs(newSharedY - other.y) <= ALIGN_TOL) {
            newSharedY = other.y;
            newGuides.push({ type: 'y', val: other.y });
          } else if (Math.abs(newSharedY - (other.y + other.height)) <= ALIGN_TOL) {
            newSharedY = other.y + other.height;
            newGuides.push({ type: 'y', val: other.y + other.height });
          }
        }
      }

      setAlignmentGuides(newGuides);

      // Move ALL rooms that shared the original wall axis with strict minimum preservation
      for (let i = 0; i < newRooms.length; i++) {
        if (i === draggingRoomIndex) continue;
        const r = newRooms[i];
        const origR = dragOriginalRooms.current[i];
        let modified = false;
        const EPSILON = 0.5;

        if (sharedX !== null && newSharedX !== null) {
          const overlapsY = intervalsOverlap(
            origTarget.y,
            origTarget.y + origTarget.height,
            origR.y,
            origR.y + origR.height,
            0.1
          );
          if (overlapsY) {
            if (Math.abs(origR.x - sharedX) <= EPSILON) {
              const neighborRight = origR.x + origR.width;
              const maxPossibleSharedX = neighborRight - 2.5;
              if (newSharedX > maxPossibleSharedX) {
                newSharedX = maxPossibleSharedX;
                if (draggingEdge?.includes('right')) {
                  targetRoom.width = newSharedX - targetRoom.x;
                }
              }
              r.x = newSharedX;
              r.width = Math.max(2.5, neighborRight - newSharedX);
              modified = true;
            }
            if (Math.abs(origR.x + origR.width - sharedX) <= EPSILON) {
              const neighborLeft = origR.x;
              const minPossibleSharedX = neighborLeft + 2.5;
              if (newSharedX < minPossibleSharedX) {
                newSharedX = minPossibleSharedX;
                if (draggingEdge?.includes('left')) {
                  targetRoom.x = newSharedX;
                  targetRoom.width = (origTarget.x + origTarget.width) - newSharedX;
                }
              }
              r.width = Math.max(2.5, newSharedX - neighborLeft);
              modified = true;
            }
          }
        }

        if (sharedY !== null && newSharedY !== null) {
          const overlapsX = intervalsOverlap(
            origTarget.x,
            origTarget.x + origTarget.width,
            origR.x,
            origR.x + origR.width,
            0.1
          );
          if (overlapsX) {
            if (Math.abs(origR.y - sharedY) <= EPSILON) {
              const neighborBottom = origR.y + origR.height;
              const maxPossibleSharedY = neighborBottom - 2.5;
              if (newSharedY > maxPossibleSharedY) {
                newSharedY = maxPossibleSharedY;
                if (draggingEdge?.includes('bottom')) {
                  targetRoom.height = newSharedY - targetRoom.y;
                }
              }
              r.y = newSharedY;
              r.height = Math.max(2.5, neighborBottom - newSharedY);
              modified = true;
            }
            if (Math.abs(origR.y + origR.height - sharedY) <= EPSILON) {
              const neighborTop = origR.y;
              const minPossibleSharedY = neighborTop + 2.5;
              if (newSharedY < minPossibleSharedY) {
                newSharedY = minPossibleSharedY;
                if (draggingEdge?.includes('top')) {
                  targetRoom.y = newSharedY;
                  targetRoom.height = (origTarget.y + origTarget.height) - newSharedY;
                }
              }
              r.height = Math.max(2.5, newSharedY - neighborTop);
              modified = true;
            }
          }
        }

        if (modified) {
          clampOpeningsAndFurnitureToRoom(r);
        }
      }
      clampOpeningsAndFurnitureToRoom(targetRoom);

      setDragRooms(newRooms);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setAlignmentGuides([]);

    if (isPanning) {
      setIsPanning(false);
      (e.target as Element).releasePointerCapture(e.pointerId);
      return;
    }

    if (resizingFurniture !== null) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      const { roomIndex, furnitureIndex, furn } = resizingFurniture;
      setResizingFurniture(null);
      if (dragRooms) {
        const room = dragRooms[roomIndex];
        const updatedFurn = room?.furniture?.[furnitureIndex];
        if (updatedFurn && onGeometryCommand) {
          const itemXM = ftToM(room.x + updatedFurn.x);
          const itemYM = ftToM(room.y + updatedFurn.y);
          const cmd = createUpdateItemDimensionsCommand(
            floorIndex,
            furn.id || '',
            ftToM(updatedFurn.width),
            ftToM(updatedFurn.height),
            ftToM(furn.elevation ?? 2.5),
            itemXM,
            itemYM,
            room.name
          );
          onGeometryCommand(cmd);
        } else if (onRoomDrop) {
          onRoomDrop(dragRooms);
        }
      }
      setDragRooms(null);
      dragOriginalRooms.current = null;
      return;
    }

    if (draggingFurniture !== null) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      const { roomIndex, furnitureIndex } = draggingFurniture;
      setDraggingFurniture(null);
      if (dragRooms) {
        const room = dragRooms[roomIndex];
        const furn = room?.furniture?.[furnitureIndex];
        const origX = draggingFurniture.origX;
        const origY = draggingFurniture.origY;
        const hasMoved = furn && (Math.abs(furn.x - origX) > 0.05 || Math.abs(furn.y - origY) > 0.05 || roomIndex !== draggingFurniture.roomIndex);
        if (furn && hasMoved && onGeometryCommand) {
          const itemXM = ftToM(room.x + furn.x);
          const itemYM = ftToM(room.y + furn.y);
          const cmd = createTransformItemCommand(floorIndex, furn.id || '', itemXM, itemYM, furn.rotation || 0, room.name);
          onGeometryCommand(cmd);
        } else if (furn && hasMoved && onRoomDrop) {
          onRoomDrop(dragRooms);
        }
      }
      setDragRooms(null);
      dragOriginalRooms.current = null;
      return;
    }

    if (draggingRoomIndex !== null) {
      const edge = draggingEdge;
      setDraggingRoomIndex(null);
      setDraggingEdge(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
      
      const hasChanged = Boolean(
        hasActuallyDraggedRef.current &&
        dragRooms &&
        dragOriginalRooms.current &&
        JSON.stringify(dragRooms) !== JSON.stringify(dragOriginalRooms.current)
      );

      if (hasChanged && dragRooms) {
        // Enforce geometry validation through canonical CommandEngine
        if (onGeometryCommand) {
          const roomName = dragOriginalRooms.current?.[draggingRoomIndex]?.name || 'Room';
          const cmd = createUpdateFloorRoomsCommand(
            floorIndex,
            dragRooms,
            edge ? `Resize ${roomName} Boundary` : `Move ${roomName} Position`
          );
          const ok = onGeometryCommand(cmd);
          if (!ok) {
            setDragRooms(null); // Revert candidate overlay to keep document pristine
            return;
          }
        } else if (plotWidth && plotHeight) {
          const violations = validateRoomPlacement(dragRooms, plotWidth, plotHeight);
          if (violations.length > 0) {
            toast.error(violations[0].reason);
            setDragRooms(null); // revert to original rooms
            return;
          }
          if (onRoomDrop) {
            onRoomDrop(dragRooms);
          }
        } else if (onRoomDrop) {
          onRoomDrop(dragRooms);
        }
      }
      setDragRooms(null);
      dragOriginalRooms.current = null;
    }
  };

  if (!displayRooms || displayRooms.length === 0) {
    return (
      <div className="blueprint-empty">
        <p>No layout data to display.</p>
      </div>
    );
  }

  const scaleLen = 10;
  const sbX = minX + PAD * 0.6;
  const sbY = maxY - PAD * 0.2;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg
        ref={svgRef}
      viewBox={viewBox}
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'block',
        background: 'var(--paper-sheet, #FAF8F2)',
        cursor: isPanning ? 'grabbing' : 'default',
        userSelect: 'none',
      }}
      onWheel={(e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        const nextZoom = Math.max(0.4, Math.min(3.5, +(effectiveZoom * factor).toFixed(2)));
        if (onZoomChange) onZoomChange(nextZoom);
        else setLocalZoom(nextZoom);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerDown={(e) => {
        if (e.button === 1 || e.target === svgRef.current) {
          setIsPanning(true);
          panStartRef.current = { x: effectivePan.x, y: effectivePan.y, clientX: e.clientX, clientY: e.clientY };
          (e.target as Element).setPointerCapture(e.pointerId);
          setSelectedFurniture(null);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDropFromCatalog}
    >
      <defs>
        {/* Architectural drafting paper millimeter grid */}
        <pattern id="finegrid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(37, 38, 34, 0.05)" strokeWidth="0.03" />
        </pattern>
        <pattern id="coarsegrid" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="url(#finegrid)" />
          <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(37, 38, 34, 0.10)" strokeWidth="0.06" />
        </pattern>
        {/* Wall hatch pattern — masonry cut line */}
        <pattern id="hatch" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M-0.5,0.5 l1,-1 M0,1 l1,-1 M0.5,1.5 l1,-1" stroke="rgba(37, 38, 34, 0.12)" strokeWidth="0.08" />
        </pattern>

        {/* FloorPlanDrawer Style Architectural Flooring Texture Patterns */}
        {/* Living Room: Warm Oak Parquet Planks */}
        <pattern id="pattern-wood-planks" width="3" height="1.5" patternUnits="userSpaceOnUse">
          <rect width="3" height="1.5" fill="none" />
          <line x1="0" y1="0.75" x2="3" y2="0.75" stroke="#927252" strokeWidth="0.04" strokeOpacity="0.45" />
          <line x1="1.5" y1="0" x2="1.5" y2="0.75" stroke="#927252" strokeWidth="0.04" strokeOpacity="0.45" />
          <line x1="0" y1="0.75" x2="0" y2="1.5" stroke="#927252" strokeWidth="0.04" strokeOpacity="0.45" />
          <line x1="3" y1="0.75" x2="3" y2="1.5" stroke="#927252" strokeWidth="0.04" strokeOpacity="0.45" />
        </pattern>
        {/* Kitchen / Dining: 2ft Architectural Ceramic Tile Grid */}
        <pattern id="pattern-tile-kitchen" width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="none" stroke="#64748b" strokeWidth="0.04" strokeOpacity="0.4" />
        </pattern>
        {/* Bathroom: 1ft Mosaic Ceramic Grid */}
        <pattern id="pattern-tile-bath" width="1" height="1" patternUnits="userSpaceOnUse">
          <rect width="1" height="1" fill="none" stroke="#0ea5e9" strokeWidth="0.03" strokeOpacity="0.35" />
        </pattern>
        {/* Bedroom: Soft Textile Weave */}
        <pattern id="pattern-bedroom-weave" width="1.2" height="1.2" patternUnits="userSpaceOnUse">
          <path d="M 0 0 L 1.2 1.2 M 1.2 0 L 0 1.2" stroke="#64748b" strokeWidth="0.02" strokeOpacity="0.25" />
        </pattern>
        {/* Balcony / Terrace: Teak Deck Slats */}
        <pattern id="pattern-deck-balcony" width="4" height="0.8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0.4" x2="4" y2="0.4" stroke="#78350f" strokeWidth="0.05" strokeOpacity="0.45" />
        </pattern>
        
        {/* Subtle architectural tactile drop shadow */}
        <filter id="dropshadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0.15" dy="0.2" stdDeviation="0.3" floodColor="#252622" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Grid background */}
      <rect x={minX - 50} y={minY - 50} width={vbW + 100} height={vbH + 100} fill="url(#coarsegrid)" opacity={0.9} />

      {/* Dynamic CAD Alignment Guide Lines */}
      {alignmentGuides.map((g, idx) => (
        <g key={`guide-${idx}`} style={{ pointerEvents: 'none' }}>
          {g.type === 'x' ? (
            <>
              <line
                x1={g.val} y1={minY - 50}
                x2={g.val} y2={maxY + 50}
                stroke="#365FA8" strokeWidth={0.14} strokeDasharray="0.8 0.4" opacity={0.85}
              />
              <circle cx={g.val} cy={minY - 1} r={0.3} fill="#365FA8" />
              <circle cx={g.val} cy={maxY + 1} r={0.3} fill="#365FA8" />
            </>
          ) : (
            <>
              <line
                x1={minX - 50} y1={g.val}
                x2={maxX + 50} y2={g.val}
                stroke="#365FA8" strokeWidth={0.14} strokeDasharray="0.8 0.4" opacity={0.85}
              />
              <circle cx={minX - 1} cy={g.val} r={0.3} fill="#365FA8" />
              <circle cx={maxX + 1} cy={g.val} r={0.3} fill="#365FA8" />
            </>
          )}
        </g>
      ))}

      {/* Telemetry Title Block — Refined Architectural Atelier Sheet */}
      <g>
        <text x={minX + PAD * 0.5} y={minY + PAD * 0.35}
          fontSize={1.1} fontFamily="'Newsreader', Georgia, serif" fontWeight="600"
          fill="#252622" letterSpacing="0.02">
          DRAWING // LEVEL 0{(floorIndex ?? 0) + 1}
        </text>
        <text x={minX + PAD * 0.5} y={minY + PAD * 0.62}
          fontSize={0.62} fontFamily="'JetBrains Mono', monospace"
          fill="#777970" letterSpacing="0.04">
          ARCHITECTURAL BLUEPRINT • {displayRooms.length} REGISTERED ZONES • {Math.round(maxX - minX - PAD * 2)}×{Math.round(maxY - minY - PAD * 2)} FT
        </text>
      </g>

      {/* Outer building boundary */}
      {(() => {
        const enclosedRooms = displayRooms.filter(r => 
          !r.name.toLowerCase().includes('balcony') && 
          !r.name.toLowerCase().includes('terrace') && 
          !r.name.toLowerCase().includes('parking') &&
          !r.name.toLowerCase().includes('open area')
        );
        const boundsRooms = enclosedRooms.length > 0 ? enclosedRooms : displayRooms;
        if (boundsRooms.length === 0) return null;
        return (
          <rect
            x={Math.min(...boundsRooms.map(r => r.x)) - WALL} 
            y={Math.min(...boundsRooms.map(r => r.y)) - WALL}
            width={Math.max(...boundsRooms.map(r => r.x + r.width)) - Math.min(...boundsRooms.map(r => r.x)) + WALL * 2}
            height={Math.max(...boundsRooms.map(r => r.y + r.height)) - Math.min(...boundsRooms.map(r => r.y)) + WALL * 2}
            fill="url(#hatch)"
            stroke="#252622"
            strokeOpacity="0.85"
            strokeWidth={WALL * 1.5}
            rx={0.1}
          />
        );
      })()}

      {/* Rooms */}
      {displayRooms.map((room, i) => {
        const style = getRoomStyle(room.name);
        const { fill } = style;

        const isSelected = selectedRoom?.name === room.name;
        const cx = room.x + room.width / 2;
        const cy = room.y + room.height / 2;
        const labelSize = Math.max(0.68, Math.min(room.width * 0.12, room.height * 0.16, 1.1));
        const subSize = labelSize * 0.65;
        const sqft = Math.round(room.width * room.height);

        const lowerName = room.name.toLowerCase();
        const roomTypeLower = ((room as any).roomType || '').toLowerCase();
        const isBalcony = lowerName.includes('balcony') || lowerName.includes('terrace');
        const isStairs = lowerName.includes('stair') || lowerName.includes('staircase');
        const isShaft =
          Boolean((room as any).isShaft) ||
          lowerName.includes('shaft') ||
          lowerName.includes('duct') ||
          lowerName.includes('mep') ||
          lowerName.includes('lightwell') ||
          lowerName.includes('ventilation') ||
          lowerName.includes('chase') ||
          roomTypeLower.includes('shaft') ||
          roomTypeLower.includes('lightwell') ||
          roomTypeLower.includes('duct') ||
          roomTypeLower.includes('chase');

        const isExteriorShaft = Boolean(
          (room as any).isExteriorShaft ||
          (isShaft && (lowerName.includes('ext') || lowerName.includes('lightwell') || lowerName.includes('courtyard') || roomTypeLower.includes('ext') || roomTypeLower.includes('lightwell')))
        );
        const isInteriorShaft = isShaft && !isExteriorShaft;
        const isVoid = lowerName.includes('void') || lowerName.includes('double height') || lowerName.includes('duplex') || isShaft;

        if (isBalcony) {
          return (
            <g key={`${room.name}-${i}`}
              className={`room-group ${isSelected ? 'selected' : ''}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (onRoomSelect) onRoomSelect(room, i);
                handlePointerDown(e, room, i);
              }}
              style={{ cursor: draggingRoomIndex === i ? 'grabbing' : 'grab', touchAction: 'none' }}>
              
              {/* Light open-air sage wash */}
              <rect x={room.x} y={room.y} width={room.width} height={room.height}
                    fill="rgba(161, 174, 151, 0.14)" stroke="none" />
              {/* Inner wall — solid ink */}
              <line x1={room.x} y1={room.y} x2={room.x + room.width} y2={room.y}
                    stroke="#252622" strokeWidth={WALL * 0.8} />
              {/* Outer boundary — thin dashed line indicating parapet / railing */}
              <rect x={room.x} y={room.y} width={room.width} height={room.height}
                    stroke="#474943" strokeWidth={WALL * 0.35} strokeDasharray="1 0.8" fill="none" />
              
              {/* Railing pattern — restrained diagonal hatch lines */}
              <line x1={room.x} y1={room.y} x2={room.x + room.width} y2={room.y + room.height}
                    stroke="rgba(37, 38, 34, 0.08)" strokeWidth={0.08} />
              <line x1={room.x + room.width} y1={room.y} x2={room.x} y2={room.y + room.height}
                    stroke="rgba(37, 38, 34, 0.08)" strokeWidth={0.08} />

              <text x={cx} y={cy - subSize * 0.5} textAnchor="middle" dominantBaseline="middle"
                    fill="#252622" fontSize={labelSize} fontWeight="600"
                    fontFamily="'Plus Jakarta Sans', system-ui, sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {room.name}
              </text>
              <text x={cx} y={cy + labelSize * 0.5} textAnchor="middle" dominantBaseline="middle"
                    fill="#777970" fontSize={subSize} fontFamily="'JetBrains Mono', monospace"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {Math.round(room.width)}×{Math.round(room.height)} ft · {sqft} sqft
              </text>
            </g>
          );
        }

        return (
          <g key={`${room.name}-${i}`}
            className={`room-group ${isSelected ? 'selected' : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelectedFurniture(null);
              if (onRoomSelect) onRoomSelect(room, i);
              handlePointerDown(e, room, i);
            }}
            style={{ cursor: draggingRoomIndex === i ? 'grabbing' : 'grab', touchAction: 'none' }}>

            {/* Room fill */}
            <rect
              x={room.x} y={room.y}
              width={room.width} height={room.height}
              fill={isExteriorShaft ? 'rgba(14, 165, 233, 0.08)' : isInteriorShaft ? 'rgba(71, 85, 105, 0.16)' : fill}
              stroke={isSelected ? '#D85740' : isExteriorShaft ? '#0284c7' : isInteriorShaft ? '#334155' : '#252622'}
              strokeWidth={isSelected ? WALL * 1.1 : isInteriorShaft ? WALL * 0.9 : WALL * 0.75}
              strokeDasharray={isExteriorShaft && !isSelected ? '3 1.5' : undefined}
              rx={0.08}
            />

            {/* Architectural floor texture overlay (FloorPlanDrawer style) */}
            {!isShaft && getFlooringPatternId(room.name) && (
              <rect
                x={room.x} y={room.y}
                width={room.width} height={room.height}
                fill={getFlooringPatternId(room.name)!}
                opacity={0.35}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Inner wall subtle architectural double-line */}
            {!isShaft && (
              <rect
                x={room.x + WALL * 0.3} y={room.y + WALL * 0.3}
                width={Math.max(0, room.width - WALL * 0.6)} height={Math.max(0, room.height - WALL * 0.6)}
                fill="none"
                stroke={isSelected ? '#D85740' : 'rgba(37, 38, 34, 0.12)'}
                strokeWidth={0.05}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* External Lightwell Shaft Graphics (CAD Crossed Diagonals + Skylight Ring) */}
            {isExteriorShaft && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={room.x + 0.3} y1={room.y + 0.3} x2={room.x + room.width - 0.3} y2={room.y + room.height - 0.3}
                  stroke="#0284c7" strokeWidth={0.14} strokeDasharray="1.2 0.8" />
                <line x1={room.x + room.width - 0.3} y1={room.y + 0.3} x2={room.x + 0.3} y2={room.y + room.height - 0.3}
                  stroke="#0284c7" strokeWidth={0.14} strokeDasharray="1.2 0.8" />
                <rect x={room.x + 0.5} y={room.y + 0.5} width={Math.max(0, room.width - 1.0)} height={Math.max(0, room.height - 1.0)}
                  fill="none" stroke="#38bdf8" strokeWidth={0.08} strokeDasharray="0.6 0.4" />
              </g>
            )}

            {/* Internal MEP Chase Graphics (CAD Mechanical Cross-Hatching) */}
            {isInteriorShaft && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={room.x + 0.25} y1={room.y + 0.25} x2={room.x + room.width - 0.25} y2={room.y + room.height - 0.25}
                  stroke="#475569" strokeWidth={0.15} />
                <line x1={room.x + room.width - 0.25} y1={room.y + 0.25} x2={room.x + 0.25} y2={room.y + room.height - 0.25}
                  stroke="#475569" strokeWidth={0.15} />
                {Array.from({ length: Math.min(4, Math.floor(room.width / 1.5)) }).map((_, hIdx) => {
                  const off = (hIdx + 1) * (room.width / (Math.min(4, Math.floor(room.width / 1.5)) + 1));
                  return (
                    <line
                      key={`hatch_${hIdx}`}
                      x1={room.x + off - 0.4}
                      y1={room.y + 0.4}
                      x2={room.x + off + 0.4}
                      y2={room.y + room.height - 0.4}
                      stroke="rgba(100, 116, 139, 0.45)"
                      strokeWidth={0.08}
                      strokeDasharray="0.4 0.3"
                    />
                  );
                })}
              </g>
            )}

            {/* Architectural Staircase Graphics */}
            {isStairs && (
              <g style={{ pointerEvents: 'none' }}>
                {Array.from({ length: Math.min(10, Math.floor(room.height / 1.2)) }).map((_, stepIdx) => {
                  const stepY = room.y + (stepIdx + 1) * (room.height / (Math.min(10, Math.floor(room.height / 1.2)) + 1));
                  return (
                    <line key={stepIdx}
                      x1={room.x + 0.3} y1={stepY}
                      x2={room.x + room.width - 0.3} y2={stepY}
                      stroke="#B89A64" strokeWidth={0.1} strokeDasharray="0.6 0.3"
                    />
                  );
                })}
                {/* UP Arrow Indicator */}
                <line x1={cx} y1={room.y + room.height * 0.8} x2={cx} y2={room.y + room.height * 0.25}
                  stroke="#B89A64" strokeWidth={0.16} />
                <polygon points={`${cx},${room.y + room.height * 0.2} ${cx - 0.35},${room.y + room.height * 0.32} ${cx + 0.35},${room.y + room.height * 0.32}`}
                  fill="#B89A64" />
                <circle cx={cx} cy={room.y + room.height * 0.8} r={0.22} fill="#B89A64" />
              </g>
            )}

            {/* Duplex Double-Height Void Graphics */}
            {isVoid && !isShaft && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={room.x + 0.2} y1={room.y + 0.2} x2={room.x + room.width - 0.2} y2={room.y + room.height - 0.2}
                  stroke="#365FA8" strokeWidth={0.12} strokeDasharray="1 0.6" />
                <line x1={room.x + room.width - 0.2} y1={room.y + 0.2} x2={room.x + 0.2} y2={room.y + room.height - 0.2}
                  stroke="#365FA8" strokeWidth={0.12} strokeDasharray="1 0.6" />
              </g>
            )}

            {/* Selection highlight & 8 Interactive CAD Resize Handles */}
            {isSelected && (
              <g>
                <rect
                  x={room.x - 0.25} y={room.y - 0.25}
                  width={room.width + 0.5} height={room.height + 0.5}
                  fill="rgba(216, 87, 64, 0.04)"
                  stroke="#D85740"
                  strokeWidth={0.16}
                  strokeDasharray="0.8 0.4"
                  style={{ pointerEvents: 'none' }}
                />

                {/* 1. Top Edge Handle (North) */}
                <g style={{ cursor: 'ns-resize' }} onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, room, i, 'top'); }}>
                  {/* Generous hit target */}
                  <rect x={room.x + 1.0} y={room.y - 0.9} width={Math.max(1.0, room.width - 2.0)} height={1.8} fill="transparent" />
                  {/* Visible grip pill */}
                  <rect x={cx - 1.0} y={room.y - 0.28} width={2.0} height={0.56} rx={0.2} fill="#FAF8F2" stroke="#D85740" strokeWidth={0.14} />
                  <line x1={cx - 0.45} y1={room.y} x2={cx + 0.45} y2={room.y} stroke="#D85740" strokeWidth={0.12} />
                </g>

                {/* 2. Bottom Edge Handle (South) */}
                <g style={{ cursor: 'ns-resize' }} onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, room, i, 'bottom'); }}>
                  <rect x={room.x + 1.0} y={room.y + room.height - 0.9} width={Math.max(1.0, room.width - 2.0)} height={1.8} fill="transparent" />
                  <rect x={cx - 1.0} y={room.y + room.height - 0.28} width={2.0} height={0.56} rx={0.2} fill="#FAF8F2" stroke="#D85740" strokeWidth={0.14} />
                  <line x1={cx - 0.45} y1={room.y + room.height} x2={cx + 0.45} y2={room.y + room.height} stroke="#D85740" strokeWidth={0.12} />
                </g>

                {/* 3. Left Edge Handle (West) */}
                <g style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, room, i, 'left'); }}>
                  <rect x={room.x - 0.9} y={room.y + 1.0} width={1.8} height={Math.max(1.0, room.height - 2.0)} fill="transparent" />
                  <rect x={room.x - 0.28} y={cy - 1.0} width={0.56} height={2.0} rx={0.2} fill="#FAF8F2" stroke="#D85740" strokeWidth={0.14} />
                  <line x1={room.x} y1={cy - 0.45} x2={room.x} y2={cy + 0.45} stroke="#D85740" strokeWidth={0.12} />
                </g>

                {/* 4. Right Edge Handle (East) */}
                <g style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, room, i, 'right'); }}>
                  <rect x={room.x + room.width - 0.9} y={room.y + 1.0} width={1.8} height={Math.max(1.0, room.height - 2.0)} fill="transparent" />
                  <rect x={room.x + room.width - 0.28} y={cy - 1.0} width={0.56} height={2.0} rx={0.2} fill="#FAF8F2" stroke="#D85740" strokeWidth={0.14} />
                  <line x1={room.x + room.width} y1={cy - 0.45} x2={room.x + room.width} y2={cy + 0.45} stroke="#D85740" strokeWidth={0.12} />
                </g>

                {/* 5. Top-Left Corner Handle (NW) */}
                <g style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, room, i, 'topLeft'); }}>
                  <circle cx={room.x} cy={room.y} r={1.0} fill="transparent" />
                  <circle cx={room.x} cy={room.y} r={0.5} fill="#FAF8F2" stroke="#D85740" strokeWidth={0.15} />
                  <circle cx={room.x} cy={room.y} r={0.22} fill="#D85740" />
                </g>

                {/* 6. Top-Right Corner Handle (NE) */}
                <g style={{ cursor: 'nesw-resize' }} onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, room, i, 'topRight'); }}>
                  <circle cx={room.x + room.width} cy={room.y} r={1.0} fill="transparent" />
                  <circle cx={room.x + room.width} cy={room.y} r={0.5} fill="#FAF8F2" stroke="#D85740" strokeWidth={0.15} />
                  <circle cx={room.x + room.width} cy={room.y} r={0.22} fill="#D85740" />
                </g>

                {/* 7. Bottom-Left Corner Handle (SW) */}
                <g style={{ cursor: 'nesw-resize' }} onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, room, i, 'bottomLeft'); }}>
                  <circle cx={room.x} cy={room.y + room.height} r={1.0} fill="transparent" />
                  <circle cx={room.x} cy={room.y + room.height} r={0.5} fill="#FAF8F2" stroke="#D85740" strokeWidth={0.15} />
                  <circle cx={room.x} cy={room.y + room.height} r={0.22} fill="#D85740" />
                </g>

                {/* 8. Bottom-Right Corner Handle (SE) */}
                <g style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, room, i, 'bottomRight'); }}>
                  <circle cx={room.x + room.width} cy={room.y + room.height} r={1.0} fill="transparent" />
                  <circle cx={room.x + room.width} cy={room.y + room.height} r={0.5} fill="#FAF8F2" stroke="#D85740" strokeWidth={0.15} />
                  <circle cx={room.x + room.width} cy={room.y + room.height} r={0.22} fill="#D85740" />
                </g>

                {/* Live Real-time Dimension HUD Callout during active drag/resize */}
                {draggingRoomIndex === i && (
                  <g transform={`translate(${cx}, ${room.y - 2.5})`} style={{ pointerEvents: 'none' }}>
                    <rect
                      x={-6.0}
                      y={-1.2}
                      width={12.0}
                      height={2.4}
                      rx={0.4}
                      fill="#0f172a"
                      stroke={roomResizeMode === 'independent' || isShiftPressed ? '#f59e0b' : '#38bdf8'}
                      strokeWidth={0.16}
                    />
                    <text
                      x={0}
                      y={-0.15}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#ffffff"
                      fontSize={0.82}
                      fontWeight="700"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {Math.round(room.width * 10) / 10} × {Math.round(room.height * 10) / 10} ft · {sqft} sqft
                    </text>
                    <text
                      x={0}
                      y={0.65}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={roomResizeMode === 'independent' || isShiftPressed ? '#fcd34d' : '#7dd3fc'}
                      fontSize={0.52}
                      fontWeight="600"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {roomResizeMode === 'independent' || isShiftPressed
                        ? '⤢ INDEPENDENT ROOM RESIZE'
                        : '🔗 SYNCED PARTITION (HOLD SHIFT: INDEPENDENT)'}
                    </text>
                  </g>
                )}
              </g>
            )}

            <FurnitureLayer
              room={room}
              roomIndex={i}
              selectedFurniture={selectedFurniture}
              isResizing={resizingFurniture?.roomIndex === i}
              onFurniturePointerDown={handleFurniturePointerDown}
              onResizeFurnitureDown={handleFurnitureResizeDown}
              onRotateFurniture={handleRotateFurniture}
              onDuplicateFurniture={handleDuplicateFurniture}
              onDeleteFurniture={handleDeleteFurniture}
            />

            <text
              x={cx} y={cy - subSize * 0.5}
              textAnchor="middle" dominantBaseline="middle"
              fill={isExteriorShaft ? '#0284c7' : isInteriorShaft ? '#334155' : '#252622'}
              fontSize={labelSize}
              fontFamily="'Plus Jakarta Sans', system-ui, sans-serif" fontWeight="700"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {isExteriorShaft
                ? (room.name.toUpperCase().includes('LIGHTWELL') || room.name.toUpperCase().includes('SHAFT') ? room.name : `${room.name} (Lightwell)`)
                : isInteriorShaft
                ? (room.name.toUpperCase().includes('MEP') || room.name.toUpperCase().includes('CHASE') || room.name.toUpperCase().includes('SHAFT') ? room.name : `${room.name} (MEP)`)
                : room.name}
            </text>
            <text
              x={cx} y={cy + labelSize * 0.5}
              textAnchor="middle" dominantBaseline="middle"
              fill={isExteriorShaft ? '#0369a1' : isInteriorShaft ? '#64748b' : '#777970'}
              fontSize={subSize}
              fontFamily="'JetBrains Mono', monospace"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {isExteriorShaft
                ? `OPEN TO SKY · ${Math.round(room.width)}×${Math.round(room.height)} ft`
                : isInteriorShaft
                ? `MEP SERVICES · ${Math.round(room.width)}×${Math.round(room.height)} ft`
                : `${Math.round(room.width)}×${Math.round(room.height)} ft · ${sqft} sqft`}
            </text>

            {/* Architectural Cobalt dimension strings */}
            {room.width > 5 && (
              <g>
                <line x1={room.x} y1={room.y - 1.1}
                  x2={room.x + room.width} y2={room.y - 1.1}
                  stroke="#365FA8" strokeOpacity="0.75" strokeWidth={0.08} />
                {/* 45-degree CAD architectural ticks */}
                <line x1={room.x - 0.3} y1={room.y - 1.4}
                  x2={room.x + 0.3} y2={room.y - 0.8}
                  stroke="#365FA8" strokeWidth={0.1} />
                <line x1={room.x + room.width - 0.3} y1={room.y - 1.4}
                  x2={room.x + room.width + 0.3} y2={room.y - 0.8}
                  stroke="#365FA8" strokeWidth={0.1} />
                <text x={room.x + room.width / 2} y={room.y - 1.4}
                  textAnchor="middle" fill="#365FA8" fontSize={subSize * 0.85}
                  fontFamily="'JetBrains Mono', monospace" fontWeight="600"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {room.width} ft
                </text>
              </g>
            )}

            {room.height > 5 && (
              <g>
                <line x1={room.x - 1.1} y1={room.y}
                  x2={room.x - 1.1} y2={room.y + room.height}
                  stroke="#365FA8" strokeOpacity="0.75" strokeWidth={0.08} />
                {/* 45-degree CAD architectural ticks */}
                <line x1={room.x - 1.4} y1={room.y - 0.3}
                  x2={room.x - 0.8} y2={room.y + 0.3}
                  stroke="#365FA8" strokeWidth={0.1} />
                <line x1={room.x - 1.4} y1={room.y + room.height - 0.3}
                  x2={room.x - 0.8} y2={room.y + room.height + 0.3}
                  stroke="#365FA8" strokeWidth={0.1} />
                <text x={room.x - 1.4} y={room.y + room.height / 2}
                  textAnchor="middle" fill="#365FA8" fontSize={subSize * 0.85}
                  fontFamily="'JetBrains Mono', monospace" fontWeight="600"
                  transform={`rotate(-90 ${room.x - 1.4} ${room.y + room.height / 2})`}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {room.height} ft
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Pass 2: Draw doors and windows ON TOP */}
      {displayRooms.map((room, i) => (
        <g key={`overlay-${room.name}-${i}`} style={{ pointerEvents: 'none' }}>
          {/* Doors */}
          <DoorArcs room={room} doorAttributes={doorAttributes} />

          {/* Window marks */}
          <WindowMarks room={room} />
        </g>
      ))}

      {/* Architectural Atelier Scale Bar */}
      <g>
        <rect x={sbX - 0.3} y={sbY - 1.9}
          width={scaleLen + 0.6} height={2.3}
          fill="#FAF8F2" stroke="#E7E1D5" strokeWidth={0.12} rx={0.2} />
        <line x1={sbX} y1={sbY - 0.6} x2={sbX + scaleLen} y2={sbY - 0.6}
          stroke="#252622" strokeWidth={0.18} />
        {[0, scaleLen / 2, scaleLen].map(x => (
          <line key={x}
            x1={sbX + x} y1={sbY - 1.0} x2={sbX + x} y2={sbY - 0.2}
            stroke="#252622" strokeWidth={0.14} />
        ))}
        <text x={sbX + scaleLen / 2} y={sbY - 1.3}
          textAnchor="middle" fill="#252622"
          fontSize={0.72} fontFamily="'JetBrains Mono', monospace" fontWeight="600">
          SCALE: 10 FT [1:50 ARCHITECTURAL]
        </text>
      </g>

      {/* Architectural North Azimuth Compass */}
      {(() => {
        const ed = entryDir.toLowerCase();
        let angle = 0;
        if (ed.startsWith('e')) angle = -90;
        else if (ed.startsWith('s')) angle = 180;
        else if (ed.startsWith('w')) angle = 90;
        return (
          <g transform={`translate(${maxX - PAD * 0.5}, ${minY + PAD * 0.5}) rotate(${angle})`}>
            <circle r={2.0} fill="#FAF8F2" stroke="#E7E1D5" strokeWidth={0.15} />
            <circle r={1.5} fill="none" stroke="rgba(37, 38, 34, 0.15)" strokeWidth={0.06} strokeDasharray="0.3 0.3" />
            <polygon points="0,-1.5 0.45,0.6 0,0.2 -0.45,0.6"
              fill="#252622" />
            <polygon points="0,1.5 0.45,-0.6 0,-0.2 -0.45,-0.6"
              fill="#E7E1D5" />
            <text textAnchor="middle" y={-1.75} transform={`rotate(${-angle})`}
              fill="#252622" fontSize={0.85}
              fontFamily="'JetBrains Mono', monospace" fontWeight="700">N</text>
          </g>
        );
      })()}

      {/* Atelier Zone Legend */}
      {displayRooms.length > 0 && (() => {
        const uniqueTypes = [...new Set(displayRooms.map(r => r.name))].slice(0, 5);
        return (
          <g transform={`translate(${maxX - PAD * 0.8}, ${minY + PAD * 3.5})`}>
            <rect x={-0.3} y={-0.5}
              width={PAD * 0.9} height={uniqueTypes.length * 1.4 + 1.2}
              fill="#FAF8F2" stroke="#E7E1D5" strokeWidth={0.12} rx={0.2} />
            <text x={PAD * 0.4 / 2} y={0.2}
              textAnchor="middle" fill="#252622"
              fontSize={0.62} fontFamily="'JetBrains Mono', monospace" fontWeight="600" letterSpacing="0.04">
              ZONES
            </text>
            {uniqueTypes.map((name, idx) => {
              const { fill, stroke } = getRoomStyle(name);
              return (
                <g key={name} transform={`translate(0, ${idx * 1.4 + 1.0})`}>
                  <rect x={0} y={-0.45} width={0.8} height={0.7}
                    fill={fill} stroke={stroke} strokeWidth={0.08} rx={0.06} />
                  <text x={1.1} y={0.1}
                    fill="#474943" fontSize={0.58}
                    fontFamily="'Plus Jakarta Sans', sans-serif">
                    {name.length > 12 ? name.slice(0, 12) + '…' : name}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}
      {/* Circulation path overlay — toggled by the parent via showCirculation prop */}
      <CirculationOverlay
        rooms={displayRooms}
        circulation={circulation ?? null}
        visible={showCirculation ?? false}
        plotWidth={plotWidth}
        plotHeight={plotHeight}
      />
      <SunlightOverlay
        rooms={displayRooms}
        sunlightResult={sunlightResult ?? undefined}
        visible={showSunlight ?? false}
        floorIndex={floorIndex}
        entryDir={entryDir}
        plotWidth={plotWidth}
        plotHeight={plotHeight}
        timeline={solarTimeline}
      />
    </svg>

    {/* Floating HUDs for Solar and Circulation */}
    {showSunlight && (
      <SunlightStudyHud
        timeline={solarTimeline}
        onTimelineChange={setSolarTimeline}
      />
    )}
    {showCirculation && !showSunlight && (
      <CirculationEgressHud
        rooms={displayRooms}
        plotWidth={plotWidth}
        plotHeight={plotHeight}
      />
    )}
    {showCirculation && showSunlight && (
      <div style={{ position: 'absolute', top: '120px', right: '16px', zIndex: 30 }}>
        <CirculationEgressHud
          rooms={displayRooms}
          plotWidth={plotWidth}
          plotHeight={plotHeight}
        />
      </div>
    )}

    {/* Top Floating Floor Selector & Room Resize Mode Controls */}
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {/* Multi-floor 2D separate floor selector */}
      {totalFloors && totalFloors > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(250, 248, 242, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #E7E1D5',
            borderRadius: '20px',
            padding: '3px 4px',
            boxShadow: '0 4px 16px rgba(37, 38, 34, 0.08)',
            gap: '3px',
          }}
        >
          {Array.from({ length: totalFloors }).map((_, i) => {
            const isSelected = i === activeFloorIndex;
            const rawName = floorNames?.[i] || (i === 0 ? 'Ground Floor' : `Floor ${i}`);
            const shortName = rawName.replace(/ Floor/i, '').trim();
            return (
              <button
                key={i}
                type="button"
                id={`btn-canvas-floor-${i}`}
                onClick={() => onSelectFloor?.(i)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: 'none',
                  background: isSelected ? '#252622' : 'transparent',
                  color: isSelected ? '#FAF8F2' : '#777970',
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={`Inspect ${rawName} separately`}
              >
                🏢 {`L${i} ${shortName}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Room Resize Mode Pill Switch (Direct CAD Manipulation) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(250, 248, 242, 0.94)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #E7E1D5',
          borderRadius: '20px',
          padding: '3px 4px',
          boxShadow: '0 4px 16px rgba(37, 38, 34, 0.08)',
          gap: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => setRoomResizeMode('synced')}
          style={{
            padding: '4px 10px',
            borderRadius: '16px',
            border: 'none',
            background: roomResizeMode === 'synced' ? '#252622' : 'transparent',
            color: roomResizeMode === 'synced' ? '#FAF8F2' : '#777970',
            fontSize: '0.70rem',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Partition Mode: Synchronize shared boundary walls between rooms"
        >
          🔗 Sync Partition
        </button>
        <button
          type="button"
          onClick={() => setRoomResizeMode('independent')}
          style={{
            padding: '4px 10px',
            borderRadius: '16px',
            border: 'none',
            background: roomResizeMode === 'independent' ? '#252622' : 'transparent',
            color: roomResizeMode === 'independent' ? '#FAF8F2' : '#777970',
            fontSize: '0.70rem',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Independent Mode: Expand or decrease this room separately without affecting other rooms"
        >
          ⤢ Independent Room
        </button>
      </div>
    </div>

    {/* FloorPlanDrawer Inspired Floating Mini 3D Preview (Picture-in-Picture) */}
    {onSwitchTo3D && (
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          zIndex: 35,
          background: 'rgba(250, 248, 242, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #E7E1D5',
          borderRadius: '18px',
          padding: '10px 12px',
          boxShadow: '0 10px 30px rgba(37, 38, 34, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          width: '180px',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' }} />
            <span style={{ fontSize: '0.66rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#252622' }}>
              YOUR SPACE IN 3D
            </span>
          </div>
        </div>
        <div
          onClick={onSwitchTo3D}
          style={{
            height: '64px',
            borderRadius: '10px',
            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '1.25rem', marginBottom: '2px' }}>🏛️</div>
          <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
            {rooms.length} SPACES MAPPED
          </span>
        </div>
        <button
          onClick={onSwitchTo3D}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '6px 10px',
            borderRadius: '12px',
            border: 'none',
            background: '#252622',
            color: '#FAF8F2',
            fontSize: '0.72rem',
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Take a closer look</span>
          <span style={{ fontSize: '0.85rem' }}>↗</span>
        </button>
      </div>
    )}
  </div>
);
});

export default InteractiveBlueprint;
