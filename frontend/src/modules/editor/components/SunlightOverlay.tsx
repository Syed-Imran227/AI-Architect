import React from 'react';
import type { Room, SunlightResult } from '../../../shared/api-client/api';
import { Sun, Sunset, Moon, Sunrise } from 'lucide-react';

export type SolarTimeline = 'morning' | 'noon' | 'evening' | 'night';

export const SOLAR_TIMELINE_CONFIGS: Record<
  SolarTimeline,
  {
    label: string;
    timeStr: string;
    azimuthDeg: number;
    sunAngle: string;
    luxRange: string;
    avgLux: number;
    daylightFactor: string;
    rayColor: string;
    rayGradientId: string;
    interiorGlow: boolean;
    rayVector: { dx: number; dy: number; spread: number };
  }
> = {
  morning: {
    label: 'MORNING SUN',
    timeStr: '08:30 AM',
    azimuthDeg: 75, // East-Southeast
    sunAngle: 'Low-angle East Sunlight (32° Elevation)',
    luxRange: '550 – 850 Lux',
    avgLux: 680,
    daylightFactor: '4.2%',
    rayColor: 'rgba(245, 158, 11, 0.42)',
    rayGradientId: 'grad-solar-morning',
    interiorGlow: false,
    rayVector: { dx: -1.0, dy: 0.4, spread: 0.8 },
  },
  noon: {
    label: 'SOLAR NOON',
    timeStr: '12:30 PM',
    azimuthDeg: 180, // South Direct
    sunAngle: 'High-zenith Direct Daylight (68° Elevation)',
    luxRange: '950 – 1,250 Lux',
    avgLux: 1100,
    daylightFactor: '6.8%',
    rayColor: 'rgba(234, 179, 8, 0.52)',
    rayGradientId: 'grad-solar-noon',
    interiorGlow: false,
    rayVector: { dx: 0.0, dy: -1.2, spread: 1.1 },
  },
  evening: {
    label: 'GOLDEN HOUR',
    timeStr: '05:45 PM',
    azimuthDeg: 260, // West-Southwest
    sunAngle: 'Long-shadow Golden Sunset (18° Elevation)',
    luxRange: '380 – 540 Lux',
    avgLux: 460,
    daylightFactor: '2.9%',
    rayColor: 'rgba(234, 88, 12, 0.46)',
    rayGradientId: 'grad-solar-evening',
    interiorGlow: false,
    rayVector: { dx: 1.2, dy: 0.3, spread: 0.9 },
  },
  night: {
    label: 'NIGHT ILLUMINATION',
    timeStr: '10:00 PM',
    azimuthDeg: 0,
    sunAngle: 'Sun Below Horizon · Warm 2700K Architectural Task Illumination Active',
    luxRange: '250 – 350 Lux (Interior)',
    avgLux: 300,
    daylightFactor: 'N/A (Artificial)',
    rayColor: 'rgba(254, 215, 170, 0.38)',
    rayGradientId: 'grad-solar-night',
    interiorGlow: true,
    rayVector: { dx: 0, dy: 0, spread: 0 },
  },
};

interface Props {
  rooms: Room[];
  sunlightResult?: SunlightResult;
  visible: boolean;
  floorIndex?: number;
  entryDir?: string;
  plotWidth?: number;
  plotHeight?: number;
  timeline?: SolarTimeline;
}

