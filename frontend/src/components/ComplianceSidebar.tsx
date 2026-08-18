import { useState } from 'react';
import type { Room, VastuResult, NbcResult, EnergyResult, VastuFixResult } from '../services/api';
import { vastuFix } from '../services/api';
import toast from 'react-hot-toast';

interface PlotContext {
  plotWidth: number;
  plotHeight: number;
  entryDir: string;
  bedrooms: number;
  bathrooms: number;
  floors: number;
}

interface ComplianceSidebarProps {
  vastuScore: number;
  vastuResult?: VastuResult;
  nbcResult?: NbcResult;
  energyResult?: EnergyResult;
  layout: Record<string, unknown>;
  plotContext: PlotContext;
  onLayoutUpdate: (newRooms: Room[], imageUrl?: string) => void;
  onVastuUpdate?: (newVastuResult: VastuResult, newScore: number) => void;
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
}: ComplianceSidebarProps) {
  const [vastuOpen, setVastuOpen] = useState(false);
  const [nbcOpen, setNbcOpen] = useState(false);
  const [energyOpen, setEnergyOpen] = useState(false);
  const [vastuFixing, setVastuFixing] = useState(false);
  const [lastFixResult, setLastFixResult] = useState<VastuFixResult | null>(null);

  const handleVastuFix = async () => {
    setVastuFixing(true);
    setLastFixResult(null);
    toast.loading('🧭 AI is revising the Vastu topology…', { id: 'vastu-fix' });
    try {
      const result = await vastuFix(layout, vastuResult, plotContext);
      setLastFixResult(result);

      if (result.fixed_layout?.length) {
        onLayoutUpdate(result.fixed_layout, result.imageUrl);
        if (onVastuUpdate && result.new_vastu_result) {
          onVastuUpdate(result.new_vastu_result, result.after_score);
        }

        if (result.status === 'already_optimal') {
          toast.success('Layout is already Vastu-optimal!', { id: 'vastu-fix' });
        } else {
          const delta = result.after_score - result.before_score;
          const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
          toast.success(
            `Vastu improved: ${result.before_score} → ${result.after_score} (${deltaStr})`,
            { id: 'vastu-fix', duration: 5000 }
          );
        }
      } else {
        toast.error('Vastu fix did not return a valid layout.', { id: 'vastu-fix' });
      }
    } catch (e: unknown) {
      console.error(e);
      const err = e as Error;
      toast.error(`Vastu fix failed: ${err.message}`, { id: 'vastu-fix' });
    } finally {
      setVastuFixing(false);
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
              <span className={`vastu-badge ${vastuScore >= 70 ? 'pass' : vastuScore >= 40 ? 'warn' : 'fail'}`}>
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
                  const clr = r.status === 'pass' ? '#4caf50' : r.status === 'warn' ? '#ffa726' : '#ef5350';
                  const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
                  return (
                    <div key={i} className="vastu-rule-card" style={{ border: `1px solid ${clr}40` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span>{icon}</span>{r.rule}</strong>
                        <span style={{ color: clr, fontWeight: 700 }}>{r.points}/{r.max}</span>
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
              <span className={`vastu-badge ${nbcResult.score >= 65 ? 'pass' : 'fail'}`}>
                {nbcResult.score}/100
              </span>
              <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{nbcOpen ? '▲' : '▼'}</span>
            </div>
          </div>
          {nbcOpen && (
            <div className="vastu-panel-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {nbcResult.rules.map((r, i) => {
                  if (r.max === 0) return null;
                  const clr = r.status === 'pass' ? '#4caf50' : r.status === 'warn' ? '#ffa726' : '#ef5350';
                  const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
                  return (
                    <div key={i} className="vastu-rule-card" style={{ border: `1px solid ${clr}40` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span>{icon}</span>{r.rule}</strong>
                        <span style={{ color: clr, fontWeight: 700 }}>{r.points}/{r.max}</span>
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
              <span className={`vastu-badge ${energyResult.score >= 80 ? 'pass' : energyResult.score >= 60 ? 'warn' : 'fail'}`}>
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
                  const clr = r.status === 'pass' ? '#4caf50' : r.status === 'warn' ? '#ffa726' : '#ef5350';
                  const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
                  return (
                    <div key={i} className="vastu-rule-card" style={{ border: `1px solid ${clr}40` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span>{icon}</span>{r.rule}</strong>
                        <span style={{ color: clr, fontWeight: 700 }}>{r.points}/{r.max}</span>
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
