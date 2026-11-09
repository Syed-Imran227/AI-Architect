import React from 'react';

interface FurnitureThumbnailProps {
  assetId: string;
  category?: string;
  width?: number;
  height?: number;
  accentColor?: string;
  darkMode?: boolean;
}

/**
 * FurnitureThumbnail
 * ============================================================================
 * Crisp, authentic architectural 2D plan CAD vector symbols for furniture catalog.
 * Renders dedicated top-down architectural blueprint drawings.
 * Zero emojis, zero external image latency, 100% scalable vector fidelity.
 * ============================================================================
 */
export const FurnitureThumbnail: React.FC<FurnitureThumbnailProps> = ({
  assetId,
  width = 54,
  height = 46,
  accentColor = '#365FA8',
  darkMode = false,
}) => {
  const ink = darkMode ? '#E2E8F0' : '#252622';
  const mutedInk = darkMode ? '#94A3B8' : '#777970';
  const fill = darkMode ? 'rgba(15, 23, 42, 0.85)' : '#FBF9F5';
  const woodFill = darkMode ? 'rgba(180, 130, 80, 0.25)' : 'rgba(196, 142, 88, 0.35)';
  const fabricFill = darkMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(195, 185, 172, 0.35)';
  const sanitaryFill = darkMode ? 'rgba(240, 249, 255, 0.3)' : 'rgba(235, 242, 248, 0.8)';
  const lightGlow = '#EAB308';

  const renderSymbol = () => {
    switch (assetId) {
      // ── Living Room ─────────────────────────────────────────────────────────
      case 'sofa_3_seater':
        return (
          <g>
            {/* Main sofa frame */}
            <rect x="6" y="12" width="48" height="22" rx="3" fill={fabricFill} stroke={ink} strokeWidth="1.6" />
            {/* Backrest cushion */}
            <rect x="8" y="14" width="44" height="6" rx="2" fill="none" stroke={mutedInk} strokeWidth="1.2" />
            {/* Armrests */}
            <rect x="6" y="14" width="5" height="20" rx="1.5" fill={fabricFill} stroke={ink} strokeWidth="1.3" />
            <rect x="49" y="14" width="5" height="20" rx="1.5" fill={fabricFill} stroke={ink} strokeWidth="1.3" />
            {/* 3 Seat divider lines */}
            <line x1="23.5" y1="20" x2="23.5" y2="34" stroke={mutedInk} strokeWidth="1.2" />
            <line x1="36.5" y1="20" x2="36.5" y2="34" stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      case 'sectional_l_shape':
        return (
          <g>
            {/* Main horizontal bench */}
            <path
              d="M 6 10 L 46 10 A 3 3 0 0 1 49 13 L 49 26 A 3 3 0 0 1 46 29 L 26 29 L 26 38 A 3 3 0 0 1 23 41 L 9 41 A 3 3 0 0 1 6 38 Z"
              fill={fabricFill}
              stroke={ink}
              strokeWidth="1.6"
            />
            {/* Backrest line */}
            <path d="M 9 14 L 46 14" fill="none" stroke={mutedInk} strokeWidth="1.2" />
            {/* Chaise cushion line */}
            <line x1="26" y1="26" x2="26" y2="40" stroke={mutedInk} strokeWidth="1.2" />
            <line x1="36" y1="14" x2="36" y2="29" stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      case 'armchair':
        return (
          <g>
            <rect x="14" y="10" width="28" height="26" rx="3" fill={fabricFill} stroke={ink} strokeWidth="1.6" />
            <rect x="14" y="12" width="5" height="24" rx="1.5" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="37" y="12" width="5" height="24" rx="1.5" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="19" y="12" width="18" height="6" rx="1.5" fill="none" stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      case 'coffee_table':
        return (
          <g>
            <rect x="10" y="14" width="36" height="18" rx="2" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            <rect x="15" y="17" width="26" height="12" rx="1" fill="none" stroke={mutedInk} strokeWidth="1" strokeDasharray="2 2" />
          </g>
        );

      case 'tv_console':
        return (
          <g>
            <rect x="6" y="18" width="44" height="10" rx="1.5" fill={fill} stroke={ink} strokeWidth="1.6" />
            {/* TV screen representation */}
            <line x1="12" y1="23" x2="44" y2="23" stroke={accentColor} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="9" cy="23" r="1.5" fill={accentColor} />
            <circle cx="47" cy="23" r="1.5" fill={accentColor} />
          </g>
        );

      case 'bookshelf':
        return (
          <g>
            <rect x="8" y="18" width="40" height="10" rx="1" fill={woodFill} stroke={ink} strokeWidth="1.5" />
            <line x1="18" y1="18" x2="18" y2="28" stroke={mutedInk} strokeWidth="1.2" />
            <line x1="28" y1="18" x2="28" y2="28" stroke={mutedInk} strokeWidth="1.2" />
            <line x1="38" y1="18" x2="38" y2="28" stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      // ── Bedroom ─────────────────────────────────────────────────────────────
      case 'bed_king':
        return (
          <g>
            {/* Nightstands */}
            <rect x="4" y="8" width="6" height="8" rx="1" fill={woodFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="46" y="8" width="6" height="8" rx="1" fill={woodFill} stroke={mutedInk} strokeWidth="1.2" />
            {/* Headboard */}
            <rect x="11" y="8" width="34" height="4" rx="1" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            {/* Mattress */}
            <rect x="11" y="12" width="34" height="30" rx="2" fill={fabricFill} stroke={ink} strokeWidth="1.6" />
            {/* Two pillows */}
            <rect x="13.5" y="14" width="13" height="7" rx="1.5" fill={fill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="29.5" y="14" width="13" height="7" rx="1.5" fill={fill} stroke={mutedInk} strokeWidth="1.2" />
            {/* Fold line */}
            <line x1="11" y1="30" x2="45" y2="30" stroke={mutedInk} strokeWidth="1" strokeDasharray="3 2" />
          </g>
        );

      case 'bed_queen':
        return (
          <g>
            <rect x="14" y="9" width="28" height="4" rx="1" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            <rect x="14" y="13" width="28" height="28" rx="2" fill={fabricFill} stroke={ink} strokeWidth="1.6" />
            <rect x="16" y="15" width="10" height="6.5" rx="1.5" fill={fill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="30" y="15" width="10" height="6.5" rx="1.5" fill={fill} stroke={mutedInk} strokeWidth="1.2" />
            <line x1="14" y1="29" x2="42" y2="29" stroke={mutedInk} strokeWidth="1" strokeDasharray="2 2" />
          </g>
        );

      case 'wardrobe_3_door':
        return (
          <g>
            <rect x="8" y="15" width="40" height="16" rx="1.5" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            <line x1="21.3" y1="15" x2="21.3" y2="31" stroke={mutedInk} strokeWidth="1.3" />
            <line x1="34.6" y1="15" x2="34.6" y2="31" stroke={mutedInk} strokeWidth="1.3" />
            {/* Door handles */}
            <line x1="19" y1="22" x2="19" y2="24" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" />
            <line x1="23.5" y1="22" x2="23.5" y2="24" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" />
            <line x1="32.5" y1="22" x2="32.5" y2="24" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        );

      case 'wardrobe_2_door':
        return (
          <g>
            <rect x="13" y="15" width="30" height="16" rx="1.5" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            <line x1="28" y1="15" x2="28" y2="31" stroke={mutedInk} strokeWidth="1.3" />
            <line x1="26" y1="22" x2="26" y2="24" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" />
            <line x1="30" y1="22" x2="30" y2="24" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        );

      case 'desk_study':
        return (
          <g>
            <rect x="10" y="14" width="36" height="18" rx="2" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            {/* Keyboard / Laptop pad */}
            <rect x="22" y="17" width="12" height="7" rx="1" fill="none" stroke={mutedInk} strokeWidth="1" />
            {/* Swivel chair circle */}
            <circle cx="28" cy="37" r="5" fill={fabricFill} stroke={ink} strokeWidth="1.4" />
            <path d="M 23 37 Q 28 32 33 37" fill="none" stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      case 'dressing_table':
        return (
          <g>
            <rect x="13" y="16" width="30" height="14" rx="1.5" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            {/* Mirror line */}
            <line x1="13" y1="16" x2="43" y2="16" stroke={accentColor} strokeWidth="2.4" />
            {/* Stool */}
            <rect x="23" y="33" width="10" height="7" rx="1.5" fill={fabricFill} stroke={ink} strokeWidth="1.3" />
          </g>
        );

      // ── Kitchen & Dining ────────────────────────────────────────────────────
      case 'dining_table_6':
        return (
          <g>
            {/* Table */}
            <rect x="13" y="15" width="30" height="16" rx="2" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            {/* Top 3 chairs */}
            <rect x="15" y="8" width="6.5" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="24.7" y="8" width="6.5" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="34.5" y="8" width="6.5" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            {/* Bottom 3 chairs */}
            <rect x="15" y="33" width="6.5" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="24.7" y="33" width="6.5" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="34.5" y="33" width="6.5" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      case 'dining_table_4':
        return (
          <g>
            <rect x="17" y="15" width="22" height="16" rx="2" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            <rect x="20" y="8" width="7" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="29" y="8" width="7" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="20" y="33" width="7" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <rect x="29" y="33" width="7" height="5" rx="1" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      case 'kitchen_island':
        return (
          <g>
            <rect x="8" y="13" width="40" height="20" rx="2" fill={fill} stroke={ink} strokeWidth="1.6" />
            {/* Prep sink */}
            <rect x="12" y="17" width="11" height="12" rx="1.5" fill="none" stroke={mutedInk} strokeWidth="1.2" />
            <circle cx="17.5" cy="23" r="1.5" fill={mutedInk} />
            {/* Stools on right */}
            <circle cx="43" cy="18" r="2.5" fill={woodFill} stroke={accentColor} strokeWidth="1" />
            <circle cx="43" cy="28" r="2.5" fill={woodFill} stroke={accentColor} strokeWidth="1" />
          </g>
        );

      case 'cooking_range':
        return (
          <g>
            <rect x="14" y="13" width="28" height="20" rx="1.5" fill={fill} stroke={ink} strokeWidth="1.6" />
            {/* 4 burners */}
            <circle cx="21" cy="18" r="3.2" fill="none" stroke="#F97316" strokeWidth="1.4" />
            <circle cx="35" cy="18" r="2.6" fill="none" stroke="#F97316" strokeWidth="1.4" />
            <circle cx="21" cy="28" r="2.6" fill="none" stroke="#F97316" strokeWidth="1.4" />
            <circle cx="35" cy="28" r="3.2" fill="none" stroke="#F97316" strokeWidth="1.4" />
          </g>
        );

      case 'refrigerator':
        return (
          <g>
            <rect x="14" y="12" width="28" height="22" rx="2" fill={fill} stroke={ink} strokeWidth="1.6" />
            <line x1="14" y1="18" x2="42" y2="18" stroke={mutedInk} strokeWidth="1.3" />
            <line x1="28" y1="18" x2="28" y2="34" stroke={mutedInk} strokeWidth="1.3" />
            {/* Handles */}
            <line x1="26.5" y1="21" x2="26.5" y2="25" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" />
            <line x1="29.5" y1="21" x2="29.5" y2="25" stroke={accentColor} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        );

      case 'sink_counter':
        return (
          <g>
            <rect x="10" y="13" width="36" height="20" rx="1.5" fill={fill} stroke={ink} strokeWidth="1.6" />
            {/* Dual basin */}
            <rect x="14" y="16" width="12" height="14" rx="2" fill="none" stroke={accentColor} strokeWidth="1.3" />
            <circle cx="20" cy="23" r="1.5" fill={accentColor} />
            <rect x="29" y="16" width="12" height="14" rx="2" fill="none" stroke={accentColor} strokeWidth="1.3" />
            <circle cx="35" cy="23" r="1.5" fill={accentColor} />
          </g>
        );

      // ── Bathroom ────────────────────────────────────────────────────────────
      case 'vanity_sink':
        return (
          <g>
            <rect x="12" y="14" width="32" height="18" rx="2" fill={sanitaryFill} stroke={ink} strokeWidth="1.6" />
            {/* Oval ceramic basin */}
            <ellipse cx="28" cy="23" rx="10" ry="6" fill="none" stroke={ink} strokeWidth="1.4" />
            <circle cx="28" cy="23" r="1.6" fill={mutedInk} />
            {/* Faucet */}
            <line x1="28" y1="15" x2="28" y2="19" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" />
          </g>
        );

      case 'toilet_wc':
        return (
          <g>
            {/* Cistern tank */}
            <rect x="17" y="10" width="22" height="8" rx="1.5" fill={sanitaryFill} stroke={ink} strokeWidth="1.5" />
            <circle cx="28" cy="14" r="1.4" fill={accentColor} />
            {/* Toilet bowl oval */}
            <path
              d="M 19 18 C 19 32 37 32 37 18 Z"
              fill={sanitaryFill}
              stroke={ink}
              strokeWidth="1.5"
            />
            <ellipse cx="28" cy="24" rx="5.5" ry="4" fill="none" stroke={mutedInk} strokeWidth="1" />
          </g>
        );

      case 'shower_enclosure':
        return (
          <g>
            {/* Glass stall */}
            <rect x="13" y="9" width="30" height="30" rx="1" fill={sanitaryFill} stroke={accentColor} strokeWidth="1.6" />
            {/* Center drain */}
            <circle cx="28" cy="24" r="2.8" fill="none" stroke={mutedInk} strokeWidth="1.2" />
            <circle cx="28" cy="24" r="1" fill={accentColor} />
            {/* Subtle hatch markings */}
            <line x1="15" y1="11" x2="21" y2="11" stroke={mutedInk} strokeWidth="0.8" />
            <line x1="15" y1="14" x2="18" y2="14" stroke={mutedInk} strokeWidth="0.8" />
          </g>
        );

      case 'bathtub':
        return (
          <g>
            <rect x="8" y="12" width="40" height="22" rx="8" fill={sanitaryFill} stroke={ink} strokeWidth="1.6" />
            <rect x="12" y="15" width="32" height="16" rx="6" fill="none" stroke={mutedInk} strokeWidth="1.2" />
            <circle cx="16" cy="23" r="1.6" fill={accentColor} />
          </g>
        );

      // ── Outdoor / Terrace ───────────────────────────────────────────────────
      case 'patio_lounge':
        return (
          <g>
            <rect x="9" y="10" width="38" height="26" rx="3" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            <rect x="18" y="16" width="20" height="14" rx="2" fill={fill} stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      case 'sunbed_lounger':
        return (
          <g>
            <rect x="18" y="8" width="20" height="32" rx="2" fill={fabricFill} stroke={ink} strokeWidth="1.5" />
            <rect x="20" y="10" width="16" height="7" rx="1.5" fill={fill} stroke={mutedInk} strokeWidth="1.2" />
            <line x1="18" y1="26" x2="38" y2="26" stroke={mutedInk} strokeWidth="1" strokeDasharray="2 2" />
          </g>
        );

      case 'bistro_table':
        return (
          <g>
            <circle cx="28" cy="23" r="8.5" fill={woodFill} stroke={ink} strokeWidth="1.6" />
            <circle cx="14" cy="23" r="3.5" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
            <circle cx="42" cy="23" r="3.5" fill={fabricFill} stroke={mutedInk} strokeWidth="1.2" />
          </g>
        );

      case 'planter_box':
        return (
          <g>
            <rect x="10" y="17" width="36" height="12" rx="2" fill={woodFill} stroke={ink} strokeWidth="1.5" />
            <circle cx="17" cy="23" r="3.8" fill="rgba(34, 197, 94, 0.35)" stroke="#22C55E" strokeWidth="1.2" />
            <circle cx="28" cy="23" r="4.2" fill="rgba(34, 197, 94, 0.45)" stroke="#22C55E" strokeWidth="1.2" />
            <circle cx="39" cy="23" r="3.8" fill="rgba(34, 197, 94, 0.35)" stroke="#22C55E" strokeWidth="1.2" />
          </g>
        );

      case 'bbq_grill':
        return (
          <g>
            <rect x="14" y="14" width="28" height="18" rx="3" fill={fill} stroke={ink} strokeWidth="1.6" />
            <line x1="17" y1="19" x2="39" y2="19" stroke={mutedInk} strokeWidth="1.2" />
            <line x1="17" y1="23" x2="39" y2="23" stroke={mutedInk} strokeWidth="1.2" />
            <line x1="17" y1="27" x2="39" y2="27" stroke={mutedInk} strokeWidth="1.2" />
            <circle cx="36" cy="16" r="1.2" fill="#F97316" />
          </g>
        );

      // ── Lighting Fixtures ───────────────────────────────────────────────────
      case 'chandelier_warm':
        return (
          <g>
            <circle cx="28" cy="23" r="11" fill="none" stroke={lightGlow} strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="28" cy="23" r="4.5" fill="rgba(254, 240, 138, 0.4)" stroke={lightGlow} strokeWidth="1.6" />
            {/* 4 arms */}
            <line x1="28" y1="12" x2="28" y2="34" stroke="#CA8A04" strokeWidth="1.5" />
            <line x1="17" y1="23" x2="39" y2="23" stroke="#CA8A04" strokeWidth="1.5" />
            <circle cx="28" cy="12" r="1.8" fill={lightGlow} />
            <circle cx="28" cy="34" r="1.8" fill={lightGlow} />
            <circle cx="17" cy="23" r="1.8" fill={lightGlow} />
            <circle cx="39" cy="23" r="1.8" fill={lightGlow} />
          </g>
        );

      case 'downlight_recessed':
        return (
          <g>
            <circle cx="28" cy="23" r="8" fill="none" stroke={lightGlow} strokeWidth="1.2" strokeDasharray="2 2" />
            <circle cx="28" cy="23" r="4.5" fill="rgba(254, 240, 138, 0.5)" stroke={ink} strokeWidth="1.6" />
            <circle cx="28" cy="23" r="1.5" fill={lightGlow} />
          </g>
        );

      case 'wall_sconce':
        return (
          <g>
            <rect x="25" y="10" width="6" height="4" rx="1" fill="#CA8A04" stroke={ink} strokeWidth="1.3" />
            <polygon points="28,14 20,28 36,28" fill="rgba(254, 240, 138, 0.3)" stroke={lightGlow} strokeWidth="1.2" />
          </g>
        );

      case 'floor_lamp':
        return (
          <g>
            {/* Round base */}
            <circle cx="28" cy="23" r="7" fill="none" stroke={mutedInk} strokeWidth="1.4" />
            {/* Shade circle */}
            <circle cx="28" cy="23" r="5" fill="rgba(254, 240, 138, 0.35)" stroke={lightGlow} strokeWidth="1.5" />
            <circle cx="28" cy="23" r="1.6" fill={lightGlow} />
          </g>
        );

      case 'terrace_lantern':
        return (
          <g>
            <rect x="22" y="17" width="12" height="12" rx="2" fill="rgba(254, 240, 138, 0.25)" stroke={ink} strokeWidth="1.5" />
            <line x1="28" y1="13" x2="28" y2="33" stroke={lightGlow} strokeWidth="1.4" />
            <line x1="18" y1="23" x2="38" y2="23" stroke={lightGlow} strokeWidth="1.4" />
            <circle cx="28" cy="23" r="2" fill={lightGlow} />
          </g>
        );

      // Default architectural fallback: crisp scaled drafting box with center cross
      default:
        return (
          <g>
            <rect x="14" y="12" width="28" height="22" rx="2" fill={fill} stroke={ink} strokeWidth="1.5" />
            <line x1="14" y1="12" x2="42" y2="34" stroke={mutedInk} strokeWidth="0.9" strokeDasharray="2 2" />
            <line x1="42" y1="12" x2="14" y2="34" stroke={mutedInk} strokeWidth="0.9" strokeDasharray="2 2" />
          </g>
        );
    }
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 56 46"
      style={{
        display: 'block',
        background: darkMode ? '#0B0F19' : '#FAF8F5',
        borderRadius: '6px',
        border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E8E2D6',
        boxShadow: darkMode ? 'inset 0 0 10px rgba(0, 0, 0, 0.5)' : 'none',
      }}
    >
      {/* Blueprint grid subtle background */}
      <defs>
        <pattern id="cadGrid" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M 6 0 L 0 0 0 6" fill="none" stroke={darkMode ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)"} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="56" height="46" fill="url(#cadGrid)" />

      {/* Render authentic CAD symbol */}
      {renderSymbol()}
    </svg>
  );
};

export default FurnitureThumbnail;
