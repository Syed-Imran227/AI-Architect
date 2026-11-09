import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Plus, LogOut, Compass, Sparkles } from 'lucide-react';

interface StudioHeaderProps {
  user: { email?: string; name?: string } | null;
  onLogout: () => void;
  onNewDesign: () => void;
  onOpenWizard?: () => void;
  activeSection?: 'studio' | 'archive' | 'create' | 'finance';
  onNavigateSection?: (section: 'studio' | 'archive' | 'create' | 'finance') => void;
}

export default function StudioHeader({
  user,
  onLogout,
  onNewDesign,
  onOpenWizard,
  activeSection = 'studio',
  onNavigateSection,
}: StudioHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileSheetRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleNavClick = (section: 'studio' | 'archive' | 'create' | 'finance', e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateSection) {
      onNavigateSection(section);
    } else {
      const el = document.getElementById(section);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'studio' as const, label: 'Studio', href: '#studio' },
    { id: 'create' as const, label: 'Create', href: '#create' },
    { id: 'archive' as const, label: 'Archive', href: '#archive' },
    { id: 'finance' as const, label: 'Financial Studio', href: '#finance' },
  ];

  const userDisplayName = user?.name || user?.email?.split('@')[0] || 'Architect';

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to studio workspace
      </a>

      <header
        role="banner"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          height: '60px',
          background: 'rgba(11, 12, 13, 0.94)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--stage-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          transition: 'background var(--dur-base) var(--ease-standard)',
        }}
      >
        {/* Wordmark Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            to="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              color: 'var(--stage-text-primary)',
            }}
            aria-label="AI Architect Home"
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                border: '1.5px solid var(--accent-oxide)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '3px',
                background: 'rgba(200, 80, 30, 0.1)',
              }}
            >
              <Compass size={16} color="var(--accent-oxide)" strokeWidth={1.75} />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.15rem',
                letterSpacing: '-0.02em',
                fontWeight: 600,
                color: 'var(--stage-text-primary)',
              }}
            >
              AI Architect
            </span>
          </Link>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--stage-text-muted)',
              padding: '2px 6px',
              borderLeft: '1px solid var(--stage-hairline)',
              marginLeft: '4px',
            }}
          >
            ATELIER
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav
          role="navigation"
          aria-label="Primary"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '32px',
          }}
          className="desktop-nav"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(item.id, e)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  textDecoration: 'none',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.86rem',
                  fontWeight: isActive ? 600 : 450,
                  color: isActive ? 'var(--stage-text-primary)' : 'var(--stage-text-secondary)',
                  position: 'relative',
                  padding: '6px 0',
                  letterSpacing: '0.01em',
                  transition: 'color var(--dur-fast) var(--ease-standard)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--stage-text-primary)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--stage-text-secondary)';
                }}
              >
                {item.label}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'var(--accent-oxide)',
                      borderRadius: '1px',
                    }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right CTA & User Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onOpenWizard && (
            <button
              onClick={onOpenWizard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#FAF8F2',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '0.84rem',
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                minHeight: '36px',
                transition: 'all 0.15s ease',
              }}
              title="Open Guided Architectural Wizard"
            >
              <Sparkles size={14} color="#f59e0b" />
              <span className="btn-label-desktop">Open Wizard</span>
            </button>
          )}

          <button
            onClick={onNewDesign}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--accent-oxide)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '0.84rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.01em',
              boxShadow: '0 1px 4px rgba(200, 80, 30, 0.25)',
              minHeight: '36px',
              minWidth: '44px',
            }}
            aria-label="Create a new architectural design"
          >
            <Plus size={15} strokeWidth={2.2} />
            <span className="btn-label-desktop">New design</span>
          </button>

          {/* User Profile & Logout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderLeft: '1px solid var(--stage-hairline)',
              paddingLeft: '14px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--stage-text-secondary)',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={user?.email || userDisplayName}
            >
              {userDisplayName}
            </span>

            <button
              onClick={onLogout}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--stage-text-muted)',
                padding: '6px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px',
                minHeight: '44px',
              }}
              title="Sign out of Atelier"
              aria-label="Sign out"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--stage-text-primary)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--stage-text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--stage-text-primary)',
              padding: '6px',
              cursor: 'pointer',
              display: 'none',
              minWidth: '44px',
              minHeight: '44px',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="mobile-hamburger"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Sheet */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          ref={mobileSheetRef}
          style={{
            position: 'fixed',
            top: '60px',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(11, 12, 13, 0.98)',
            backdropFilter: 'blur(20px)',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            padding: '28px 24px',
            gap: '20px',
            borderBottom: '1px solid var(--stage-hairline)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {navItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(item.id, e)}
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.45rem',
                  textDecoration: 'none',
                  color: activeSection === item.id ? 'var(--accent-oxide)' : 'var(--stage-text-primary)',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--stage-hairline)',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {item.label}
              </a>
            ))}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onNewDesign();
              }}
              style={{
                width: '100%',
                background: 'var(--accent-oxide)',
                color: '#fff',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: 600,
                border: 'none',
                minHeight: '44px',
              }}
            >
              + Create New Design
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              style={{
                width: '100%',
                background: 'transparent',
                color: 'var(--stage-text-muted)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid var(--stage-hairline)',
                minHeight: '44px',
              }}
            >
              Sign out ({userDisplayName})
            </button>
          </div>
        </div>
      )}

      {/* Inline styles for media query toggles */}
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-hamburger {
            display: none !important;
          }
        }
        @media (max-width: 767px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-hamburger {
            display: inline-flex !important;
          }
          .btn-label-desktop {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
