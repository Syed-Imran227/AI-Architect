import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Edges, Text } from '@react-three/drei';
import type { Room } from '../services/api';

interface FloorPlan3DProps {
  rooms: Room[];
}

const ROOM_HEIGHT = 9;   // ft ceiling height
const WALL_T      = 0.3;

// ── Architectural room palette ────────────────────────────────────────────────
function getRoomColor(name: string): { floor: string; wall: string } {
  const n = name.toLowerCase();
  if (n.includes('master'))  return { floor: '#dce8f0', wall: '#bfcfdd' };
  if (n.includes('bedroom')) return { floor: '#ddeedd', wall: '#bdd4bd' };
  if (n.includes('bath'))    return { floor: '#cde8ec', wall: '#9ac5ca' };
  if (n.includes('kitchen')) return { floor: '#fdecd2', wall: '#e5cfa8' };
  if (n.includes('living'))  return { floor: '#e4dff5', wall: '#c2bde3' };
  if (n.includes('dining'))  return { floor: '#f5dde8', wall: '#dbb8c8' };
  if (n.includes('balcony') || n.includes('terrace')) return { floor: '#d0edda', wall: '#a6d4b2' };
  if (n.includes('stair'))   return { floor: '#ece8d8', wall: '#d0c8a8' };
  if (n.includes('foyer'))   return { floor: '#fef5dc', wall: '#e8d8a8' };
  if (n.includes('parking')) return { floor: '#e0e0e0', wall: '#c4c4c4' };
  if (n.includes('corridor'))return { floor: '#f2f2f2', wall: '#dadada' };
  return { floor: '#f0f0f0', wall: '#d8d8d8' };
}

// ── Staircase — architecturally correct U-shape flight ────────────────────────
// A standard stair: steps climb from y=0 (bottom/entry) to y=room.height (top).
// Steps are placed in world space (no centering group).
function Stairs3D({ room }: { room: Room }) {
  const numSteps = 12;
  const stepH    = ROOM_HEIGHT / numSteps;          // height gained per step
  const stepD    = (room.height - 0.8) / numSteps;  // depth (plan) per step
  const stepW    = room.width - 0.6;                // tread width (leave 0.3 each side)
  const ox       = room.x + room.width  / 2;       // world center X
  const startZ   = room.y;                          // bottom of stair in world

  // Handrail on the right side
  const hrX = room.x + room.width - 0.3;

  return (
    <group>
      {/* Treads — climb from front (startZ) towards rear */}
      {Array.from({ length: numSteps }).map((_, i) => (
        <Box
          key={i}
          args={[stepW, stepH * 1.05, stepD]}
          position={[ox, i * stepH + stepH / 2, startZ + i * stepD + stepD / 2]}
        >
          <meshStandardMaterial color={i % 2 === 0 ? '#d6cbaf' : '#c2b898'} />
          <Edges color="#8a7a60" />
        </Box>
      ))}

      {/* Riser nosing edge — visible front lip on each tread */}
      {Array.from({ length: numSteps }).map((_, i) => (
        <Box
          key={`n${i}`}
          args={[stepW + 0.1, 0.08, 0.15]}
          position={[ox, i * stepH + stepH, startZ + i * stepD]}
        >
          <meshStandardMaterial color="#9a8a6a" />
        </Box>
      ))}

      {/* Handrail posts — 4 evenly spaced verticals on right side */}
      {[0, 0.33, 0.66, 1.0].map((t, i) => (
        <Cylinder
          key={i}
          args={[0.05, 0.05, ROOM_HEIGHT, 8]}
          position={[hrX, ROOM_HEIGHT / 2, startZ + t * room.height]}
        >
          <meshStandardMaterial color="#7a6030" metalness={0.25} roughness={0.6} />
        </Cylinder>
      ))}

      {/* Handrail — diagonal bar following stair slope */}
      <Box
        args={[0.07, 0.07, room.height]}
        position={[hrX, ROOM_HEIGHT - 0.5, startZ + room.height / 2]}
      >
        <meshStandardMaterial color="#6a5020" metalness={0.25} roughness={0.6} />
      </Box>

      {/* Left guardrail posts */}
      {[0, 0.5, 1.0].map((t, i) => (
        <Cylinder
          key={`l${i}`}
          args={[0.05, 0.05, ROOM_HEIGHT, 8]}
          position={[room.x + 0.3, ROOM_HEIGHT / 2, startZ + t * room.height]}
        >
          <meshStandardMaterial color="#7a6030" metalness={0.25} roughness={0.6} />
        </Cylinder>
      ))}
      <Box
        args={[0.07, 0.07, room.height]}
        position={[room.x + 0.3, ROOM_HEIGHT - 0.5, startZ + room.height / 2]}
      >
        <meshStandardMaterial color="#6a5020" metalness={0.25} roughness={0.6} />
      </Box>
    </group>
  );
}

