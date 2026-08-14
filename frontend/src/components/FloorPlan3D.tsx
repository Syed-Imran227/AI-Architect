import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Sphere, Edges, Text } from '@react-three/drei';
import type { Room } from '../services/api';

interface FloorPlan3DProps {
  rooms: Room[];
}

const ROOM_HEIGHT = 9;
const WALL_T = 0.4;

function getRoomColor(name: string): { floor: string; wall: string } {
  const n = name.toLowerCase();
  if (n.includes('master'))   return { floor: '#c8d8e8', wall: '#b0c0d0' };
  if (n.includes('bedroom'))  return { floor: '#d4e4d4', wall: '#b8c8b8' };
  if (n.includes('bath'))     return { floor: '#b0e0e0', wall: '#90c8c8' };
  if (n.includes('kitchen'))  return { floor: '#fde8c8', wall: '#edd8a8' };
  if (n.includes('living'))   return { floor: '#e0d8f0', wall: '#c8c0e0' };
  if (n.includes('dining'))   return { floor: '#f4d0e0', wall: '#e0b8c8' };
  if (n.includes('balcony') || n.includes('terrace')) return { floor: '#c8f0d8', wall: '#a8e0b8' };
  if (n.includes('stair'))    return { floor: '#f0e8c8', wall: '#e0d0a8' };
  if (n.includes('foyer'))    return { floor: '#fff0d0', wall: '#eed8b0' };
  if (n.includes('parking'))  return { floor: '#d8d8d8', wall: '#b8b8b8' };
  return { floor: '#f0f0f0', wall: '#d8d8d8' };
}

function Stairs3D({ room }: { room: Room }) {
  const numSteps = 10;
  const stepH = ROOM_HEIGHT / numSteps;
  const stepD = room.height  / numSteps;
  const stepW = room.width   - 0.8;
  const rx    = room.x + room.width  / 2;
  const rz    = room.y + room.height / 2;

  return (
    <group position={[rx, 0, rz]}>
      {Array.from({ length: numSteps }).map((_, i) => (
        <Box key={i} args={[stepW, stepH, stepD]}
             position={[0, i * stepH + stepH / 2, -room.height / 2 + i * stepD + stepD / 2]}>
          <meshStandardMaterial color={i % 2 === 0 ? '#cdc0aa' : '#b8ac98'} />
          <Edges color="#8a7a6a" />
        </Box>
      ))}
      {/* Handrail posts */}
      {[0, 0.33, 0.66, 1].map((t, i) => (
        <Cylinder key={i} args={[0.07, 0.07, ROOM_HEIGHT, 8]}
                  position={[room.width / 2 - 0.45, ROOM_HEIGHT / 2, -room.height / 2 + t * room.height]}>
          <meshStandardMaterial color="#8b7355" metalness={0.3} />
        </Cylinder>
      ))}
      {/* Handrail */}
      <Box args={[0.08, 0.08, room.height]} position={[room.width / 2 - 0.45, ROOM_HEIGHT - 0.5, 0]}>
        <meshStandardMaterial color="#7a6248" metalness={0.3} />
      </Box>
    </group>
  );
}

