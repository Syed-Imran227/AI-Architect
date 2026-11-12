import React from 'react';
import { 
  MousePointer2, 
  Hand, 
  Ruler, 
  Sun, 
  Route, 
  Maximize2, 
  ZoomIn, 
  ZoomOut,
  Armchair
} from 'lucide-react';

interface RayonFloatingToolbarProps {
  activeTool: 'select' | 'pan';
  onToolChange: (tool: 'select' | 'pan') => void;
  
  showDimensions: boolean;
  onToggleDimensions: () => void;
  
  showFurniture: boolean;
  onToggleFurniture: () => void;
  
  showSunlight: boolean;
  onToggleSunlight: () => void;
  
  showCirculation: boolean;
  onToggleCirculation: () => void;
  
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  
  activeFloorIndex: number;
  totalFloors: number;
  floorNames?: string[];
  onSelectFloor: (index: number) => void;
}

export const RayonFloatingToolbar: React.FC<RayonFloatingToolbarProps> = ({
  activeTool,
  onToolChange,
  showDimensions,
  onToggleDimensions,
  showFurniture,
  onToggleFurniture,
  showSunlight,
  onToggleSunlight,
  showCirculation,
  onToggleCirculation,
  onZoomIn,
  onZoomOut,
  onFitView,
  activeFloorIndex,
  totalFloors,
  floorNames,
  onSelectFloor,
}) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      userSelect: 'none',
    }}>
      {/* Multi-floor level selector (if multi-floor) */}
      {totalFloors > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#FAF8F2',
          border: '1px solid #E7E1D5',
          borderRadius: '24px',
          padding: '3px 4px',
          boxShadow: '0 4px 16px rgba(37, 38, 34, 0.08)',
          gap: '3px',
        }}>
          {Array.from({ length: totalFloors }).map((_, i) => {
            const isSelected = i === activeFloorIndex;
            const rawName = floorNames?.[i] || (i === 0 ? 'Ground Floor' : i === 1 ? 'First Floor' : `Level ${i}`);
            const shortName = rawName.replace(/ Floor/i, '').trim();
            const label = `L${i} · ${shortName}`;
            return (
              <button
                key={i}
                id={`btn-2d-floor-${i}`}
                onClick={() => onSelectFloor(i)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: 'none',
                  background: isSelected ? '#252622' : 'transparent',
                  color: isSelected ? '#FAF8F2' : '#777970',
                  fontSize: '0.72rem',
                  fontWeight: isSelected ? 700 : 500,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={`Switch to ${rawName} (Level ${i})`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Rayon Pill Dock */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#FAF8F2',
        border: '1px solid #E7E1D5',
        borderRadius: '28px',
        padding: '5px 8px',
        boxShadow: '0 8px 24px rgba(37, 38, 34, 0.10)',
        gap: '6px',
      }}>
        {/* Pointer / Select Tool */}
        <button
          onClick={() => onToolChange('select')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            background: activeTool === 'select' ? '#252622' : 'transparent',
            color: activeTool === 'select' ? '#FAF8F2' : '#474943',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Pointer / Selection Tool (V)"
        >
          <MousePointer2 size={16} />
        </button>

        {/* Pan Tool */}
        <button
          onClick={() => onToolChange('pan')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            background: activeTool === 'pan' ? '#252622' : 'transparent',
            color: activeTool === 'pan' ? '#FAF8F2' : '#474943',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Pan Workspace (H)"
        >
          <Hand size={16} />
        </button>

        <div style={{ width: '1px', height: '20px', background: '#E7E1D5', margin: '0 2px' }} />

        {/* Dimension Lines Toggle */}
        <button
          onClick={onToggleDimensions}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 11px',
            borderRadius: '16px',
            border: 'none',
            background: showDimensions ? 'rgba(54, 95, 168, 0.12)' : 'transparent',
            color: showDimensions ? '#365FA8' : '#474943',
            fontSize: '0.76rem',
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Toggle CAD Dimension Strings (D)"
        >
          <Ruler size={14} />
          <span>DIMS</span>
        </button>

        {/* Furniture Studio Toggle */}
        <button
          onClick={onToggleFurniture}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 11px',
            borderRadius: '16px',
            border: 'none',
            background: showFurniture ? '#252622' : 'transparent',
            color: showFurniture ? '#FAF8F2' : '#474943',
            fontSize: '0.76rem',
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Furniture & Lighting Layer (F)"
        >
          <Armchair size={14} />
          <span>FURNITURE</span>
        </button>

        {/* Solar Path Toggle */}
        <button
          onClick={onToggleSunlight}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 9px',
            borderRadius: '16px',
            border: 'none',
            background: showSunlight ? 'rgba(184, 154, 100, 0.16)' : 'transparent',
            color: showSunlight ? '#B89A64' : '#777970',
            fontSize: '0.72rem',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Passive Solar & Daylight Paths (S)"
        >
          <Sun size={13} />
          <span>SOLAR</span>
        </button>

        {/* Circulation Flow Toggle */}
        <button
          onClick={onToggleCirculation}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 9px',
            borderRadius: '16px',
            border: 'none',
            background: showCirculation ? 'rgba(67, 122, 93, 0.12)' : 'transparent',
            color: showCirculation ? '#437A5D' : '#777970',
            fontSize: '0.72rem',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Toggle Circulation & Egress Flows (C)"
        >
          <Route size={13} />
          <span>PATHS</span>
        </button>

        <div style={{ width: '1px', height: '18px', background: '#E7E1D5', margin: '0 2px' }} />

        {/* Zoom Controls */}
        <button
          onClick={onZoomOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: '#474943',
            cursor: 'pointer',
          }}
          title="Zoom Out"
        >
          <ZoomOut size={13} />
        </button>

        <button
          onClick={onFitView}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '14px',
            border: 'none',
            background: 'transparent',
            color: '#474943',
            fontSize: '0.7rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Zoom to Fit Canvas"
        >
          <Maximize2 size={12} />
          <span>FIT</span>
        </button>

        <button
          onClick={onZoomIn}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: '#474943',
            cursor: 'pointer',
          }}
          title="Zoom In"
        >
          <ZoomIn size={13} />
        </button>
      </div>

      {/* Scale indicator tag (bottom right of pill) */}
      <div style={{
        background: '#FAF8F2',
        border: '1px solid #E7E1D5',
        borderRadius: '18px',
        padding: '5px 10px',
        fontSize: '0.68rem',
        fontFamily: "'JetBrains Mono', monospace",
        color: '#474943',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(37, 38, 34, 0.06)',
      }}>
        1:50 [10 FT]
      </div>
    </div>
  );
};
