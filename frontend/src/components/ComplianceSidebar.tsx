import { useState } from 'react';
import type { VastuResult, NbcResult, EnergyResult, VastuFixResult, NbcFixResult, LayoutUpdatePayload } from '../services/api';
import { vastuFix, nbcFix } from '../services/api';
import toast from 'react-hot-toast';

interface PlotContext {
  plotWidth: number;
  plotHeight: number;
  entryDir: string;
  bedrooms: number;
  bathrooms: number;
  floors: number;
  balcony: number;
  terrace: number;
  lift: number;
}

interface ComplianceSidebarProps {
  vastuScore: number;
  vastuResult?: VastuResult;
  nbcResult?: NbcResult;
  energyResult?: EnergyResult;
  layout: Record<string, unknown>;
  plotContext: PlotContext;
  onLayoutUpdate: (data: LayoutUpdatePayload, imageUrl?: string) => void;
  onVastuUpdate?: (newVastuResult: VastuResult, newScore: number) => void;
  onNbcUpdate?: (newNbcResult: NbcResult, newScore: number) => void;
}

export default function ComplianceSidebar({
  vastuScore,
  vastuResult,
  nbcResult,
  energyResult,
  layout,
  plotContext,
  onLayoutUpdate,
  onVastuUpdate,
  onNbcUpdate,
}: ComplianceSidebarProps) {
  const [vastuOpen, setVastuOpen] = useState(false);
  const [nbcOpen, setNbcOpen] = useState(false);
  const [energyOpen, setEnergyOpen] = useState(false);
  const [vastuFixing, setVastuFixing] = useState(false);
  const [lastFixResult, setLastFixResult] = useState<VastuFixResult | null>(null);
  const [nbcFixing, setNbcFixing] = useState(false);
  const [lastNbcFixResult, setLastNbcFixResult] = useState<NbcFixResult | null>(null);

  const handleVastuFix = async () => {
    setVastuFixing(true);
    setLastFixResult(null);
    toast.loading('🧭 AI is revising the Vastu topology…', { id: 'vastu-fix' });
    try {
      const result = await vastuFix(layout, vastuResult, plotContext);
      setLastFixResult(result);

      if (result.status === 'already_optimal') {
        toast.success(result.message || 'Layout is already Vastu-optimal!', { id: 'vastu-fix' });
        return;
      }

      if (result.fixed_layout?.length || result.full_layout) {
        onLayoutUpdate(result, result.imageUrl);
        if (onVastuUpdate && result.new_vastu_result) {
          onVastuUpdate(result.new_vastu_result, result.after_score);
        }

        const delta = result.after_score - result.before_score;
        const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
        toast.success(
          `Vastu improved: ${result.before_score} → ${result.after_score} (${deltaStr})`,
          { id: 'vastu-fix', duration: 5000 }
        );
      } else {
        toast.error('Vastu fix did not return a valid layout.', { id: 'vastu-fix' });
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Vastu fix failed: ${msg}`, { id: 'vastu-fix' });
    } finally {
      setVastuFixing(false);
    }
  };

  const handleNbcFix = async () => {
    setNbcFixing(true);
    setLastNbcFixResult(null);
    toast.loading('🏗️ AI is revising the NBC topology...', { id: 'nbc-fix' });
    try {
      const result = await nbcFix(layout, nbcResult, plotContext);
      setLastNbcFixResult(result);

      if (result.status === 'already_optimal') {
        toast.success(result.message || 'Layout is already NBC-optimal!', { id: 'nbc-fix' });
        return;
      }

      if (result.fixed_layout?.length || result.full_layout) {
        onLayoutUpdate(result, result.imageUrl);
        if (onNbcUpdate && result.new_nbc_result) {
          onNbcUpdate(result.new_nbc_result, result.after_score);
        }

        const delta = result.after_score - result.before_score;
        const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
        toast.success(
          `NBC improved: ${result.before_score} → ${result.after_score} (${deltaStr})`,
          { id: 'nbc-fix', duration: 5000 }
        );
      } else {
        toast.error('NBC fix did not return a valid layout.', { id: 'nbc-fix' });
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`NBC fix failed: ${msg}`, { id: 'nbc-fix' });
    } finally {
      setNbcFixing(false);
    }
  };

  return (
    <>
      {/* Vastu Panel */}
      {vastuResult && vastuResult.rules.length > 0 && (
        <div className="vastu-panel">
          <div className="vastu-panel-header" onClick={() => setVastuOpen(!vastuOpen)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <span style={{ fontSize: '1.2rem' }}>🧭</span> Vastu Analysis
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className={`vastu-badge ${vastuScore >= 60 ? 'pass' : vastuScore >= 40 ? 'warn' : 'fail'}`}>
                {vastuScore}/100
              </span>
              <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{vastuOpen ? '▲' : '▼'}</span>
            </div>
          </div>
          {vastuOpen && (
            <div className="vastu-panel-body">
              {vastuScore < 100 && (
                <button
                  onClick={handleVastuFix}
                  disabled={vastuFixing}
                  className="btn-primary"
                  style={{ width: '100%', marginBottom: '0.6rem', justifyContent: 'center', fontSize: '0.8rem' }}
                >
                  {vastuFixing ? '🧭 Revising topology…' : '✨ Auto-Fix Vastu (AI)'}
                </button>
              )}

              {/* Before/after result banner */}
              {lastFixResult && lastFixResult.status !== 'already_optimal' && (
                <div style={{
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: '6px',
                  padding: '0.5rem 0.7rem',
                  fontSize: '0.75rem',
                  marginBottom: '0.7rem',
                  color: 'var(--text-primary)',
                }}>
                  <strong>Score:</strong> {lastFixResult.before_score} → <strong>{lastFixResult.after_score}</strong>
                  {lastFixResult.design_rationale && (
                    <div style={{ marginTop: '0.25rem', opacity: 0.75 }}>{lastFixResult.design_rationale}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {vastuResult.rules.map((r, i) => {
                  if (r.max === 0) return null;
                  const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
                  return (
                    <div key={i} className="vastu-rule-card" style={{ border: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span>{icon}</span>{r.rule}</strong>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{r.points}/{r.max}</span>
                      </div>
                      <div style={{ opacity: 0.7, lineHeight: 1.3, fontSize: '0.72rem' }}>{r.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NBC Compliance Panel */}
      {nbcResult && nbcResult.rules.length > 0 && (
        <div className="vastu-panel" style={{ marginTop: '0' }}>
          <div className="vastu-panel-header" onClick={() => setNbcOpen(!nbcOpen)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <span style={{ fontSize: '1.2rem' }}>🏛</span> NBC 2016 Compliance
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className={`vastu-badge ${nbcResult.score >= 90 ? 'pass' : nbcResult.score >= 65 ? 'warn' : 'fail'}`}>
                {nbcResult.score}/100
              </span>
              <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{nbcOpen ? '▲' : '▼'}</span>
            </div>
          </div>
          {nbcOpen && (
            <div className="vastu-panel-body">
              {nbcResult.score < 100 && (
                <button
                  onClick={handleNbcFix}
                  disabled={nbcFixing}
                  className="btn-primary"
                  style={{ width: '100%', marginBottom: '0.6rem', justifyContent: 'center', fontSize: '0.8rem',  }}
                >
                  {nbcFixing ? '🏗 Revising topology…' : '🔧 Auto-Fix NBC 2016 (AI)'}
                </button>
              )}

              {lastNbcFixResult && lastNbcFixResult.status !== 'already_optimal' && (
                <div style={{
                  background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: '6px',
                  padding: '0.5rem 0.7rem',
                  fontSize: '0.75rem',
                  marginBottom: '0.7rem',
                  color: 'var(--text-primary)',
                }}>
                  <strong>Score:</strong> {lastNbcFixResult.before_score} → <strong>{lastNbcFixResult.after_score}</strong>
                  {lastNbcFixResult.design_rationale && (
                    <div style={{ marginTop: '0.25rem', opacity: 0.75 }}>{lastNbcFixResult.design_rationale}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {nbcResult.rules.map((r, i) => {
                  if (r.max === 0) return null;
                  const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
                  return (
                    <div key={i} className="vastu-rule-card" style={{ border: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span>{icon}</span>{r.rule}</strong>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{r.points}/{r.max}</span>
                      </div>
                      <div style={{ opacity: 0.7, lineHeight: 1.3, fontSize: '0.72rem' }}>{r.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Energy / Sun Path Panel */}
      {energyResult && energyResult.rules.length > 0 && (
        <div className="vastu-panel" style={{ marginTop: '0' }}>
          <div className="vastu-panel-header" onClick={() => setEnergyOpen(!energyOpen)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <span style={{ fontSize: '1.2rem' }}>☀️</span> Energy & Sun Path
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className={`vastu-badge ${energyResult.score >= 70 ? 'pass' : energyResult.score >= 50 ? 'warn' : 'fail'}`}>
                {energyResult.grade} ({energyResult.score}/100)
              </span>
              <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{energyOpen ? '▲' : '▼'}</span>
            </div>
          </div>
          {energyOpen && (
            <div className="vastu-panel-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {energyResult.rules.map((r, i) => {
                  if (r.max === 0) return null;
                  const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
                  return (
                    <div key={i} className="vastu-rule-card" style={{ border: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span>{icon}</span>{r.rule}</strong>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{r.points}/{r.max}</span>
                      </div>
                      <div style={{ opacity: 0.7, lineHeight: 1.3, fontSize: '0.72rem' }}>{r.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
