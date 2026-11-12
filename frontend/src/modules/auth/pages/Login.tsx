import { useState } from 'react';
import { useAuth } from '../../auth/store/AuthContext';
import { login as loginApi } from '../../../shared/api-client/api';
import { isSupabaseAuth, getSupabase } from '../../../shared/api-client/supabase';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const parseErrorMessage = (err: unknown, defaultMsg: string): string => {
  if (!err) return defaultMsg;
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.detail === 'string') return parsed.detail;
    if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) return parsed.detail[0].msg;
    if (parsed.message) return parsed.message;
  } catch {
    // Not JSON, return cleaned text
  }
  return raw || defaultMsg;
};

export default function Login() {
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
      if (isSupabaseAuth()) {
        const sb = getSupabase();
        const { data, error: sbError } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (sbError) {
          throw new Error(sbError.message);
        }
        if (!data.session) {
          throw new Error('No session returned. Please verify your email before logging in.');
        }
        const meta = data.user.user_metadata || {};
        const displayName =
          meta.full_name || meta.name || data.user.email?.split('@')[0] || 'Architect';
        login(data.session.access_token, {
          id: data.user.id,
          email: data.user.email || email,
          name: displayName,
        });
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        const data = await loginApi({ email: email.trim(), password });
        login(data.access_token, data.user);
        toast.success('Login successful!');
        navigate('/dashboard');
      }
    } catch (e: unknown) {
      const msg = parseErrorMessage(e, 'Login failed');
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F3F0E7', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '2rem', left: '2.5rem' }}>
        <Link to="/" style={{ color: '#474943', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'color 0.2s', fontFamily: "'JetBrains Mono', monospace" }} onMouseOver={e=>e.currentTarget.style.color='#252622'} onMouseOut={e=>e.currentTarget.style.color='#474943'}>
          ← RETURN TO ATELIER
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: '440px', padding: '0 1.25rem', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#FAF8F2', border: '1px solid #E7E1D5', borderRadius: '8px', padding: '2.75rem 2.25rem', boxShadow: '0 12px 36px rgba(37, 38, 34, 0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '38px', height: '38px', background: '#252622', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FAF8F2', fontWeight: 700, fontSize: '1.25rem', fontFamily: "'Newsreader', Georgia, serif" }}>
                A
              </div>
            </div>
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.08em', color: '#365FA8', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", display: 'block', marginBottom: '0.35rem' }}>
              STUDIO // IDENTITY ACCESS
            </span>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 600, marginBottom: '0.4rem', color: '#252622', fontFamily: "'Newsreader', Georgia, serif", letterSpacing: '-0.01em' }}>
              Welcome to the Atelier
            </h1>
            <p style={{ color: '#777970', fontSize: '0.88rem', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Sign in to open your studio archive and drafting instruments
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px', color: '#474943', fontFamily: "'JetBrains Mono', monospace" }}>
                EMAIL ADDRESS
              </label>
              <input 
                type="email" 
                placeholder="architect@atelier.design" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '6px', border: '1px solid rgba(37, 38, 34, 0.22)', background: '#FFFFFF', color: '#252622', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                onFocus={e => e.target.style.borderColor = '#365FA8'}
                onBlur={e => e.target.style.borderColor = 'rgba(37, 38, 34, 0.22)'}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px', color: '#474943', fontFamily: "'JetBrains Mono', monospace" }}>
                PASSWORD
              </label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '6px', border: '1px solid rgba(37, 38, 34, 0.22)', background: '#FFFFFF', color: '#252622', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                onFocus={e => e.target.style.borderColor = '#365FA8'}
                onBlur={e => e.target.style.borderColor = 'rgba(37, 38, 34, 0.22)'}
              />
            </div>
            
            {error && <p style={{ color: '#D85740', fontSize: '0.82rem', margin: '4px 0 0 0', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{error}</p>}
            
            <button type="submit" disabled={loading} style={{ padding: '12px', fontSize: '0.95rem', fontWeight: 700, marginTop: '8px', width: '100%', borderRadius: '6px', background: '#252622', color: '#FAF8F2', border: '1px solid #252622', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontFamily: "'Plus Jakarta Sans', sans-serif', boxShadow: '0 4px 12px rgba(37,38,34,0.15)'" }}>
              {loading ? 'Authenticating Studio Pass...' : 'Enter Studio'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.75rem', color: '#777970', fontSize: '0.88rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            New to the studio?{' '}
            <Link to="/register" style={{ color: '#365FA8', textDecoration: 'none', fontWeight: 600 }}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
