import React, { useState } from 'react';
import { 
  Sliders, 
  ShieldCheck, 
  Sparkles, 
  ChevronRight,
  Trash2
} from 'lucide-react';
import type { Room, LayoutData, LayoutUpdatePayload, VastuResult, NbcResult, EnergyResult, SunlightResult, BomResult, FurnitureItem } from '../../../shared/api-client/api';
import RoomEditor from './RoomEditor';
import ComplianceSidebar from './ComplianceSidebar';
import { CopilotAgentPanel } from './CopilotAgentPanel';
import { FurnitureThumbnail } from './FurnitureThumbnail';

interface ArchitecturalInspectorDrawerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  selectedRoom: Room | null;
  selectedRoomIndex: number | null;
  allRooms: Room[];
  plotContext: {
    plotWidth: number;
    plotHeight: number;
    entryDir: string;
    bedrooms: number;
    bathrooms: number;
    floors: number;
    balcony: number;
    terrace: number;
    lift: number;
  };
  onRoomUpdate: (index: number, updated: Room) => void;
  onLayoutUpdate: (data: LayoutUpdatePayload, imageUrl?: string, targetFloor?: number) => void;
  onDeselectRoom: () => void;
  
  // Compliance
  vastuScore: number;
  vastuResult?: VastuResult;
  nbcResult?: NbcResult;
  energyResult?: EnergyResult;
  sunlightResult?: SunlightResult;
  bomResult?: BomResult;
  layoutData: Record<string, unknown>;
  onVastuUpdate?: (res: VastuResult, score: number) => void;
  onNbcUpdate?: (res: NbcResult, score: number) => void;
  onAutoSaveRequest?: () => void;
  
  // Copilot Agent
  activePlanId?: string;
  activeFloorIndex: number;
  activeFloorName?: string;
  onAgentLayoutUpdate: (
    updatedLayout: LayoutData,
    imageUrl?: string | null,
    compliance?: {
      vastu?: VastuResult;
      nbc?: NbcResult;
      energy?: EnergyResult;
      sunlight?: SunlightResult;
      bom?: BomResult;
    }
  ) => void;
  onPreviewCopilotProposal?: (candidateLayout: LayoutData) => void;
  onCancelCopilotPreview?: () => void;
  onApplyCopilotProposal?: (
    updatedLayout: LayoutData,
    imageUrl?: string | null,
    compliance?: any,
    changeSummary?: any
  ) => void;
  onUndoCopilot?: () => void;
  canUndo?: boolean;
  isPreviewingCopilot?: boolean;

  // Selected Furniture Item
  selectedFurniture?: FurnitureItem | null;
  onUpdateFurniture?: (updated: FurnitureItem) => void;
  onDeleteFurniture?: () => void;
  onDeselectFurniture?: () => void;
  onSelectRoom?: (room: Room, index: number) => void;
}

