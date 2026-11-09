import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { X, Box, Sun, Moon, Eye, ExternalLink } from 'lucide-react';
import { migrateLegacyToCanonical } from '../../editor/geometry/migration';
import { generate3DBuilding } from '../../editor/geometry/building3DGenerator';
import type { Room } from '../../../shared/api-client/api';

interface Project3DPreviewModalProps {
  project: {
    id: string;
    name: string;
    layout_data: {
      rooms?: Room[];
      floors?: { level?: string | number; rooms?: Room[] }[];
      form?: { length?: number; width?: number; floors?: number };
      plot_width?: number;
      plot_length?: number;
      plot_height?: number;
    };
  };
  onClose: () => void;
}

/**
 * Three.js Building Geometry Meshes
 */
function Building3DScene({
  canonicalDoc,
  isCutaway,
  lighting,
}: {
  canonicalDoc: ReturnType<typeof migrateLegacyToCanonical>;
  isCutaway: boolean;
  lighting: 'day' | 'sunset';
}) {
  const building = useMemo(() => {
    return generate3DBuilding(canonicalDoc, {
      isCutaway,
      cutawayHeightFt: 4.5,
      defaultWallHeightFt: 10.0,
      defaultSlabThicknessFt: 0.8,
    });
  }, [canonicalDoc, isCutaway]);

  const { centerX, centerZ } = building.bounds;

  return (
    <group position={[-centerX, 0, -centerZ]}>
      {/* Sun / Directional Light */}
      <ambientLight intensity={lighting === 'day' ? 0.7 : 0.4} />
      <directionalLight
        position={lighting === 'day' ? [40, 60, 40] : [20, 25, 50]}
        intensity={lighting === 'day' ? 1.4 : 1.8}
        color={lighting === 'day' ? '#ffffff' : '#f59e0b'}
        castShadow
      />
      {lighting === 'sunset' && (
        <directionalLight position={[-30, 15, -30]} intensity={0.6} color="#38bdf8" />
      )}

      {/* Ground Foundation Slab / Site */}
      <mesh position={[centerX, -0.4, centerZ]} receiveShadow>
        <boxGeometry args={[building.site.widthFt + 16, 0.8, building.site.lengthFt + 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Grid Floor Lines on Ground */}
      <gridHelper
        args={[Math.max(building.site.widthFt, building.site.lengthFt) + 20, 20, '#38bdf8', '#1e293b']}
        position={[centerX, 0.02, centerZ]}
      />

      {/* Levels Rendering */}
      {building.levels.map((level, lvlIdx) => (
        <group key={level.levelId || lvlIdx} position={[0, level.elevationFt, 0]}>
          {/* Level Floor Slab */}
          {lvlIdx > 0 && !level.isTerraceFloor && (
            <mesh position={[centerX, -level.slabThicknessFt / 2, centerZ]} receiveShadow>
              <boxGeometry args={[building.bounds.width + 1, level.slabThicknessFt, building.bounds.depth + 1]} />
              <meshStandardMaterial color="#334155" roughness={0.8} />
            </mesh>
          )}

          {/* Rooms Floor Surfaces */}
          {level.rooms.map((room) => {
            if (room.isVoid) return null;
            return (
              <mesh
                key={room.id}
                position={[room.centerFt.x, 0.05, room.centerFt.z]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
              >
                <planeGeometry args={[room.bboxFt.width - 0.2, room.bboxFt.height - 0.2]} />
                <meshStandardMaterial
                  color={room.material?.floorColor || '#e2e8f0'}
                  roughness={0.6}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}

          {/* Solid Wall Segments */}
          {level.walls.map((wall) => {
            const wallColor = wall.kind === 'exterior' ? '#f8fafc' : '#cbd5e1';
            return (
              <group key={wall.id}>
                {wall.solidSegments.map((seg, sIdx) => {
                  const segLen = Math.max(0.1, seg.lengthFt);
                  const angle = wall.angleRad || 0;
                  return (
                    <mesh
                      key={sIdx}
                      position={[seg.centerFt.x, seg.centerFt.y, seg.centerFt.z]}
                      rotation={[0, -angle, 0]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[segLen, wall.heightFt, wall.thicknessFt]} />
                      <meshStandardMaterial color={wallColor} roughness={0.85} />
                    </mesh>
                  );
                })}
              </group>
            );
          })}

          {/* Wall Junction Pillars */}
          {level.wallJunctions.map((j) => (
            <mesh
              key={j.id}
              position={[j.positionFt.x, j.heightFt / 2, j.positionFt.z]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[j.thicknessFt, j.heightFt, j.thicknessFt]} />
              <meshStandardMaterial color={j.kind === 'exterior' ? '#f8fafc' : '#cbd5e1'} roughness={0.85} />
            </mesh>
          ))}

          {/* Placed Furniture Masses */}
          {level.furniture.map((item) => (
            <mesh
              key={item.id}
              position={[item.positionFt.x, item.positionFt.y + item.dimensionsFt.height / 2, item.positionFt.z]}
              rotation={[0, (item.rotationDeg * Math.PI) / 180, 0]}
              castShadow
            >
              <boxGeometry args={[item.dimensionsFt.width, item.dimensionsFt.height, item.dimensionsFt.depth]} />
              <meshStandardMaterial color={item.color || '#3b82f6'} roughness={0.5} />
            </mesh>
          ))}

          {/* Inter-Floor Staircases */}
          {level.stairs?.map((stair) => (
            <mesh
              key={stair.id}
              position={[stair.boundsFt.x + stair.boundsFt.width / 2, stair.totalHeightFt / 2, stair.boundsFt.z + stair.boundsFt.depth / 2]}
              castShadow
            >
              <boxGeometry args={[stair.boundsFt.width, stair.totalHeightFt, stair.boundsFt.depth]} />
              <meshStandardMaterial color="#d97706" roughness={0.5} />
            </mesh>
          ))}

          {/* Vertical Lift Shafts */}
          {level.lifts?.map((lift) => (
            <mesh
              key={lift.id}
              position={[lift.boundsFt.x + lift.boundsFt.width / 2, lift.cabinDimensionsFt.height / 2, lift.boundsFt.z + lift.boundsFt.depth / 2]}
              castShadow
            >
              <boxGeometry args={[lift.cabinDimensionsFt.width, lift.cabinDimensionsFt.height, lift.cabinDimensionsFt.depth]} />
              <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Lightweight Architectural 3D Massing Preview Modal
 * Lazy loaded on demand; disposes Three.js scene upon close.
 */
export default function Project3DPreviewModal({ project, onClose }: Project3DPreviewModalProps) {
  const navigate = useNavigate();
  const [isCutaway, setIsCutaway] = useState(false);
  const [lighting, setLighting] = useState<'day' | 'sunset'>('day');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const canonicalDoc = useMemo(() => {
    return migrateLegacyToCanonical(project.layout_data);
  }, [project.layout_data]);

  const handleOpenFull3D = () => {
    onClose();
    navigate(`/editor?project=${project.id}&mode=3d`);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name} 3D Massing Preview`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Header Controls Bar */}
      <header
        style={{
          height: '60px',
          padding: '0 1.5rem',
          background: 'var(--stage-surface, #15171A)',
          borderBottom: '1px solid var(--stage-hairline, #2A2D31)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: '6px',
              background: 'rgba(200, 80, 30, 0.1)',
              border: '1px solid rgba(200, 80, 30, 0.3)',
              color: 'var(--accent-oxide, #C8501E)',
            }}
          >
            <Box size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 600 }}>
              {project.name} — 3D Massing Preview
            </h3>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.68rem',
                color: '#94a3b8',
                letterSpacing: '0.04em',
              }}
            >
              CANONICAL EXTRUSION ENGINE // READ-ONLY ORBITAL VIEWPORT
            </span>
          </div>
        </div>

        {/* Viewport Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsCutaway(!isCutaway)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: isCutaway ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.6)',
              border: `1px solid ${isCutaway ? '#38bdf8' : 'rgba(51, 65, 85, 0.6)'}`,
              color: isCutaway ? '#38bdf8' : '#cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Eye size={14} />
            {isCutaway ? '4.5 FT CUTAWAY' : '10 FT ENCLOSED WALLS'}
          </button>

          <button
            onClick={() => setLighting(lighting === 'day' ? 'sunset' : 'day')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              color: '#cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {lighting === 'day' ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="#38bdf8" />}
            {lighting === 'day' ? 'DAYTIME LIGHTING' : 'SUNSET AZIMUTH'}
          </button>

          <button
            onClick={handleOpenFull3D}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'var(--accent-oxide, #C8501E)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={13} />
            <span>Open in 3D Studio</span>
          </button>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              cursor: 'pointer',
              marginLeft: '4px',
            }}
            aria-label="Close Preview"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* 3D Viewport Canvas */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [45, 35, 45], fov: 45 }}
          style={{ width: '100%', height: '100%', background: '#080b11' }}
        >
          <Building3DScene
            canonicalDoc={canonicalDoc}
            isCutaway={isCutaway}
            lighting={lighting}
          />
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            maxPolarAngle={Math.PI / 2 - 0.05} // Do not go underground
            minDistance={10}
            maxDistance={140}
          />
        </Canvas>

        {/* Viewport HUD Overlay Indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            padding: '8px 14px',
            borderRadius: '8px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            color: '#94a3b8',
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: '2px' }}>
            ORBIT: LEFT-CLICK + DRAG &nbsp;|&nbsp; PAN: RIGHT-CLICK + DRAG &nbsp;|&nbsp; ZOOM: WHEEL
          </div>
          <div>LEVELS: {canonicalDoc.levels.length} &nbsp;|&nbsp; WALLS: {canonicalDoc.levels[0]?.walls?.length || 0}</div>
        </div>
      </div>
    </div>
  );
}
