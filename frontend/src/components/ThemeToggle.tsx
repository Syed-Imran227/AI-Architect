import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  const handleClick = () => {
    toggleTheme();
  };

  return (
    <button
      onClick={handleClick}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        border: 'none',
        boxShadow: 'var(--glass-shadow)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        cursor: 'pointer',
        fontSize: '1.1rem',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--glass-bg)')}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
