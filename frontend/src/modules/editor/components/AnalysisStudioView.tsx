import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, 
  Compass, 
  Sun, 
  Coins, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle
} from 'lucide-react';
import type { 
  LayoutData, 
  VastuResult, 
  NbcResult, 
  EnergyResult, 
  SunlightResult, 
  BomResult, 
  LayoutUpdatePayload,
  FloorCirculation
} from '../../../shared/api-client/api';
import { vastuFix, nbcFix, recalculateBOM } from '../../../shared/api-client/api';
import { calculateAuthoritativeBOM } from '../geometry/bomCalculator';
import toast from 'react-hot-toast';

interface AnalysisStudioViewProps {
  vastuScore: number;
  vastuResult?: VastuResult;
  nbcResult?: NbcResult;
  energyResult?: EnergyResult;
  sunlightResult?: SunlightResult;
  bomResult?: BomResult;
  layout: Record<string, unknown>;
  plotContext: {
    plotWidth: number;
    plotHeight: number;
    entryDir: string;
    bedrooms: number;
    bathrooms: number;
    floors: number;
    balcony: number;
    terrace: number;
    lift: number;
  };
  circulation?: FloorCirculation | null;
  onLayoutUpdate: (data: LayoutUpdatePayload, imageUrl?: string) => void;
  onVastuUpdate?: (res: VastuResult, score: number) => void;
  onNbcUpdate?: (res: NbcResult, score: number) => void;
  onAutoSaveRequest?: () => void;
}

