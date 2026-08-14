import { useState, useEffect, useCallback, useRef } from 'react';
import '../App.css';
import { generatePlans, exportDxf, exportReport, saveProject, getProjectById } from '../services/api';
import toast from 'react-hot-toast';
import type { Room, VastuResult, NbcResult, FloorCirculation } from '../services/api';
import InteractiveBlueprint from '../components/InteractiveBlueprint';
import FloorPlan3D from '../components/FloorPlan3D';
import RoomEditor from '../components/RoomEditor';
import ComplianceSidebar from '../components/ComplianceSidebar';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FloatingOrbs from '../components/FloatingOrbs';
import ThemeToggle from '../components/ThemeToggle';

interface Floor {
  level: string;
  rooms: Room[];
  imageUrl?: string;
  circulation?: FloorCirculation;
}

interface Plan {
  id: string;
  imageUrl: string;
  layout: { rooms?: Room[]; floors?: Floor[]; error?: string };
  vastuScore: number;
  vastuResult?: VastuResult;
  nbcResult?: NbcResult;
  circulationWarnings?: string[];
  validationReport?: string[];
}

const INITIAL_FORM = {
  length: 40, width: 30, floors: 1,
  duplex: false, bedrooms: 2, bathrooms: 2, kitchen: 1,
  balcony: 1, terrace: true, lift: false, parking: true,
  vastuToggle: true, entryDir: 'east',
};

