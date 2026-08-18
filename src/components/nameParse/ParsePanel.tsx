/**
 * 模块 1：名称 → 结构解析主面板
 * 输入 → 解析 → 结构显示（三视图）→ 分步解析动画 → 错误诊断
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseAndBuild, nameToStructure } from '../../core/naming/pipeline';
import { diagnose } from '../../core/naming/diagnostics';
import { nameGraph } from '../../core/reverse/namer';
import { tutorialTexts } from '../../core/naming/tutorial';
import { chainOnlySmiles } from '../../core/naming/chainOnly';
import type { BuiltMolecule } from '../../core/naming/builder';
import type { NamedResult } from '../../core/reverse/namer';
import type { Diagnosis } from '../../core/naming/diagnostics';
import { useApp } from '../../store/AppContext';
import { StructureViewer, colorizeBuilt, type OverlayContext } from '../structure/StructureViewer';
import { BallsOverlay, NumbersOverlay, HighlightCirclesOverlay, ArrowOverlay } from './overlays';
import { Button, Card, Hint, Collapse, StepIndicator } from '../common/ui';
import { adjacency } from '../../core/chem/graph';

const EXAMPLES = ['2-甲基丙烷', '3-甲基丁烷', '2,3-二甲基己烷', '1-丁烯', '3-甲基-1-丁醇', '乙酸乙酯', '对二甲苯', '硝基苯'];

/**
 * 取代基完整原子集（展示补偿）：builder 的 substituentGroups.atomIndices 只含根原子
 * （如乙基仅根碳），此处沿键 BFS 扩展出片段全部原子（排除主链原子），供标记圈选。
 */
function fullSubstituentAtoms(built: BuiltMolecule): number[] {
  const chain = new Set(built.chainAtomIndices);
  const adj = adjacency(built.graph);
  const out = new Set<number>();
  for (const g of built.substituentGroups) {
    const stack = [...g.atomIndices];
    while (stack.length) {
      const cur = stack.pop()!;
      if (out.has(cur) || chain.has(cur)) continue;
      out.add(cur);
      for (const x of adj[cur]) {
        if (!out.has(x.to) && !chain.has(x.to)) stack.push(x.to);
      }
    }
  }
  return [...out];
}

/** 碳碳双键/三键原子（展示补偿）：builder 的 fgAtomIndices 不含烯/炔双键碳，此处从图补出 */
function unsaturatedBondAtoms(built: BuiltMolecule): number[] {
  const out = new Set<number>();
  for (const b of built.graph.bonds) {
    if (b.order === 2 && built.graph.atoms[b.a]?.element === 'C' && built.graph.atoms[b.b]?.element === 'C') {
      out.add(b.a);
      out.add(b.b);
    }
  }
  return [...out];
}

interface MoleculeState {
  raw: string;
  built: BuiltMolecule;
  named: NamedResult;
  diagnosis: Diagnosis;
  formula: string;
  canonical: string;
}

