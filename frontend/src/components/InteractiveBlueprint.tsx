import React, { useState, useRef, useMemo } from 'react';
import type { Room, FloorCirculation } from '../services/api';
import CirculationOverlay from './CirculationOverlay';

interface Props {
  rooms: Room[];
  selectedRoom: Room | null;
  onRoomSelect: (room: Room) => void;
  onRoomDrop?: (updatedRooms: Room[], imageUrl?: string) => void;
  circulation?: FloorCirculation | null;
  showCirculation?: boolean;
}

// Professional 2D architectural color scheme per room type
function getRoomStyle(name: string): { fill: string; labelColor: string; icon: string } {
  const n = name.toLowerCase();
  if (n.includes('master') || (n.includes('bedroom') && n.includes('1')))
    return { fill: '#e8f0f7', labelColor: '#1a3a5c', icon: '🛏' };
  if (n.includes('bedroom'))
    return { fill: '#edf2f8', labelColor: '#1e3a5c', icon: '🛏' };
  if (n.includes('bath') || n.includes('toilet') || n.includes('wc'))
    return { fill: '#e0f4f7', labelColor: '#0c4a6e', icon: '🚿' };
  if (n.includes('kitchen'))
    return { fill: '#fff4e6', labelColor: '#7c3400', icon: '🍳' };
  if (n.includes('living') || n.includes('lounge'))
    return { fill: '#ece9f7', labelColor: '#3b0764', icon: '🛋' };
  if (n.includes('dining'))
    return { fill: '#fce7f3', labelColor: '#831843', icon: '🍽' };
  if (n.includes('balcony') || n.includes('terrace'))
    return { fill: '#e2f7ef', labelColor: '#065f46', icon: '🌿' };
  if (n.includes('parking') || n.includes('garage'))
    return { fill: '#f1f1f1', labelColor: '#374151', icon: '🚗' };
  if (n.includes('hall') || n.includes('lobby') || n.includes('foyer') || n.includes('entrance'))
    return { fill: '#fef9e7', labelColor: '#78350f', icon: '🚪' };
  if (n.includes('store') || n.includes('utility') || n.includes('laundry'))
    return { fill: '#f5f5f5', labelColor: '#4b5563', icon: '📦' };
  return { fill: '#f3f4f6', labelColor: '#374151', icon: '◻' };
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
  if (n.includes('bed'))         return 'rgba(186,214,255,0.55)';
  if (n.includes('sofa') || n.includes('couch')) return 'rgba(200,190,255,0.55)';
  if (n.includes('table'))       return 'rgba(255,220,160,0.55)';
  if (n.includes('wardrobe') || n.includes('cabinet')) return 'rgba(210,230,210,0.55)';
  if (n.includes('toilet') || n.includes('bath') || n.includes('shower')) return 'rgba(180,240,248,0.55)';
  if (n.includes('island') || n.includes('counter')) return 'rgba(255,235,180,0.55)';
  if (n.includes('desk') || n.includes('chair')) return 'rgba(220,240,200,0.55)';
  if (n.includes('tv'))          return 'rgba(50,60,80,0.55)';
  return 'rgba(210,218,230,0.45)';
}

