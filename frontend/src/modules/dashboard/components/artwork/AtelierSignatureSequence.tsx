import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, PenTool, Layers, Compass, Box, Sparkles } from 'lucide-react';
import ConceptSketchArtwork from './ConceptSketchArtwork';
import MeasuredPlanArtwork from './MeasuredPlanArtwork';
import ExplodedAxoArtwork from './ExplodedAxoArtwork';
import BuildingSectionArtwork from './BuildingSectionArtwork';
import MaterialStudyArtwork from './MaterialStudyArtwork';

const ACTS = [
  { id: 0, title: 'I. The Idea', sub: 'Concept & Massing', icon: <PenTool size={14} /> },
  { id: 1, title: 'II. The Logic', sub: 'Measured Floor Plan', icon: <Compass size={14} /> },
  { id: 2, title: 'III. The Stack', sub: 'Exploded Axonometric', icon: <Layers size={14} /> },
  { id: 3, title: 'IV. The Section', sub: 'Longitudinal Cutaway', icon: <Box size={14} /> },
  { id: 4, title: 'V. The Craft', sub: 'Material Study', icon: <Sparkles size={14} /> },
];

export default function AtelierSignatureSequence() {
  const [activeAct, setActiveAct] = useState(1); // Default to Measured Floor Plan or user selection
  const [animationKey, setAnimationKey] = useState(0);

  const handleReplay = () => {
    setAnimationKey(k => k + 1);
  };

  return (
    <div style={{
      width: '100%',
      background: 'var(--paper-sheet)',
      borderRadius: '12px',
      border: '1px solid var(--paper-border)',
      boxShadow: 'var(--shadow-elevated)',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      position: 'relative'
    }}>
      {/* Top Portfolio Stage Navigation Bar */}
      <div style={{
        background: 'var(--paper-crisp)',
        borderBottom: '1px solid var(--paper-border)',
        padding: '0.65rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {/* Step Tabs */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', overflowX: 'auto' }}>
          {ACTS.map((act) => (
            <button
              key={act.id}
              onClick={() => setActiveAct(act.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeAct === act.id ? 'var(--accent-vermilion)' : 'transparent',
                background: activeAct === act.id ? 'rgba(216, 87, 64, 0.08)' : 'transparent',
                color: activeAct === act.id ? 'var(--accent-vermilion)' : 'var(--ink-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{act.icon}</span>
              <span>{act.title}</span>
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleReplay}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(37, 38, 34, 0.22)',
              background: '#FFFFFF',
              color: 'var(--ink-primary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 38, 34, 0.08)',
              transition: 'all 0.15s ease'
            }}
            title="Replay Drawing Sequence"
          >
            <RotateCcw size={13} /> Redraw
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div style={{ padding: '1rem', minHeight: '440px', position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeAct}-${animationKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            {activeAct === 0 && <ConceptSketchArtwork isAnimated={true} />}
            {activeAct === 1 && <MeasuredPlanArtwork isAnimated={true} />}
            {activeAct === 2 && <ExplodedAxoArtwork isAnimated={true} />}
            {activeAct === 3 && <BuildingSectionArtwork isAnimated={true} />}
            {activeAct === 4 && <MaterialStudyArtwork />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Drawing Caption */}
      <div style={{
        padding: '0.65rem 1.25rem',
        background: 'var(--paper-sheet)',
        borderTop: '1px solid var(--paper-border-soft)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.75rem',
        color: 'var(--ink-annotation)',
        fontFamily: 'var(--font-mono)'
      }}>
        <span>{ACTS[activeAct].sub.toUpperCase()}</span>
        <span>INTERACTIVE ATELIER DRAWING SUITE // CLICK TABS TO EXPLORE</span>
      </div>
    </div>
  );
}
