import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Landing from './pages/Landing';
import { Toaster, ToastBar, toast } from 'react-hot-toast';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-primary)' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/editor" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function ThemedToaster() {
  const { isDark } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: isDark
          ? { background: 'var(--bg-secondary)', color: '#fff', border: '1px solid var(--glass-border)' }
          : { background: 'rgba(255,255,255,0.9)', color: '#0f172a', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(100,120,180,0.15)' },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              {message}
              <button 
                onClick={() => toast.dismiss(t.id)} 
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: '10px', fontSize: '1.2rem', padding: '0 0.2rem', opacity: 0.7 }}
                aria-label="Close"
              >
                ×
              </button>
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <ThemedToaster />
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}
