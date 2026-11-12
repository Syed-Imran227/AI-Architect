import React, { useState, useEffect, useRef } from 'react';
import { regenerateRoom, type Room, type LayoutUpdatePayload } from '../../../shared/api-client/api';
import { propagateRoomBoundsWithSharedWalls, resizeRoomDirectly, type PropagationResult } from '../geometry/layoutConstraints';
import { toast } from 'react-hot-toast';

interface PlotContext {
  plotWidth: number;
  plotHeight: number;
  entryDir: string;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  balcony: number;
  terrace: number;
  lift: number;
}

interface Props {
  room: Room;
  index: number;
  allRooms: Room[];
  plotContext: PlotContext;
  onRoomUpdate: (index: number, updated: Room) => void;
  onLayoutUpdate: (data: LayoutUpdatePayload, imageUrl?: string) => void;
  onClose: () => void;
}

type NumericRoomKey = 'x' | 'y' | 'width' | 'height';

const FIELD_LABELS: Record<NumericRoomKey, string> = {
  x: 'X Offset (ft)',
  y: 'Y Offset (ft)',
  width: 'Width (ft)',
  height: 'Height (ft)',
};

const RoomEditor: React.FC<Props> = ({ room, index, allRooms, plotContext, onRoomUpdate, onLayoutUpdate, onClose }) => {
  const [local, setLocal] = useState<Room>({ ...room });
  const [prevRoomName, setPrevRoomName] = useState(room.name);
  const [resizeMode, setResizeMode] = useState<'independent' | 'synced'>('independent');
  const [instruction, setInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (room.name !== prevRoomName) {
    setPrevRoomName(room.name);
    setLocal({ ...room });
    setInstruction('');
    setAiError(null);
    setAiSuccess(false);
  }

  const handleFieldChange = (field: NumericRoomKey, val: number) => {
    setLocal(prev => ({ ...prev, [field]: val }));
  };

  const handleApply = () => {
    let res: PropagationResult;

    if (resizeMode === 'synced') {
      res = propagateRoomBoundsWithSharedWalls(
        allRooms,
        room.name,
        { x: local.x, y: local.y, width: local.width, height: local.height },
        plotContext.plotWidth,
        plotContext.plotHeight
      );

      // Graceful fallback to direct independent resize if neighbors cannot be further shrunk
      if (!res.success) {
        const directRes = resizeRoomDirectly(
          allRooms,
          room.name,
          { x: local.x, y: local.y, width: local.width, height: local.height },
          plotContext.plotWidth,
          plotContext.plotHeight
        );
        if (directRes.success) {
          res = directRes;
          toast('Synced partition could not shrink neighbors; applied as independent room resize.', { icon: 'ℹ️' });
        }
      }
    } else {
      res = resizeRoomDirectly(
        allRooms,
        room.name,
        { x: local.x, y: local.y, width: local.width, height: local.height },
        plotContext.plotWidth,
        plotContext.plotHeight
      );
    }

    if (!res.success) {
      toast.error(res.message);
      return;
    }
    const updatedRooms = res.rooms.map(r => {
      if (r.name === room.name || r.name === local.name) {
        return {
          ...r,
          name: local.name,
          roomType: local.roomType,
          isShaft: local.isShaft,
          isInteriorShaft: local.isInteriorShaft,
          isExteriorShaft: local.isExteriorShaft,
          isVoid: local.isVoid,
        };
      }
      return r;
    });
    const updatedTarget = updatedRooms.find(r => r.name === local.name) || local;
    if (onRoomUpdate) {
      onRoomUpdate(index, updatedTarget);
    } else {
      onLayoutUpdate({ rooms: updatedRooms });
    }
    toast.success(res.message);
  };

  const handleReset = () => {
    setLocal({ ...room });
  };

  const handleAskAI = async () => {
    if (!instruction.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiSuccess(false);
    try {
      const res = await regenerateRoom(allRooms, room.name, instruction, plotContext);
      if (res?.rooms?.length || res?.full_layout) {
        onLayoutUpdate(res, res.imageUrl);
        setInstruction('');
        setAiSuccess(true);
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => { setAiSuccess(false); }, 3000);
      } else {
        setAiError('AI returned an unexpected response.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAiError(msg || 'AI editing failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const widthM = (room.width * 0.3048).toFixed(2);
  const heightM = (room.height * 0.3048).toFixed(2);
  const areaSqft = Math.round(room.width * room.height);
  const areaM2 = (areaSqft * 0.092903).toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getRoomDotColor(room.name), boxShadow: 'var(--shadow-elevated)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{room.name}</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'monospace' }}>
              {room.width}×{room.height} ft ({widthM}×{heightM} m) • {areaSqft} sqft ({areaM2} m²)
            </span>
          </div>
        </div>
        <button className="neu-btn-ghost" onClick={onClose} title="Close editor" style={{ padding: '0.4rem', fontSize: '1rem', borderRadius: '8px' }}>✕</button>
      </div>

      {/* Openings (Doors & Windows) Schedule for this Room */}
      {((room.doors && room.doors.length > 0) || (room.windows && room.windows.length > 0)) && (
        <div className="neu-panel-inset" style={{ padding: '0.85rem 1rem' }}>
          <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            ROOM OPENINGS SCHEDULE
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {room.doors?.map((d: any, idx: number) => (
              <div key={`d-${idx}`} style={{ fontSize: '0.82rem', lineHeight: 1.45, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#D85740', fontWeight: 700 }}>🚪 Door:</span>
                <span>{d.wall || 'wall'} wall @ {d.position || 0}ft (width: {d.width || 3}ft{d.is_garage ? ' • Garage' : ''})</span>
              </div>
            ))}
            {room.windows?.map((w: any, idx: number) => (
              <div key={`w-${idx}`} style={{ fontSize: '0.82rem', lineHeight: 1.45, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#38BDF8', fontWeight: 700 }}>🪟 Window:</span>
                <span>{w.wall || 'wall'} wall @ {w.position || 0}ft (width: {w.width || 4}ft)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room Name & Architectural Classification */}
      <div className="neu-panel-inset" style={{ padding: '1rem 1.25rem' }}>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Room Identity & Classification
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Room Name</label>
            <input
              type="text"
              className="neu-input"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              value={local.name}
              onChange={e => setLocal(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Architecture Type</label>
            <select
              className="neu-input"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              value={
                local.isExteriorShaft || local.name.toLowerCase().includes('lightwell') || (local.name.toLowerCase().includes('shaft') && local.name.toLowerCase().includes('ext'))
                  ? 'external_shaft'
                  : local.isInteriorShaft || local.name.toLowerCase().includes('mep') || local.name.toLowerCase().includes('duct') || (local.name.toLowerCase().includes('shaft') && !local.name.toLowerCase().includes('ext'))
                  ? 'interior_shaft'
                  : 'standard_room'
              }
              onChange={e => {
                const val = e.target.value;
                if (val === 'external_shaft') {
                  setLocal(prev => ({
                    ...prev,
                    name: prev.name.toLowerCase().includes('lightwell') || prev.name.toLowerCase().includes('shaft') ? prev.name : 'External Lightwell',
                    roomType: 'external_shaft',
                    isShaft: true,
                    isExteriorShaft: true,
                    isInteriorShaft: false,
                    isVoid: true,
                  }));
                } else if (val === 'interior_shaft') {
                  setLocal(prev => ({
                    ...prev,
                    name: prev.name.toLowerCase().includes('mep') || prev.name.toLowerCase().includes('chase') || prev.name.toLowerCase().includes('shaft') ? prev.name : 'MEP Service Chase',
                    roomType: 'interior_shaft',
                    isShaft: true,
                    isExteriorShaft: false,
                    isInteriorShaft: true,
                    isVoid: true,
                  }));
                } else {
                  setLocal(prev => ({
                    ...prev,
                    roomType: 'room',
                    isShaft: false,
                    isExteriorShaft: false,
                    isInteriorShaft: false,
                    isVoid: false,
                  }));
                }
              }}
            >
              <option value="standard_room">Standard Enclosed Room</option>
              <option value="external_shaft">External Lightwell Shaft (Open to Sky)</option>
              <option value="interior_shaft">Internal MEP Chase (Plumbing/Ducts)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Numeric precision editing */}
      <div className="neu-panel-inset" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Precise Dimensions</p>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.06)', borderRadius: '14px', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setResizeMode('independent')}
              style={{
                border: 'none',
                background: resizeMode === 'independent' ? 'var(--text-primary)' : 'transparent',
                color: resizeMode === 'independent' ? '#FAF8F2' : 'var(--text-secondary)',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Resize only this room independently"
            >
              ⤢ Independent
            </button>
            <button
              type="button"
              onClick={() => setResizeMode('synced')}
              style={{
                border: 'none',
                background: resizeMode === 'synced' ? 'var(--text-primary)' : 'transparent',
                color: resizeMode === 'synced' ? '#FAF8F2' : 'var(--text-secondary)',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Sync shared partition walls with neighbors"
            >
              🔗 Sync Shared
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {(Object.keys(FIELD_LABELS) as NumericRoomKey[]).map(field => (
            <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{FIELD_LABELS[field]}</label>
              <input
                type="number"
                className="neu-input"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                value={local[field]}
                min={field === 'width' || field === 'height' ? 4 : 0}
                step={0.5}
                onChange={e => handleFieldChange(field, parseFloat(e.target.value) || 0)}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="neu-btn" onClick={handleApply} style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}>✓ Apply</button>
          <button className="neu-btn-ghost" onClick={handleReset} style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}>↺ Reset</button>
        </div>
      </div>

      {/* AI natural language editing */}
      <div className="neu-panel-inset" style={{ padding: '1.25rem' }}>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>✦ AI Assistant</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text"
            className="neu-input"
            placeholder={`e.g. "Make the ${room.name} 3 ft wider"`}
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !aiLoading && handleAskAI()}
            disabled={aiLoading}
            style={{ width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}
          />
          <button
            className="neu-btn"
            onClick={handleAskAI}
            disabled={aiLoading || !instruction.trim()}
            style={{ 
              width: '100%', padding: '0.6rem', fontSize: '0.85rem',
              color: aiSuccess ? 'var(--success)' : undefined
            }}
          >
            {aiLoading ? 'Thinking...' : aiSuccess ? '✓ Applied!' : 'Ask AI'}
          </button>
        </div>
        {aiError && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 500 }}>⚠ {aiError}</p>}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.75rem', lineHeight: 1.4 }}>
          AI will recalculate the entire floor plan to fulfil your request.
        </p>
      </div>
    </div>
  );
};

function getRoomDotColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('bedroom')) return '#3b82f6';
  if (n.includes('bath') || n.includes('toilet')) return '#06b6d4';
  if (n.includes('kitchen')) return '#f97316';
  if (n.includes('living') || n.includes('lounge') || n.includes('hall')) return '#8b5cf6';
  if (n.includes('dining')) return '#ec4899';
  if (n.includes('balcony') || n.includes('terrace')) return '#10b981';
  return '#64748b';
}

export default RoomEditor;
