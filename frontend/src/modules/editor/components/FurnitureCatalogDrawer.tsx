import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getAllFurnitureAssets,
  type FurnitureAssetDefinition,
  type FurnitureCategory,
} from '../geometry/furnitureRegistry';
import { FurnitureThumbnail } from './FurnitureThumbnail';
import { FurnitureProductImage } from './FurnitureProductImage';
import {
  Search,
  X,
  Plus,
  GripVertical,
  Layers,
  Box,
  Compass,
  Check,
  LayoutGrid,
  List,
  Eye,
} from 'lucide-react';

interface FurnitureCatalogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: FurnitureAssetDefinition) => void;
  selectedRoomName?: string | null;
  activeFloorName?: string;
}

export const FurnitureCatalogDrawer: React.FC<FurnitureCatalogDrawerProps> = ({
  isOpen,
  onClose,
  onAddItem,
  selectedRoomName,
  activeFloorName = 'Ground floor',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FurnitureCategory | 'All'>('All');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [layoutStyle, setLayoutStyle] = useState<'grid' | 'list'>('grid');
  const [inspectingAsset, setInspectingAsset] = useState<FurnitureAssetDefinition | null>(null);
  const [recentlyPlacedId, setRecentlyPlacedId] = useState<string | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(440);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Responsive window listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut: close drawer or modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectingAsset) {
          setInspectingAsset(null);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, inspectingAsset]);

  const allAssets = useMemo(() => getAllFurnitureAssets(), []);

  // Filtered catalog assets
  const filteredItems = useMemo(() => {
    return allAssets.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allAssets, searchQuery, selectedCategory]);

  const handleAddItemWithFeedback = (item: FurnitureAssetDefinition) => {
    onAddItem(item);
    setRecentlyPlacedId(item.id);
    setTimeout(() => {
      setRecentlyPlacedId((prev) => (prev === item.id ? null : prev));
    }, 1500);
  };

  // Draggable width resizing handlers
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    const clamped = Math.max(340, Math.min(620, e.clientX));
    setDrawerWidth(clamped);
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!isResizing) return;
    setIsResizing(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const isSingleColGrid = drawerWidth < 400;

  // Category pills definition matching screenshot
  const categoryPills: Array<{ key: FurnitureCategory | 'All'; label: string }> = [
    { key: 'All', label: 'All' },
    { key: 'Living Room', label: 'Living' },
    { key: 'Bedroom', label: 'Bedroom' },
    { key: 'Kitchen & Dining', label: 'Kitchen' },
    { key: 'Bathroom', label: 'Bathroom' },
    { key: 'Outdoor / Terrace', label: 'Outdoor' },
    { key: 'Lighting Fixtures', label: 'Lighting' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Responsive backdrop on mobile */}
          {isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="furniture-drawer-backdrop"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(37, 38, 34, 0.45)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 48,
              }}
            />
          )}

          {/* Warm Architectural Design Toolkit Drawer */}
          <motion.div
            initial={{ x: -drawerWidth, opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -drawerWidth, opacity: 0 }}
            transition={isResizing ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${drawerWidth}px`,
              maxWidth: '95vw',
              background: '#FAF8F5',
              borderRight: '1px solid #E8E2D6',
              boxShadow: '12px 0 36px rgba(40, 36, 28, 0.08), 2px 0 8px rgba(0, 0, 0, 0.03)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              color: '#252622',
              userSelect: isResizing ? 'none' : 'auto',
            }}
          >
            {/* ── Draggable Resize Divider on Right Border ── */}
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              style={{
                position: 'absolute',
                top: 0,
                right: -6,
                width: '12px',
                height: '100%',
                cursor: 'col-resize',
                zIndex: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none',
              }}
              title="Drag to resize panel width (340px - 620px)"
            >
              <div
                style={{
                  width: '3px',
                  height: '48px',
                  borderRadius: '2px',
                  background: isResizing ? '#252622' : 'rgba(216, 210, 197, 0.7)',
                  transition: 'background 0.15s ease',
                }}
              />
            </div>

            {/* ── Drawer Header (Warm Editorial Style) ── */}
            <div
              style={{
                padding: '1.25rem 1.4rem 0.8rem 1.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#8E8B82',
                  }}
                >
                  YOUR DESIGN TOOLKIT
                </span>
                <button
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#777970',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#252622';
                    e.currentTarget.style.background = '#EFEAE1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#777970';
                    e.currentTarget.style.background = 'transparent';
                  }}
                  title="Close Library (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              <h2
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '1.22rem',
                  fontWeight: 700,
                  color: '#252622',
                  letterSpacing: '-0.02em',
                }}
              >
                Make it feel like home
              </h2>

              {/* Floor / Zone indicator tag */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.72rem',
                  color: '#777970',
                  marginTop: '2px',
                }}
              >
                <span>Level: <strong style={{ color: '#252622' }}>{activeFloorName}</strong></span>
                {selectedRoomName && (
                  <>
                    <span>•</span>
                    <span>Target: <strong style={{ color: '#365FA8' }}>{selectedRoomName}</strong></span>
                  </>
                )}
              </div>
            </div>

            {/* ── Search Bar ── */}
            <div style={{ padding: '0 1.4rem 0.75rem 1.4rem', flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  background: '#FFFFFF',
                  border: '1px solid #E8E2D6',
                  borderRadius: '10px',
                  padding: '0.52rem 0.85rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <Search size={15} color="#8E8B82" />
                <input
                  type="text"
                  placeholder="Find the perfect piece..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#252622',
                    fontSize: '0.82rem',
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#8E8B82',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* ── Category Filter Pills ── */}
            <div
              ref={categoryScrollRef}
              style={{
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                padding: '0 1.4rem 0.85rem 1.4rem',
                scrollbarWidth: 'none',
                flexShrink: 0,
              }}
            >
              {categoryPills.map(({ key, label }) => {
                const isSelected = selectedCategory === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '20px',
                      border: isSelected ? '1px solid #252622' : '1px solid #E8E2D6',
                      background: isSelected ? '#252622' : '#FFFFFF',
                      color: isSelected ? '#FAF8F5' : '#5A5850',
                      fontSize: '0.74rem',
                      fontWeight: isSelected ? 600 : 500,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 2px 6px rgba(37, 38, 34, 0.15)' : 'none',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#F3EFE6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#FFFFFF';
                      }
                    }}
                  >
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Section Title & Mode Bar ── */}
            <div
              style={{
                padding: '0 1.4rem 0.65rem 1.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#252622' }}>
                  {selectedCategory === 'All'
                    ? 'Thoughtful essentials'
                    : categoryPills.find((p) => p.key === selectedCategory)?.label || selectedCategory}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#8E8B82',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {filteredItems.length} items
                </span>
              </div>

              {/* View switchers (2D CAD / 3D Render & Grid / List) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* 2D CAD vs 3D */}
                <div
                  style={{
                    display: 'flex',
                    background: '#FFFFFF',
                    border: '1px solid #E8E2D6',
                    borderRadius: '6px',
                    padding: '2px',
                    gap: '2px',
                  }}
                >
                  <button
                    onClick={() => setViewMode('2d')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      border: 'none',
                      background: viewMode === '2d' ? '#252622' : 'transparent',
                      color: viewMode === '2d' ? '#FAF8F5' : '#777970',
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="2D CAD architectural plan symbols"
                  >
                    <Compass size={11} />
                    <span>2D</span>
                  </button>
                  <button
                    onClick={() => setViewMode('3d')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      border: 'none',
                      background: viewMode === '3d' ? '#252622' : 'transparent',
                      color: viewMode === '3d' ? '#FAF8F5' : '#777970',
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="3D perspective renders"
                  >
                    <Box size={11} />
                    <span>3D</span>
                  </button>
                </div>

                {/* Grid vs List */}
                <div
                  style={{
                    display: 'flex',
                    background: '#FFFFFF',
                    border: '1px solid #E8E2D6',
                    borderRadius: '6px',
                    padding: '2px',
                    gap: '2px',
                  }}
                >
                  <button
                    onClick={() => setLayoutStyle('grid')}
                    style={{
                      background: layoutStyle === 'grid' ? '#EFEAE1' : 'transparent',
                      color: layoutStyle === 'grid' ? '#252622' : '#8E8B82',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Grid view"
                  >
                    <LayoutGrid size={12} />
                  </button>
                  <button
                    onClick={() => setLayoutStyle('list')}
                    style={{
                      background: layoutStyle === 'list' ? '#EFEAE1' : 'transparent',
                      color: layoutStyle === 'list' ? '#252622' : '#8E8B82',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="List view"
                  >
                    <List size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Catalog Item Cards Container (Scrollable) ── */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 1.4rem 1.4rem 1.4rem',
              }}
            >
              {filteredItems.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3.5rem 1rem',
                    color: '#8E8B82',
                  }}
                >
                  <Layers size={28} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, color: '#252622' }}>
                    No pieces matching &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem' }}>
                    Try searching for sofa, chair, table, bed, cabinet, or plant
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    style={{
                      marginTop: '12px',
                      background: '#FFFFFF',
                      border: '1px solid #E8E2D6',
                      color: '#252622',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      padding: '5px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              ) : layoutStyle === 'grid' ? (
                /* ══════════════════════════════════════════════════════════════
                   GRID VIEW: 2-COLUMN ARCHITECTURAL TILES
                   ══════════════════════════════════════════════════════════════ */
                <motion.div
                  key={`grid-${selectedCategory}-${viewMode}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isSingleColGrid ? '1fr' : 'repeat(2, 1fr)',
                    gap: '12px',
                  }}
                >
                  {filteredItems.map((item) => {
                    const isRecentlyPlaced = recentlyPlacedId === item.id;
                    const dimLabelM = `${item.dimensions.widthM.toFixed(2)} × ${item.dimensions.depthM.toFixed(2)} m`;
                    const dimLabelFt = `${item.dimensions.widthFt} × ${item.dimensions.depthFt} ft`;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                          e.dataTransfer.setData('application/json', JSON.stringify(item));
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        style={{
                          background: '#FFFFFF',
                          border: isRecentlyPlaced ? '1px solid #16A34A' : '1px solid #ECE7DD',
                          borderRadius: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          cursor: 'grab',
                          boxShadow: isRecentlyPlaced
                            ? '0 0 14px rgba(22, 163, 74, 0.2)'
                            : '0 1px 4px rgba(0, 0, 0, 0.03)',
                          transition: 'all 0.18s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          if (!isRecentlyPlaced) {
                            e.currentTarget.style.borderColor = '#D4CDC0';
                            e.currentTarget.style.boxShadow = '0 6px 18px rgba(40, 36, 28, 0.08)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          if (!isRecentlyPlaced) {
                            e.currentTarget.style.borderColor = '#ECE7DD';
                            e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.03)';
                          }
                        }}
                      >
                        {/* Thumbnail Viewport (96px height) */}
                        <div
                          style={{
                            height: '96px',
                            background: '#FBF9F5',
                            borderBottom: '1px solid #F0ECE4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Drag affordance indicator */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 6,
                              left: 6,
                              color: '#B8B4AA',
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'grab',
                            }}
                            title="Drag directly onto floor plan"
                          >
                            <GripVertical size={13} />
                          </div>

                          {/* Quick spec inspector */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingAsset(item);
                            }}
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              background: '#FFFFFF',
                              border: '1px solid #E8E2D6',
                              borderRadius: '4px',
                              padding: '3px',
                              color: '#777970',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#252622';
                              e.currentTarget.style.borderColor = '#252622';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#777970';
                              e.currentTarget.style.borderColor = '#E8E2D6';
                            }}
                            title="Inspect dimensions & specifications"
                          >
                            <Eye size={12} />
                          </button>

                          {/* Visual Presentation (2D CAD vector or 3D) */}
                          <div
                            onClick={() => setInspectingAsset(item)}
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: '8px',
                            }}
                          >
                            {viewMode === '3d' ? (
                              <FurnitureProductImage assetId={item.id} width={120} height={80} />
                            ) : (
                              <FurnitureThumbnail assetId={item.id} width={80} height={64} darkMode={false} />
                            )}
                          </div>
                        </div>

                        {/* Card Information & Action */}
                        <div
                          style={{
                            padding: '0.65rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: '#252622',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={item.name}
                          >
                            {item.name}
                          </div>

                          {/* Dual units dimension readout */}
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#777970',
                              fontFamily: "'JetBrains Mono', monospace",
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {dimLabelM}
                          </div>

                          {/* Card Footer: Category tag & Add button */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginTop: '5px',
                              paddingTop: '5px',
                              borderTop: '1px solid #F4EFE6',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.62rem',
                                color: '#8E8B82',
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {dimLabelFt}
                            </span>

                            <button
                              onClick={() => handleAddItemWithFeedback(item)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: isRecentlyPlaced ? '#16A34A' : '#FAF8F5',
                                border: isRecentlyPlaced ? '1px solid #16A34A' : '1px solid #E8E2D6',
                                borderRadius: '5px',
                                padding: '2px 7px',
                                color: isRecentlyPlaced ? '#FFFFFF' : '#252622',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isRecentlyPlaced) {
                                  e.currentTarget.style.background = '#252622';
                                  e.currentTarget.style.color = '#FAF8F5';
                                  e.currentTarget.style.borderColor = '#252622';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isRecentlyPlaced) {
                                  e.currentTarget.style.background = '#FAF8F5';
                                  e.currentTarget.style.color = '#252622';
                                  e.currentTarget.style.borderColor = '#E8E2D6';
                                }
                              }}
                              title="Add to floor plan"
                            >
                              {isRecentlyPlaced ? (
                                <>
                                  <Check size={11} />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={11} />
                                  <span>Add</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              ) : (
                /* ══════════════════════════════════════════════════════════════
                   LIST VIEW: DETAILED ARCHITECTURAL SPEC LIST
                   ══════════════════════════════════════════════════════════════ */
                <motion.div
                  key={`list-${selectedCategory}-${viewMode}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  {filteredItems.map((item) => {
                    const isRecentlyPlaced = recentlyPlacedId === item.id;
                    const dimLabelM = `${item.dimensions.widthM.toFixed(2)} × ${item.dimensions.depthM.toFixed(2)} m`;
                    const dimLabelFt = `${item.dimensions.widthFt} × ${item.dimensions.depthFt} ft`;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                          e.dataTransfer.setData('application/json', JSON.stringify(item));
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        style={{
                          background: '#FFFFFF',
                          border: isRecentlyPlaced ? '1px solid #16A34A' : '1px solid #ECE7DD',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'grab',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isRecentlyPlaced) {
                            e.currentTarget.style.borderColor = '#D4CDC0';
                            e.currentTarget.style.background = '#FAF8F5';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isRecentlyPlaced) {
                            e.currentTarget.style.borderColor = '#ECE7DD';
                            e.currentTarget.style.background = '#FFFFFF';
                          }
                        }}
                      >
                        <div
                          style={{
                            width: '46px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#FBF9F5',
                            borderRadius: '5px',
                            border: '1px solid #E8E2D6',
                            flexShrink: 0,
                          }}
                        >
                          {viewMode === '3d' ? (
                            <FurnitureProductImage assetId={item.id} width={42} height={36} />
                          ) : (
                            <FurnitureThumbnail assetId={item.id} width={40} height={34} darkMode={false} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#252622' }}>
                            {item.name}
                          </div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              color: '#777970',
                              fontFamily: "'JetBrains Mono', monospace",
                              marginTop: '1px',
                            }}
                          >
                            {dimLabelM} · {dimLabelFt}
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddItemWithFeedback(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: isRecentlyPlaced ? '#16A34A' : '#252622',
                            border: 'none',
                            borderRadius: '5px',
                            padding: '4px 10px',
                            color: '#FAF8F5',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {isRecentlyPlaced ? <Check size={12} /> : <Plus size={12} />}
                          <span>{isRecentlyPlaced ? 'Added' : 'Add'}</span>
                        </button>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* ── Asset Specification Inspection Modal (Warm Architectural) ── */}
            {inspectingAsset && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setInspectingAsset(null)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(37, 38, 34, 0.45)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 80,
                  padding: '1rem',
                }}
              >
                <motion.div
                  initial={{ scale: 0.94, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.94, opacity: 0, y: 10 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: '480px',
                    background: '#FFFFFF',
                    border: '1px solid #E8E2D6',
                    borderRadius: '14px',
                    boxShadow: '0 20px 48px rgba(40, 36, 28, 0.15)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily: 'inherit',
                  }}
                >
                  {/* Modal Header */}
                  <div
                    style={{
                      padding: '1rem 1.4rem',
                      borderBottom: '1px solid #F0ECE4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#FAF8F5',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: '#8E8B82',
                        }}
                      >
                        ARCHITECTURAL SPECIFICATION
                      </span>
                      <h3 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#252622' }}>
                        {inspectingAsset.name}
                      </h3>
                    </div>
                    <button
                      onClick={() => setInspectingAsset(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#777970',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* High-res asset preview */}
                  <div
                    style={{
                      height: '180px',
                      background: '#FBF9F5',
                      borderBottom: '1px solid #F0ECE4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {viewMode === '3d' ? (
                      <FurnitureProductImage assetId={inspectingAsset.id} width={240} height={160} />
                    ) : (
                      <FurnitureThumbnail assetId={inspectingAsset.id} width={180} height={140} darkMode={false} />
                    )}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 12,
                        fontSize: '0.64rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#8E8B82',
                      }}
                    >
                      {viewMode === '3d' ? 'ISOMETRIC 3D CAD' : '2D PLAN CAD SYMBOL'}
                    </span>
                  </div>

                  {/* Spec Metadata */}
                  <div style={{ padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#5A5850', lineHeight: 1.5 }}>
                      {inspectingAsset.description}
                    </p>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '8px',
                        background: '#FAF8F5',
                        border: '1px solid #E8E2D6',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.72rem',
                      }}
                    >
                      <div>
                        <span style={{ color: '#8E8B82' }}>CATEGORY</span>
                        <div style={{ color: '#252622', fontWeight: 600, marginTop: '2px' }}>
                          {inspectingAsset.category}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#8E8B82' }}>IMPERIAL (FT)</span>
                        <div style={{ color: '#365FA8', fontWeight: 600, marginTop: '2px' }}>
                          {inspectingAsset.dimensions.widthFt} × {inspectingAsset.dimensions.depthFt} ft
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#8E8B82' }}>METRIC (M)</span>
                        <div style={{ color: '#252622', fontWeight: 600, marginTop: '2px' }}>
                          {inspectingAsset.dimensions.widthM.toFixed(2)} × {inspectingAsset.dimensions.depthM.toFixed(2)} m
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#8E8B82' }}>HEIGHT</span>
                        <div style={{ color: '#252622', fontWeight: 600, marginTop: '2px' }}>
                          {inspectingAsset.dimensions.heightFt} ft ({inspectingAsset.dimensions.heightM.toFixed(2)} m)
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#F6F3EB',
                        border: '1px solid #E8E2D6',
                        borderRadius: '6px',
                        padding: '0.65rem 0.85rem',
                        fontSize: '0.72rem',
                        color: '#5A5850',
                        lineHeight: 1.4,
                      }}
                    >
                      <strong style={{ color: '#252622' }}>Placement rule:</strong> Maintain standard clearance
                      from entryways and circulation paths. Snap flush against walls where appropriate.
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => {
                          handleAddItemWithFeedback(inspectingAsset);
                          setInspectingAsset(null);
                        }}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '0.65rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#252622',
                          color: '#FAF8F5',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={15} />
                        <span>Place Piece on Plan</span>
                      </button>
                      <button
                        onClick={() => setInspectingAsset(null)}
                        style={{
                          padding: '0.65rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid #E8E2D6',
                          background: '#FFFFFF',
                          color: '#777970',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FurnitureCatalogDrawer;