function FurnitureItem3D({ item, roomX, roomY }: {
  item: { name: string; x: number; y: number; width: number; height: number };
  roomX: number;
  roomY: number;
}) {
  const n  = item.name.toLowerCase();
  const wx = roomX + item.x + item.width  / 2;
  const wz = roomY + item.y + item.height / 2;
  const fw = item.width;
  const fd = item.height;

  if ((n.includes('bed') || n.includes('king') || n.includes('double') || n.includes('single')) && !n.includes('side') && !n.includes('step')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.35, fd]} position={[0, 0.17, 0]}><meshStandardMaterial color="#7a5c3a" /></Box>
        <Box args={[fw - 0.2, 1.4, fd - 0.2]} position={[0, 0.35 + 0.7, 0]}><meshStandardMaterial color="#f0f0f0" /></Box>
        <Box args={[fw - 0.3, 0.4, fd * 0.18]} position={[-fw * 0.15, 1.75 + 0.2, -fd * 0.38]}><meshStandardMaterial color="#ffe0e0" /></Box>
        <Box args={[fw - 0.3, 0.4, fd * 0.18]} position={[fw * 0.15, 1.75 + 0.2, -fd * 0.38]}><meshStandardMaterial color="#ffe0e0" /></Box>
        <Box args={[fw, 2.5, 0.25]} position={[0, 1.25, -fd / 2 + 0.13]}><meshStandardMaterial color="#6b4e1e" /></Box>
      </group>
    );
  }
  if (n.includes('side') && n.includes('table')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.05, fd]} position={[0, 2.2, 0]}><meshStandardMaterial color="#c0900a" /></Box>
        <Box args={[fw - 0.1, 2.2, fd - 0.1]} position={[0, 1.1, 0]}><meshStandardMaterial color="#d4a020" opacity={0.55} transparent /></Box>
        <Cylinder args={[0.07, 0.09, 0.65, 8]} position={[0, 2.2 + 0.33, 0]}><meshStandardMaterial color="#b09040" /></Cylinder>
        <Cylinder args={[0.3, 0.14, 0.45, 8]} position={[0, 2.2 + 0.8, 0]}><meshStandardMaterial color="#fffce0" opacity={0.85} transparent /></Cylinder>
      </group>
    );
  }
  if (n.includes('sofa') || n.includes('couch')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 1.2, fd * 0.6]} position={[0, 0.6, fd * 0.1]}><meshStandardMaterial color="#6b7a9e" /></Box>
        <Box args={[fw, 2.2, fd * 0.22]} position={[0, 1.1, -fd * 0.37]}><meshStandardMaterial color="#5a6a8e" /></Box>
        <Box args={[fw * 0.12, 1.8, fd]} position={[-fw / 2 + fw * 0.06, 0.9, 0]}><meshStandardMaterial color="#5a6a8e" /></Box>
        <Box args={[fw * 0.12, 1.8, fd]} position={[fw / 2 - fw * 0.06, 0.9, 0]}><meshStandardMaterial color="#5a6a8e" /></Box>
      </group>
    );
  }
  if (n.includes('armchair') || (n.includes('chair') && !n.includes('dining') && !n.includes('study') && !n.includes('patio'))) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 1.1, fd * 0.55]} position={[0, 0.55, fd * 0.1]}><meshStandardMaterial color="#7a8abe" /></Box>
        <Box args={[fw, 1.8, fd * 0.2]} position={[0, 0.9, -fd * 0.38]}><meshStandardMaterial color="#6a7aae" /></Box>
        <Box args={[fw * 0.18, 1.5, fd]} position={[-fw / 2 + fw * 0.09, 0.75, 0]}><meshStandardMaterial color="#6a7aae" /></Box>
        <Box args={[fw * 0.18, 1.5, fd]} position={[fw / 2 - fw * 0.09, 0.75, 0]}><meshStandardMaterial color="#6a7aae" /></Box>
      </group>
    );
  }
  if (n.includes('dining table') || n.includes('coffee table') || n.includes('patio table')) {
    const tH = n.includes('coffee') ? 1.2 : 2.8;
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.15, fd]} position={[0, tH, 0]}><meshStandardMaterial color="#b8860b" /></Box>
        {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]).map(([sx, sz], i) => (
          <Box key={i} args={[0.1, tH, 0.1]} position={[sx * (fw / 2 - 0.15), tH / 2, sz * (fd / 2 - 0.15)]}><meshStandardMaterial color="#8b6914" /></Box>
        ))}
      </group>
    );
  }
  if (n.includes('dining chair') || n.includes('study chair') || n.includes('patio chair') || n.includes('outdoor chair')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.08, fd]} position={[0, 1.8, 0]}><meshStandardMaterial color="#a07840" /></Box>
        <Box args={[fw, 1.5, 0.1]} position={[0, 0.9, -fd / 2]}><meshStandardMaterial color="#8b6830" /></Box>
        {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]).map(([sx, sz], i) => (
          <Box key={i} args={[0.08, 1.8, 0.08]} position={[sx * (fw / 2 - 0.1), 0.9, sz * (fd / 2 - 0.1)]}><meshStandardMaterial color="#8b6830" /></Box>
        ))}
      </group>
    );
  }
  if (n.includes('wardrobe') || n.includes('cabinet') || n.includes('sideboard')) {
    const wH = n.includes('sideboard') ? 3.5 : 7.5;
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, wH, fd]} position={[0, wH / 2, 0]}><meshStandardMaterial color="#7a5c3a" /><Edges color="#5a3c1a" /></Box>
        <Box args={[0.04, wH - 0.3, 0.06]} position={[0, wH / 2, fd / 2 + 0.02]}><meshStandardMaterial color="#5a3c1a" /></Box>
        <Sphere args={[0.12, 8, 8]} position={[-0.35, wH / 2, fd / 2 + 0.15]}><meshStandardMaterial color="#c8a040" metalness={0.8} roughness={0.2} /></Sphere>
        <Sphere args={[0.12, 8, 8]} position={[0.35, wH / 2, fd / 2 + 0.15]}><meshStandardMaterial color="#c8a040" metalness={0.8} roughness={0.2} /></Sphere>
      </group>
    );
  }
  if (n.includes('desk') || n.includes('dressing') || n.includes('console')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.1, fd]} position={[0, 2.8, 0]}><meshStandardMaterial color="#c09030" /></Box>
        {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]).map(([sx, sz], i) => (
          <Box key={i} args={[0.09, 2.8, 0.09]} position={[sx * (fw / 2 - 0.12), 1.4, sz * (fd / 2 - 0.12)]}><meshStandardMaterial color="#7a5c3a" /></Box>
        ))}
      </group>
    );
  }
  if (n.includes('counter') || n.includes('kitchen island') || n.includes('counter top')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 3, fd]} position={[0, 1.5, 0]}><meshStandardMaterial color="#e0d8c0" /></Box>
        <Box args={[fw + 0.1, 0.12, fd + 0.1]} position={[0, 3.06, 0]}><meshStandardMaterial color="#b0a880" /></Box>
        {!n.includes('island') && (
          <Box args={[fw, 1.5, 0.1]} position={[0, 3.75, -fd / 2 - 0.05]}><meshStandardMaterial color="#c8c0a0" /></Box>
        )}
      </group>
    );
  }
  if (n.includes('refrigerator') || n.includes('fridge')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 6.5, fd]} position={[0, 3.25, 0]}><meshStandardMaterial color="#dcdcdc" /><Edges color="#aaa" /></Box>
        <Box args={[0.05, 2.5, 0.06]} position={[fw / 2 - 0.15, 2.5, fd / 2 + 0.02]}><meshStandardMaterial color="#c8a040" metalness={0.7} /></Box>
      </group>
    );
  }
  if (n.includes('oven')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 3.5, fd]} position={[0, 1.75, 0]}><meshStandardMaterial color="#2a2a2a" /><Edges color="#555" /></Box>
        <Box args={[fw - 0.3, 1.8, 0.08]} position={[0, 1.5, fd / 2 + 0.04]}><meshStandardMaterial color="#1a1a1a" /></Box>
      </group>
    );
  }
  if (n.includes('sink') || n.includes('vanity')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 3, fd]} position={[0, 1.5, 0]}><meshStandardMaterial color="#f0f0f0" /></Box>
        <Box args={[fw - 0.1, 0.1, fd - 0.1]} position={[0, 3.05, 0]}><meshStandardMaterial color="#d0d8e0" /></Box>
        <Box args={[fw - 0.4, 0.5, fd - 0.35]} position={[0, 3.3, 0]}><meshStandardMaterial color="#a0c0d0" opacity={0.8} transparent /></Box>
        <Cylinder args={[0.05, 0.05, 0.9, 8]} position={[0, 3.5 + 0.45, 0]}><meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} /></Cylinder>
      </group>
    );
  }
  if (n.includes('wc') || n.includes('toilet')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 2.5, fd * 0.3]} position={[0, 1.25, -fd * 0.33]}><meshStandardMaterial color="#f8f8f8" /></Box>
        <Box args={[fw, 1.5, fd * 0.65]} position={[0, 0.75, fd * 0.15]}><meshStandardMaterial color="#f0f0f0" /><Edges color="#d0d0d0" /></Box>
        <Box args={[fw - 0.1, 0.1, fd * 0.6]} position={[0, 1.55, fd * 0.15]}><meshStandardMaterial color="#e8e8e8" /></Box>
      </group>
    );
  }
  if (n.includes('bathtub') || (n.includes('bath') && !n.includes('room') && !n.includes('room'))) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 1.8, fd]} position={[0, 0.9, 0]}><meshStandardMaterial color="#f5f5f5" /><Edges color="#d0d0d0" /></Box>
        <Box args={[fw - 0.25, 1.2, fd - 0.3]} position={[0, 1.05, 0]}><meshStandardMaterial color="#a8d8e8" opacity={0.6} transparent /></Box>
        <Cylinder args={[0.07, 0.07, 0.9, 8]} position={[fw / 2 - 0.3, 2.5, 0]}><meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} /></Cylinder>
      </group>
    );
  }
  if (n.includes('shower')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.2, fd]} position={[0, 0.1, 0]}><meshStandardMaterial color="#cce0cc" /></Box>
        <Box args={[fw, ROOM_HEIGHT * 0.82, 0.05]} position={[0, ROOM_HEIGHT * 0.41, fd / 2]}><meshStandardMaterial color="#88bbcc" opacity={0.28} transparent /></Box>
        <Box args={[0.05, ROOM_HEIGHT * 0.82, fd]} position={[-fw / 2, ROOM_HEIGHT * 0.41, 0]}><meshStandardMaterial color="#88bbcc" opacity={0.28} transparent /></Box>
        <Cylinder args={[0.15, 0.15, 0.08, 16]} position={[0, ROOM_HEIGHT * 0.78, -fd * 0.35]} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color="#c8c8c8" metalness={0.9} roughness={0.1} /></Cylinder>
      </group>
    );
  }
  if (n.includes('tv unit') || n.includes('tv')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 1.5, fd]} position={[0, 0.75, 0]}><meshStandardMaterial color="#2a2a2a" /></Box>
        <Box args={[fw - 0.2, 2.8, 0.12]} position={[0, 1.5 + 1.4, -fd / 2 - 0.07]}><meshStandardMaterial color="#111" /></Box>
        <Box args={[fw - 0.35, 2.5, 0.06]} position={[0, 1.5 + 1.4, -fd / 2 - 0.1]}><meshStandardMaterial color="#0a0a20" emissive="#050518" emissiveIntensity={0.4} /></Box>
      </group>
    );
  }
  if (n.includes('plant') || n.includes('pot')) {
    return (
      <group position={[wx, 0, wz]}>
        <Cylinder args={[fw / 2, fw / 2 * 0.65, fd, 12]} position={[0, fd / 2, 0]}><meshStandardMaterial color="#8b4513" /></Cylinder>
        <Sphere args={[fw / 2 * 1.15, 8, 8]} position={[0, fd + fw * 0.45, 0]}><meshStandardMaterial color="#228b22" /></Sphere>
      </group>
    );
  }
  if (n.includes('car')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 1.8, fd]} position={[0, 0.9, 0]}><meshStandardMaterial color="#4466aa" /></Box>
        <Box args={[fw * 0.72, 1.5, fd * 0.58]} position={[0, 2.7, -fd * 0.05]}><meshStandardMaterial color="#3355aa" /></Box>
        {([[-fw / 2 + 1, -fd / 2 + 1], [fw / 2 - 1, -fd / 2 + 1], [-fw / 2 + 1, fd / 2 - 1], [fw / 2 - 1, fd / 2 - 1]] as [number, number][]).map(([lx, lz], i) => (
          <Cylinder key={i} args={[0.75, 0.75, 0.45, 16]} rotation={[Math.PI / 2, 0, 0]} position={[lx, 0.8, lz]}><meshStandardMaterial color="#1a1a1a" /></Cylinder>
        ))}
      </group>
    );
  }
  if (n.includes('bench') || n.includes('lounger')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.28, fd]} position={[0, 1.2, 0]}><meshStandardMaterial color="#c8a878" /></Box>
        {([[-fw / 2 + 0.2, -fd / 2 + 0.2], [fw / 2 - 0.2, -fd / 2 + 0.2], [-fw / 2 + 0.2, fd / 2 - 0.2], [fw / 2 - 0.2, fd / 2 - 0.2]] as [number, number][]).map(([lx, lz], i) => (
          <Box key={i} args={[0.1, 1.2, 0.1]} position={[lx, 0.6, lz]}><meshStandardMaterial color="#a88858" /></Box>
        ))}
      </group>
    );
  }
  if (n.includes('bookshelf') || n.includes('shelf')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 6, fd]} position={[0, 3, 0]}><meshStandardMaterial color="#7a5c3a" /><Edges color="#5a3c1a" /></Box>
        {[1.5, 3.0, 4.5].map((sh, i) => (
          <Box key={i} args={[fw - 0.1, 0.08, fd - 0.1]} position={[0, sh, 0]}><meshStandardMaterial color="#5a3c1a" /></Box>
        ))}
      </group>
    );
  }
  if (n.includes('washing machine') || n.includes('dryer')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, fd * 2, fd]} position={[0, fd, 0]}><meshStandardMaterial color="#e8e8e8" /></Box>
        <Cylinder args={[fd * 0.35, fd * 0.35, 0.15, 16]} position={[0, fd * 2 - 0.5, fd / 2 + 0.08]} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color="#aabbcc" /></Cylinder>
      </group>
    );
  }
  if (n.includes('step')) {
    // Steps are rendered by Stairs3D, skip here
    return null;
  }

  // Generic fallback
  return (
    <Box args={[Math.max(fw, 0.5), 1.0, Math.max(fd, 0.5)]} position={[wx, 0.5, wz]}>
      <meshStandardMaterial color="#c0c8d0" opacity={0.65} transparent />
    </Box>
  );
}

