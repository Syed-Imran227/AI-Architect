import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Text, Edges } from '@react-three/drei';
import type { Room } from '../services/api';

interface FloorPlan3DProps {
  rooms: Room[];
}
const ROOM_HEIGHT = 10; // Standard room height 10 ft

function Room3D({ room }: { room: Room }) {
  // SVG coordinates: y increases downwards. Three.js: y increases upwards, z increases towards viewer.
  // We'll map SVG x -> Three x, SVG y -> Three z (so the floor is on the xz plane).
  
  const height = ROOM_HEIGHT;
  const thickness = 0.5; // Wall thickness

  // Center of the room on the x/z plane
  const cx = room.x + room.width / 2;
  const cz = room.y + room.height / 2;

  // Generate color based on room name
  const isWet = room.name.toLowerCase().includes('bath') || room.name.toLowerCase().includes('kitchen');
  const color = isWet ? '#bae6fd' : '#f8fafc'; // light blue for wet rooms, off-white otherwise

  return (
    <group position={[cx, height / 2, cz]}>
      {/* Floor */}
      <mesh position={[0, -height / 2 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.width, room.height]} />
        <meshStandardMaterial color={color} opacity={0.8} transparent />
      </mesh>

      {/* Label */}
      <Text
        position={[0, height / 2 + 0.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.5}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
      >
        {room.name}
      </Text>

      {/* Walls (using Box for simplicity) */}
      {/* Top Wall */}
      <Box args={[room.width + thickness, height, thickness]} position={[0, 0, -room.height / 2]}>
        <meshStandardMaterial color="#cbd5e1" opacity={0.6} transparent />
        <Edges color="#64748b" />
      </Box>
      {/* Bottom Wall */}
      <Box args={[room.width + thickness, height, thickness]} position={[0, 0, room.height / 2]}>
        <meshStandardMaterial color="#cbd5e1" opacity={0.6} transparent />
        <Edges color="#64748b" />
      </Box>
      {/* Left Wall */}
      <Box args={[thickness, height, room.height]} position={[-room.width / 2, 0, 0]}>
        <meshStandardMaterial color="#cbd5e1" opacity={0.6} transparent />
        <Edges color="#64748b" />
      </Box>
      {/* Right Wall */}
      <Box args={[thickness, height, room.height]} position={[room.width / 2, 0, 0]}>
        <meshStandardMaterial color="#cbd5e1" opacity={0.6} transparent />
        <Edges color="#64748b" />
      </Box>
    </group>
  );
}

export default function FloorPlan3D({ rooms }: FloorPlan3DProps) {
  if (!rooms || rooms.length === 0) return null;

  // Calculate bounding box to center the camera
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  rooms.forEach(r => {
    if (r.x < minX) minX = r.x;
    if (r.y < minZ) minZ = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxZ) maxZ = r.y + r.height;
  });

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const maxDim = Math.max(maxX - minX, maxZ - minZ);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', background: '#0f172a', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas camera={{ position: [centerX, maxDim * 1.5, centerZ + maxDim * 0.5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1} />
        
        <group>
          {rooms.map((room, i) => (
            <Room3D key={i} room={room} />
          ))}
        </group>

        <OrbitControls target={[centerX, 0, centerZ]} maxPolarAngle={Math.PI / 2 - 0.1} />
        <gridHelper args={[200, 200, '#334155', '#1e293b']} position={[centerX, -0.1, centerZ]} />
      </Canvas>
    </div>
  );
}