// ── LLM-Coordinate Furniture Renderer ────────────────────────────────────────
// Draws furniture items from the JSON coordinates returned by Llama-3.
// Each item's x/y is relative to the room's own top-left corner.
function FurnitureLayer({ room }: { room: Room }) {
  const items = room.furniture;

  // ── Fallback: symbolic shapes for rooms with no LLM furniture data ──────────
  if (!items || items.length === 0) {
    return <FurnitureSymbol room={room} cx={room.x + room.width / 2} cy={room.y + room.height / 2} />;
  }

  return (
    <g>
      {items.map((furn, idx) => {
        // Convert room-relative coords to absolute SVG coords
        const ax = room.x + furn.x;
        const ay = room.y + furn.y;
        const fw = furn.width;
        const fh = furn.height;
        const fcx = ax + fw / 2;
        const fcy = ay + fh / 2;
        const labelSize = Math.max(0.5, Math.min(fw, fh) * 0.15);
        const fill = getFurnFill(furn.name);

        return (
          <g key={idx} style={{ pointerEvents: 'none' }}>
            {/* Furniture rectangle */}
            <rect
              x={ax} y={ay}
              width={fw} height={fh}
              fill={fill}
              stroke="rgba(90,110,150,0.7)"
              strokeWidth={0.12}
              rx={0.15}
            />
            {/* Furniture name label */}
            {fw > 2 && fh > 1.5 && (
              <text
                x={fcx} y={fcy}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={labelSize}
                fontFamily="Inter, system-ui, sans-serif"
                fontWeight="500"
                fill="rgba(40,55,90,0.85)"
                style={{ userSelect: 'none' }}
              >
                {furn.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}


function DoorArcs({ room }: { room: Room }) {
  if (!room.doors || room.doors.length === 0) return null;

  return (
    <g>
      {room.doors.map((door, idx) => {
        const getDoorGeometry = () => {
          const rawDw = door.width || 3;
          const pos = door.position || 0;

          if (door.wall === 'top') {
            const dw = Math.min(rawDw, room.width - pos, room.height * 0.75);
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
            const dw = Math.min(rawDw, room.width - pos, room.height * 0.75);
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
            const dw = Math.min(rawDw, room.height - pos, room.width * 0.75);
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
            const dw = Math.min(rawDw, room.height - pos, room.width * 0.75);
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
        const path = `M ${hx} ${hy} L ${leafX} ${leafY} A ${dw} ${dw} 0 0 ${sweepFlag} ${arcEndX} ${arcEndY}`;

        return (
          <g key={`${room.name}-door-${idx}`}>
            {/* White gap in wall = door opening */}
            <line x1={gapX1} y1={gapY1} x2={gapX2} y2={gapY2}
              stroke="#fafbfc" strokeWidth={0.65} />
            {/* Door swing area (filled arc) */}
            <path d={path}
              fill="rgba(100,116,139,0.12)"
              stroke="#64748b"
              strokeWidth={0.12}
              strokeDasharray="0.4 0.2" />
            {/* Solid door leaf */}
            <line x1={hx} y1={hy} x2={leafX} y2={leafY}
              stroke="#475569" strokeWidth={0.24} />
          </g>
        );
      })}
    </g>
  );
}


// Window marks on exterior walls
function WindowMarks({ room }: { room: Room }) {
  const ww = Math.min(room.width * 0.3, 3);
  const wx = room.x + (room.width - ww) / 2;
  const wy = room.y;
  const tick = 0.35;
  return (
    <g>
      <line x1={wx} y1={wy} x2={wx + ww} y2={wy} stroke="#60a5fa" strokeWidth={0.28} />
      <line x1={wx} y1={wy - tick} x2={wx} y2={wy + tick} stroke="#60a5fa" strokeWidth={0.2} />
      <line x1={wx + ww} y1={wy - tick} x2={wx + ww} y2={wy + tick} stroke="#60a5fa" strokeWidth={0.2} />
      <line x1={wx + ww / 2} y1={wy - tick * 0.6} x2={wx + ww / 2} y2={wy + tick * 0.6}
        stroke="#60a5fa" strokeWidth={0.15} />
    </g>
  );
}

const InteractiveBlueprint: React.FC<Props> = React.memo(({ rooms, selectedRoom, onRoomSelect, onRoomDrop, circulation, showCirculation }) => {
  // Drag overlay: only maintain local state during an active drag.
  // When not dragging, the parent prop is the source of truth (no sync needed).
  const [dragRooms, setDragRooms] = useState<Room[] | null>(null);
  const displayRooms = dragRooms ?? rooms;

  const [draggingRoom, setDraggingRoom] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgCoordinates = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  };

  const handlePointerDown = (e: React.PointerEvent, room: Room) => {
    onRoomSelect(room);
    setDraggingRoom(room.name);
    setDragRooms(rooms); // snapshot current rooms as drag base
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStartPos.current = getSvgCoordinates(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRoom) return;
    const currentPos = getSvgCoordinates(e.clientX, e.clientY);
    const dx = currentPos.x - dragStartPos.current.x;
    const dy = currentPos.y - dragStartPos.current.y;

    setDragRooms(prev => (prev ?? rooms).map(r =>
      r.name === draggingRoom
        ? { ...r, x: r.x + dx, y: r.y + dy }
        : r
    ));

    dragStartPos.current = currentPos;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingRoom) {
      setDraggingRoom(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
      if (onRoomDrop && dragRooms) {
        onRoomDrop(dragRooms);
      }
      setDragRooms(null); // clear overlay — parent now owns the state
    }
  };

  if (!displayRooms || displayRooms.length === 0) {
    return (
      <div className="blueprint-empty">
        <p>No layout data to display.</p>
      </div>
    );
  }

  const PAD = 6;
  const WALL = 0.4;

  const allX = displayRooms.flatMap(r => [r.x, r.x + r.width]);
  const allY = displayRooms.flatMap(r => [r.y, r.y + r.height]);
  const minX = Math.min(...allX) - PAD;
  const minY = Math.min(...allY) - PAD;
  const maxX = Math.max(...allX) + PAD;
  const maxY = Math.max(...allY) + PAD;
  const vbW = maxX - minX;
  const vbH = maxY - minY;
  const viewBox = `${minX} ${minY} ${vbW} ${vbH}`;

  const scaleLen = 10;
  const sbX = minX + PAD * 0.6;
  const sbY = maxY - PAD * 0.6;

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', background: '#f8f9fb' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <defs>
        {/* Fine blueprint grid */}
        <pattern id="finegrid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e2e8f0" strokeWidth="0.04" />
        </pattern>
        <pattern id="coarsegrid" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="url(#finegrid)" />
          <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#cbd5e1" strokeWidth="0.1" />
        </pattern>
        {/* Wall hatch pattern */}
        <pattern id="hatch" width="1" height="1" patternUnits="userSpaceOnUse">
          <line x1="0" y1="1" x2="1" y2="0" stroke="#94a3b8" strokeWidth="0.25" />
        </pattern>
        <filter id="selglow">
          <feGaussianBlur stdDeviation="0.4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Paper background */}
      <rect x={minX} y={minY} width={vbW} height={vbH} fill="#fafbfc" />
      {/* Grid */}
      <rect x={minX} y={minY} width={vbW} height={vbH} fill="url(#coarsegrid)" />

      {/* Title block */}
      <text x={minX + PAD * 0.5} y={minY + PAD * 0.6}
        fontSize={1.2} fontFamily="Inter, sans-serif" fontWeight="700"
        fill="#1e293b" letterSpacing="0.05">
        FLOOR PLAN
      </text>
      <text x={minX + PAD * 0.5} y={minY + PAD * 0.9}
        fontSize={0.75} fontFamily="Inter, sans-serif"
        fill="#64748b">
        Interactive Blueprint · {displayRooms.length} Rooms
      </text>

      {/* Outer building boundary */}
      {(() => {
        const bMinX = Math.min(...displayRooms.map(r => r.x));
        const bMinY = Math.min(...displayRooms.map(r => r.y));
        const bMaxX = Math.max(...displayRooms.map(r => r.x + r.width));
        const bMaxY = Math.max(...displayRooms.map(r => r.y + r.height));
        return (
          <rect
            x={bMinX - WALL} y={bMinY - WALL}
            width={bMaxX - bMinX + WALL * 2}
            height={bMaxY - bMinY + WALL * 2}
            fill="url(#hatch)"
            stroke="#1e293b"
            strokeWidth={WALL * 1.5}
          />
        );
      })()}

      {/* Rooms */}
      {displayRooms.map((room, i) => {
        const { fill, labelColor } = getRoomStyle(room.name);
        const isSelected = selectedRoom?.name === room.name;
        const cx = room.x + room.width / 2;
        const cy = room.y + room.height / 2;
        const labelSize = Math.max(0.75, Math.min(room.width, room.height) * 0.12, 1);
        const subSize = labelSize * 0.68;
        const sqft = Math.round(room.width * room.height);

        return (
          <g key={`${room.name}-${i}`}
            onPointerDown={(e) => handlePointerDown(e, room)}
            style={{ cursor: draggingRoom === room.name ? 'grabbing' : 'grab' }}>

            {/* Room fill */}
            <rect
              x={room.x} y={room.y}
              width={room.width} height={room.height}
              fill={fill}
              stroke={isSelected ? '#2563eb' : '#64748b'}
              strokeWidth={isSelected ? WALL * 0.9 : WALL * 0.55}
            />

            {/* Thick wall overlay (inset rectangle for wall effect) */}
            <rect
              x={room.x + WALL * 0.2} y={room.y + WALL * 0.2}
              width={room.width - WALL * 0.4} height={room.height - WALL * 0.4}
              fill="none"
              stroke={isSelected ? '#93c5fd' : 'rgba(100,116,139,0.15)'}
              strokeWidth={0.1}
            />

            {/* Selection highlight */}
            {isSelected && (
              <rect
                x={room.x - 0.3} y={room.y - 0.3}
                width={room.width + 0.6} height={room.height + 0.6}
                fill="rgba(37,99,235,0.08)"
                stroke="#2563eb"
                strokeWidth={0.2}
                strokeDasharray="1 0.5"
              />
            )}

            {/* Furniture — rendered from LLM coordinates (falls back to symbols) */}
            {useMemo(() => <FurnitureLayer room={room} />, [room.x, room.y, room.width, room.height, room.furniture, room.name])}

            {/* Doors */}
            {useMemo(() => <DoorArcs room={room} />, [room.x, room.y, room.width, room.height, room.doors])}

            {/* Window marks */}
            {useMemo(() => <WindowMarks room={room} />, [room.x, room.y, room.width, room.height, room.windows])}

            {/* Room name */}
            <text
              x={cx} y={cy - subSize * 0.5}
              textAnchor="middle" dominantBaseline="middle"
              fill={labelColor} fontSize={labelSize}
              fontFamily="Inter, system-ui, sans-serif" fontWeight="700"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {room.name}
            </text>

            {/* Dimensions sub-label */}
            <text
              x={cx} y={cy + labelSize * 0.65}
              textAnchor="middle" dominantBaseline="middle"
              fill={labelColor + '99'} fontSize={subSize}
              fontFamily="Inter, system-ui, sans-serif"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {room.width}×{room.height} ft · {sqft} sqft
            </text>

            {/* Dimension lines — width */}
            {room.width > 5 && (
              <g>
                <line x1={room.x} y1={room.y - 1.2}
                  x2={room.x + room.width} y2={room.y - 1.2}
                  stroke="#94a3b8" strokeWidth={0.1} />
                <line x1={room.x} y1={room.y - 1.6}
                  x2={room.x} y2={room.y - 0.8}
                  stroke="#94a3b8" strokeWidth={0.1} />
                <line x1={room.x + room.width} y1={room.y - 1.6}
                  x2={room.x + room.width} y2={room.y - 0.8}
                  stroke="#94a3b8" strokeWidth={0.1} />
                <text x={room.x + room.width / 2} y={room.y - 1.6}
                  textAnchor="middle" fill="#64748b" fontSize={subSize * 0.85}
                  fontFamily="Inter, sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {room.width} ft
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Scale bar */}
      <g>
        <rect x={sbX - 0.3} y={sbY - 1.8}
          width={scaleLen + 0.6} height={2.2}
          fill="rgba(255,255,255,0.85)" rx={0.3} />
        <line x1={sbX} y1={sbY - 0.6} x2={sbX + scaleLen} y2={sbY - 0.6}
          stroke="#475569" strokeWidth={0.25} />
        {[0, scaleLen / 2, scaleLen].map(x => (
          <line key={x}
            x1={sbX + x} y1={sbY - 1} x2={sbX + x} y2={sbY - 0.2}
            stroke="#475569" strokeWidth={0.2} />
        ))}
        <text x={sbX + scaleLen / 2} y={sbY - 1.3}
          textAnchor="middle" fill="#1e293b"
          fontSize={0.8} fontFamily="Inter, sans-serif" fontWeight="600">
          Scale: 10 ft
        </text>
      </g>

      {/* North arrow */}
      <g transform={`translate(${maxX - PAD}, ${minY + PAD})`}>
        <circle r={2.2} fill="rgba(255,255,255,0.92)" stroke="#cbd5e1" strokeWidth={0.2} />
        <polygon points="0,-1.5 0.6,0.8 0,0.3 -0.6,0.8"
          fill="#1e293b" />
        <polygon points="0,1.5 0.6,-0.8 0,-0.3 -0.6,-0.8"
          fill="#94a3b8" />
        <text textAnchor="middle" y={-1.85}
          fill="#1e293b" fontSize={0.9}
          fontFamily="Inter, sans-serif" fontWeight="800">N</text>
      </g>

      {/* Legend */}
      {displayRooms.length > 0 && (() => {
        const uniqueTypes = [...new Set(displayRooms.map(r => r.name))].slice(0, 5);
        return (
          <g transform={`translate(${maxX - PAD}, ${minY + PAD * 3.5})`}>
            <rect x={-0.3} y={-0.5}
              width={PAD * 0.9} height={uniqueTypes.length * 1.4 + 1}
              fill="rgba(255,255,255,0.88)" stroke="#e2e8f0" strokeWidth={0.15} rx={0.3} />
            <text x={PAD * 0.4 / 2} y={0.2}
              textAnchor="middle" fill="#1e293b"
              fontSize={0.7} fontFamily="Inter, sans-serif" fontWeight="700">
              LEGEND
            </text>
            {uniqueTypes.map((name, idx) => {
              const { fill, labelColor } = getRoomStyle(name);
              return (
                <g key={name} transform={`translate(0, ${idx * 1.4 + 1.0})`}>
                  <rect x={0} y={-0.45} width={0.8} height={0.7}
                    fill={fill} stroke="#94a3b8" strokeWidth={0.1} />
                  <text x={1.1} y={0.1}
                    fill={labelColor} fontSize={0.62}
                    fontFamily="Inter, sans-serif">
                    {name.length > 12 ? name.slice(0, 12) + '…' : name}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}
      {/* Circulation path overlay — toggled by the parent via showCirculation prop */}
      <CirculationOverlay circulation={circulation ?? null} visible={showCirculation ?? false} />
    </svg>
  );
});

export default InteractiveBlueprint;