export default function ParsePanel() {
  const { dispatch } = useApp();
  const [input, setInput] = useState('2-甲基丙烷');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mol, setMol] = useState<MoleculeState | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'skeletal' | 'condensed'>('full');
  const [step, setStep] = useState(0);
  const [playId, setPlayId] = useState(0); // 重新播放
  const [showDiagnosis, setShowDiagnosis] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 560, height: 400 });

  // 自适应画布尺寸
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setCanvasSize({ width: Math.max(320, w - 8), height: Math.min(520, Math.max(288, (w - 8) * 0.75)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const doParse = useCallback(
    async (name: string) => {
      if (!name.trim()) return;
      setBusy(true);
      setErrorMsg(null);
      try {
        const base = parseAndBuild(name);
        if (!base.ok || !base.built || !base.smiles) {
          setMol(null);
          setErrorMsg(base.error?.message ?? '无法解析该名称');
          return;
        }
        const r = await nameToStructure(name);
        if (!r.ok) {
          setMol(null);
          setErrorMsg(r.error?.message ?? '结构校验失败');
          return;
        }
        const built = base.built;
        const named = nameGraph(built.graph);
        const d = diagnose(name);
        const formula = r.formula ?? '';
        const state: MoleculeState = { raw: name, built, named, diagnosis: d, formula, canonical: r.canonicalSmiles ?? '' };
        setMol(state);
        setStep(0);
        setPlayId((p) => p + 1);
        setShowDiagnosis(true);
        dispatch({
          type: 'set-molecule',
          molecule: {
            smiles: state.built.smiles,
            canonicalSmiles: state.canonical,
            formula: state.formula,
            condensed: '',
            name: name.trim(),
            built: state.built,
            named: state.named,
          },
        });
      } finally {
        setBusy(false);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    void doParse('2-甲基丙烷');
  }, [doParse]);

  const texts = useMemo(() => (mol ? tutorialTexts(mol.built, mol.named) : null), [mol]);
  const stepSmiles = useMemo(() => {
    if (!mol) return null;
    if (step <= 1) return chainOnlySmiles(mol.built);
    return mol.built.smiles;
  }, [mol, step]);

  const overlayForStep = useCallback(
    (ctx: OverlayContext) => {
      if (!mol || !texts) return null;
      const colors = { skeleton: '#1d4ed8', substituent: '#dc2626', hetero: '#059669' };
      const chain = mol.named.chainAtomIndices;
      if (step === 0) {
        return (
          <g>
            <BallsOverlay ctx={ctx} atoms={chain.map((_, i) => i)} color={colors.skeleton} radius={11} delayBase={0} interval={260} hollow offsetX={2} offsetY={-3} strokeWidth={2} strokeOpacity={0.85} />
          </g>
        );
      }
      if (step === 1) {
        // 两种编号方向箭头（chainOnly 结构下像素索引 0..N-1 即链原子，仍用链端点索引保持健壮）
        const first = ctx.pixels[chain[0] ?? 0];
        const last = ctx.pixels[chain[chain.length - 1] ?? chain.length - 1];
        const numbering = chain.map((atomIdx, i) => ({ position: i + 1, atomIndex: atomIdx }));
        return (
          <g>
            {first && last && (
              <>
                <ArrowOverlay from={first} to={last} color="#f59e0b" label="方向A" delay={200} offset={8} />
                <ArrowOverlay from={last} to={first} color="#d1d5db" label="方向B" delay={500} offset={-8} />
              </>
            )}
            <NumbersOverlay ctx={ctx} numbering={numbering} delay={900} />
          </g>
        );
      }
      if (step === 2) {
        // 取代基红色空心球（完整片段原子）+ 官能团脉冲圈（含烯/双键碳补偿）
        const subAtoms = fullSubstituentAtoms(mol.built);
        const fgAtoms = [...new Set([...mol.built.fgAtomIndices, ...unsaturatedBondAtoms(mol.built)])];
        return (
          <g>
            <BallsOverlay ctx={ctx} atoms={subAtoms} color={colors.substituent} radius={9} delayBase={300} interval={300} hollow offsetX={1} offsetY={-3} strokeWidth={2} strokeOpacity={0.85} />
            <HighlightCirclesOverlay ctx={ctx} atoms={[...fgAtoms]} color={colors.substituent} radius={14} pulse />
          </g>
        );
      }
      return null;
    },
    [mol, texts, step]
  );

  const atomColors = useMemo(() => {
    if (!mol) return undefined;
    if (step === 3) return colorizeBuilt(mol.built, { skeleton: '#1d4ed8', substituent: '#dc2626', hetero: '#059669' });
    return undefined;
  }, [mol, step]);

  const isError = mol && !mol.diagnosis.isCorrect;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      {/* 左：输入与步骤控制 */}
      <div className="xl:col-span-2 space-y-4">
        <Card title="名称 → 结构" subtitle="输入中文系统命名（支持常见俗名）">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void doParse(input)}
              placeholder="例如：2-甲基丙烷、乙醇、乙酸乙酯"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button onClick={() => void doParse(input)} disabled={busy} className="shrink-0">
              {busy ? '解析中…' : '解析'}
            </Button>
          </div>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setInput(ex);
                  void doParse(ex);
                }}
                className="rounded-full bg-gray-100 px-3 py-1 text-[14px] text-ink-soft hover:bg-primary-light hover:text-primary-dark transition-colors whitespace-nowrap"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-[12.5px] text-ink-soft">
            试试复杂命名：3-乙基-2-甲基戊烷、2-羟基丙酸（乳酸）、乙二酸、乙酰胺、水杨酸、环己烯、甲基丙烯酸甲酯、氯乙酸、4-羟基-2-丁酮
          </div>
        </Card>

        {errorMsg && (
          <Hint kind="error" closable onClose={() => setErrorMsg(null)}>
            {errorMsg}
            <div className="mt-1 text-[12.5px] opacity-80">请检查名称格式：如「2-甲基丙烷」「3-甲基-1-丁醇」「乙酸乙酯」；支持全角逗号、多余空格、中文数字。</div>
          </Hint>
        )}

        {mol && texts && (
          <Card title="分步解析演示" subtitle="单击「下一步」逐帧推进，适合网课讲解">
            <div className="flex items-center justify-between mb-3">
              <StepIndicator total={4} current={step} labels={texts.map((t) => t.title)} />
              <Button variant="ghost" size="sm" onClick={() => setPlayId((p) => p + 1)} title="从头演示">
                ⟳ 重新播放
              </Button>
            </div>
            <div className="space-y-2">
              {texts.map((t, i) => (
                <div key={i} className={i === step ? 'block' : 'hidden'}>
                  <div className="text-[14px] font-semibold text-primary-dark mb-1">{i + 1}. {t.title}</div>
                  <div className="text-[14px] leading-relaxed text-ink">{t.text}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                ← 上一步
              </Button>
              <Button size="sm" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={step === 3}>
                下一步 →
              </Button>
              {step < 3 && (
                <Button variant="ghost" size="sm" onClick={() => setStep(3)} title="跳过步骤，直接显示最终结果">
                  跳过步骤，直接显示最终结果 →
                </Button>
              )}
            </div>
            <div className="mt-3">
              <Collapse label={`「为什么」——${texts[step].title}的规则`}>
                {texts[step].why}
              </Collapse>
            </div>
            {step === 3 && texts[3].checks && (
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {texts[3].checks.map((c) => (
                  <div key={c.label} className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
                    <span className="text-emerald-600">{c.ok ? '✓' : '✗'}</span>
                    <span className="font-medium text-ink">{c.label}</span>
                    <span className="truncate">{c.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {mol && isError && showDiagnosis && (
          <Card title="错误诊断" className="border-red-200">
            <Hint kind="warn" closable onClose={() => setShowDiagnosis(false)}>
              <div className="font-semibold mb-1">{mol.diagnosis.message}</div>
              <div className="mt-2 space-y-1">
                {mol.diagnosis.checks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span>{c.ok ? '✅' : '❌'}</span>
                    <span className="font-medium">{c.label}：</span>
                    <span>{c.detail}</span>
                  </div>
                ))}
              </div>
            </Hint>
            <div className="mt-3">
              <StructureCompare mol={mol} />
            </div>
          </Card>
        )}
      </div>

      {/* 右：画布 */}
      <div className="xl:col-span-3 space-y-4">
        <Card
          title={mol ? `结构：${mol.raw}` : '结构'}
          subtitle={mol ? `分子式 ${mol.formula || '—'} · ${mol.named.name}` : undefined}
          actions={
            <div className="flex gap-1">
              {(['full', 'skeletal', 'condensed'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                    viewMode === m ? 'bg-primary text-white border-primary' : 'bg-white text-ink-soft border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {m === 'full' ? '完整结构式' : m === 'skeletal' ? '键线式' : '结构简式'}
                </button>
              ))}
            </div>
          }
        >
          <div ref={containerRef} className="w-full" key={playId}>
            {mol && stepSmiles ? (
              <StructureViewer
                smiles={stepSmiles}
                viewMode={viewMode}
                width={canvasSize.width}
                height={canvasSize.height}
                atomColors={atomColors}
                overlay={viewMode === 'condensed' ? undefined : overlayForStep}
              />
            ) : (
              <div className="flex items-center justify-center text-ink-soft text-[14px]" style={{ height: 380 }}>
                请输入名称开始解析
              </div>
            )}
          </div>
          {mol && (
            <div className="mt-2 flex items-center justify-between text-[13px] text-ink-soft">
              <span>SMILES：{mol.built.smiles}</span>
              <span className="font-mono">{mol.formula}</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** 错误结构与正确结构对比（同一分子，不同编号标注） */
function StructureCompare({ mol }: { mol: MoleculeState }) {
  // 像素索引 = 图原子索引；chainAtomIndices 按位次给出图原子索引
  const inputNumbering = mol.built.chainAtomIndices.map((atomIdx, i) => ({ position: i + 1, atomIndex: atomIdx }));
  const correctNumbering = mol.named.chainAtomIndices.map((atomIdx, i) => ({ position: i + 1, atomIndex: atomIdx }));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <div className="text-[13px] font-semibold text-red-600 mb-1">错误结构（按您的输入）</div>
        <div className="border border-gray-200 rounded-lg p-1.5 bg-white">
          <StructureViewer
            smiles={mol.built.smiles}
            viewMode="skeletal"
            width={260}
            height={190}
            overlay={(ctx) => <NumbersOverlay ctx={ctx} numbering={inputNumbering} color="#b91c1c" fontSize={16} offset={15} />}
          />
        </div>
      </div>
      <div>
        <div className="text-[13px] font-semibold text-emerald-600 mb-1">正确结构（按命名规则）</div>
        <div className="border border-gray-200 rounded-lg p-1.5 bg-white">
          <StructureViewer
            smiles={mol.built.smiles}
            viewMode="skeletal"
            width={260}
            height={190}
            overlay={(ctx) => <NumbersOverlay ctx={ctx} numbering={correctNumbering} color="#047857" fontSize={16} offset={15} />}
          />
        </div>
      </div>
    </div>
  );
}
