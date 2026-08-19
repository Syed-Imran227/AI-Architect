import React, { useState } from 'react';
import type { Room } from '../services/api';
import { regenerateRoom } from '../services/api';

interface PlotContext {
  plotWidth: number;
  plotHeight: number;
  entryDir: string;
  bedrooms: number;
  bathrooms: number;
  floors: number;
}

interface Props {
  room: Room;
  allRooms: Room[];
  plotContext: PlotContext;
  onRoomUpdate: (updated: Room) => void;
  onLayoutUpdate: (updatedRooms: Room[], imageUrl?: string) => void;
  onClose: () => void;
}

type NumericRoomKey = 'x' | 'y' | 'width' | 'height';

const FIELD_LABELS: Record<NumericRoomKey, string> = {
  x: 'X Offset (ft)',
  y: 'Y Offset (ft)',
  width: 'Width (ft)',
  height: 'Height (ft)',
};

const RoomEditor: React.FC<Props> = ({ room, allRooms, plotContext, onRoomUpdate, onLayoutUpdate, onClose }) => {
  const [local, setLocal] = useState<Room>({ ...room });
  const [prevRoomName, setPrevRoomName] = useState(room.name);
  const [instruction, setInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);

  // Sync local state when the selected room prop changes using the during-render pattern
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
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
    onRoomUpdate(local);
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
      if (res?.rooms?.length) {
        onLayoutUpdate(res.rooms, res.imageUrl);
        setInstruction('');
        setAiSuccess(true);
        setTimeout(() => { setAiSuccess(false); }, 3000);
      } else {
        setAiError('AI returned an unexpected response.');
      }
    } catch (e: unknown) {
      const err = e as Error;
      setAiError(err.message || 'AI editing failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="room-editor">
      <div className="room-editor-header">
        <div className="room-editor-title">
          <div className="room-color-dot" style={{ background: getRoomDotColor(room.name) }} />
          <div>
            <h3>{room.name}</h3>
            <span className="room-orig-dims">{room.width} × {room.height} ft</span>
          </div>
        </div>
        <button className="close-btn" onClick={onClose} title="Close editor">✕</button>
      </div>

      {/* Numeric precision editing */}
      <div className="room-editor-section">
        <p className="section-label">Precise Dimensions</p>
        <div className="field-grid">
          {(Object.keys(FIELD_LABELS) as NumericRoomKey[]).map(field => (
            <div className="mini-form-group" key={field}>
              <label>{FIELD_LABELS[field]}</label>
              <input
                type="number"
                value={local[field]}
                min={field === 'width' || field === 'height' ? 4 : 0}
                step={0.5}
                onChange={e => handleFieldChange(field, parseFloat(e.target.value) || 0)}
              />
            </div>
          ))}
        </div>
        <div className="editor-btn-row">
          <button className="action-btn success" onClick={handleApply}>✓ Apply</button>
          <button className="action-btn" onClick={handleReset}>↺ Reset</button>
        </div>
      </div>

      {/* AI natural language editing */}
      <div className="room-editor-section nl-section">
        <p className="section-label">✦ AI Assistant</p>
        <div className="nl-input-row">
          <input
            type="text"
            className="nl-input"
            placeholder={`e.g. "Make the ${room.name} 3 ft wider"`}
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !aiLoading && handleAskAI()}
            disabled={aiLoading}
          />
          <button
            className={`ai-btn ${aiLoading ? 'loading' : ''} ${aiSuccess ? 'success' : ''}`}
            onClick={handleAskAI}
            disabled={aiLoading || !instruction.trim()}
          >
            {aiLoading ? <span className="spinner" /> : aiSuccess ? '✓' : 'Ask AI'}
          </button>
        </div>
        {aiError && <p className="nl-error">⚠ {aiError}</p>}
        <p className="nl-hint">AI will recalculate the entire floor plan to fulfil your request.</p>
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