export const ArchitecturalInspectorDrawer: React.FC<ArchitecturalInspectorDrawerProps> = ({
  isOpen,
  onToggleOpen,
  selectedRoom,
  selectedRoomIndex,
  allRooms,
  plotContext,
  onRoomUpdate,
  onLayoutUpdate,
  onDeselectRoom,
  onSelectRoom,
  selectedFurniture,
  onUpdateFurniture,
  onDeleteFurniture,
  onDeselectFurniture,
  vastuScore,
  vastuResult,
  nbcResult,
  energyResult,
  sunlightResult,
  bomResult,
  layoutData,
  onVastuUpdate,
  onNbcUpdate,
  onAutoSaveRequest,
  activePlanId,
  activeFloorIndex,
  activeFloorName,
  onAgentLayoutUpdate,
  onPreviewCopilotProposal,
  onCancelCopilotPreview,
  onApplyCopilotProposal,
  onUndoCopilot,
  canUndo,
  isPreviewingCopilot,
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'compliance' | 'copilot'>('properties');

  // Auto switch to properties if a room is selected
  React.useEffect(() => {
    if (selectedRoomIndex !== null) {
      setActiveTab('properties');
    }
  }, [selectedRoomIndex]);

  return (
    <aside style={{
      width: isOpen ? '360px' : '0px',
      minWidth: isOpen ? '360px' : '0px',
      maxWidth: isOpen ? '360px' : '0px',
      height: '100%',
      background: '#FAF8F2',
      borderLeft: isOpen ? '1px solid #E7E1D5' : 'none',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 30,
      boxShadow: isOpen ? '-4px 0 20px rgba(37, 38, 34, 0.04)' : 'none',
    }}>
      {isOpen && (
        <div style={{ width: '360px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Inspector Header & Tabs */}
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #E7E1D5',
            background: '#F3F0E7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '3px' }}>
              <button
                onClick={() => setActiveTab('properties')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 9px',
                  borderRadius: '5px',
                  border: 'none',
                  background: activeTab === 'properties' ? '#FAF8F2' : 'transparent',
                  color: activeTab === 'properties' ? '#252622' : '#777970',
                  fontSize: '0.72rem',
                  fontWeight: activeTab === 'properties' ? 700 : 500,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                  boxShadow: activeTab === 'properties' ? '0 1px 3px rgba(37, 38, 34, 0.06)' : 'none',
                }}
              >
                <Sliders size={12} />
                <span>PROPERTIES</span>
              </button>

              <button
                onClick={() => setActiveTab('compliance')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 9px',
                  borderRadius: '5px',
                  border: 'none',
                  background: activeTab === 'compliance' ? '#FAF8F2' : 'transparent',
                  color: activeTab === 'compliance' ? '#252622' : '#777970',
                  fontSize: '0.72rem',
                  fontWeight: activeTab === 'compliance' ? 700 : 500,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                  boxShadow: activeTab === 'compliance' ? '0 1px 3px rgba(37, 38, 34, 0.06)' : 'none',
                }}
              >
                <ShieldCheck size={12} />
                <span>AUDIT</span>
              </button>

              <button
                onClick={() => setActiveTab('copilot')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 9px',
                  borderRadius: '5px',
                  border: 'none',
                  background: activeTab === 'copilot' ? '#FAF8F2' : 'transparent',
                  color: activeTab === 'copilot' ? '#D85740' : '#777970',
                  fontSize: '0.72rem',
                  fontWeight: activeTab === 'copilot' ? 700 : 500,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                  boxShadow: activeTab === 'copilot' ? '0 1px 3px rgba(37, 38, 34, 0.06)' : 'none',
                }}
              >
                <Sparkles size={12} />
                <span>COPILOT</span>
              </button>
            </div>

            {/* Collapse button */}
            <button
              onClick={onToggleOpen}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
                color: '#777970',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Collapse Inspector Drawer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Drawer Body Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {/* TAB 1: PROPERTIES */}
            {activeTab === 'properties' && (
              <div>
                {selectedFurniture ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0284C7' }}>
                        SELECTED OBJECT (FURNITURE)
                      </span>
                      <button
                        onClick={onDeselectFurniture}
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#777970',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        DESELECT
                      </button>
                    </div>

                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E7E1D5',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      boxShadow: '0 1px 3px rgba(37, 38, 34, 0.04)',
                    }}>
                      {/* Asset Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '48px', height: '42px', flexShrink: 0 }}>
                          <FurnitureThumbnail assetId={selectedFurniture.catalogId || ''} width={48} height={42} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#252622', fontWeight: 700 }}>
                            {selectedFurniture.name}
                          </h4>
                          <span style={{ fontSize: '0.68rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>
                            ID: {selectedFurniture.catalogId || 'custom_item'}
                          </span>
                        </div>
                      </div>

                      {/* Dimensions Controls */}
                      <div>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#474943', fontFamily: "'JetBrains Mono', monospace", display: 'block', marginBottom: '6px' }}>
                          OBJECT DIMENSIONS (FT)
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '0.65rem', color: '#777970', display: 'block', marginBottom: '2px' }}>Width</label>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={Math.round(selectedFurniture.width * 10) / 10}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0 && onUpdateFurniture) {
                                  onUpdateFurniture({ ...selectedFurniture, width: val });
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid #D8D2C4',
                                background: '#FAF8F2',
                                fontSize: '0.8rem',
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.65rem', color: '#777970', display: 'block', marginBottom: '2px' }}>Depth / Length</label>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={Math.round(selectedFurniture.height * 10) / 10}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0 && onUpdateFurniture) {
                                  onUpdateFurniture({ ...selectedFurniture, height: val });
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid #D8D2C4',
                                background: '#FAF8F2',
                                fontSize: '0.8rem',
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Rotation Controls */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#474943', fontFamily: "'JetBrains Mono', monospace" }}>
                            ROTATION ({selectedFurniture.rotation || 0}°)
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[0, 90, 180, 270].map((deg) => (
                            <button
                              key={deg}
                              onClick={() => {
                                if (onUpdateFurniture) onUpdateFurniture({ ...selectedFurniture, rotation: deg });
                              }}
                              style={{
                                flex: 1,
                                padding: '4px 0',
                                borderRadius: '4px',
                                border: (selectedFurniture.rotation || 0) === deg ? '1px solid #0284C7' : '1px solid #E7E1D5',
                                background: (selectedFurniture.rotation || 0) === deg ? '#E0F2FE' : '#FAF8F2',
                                color: (selectedFurniture.rotation || 0) === deg ? '#0284C7' : '#777970',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {deg}°
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              if (onUpdateFurniture) {
                                onUpdateFurniture({
                                  ...selectedFurniture,
                                  rotation: ((selectedFurniture.rotation || 0) + 45) % 360,
                                });
                              }
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #E7E1D5',
                              background: '#FAF8F2',
                              color: '#252622',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                            title="Rotate 45°"
                          >
                            +45°
                          </button>
                        </div>
                      </div>

                      {/* Delete Action */}
                      {onDeleteFurniture && (
                        <button
                          onClick={onDeleteFurniture}
                          style={{
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #FCA5A5',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: "'JetBrains Mono', monospace",
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Trash2 size={13} />
                          <span>DELETE OBJECT</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : selectedRoom && selectedRoomIndex !== null ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#D85740' }}>
                        SELECTED ROOM (ZONE)
                      </span>
                      <button
                        onClick={onDeselectRoom}
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#777970',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        DESELECT
                      </button>
                    </div>

                    <RoomEditor
                      room={selectedRoom}
                      index={selectedRoomIndex}
                      allRooms={allRooms}
                      plotContext={plotContext}
                      onRoomUpdate={onRoomUpdate}
                      onLayoutUpdate={(data, img) => onLayoutUpdate(data, img)}
                      onClose={onDeselectRoom}
                    />
                  </div>
                ) : (
                  <div>
                    <div style={{
                      padding: '1.25rem',
                      background: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E7E1D5',
                      marginBottom: '1rem',
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>
                        FLOOR PLAN OVERVIEW
                      </div>
                      <h4 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '1.2rem', margin: '4px 0 8px 0', color: '#252622' }}>
                        {activeFloorName || 'Ground Floor'}
                      </h4>
                      <p style={{ fontSize: '0.74rem', color: '#777970', margin: 0 }}>
                        Click any room rectangle on the drafting sheet to inspect its dimensional coordinates, door swings, or apply targeted AI modifications.
                      </p>
                    </div>

                    {/* Room Schedule List */}
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#474943', marginBottom: '0.5rem' }}>
                      ROOM SCHEDULE ({allRooms.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {allRooms.map((r, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            if (onDeselectFurniture) onDeselectFurniture();
                            if (onSelectRoom) onSelectRoom(r, idx);
                          }}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderRadius: '6px',
                            background: '#FFFFFF',
                            border: '1px solid #E7E1D5',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#365FA8'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E7E1D5'; }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#252622' }}>{r.name}</div>
                            <div style={{ fontSize: '0.66rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>
                              {Math.round(r.width)}' × {Math.round(r.height)}' ({Math.round(r.width * r.height)} sqft)
                            </div>
                          </div>
                          <ChevronRight size={12} color="#777970" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: COMPLIANCE & AUDIT */}
            {activeTab === 'compliance' && (
              <ComplianceSidebar
                vastuScore={vastuScore}
                vastuResult={vastuResult}
                nbcResult={nbcResult}
                energyResult={energyResult}
                sunlightResult={sunlightResult}
                bomResult={bomResult}
                layout={layoutData}
                plotContext={plotContext}
                onLayoutUpdate={onLayoutUpdate}
                onVastuUpdate={onVastuUpdate}
                onNbcUpdate={onNbcUpdate}
                onAutoSaveRequest={onAutoSaveRequest}
              />
            )}

            {/* TAB 3: AI COPILOT */}
            {activeTab === 'copilot' && (
              <CopilotAgentPanel
                projectId={activePlanId}
                currentLayout={(layoutData as unknown as LayoutData) || { rooms: allRooms }}
                activeFloorLevel={activeFloorIndex}
                activeFloorName={activeFloorName}
                selectedRoomName={selectedRoom?.name || null}
                plotContext={plotContext}
                onApplyLayout={onAgentLayoutUpdate}
                onPreviewProposal={onPreviewCopilotProposal}
                onCancelPreview={onCancelCopilotPreview}
                onApplyProposal={onApplyCopilotProposal}
                onUndo={onUndoCopilot}
                canUndo={canUndo}
                isPreviewing={isPreviewingCopilot}
                disabled={allRooms.length === 0}
              />
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