export const SunlightOverlay: React.FC<Props> = React.memo(({
  rooms = [],
  sunlightResult: _sunlightResult,
  visible,
  floorIndex: _floorIndex = 0,
  entryDir: _entryDir = 'east',
  plotWidth: _plotWidth = 30,
  plotHeight: _plotHeight = 40,
  timeline = 'morning',
}) => {
  if (!visible || !rooms || rooms.length === 0) return null;

  const currentCfg = SOLAR_TIMELINE_CONFIGS[timeline];

  return (
    <>
      <defs>
        {/* Morning Sun Ray Gradient */}
        <linearGradient id="grad-solar-morning" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.75" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.02" />
        </linearGradient>

        {/* Noon Sun Ray Gradient */}
        <linearGradient id="grad-solar-noon" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#eab308" stopOpacity="0.80" />
          <stop offset="45%" stopColor="#fde047" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#fef08a" stopOpacity="0.02" />
        </linearGradient>

        {/* Evening Sun Ray Gradient */}
        <linearGradient id="grad-solar-evening" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ea580c" stopOpacity="0.75" />
          <stop offset="55%" stopColor="#f97316" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffedd5" stopOpacity="0.02" />
        </linearGradient>

        {/* Night Interior Radial Light Cone */}
        <radialGradient id="grad-solar-night" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.65" />
          <stop offset="60%" stopColor="#fed7aa" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#fed7aa" stopOpacity="0.0" />
        </radialGradient>
      </defs>

      <g className="architectural-solar-simulation" style={{ pointerEvents: 'none' }}>
        {timeline !== 'night' ? (
          // ── DAYLIGHT PENETRATION RAY CONES THROUGH OPENINGS ──
          rooms.map((room, rIdx) => {
            // Find windows or synthesize perimeter openings
            const windows = room.windows && room.windows.length > 0 ? room.windows : [
              // Default exterior windows on boundary walls
              { wall: 'top' as const, position: Math.max(1, room.width / 2 - 2), width: 3.5 },
              { wall: 'bottom' as const, position: Math.max(1, room.width / 2 - 2), width: 3.5 },
            ];

            return (
              <g key={`room_solar_${rIdx}`}>
                {windows.map((win, wIdx) => {
                  const wWidth = win.width ?? 3.5;
                  const wPos = win.position ?? (room.width / 2 - wWidth / 2);

                  let wx = room.x;
                  let wy = room.y;
                  let dirDx = 0;
                  let dirDy = 0;
                  let isFacingSun = false;

                  if (win.wall === 'top') {
                    wx = room.x + wPos + wWidth / 2;
                    wy = room.y;
                    dirDx = currentCfg.rayVector.dx * 0.5;
                    dirDy = 1.0;
                    isFacingSun = timeline === 'morning' || timeline === 'noon';
                  } else if (win.wall === 'bottom') {
                    wx = room.x + wPos + wWidth / 2;
                    wy = room.y + room.height;
                    dirDx = currentCfg.rayVector.dx * 0.5;
                    dirDy = -1.0;
                    isFacingSun = timeline === 'noon' || timeline === 'evening';
                  } else if (win.wall === 'left') {
                    wx = room.x;
                    wy = room.y + wPos + wWidth / 2;
                    dirDx = 1.0;
                    dirDy = currentCfg.rayVector.dy * 0.5;
                    isFacingSun = timeline === 'evening';
                  } else {
                    wx = room.x + room.width;
                    wy = room.y + wPos + wWidth / 2;
                    dirDx = -1.0;
                    dirDy = currentCfg.rayVector.dy * 0.5;
                    isFacingSun = timeline === 'morning';
                  }

                  // Penetration depth into room in feet
                  const rayDepth = isFacingSun ? Math.min(room.width, room.height) * 0.75 : 2.2;
                  const spread = currentCfg.rayVector.spread;

                  // 4 polygon corners representing volumetric light cast onto floor
                  const halfW = wWidth / 2;
                  let p1x = 0; let p1y = 0;
                  let p2x = 0; let p2y = 0;
                  let p3x = 0; let p3y = 0;
                  let p4x = 0; let p4y = 0;

                  if (win.wall === 'top' || win.wall === 'bottom') {
                    p1x = wx - halfW;
                    p1y = wy;
                    p2x = wx + halfW;
                    p2y = wy;
                    p3x = p2x + dirDx * rayDepth + spread;
                    p3y = p2y + dirDy * rayDepth;
                    p4x = p1x + dirDx * rayDepth - spread;
                    p4y = p1y + dirDy * rayDepth;
                  } else {
                    p1x = wx;
                    p1y = wy - halfW;
                    p2x = wx;
                    p2y = wy + halfW;
                    p3x = p2x + dirDx * rayDepth;
                    p3y = p2y + dirDy * rayDepth + spread;
                    p4x = p1x + dirDx * rayDepth;
                    p4y = p1y + dirDy * rayDepth - spread;
                  }

                  const pointsStr = `${p1x.toFixed(2)},${p1y.toFixed(2)} ${p2x.toFixed(2)},${p2y.toFixed(2)} ${p3x.toFixed(2)},${p3y.toFixed(2)} ${p4x.toFixed(2)},${p4y.toFixed(2)}`;

                  return (
                    <g key={`sun_ray_${wIdx}`}>
                      {/* Volumetric Sun Penetration Polygon */}
                      <polygon
                        points={pointsStr}
                        fill={`url(#${currentCfg.rayGradientId})`}
                        opacity={isFacingSun ? 0.85 : 0.40}
                      />

                      {/* Directional Photon Particles (subtle dashed streak line) */}
                      <line
                        x1={wx}
                        y1={wy}
                        x2={wx + dirDx * (rayDepth * 0.9)}
                        y2={wy + dirDy * (rayDepth * 0.9)}
                        stroke={timeline === 'noon' ? '#eab308' : '#f59e0b'}
                        strokeWidth={0.15}
                        strokeDasharray="0.6 0.3"
                        opacity={isFacingSun ? 0.9 : 0.3}
                      />

                      {/* Window Glazing Refraction Highlight */}
                      <line
                        x1={win.wall === 'top' || win.wall === 'bottom' ? wx - halfW : wx}
                        y1={win.wall === 'top' || win.wall === 'bottom' ? wy : wy - halfW}
                        x2={win.wall === 'top' || win.wall === 'bottom' ? wx + halfW : wx}
                        y2={win.wall === 'top' || win.wall === 'bottom' ? wy : wy + halfW}
                        stroke="#38bdf8"
                        strokeWidth={0.25}
                        opacity={0.8}
                      />
                    </g>
                  );
                })}

                {/* Real-time Lux Metric Tag Badge in Room Center */}
                <g transform={`translate(${room.x + room.width / 2}, ${room.y + room.height / 2})`}>
                  <rect
                    x={-2.6}
                    y={-0.5}
                    width={5.2}
                    height={1.0}
                    rx={0.25}
                    fill="rgba(15, 23, 42, 0.85)"
                    stroke="rgba(245, 158, 11, 0.6)"
                    strokeWidth={0.08}
                  />
                  <text
                    x={0}
                    y={0.2}
                    textAnchor="middle"
                    fill="#fef3c7"
                    fontSize={0.52}
                    fontWeight={700}
                    fontFamily="'JetBrains Mono', monospace"
                  >
                    ☀️ {Math.round(currentCfg.avgLux * (room.name.toLowerCase().includes('corridor') ? 0.5 : 1.0))} LUX
                  </text>
                </g>
              </g>
            );
          })
        ) : (
          // ── NIGHT ILLUMINATION: WARM INTERIOR CEILING LIGHTS CASTING OUTWARD ──
          rooms.map((room, rIdx) => {
            const cx = room.x + room.width / 2;
            const cy = room.y + room.height / 2;
            const lightRadius = Math.max(room.width, room.height) * 0.65;

            return (
              <g key={`night_room_${rIdx}`}>
                {/* Radial Soft Interior Glow Filling Floor */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={lightRadius}
                  fill="url(#grad-solar-night)"
                  opacity={0.85}
                />

                {/* Ceiling Luminaire Fixture Symbol */}
                <circle cx={cx} cy={cy} r={0.45} fill="#fed7aa" stroke="#d97706" strokeWidth={0.1} />
                <circle cx={cx} cy={cy} r={0.18} fill="#ffffff" />

                {/* Radiating Photons */}
                {Array.from({ length: 6 }).map((_, rayI) => {
                  const angle = (rayI / 6) * Math.PI * 2;
                  const r1 = 0.6;
                  const r2 = 1.6;
                  return (
                    <line
                      key={rayI}
                      x1={cx + Math.cos(angle) * r1}
                      y1={cy + Math.sin(angle) * r1}
                      x2={cx + Math.cos(angle) * r2}
                      y2={cy + Math.sin(angle) * r2}
                      stroke="#fed7aa"
                      strokeWidth={0.08}
                      opacity={0.7}
                    />
                  );
                })}

                {/* Interior Lighting Task Metric Badge */}
                <g transform={`translate(${cx}, ${cy + 1.2})`}>
                  <rect
                    x={-3.2}
                    y={-0.6}
                    width={6.4}
                    height={1.2}
                    rx={0.3}
                    fill="rgba(15, 23, 42, 0.90)"
                    stroke="rgba(254, 215, 170, 0.6)"
                    strokeWidth={0.08}
                  />
                  <text
                    x={0}
                    y={0.2}
                    textAnchor="middle"
                    fill="#fed7aa"
                    fontSize={0.50}
                    fontWeight={700}
                    fontFamily="'JetBrains Mono', monospace"
                  >
                    💡 2700K · 300 LUX
                  </text>
                </g>
              </g>
            );
          })
        )}
      </g>
    </>
  );
});

SunlightOverlay.displayName = 'SunlightOverlay';

/**
 * Clean Floating HTML HUD Panel for Solar Timeline & Lux Study
 */
export const SunlightStudyHud: React.FC<{
  timeline: SolarTimeline;
  onTimelineChange: (t: SolarTimeline) => void;
}> = React.memo(({ timeline, onTimelineChange }) => {
  const currentCfg = SOLAR_TIMELINE_CONFIGS[timeline];

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
        borderRadius: '12px',
        padding: '8px 12px',
        boxShadow: '0 8px 24px rgba(37, 38, 34, 0.12)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        userSelect: 'none',
        minWidth: '320px',
      }}
    >
      {/* Header & Metric Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sun size={14} color="#d97706" />
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#252622', fontFamily: "'JetBrains Mono', monospace" }}>
            SOLAR & DAYLIGHT STUDY
          </span>
        </div>
        <div style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: '4px',
          background: timeline === 'night' ? '#1e293b' : '#fef3c7',
          color: timeline === 'night' ? '#93c5fd' : '#b45309',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {currentCfg.luxRange}
        </div>
      </div>

      {/* Timeline Preset Switcher Buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {(['morning', 'noon', 'evening', 'night'] as SolarTimeline[]).map((tKey) => {
          const active = timeline === tKey;
          const cfg = SOLAR_TIMELINE_CONFIGS[tKey];
          return (
            <button
              key={tKey}
              type="button"
              id={`btn-solar-timeline-${tKey}`}
              onClick={(e) => {
                e.stopPropagation();
                onTimelineChange(tKey);
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '4px 6px',
                borderRadius: '6px',
                border: active ? '1px solid #252622' : '1px solid #E7E1D5',
                background: active ? '#252622' : '#FFFFFF',
                color: active ? '#FAF8F2' : '#777970',
                fontSize: '0.64rem',
                fontWeight: active ? 700 : 500,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={cfg.sunAngle}
            >
              {tKey === 'morning' && <Sunrise size={11} />}
              {tKey === 'noon' && <Sun size={11} />}
              {tKey === 'evening' && <Sunset size={11} />}
              {tKey === 'night' && <Moon size={11} />}
              <span>{cfg.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Subtext info */}
      <div style={{ fontSize: '0.62rem', color: '#777970', display: 'flex', justifyContent: 'space-between' }}>
        <span>{currentCfg.sunAngle}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{currentCfg.timeStr}</span>
      </div>
    </div>
  );
});

SunlightStudyHud.displayName = 'SunlightStudyHud';

export default SunlightOverlay;
