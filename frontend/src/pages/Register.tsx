import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { register } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await register({ name, email, password });
      login(data.access_token, data.user);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || 'Registration failed');
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent-color)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(138,255,196,0.15)';
  };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--input-border)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
      <div className="login-orb" style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(138,255,196,0.1), transparent 70%)', pointerEvents: 'none' }} />
      <div className="login-orb" style={{ position: 'absolute', bottom: '10%', right: '10%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.08), transparent 70%)', pointerEvents: 'none' }} />

      {/* Theme toggle top-right */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 20 }}>
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: '440px', padding: '0 1rem', position: 'relative', zIndex: 10 }}>
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '2.5rem', backdropFilter: 'blur(20px)', boxShadow: 'var(--glass-shadow)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800, marginBottom: '0.5rem' }}>⬡ AI Architect</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' }}>Create your account</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Start designing professional floor plans today</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="text" placeholder="Full Name" required value={name} onChange={e => setName(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            <input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            <input type="password" placeholder="Password (min 6 characters)" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>⚠ {error}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Creating Account…' : 'Sign Up Free →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.85rem 1rem',
  borderRadius: '10px',
  border: '1px solid var(--glass-border)',
  background: 'var(--glass-bg)',
  color: 'var(--text-primary)',
  fontSize: '0.95rem',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: 'var(--font-primary)',
};

const btnStyle: React.CSSProperties = {
  padding: '0.9rem',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--accent-gradient)',
  color: 'var(--text-primary)',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'opacity 0.2s',
  fontFamily: 'var(--font-primary)',
  boxShadow: 'var(--accent-glow)',
};