function Room3D({ room }: { room: Room }) {
  const n      = room.name.toLowerCase();
  const colors = getRoomColor(room.name);
  const cx     = room.x + room.width  / 2;
  const cz     = room.y + room.height / 2;

  if (n.includes('stair')) {
    return (
      <>
        <mesh position={[cx, -0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[room.width, room.height]} />
          <meshStandardMaterial color={colors.floor} />
        </mesh>
        <Stairs3D room={room} />
        <Text position={[cx, ROOM_HEIGHT + 1, cz]} rotation={[-Math.PI / 2, 0, 0]}
              fontSize={1.2} color="#555" anchorX="center" anchorY="middle">
          {room.name}
        </Text>
      </>
    );
  }

  return (
    <group>
      {/* Floor */}
      <mesh position={[cx, -0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.width, room.height]} />
        <meshStandardMaterial color={colors.floor} />
      </mesh>

      {/* Walls */}
      <Box args={[room.width + WALL_T, ROOM_HEIGHT, WALL_T]} position={[cx, ROOM_HEIGHT / 2, room.y]}>
        <meshStandardMaterial color={colors.wall} opacity={0.5} transparent />
        <Edges color="#999" />
      </Box>
      <Box args={[room.width + WALL_T, ROOM_HEIGHT, WALL_T]} position={[cx, ROOM_HEIGHT / 2, room.y + room.height]}>
        <meshStandardMaterial color={colors.wall} opacity={0.5} transparent />
        <Edges color="#999" />
      </Box>
      <Box args={[WALL_T, ROOM_HEIGHT, room.height]} position={[room.x, ROOM_HEIGHT / 2, cz]}>
        <meshStandardMaterial color={colors.wall} opacity={0.5} transparent />
        <Edges color="#999" />
      </Box>
      <Box args={[WALL_T, ROOM_HEIGHT, room.height]} position={[room.x + room.width, ROOM_HEIGHT / 2, cz]}>
        <meshStandardMaterial color={colors.wall} opacity={0.5} transparent />
        <Edges color="#999" />
      </Box>

      {/* Furniture */}
      {room.furniture && room.furniture.map((item, i) => (
        <FurnitureItem3D key={i} item={item} roomX={room.x} roomY={room.y} />
      ))}

      <Text position={[cx, ROOM_HEIGHT + 1, cz]} rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.3} color="#222" anchorX="center" anchorY="middle">
        {room.name}
      </Text>
    </group>
  );
}

