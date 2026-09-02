import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../auth/store/AuthContext';
import type { Room } from '../../../shared/api-client/api';
import { getProjects, deleteProject } from '../../../shared/api-client/api';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Trash2, FolderOpen, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectData {
  id: string;
  name: string;
  created_at: string;
  layout_data: { 
    rooms?: Room[];
    floors?: { rooms?: Room[] }[];
  };
  image_url: string;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [vastuFilter, setVastuFilter] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
      toast.error('Session expired. Please log in again.');
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  const totalRooms = useMemo(() => {
    return Array.isArray(projects) ? projects.reduce((acc, curr) => {
      if (curr.layout_data?.floors) {
        return acc + curr.layout_data.floors.reduce((sum, f) => sum + (f.rooms?.length || 0), 0);
      }
      if (curr.layout_data?.rooms) {
        return acc + (curr.layout_data.rooms.length || 0);
      }
      return acc;
    }, 0) : 0;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return Array.isArray(projects) ? projects.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isVastuCompliant = (p.layout_data as any)?.vastuScore && (p.layout_data as any).vastuScore > 0;
      const matchesVastu = vastuFilter ? isVastuCompliant : true;
      return matchesSearch && matchesVastu;
    }) : [];
  }, [projects, searchQuery, vastuFilter]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ 
        background: 'var(--bg-primary)', 
        padding: '1.25rem 2.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        position: 'sticky', 
        top: 0, 
        zIndex: 50,
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--accent-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.2rem' }}>
            A
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            AI Architect
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => navigate('/editor')} className="primary-btn" style={{ padding: '10px 20px', fontSize: '14px', gap: '8px', borderRadius: '8px' }}>
            <Plus size={16} /> New Design
          </button>
          <button onClick={logout} className="secondary-btn" style={{ padding: '10px 20px', fontSize: '14px', gap: '8px', borderRadius: '8px' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Welcome */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            Welcome back, <span style={{ color: 'var(--accent-color)' }}>{user?.name}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Here is an overview of all your saved designs.</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          {[
            { label: 'Total Designs', value: projects.length, icon: '🏗️', color: 'var(--accent-color)' },
            { label: 'Rooms Designed', value: totalRooms, icon: '🛏️', color: 'var(--text-primary)' },
            { label: 'Vastu Projects', value: projects.filter(p => (p.layout_data as any).vastuScore && (p.layout_data as any).vastuScore > 0).length, icon: '⛩️', color: 'var(--success)' },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', fontWeight: 600 }}>{stat.label}</p>
                <p style={{ fontSize: '3rem', fontWeight: 800, color: stat.color, margin: 0, lineHeight: 1 }}>{stat.value}</p>
              </div>
              <span style={{ fontSize: '3rem', opacity: 0.9 }}>{stat.icon}</span>
            </div>
          ))}
        </div>

        {/* Projects Header & Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.5rem', margin: 0, color: 'var(--text-primary)' }}>Your Saved Plans</h2>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search plans..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '280px', paddingLeft: '44px', paddingRight: '16px', padding: '10px 16px 10px 44px', borderRadius: '8px', border: '1px solid var(--input-border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-color)'}
                onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
              />
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '6px', 
                background: vastuFilter ? 'var(--accent-color)' : 'var(--bg-primary)',
                border: `1px solid ${vastuFilter ? 'var(--accent-color)' : 'var(--input-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}>
                {vastuFilter && <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>}
              </div>
              <input
                type="checkbox"
                checked={vastuFilter}
                onChange={e => setVastuFilter(e.target.checked)}
                style={{ display: 'none' }}
              />
              Vastu-compliant only
            </label>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 280, borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem', background: 'var(--bg-primary)', border: '1px dashed var(--input-border)', borderRadius: '16px' }}>
            <FolderOpen size={64} style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', opacity: 0.5 }} />
            <h3 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No designs yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem' }}>Generate your first AI-powered floor plan now.</p>
            <button onClick={() => navigate('/editor')} className="primary-btn" style={{ padding: '12px 32px', borderRadius: '8px' }}>
              Start Designing →
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 2rem', background: 'var(--bg-primary)', border: '1px dashed var(--input-border)', borderRadius: '16px' }}>
            <h3 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No matching designs found</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
            {filteredProjects.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/editor?project=${p.id}`)}
                style={{ overflow: 'hidden', cursor: 'pointer', padding: 0, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-elevated)' }}
                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
              >
                {/* Thumbnail */}
                <div style={{ height: '200px', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--border-color)' }}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '4rem', opacity: 0.5 }}>⬡</div>
                  )}
                </div>

                {/* Card info */}
                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{p.name}</h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={e => handleDelete(p.id, e)}
                    className="secondary-btn"
                    style={{ padding: '10px', color: 'var(--error)', borderRadius: '12px' }}
                    title="Delete Project"
                  >
                    <Trash2 size={18} />
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
