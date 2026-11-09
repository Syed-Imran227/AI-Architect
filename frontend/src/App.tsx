import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './modules/auth/store/AuthContext';
import Login from './modules/auth/pages/Login';
import Register from './modules/auth/pages/Register';
import { Toaster, ToastBar, toast } from 'react-hot-toast';

// Code-splitting heavy studio pages: loads Three.js and heavy engines only on route visit
const Dashboard = lazy(() => import('./modules/dashboard/pages/Dashboard'));
const Editor = lazy(() => import('./modules/editor/pages/Editor'));
const Landing = lazy(() => import('./modules/dashboard/pages/Landing'));

function LoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#080b11',
        color: '#38bdf8',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.82rem',
        letterSpacing: '0.08em',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '2px solid rgba(56, 189, 248, 0.2)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '1rem',
        }}
      />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span>INITIALIZING ATELIER VIEWPORT...</span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/editor" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function ThemedToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: { background: 'rgba(255,255,255,0.9)', color: '#0f172a', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(100,120,180,0.15)' },
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
    <Router>
      <AuthProvider>
        <ThemedToaster />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