// ── 3D Furniture — architecturally placed ────────────────────────────────────
function FurnitureItem3D({ item, roomX, roomY }: {
  item: { name: string; x: number; y: number; width: number; height: number };
  roomX: number;
  roomY: number;
}) {
  const n  = item.name.toLowerCase();
  // World-space center of this furniture footprint
  const wx = roomX + item.x + item.width  / 2;
  const wz = roomY + item.y + item.height / 2;
  const fw = item.width;
  const fd = item.height;

  // ── Bed ──────────────────────────────────────────────────────────────────────
  if ((n.includes('bed') || n.includes('king') || n.includes('double') || n.includes('single'))
      && !n.includes('side') && !n.includes('step')) {
    const frameColor  = '#6e4e28';
    const mattressColor = '#f0ece4';
    const pillowColor = '#ffffff';
    const headboardH  = ROOM_HEIGHT * 0.35;
    return (
      <group position={[wx, 0, wz]}>
        {/* Frame */}
        <Box args={[fw, 0.4, fd]} position={[0, 0.2, 0]}>
          <meshStandardMaterial color={frameColor} roughness={0.5} />
        </Box>
        {/* Mattress */}
        <Box args={[fw - 0.2, 1.0, fd - 0.2]} position={[0, 0.9, 0]}>
          <meshStandardMaterial color={mattressColor} roughness={0.8} />
        </Box>
        {/* Pillows */}
        <Box args={[(fw - 0.4) / 2 - 0.1, 0.25, fd * 0.2]} position={[-fw * 0.2, 1.52, -fd * 0.36]}>
          <meshStandardMaterial color={pillowColor} roughness={0.9} />
        </Box>
        <Box args={[(fw - 0.4) / 2 - 0.1, 0.25, fd * 0.2]} position={[fw * 0.2, 1.52, -fd * 0.36]}>
          <meshStandardMaterial color={pillowColor} roughness={0.9} />
        </Box>
        {/* Headboard */}
        <Box args={[fw, headboardH, 0.2]} position={[0, headboardH / 2, -fd / 2 + 0.12]}>
          <meshStandardMaterial color={frameColor} roughness={0.5} />
        </Box>
        {/* Footboard */}
        <Box args={[fw, 1.2, 0.15]} position={[0, 0.6, fd / 2 - 0.1]}>
          <meshStandardMaterial color={frameColor} roughness={0.5} />
        </Box>
      </group>
    );
  }

  // ── Bedside Table ──────────────────────────────────────────────────────────
  if (n.includes('side') && n.includes('table')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 2.2, fd]} position={[0, 1.1, 0]}>
          <meshStandardMaterial color="#b8922a" roughness={0.4} />
        </Box>
        <Box args={[fw + 0.04, 0.06, fd + 0.04]} position={[0, 2.23, 0]}>
          <meshStandardMaterial color="#c8a030" />
        </Box>
        {/* Lamp */}
        <Cylinder args={[0.04, 0.04, 0.8, 8]} position={[0, 2.23 + 0.4, 0]}>
          <meshStandardMaterial color="#888" metalness={0.6} />
        </Cylinder>
        <Cylinder args={[0.25, 0.12, 0.35, 12]} position={[0, 2.23 + 0.9, 0]}>
          <meshStandardMaterial color="#fffde0" emissive="#fffde0" emissiveIntensity={0.3} />
        </Cylinder>
      </group>
    );
  }

  // ── Sofa ──────────────────────────────────────────────────────────────────
  if (n.includes('sofa') || n.includes('couch')) {
    const sofaC = '#5c6e94';
    const backC = '#4a5c82';
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 1.1, fd * 0.55]} position={[0, 0.55, fd * 0.12]}>
          <meshStandardMaterial color={sofaC} roughness={0.7} />
        </Box>
        {/* Back */}
        <Box args={[fw, 2.1, fd * 0.18]} position={[0, 1.05, -fd * 0.4]}>
          <meshStandardMaterial color={backC} roughness={0.7} />
        </Box>
        {/* Armrests */}
        <Box args={[fw * 0.12, 1.8, fd * 0.72]} position={[-fw / 2 + fw * 0.06, 0.9, -fd * 0.12]}>
          <meshStandardMaterial color={backC} roughness={0.7} />
        </Box>
        <Box args={[fw * 0.12, 1.8, fd * 0.72]} position={[fw / 2 - fw * 0.06, 0.9, -fd * 0.12]}>
          <meshStandardMaterial color={backC} roughness={0.7} />
        </Box>
        {/* Cushion seams */}
        {[-fw * 0.22, fw * 0.22].map((ox, i) => (
          <Box key={i} args={[0.05, 1.15, fd * 0.5]} position={[ox, 0.55, fd * 0.14]}>
            <meshStandardMaterial color={backC} />
          </Box>
        ))}
      </group>
    );
  }

  // ── Armchair ───────────────────────────────────────────────────────────────
  if (n.includes('armchair') || (n.includes('chair') && !n.includes('dining') && !n.includes('study') && !n.includes('patio') && !n.includes('outdoor'))) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 1.0, fd * 0.6]} position={[0, 0.5, fd * 0.1]}>
          <meshStandardMaterial color="#6e7eb0" roughness={0.7} />
        </Box>
        <Box args={[fw, 1.9, fd * 0.2]} position={[0, 0.95, -fd * 0.38]}>
          <meshStandardMaterial color="#5a6a9e" roughness={0.7} />
        </Box>
        <Box args={[fw * 0.2, 1.55, fd * 0.8]} position={[-fw / 2 + fw * 0.1, 0.78, 0]}>
          <meshStandardMaterial color="#5a6a9e" />
        </Box>
        <Box args={[fw * 0.2, 1.55, fd * 0.8]} position={[fw / 2 - fw * 0.1, 0.78, 0]}>
          <meshStandardMaterial color="#5a6a9e" />
        </Box>
      </group>
    );
  }

  // ── Dining / Coffee / Patio Table ─────────────────────────────────────────
  if (n.includes('table') && !n.includes('side') && !n.includes('bedside')) {
    const h = n.includes('coffee') ? 1.4 : 2.9;
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.12, fd]} position={[0, h, 0]}>
          <meshStandardMaterial color="#a87820" roughness={0.4} />
        </Box>
        {([[-1,-1],[1,-1],[-1,1],[1,1]] as [number,number][]).map(([sx,sz],i) => (
          <Box key={i} args={[0.09, h, 0.09]} position={[sx*(fw/2-0.12), h/2, sz*(fd/2-0.12)]}>
            <meshStandardMaterial color="#7a5c10" roughness={0.5} />
          </Box>
        ))}
      </group>
    );
  }

  // ── Dining / Study / Patio Chair ──────────────────────────────────────────
  if (n.includes('dining chair') || n.includes('study chair') || n.includes('patio chair') || n.includes('outdoor chair')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.07, fd]} position={[0, 1.8, 0]}>
          <meshStandardMaterial color="#906020" roughness={0.5} />
        </Box>
        <Box args={[fw, 1.5, 0.1]} position={[0, 0.9, -fd/2+0.05]}>
          <meshStandardMaterial color="#7a5010" roughness={0.5} />
        </Box>
        {([[-1,-1],[1,-1],[-1,1],[1,1]] as [number,number][]).map(([sx,sz],i) => (
          <Box key={i} args={[0.07,1.8,0.07]} position={[sx*(fw/2-0.1),0.9,sz*(fd/2-0.1)]}>
            <meshStandardMaterial color="#7a5010" />
          </Box>
        ))}
      </group>
    );
  }

  // ── Wardrobe / Cabinet ────────────────────────────────────────────────────
  if (n.includes('wardrobe') || n.includes('cabinet')) {
    const wh = 7.5;
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, wh, fd]} position={[0, wh/2, 0]}>
          <meshStandardMaterial color="#6a4e28" roughness={0.4} />
          <Edges color="#4a2e10" />
        </Box>
        {/* Panel seam */}
        <Box args={[0.05, wh-0.2, fd+0.02]} position={[0, wh/2, 0]}>
          <meshStandardMaterial color="#4a2e10" />
        </Box>
        {/* Handles */}
        {[-fw*0.25, fw*0.25].map((ox,i) => (
          <Box key={i} args={[0.06,0.6,0.06]} position={[ox, wh/2, fd/2+0.04]}>
            <meshStandardMaterial color="#c8a040" metalness={0.8} roughness={0.2} />
          </Box>
        ))}
      </group>
    );
  }

  // ── Sideboard ─────────────────────────────────────────────────────────────
  if (n.includes('sideboard')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 3, fd]} position={[0, 1.5, 0]}>
          <meshStandardMaterial color="#7a5c2a" roughness={0.4} />
        </Box>
        <Box args={[fw+0.04, 0.06, fd+0.04]} position={[0, 3.03, 0]}>
          <meshStandardMaterial color="#8a6c3a" />
        </Box>
      </group>
    );
  }

  // ── Desk / Dressing / Console ──────────────────────────────────────────────
  if (n.includes('desk') || n.includes('dressing') || n.includes('console')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.1, fd]} position={[0, 2.9, 0]}>
          <meshStandardMaterial color="#b09030" roughness={0.4} />
        </Box>
        {([[-1,-1],[1,-1],[-1,1],[1,1]] as [number,number][]).map(([sx,sz],i) => (
          <Box key={i} args={[0.08,2.9,0.08]} position={[sx*(fw/2-0.1),1.45,sz*(fd/2-0.1)]}>
            <meshStandardMaterial color="#7a6020" roughness={0.5} />
          </Box>
        ))}
      </group>
    );
  }

  // ── Counter / Kitchen Island ───────────────────────────────────────────────
  if (n.includes('counter') || n.includes('kitchen island')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 3.2, fd]} position={[0, 1.6, 0]}>
          <meshStandardMaterial color="#ddd8c0" roughness={0.3} />
        </Box>
        <Box args={[fw+0.08, 0.1, fd+0.08]} position={[0, 3.25, 0]}>
          <meshStandardMaterial color="#b8b4a0" roughness={0.2} />
        </Box>
      </group>
    );
  }

  // ── Refrigerator ──────────────────────────────────────────────────────────
  if (n.includes('refrigerator') || n.includes('fridge')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 7.0, fd]} position={[0, 3.5, 0]}>
          <meshStandardMaterial color="#d8d8d8" roughness={0.2} />
          <Edges color="#b8b8b8" />
        </Box>
        <Box args={[0.05, 3.0, 0.05]} position={[fw/2-0.12, 3.5, fd/2+0.03]}>
          <meshStandardMaterial color="#b0902a" metalness={0.7} />
        </Box>
      </group>
    );
  }

  // ── Oven / Stove ──────────────────────────────────────────────────────────
  if (n.includes('oven')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 3.6, fd]} position={[0, 1.8, 0]}>
          <meshStandardMaterial color="#222222" roughness={0.3} />
          <Edges color="#444" />
        </Box>
        <Box args={[fw-0.2, 1.8, 0.08]} position={[0, 1.5, fd/2+0.05]}>
          <meshStandardMaterial color="#111" />
        </Box>
        {/* Burners on top */}
        {([-fw*0.22, fw*0.22] as number[]).map((ox,i) => (
          <Cylinder key={i} args={[0.4, 0.4, 0.08, 16]} position={[ox, 3.64, 0]} rotation={[Math.PI/2, 0, 0]}>
            <meshStandardMaterial color="#333" metalness={0.6} />
          </Cylinder>
        ))}
      </group>
    );
  }

  // ── Sink / Vanity Sink ─────────────────────────────────────────────────────
  if (n.includes('sink') || n.includes('vanity')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 3.1, fd]} position={[0, 1.55, 0]}>
          <meshStandardMaterial color="#efefef" roughness={0.3} />
        </Box>
        <Box args={[fw-0.1, 0.08, fd-0.1]} position={[0, 3.14, 0]}>
          <meshStandardMaterial color="#d8dce0" />
        </Box>
        {/* Basin */}
        <Box args={[fw-0.35, 0.5, fd-0.3]} position={[0, 3.44, 0]}>
          <meshStandardMaterial color="#a8d0de" opacity={0.8} transparent />
        </Box>
        {/* Tap */}
        <Cylinder args={[0.05, 0.05, 1.0, 8]} position={[0, 3.64+0.5, 0]}>
          <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
        </Cylinder>
      </group>
    );
  }

  // ── WC / Toilet ───────────────────────────────────────────────────────────
  if (n.includes('wc') || n.includes('toilet')) {
    return (
      <group position={[wx, 0, wz]}>
        {/* Cistern */}
        <Box args={[fw, 2.6, fd*0.28]} position={[0, 1.3, -fd*0.35]}>
          <meshStandardMaterial color="#f5f5f5" roughness={0.3} />
        </Box>
        {/* Pan */}
        <Box args={[fw, 1.6, fd*0.65]} position={[0, 0.8, fd*0.12]}>
          <meshStandardMaterial color="#f0f0f0" roughness={0.3} />
          <Edges color="#d0d0d0" />
        </Box>
        {/* Seat */}
        <Box args={[fw-0.1, 0.1, fd*0.6]} position={[0, 1.65, fd*0.12]}>
          <meshStandardMaterial color="#e8e8e8" />
        </Box>
      </group>
    );
  }

  // ── Bathtub ────────────────────────────────────────────────────────────────
  if (n.includes('bathtub') || n.includes('bath tub')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 2.0, fd]} position={[0, 1.0, 0]}>
          <meshStandardMaterial color="#f4f4f4" roughness={0.25} />
          <Edges color="#d0d0d0" />
        </Box>
        {/* Water */}
        <Box args={[fw-0.2, 1.3, fd-0.2]} position={[0, 1.05, 0]}>
          <meshStandardMaterial color="#a0c8dc" opacity={0.55} transparent />
        </Box>
        <Cylinder args={[0.07, 0.07, 0.9, 8]} position={[fw/2-0.25, 2.5, -fd/4]}>
          <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
        </Cylinder>
      </group>
    );
  }

  // ── Shower ─────────────────────────────────────────────────────────────────
  if (n.includes('shower')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.18, fd]} position={[0, 0.09, 0]}>
          <meshStandardMaterial color="#c4dcc4" roughness={0.3} />
        </Box>
        {/* Glass walls */}
        <Box args={[fw, ROOM_HEIGHT*0.78, 0.05]} position={[0, ROOM_HEIGHT*0.39, fd/2]}>
          <meshStandardMaterial color="#90b8c8" opacity={0.22} transparent />
        </Box>
        <Box args={[0.05, ROOM_HEIGHT*0.78, fd]} position={[-fw/2, ROOM_HEIGHT*0.39, 0]}>
          <meshStandardMaterial color="#90b8c8" opacity={0.22} transparent />
        </Box>
        {/* Shower head */}
        <Cylinder args={[0.18, 0.18, 0.07, 16]} position={[0, ROOM_HEIGHT*0.76, -fd*0.3]} rotation={[Math.PI/2, 0, 0]}>
          <meshStandardMaterial color="#c8c8c8" metalness={0.85} roughness={0.15} />
        </Cylinder>
        <Cylinder args={[0.04, 0.04, 0.7, 8]} position={[0, ROOM_HEIGHT*0.4+0.5, -fd/2+0.2]}>
          <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.2} />
        </Cylinder>
      </group>
    );
  }

  // ── TV Unit ────────────────────────────────────────────────────────────────
  if (n.includes('tv unit') || n.includes('tv')) {
    return (
      <group position={[wx, 0, wz]}>
        {/* Cabinet */}
        <Box args={[fw, 1.6, fd]} position={[0, 0.8, 0]}>
          <meshStandardMaterial color="#2a2a2a" roughness={0.4} />
        </Box>
        {/* TV screen */}
        <Box args={[fw-0.15, 3.2, 0.12]} position={[0, 1.6+1.6, -fd/2-0.07]}>
          <meshStandardMaterial color="#0a0a14" />
        </Box>
        {/* Screen glow */}
        <Box args={[fw-0.3, 2.9, 0.05]} position={[0, 1.6+1.6, -fd/2-0.1]}>
          <meshStandardMaterial color="#0a0a28" emissive="#080816" emissiveIntensity={0.5} />
        </Box>
      </group>
    );
  }

  // ── Bookshelf ──────────────────────────────────────────────────────────────
  if (n.includes('bookshelf') || n.includes('shelf')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 6.5, fd]} position={[0, 3.25, 0]}>
          <meshStandardMaterial color="#7a5a2a" roughness={0.4} />
          <Edges color="#5a3a10" />
        </Box>
        {[1.3, 2.7, 4.1, 5.4].map((sh, i) => (
          <Box key={i} args={[fw-0.1, 0.07, fd-0.05]} position={[0, sh, 0]}>
            <meshStandardMaterial color="#5a3a10" />
          </Box>
        ))}
      </group>
    );
  }

  // ── Washing Machine / Dryer ───────────────────────────────────────────────
  if (n.includes('washing machine') || n.includes('dryer')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, fd*2.2, fd]} position={[0, fd*1.1, 0]}>
          <meshStandardMaterial color="#e8e8e8" roughness={0.3} />
          <Edges color="#c8c8c8" />
        </Box>
        <Cylinder args={[fd*0.32, fd*0.32, 0.12, 20]} position={[0, fd*2.05, fd/2+0.07]} rotation={[Math.PI/2, 0, 0]}>
          <meshStandardMaterial color="#9ab0c0" roughness={0.3} />
        </Cylinder>
      </group>
    );
  }

  // ── Plant Pot ─────────────────────────────────────────────────────────────
  if (n.includes('plant') || n.includes('pot')) {
    return (
      <group position={[wx, 0, wz]}>
        <Cylinder args={[fw/2*0.65, fw/2, fd, 12]} position={[0, fd/2, 0]}>
          <meshStandardMaterial color="#8b4513" roughness={0.8} />
        </Cylinder>
        <Cylinder args={[fw/2*1.1, fw/2*0.8, fw*0.7, 10]} position={[0, fd+fw*0.35, 0]}>
          <meshStandardMaterial color="#228b22" roughness={0.9} />
        </Cylinder>
      </group>
    );
  }

  // ── Car ───────────────────────────────────────────────────────────────────
  if (n.includes('car')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 2.0, fd]} position={[0, 1.0, 0]}>
          <meshStandardMaterial color="#3355a0" roughness={0.4} />
        </Box>
        <Box args={[fw*0.7, 1.6, fd*0.52]} position={[0, 2.8, -fd*0.06]}>
          <meshStandardMaterial color="#2a4490" roughness={0.4} />
        </Box>
        {/* Wheels */}
        {([[-fw/2+1.1,-fd/2+1.1],[fw/2-1.1,-fd/2+1.1],[-fw/2+1.1,fd/2-1.1],[fw/2-1.1,fd/2-1.1]] as [number,number][]).map(([lx,lz],i) => (
          <Cylinder key={i} args={[0.7, 0.7, 0.5, 16]} rotation={[Math.PI/2, 0, 0]} position={[lx, 0.7, lz]}>
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </Cylinder>
        ))}
      </group>
    );
  }

  // ── Bench / Lounger ───────────────────────────────────────────────────────
  if (n.includes('bench') || n.includes('lounger')) {
    return (
      <group position={[wx, 0, wz]}>
        <Box args={[fw, 0.25, fd]} position={[0, 1.3, 0]}>
          <meshStandardMaterial color="#c0a070" roughness={0.6} />
        </Box>
        {([[-fw/2+0.15,-fd/2+0.15],[fw/2-0.15,-fd/2+0.15],[-fw/2+0.15,fd/2-0.15],[fw/2-0.15,fd/2-0.15]] as [number,number][]).map(([lx,lz],i) => (
          <Box key={i} args={[0.1, 1.3, 0.1]} position={[lx, 0.65, lz]}>
            <meshStandardMaterial color="#9a7840" roughness={0.6} />
          </Box>
        ))}
      </group>
    );
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  return (
    <Box args={[Math.max(fw, 0.5), 1.0, Math.max(fd, 0.5)]} position={[wx, 0.5, wz]}>
      <meshStandardMaterial color="#b0b8c4" opacity={0.6} transparent />
    </Box>
  );
}

