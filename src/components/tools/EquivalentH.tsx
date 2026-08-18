/**
 * 等效氢分析与氢谱模拟面板
 */
import React, { useEffect, useMemo, useState } from 'react';
import { analyzeEquivalentH, type HClassInfo } from '../../core/chem/symmetry';
import { analyzeChirality } from '../../core/chem/chirality';
import { parseSmiles } from '../../core/chem/graph';
import { StructureViewer } from '../structure/StructureViewer';
import { HighlightCirclesOverlay } from '../nameParse/overlays';
import { NmrSpectrum } from './NmrSpectrum';
import { Card, Hint } from '../common/ui';

const BASIC_SET: Array<{ name: string; smiles: string }> = [
  { name: '甲烷', smiles: 'C' },
  { name: '乙烷', smiles: 'CC' },
  { name: '丙烷', smiles: 'CCC' },
  { name: '正丁烷', smiles: 'CCCC' },
  { name: '异丁烷', smiles: 'CC(C)C' },
  { name: '新戊烷', smiles: 'CC(C)(C)C' },
  { name: '乙醇', smiles: 'CCO' },
  { name: '乙酸', smiles: 'CC(=O)O' },
  { name: '甲苯', smiles: 'Cc1ccccc1' },
  { name: '对二甲苯', smiles: 'Cc1ccc(C)cc1' },
];

/** 考试常考分子（高考/模拟题常见，如多官能团、烯/炔、芳烃等） */
const EXAM_SET: Array<{ name: string; smiles: string }> = [
  { name: '乙酸乙酯', smiles: 'CC(=O)OCC' },
  { name: '2-丁烯', smiles: 'CC=CC' },
  { name: '丙炔', smiles: 'CC#C' },
  { name: '乙醛', smiles: 'CC=O' },
  { name: '丙酮', smiles: 'CC(=O)C' },
  { name: '甘油（丙三醇）', smiles: 'OCC(O)CO' },
  { name: '苯乙烯', smiles: 'C=Cc1ccccc1' },
];

const CLASS_COLORS = ['#3b82f6', '#dc2626', '#059669', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16'];

export function EquivalentHPanel() {
  const [smiles, setSmiles] = useState('CCC');
  const analysis = useMemo(() => {
    try {
      return analyzeEquivalentH(parseSmiles(smiles));
    } catch {
      return null;
    }
  }, [smiles]);

  // 手性碳检测（后端接口已交付；未就绪/解析失败时返回 null，提示区不渲染）
  const chirality = useMemo(() => {
    try {
      return analyzeChirality(parseSmiles(smiles));
    } catch {
      return null;
    }
  }, [smiles]);

  // 每类氢的原子 → 颜色映射
  const atomClassColor = useMemo(() => {
    const map = new Map<number, string>();
    const a = analysis;
    if (!a) return map;
    a.classes.forEach((c, i) => {
      const color = CLASS_COLORS[i % CLASS_COLORS.length];
      // 同类氢的原子圈同一颜色（同类氢位于同类原子上）
      for (const ai of c.atomIndices) {
        if (!map.has(ai)) map.set(ai, color);
      }
    });
    return map;
  }, [analysis]);

  const atomsByClass = useMemo(() => {
    const out: Array<{ color: string; atoms: number[]; info: HClassInfo }> = [];
    const a = analysis;
    if (!a) return out;
    a.classes.forEach((c, i) => {
      out.push({ color: CLASS_COLORS[i % CLASS_COLORS.length], atoms: c.atomIndices, info: c });
    });
    return out;
  }, [analysis]);

  return (
    <div className="space-y-4">
      <Card title="等效氢分析" subtitle="同色圈 = 同一类等效氢（可相互替换的氢）">
        {chirality?.hasChiral && (
          <Hint kind="warn" className="mb-3">
            ⚠ 该分子含手性碳（连有 4 个不同基团），存在对映异构；教学中仅作提示，不做 R/S 命名。
          </Hint>
        )}
        <div className="space-y-2 mb-3">
          {[
            { label: '基础分子', set: BASIC_SET },
            { label: '考试常考', set: EXAM_SET },
          ].map(({ label, set }) => (
            <div key={label}>
              <div className="text-[12.5px] text-ink-soft mb-2 font-medium">{label}</div>
              <div className="flex flex-wrap gap-2">
                {set.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSmiles(t.smiles)}
                    className={`px-3 py-2 rounded-lg text-[13px] border transition-colors ${
                      smiles === t.smiles ? 'bg-primary text-white border-primary' : 'bg-white text-ink-soft border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          <input
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            placeholder="输入 SMILES"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40 h-[44px]"
          />
        </div>

        {analysis ? (
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center min-h-[400px] w-full">
              <StructureViewer
                smiles={smiles}
                viewMode="full"
                width={560}
                height={420}
                overlay={(ctx) => (
                  <g>
                    {atomsByClass.map((c, i) => (
                      <g key={i}>
                        <HighlightCirclesOverlay ctx={ctx} atoms={c.atoms} color={c.color} radius={15} dashed />
                      </g>
                    ))}
                  </g>
                )}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 w-full max-w-2xl">
              {analysis.classes.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-gray-200 px-4 py-3 bg-white">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: CLASS_COLORS[i % CLASS_COLORS.length] }} />
                  <div className="text-[13.5px] leading-relaxed">
                    <span className="font-bold text-ink">{c.count} 个氢</span>
                    <span className="text-ink-soft ml-1.5 block text-[12.5px] mt-0.5">
                      {c.kind === 'OH' ? '羟基H' : c.kind === 'NH' ? '氨基H' : '碳上H'} · δ {c.shift.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[13.5px] text-ink">
              共 <span className="font-bold text-primary-dark">{analysis.classCount}</span> 类等效氢，个数比{' '}
              <span className="font-bold">{analysis.ratioText}</span>，一氯代物有 <span className="font-bold">{analysis.monochloroCount}</span> 种
            </div>
            <button
              type="button"
              onClick={() => document.getElementById('nmr-spectrum-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-4 flex items-center justify-center gap-2 w-full max-w-md mx-auto rounded-xl border-2 border-dashed border-primary/40 bg-primary-light/20 px-4 py-3 text-[14px] font-medium text-primary-dark hover:bg-primary-light/40 hover:border-primary/60 transition-colors cursor-pointer"
            >
              <span> 查看模拟核磁共振氢谱（简化）→</span>
            </button>
          </div>
        ) : (
          <div className="text-ink-soft text-[13.5px]">请输入有效的 SMILES</div>
        )}
      </Card>

      {analysis && (
        <div id="nmr-spectrum-section">
          <Card title="模拟核磁共振氢谱（简化）" subtitle="峰高 ∝ 该类氢个数 · 横轴为化学位移 δ（ppm）">
          <div className="border-t border-gray-100 pt-4">
            <NmrSpectrum smiles={smiles} />
          </div>
          <div className="mt-3 text-[12.5px] text-ink-soft leading-relaxed">
            说明：本图为教学简化模拟，化学位移取常见区间代表值；真实谱图还受耦合分裂影响。
          </div>
        </Card>
        </div>
      )}
    </div>
  );
}
