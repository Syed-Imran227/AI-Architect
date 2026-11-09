import React, { useState, useMemo } from 'react';
import type { Room, Floor } from '../../../shared/api-client/api';
import { Layers } from 'lucide-react';

interface StudioPlanPreviewSvgProps {
  rooms?: Room[];
  floors?: Floor[];
  plotWidth?: number;
  plotLength?: number;
  projectName?: string;
  className?: string;
  style?: React.CSSProperties;
  aspectRatio?: '3:2' | '4:3' | '4:5' | '16:9';
  showControls?: boolean;
}

export const StudioPlanPreviewSvg = React.memo(function StudioPlanPreviewSvg({
  rooms,
  floors,
  plotWidth = 30,
  plotLength = 40,
  projectName = 'Architectural Plan',
  className,
  style,
  showControls = true,
}: StudioPlanPreviewSvgProps) {
  const [activeFloorIdx, setActiveFloorIdx] = useState(0);

  // Derive active floor's rooms
  const activeRooms: Room[] = useMemo(() => {
    if (floors && floors.length > 0) {
      const fl = floors[activeFloorIdx] || floors[0];
      if (fl.rooms && fl.rooms.length > 0) {
        return fl.rooms;
      }
    }
    if (rooms && rooms.length > 0) {
      return rooms;
    }
    return [];
  }, [floors, activeFloorIdx, rooms]);

  const totalFloors = floors && floors.length > 0 ? floors.length : 1;

  // Determine plot bounds
  const pw = Number(plotWidth) || 30;
  const pl = Number(plotLength) || 40;

  // Compute bounding box containing all rooms if they exceed declared plot
  const { viewBoxWidth, viewBoxHeight } = useMemo(() => {
    let maxW = pw;
    let maxL = pl;
    for (const r of activeRooms) {
      if (r.x + r.width > maxW) maxW = Math.ceil(r.x + r.width);
      if (r.y + r.height > maxL) maxL = Math.ceil(r.y + r.height);
    }
    return { viewBoxWidth: Math.max(20, maxW), viewBoxHeight: Math.max(20, maxL) };
  }, [activeRooms, pw, pl]);

  // Empty state if no rooms
  if (activeRooms.length === 0) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          background: '#0D0F12',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--stage-text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          border: '1px dashed var(--stage-hairline)',
          position: 'relative',
          overflow: 'hidden',
          ...style,
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          style={{ position: 'absolute', opacity: 0.15 }}
          aria-hidden="true"
        >
          <line x1="0" y1="0" x2="100" y2="100" stroke="#38bdf8" strokeWidth="0.5" />
          <line x1="100" y1="0" x2="0" y2="100" stroke="#38bdf8" strokeWidth="0.5" />
          <rect x="20" y="20" width="60" height="60" fill="none" stroke="#38bdf8" strokeWidth="0.75" strokeDasharray="3 3" />
        </svg>
        <Layers size={20} style={{ opacity: 0.5, marginBottom: '6px' }} />
        <span>PARAMETRIC BLUEPRINT</span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: '#FAF8F2',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        ...style,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`-2 -2 ${viewBoxWidth + 4} ${viewBoxHeight + 4}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${projectName} Floor Plan drawing`}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          {/* Subtle architectural grid */}
          <pattern id="studioCadGrid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(37, 38, 34, 0.05)" strokeWidth="0.25" />
          </pattern>
        </defs>

        {/* Outer Plot boundary */}
        <rect
          x="0"
          y="0"
          width={pw}
          height={pl}
          fill="url(#studioCadGrid)"
          stroke="#A1A399"
          strokeWidth="0.4"
          strokeDasharray="2 1"
        />

        {/* Room Geometries */}
        {activeRooms.map((room, idx) => {
          const isBalcony = (room.name || '').toLowerCase().includes('balcony');
          const isBath = (room.name || '').toLowerCase().includes('bath') || (room.name || '').toLowerCase().includes('toilet');
          const isLiving = (room.name || '').toLowerCase().includes('living') || (room.name || '').toLowerCase().includes('hall');

          let fillColor = 'rgba(37, 38, 34, 0.02)';
          if (isLiving) fillColor = 'rgba(200, 80, 30, 0.04)';
          if (isBath) fillColor = 'rgba(47, 91, 234, 0.03)';
          if (isBalcony) fillColor = 'rgba(67, 122, 93, 0.04)';

          return (
            <g key={idx}>
              {/* Room Footprint */}
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={fillColor}
                stroke="#252622"
                strokeWidth="0.6"
              />

              {/* Doors if present */}
              {room.doors?.map((d, dIdx) => {
                let dx = room.x;
                let dy = room.y;
                if (d.wall === 'bottom') dy = room.y + room.height;
                if (d.wall === 'left') dx = room.x;
                if (d.wall === 'right') dx = room.x + room.width;

                return (
                  <circle
                    key={dIdx}
                    cx={dx + (d.position || 2)}
                    cy={dy}
                    r={0.6}
                    fill="var(--accent-oxide)"
                  />
                );
              })}

              {/* Room Text Label */}
              {room.width > 5 && room.height > 3 && (
                <text
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 + 0.4}
                  fontSize={Math.min(1.4, Math.max(0.7, room.width / 8))}
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                  fill="#252622"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {room.name.replace(/bedroom/i, 'Bed').replace(/bathroom/i, 'Bath')}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Level Tag & Multi-Floor switcher */}
      {showControls && totalFloors > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            display: 'flex',
            gap: '4px',
            background: 'rgba(250, 248, 242, 0.92)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '2px',
            zIndex: 2,
          }}
        >
          {Array.from({ length: totalFloors }).map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setActiveFloorIdx(i);
              }}
              style={{
                background: activeFloorIdx === i ? '#252622' : 'transparent',
                color: activeFloorIdx === i ? '#FFFFFF' : '#474943',
                border: 'none',
                borderRadius: '2px',
                fontSize: '0.62rem',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                cursor: 'pointer',
                fontWeight: activeFloorIdx === i ? 600 : 400,
              }}
              aria-label={`View Level ${i + 1}`}
            >
              L{i}
            </button>
          ))}
        </div>
      )}

      {/* Dimensions & Space Count Badge */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          background: 'rgba(250, 248, 242, 0.92)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '2px 8px',
          fontSize: '0.66rem',
          fontFamily: 'var(--font-mono)',
          color: '#5E5A4F',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}
      >
        <span className="tabular-nums">{pw}×{pl} FT</span> · {activeRooms.length} SPACES
      </div>
    </div>
  );
});