// ── Room 3D ──────────────────────────────────────────────────────────────────
function Room3D({ room }: { room: Room }) {
  const n      = room.name.toLowerCase();
  const colors = getRoomColor(room.name);
  const cx     = room.x + room.width  / 2;
  const cz     = room.y + room.height / 2;

  // Staircase gets special treatment
  if (n.includes('stair')) {
    return (
      <>
        {/* Floor */}
        <mesh position={[cx, -0.02, cz]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[room.width, room.height]} />
          <meshStandardMaterial color={colors.floor} />
        </mesh>
        <Stairs3D room={room} />
        <Text
          position={[cx, ROOM_HEIGHT + 0.8, cz]}
          rotation={[-Math.PI/2, 0, 0]}
          fontSize={1.1}
          color="#666"
          anchorX="center" anchorY="middle"
        >
          {room.name}
        </Text>
      </>
    );
  }

  return (
    <group>
      {/* Floor slab */}
      <mesh position={[cx, -0.02, cz]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[room.width, room.height]} />
        <meshStandardMaterial color={colors.floor} />
      </mesh>

      {/* Walls — 4 faces */}
      {/* North */}
      <Box args={[room.width + WALL_T*2, ROOM_HEIGHT, WALL_T]} position={[cx, ROOM_HEIGHT/2, room.y]}>
        <meshStandardMaterial color={colors.wall} opacity={0.48} transparent />
        <Edges color="#9aa0a8" />
      </Box>
      {/* South */}
      <Box args={[room.width + WALL_T*2, ROOM_HEIGHT, WALL_T]} position={[cx, ROOM_HEIGHT/2, room.y + room.height]}>
        <meshStandardMaterial color={colors.wall} opacity={0.48} transparent />
        <Edges color="#9aa0a8" />
      </Box>
      {/* West */}
      <Box args={[WALL_T, ROOM_HEIGHT, room.height]} position={[room.x, ROOM_HEIGHT/2, cz]}>
        <meshStandardMaterial color={colors.wall} opacity={0.48} transparent />
        <Edges color="#9aa0a8" />
      </Box>
      {/* East */}
      <Box args={[WALL_T, ROOM_HEIGHT, room.height]} position={[room.x + room.width, ROOM_HEIGHT/2, cz]}>
        <meshStandardMaterial color={colors.wall} opacity={0.48} transparent />
        <Edges color="#9aa0a8" />
      </Box>

      {/* Furniture items */}
      {room.furniture && room.furniture.map((item, i) => (
        <FurnitureItem3D key={i} item={item} roomX={room.x} roomY={room.y} />
      ))}

      {/* Room label (top-down) */}
      <Text
        position={[cx, ROOM_HEIGHT + 0.8, cz]}
        rotation={[-Math.PI/2, 0, 0]}
        fontSize={1.2}
        color="#333"
        anchorX="center" anchorY="middle"
        maxWidth={room.width * 0.9}
      >
        {room.name}
      </Text>
    </group>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function FloorPlan3D({ rooms }: FloorPlan3DProps) {
  if (!rooms || rooms.length === 0) return null;

  const minX = Math.min(...rooms.map(r => r.x));
  const minZ = Math.min(...rooms.map(r => r.y));
  const maxX = Math.max(...rooms.map(r => r.x + r.width));
  const maxZ = Math.max(...rooms.map(r => r.y + r.height));

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const maxDim  = Math.max(maxX - minX, maxZ - minZ);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', background: '#0d1117', borderRadius: '8px', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [centerX + maxDim * 0.55, maxDim * 1.05, centerZ + maxDim * 0.9], fov: 48 }}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#0d1117']} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[centerX + maxDim * 0.7, maxDim * 1.4, centerZ + maxDim * 0.7]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight
          position={[centerX - maxDim * 0.4, maxDim * 0.6, centerZ - maxDim * 0.3]}
          intensity={0.3}
        />

        <group>
          {rooms.map((room, i) => <Room3D key={i} room={room} />)}
        </group>

        <OrbitControls
          target={[centerX, ROOM_HEIGHT / 2, centerZ]}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={8}
          maxDistance={maxDim * 3.5}
          enableDamping
          dampingFactor={0.08}
        />
        <gridHelper
          args={[
            Math.ceil(maxDim * 1.6 / 10) * 10,
            Math.ceil(maxDim * 1.6 / 10),
            '#1e2a3a',
            '#111a24'
          ]}
          position={[centerX, -0.25, centerZ]}
        />
      </Canvas>
    </div>
  );
}
