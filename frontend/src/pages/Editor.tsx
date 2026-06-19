import { useState, useEffect, useCallback } from 'react';
import '../App.css';
import { generatePlans, exportDxf, saveProject, getProjectById, vastuFix } from '../services/api';
import toast from 'react-hot-toast';
import type { Room, VastuResult } from '../services/api';
import InteractiveBlueprint from '../components/InteractiveBlueprint';
import RoomEditor from '../components/RoomEditor';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FloatingOrbs from '../components/FloatingOrbs';

interface Floor {
  level: string;
  rooms: Room[];
  imageUrl?: string;
}

interface Plan {
  id: string;
  imageUrl: string;
  layout: { rooms?: Room[]; floors?: Floor[]; error?: string };
  vastuScore: number;
  vastuResult?: VastuResult;
}

const INITIAL_FORM = {
  plotSize: 1200, length: 40, width: 30, floors: 1,
  duplex: false, bedrooms: 2, bathrooms: 2, kitchen: 1,
  balcony: 1, terrace: true, lift: false, parking: true,
  vastuToggle: true, entryDir: 'east',
};

export default function Editor() {
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [dxfLoading, setDxfLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [vastuOpen, setVastuOpen] = useState(false);
  const [vastuFixing, setVastuFixing] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    // Basic redirect if not logged in
    if (!localStorage.getItem("token")) {
      navigate('/login');
    }
  }, [navigate]);

  const openPlan = (plan: Plan) => {
    setActivePlan(plan);
    if (plan.layout?.floors && plan.layout.floors.length > 0) {
      setFloors(plan.layout.floors);
    } else if (plan.layout?.rooms) {
      setFloors([{ level: 'Ground Floor', rooms: plan.layout.rooms }]);
    } else {
      setFloors([]);
    }
    setActiveFloorIndex(0);
    setSelectedRoom(null);
  };

  const loadSavedProject = async (id: string) => {
    setLoading(true);
    try {
      const project = await getProjectById(id);
      const restoredPlan: Plan = {
        id: project.id,
        imageUrl: project.image_url || "",
        layout: project.layout_data || { rooms: [] },
        vastuScore: 90, // Default for restored plans
      };
      setPlans([restoredPlan]);
      openPlan(restoredPlan);
    } catch (e: unknown) {
      console.error(e);
      setGenError("Failed to load saved project.");
      toast.error("Failed to load saved project.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectId = params.get("project");
    if (projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadSavedProject(projectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? target.checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setGenError(null);
    try {
      const res = await generatePlans(formData);
      if (res?.candidates?.length) {
        setPlans(prev => [...prev, ...(res.candidates as Plan[])]);
        const first = res.candidates[0] as Plan;
        openPlan(first);
      }
    } catch (e: unknown) {
      const err = e as Error;
      setGenError(err.message || 'Generation failed. Check the backend is running.');
      toast.error(err.message || 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };



  const handleRoomSelect = useCallback((room: Room) => setSelectedRoom(room), []);

  const handleRoomUpdate = useCallback((updated: Room) => {
    setFloors(prev => {
      const newFloors = [...prev];
      newFloors[activeFloorIndex] = {
        ...newFloors[activeFloorIndex],
        rooms: newFloors[activeFloorIndex].rooms.map(r => r.name === updated.name ? updated : r)
      };
      return newFloors;
    });
    setSelectedRoom(updated);
  }, [activeFloorIndex]);

  const handleLayoutUpdate = useCallback((updatedRooms: Room[]) => {
    setFloors(prev => {
      const newFloors = [...prev];
      newFloors[activeFloorIndex] = {
        ...newFloors[activeFloorIndex],
        rooms: updatedRooms
      };
      return newFloors;
    });
  }, [activeFloorIndex]);

  const handleExportDxf = async () => {
    if (!activePlan || !floors.length) return;
    const currentRooms = floors[activeFloorIndex].rooms;
    if (!currentRooms.length) return;
    setDxfLoading(true);
    try {
      await exportDxf(currentRooms, `${activePlan.id}_${floors[activeFloorIndex].level.replace(/\s+/g, '_')}`);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(`DXF export failed: ${err.message}`);
    } finally {
      setDxfLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!activePlan || !floors.length) return;
    setSaveLoading(true);
    try {
      // Build a readable name: e.g. "3BHK East-facing 40×30ft"
      const bhk = formData.bedrooms;
      const dir = formData.entryDir.charAt(0).toUpperCase() + formData.entryDir.slice(1);
      const dupTag = formData.duplex ? ' Duplex' : '';
      const projectName = `${bhk}BHK${dupTag} ${dir}-facing ${formData.length}×${formData.width}ft`;

      await saveProject({
        name: projectName,
        layout_data: { floors },
        image_url: activePlan.imageUrl
      });
      toast.success('Design saved to My Plans!');
      navigate('/dashboard');
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaveLoading(false);
    }
  };
  const handleVastuFix = async () => {
    if (!activePlan?.vastuResult || !floors.length) return;
    setVastuFixing(true);
    toast.loading('✨ AI is optimising your Vastu layout…', { id: 'vastu-fix' });
    try {
      const currentRooms = floors[activeFloorIndex].rooms;
      const result = await vastuFix(
        currentRooms,
        formData.length,
        formData.width,
        formData.entryDir,
        activePlan.vastuResult.rules
      );
      // Update the active floor rooms
      setFloors(prev => {
        const next = [...prev];
        next[activeFloorIndex] = { ...next[activeFloorIndex], rooms: result.rooms };
        return next;
      });
      // Update the active plan score + image
      setActivePlan(prev => prev ? {
        ...prev,
        vastuScore:  result.vastuScore,
        vastuResult: result.vastuResult,
        imageUrl:    result.imageUrl,
      } : prev);
      setVastuOpen(true);
      toast.success(`✨ Vastu score improved to ${result.vastuScore}/100!`, { id: 'vastu-fix' });
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(`Auto-fix failed: ${err.message}`, { id: 'vastu-fix' });
    } finally {
      setVastuFixing(false);
    }
  };

  const currentRooms = floors[activeFloorIndex]?.rooms || [];

  return (
    <div className="app-container" style={{ position: 'relative', overflow: 'hidden' }}>
      <FloatingOrbs />

      {/* ── Header ── */}
      <header style={{
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--nav-border)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: '1rem',
      }}>
        {/* Left: back + logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>⬡</span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>AI Architect</span>
            <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(138,255,196,0.1)', border: '1px solid var(--accent-color)', borderRadius: '6px', fontSize: '0.72rem', color: 'var(--accent-color)', fontWeight: 700, letterSpacing: '0.05em' }}>EDITOR</span>
          </div>
        </div>

        {/* Right: user info */}
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {user?.name || 'Architect'}
        </span>
      </header>

      <div className="content-grid">
        {/* ── Sidebar Form ── */}
        <aside className="card sidebar">
          <h2 className="sidebar-title">Requirements</h2>

          <div className="form-group">
            <label>Plot Size (sq ft)</label>
            <input type="number" name="plotSize" value={formData.plotSize} onChange={handleChange} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Length (ft)</label>
              <input type="number" name="length" value={formData.length} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Width (ft)</label>
              <input type="number" name="width" value={formData.width} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Floors</label>
              <input type="number" name="floors" min={1} max={10} value={formData.floors} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Bedrooms</label>
              <input type="number" name="bedrooms" min={1} value={formData.bedrooms} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Bathrooms</label>
              <input type="number" name="bathrooms" min={1} value={formData.bathrooms} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Balconies</label>
              <input type="number" name="balcony" min={0} value={formData.balcony} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label>Entry Direction</label>
            <select name="entryDir" value={formData.entryDir} onChange={handleChange}>
              <option value="east">East</option>
              <option value="west">West</option>
              <option value="north">North</option>
              <option value="south">South</option>
            </select>
          </div>

          <div className="toggle-grid">
            {([
              ['duplex', 'Duplex'],
              ['terrace', 'Terrace'],
              ['lift', 'Lift'],
              ['parking', 'Parking'],
              ['vastuToggle', 'Vastu Rules'],
            ] as [string, string][]).map(([name, label]) => (
              <label key={name} className="toggle-label">
                <input
                  type="checkbox"
                  name={name}
                  checked={formData[name as keyof typeof formData] as boolean}
                  onChange={handleChange}
                />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                {label}
              </label>
            ))}
          </div>

          <button
            id="generate-btn"
            className="primary-btn"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading
              ? <><span className="btn-spinner" /> Generating…</>
              : '✦ Generate Plans'}
          </button>

          {genError && <p className="gen-error">⚠ {genError}</p>}

          {plans.length > 0 && !loading && (
            <div className="history-strip">
              <p className="section-label" style={{ marginBottom: '0.5rem' }}>Current Session</p>
              {plans.map(p => (
                <button
                  key={p.id}
                  className={`history-item ${activePlan?.id === p.id ? 'active' : ''}`}
                  onClick={() => openPlan(p)}
                >
                  {p.id}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── Main Area ── */}
        <main>
          {activePlan ? (
            <div className="detail-view">
              <div className="detail-header">
                <button className="back-btn" onClick={() => setActivePlan(null)}>← All Plans</button>
                <span className="plan-id-badge">{activePlan.id}</span>
                <div className={`vastu-score ${activePlan.vastuScore >= 90 ? 'high' : 'medium'}`}>
                  Vastu {activePlan.vastuScore}/100
                </div>
              </div>

              <div className="detail-panels" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem', alignItems: 'start' }}>
                {/* Concept Image */}
                <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px' }}>
                  <p className="panel-label" style={{ marginBottom: '1rem' }}>Concept Sketch</p>
                  <div className="concept-img-wrapper" style={{ flex: 1, minHeight: '400px', borderRadius: '12px', overflow: 'hidden', background: '#fff', border: '1px solid var(--glass-border)' }}>
                    <img
                      src={floors[activeFloorIndex]?.imageUrl || activePlan.imageUrl}
                      alt="AI-generated architectural concept sketch"
                      className="concept-img"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                </div>

                {/* Interactive Blueprint */}
                <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <p className="panel-label" style={{ margin: 0 }}>Interactive Blueprint <span className="panel-hint">— click a room to edit</span></p>
                    
                    {floors.length > 1 && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {floors.map((f, i) => (
                          <button
                            key={i}
                            onClick={() => { setActiveFloorIndex(i); setSelectedRoom(null); }}
                            style={{
                              padding: '0.3rem 0.8rem',
                              borderRadius: '6px',
                              border: `1px solid ${i === activeFloorIndex ? 'var(--accent-color)' : 'var(--glass-border)'}`,
                              background: i === activeFloorIndex ? 'var(--accent-gradient)' : 'var(--glass-bg)',
                              color: i === activeFloorIndex ? '#fff' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                          >
                            {f.level}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="blueprint-wrapper" style={{ flex: 1, minHeight: '400px' }}>
                    {currentRooms.length > 0
                      ? <InteractiveBlueprint rooms={currentRooms} selectedRoom={selectedRoom} onRoomSelect={handleRoomSelect} onRoomDrop={handleLayoutUpdate} />
                      : <div className="blueprint-empty"><p>AI did not return layout data for this floor.</p></div>
                    }
                  </div>
                </div>
              </div>

              {/* Action bar */}
              <div className="action-bar">
                <button id="export-dxf-btn" className="action-btn success" onClick={handleExportDxf} disabled={dxfLoading || !currentRooms.length}>
                  {dxfLoading ? 'Exporting…' : '⬇ Download AutoCAD DXF'}
                </button>
                <button className="action-btn primary" onClick={handleSaveToDatabase} disabled={saveLoading || !currentRooms.length} style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}>
                  {saveLoading ? 'Saving...' : '💾 Save to My Plans'}
                </button>
                <button className="action-btn" onClick={handleGenerate} disabled={loading}>
                  {loading ? 'Generating…' : '↻ Regenerate Plan'}
                </button>
              </div>

              {/* ── Vastu Analysis Panel ── */}
              {activePlan.vastuResult && activePlan.vastuResult.rules.length > 0 && (
                <div style={{ marginTop: '1.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden', backdropFilter: 'blur(12px)' }}>
                  {/* Header row */}
                  <button
                    onClick={() => setVastuOpen(o => !o)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🧿</span>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>Vastu Analysis</span>
                      <span style={{
                        padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
                        background: activePlan.vastuScore >= 80 ? 'rgba(76,175,80,0.15)' : activePlan.vastuScore >= 60 ? 'rgba(255,167,38,0.15)' : 'rgba(239,83,80,0.15)',
                        color: activePlan.vastuScore >= 80 ? '#4caf50' : activePlan.vastuScore >= 60 ? '#ffa726' : '#ef5350',
                        border: `1px solid ${activePlan.vastuScore >= 80 ? 'rgba(76,175,80,0.3)' : activePlan.vastuScore >= 60 ? 'rgba(255,167,38,0.3)' : 'rgba(239,83,80,0.3)'}`
                      }}>
                        {activePlan.vastuScore}/100 — {activePlan.vastuResult.grade}
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{vastuOpen ? '▲ Hide' : '▼ Show breakdown'}</span>
                  </button>

                  {vastuOpen && (
                    <div style={{ padding: '0 1.5rem 1.5rem' }}>

                      {/* Auto-Fix button — shown when score < 100 */}
                      {activePlan.vastuScore < 100 && (
                        <button
                          onClick={handleVastuFix}
                          disabled={vastuFixing}
                          style={{
                            width: '100%', marginBottom: '1rem', padding: '0.85rem 1.5rem',
                            background: vastuFixing
                              ? 'rgba(138,255,196,0.15)'
                              : 'var(--accent-gradient)',
                            border: '1px solid var(--accent-color)', borderRadius: '10px',
                            color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: vastuFixing ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                            transition: 'opacity 0.2s', opacity: vastuFixing ? 0.7 : 1,
                            boxShadow: vastuFixing ? 'none' : 'var(--accent-glow)',
                          }}
                        >
                          {vastuFixing ? (
                            <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>✨</span> Optimising layout…</>
                          ) : (
                            <><span>✨</span> Auto-Fix Vastu — Reach Perfect Score</>
                          )}
                        </button>
                      )}

                      {/* Rule cards grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                        {activePlan.vastuResult.rules.map((r, i) => {
                          const icon = r.status === 'pass' ? '✔' : r.status === 'warn' ? '⚠' : '✖';
                          const clr  = r.status === 'pass' ? '#4caf50' : r.status === 'warn' ? '#ffa726' : '#ef5350';
                          const bg   = r.status === 'pass' ? 'rgba(76,175,80,0.07)' : r.status === 'warn' ? 'rgba(255,167,38,0.07)' : 'rgba(239,83,80,0.07)';
                          if (r.max === 0) return null;
                          return (
                            <div key={i} style={{ background: bg, border: `1px solid ${clr}30`, borderRadius: '10px', padding: '0.85rem 1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                  <span style={{ color: clr, marginRight: '0.4rem' }}>{icon}</span>{r.rule}
                                </span>
                                {r.max > 0 && <span style={{ fontSize: '0.75rem', color: clr, fontWeight: 700 }}>{r.points}/{r.max}</span>}
                              </div>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.detail}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedRoom && (
                <RoomEditor
                  room={selectedRoom}
                  allRooms={currentRooms}
                  onRoomUpdate={handleRoomUpdate}
                  onLayoutUpdate={handleLayoutUpdate}
                  onClose={() => setSelectedRoom(null)}
                />
              )}
            </div>
          ) : plans.length > 0 ? (
            <div>
              <p className="gallery-heading">Generated Plans — click to inspect</p>
              <div className="gallery">
                {plans.map(plan => (
                  <div key={plan.id} className="plan-card" onClick={() => openPlan(plan)}>
                    <div className="plan-img">
                      <img
                        src={plan.imageUrl}
                        alt="Floor plan concept"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="plan-info">
                      <span className="plan-id-text">{plan.id}</span>
                      <span className="vastu-score">{plan.vastuScore}/100 Vastu</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⬡</div>
              <h2>No Plans Yet</h2>
              <p>Configure your requirements on the left and click <strong>Generate Plans</strong> to get started.</p>
              <ul className="feature-list">
                <li>🤖 Llama-3 calculates precise room coordinates</li>
                <li>🎨 Pillow renders a perfect 2D PNG matching the JSON</li>
                <li>🗂 Export any plan to AutoCAD DXF</li>
                <li>💾 Save your progress to the Cloud</li>
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