export default function FloorPlan3D({ rooms }: FloorPlan3DProps) {
  if (!rooms || rooms.length === 0) return null;

  const minX   = Math.min(...rooms.map(r => r.x));
  const minZ   = Math.min(...rooms.map(r => r.y));
  const maxX   = Math.max(...rooms.map(r => r.x + r.width));
  const maxZ   = Math.max(...rooms.map(r => r.y + r.height));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const maxDim  = Math.max(maxX - minX, maxZ - minZ);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', background: '#0f172a', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas camera={{ position: [centerX + maxDim * 0.5, maxDim * 1.1, centerZ + maxDim * 0.85], fov: 50 }} shadows>
        <ambientLight intensity={0.55} />
        <directionalLight position={[centerX + maxDim * 0.6, maxDim * 1.2, centerZ + maxDim * 0.6]} intensity={1.2} castShadow />
        <directionalLight position={[centerX - maxDim * 0.3, maxDim * 0.7, centerZ - maxDim * 0.3]} intensity={0.35} />

        <group>
          {rooms.map((room, i) => <Room3D key={i} room={room} />)}
        </group>

        <OrbitControls
          target={[centerX, ROOM_HEIGHT / 2, centerZ]}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={10}
          maxDistance={maxDim * 3}
        />
        <gridHelper
          args={[Math.ceil(maxDim * 1.5 / 10) * 10, Math.ceil(maxDim * 1.5 / 10), '#2a3a50', '#1a2a40']}
          position={[centerX, -0.3, centerZ]}
        />
      </Canvas>
    </div>
  );
}
