import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProjects, deleteProject } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Trash2, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';

import ThemeToggle from '../components/ThemeToggle';
import FloatingOrbs from '../components/FloatingOrbs';

interface ProjectData {
  id: string;
  name: string;
  created_at: string;
  layout_data: { rooms?: { length: number } };
  image_url: string;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);



  const fetchProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProjects();
  }, []);





  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this design?')) return;
    try {
      await deleteProject(id);
      setProjects(projects.filter(p => p.id !== id));
      toast.success('Design deleted');
    } catch {
      toast.error('Failed to delete design');
    }
  };

  const totalRooms = projects.reduce((acc, curr) => acc + (curr.layout_data?.rooms?.length || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
      <FloatingOrbs />
      {/* Header */}
      <div style={{ background: 'var(--nav-bg)', border: '1px solid var(--nav-border)', backdropFilter: 'blur(16px)', padding: '1.25rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>⬡</span>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>AI Architect</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={() => navigate('/editor')} className="btn-primary">
            <Plus size={16} /> New Design
          </button>
          <button onClick={logout} className="btn-ghost">
            <LogOut size={16} /> Logout
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2.5rem 2rem' }}>
        {/* Welcome */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
            Welcome back, <span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{user?.name}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Here is an overview of all your saved designs.</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
          {[
            { label: 'Total Designs', value: projects.length, icon: '🏗️', color: 'var(--accent-color)' },
            { label: 'Rooms Designed', value: totalRooms, icon: '🛏️', color: 'var(--text-secondary)' },
            { label: 'Vastu Projects', value: projects.length, icon: '⛩️', color: 'var(--success-text)' },
          ].map((stat, i) => (
            <div key={i} className="stat-card" style={{ background: 'var(--glass-bg)', border: `1px solid var(--glass-border)`, borderRadius: '16px', padding: '1.5rem', backdropFilter: 'blur(12px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{stat.label}</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: 800, color: stat.color, margin: 0, lineHeight: 1 }}>{stat.value}</p>
                </div>
                <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>Your Saved Plans</h2>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 280, background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'var(--glass-bg)', borderRadius: '20px', border: '1px dashed var(--glass-border)' }}>
            <FolderOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>No designs yet</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Generate your first AI-powered floor plan now.</p>
            <button onClick={() => navigate('/editor')} className="btn-primary" style={{ padding: '0.8rem 2rem' }}>
              Start Designing →
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {projects.map(p => (
              <div
                key={p.id}
                className="project-card"
                onClick={() => navigate(`/editor?project=${p.id}`)}
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.25s, transform 0.25s, box-shadow 0.25s' }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = 'var(--accent-color)';
                  el.style.transform = 'translateY(-4px)';
                  el.style.boxShadow = '0 12px 40px rgba(138,255,196,0.15)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = 'var(--glass-border)';
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = 'none';
                }}
              >
                {/* Thumbnail */}
                <div style={{ height: '180px', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '3rem' }}>⬡</div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)' }} />
                </div>

                {/* Card info */}
                <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</h4>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={e => handleDelete(p.id, e)}
                    className="btn-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