export default function Editor() {
  const [loading, setLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [dxfLoading, setDxfLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [showCirculation, setShowCirculation] = useState(false);
  const [show3D, setShow3D] = useState(false);

  // Keep a ref always mirroring activeFloorIndex so memoised callbacks
  // don't need it as a dependency and never capture a stale value.
  const activeFloorIndexRef = useRef(0);
  useEffect(() => { activeFloorIndexRef.current = activeFloorIndex; }, [activeFloorIndex]);

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

  // Issue 6: memoised so the useEffect dependency array is honest.
  const loadSavedProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const project = await getProjectById(id);
      const restoredPlan: Plan = {
        id: project.id,
        imageUrl: project.image_url || "",
        layout: project.layout_data || { rooms: [] },
        vastuScore: project.layout_data?.vastuScore ?? 90,
        vastuResult: project.layout_data?.vastuResult,
        nbcResult: project.layout_data?.nbcResult,
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
  // openPlan is a stable plain function defined above; navigate is stable from react-router
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const projectId = params.get("project");
    if (projectId) {
      loadSavedProject(projectId);
    }
  }, [location.search, loadSavedProject]);

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
      const idx = activeFloorIndexRef.current;
      const newFloors = [...prev];
      newFloors[idx] = {
        ...newFloors[idx],
        rooms: newFloors[idx].rooms.map(r => r.name === updated.name ? updated : r)
      };
      return newFloors;
    });
    setSelectedRoom(updated);
  }, []);

  // Issue 1: accepts an optional imageUrl so that AI-mutated layouts stay in sync
  // with the concept sketch, PDF export, and database saves.
  const handleLayoutUpdate = useCallback((updatedRooms: Room[], imageUrl?: string) => {
    setFloors(prev => {
      const idx = activeFloorIndexRef.current;
      const newFloors = [...prev];
      newFloors[idx] = {
        ...newFloors[idx],
        rooms: updatedRooms,
        ...(imageUrl ? { imageUrl } : {}),
      };
      return newFloors;
    });
    if (imageUrl) {
      setActivePlan(prev => prev ? { ...prev, imageUrl } : prev);
    }
  }, []);

  const handleExportDxf = async () => {
    if (!activePlan || !floors.length) return;
    const currentRooms = floors[activeFloorIndex].rooms;
    if (!currentRooms.length) return;
    setDxfLoading(true);
    try {
      await exportDxf(currentRooms, `${activePlan.id}_${floors[activeFloorIndex].level.replace(/\s+/g, '_')}`);
      toast.success(
        '✅ DXF downloaded — Scale: 1 unit = 1 ft = 304.8 mm (AutoCAD units: mm). ' +
        'Verify units in AutoCAD with UNITS command before printing.',
        { duration: 6000 }
      );
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(`DXF export failed: ${err.message}`);
    } finally {
      setDxfLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (!activePlan || !floors.length) return;
    setReportLoading(true);
    toast.loading('📄 Generating PDF report…', { id: 'report-gen' });
    try {
      const bhk    = formData.bedrooms;
      const dir    = formData.entryDir.charAt(0).toUpperCase() + formData.entryDir.slice(1);
      const dupTag = formData.duplex ? ' Duplex' : '';
      const meta   = {
        name:      `${bhk}BHK${dupTag} ${dir}-facing ${formData.length}\u00d7${formData.width}ft`,
        length:    formData.length,
        width:     formData.width,
        bedrooms:  formData.bedrooms,
        bathrooms: formData.bathrooms,
        entry_dir: formData.entryDir,
        vastu:     formData.vastuToggle,
      };
      await exportReport(
        activePlan.layout as Record<string, unknown>,
        activePlan.vastuResult,
        activePlan.id,
        meta,
      );
      toast.success('✅ Architectural report downloaded!', { id: 'report-gen' });
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(`Report failed: ${err.message}`, { id: 'report-gen' });
    } finally {
      setReportLoading(false);
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
        layout_data: { 
          floors,
          vastuScore: activePlan.vastuScore,
          vastuResult: activePlan.vastuResult,
          nbcResult: activePlan.nbcResult,
        },
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

  const currentRooms     = floors[activeFloorIndex]?.rooms       || [];
  const floorCirculation = floors[activeFloorIndex]?.circulation ?? null;
  const currentLayout    = activePlan?.layout as Record<string, unknown> | undefined;

  // Derived plot context — passed into ComplianceSidebar and RoomEditor
  const plotContext = {
    plotWidth:  formData.length,
    plotHeight: formData.width,
    entryDir:   formData.entryDir,
    bedrooms:   formData.bedrooms,
    bathrooms:  formData.bathrooms,
    floors:     formData.floors,
  };

  const handleVastuUpdate = useCallback((newVastuResult: VastuResult, newScore: number) => {
    setActivePlan(prev => prev ? { ...prev, vastuScore: newScore, vastuResult: newVastuResult } : prev);
  }, []);

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

        {/* Right: theme toggle + user info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {user?.name || 'Architect'}
          </span>
        </div>
      </header>

      <div className={`content-grid ${activePlan ? 'active-plan-view' : ''}`}>
        {/* ── Sidebar Form ── */}
        <aside className="form-pane panel-scroll-area">
          <h2 className="sidebar-title">Requirements</h2>

          <div className="form-group">
            <label>Plot Size (sq ft)</label>
            <input
              type="number"
              value={formData.length * formData.width}
              readOnly
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
              title="Computed from Length × Width"
            />
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

        {/* ── Main Workspace & Analytics (or Gallery) ── */}
        {activePlan ? (
          <>
            {/* Center Panel: Interactive Blueprint & Concept Sketch */}
            <section className="workspace-pane card panel-scroll-area" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <p className="panel-label" style={{ margin: 0, fontWeight: 700 }}>Interactive Blueprint</p>
                  <span className="plan-id-badge" style={{ fontSize: '0.7rem' }}>{activePlan.id}</span>
                </div>
                
                {floors.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {floors.map((f, i) => (
                      <button
                        key={i}
                        onClick={() => { setActiveFloorIndex(i); setSelectedRoom(null); }}
                        style={{
                          padding: '0.35rem 0.9rem',
                          borderRadius: '6px',
                          border: `1px solid ${i === activeFloorIndex ? 'var(--accent-color)' : 'var(--glass-border)'}`,
                          background: i === activeFloorIndex ? 'var(--accent-gradient)' : 'transparent',
                          color: i === activeFloorIndex ? '#000' : 'var(--text-primary)',
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
              <div className="blueprint-wrapper" style={{ minHeight: '60vh', flexShrink: 0, position: 'relative', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                {currentRooms.length > 0
                  ? (
                    show3D ? (
                      <FloorPlan3D rooms={currentRooms} />
                    ) : (
                      <InteractiveBlueprint
                        rooms={currentRooms}
                        selectedRoom={selectedRoom}
                        onRoomSelect={handleRoomSelect}
                        onRoomDrop={handleLayoutUpdate}
                        circulation={floorCirculation}
                        showCirculation={showCirculation}
                      />
                    )
                  )
                  : <div className="blueprint-empty"><p>No layout data for this floor.</p></div>
                }
              </div>

              {/* Large Concept Sketch */}
              <div style={{ padding: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
                <p className="panel-label" style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Concept Sketch</p>
                <div className="concept-img-wrapper" style={{ width: '100%', height: '70vh', minHeight: '500px', borderRadius: '12px', overflow: 'hidden', background: '#000', border: '1px solid var(--glass-border)' }}>
                  <img
                    src={floors[activeFloorIndex]?.imageUrl || activePlan.imageUrl}
                    alt="Concept sketch"
                    className="concept-img"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              </div>
            </section>

            {/* Right Panel: Analytics & Actions */}
            <aside className="analytics-pane card panel-scroll-area" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem' }}>

              {/* Header: close + score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setActivePlan(null)}>← Close Plan</button>
                <div className={`vastu-score ${activePlan.vastuScore >= 90 ? 'high' : 'medium'}`} style={{ padding: '0.3rem 0.7rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid currentColor' }}>
                  Vastu {activePlan.vastuScore}/100
                </div>
              </div>

              <ComplianceSidebar
                vastuScore={activePlan.vastuScore}
                vastuResult={activePlan.vastuResult}
                nbcResult={activePlan.nbcResult}
                layout={currentLayout ?? {}}
                plotContext={plotContext}
                onLayoutUpdate={handleLayoutUpdate}
                onVastuUpdate={handleVastuUpdate}
              />

              {/* Action bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="btn-primary" onClick={handleSaveToDatabase} disabled={saveLoading || !currentRooms.length} style={{ width: '100%', justifyContent: 'center' }}>
                  {saveLoading ? 'Saving...' : '💾 Save to My Plans'}
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-ghost" onClick={handleExportDxf} disabled={dxfLoading || !currentRooms.length} style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}>
                    {dxfLoading ? '...' : '⬇ DXF'}
                  </button>
                  <button className="btn-ghost" onClick={handleExportReport} disabled={reportLoading || !currentRooms.length} style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}>
                    {reportLoading ? '...' : '📄 Report'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setShowCirculation(v => !v)}
                    disabled={!floorCirculation}
                    title={floorCirculation ? 'Toggle circulation path overlay' : 'Generate a plan to see paths'}
                    style={{
                      flex: 1, justifyContent: 'center', fontSize: '0.8rem',
                      background: showCirculation ? 'rgba(34,197,94,0.15)' : undefined,
                      borderColor: showCirculation ? '#22c55e' : undefined,
                      color:       showCirculation ? '#22c55e' : undefined,
                    }}
                  >
                    {showCirculation ? '🟢 Paths On' : '🛤 Show Paths'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setShow3D(v => !v)}
                    disabled={!currentRooms.length}
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}
                  >
                    {show3D ? '2D View' : '3D View'}
                  </button>
                  <button className="btn-ghost" onClick={handleGenerate} disabled={loading} style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}>
                    {loading ? '...' : '↻ Redraw'}
                  </button>
                </div>
              </div>

              {/* Room Editor — slides in below actions when a room is selected */}
              {selectedRoom && (
                <RoomEditor
                  room={selectedRoom}
                  allRooms={currentRooms}
                  plotContext={plotContext}
                  onRoomUpdate={handleRoomUpdate}
                  onLayoutUpdate={handleLayoutUpdate}
                  onClose={() => setSelectedRoom(null)}
                />
              )}

              {/* Circulation Warning — sourced from the computed floor circulation data */}
              {(() => {
                const unreachable = floorCirculation?.unreachable ?? activePlan.circulationWarnings ?? [];
                return unreachable.length > 0 ? (
                  <div style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.45)', borderRadius: '8px', padding: '0.6rem 0.9rem', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <span style={{ fontSize: '1rem' }}>⚠️</span> <strong>Circulation Warning:</strong>{' '}
                    {unreachable.length} room(s) unreachable: {unreachable.join(', ')}
                  </div>
                ) : null;
              })()}

              {/* Validation Report */}
              {(activePlan.validationReport?.length ?? 0) > 0 && (
                <details style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.6rem', fontSize: '0.78rem' }}>
                  <summary style={{ fontWeight: 600, cursor: 'pointer' }}>🔧 Auto-Corrections ({activePlan.validationReport!.length})</summary>
                  <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, opacity: 0.8 }}>
                    {activePlan.validationReport!.map((entry, i) => <li key={i}>{entry}</li>)}
                  </ul>
                </details>
              )}

            </aside>
            
          </>
        ) : plans.length > 0 ? (
          <main className="results-pane panel-scroll-area">
            <p className="panel-label" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Generated Plans — click to inspect</p>
            <div className="gallery" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {plans.map(plan => (
                <div key={plan.id} className="card" onClick={() => openPlan(plan)} style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', border: '1px solid var(--glass-border)', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                  <div style={{ height: '180px', background: '#fff' }}>
                    <img src={plan.imageUrl} alt="Concept" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{plan.id.slice(0, 8)}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>{plan.vastuScore} Vastu</span>
                  </div>
                </div>
              ))}
            </div>
          </main>
        ) : (
          <main className="results-pane" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' }}>⬡</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>No Plans Yet</h2>
            <p style={{ opacity: 0.7, maxWidth: '400px', margin: '0 auto 2rem', lineHeight: 1.6 }}>Configure your requirements on the left and click <strong>Generate Plans</strong> to get started.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'left' }}>
              <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <strong>🤖 Generative Layouts</strong><br/><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Llama-3 calculates precise rooms.</span>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <strong>🗂 Export to CAD</strong><br/><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Download perfectly scaled DXFs.</span>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
