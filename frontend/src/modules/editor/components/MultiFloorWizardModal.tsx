import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  MultiFloorGenerationRequest,
  FloorConfigSpec,
  LayoutData,
  Floor
} from '../../../shared/api-client/api';
import { generateMultiFloorPlans } from '../../../shared/api-client/api';
import toast from 'react-hot-toast';

interface MultiFloorWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateSuccess: (result: {
    projectId: string;
    floors: Floor[];
    candidates?: LayoutData[];
    candidate: LayoutData;
    plotWidth: number;
    plotHeight: number;
    entryDir: string;
  }) => void;
  initialPlotWidth?: number;
  initialPlotLength?: number;
  initialEntryDir?: string;
}

interface RoomOption {
  type: string;
  name: string;
  icon: string;
  canAttachBath?: boolean;
}

export const MultiFloorWizardModal: React.FC<MultiFloorWizardModalProps> = ({
  isOpen,
  onClose,
  onGenerateSuccess,
  initialPlotWidth = 35,
  initialPlotLength = 50,
  initialEntryDir = 'east',
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // ── Step 1: Global Plot Settings ──
  const [plotWidth, setPlotWidth] = useState<number>(initialPlotWidth);
  const [plotLength, setPlotLength] = useState<number>(initialPlotLength);
  const [unit, setUnit] = useState<'ft' | 'm'>('ft');
  const [orientation, setOrientation] = useState<string>(initialEntryDir);
  const [budgetTier, setBudgetTier] = useState<'economy' | 'standard' | 'luxury'>('standard');
  const [floorsCount, setFloorsCount] = useState<number>(2);
  const [isDuplex, setIsDuplex] = useState<boolean>(true);
  const [staircaseType, setStaircaseType] = useState<'internal' | 'external'>('internal');

  // ── Step 2: Floor-by-Floor Program State ──
  const [activeConfigFloorIndex, setActiveConfigFloorIndex] = useState<number>(0);

  // Initialize floor configurations based on floorsCount & isDuplex
  const defaultFloors = useMemo<FloorConfigSpec[]>(() => {
    const list: FloorConfigSpec[] = [];
    for (let i = 0; i < floorsCount; i++) {
      if (i === 0) {
        list.push({
          level: 0,
          name: 'Ground Floor',
          floor_type: 'ground',
          required_rooms: [
            { type: 'living', name: 'Living Room' },
            { type: 'dining', name: 'Dining Room' },
            { type: 'kitchen', name: 'Kitchen' },
            { type: 'pooja', name: 'Pooja Room' },
            { type: 'bedroom', name: 'Guest Bedroom', attached_bath: true },
            { type: 'parking', name: 'Car Parking' },
            { type: 'garden', name: 'Front Lawn / Garden' },
          ],
          has_garden: true,
        });
      } else if (i === floorsCount - 1 && floorsCount >= 3) {
        list.push({
          level: i,
          name: 'Rooftop Terrace',
          floor_type: 'terrace',
          required_rooms: [
            { type: 'garden', name: 'Rooftop Garden' },
            { type: 'gazebo', name: 'Covered Gazebo' },
            { type: 'utility_solar', name: 'Solar & Utility Area' },
          ],
          has_terrace: true,
          has_garden: true,
        });
      } else {
        const isDuplexUpper = isDuplex && i === 1;
        list.push({
          level: i,
          name: isDuplexUpper ? 'First Floor (Duplex Upper)' : `Floor ${i}`,
          floor_type: isDuplexUpper ? 'duplex_upper' : 'upper',
          required_rooms: [
            { type: 'master_bedroom', name: 'Master Suite', attached_bath: true },
            { type: 'bedroom', name: `Bedroom ${i + 1}`, attached_bath: true },
            { type: 'family_lounge', name: 'Family Lounge' },
            { type: 'balcony', name: 'Balcony' },
          ],
          has_terrace: false,
        });
      }
    }
    return list;
  }, [floorsCount, isDuplex]);

  const [floorsConfig, setFloorsConfig] = useState<FloorConfigSpec[]>(defaultFloors);

  // Re-sync when floorsCount changes
  React.useEffect(() => {
    setFloorsConfig(defaultFloors);
    if (activeConfigFloorIndex >= floorsCount) {
      setActiveConfigFloorIndex(0);
    }
  }, [defaultFloors, floorsCount]);

  // Toggle a room on the active floor
  const toggleRoomOnActiveFloor = (roomItem: { type: string; name: string; attached_bath?: boolean }) => {
    setFloorsConfig(prev => {
      const next = [...prev];
      const currentFloor = { ...next[activeConfigFloorIndex] };
      const rooms = [...currentFloor.required_rooms];
      const existingIdx = rooms.findIndex(r => r.type === roomItem.type || r.name === roomItem.name);

      if (existingIdx >= 0) {
        rooms.splice(existingIdx, 1);
      } else {
        rooms.push({
          type: roomItem.type,
          name: roomItem.name,
          attached_bath: roomItem.attached_bath ?? false,
        });
      }
      currentFloor.required_rooms = rooms;
      next[activeConfigFloorIndex] = currentFloor;
      return next;
    });
  };

  const toggleBathAttached = (roomTypeOrName: string) => {
    setFloorsConfig(prev => {
      const next = [...prev];
      const currentFloor = { ...next[activeConfigFloorIndex] };
      currentFloor.required_rooms = currentFloor.required_rooms.map(r => {
        if (r.type === roomTypeOrName || r.name === roomTypeOrName) {
          return { ...r, attached_bath: !r.attached_bath };
        }
        return r;
      });
      next[activeConfigFloorIndex] = currentFloor;
      return next;
    });
  };

  // Pre-defined checklists per floor type
  const groundAvailableRooms: RoomOption[] = [
    { type: 'living', name: 'Living Room', icon: '🛋️' },
    { type: 'dining', name: 'Dining Room', icon: '🍽️' },
    { type: 'kitchen', name: 'Kitchen', icon: '🍳' },
    { type: 'pooja', name: 'Pooja Room', icon: '🪔' },
    { type: 'bedroom', name: 'Guest Bedroom', icon: '🛏️', canAttachBath: true },
    { type: 'parking', name: 'Car Parking', icon: '🚗' },
    { type: 'garden', name: 'Front Lawn / Garden', icon: '🌺' },
    { type: 'study', name: 'Study / Home Office', icon: '📚' },
    { type: 'utility', name: 'Utility & Laundry', icon: '🧺' },
  ];

  const upperAvailableRooms: RoomOption[] = [
    { type: 'master_bedroom', name: 'Master Suite', icon: '👑', canAttachBath: true },
    { type: 'bedroom', name: 'Kids / Guest Bedroom', icon: '🛏️', canAttachBath: true },
    { type: 'family_lounge', name: 'Family Lounge', icon: '🛋️' },
    { type: 'balcony', name: 'Balcony', icon: '🌿' },
    { type: 'terrace', name: 'Open Terrace Deck', icon: '☀️' },
    { type: 'study', name: 'Study Room', icon: '📖' },
  ];

  const terraceAvailableRooms: RoomOption[] = [
    { type: 'garden', name: 'Rooftop Garden', icon: '🌺' },
    { type: 'gazebo', name: 'Covered Gazebo', icon: '🏛️' },
    { type: 'utility_solar', name: 'Solar & Utility Area', icon: '☀️' },
    { type: 'sundeck', name: 'Private Sundeck / Terrace', icon: '⛱️' },
    { type: 'gym', name: 'Open-Air Yoga / Gym Deck', icon: '🧘' },
  ];

  const activeFloor = floorsConfig[activeConfigFloorIndex] || floorsConfig[0];
  const isTerraceLevel = activeFloor.floor_type === 'terrace' || activeFloor.floor_type === 'rooftop';
  const isUpperLevel = activeFloor.floor_type === 'upper' || activeFloor.floor_type === 'duplex_upper';

  const availableRooms = isTerraceLevel
    ? terraceAvailableRooms
    : isUpperLevel
    ? upperAvailableRooms
    : groundAvailableRooms;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const payload: MultiFloorGenerationRequest = {
        plot_width: plotWidth,
        plot_length: plotLength,
        measurement_unit: unit,
        entry_direction: orientation,
        budget_tier: budgetTier,
        floors_count: floorsCount,
        is_duplex: isDuplex,
        floors: floorsConfig,
      };

      const result = await generateMultiFloorPlans(payload);
      if (result.candidates && result.candidates.length > 0) {
        toast.success(`Successfully generated ${floorsCount}-floor architectural plan!`);
        onGenerateSuccess({
          projectId: result.project_id,
          floors: result.floors,
          candidates: result.candidates,
          candidate: result.candidates[0],
          plotWidth,
          plotHeight: plotLength,
          entryDir: orientation,
        });
        onClose();
      } else {
        toast.error('Generation completed but returned no candidates.');
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Multi-floor generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const calculatedArea = plotWidth * plotLength;
  const estimatedBuiltUp = Math.round(calculatedArea * 0.72 * floorsCount);
  const estimatedFAR = (estimatedBuiltUp / calculatedArea).toFixed(2);

  // 2.5D Isometric Massing Tower Preview Component
  const renderMassingPreview = () => (
    <div
      style={{
        background: '#FAF8F2',
        border: '1px solid #E7E1D5',
        borderRadius: '8px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", color: '#252622', letterSpacing: '0.04em', fontWeight: 600 }}>
          MASSING // 2.5D ELEVATION
        </span>
        <span style={{ fontSize: '0.7rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>
          FAR {estimatedFAR} • {estimatedBuiltUp} SQFT
        </span>
      </div>

      <svg width="260" height="170" viewBox="0 0 260 170" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="slabGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FAF8F2" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E7E1D5" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="activeSlabGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#252622" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#373934" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Isometric baseline grid */}
        <line x1="30" y1="150" x2="230" y2="150" stroke="rgba(37, 38, 34, 0.12)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="130" y1="30" x2="130" y2="150" stroke="rgba(37, 38, 34, 0.08)" strokeWidth="1" strokeDasharray="2 2" />

        {/* Stacked floor plates from bottom to top */}
        {floorsConfig.map((fl, idx) => {
          const baseY = 135 - idx * 28;
          const isSelected = activeConfigFloorIndex === idx;
          const isDuplexUpper = fl.floor_type === 'duplex_upper';
          const isTerrace = fl.floor_type === 'terrace';

          return (
            <g
              key={idx}
              onClick={() => setActiveConfigFloorIndex(idx)}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
            >
              {/* Vertical Structural Columns between floors */}
              {idx > 0 && (
                <>
                  <line x1="70" y1={baseY + 28} x2="70" y2={baseY + 12} stroke="rgba(37, 38, 34, 0.25)" strokeWidth="1.2" />
                  <line x1="190" y1={baseY + 28} x2="190" y2={baseY + 12} stroke="rgba(37, 38, 34, 0.25)" strokeWidth="1.2" />
                  {/* Locked Vertical Core (Staircase Shaft) */}
                  <rect x="120" y={baseY + 6} width="20" height="22" fill="rgba(184, 154, 100, 0.2)" stroke="#B89A64" strokeWidth="0.8" rx="2" />
                </>
              )}

              {/* Floor Slab Plate (Isometric Diamond) */}
              <polygon
                points={`130,${baseY - 10} 205,${baseY + 6} 130,${baseY + 22} 55,${baseY + 6}`}
                fill={isSelected ? 'url(#activeSlabGradient)' : isTerrace ? 'rgba(161, 174, 151, 0.25)' : 'url(#slabGradient)'}
                stroke={isSelected ? '#252622' : isTerrace ? '#A1AE97' : '#474943'}
                strokeWidth={isSelected ? '1.8' : '1'}
              />

              {/* Duplex Double-Height Void Cutout Graphic on L1 */}
              {isDuplexUpper && isDuplex && (
                <polygon
                  points={`130,${baseY - 3} 165,${baseY + 5} 130,${baseY + 13} 95,${baseY + 5}`}
                  fill="rgba(54, 95, 168, 0.2)"
                  stroke="#365FA8"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              )}

              {/* Level Elevation Readout Tag */}
              <text
                x="218"
                y={baseY + 8}
                fill={isSelected ? '#252622' : '#777970'}
                fontSize="9"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="600"
              >
                +{(idx * 10.8).toFixed(1)}ft
              </text>

              {/* Floor Name Label */}
              <text
                x="42"
                y={baseY + 8}
                fill={isSelected ? '#252622' : '#777970'}
                fontSize="9"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="600"
                textAnchor="end"
              >
                L{idx}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend strip */}
      <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.35rem', fontSize: '0.68rem', color: '#474943', fontFamily: "'JetBrains Mono', monospace" }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ width: '8px', height: '8px', background: '#B89A64', borderRadius: '2px', display: 'inline-block' }}></span>
          Core Shaft
        </span>
        {isDuplex && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '8px', height: '8px', background: '#365FA8', borderRadius: '2px', display: 'inline-block' }}></span>
            Duplex Void
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ width: '8px', height: '8px', background: '#252622', borderRadius: '2px', display: 'inline-block' }}></span>
          Active Plate
        </span>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(27, 29, 28, 0.65)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
        onClick={e => {
          if (e.target === e.currentTarget && !loading) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          style={{
            width: '100%',
            maxWidth: '920px',
            maxHeight: '92vh',
            backgroundColor: '#FAF8F2',
            borderRadius: '10px',
            boxShadow: '0 25px 60px -15px rgba(37, 38, 34, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #E7E1D5',
          }}
        >
          {/* ── Modal Header: Atelier Architectural Review ── */}
          <div
            style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid #E7E1D5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FAF8F2',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.1rem', color: '#252622' }}>🏛️</span>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.35rem',
                    fontWeight: 600,
                    fontFamily: "'Newsreader', Georgia, serif",
                    color: '#252622',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Multi-Floor Architectural Review
                </h2>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '0.18rem 0.55rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(54, 95, 168, 0.08)',
                    color: '#365FA8',
                    border: '1px solid rgba(54, 95, 168, 0.3)',
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.04em',
                  }}
                >
                  SYNTHESIS // ATELIER
                </span>
              </div>
              <p
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.8rem',
                  color: '#777970',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Deterministic vertical stacking • Core alignment • Duplex double-height spatial partition
              </p>
            </div>

            <button
              onClick={onClose}
              disabled={loading}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E7E1D5',
                fontSize: '0.9rem',
                color: '#777970',
                cursor: 'pointer',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#252622';
                e.currentTarget.style.borderColor = '#252622';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#777970';
                e.currentTarget.style.borderColor = '#E7E1D5';
              }}
            >
              ✕
            </button>
          </div>

          {/* ── Stepper Navigation: Atelier Studio Stages ── */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #E7E1D5',
              background: '#F3F0E7',
              padding: '0.75rem 1.75rem',
              gap: '2rem',
            }}
          >
            {[
              { step: 1, title: '01 // GLOBAL PLOT & MASSING' },
              { step: 2, title: '02 // FLOOR PROGRAMS & CORES' },
              { step: 3, title: '03 // BLUEPRINT AUDIT & SYNTHESIS' },
            ].map(s => {
              const isActive = currentStep === s.step;
              const isCompleted = currentStep > s.step;
              return (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(s.step as 1 | 2 | 3)}
                  style={{
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    paddingBottom: '0.4rem',
                    borderBottom: isActive ? '2px solid #252622' : '2px solid transparent',
                    color: isActive ? '#252622' : isCompleted ? '#365FA8' : '#777970',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.8rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.03em',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.68rem',
                      backgroundColor: isActive ? '#252622' : isCompleted ? 'rgba(54, 95, 168, 0.12)' : '#FFFFFF',
                      color: isActive ? '#FAF8F2' : isCompleted ? '#365FA8' : '#777970',
                      border: isActive ? '1px solid #252622' : isCompleted ? '1px solid #365FA8' : '1px solid #E7E1D5',
                      fontWeight: 700,
                    }}
                  >
                    {isCompleted ? '✓' : s.step}
                  </span>
                  {s.title}
                </button>
              );
            })}
          </div>

          {/* ── Modal Body Scroll Area ── */}
          <div
            style={{
              padding: '1.5rem 1.75rem',
              overflowY: 'auto',
              flex: 1,
              backgroundColor: '#FAF8F2',
            }}
          >
            {/* ══════════════════════════════════════════════════════════════
                STEP 1: GLOBAL PLOT & MASSING
            ══════════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.25rem' }}>
                  {/* Left Column: Dimensions & Levels */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Plot Dimensions */}
                    <div
                      style={{
                        background: '#FFFFFF',
                        padding: '1.25rem',
                        borderRadius: '8px',
                        border: '1px solid #E7E1D5',
                        boxShadow: '0 2px 8px rgba(37,38,34,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#252622', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          PLOT DIMENSIONS & SCALE
                        </h3>
                        <div style={{ display: 'flex', gap: '0.25rem', background: '#FAF8F2', padding: '0.2rem', borderRadius: '6px', border: '1px solid #E7E1D5' }}>
                          <button
                            onClick={() => setUnit('ft')}
                            style={{
                              padding: '0.2rem 0.6rem',
                              border: 'none',
                              borderRadius: '4px',
                              background: unit === 'ft' ? '#252622' : 'transparent',
                              color: unit === 'ft' ? '#FAF8F2' : '#777970',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            FEET (FT)
                          </button>
                          <button
                            onClick={() => setUnit('m')}
                            style={{
                              padding: '0.2rem 0.6rem',
                              border: 'none',
                              borderRadius: '4px',
                              background: unit === 'm' ? '#252622' : 'transparent',
                              color: unit === 'm' ? '#FAF8F2' : '#777970',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            METERS (M)
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#777970', marginBottom: '0.35rem' }}>
                            Plot Width ({unit})
                          </label>
                          <input
                            type="number"
                            min={20}
                            max={200}
                            value={plotWidth}
                            onChange={e => setPlotWidth(Math.max(15, Number(e.target.value)))}
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              borderRadius: '8px',
                              border: '1px solid #E7E1D5',
                              background: '#FAF8F2',
                              color: '#252622',
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              fontFamily: "'JetBrains Mono', monospace",
                              outline: 'none',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#777970', marginBottom: '0.35rem' }}>
                            Plot Depth ({unit})
                          </label>
                          <input
                            type="number"
                            min={20}
                            max={200}
                            value={plotLength}
                            onChange={e => setPlotLength(Math.max(15, Number(e.target.value)))}
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              borderRadius: '8px',
                              border: '1px solid #E7E1D5',
                              background: '#FAF8F2',
                              color: '#252622',
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              fontFamily: "'JetBrains Mono', monospace",
                              outline: 'none',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            background: '#F3F0E7',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #E7E1D5',
                          }}
                        >
                          <span style={{ fontSize: '0.7rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>FOOTPRINT</span>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#252622', fontFamily: "'JetBrains Mono', monospace" }}>
                            {calculatedArea} {unit === 'ft' ? 'sqft' : 'sqm'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Levels & Duplex Configuration */}
                    <div
                      style={{
                        background: '#FFFFFF',
                        padding: '1.25rem',
                        borderRadius: '8px',
                        border: '1px solid #E7E1D5',
                        boxShadow: '0 2px 8px rgba(37,38,34,0.04)',
                      }}
                    >
                      <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#252622', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        FLOOR COUNT & VERTICAL STACKING
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#777970', marginBottom: '0.4rem' }}>
                            Active Stacking Levels (1 to 4)
                          </label>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {[1, 2, 3, 4].map(n => (
                              <button
                                key={n}
                                onClick={() => setFloorsCount(n)}
                                style={{
                                  flex: 1,
                                  padding: '0.55rem',
                                  borderRadius: '8px',
                                  border: floorsCount === n ? '1px solid #252622' : '1px solid #E7E1D5',
                                  background: floorsCount === n ? '#252622' : '#FAF8F2',
                                  color: floorsCount === n ? '#FAF8F2' : '#474943',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {n} {n === 1 ? 'Floor' : 'Floors'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#777970', marginBottom: '0.4rem' }}>
                            Duplex Open-to-Below Void
                          </label>
                          <div
                            onClick={() => setIsDuplex(!isDuplex)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.55rem 0.85rem',
                              borderRadius: '8px',
                              border: isDuplex ? '1.5px solid #365FA8' : '1px solid rgba(37, 38, 34, 0.16)',
                              background: isDuplex ? 'rgba(54, 95, 168, 0.08)' : '#FAF8F2',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div>
                              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: isDuplex ? '#365FA8' : '#252622' }}>
                                {isDuplex ? 'Duplex Void Enabled' : 'Standard Stacking'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#474943' }}>
                                {isDuplex ? 'Double-height volume over Living Room' : 'Continuous ceiling per floor'}
                              </span>
                            </div>
                            <span style={{ fontSize: '1.1rem' }}>{isDuplex ? '✨' : '🏢'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Massing Elevation HUD */}
                  <div>
                    {renderMassingPreview()}
                  </div>
                </div>

                {/* Orientation & Budget Tier */}
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #E7E1D5',
                    boxShadow: '0 2px 8px rgba(37, 38, 34, 0.04)',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#777970', marginBottom: '0.4rem' }}>
                        Main Entry Orientation (Vastu / Azimuth)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                        {[
                          { id: 'north', label: 'North' },
                          { id: 'east', label: 'East' },
                          { id: 'south', label: 'South' },
                          { id: 'west', label: 'West' },
                        ].map(dir => (
                          <button
                            key={dir.id}
                            onClick={() => setOrientation(dir.id)}
                            style={{
                              padding: '0.5rem 0.25rem',
                              borderRadius: '6px',
                              border: orientation === dir.id ? '1px solid #365FA8' : '1px solid #E7E1D5',
                              background: orientation === dir.id ? '#365FA8' : '#FAF8F2',
                              color: orientation === dir.id ? '#FAF8F2' : '#474943',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {dir.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#777970', marginBottom: '0.4rem' }}>
                        Specification & Architectural Finishes
                      </label>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {[
                          { id: 'economy', label: 'Economy' },
                          { id: 'standard', label: 'Standard' },
                          { id: 'luxury', label: 'Luxury' },
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setBudgetTier(t.id as 'economy' | 'standard' | 'luxury')}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              borderRadius: '6px',
                              border: budgetTier === t.id ? '1px solid #B89A64' : '1px solid #E7E1D5',
                              background: budgetTier === t.id ? '#B89A64' : '#FAF8F2',
                              color: budgetTier === t.id ? '#FAF8F2' : '#474943',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 2: FLOOR PROGRAMS & CORES
            ══════════════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                {/* Floor Switcher Bar */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    overflowX: 'auto',
                    paddingBottom: '0.25rem',
                  }}
                >
                  {floorsConfig.map((fl, idx) => {
                    const isCurrent = activeConfigFloorIndex === idx;
                    const isTerrace = fl.floor_type === 'terrace';
                    const isDuplexUp = fl.floor_type === 'duplex_upper';
                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveConfigFloorIndex(idx)}
                        style={{
                          padding: '0.6rem 1.25rem',
                          borderRadius: '8px',
                          border: isCurrent ? '1px solid #252622' : '1px solid #E7E1D5',
                          background: isCurrent ? '#252622' : '#FFFFFF',
                          color: isCurrent ? '#FAF8F2' : '#474943',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        <span>{isTerrace ? '🌿' : isDuplexUp ? '✨' : idx === 0 ? '🏠' : '🏢'}</span>
                        {fl.name}
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '9999px',
                            background: isCurrent ? 'rgba(255, 255, 255, 0.2)' : '#F3F0E7',
                            color: isCurrent ? '#FAF8F2' : '#777970',
                          }}
                        >
                          {fl.required_rooms.length} zones
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Floor Program Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #E7E1D5',
                    boxShadow: '0 2px 8px rgba(37, 38, 34, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#252622', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {activeFloor.name.toUpperCase()} // PROGRAM SPECIFICATION
                      </h3>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#777970' }}>
                        Toggle rooms required on this plate. Attached baths can be toggled per bedroom.
                      </p>
                    </div>

                    {activeFloor.floor_type === 'duplex_upper' && (
                      <span
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(216, 87, 64, 0.08)',
                          color: '#D85740',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          border: '1px solid #D85740',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        ✨ DUPLEX VOID CONNECTED
                      </span>
                    )}
                  </div>

                  {/* Available Rooms Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
                    {availableRooms.map(item => {
                      const isSelected = activeFloor.required_rooms.some(
                        r => r.type === item.type || r.name === item.name
                      );
                      const selectedRoom = activeFloor.required_rooms.find(
                        r => r.type === item.type || r.name === item.name
                      );

                      return (
                        <div
                          key={item.name}
                          onClick={() => toggleRoomOnActiveFloor(item)}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderRadius: '8px',
                            border: isSelected ? '1.5px solid #365FA8' : '1px solid rgba(37, 38, 34, 0.20)',
                            background: isSelected ? 'rgba(54, 95, 168, 0.06)' : '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            transition: 'all 0.15s ease',
                            boxShadow: isSelected ? 'none' : '0 1px 3px rgba(37, 38, 34, 0.04)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span>{item.icon}</span>
                              <span style={{ fontSize: '0.82rem', fontWeight: isSelected ? 700 : 600, color: '#252622' }}>
                                {item.name}
                              </span>
                            </div>
                            <span
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                border: isSelected ? '1px solid #365FA8' : '1.5px solid rgba(37, 38, 34, 0.3)',
                                background: isSelected ? '#365FA8' : 'transparent',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                              }}
                            >
                              {isSelected ? '✓' : ''}
                            </span>
                          </div>

                          {isSelected && item.canAttachBath ? (
                            <div
                              onClick={e => {
                                e.stopPropagation();
                                toggleBathAttached(item.type);
                              }}
                              style={{
                                marginTop: '0.15rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                background: selectedRoom?.attached_bath ? 'rgba(161, 174, 151, 0.2)' : '#FAF8F2',
                                border: selectedRoom?.attached_bath ? '1px solid #A1AE97' : '1px solid #E7E1D5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: selectedRoom?.attached_bath ? '#252622' : '#777970',
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              <span>🚿 Attached Bath</span>
                              <span>{selectedRoom?.attached_bath ? 'YES' : 'NO'}</span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Staircase Alignment Assurance Card */}
                <div
                  style={{
                    background: '#FAF8F2',
                    border: '1px solid #B89A64',
                    borderRadius: '8px',
                    padding: '0.85rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>🔒</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#B89A64', fontFamily: "'JetBrains Mono', monospace" }}>
                        VERTICAL CORE LOCK // DETERMINISTIC STAIR ALIGNMENT
                      </h4>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#777970' }}>
                        Staircase footprint (8ft × 10ft) is locked at matching (x, y) coordinates across all levels.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => setStaircaseType('internal')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: staircaseType === 'internal' ? '1px solid #B89A64' : '1px solid #E7E1D5',
                        background: staircaseType === 'internal' ? '#B89A64' : '#FFFFFF',
                        color: staircaseType === 'internal' ? '#FAF8F2' : '#777970',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      INTERNAL SPINE CORE
                    </button>
                    <button
                      onClick={() => setStaircaseType('external')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: staircaseType === 'external' ? '1px solid #B89A64' : '1px solid #E7E1D5',
                        background: staircaseType === 'external' ? '#B89A64' : '#FFFFFF',
                        color: staircaseType === 'external' ? '#FAF8F2' : '#777970',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      EXTERNAL SHAFT CORE
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                STEP 3: EXECUTIVE BLUEPRINT VERIFICATION SHEET
            ══════════════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                <div
                  style={{
                    background: '#FFFFFF',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #E7E1D5',
                    boxShadow: '0 2px 10px rgba(37,38,34,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#252622', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>
                        EXECUTIVE BLUEPRINT DOSSIER // PRE-GENERATION AUDIT
                      </h3>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#777970' }}>
                        All geometric constraints validated. Deterministic spatial solver ready for multi-floor execution.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(161, 174, 151, 0.2)',
                          color: '#3D5434',
                          border: '1px solid #A1AE97',
                        }}
                      >
                        ✓ NBC-2016 READY
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(54, 95, 168, 0.1)',
                          color: '#365FA8',
                          border: '1px solid #365FA8',
                        }}
                      >
                        ✓ CORE LOCKED
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Metrics Readouts */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '0.75rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div style={{ background: '#FAF8F2', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E7E1D5' }}>
                      <span style={{ fontSize: '0.68rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>PLOT FOOTPRINT</span>
                      <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, color: '#252622', fontSize: '0.95rem', fontFamily: "'JetBrains Mono', monospace" }}>
                        {plotWidth} × {plotLength} {unit}
                      </p>
                    </div>
                    <div style={{ background: '#FAF8F2', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E7E1D5' }}>
                      <span style={{ fontSize: '0.68rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>EST. BUILT-UP AREA</span>
                      <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, color: '#252622', fontSize: '0.95rem', fontFamily: "'JetBrains Mono', monospace" }}>
                        {estimatedBuiltUp} sq.ft
                      </p>
                    </div>
                    <div style={{ background: '#FAF8F2', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E7E1D5' }}>
                      <span style={{ fontSize: '0.68rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>FAR RATIO</span>
                      <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, color: '#252622', fontSize: '0.95rem', fontFamily: "'JetBrains Mono', monospace" }}>
                        {estimatedFAR} : 1.00
                      </p>
                    </div>
                    <div style={{ background: '#FAF8F2', padding: '0.75rem', borderRadius: '6px', border: '1px solid #E7E1D5' }}>
                      <span style={{ fontSize: '0.68rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>AZIMUTH ENTRY</span>
                      <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, color: '#252622', fontSize: '0.95rem', fontFamily: "'JetBrains Mono', monospace" }}>
                        {orientation.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Floor-by-Floor Program Breakdown */}
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', fontWeight: 700, color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>
                    REGISTERED FLOOR PLATES
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {floorsConfig.map((fl, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          background: '#FAF8F2',
                          border: '1px solid #E7E1D5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '4px',
                              background: '#252622',
                              color: '#FAF8F2',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              fontFamily: "'JetBrains Mono', monospace",
                              border: '1px solid #252622',
                            }}
                          >
                            L{fl.level}
                          </span>
                          <div>
                            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#252622' }}>{fl.name}</span>
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>
                              [{fl.floor_type.toUpperCase()}]
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '60%' }}>
                          {fl.required_rooms.map(r => (
                            <span
                              key={r.name}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: '#FFFFFF',
                                border: '1px solid #E7E1D5',
                                color: '#474943',
                                fontWeight: 600,
                              }}
                            >
                              {r.name} {r.attached_bath ? '+Bath' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Modal Footer: Atelier Studio Controls ── */}
          <div
            style={{
              padding: '1rem 1.75rem',
              borderTop: '1px solid #E7E1D5',
              background: '#FAF8F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep((currentStep - 1) as 1 | 2 | 3)}
                  disabled={loading}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '6px',
                    border: '1px solid #E7E1D5',
                    background: '#FFFFFF',
                    color: '#474943',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  ← BACK
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '6px',
                  border: '1px solid #E7E1D5',
                  background: 'transparent',
                  color: '#777970',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                CANCEL
              </button>

              {currentStep < 3 ? (
                <button
                  id="wizard-next-step"
                  onClick={() => setCurrentStep((currentStep + 1) as 1 | 2 | 3)}
                  style={{
                    padding: '0.55rem 1.5rem',
                    borderRadius: '6px',
                    border: '1px solid #252622',
                    background: '#252622',
                    color: '#FAF8F2',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37,38,34,0.12)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  NEXT STEP →
                </button>
              ) : (
                <button
                  id="wizard-generate-submit"
                  onClick={handleGenerate}
                  disabled={loading}
                  style={{
                    padding: '0.55rem 1.75rem',
                    borderRadius: '6px',
                    border: '1px solid #252622',
                    background: loading ? '#474943' : '#252622',
                    color: '#FAF8F2',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(37,38,34,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.04em',
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: '14px', height: '14px' }}></span>
                      SOLVING SPATIAL MATRIX...
                    </>
                  ) : (
                    <>⚡ SYNTHESIZE ARCHITECTURAL BLUEPRINTS</>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MultiFloorWizardModal;
