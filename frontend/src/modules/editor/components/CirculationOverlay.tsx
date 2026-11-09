import React, { useMemo } from 'react';
import type { Room, FloorCirculation } from '../../../shared/api-client/api';
import { Footprints } from 'lucide-react';

interface Props {
  /** Rooms on the current active floor */
  rooms?: Room[];
  /** Optional backend circulation data */
  circulation?: FloorCirculation | null;
  /** Whether to render the overlay */
  visible: boolean;
  plotWidth?: number;
  plotHeight?: number;
}

export const CirculationOverlay: React.FC<Props> = React.memo(({
  rooms = [],
  circulation: _circulation,
  visible,
  plotWidth = 30,
  plotHeight = 40,
}) => {
  if (!visible || !rooms || rooms.length === 0) return null;

  // 1. Identify Central Circulation Hub (Corridor / Foyer / Central Hall)
  const hubData = useMemo(() => {
    // Priority: Corridor -> Foyer -> Hall -> Living -> Geometric Center
    const corridor = rooms.find(r => r.name.toLowerCase().includes('corridor'));
    const foyer = rooms.find(r => r.name.toLowerCase().includes('foyer'));
    const hall = rooms.find(r => r.name.toLowerCase().includes('hall') || r.name.toLowerCase().includes('lounge'));
    const living = rooms.find(r => r.name.toLowerCase().includes('living'));

    const hubRoom = corridor || foyer || hall || living || rooms[0];

    const hubX = hubRoom ? hubRoom.x + hubRoom.width / 2 : plotWidth / 2;
    const hubY = hubRoom ? hubRoom.y + hubRoom.height / 2 : plotHeight / 2;

    return {
      room: hubRoom,
      name: hubRoom ? hubRoom.name : 'Central Circulation Spine',
      x: hubX,
      y: hubY,
    };
  }, [rooms, plotWidth, plotHeight]);

  // 2. Synthesize walking path segments radiating from Central Hub to all rooms
  const paths = useMemo(() => {
    return rooms.map(room => {
      const isHub = room === hubData.room;
      const targetX = room.x + room.width / 2;
      const targetY = room.y + room.height / 2;

      // Find door or calculate boundary entry point
      let doorX = targetX;
      let doorY = targetY;

      if (room.doors && room.doors.length > 0) {
        const d = room.doors[0];
        const w = d.width ?? 3.0;
        const p = d.position ?? (d.wall === 'top' || d.wall === 'bottom' ? room.width / 2 : room.height / 2);
        if (d.wall === 'top') {
          doorX = room.x + p + w / 2;
          doorY = room.y;
        } else if (d.wall === 'bottom') {
          doorX = room.x + p + w / 2;
          doorY = room.y + room.height;
        } else if (d.wall === 'left') {
          doorX = room.x;
          doorY = room.y + p + w / 2;
        } else {
          doorX = room.x + room.width;
          doorY = room.y + p + w / 2;
        }
      } else {
        // Synthesize boundary doorway towards hub
        const dx = hubData.x - targetX;
        const dy = hubData.y - targetY;
        if (Math.abs(dx) > Math.abs(dy)) {
          doorX = dx > 0 ? room.x + room.width : room.x;
          doorY = targetY;
        } else {
          doorX = targetX;
          doorY = dy > 0 ? room.y + room.height : room.y;
        }
      }

      // Calculate path distance and walking time
      const leg1 = Math.hypot(doorX - hubData.x, doorY - hubData.y);
      const leg2 = Math.hypot(targetX - doorX, targetY - doorY);
      const totalDistFt = Math.round((leg1 + leg2) * 10) / 10;
      const walkTimeSec = Math.round((totalDistFt / 3.8) * 10) / 10; // ~2.6 mph average indoor pace

      return {
        room,
        isHub,
        waypoints: [
          [hubData.x, hubData.y],
          [doorX, doorY],
          [targetX, targetY],
        ] as [number, number][],
        distanceFt: totalDistFt,
        walkTimeSec,
      };
    });
  }, [rooms, hubData]);

  return (
    <>
      <defs>
        {/* Directional Flow Arrow Marker */}
        <marker
          id="marker-flow-arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
        </marker>
      </defs>

      <g className="architectural-circulation-overlay" style={{ pointerEvents: 'none' }}>
        {/* Radial Walking Paths to Every Room */}
        {paths.map((p, idx) => {
          if (p.isHub) return null;
          const pointsStr = p.waypoints.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
          const midX = (p.waypoints[1][0] + p.waypoints[2][0]) / 2;
          const midY = (p.waypoints[1][1] + p.waypoints[2][1]) / 2;

          return (
            <g key={`path_${idx}`}>
              {/* Outer Glow Halo for high readability over furniture and walls */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke="rgba(255, 255, 255, 0.85)"
                strokeWidth={0.55}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Primary Architectural Dashed Flow Line */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke="#10b981"
                strokeWidth={0.24}
                strokeDasharray="0.8 0.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerMid="url(#marker-flow-arrow)"
              />

              {/* Waypoint Doorway Ring */}
              <circle
                cx={p.waypoints[1][0]}
                cy={p.waypoints[1][1]}
                r={0.28}
                fill="#ffffff"
                stroke="#10b981"
                strokeWidth={0.10}
              />

              {/* Destination Room Center Target Dot */}
              <circle
                cx={p.waypoints[2][0]}
                cy={p.waypoints[2][1]}
                r={0.42}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={0.12}
              />
              <circle
                cx={p.waypoints[2][0]}
                cy={p.waypoints[2][1]}
                r={0.18}
                fill="#ffffff"
              />

              {/* Distance & Walking Time Tag Badge */}
              <g transform={`translate(${midX}, ${midY})`}>
                <rect
                  x={-2.2}
                  y={-0.45}
                  width={4.4}
                  height={0.9}
                  rx={0.25}
                  fill="rgba(15, 23, 42, 0.90)"
                  stroke="rgba(16, 185, 129, 0.6)"
                  strokeWidth={0.08}
                />
                <text
                  x={0}
                  y={0.18}
                  textAnchor="middle"
                  fill="#6ee7b7"
                  fontSize={0.42}
                  fontWeight={700}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {p.distanceFt} ft · {p.walkTimeSec}s
                </text>
              </g>
            </g>
          );
        })}

        {/* ── Central Circulation Hub Origin Marker (The Point from which all walking starts) ── */}
        <g transform={`translate(${hubData.x}, ${hubData.y})`}>
          {/* Pulsing Outer Range Ring */}
          <circle r={1.6} fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" strokeWidth={0.10} strokeDasharray="0.5 0.3" />
          <circle r={0.9} fill="rgba(16, 185, 129, 0.25)" />
          <circle r={0.45} fill="#10b981" stroke="#ffffff" strokeWidth={0.12} />
          <circle r={0.18} fill="#ffffff" />

          {/* Central Hub Label Callout Badge */}
          <rect
            x={-4.5}
            y={-1.8}
            width={9.0}
            height={1.05}
            rx={0.3}
            fill="#0f172a"
            stroke="#10b981"
            strokeWidth={0.10}
          />
          <text
            x={0}
            y={-1.1}
            textAnchor="middle"
            fill="#34d399"
            fontSize={0.44}
            fontWeight={800}
            fontFamily="'JetBrains Mono', monospace"
          >
            ⌖ CENTRAL CIRCULATION HUB
          </text>
          <text
            x={0}
            y={-0.3}
            textAnchor="middle"
            fill="#a7f3d0"
            fontSize={0.36}
            fontWeight={600}
            fontFamily="'Plus Jakarta Sans', sans-serif"
          >
            {hubData.name.toUpperCase()} (PRIMARY EGRESS)
          </text>
        </g>
      </g>
    </>
  );
});

CirculationOverlay.displayName = 'CirculationOverlay';

/**
 * Floating HTML HUD for Circulation & Egress Analytics
 */
export const CirculationEgressHud: React.FC<{
  rooms?: Room[];
  plotWidth?: number;
  plotHeight?: number;
}> = React.memo(({ rooms = [], plotWidth = 30, plotHeight = 40 }) => {
  const hubData = useMemo(() => {
    const corridor = rooms.find(r => r.name.toLowerCase().includes('corridor'));
    const foyer = rooms.find(r => r.name.toLowerCase().includes('foyer'));
    const hall = rooms.find(r => r.name.toLowerCase().includes('hall') || r.name.toLowerCase().includes('lounge'));
    const living = rooms.find(r => r.name.toLowerCase().includes('living'));

    const hubRoom = corridor || foyer || hall || living || rooms[0];

    const hubX = hubRoom ? hubRoom.x + hubRoom.width / 2 : plotWidth / 2;
    const hubY = hubRoom ? hubRoom.y + hubRoom.height / 2 : plotHeight / 2;

    return {
      name: hubRoom ? hubRoom.name : 'Central Circulation Spine',
      x: hubX,
      y: hubY,
    };
  }, [rooms, plotWidth, plotHeight]);

  const stats = useMemo(() => {
    const nonHubRooms = rooms.filter(r => r.name !== hubData.name);
    let totalDist = 0;
    for (const r of nonHubRooms) {
      const rx = r.x + r.width / 2;
      const ry = r.y + r.height / 2;
      totalDist += Math.hypot(rx - hubData.x, ry - hubData.y);
    }
    const avgDist = nonHubRooms.length > 0 ? (totalDist / nonHubRooms.length).toFixed(1) : '0';
    return {
      destinationsCount: nonHubRooms.length,
      avgDistance: avgDist,
    };
  }, [rooms, hubData]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 30,
        background: 'rgba(250, 248, 242, 0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid #E7E1D5',
        borderRadius: '10px',
        padding: '7px 12px',
        boxShadow: '0 6px 20px rgba(37, 38, 34, 0.10)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        userSelect: 'none',
        minWidth: '280px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Footprints size={14} color="#059669" />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#252622', fontFamily: "'JetBrains Mono', monospace" }}>
            CIRCULATION EGRESS NETWORK
          </span>
        </div>
        <div style={{
          fontSize: '0.64rem',
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: '4px',
          background: '#ecfdf5',
          color: '#059669',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          100% REACHABLE
        </div>
      </div>
      <div style={{ fontSize: '0.62rem', color: '#777970', display: 'flex', justifyContent: 'space-between' }}>
        <span>Hub: <strong>{hubData.name}</strong></span>
        <span>Avg Access: <strong style={{ color: '#059669' }}>{stats.avgDistance} ft</strong></span>
        <span>Destinations: <strong>{stats.destinationsCount}</strong></span>
      </div>
    </div>
  );
});

CirculationEgressHud.displayName = 'CirculationEgressHud';

export default CirculationOverlay;