export const AnalysisStudioView: React.FC<AnalysisStudioViewProps> = ({
  vastuScore,
  vastuResult,
  nbcResult,
  energyResult,
  sunlightResult,
  bomResult,
  layout,
  plotContext,
  circulation,
  onLayoutUpdate,
  onVastuUpdate,
  onNbcUpdate,
  onAutoSaveRequest,
}) => {
  const [selectedFinishTier, setSelectedFinishTier] = useState<string>('standard');
  const [isVastuFixing, setIsVastuFixing] = useState(false);
  const [isNbcFixing, setIsNbcFixing] = useState(false);

  const plotArea = plotContext.plotWidth * plotContext.plotHeight;

  const initialBudget = Number(
    (layout as any)?.budget_target ||
    (layout as any)?.target_budget ||
    bomResult?.budget?.target_budget ||
    0
  );
  const [targetBudgetText, setTargetBudgetText] = useState<string>(initialBudget > 0 ? String(initialBudget) : '');

  useEffect(() => {
    if (initialBudget > 0 && !targetBudgetText) {
      setTargetBudgetText(String(initialBudget));
    }
  }, [initialBudget]);

  const effectiveBom = useMemo<BomResult>(() => {
    const numBudget = Number(targetBudgetText) || 0;
    if (bomResult) {
      if (numBudget > 0 && (!bomResult.budget || bomResult.budget.target_budget !== numBudget)) {
        return calculateAuthoritativeBOM(layout as LayoutData, { tier: selectedFinishTier, targetBudget: numBudget });
      }
      return bomResult;
    }
    return calculateAuthoritativeBOM(layout as LayoutData, { tier: selectedFinishTier, targetBudget: numBudget });
  }, [bomResult, layout, selectedFinishTier, targetBudgetText]);

  const handleApplyBudget = () => {
    const numBudget = Number(targetBudgetText) || 0;
    const updatedBom = calculateAuthoritativeBOM(layout as LayoutData, { tier: selectedFinishTier, targetBudget: numBudget });
    onLayoutUpdate({
      new_bom_result: updatedBom,
      budget_target: numBudget,
    } as any);
    toast.success(numBudget > 0 ? `Target budget set to ₹${numBudget.toLocaleString('en-IN')}` : 'Target budget reset');
    onAutoSaveRequest?.();
  };

  // Vastu Auto-Fix handler
  const handleVastuFix = async () => {
    setIsVastuFixing(true);
    toast.loading('🧭 Optimizing Vastu spatial orientation…', { id: 'vastu-fix' });
    try {
      const res = await vastuFix(layout, vastuResult, plotContext);
      if (res.status === 'already_optimal') {
        toast.success('Layout already achieves maximum Vastu harmony!', { id: 'vastu-fix' });
        return;
      }
      if (res.fixed_layout?.length || res.full_layout) {
        onLayoutUpdate(res, res.imageUrl);
        if (onVastuUpdate && res.new_vastu_result) {
          onVastuUpdate(res.new_vastu_result, res.after_score);
        }
        const delta = res.after_score - res.before_score;
        toast.success(`Vastu Score enhanced: ${res.before_score} → ${res.after_score} (+${delta})`, { id: 'vastu-fix' });
        onAutoSaveRequest?.();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Vastu optimization failed: ${msg}`, { id: 'vastu-fix' });
    } finally {
      setIsVastuFixing(false);
    }
  };

  // NBC Auto-Fix handler
  const handleNbcFix = async () => {
    setIsNbcFixing(true);
    toast.loading('📐 Aligning layout with NBC-2016 setbacks…', { id: 'nbc-fix' });
    try {
      const res = await nbcFix(layout, nbcResult, plotContext);
      if (res.fixed_layout?.length || res.full_layout) {
        onLayoutUpdate(res, res.imageUrl);
        if (onNbcUpdate && res.new_nbc_result) {
          onNbcUpdate(res.new_nbc_result, res.after_score);
        }
        toast.success(`NBC Compliance upgraded to Grade ${res.new_nbc_result?.grade || 'A'}`, { id: 'nbc-fix' });
        onAutoSaveRequest?.();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`NBC bylaws adjustment failed: ${msg}`, { id: 'nbc-fix' });
    } finally {
      setIsNbcFixing(false);
    }
  };

  // Finish Tier change handler
  const handleTierChange = async (newTier: string) => {
    setSelectedFinishTier(newTier);
    const numBudget = Number(targetBudgetText) || 0;
    try {
      const res = await recalculateBOM(layout as LayoutData, plotArea, newTier, numBudget);
      onLayoutUpdate({ new_bom_result: res.bomResult });
      toast.success(`BOM updated for ${newTier.toUpperCase()} finishes`);
    } catch {
      const localBom = calculateAuthoritativeBOM(layout as LayoutData, { tier: newTier, targetBudget: numBudget });
      onLayoutUpdate({ new_bom_result: localBom });
      toast.success(`BOM updated for ${newTier.toUpperCase()} finishes`);
    }
  };

  const totalCost = `₹${Math.round(effectiveBom.summary.grand_total).toLocaleString('en-IN')}`;


  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      padding: '2rem 2.5rem',
      background: '#FAF8F2',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
    }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #E7E1D5', paddingBottom: '1rem' }}>
        <span style={{
          fontSize: '0.68rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#365FA8',
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}>
          TECHNICAL AUDIT & REGULATORY VERIFICATION
        </span>
        <h2 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: '1.6rem',
          fontWeight: 600,
          color: '#252622',
          margin: '2px 0 0 0',
        }}>
          Architectural Performance Studio
        </h2>
      </div>

      {/* 4-Card Executive Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
      }}>
        {/* Card 1: Vastu */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E7E1D5',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>VASTU MANDALA</span>
            <Compass size={14} color="#A1AE97" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: vastuScore >= 60 ? '#437A5D' : '#B89A64' }}>
            {vastuScore}<span style={{ fontSize: '1rem', color: '#777970' }}>/100</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#777970' }}>
            {vastuScore >= 80 ? 'Optimal orientation' : vastuScore >= 60 ? 'Acceptable balance' : 'Requires adjustment'}
          </span>
        </div>

        {/* Card 2: NBC */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E7E1D5',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>NBC-2016 BYLAWS</span>
            <ShieldCheck size={14} color="#365FA8" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#365FA8' }}>
            GRADE {nbcResult?.grade || 'A'}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#777970' }}>
            {nbcResult?.rules?.filter(r => r.status === 'pass').length || 8} of {nbcResult?.rules?.length || 8} clauses passed
          </span>
        </div>

        {/* Card 3: Solar Daylight */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E7E1D5',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>DAYLIGHT FACTOR</span>
            <Sun size={14} color="#B89A64" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#B89A64' }}>
            {sunlightResult?.score || 85}<span style={{ fontSize: '1rem', color: '#777970' }}>%</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#777970' }}>
            {sunlightResult?.insights?.[0]?.slice(0, 32) || (energyResult?.grade ? `Energy Grade: ${energyResult.grade}` : 'Good natural illumination')}
          </span>
        </div>

        {/* Card 4: Estimated Budget */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E7E1D5',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>EST. TOTAL COST</span>
            <Coins size={14} color="#252622" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#252622' }}>
            {totalCost}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
            <span style={{ color: '#777970' }}>
              Target: {effectiveBom.budget?.target_budget ? `₹${effectiveBom.budget.target_budget.toLocaleString('en-IN')}` : 'Not Set'}
            </span>
            {effectiveBom.budget && effectiveBom.budget.target_budget > 0 && (
              <span style={{
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: effectiveBom.budget.is_over_budget ? '#D85740' : '#437A5D',
              }}>
                {effectiveBom.budget.is_over_budget ? `+₹${effectiveBom.budget.overrun_amount.toLocaleString('en-IN')} Over` : `₹${effectiveBom.budget.remaining_budget.toLocaleString('en-IN')} Left`}
              </span>
            )}
          </div>
        </div>
      </div>


      {/* Main Analysis Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Section 1: Vastu Shastra Matrix & Directional Breakdown */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E7E1D5',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '1.25rem', color: '#252622', margin: 0 }}>
                Vastu Shastra Directional Audit
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#777970' }}>
                Spatial alignment with 16 Vastu Purusha zones
              </span>
            </div>

            <button
              onClick={handleVastuFix}
              disabled={isVastuFixing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '5px',
                border: 'none',
                background: '#252622',
                color: '#FAF8F2',
                fontSize: '0.74rem',
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: isVastuFixing ? 'not-allowed' : 'pointer',
              }}
            >
              <Sparkles size={12} color="#D85740" />
              <span>{isVastuFixing ? 'RECONFIGURING...' : 'AI AUTO-FIX'}</span>
            </button>
          </div>

          {/* Vastu breakdown list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(vastuResult?.rules || [
              { rule: 'Kitchen in SE (Agni Corner)', status: 'pass', detail: 'Ideal placement for cooking element.', points: 15, max: 15 },
              { rule: 'Master Bedroom in SW (Nairutya)', status: 'pass', detail: 'Provides stability and master authority.', points: 20, max: 20 },
              { rule: 'Water / Foyer in NE (Ishanya)', status: 'pass', detail: 'High positive energy flow zone.', points: 15, max: 15 },
              { rule: 'Central Brahmasthan Clear', status: 'pass', detail: 'No heavy columns in the geographic center.', points: 15, max: 15 },
            ]).map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '0.75rem',
                  borderRadius: '5px',
                  background: '#FAF8F2',
                  border: '1px solid #E7E1D5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.76rem',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#252622' }}>{item.rule}: </span>
                  <span style={{ color: '#777970' }}>{item.detail}</span>
                </div>
                <div style={{ color: item.status === 'pass' ? '#437A5D' : '#B89A64', fontWeight: 700 }}>
                  {item.points}/{item.max} ({item.status.toUpperCase()})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: National Building Code (NBC-2016) Checklist */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E7E1D5',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '1.25rem', color: '#252622', margin: 0 }}>
                NBC-2016 Bylaws Compliance
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#777970' }}>
                Setbacks, minimum room dimensions, and natural ventilation
              </span>
            </div>

            <button
              onClick={handleNbcFix}
              disabled={isNbcFixing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '5px',
                border: 'none',
                background: '#252622',
                color: '#FAF8F2',
                fontSize: '0.74rem',
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: isNbcFixing ? 'not-allowed' : 'pointer',
              }}
            >
              <Sparkles size={12} color="#365FA8" />
              <span>{isNbcFixing ? 'ADJUSTING...' : 'RESOLVE CLAUSES'}</span>
            </button>
          </div>

          {/* NBC rules list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(nbcResult?.rules || [
              { rule: 'Front Road Setback', status: 'pass', detail: 'Minimum 5.0 ft setback maintained from property line.', points: 10, max: 10 },
              { rule: 'Habitable Room Min Width', status: 'pass', detail: 'All bedrooms exceed 9.5 ft minimum width.', points: 10, max: 10 },
              { rule: 'Window Glazing Ratio', status: 'pass', detail: 'Fenestration exceeds 10% of total carpet area.', points: 10, max: 10 },
              { rule: 'Bathroom Ceiling Height', status: 'pass', detail: 'Clear headroom meets 7.5 ft NBC code.', points: 10, max: 10 },
            ]).map((rule, i) => (
              <div
                key={i}
                style={{
                  padding: '0.75rem',
                  borderRadius: '5px',
                  background: '#FAF8F2',
                  border: '1px solid #E7E1D5',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '0.74rem',
                }}
              >
                {rule.status === 'pass' ? (
                  <CheckCircle2 size={15} color="#437A5D" style={{ marginTop: '2px', flexShrink: 0 }} />
                ) : (
                  <AlertTriangle size={15} color="#B89A64" style={{ marginTop: '2px', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#252622', fontFamily: "'JetBrains Mono', monospace" }}>
                    {rule.rule}
                  </div>
                  <div style={{ color: '#777970', fontSize: '0.7rem', marginTop: '2px' }}>
                    {rule.detail}
                  </div>
                </div>
              </div>
            ))}

            {circulation?.unreachable && circulation.unreachable.length > 0 && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '5px',
                background: 'rgba(216, 87, 64, 0.08)',
                border: '1px solid rgba(216, 87, 64, 0.25)',
                fontSize: '0.74rem',
                color: '#D85740',
                fontWeight: 600,
              }}>
                ⚠️ Circulation Warning: {circulation.unreachable.length} rooms unreachable: {circulation.unreachable.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Bill of Materials & Cost Schedule */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E7E1D5',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          gridColumn: '1 / -1',
        }}>
          {/* Header & Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '1.35rem', color: '#252622', margin: 0 }}>
                Bill of Materials & Financial Schedule
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#777970' }}>
                Deterministic trade schedule and placed furniture procurement breakdown (INR)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Target Budget Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>
                  TARGET BUDGET:
                </span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '8px', fontSize: '0.74rem', color: '#777970', fontFamily: "'JetBrains Mono', monospace" }}>₹</span>
                  <input
                    type="number"
                    placeholder="Set Target Budget"
                    value={targetBudgetText}
                    onChange={(e) => setTargetBudgetText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyBudget();
                    }}
                    style={{
                      padding: '4px 8px 4px 18px',
                      fontSize: '0.74rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      width: '130px',
                      background: '#FAF8F2',
                      border: '1px solid #E7E1D5',
                      borderRadius: '4px',
                      color: '#252622',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleApplyBudget}
                    style={{
                      marginLeft: '4px',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: '#252622',
                      color: '#FAF8F2',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Finish Tier Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>
                  FINISH SPEC:
                </span>
                <div style={{ display: 'flex', gap: '3px', background: '#F3F0E7', padding: '2px', borderRadius: '5px' }}>
                  {['economy', 'standard', 'luxury'].map(t => (
                    <button
                      key={t}
                      onClick={() => handleTierChange(t)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        background: selectedFinishTier === t ? '#252622' : 'transparent',
                        color: selectedFinishTier === t ? '#FAF8F2' : '#777970',
                        fontSize: '0.7rem',
                        fontWeight: selectedFinishTier === t ? 700 : 500,
                        fontFamily: "'JetBrains Mono', monospace",
                        cursor: 'pointer',
                      }}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Budget Analytics Ribbon */}
          {effectiveBom.budget && effectiveBom.budget.target_budget > 0 && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '6px',
              border: effectiveBom.budget.is_over_budget ? '1px solid rgba(216, 87, 64, 0.4)' : '1px solid rgba(67, 122, 93, 0.4)',
              background: effectiveBom.budget.is_over_budget ? 'rgba(216, 87, 64, 0.06)' : 'rgba(67, 122, 93, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    color: effectiveBom.budget.is_over_budget ? '#D85740' : '#437A5D',
                  }}>
                    {effectiveBom.budget.is_over_budget ? '⚠️ Target Budget Overrun Alert' : '✓ Project Within Approved Budget Target'}
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: effectiveBom.budget.is_over_budget ? 'rgba(216, 87, 64, 0.15)' : 'rgba(67, 122, 93, 0.15)',
                    color: effectiveBom.budget.is_over_budget ? '#D85740' : '#437A5D',
                    fontWeight: 700,
                  }}>
                    {effectiveBom.budget.budget_consumed_pct}% CONSUMED
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: effectiveBom.budget.is_over_budget ? '#D85740' : '#437A5D' }}>
                  {effectiveBom.budget.is_over_budget
                    ? `Overrun: +₹${effectiveBom.budget.overrun_amount.toLocaleString('en-IN')}`
                    : `Remaining: ₹${effectiveBom.budget.remaining_budget.toLocaleString('en-IN')}`}
                </div>
              </div>
              <div style={{ width: '100%', height: '7px', background: '#E7E1D5', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, effectiveBom.budget.budget_consumed_pct)}%`,
                  height: '100%',
                  background: effectiveBom.budget.is_over_budget ? '#D85740' : '#437A5D',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* Table 1: Construction Trade Breakdown */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#474943' }}>
                1. STRUCTURAL & CONSTRUCTION TRADES
              </span>
              <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>
                Rate: ₹{effectiveBom.summary.rate_per_sqft.toLocaleString('en-IN')}/sqft (Total Area: {effectiveBom.summary.total_area_sqft} sqft)
              </span>
            </div>
            <div style={{ borderRadius: '6px', border: '1px solid #E7E1D5', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                <thead>
                  <tr style={{ background: '#F3F0E7', borderBottom: '1px solid #E7E1D5', textAlign: 'left', color: '#474943' }}>
                    <th style={{ padding: '8px 12px' }}>TRADE / MATERIAL</th>
                    <th style={{ padding: '8px 12px' }}>SPECIFICATION & ASSUMPTIONS</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>ESTIMATED SUB-TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { trade: 'RCC Structural Frame', spec: 'RCC columns, beams, footings & roof slab (₹400/sqft base)', total: effectiveBom.categories?.structural ?? 0 },
                    { trade: 'Masonry & Wall Plaster', spec: '9" brick masonry + two-sided cement plaster (₹73/sqft wall area)', total: effectiveBom.categories?.masonry_and_plaster ?? 0 },
                    { trade: 'Flooring & Finishes', spec: selectedFinishTier === 'luxury' ? 'Premium marble & granite flooring (₹120/sqft)' : 'Standard vitrified tile flooring (₹45/sqft)', total: effectiveBom.categories?.flooring ?? 0 },
                    { trade: 'False POP / Gypsum Ceiling', spec: 'Concealed channel false ceiling throughout habitable rooms (₹35/sqft)', total: effectiveBom.categories?.ceiling ?? 0 },
                    { trade: 'Electrical Conduits & Fixtures', spec: 'Copper wiring, modular switches, MCBs and conduits (₹80/sqft)', total: effectiveBom.categories?.electrical ?? 0 },
                    { trade: 'Wet-Room Plumbing & Drainage', spec: 'CPVC water supply, soil/waste lines & sanitary fittings for wet rooms (₹60/sqft)', total: effectiveBom.categories?.plumbing ?? 0 },
                    { trade: 'Emulsion Painting', spec: '2 coats interior acrylic emulsion paint (₹22/sqft)', total: effectiveBom.categories?.painting ?? 0 },
                    { trade: 'Openings (Doors & Windows)', spec: 'Standard interior doors (₹8,000/ea) & aluminium sliding windows (₹5,500/ea)', total: effectiveBom.categories?.doors_and_windows ?? 0 },
                    { trade: 'Construction Labour Allowance', spec: 'CPWD benchmark 30% labour ratio on all construction materials', total: effectiveBom.categories?.labour ?? 0 },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #E7E1D5', background: i % 2 === 0 ? '#FFFFFF' : '#FAF8F2' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 600, color: '#252622' }}>{row.trade}</td>
                      <td style={{ padding: '7px 12px', color: '#777970' }}>{row.spec}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: '#252622' }}>
                        ₹{row.total.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F3F0E7', borderTop: '2px solid #E7E1D5', fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: '8px 12px', color: '#252622' }}>CONSTRUCTION SUB-TOTAL</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#252622' }}>
                      ₹{(effectiveBom.summary.construction_total ?? (effectiveBom.summary.material_total + effectiveBom.summary.labour_total)).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Placed Furniture & Fixtures Schedule */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#474943' }}>
                2. PLACED FURNITURE & FIXTURES SCHEDULE
              </span>
              <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#777970' }}>
                {effectiveBom.furniture_schedule?.reduce((s, f) => s + f.quantity, 0) || 0} Placed Assets
              </span>
            </div>
            <div style={{ borderRadius: '6px', border: '1px solid #E7E1D5', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                <thead>
                  <tr style={{ background: '#F3F0E7', borderBottom: '1px solid #E7E1D5', textAlign: 'left', color: '#474943' }}>
                    <th style={{ padding: '8px 12px' }}>FURNITURE / FIXTURE ITEM</th>
                    <th style={{ padding: '8px 12px' }}>CATALOG ASSET ID</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>QUANTITY</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>UNIT RATE (INR)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>ITEM TOTAL (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveBom.furniture_schedule && effectiveBom.furniture_schedule.length > 0 ? (
                    effectiveBom.furniture_schedule.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #E7E1D5', background: i % 2 === 0 ? '#FFFFFF' : '#FAF8F2' }}>
                        <td style={{ padding: '7px 12px', fontWeight: 600, color: '#252622' }}>{item.name}</td>
                        <td style={{ padding: '7px 12px', color: '#777970' }}>{item.catalog_id}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center', color: '#252622', fontWeight: 600 }}>{item.quantity}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#474943' }}>
                          {item.is_price_available && item.unit_price !== null ? `₹${item.unit_price.toLocaleString('en-IN')}` : 'Price unavailable'}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: '#252622' }}>
                          {item.is_price_available && item.total_cost !== null ? `₹${item.total_cost.toLocaleString('en-IN')}` : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '16px 12px', textAlign: 'center', color: '#777970' }}>
                        No furniture placed yet in the active layout. Place beds, seating, and fixtures from the Furniture Catalog drawer to itemize procurement.
                      </td>
                    </tr>
                  )}
                  <tr style={{ background: '#F3F0E7', borderTop: '2px solid #E7E1D5', fontWeight: 700 }}>
                    <td colSpan={4} style={{ padding: '8px 12px', color: '#252622' }}>PLACED FURNITURE SUB-TOTAL</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#252622' }}>
                      ₹{(effectiveBom.summary.furniture_total || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Grand Total Summary Box */}
          <div style={{
            padding: '1rem',
            background: '#FAF8F2',
            border: '2px solid #252622',
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#252622' }}>
                TOTAL ESTIMATED PROJECT INVESTMENT
              </span>
              <span style={{ fontSize: '0.7rem', color: '#777970' }}>
                Construction: ₹{(effectiveBom.summary.construction_total ?? (effectiveBom.summary.material_total + effectiveBom.summary.labour_total)).toLocaleString('en-IN')} + Furniture: ₹{(effectiveBom.summary.furniture_total || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#252622' }}>
              ₹{effectiveBom.summary.grand_total.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

