/**
 * 同分异构体浏览器：预设数据浏览 + 「高考大题模式」三步向导
 * 高考大题模式：分子式 → 官能团限制（多选）→ 分步枚举（后端契约驱动）。
 * 后端接口（src/core/chem/isomerEnum.ts 的 analyzeFormula / enumerateIsomers）
 * 未就绪时自动降级：按钮置灰 + 提示「能力开发中」；交付后自动启用，无需改动本文件。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ISOMER_SETS } from '../../data/isomerSets';
import { StructureViewer } from '../structure/StructureViewer';
import { Button, Card, Hint } from '../common/ui';

// ===================== 高考大题模式：后端契约占位类型 =====================
// 等 src/core/chem/isomerEnum.ts 交付后，替换为从该模块导入的真实类型（字段保持一致）
type IsomerClass =
  | 'alkane'
  | 'monohalo'
  | 'dihalo'
  | 'alcohol'
  | 'ether'
  | 'aldehyde'
  | 'ketone'
  | 'acid'
  | 'ester'
  | 'phenol'
  | 'aromatic-ether'
  | 'aromatic-alcohol';

interface FormulaCandidate {
  klass: string;
  label: string;
  reason: string;
  enumerable: boolean;
  /** 通式不兼容原因（后端可选字段；存在时说明该候选与分子式通式不符） */
  incompatible?: string;
}

interface FormulaAnalysis {
  formula: string;
  ok: boolean;
  elements: Record<string, number>;
  dbe: number;
  dbeNote: string;
  candidates: FormulaCandidate[];
  warning?: string;
}

interface IsomerEntry {
  smiles: string;
  name: string;
  formula: string;
  klass: string;
}

interface EnumStage {
  label: string;
  hint: string;
  groups: Array<{ title: string; isomers: IsomerEntry[] }>;
}

interface EnumResult {
  formula: string;
  classes: string[];
  count: number;
  isomers: IsomerEntry[];
  supported: boolean;
  warning?: string;
  stages?: EnumStage[];
}

interface IsomerEnumModule {
  analyzeFormula: (formula: string) => FormulaAnalysis | Promise<FormulaAnalysis>;
  enumerateIsomers: (query: { formula: string; classes: IsomerClass[] }) => EnumResult | Promise<EnumResult>;
}

const CLASS_LABELS: Record<string, string> = {
  alkane: '烷烃',
  monohalo: '一卤代',
  dihalo: '二卤代',
  alcohol: '醇',
  ether: '醚',
  aldehyde: '醛',
  ketone: '酮',
  acid: '羧酸',
  ester: '酯',
  phenol: '酚',
  'aromatic-ether': '芳香醚',
  'aromatic-alcohol': '芳香醇',
};

const ELEMENT_ORDER = ['C', 'H', 'O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I'];

/** 原子组成行：{C:4,H:8,O:2} → "C4 H8 O2" */
function formatElements(elements: Record<string, number>): string {
  return ELEMENT_ORDER.filter((el) => elements[el])
    .map((el) => `${el}${elements[el]}`)
    .join(' ');
}

export function IsomerBrowser() {
  // ===================== 原预设数据浏览（不动） =====================
  const [setKey, setSetKey] = useState('C5H12');
  const [mode, setMode] = useState<'reveal' | 'all'>('reveal');
  const [revealed, setRevealed] = useState(0);

  const set = useMemo(() => ISOMER_SETS.find((s) => s.key === setKey) ?? ISOMER_SETS[0], [setKey]);

  const switchSet = (key: string) => {
    setSetKey(key);
    setRevealed(0);
    setMode('reveal');
  };

  const visible = mode === 'all' ? set.isomers : set.isomers.slice(0, revealed);

  // ===================== 高考大题模式 =====================
  const [enumReady, setEnumReady] = useState(false); // 后端接口是否已交付
  const [formula, setFormula] = useState('');
  const [analysis, setAnalysis] = useState<FormulaAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [enumResult, setEnumResult] = useState<EnumResult | null>(null);
  const [enumerating, setEnumerating] = useState(false);
  const [revealAllSteps, setRevealAllSteps] = useState(false);
  const [revealedSteps, setRevealedSteps] = useState(0);
  const [enumNote, setEnumNote] = useState<string | null>(null);
  const modRef = useRef<IsomerEnumModule | null>(null);

  // 运行时自动检测接口就绪：动态 import（变量路径避免 TS 静态解析不存在的模块）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const modPath = '../../core/chem/isomerEnum';
        const mod = (await import(/* @vite-ignore */ modPath)) as IsomerEnumModule;
        if (alive && mod && typeof mod.analyzeFormula === 'function' && typeof mod.enumerateIsomers === 'function') {
          modRef.current = mod;
          setEnumReady(true);
        }
      } catch {
        /* 接口未就绪：保持 enumReady=false，按钮置灰 + 提示 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const runAnalysis = useCallback(async (f: string) => {
    const mod = modRef.current;
    if (!mod || !f.trim()) return;
    setAnalyzing(true);
    setEnumResult(null);
    setSelected([]);
    setEnumNote(null);
    try {
      const a = await mod.analyzeFormula(f.trim());
      setAnalysis(a);
    } catch {
      setAnalysis(null);
      setEnumNote('分析失败，请检查分子式格式');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // 输入后立即调用 analyzeFormula（250ms 防抖）
  useEffect(() => {
    if (!enumReady || !formula.trim()) return;
    const t = setTimeout(() => void runAnalysis(formula), 250);
    return () => clearTimeout(t);
  }, [formula, enumReady, runAnalysis]);

  // 接口就绪瞬间，自动分析当前已输入的内容
  useEffect(() => {
    if (enumReady && formula.trim()) void runAnalysis(formula);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enumReady]);

  const toggleClass = (klass: string) => {
    setSelected((s) => (s.includes(klass) ? s.filter((k) => k !== klass) : [...s, klass]));
  };

  const startEnumerate = useCallback(async () => {
    const mod = modRef.current;
    if (!mod || selected.length === 0) return;
    setEnumerating(true);
    setEnumNote(null);
    try {
      const r = await mod.enumerateIsomers({ formula: formula.trim(), classes: selected as IsomerClass[] });
      setEnumResult(r);
      setRevealedSteps(0);
      setRevealAllSteps(false);
      // 通式不兼容：自动取消全部选中（后端 supported:false 时整组不可枚举）
      if (!r.supported) setSelected([]);
    } catch {
      setEnumResult(null);
      setEnumNote('枚举失败，请稍后重试');
    } finally {
      setEnumerating(false);
    }
  }, [formula, selected]);

  const steps = enumResult?.stages ?? [];
  const visibleSteps = revealAllSteps ? steps : steps.slice(0, revealedSteps);

  return (
    <div className="space-y-4">
      {/* ===================== 原预设数据浏览 ===================== */}
      <Card
        title="同分异构体浏览器"
        subtitle={`${set.label} · ${set.description}（共 ${set.isomers.length} 种）`}
        actions={
          <div className="flex gap-3">
            <Button size="sm" variant={mode === 'reveal' ? 'primary' : 'secondary'} onClick={() => { setMode('reveal'); setRevealed(0); }}>
              逐个显示
            </Button>
            <Button size="sm" variant={mode === 'all' ? 'primary' : 'secondary'} onClick={() => setMode('all')}>
              全部显示
            </Button>
          </div>
        }
      >
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {ISOMER_SETS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => switchSet(s.key)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors whitespace-nowrap min-w-[80px] ${
                setKey === s.key ? 'bg-primary text-white border-primary' : 'bg-white text-ink-soft border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {mode === 'reveal' && revealed < set.isomers.length && (
          <div className="mb-4">
            <Button onClick={() => setRevealed((r) => r + 1)}>显示第 {revealed + 1} 个异构体（共 {set.isomers.length} 个）</Button>
            {revealed > 0 && (
              <Button variant="secondary" className="ml-2" onClick={() => setRevealed(0)}>
                重置
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visible.map((iso, i) => (
            <div key={iso.smiles} className="rounded-xl border border-gray-200 bg-white p-2 cv-fade-in" style={{ animationDelay: `${i * 120}ms` }}>
              <div className="text-[13.5px] font-semibold text-ink text-center mb-1">{iso.alias ? `${iso.name}（${iso.alias}）` : iso.name}</div>
              <div className="flex justify-center">
                <StructureViewer smiles={iso.smiles} viewMode="skeletal" width={220} height={170} />
              </div>
              <div className="text-center text-[12px] text-ink-soft mt-1 font-mono">{iso.formula}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ===================== 高考大题模式 ===================== */}
      <Card
        title="高考大题模式"
        subtitle="三步走：输入分子式 → 勾选官能团类别 → 分步枚举同分异构体（高考计数题）"
        actions={
          !enumReady ? (
            <span className="text-[12.5px] text-amber-600 font-semibold">能力开发中</span>
          ) : undefined
        }
      >
        {!enumReady && (
          <Hint kind="warn" className="mb-3">
            「高考大题模式」能力开发中：等待后端交付{' '}
            <code className="bg-amber-100 rounded px-1 font-mono">analyzeFormula</code> /{' '}
            <code className="bg-amber-100 rounded px-1 font-mono">enumerateIsomers</code>{' '}
            接口（<code className="bg-amber-100 rounded px-1 font-mono">src/core/chem/isomerEnum.ts</code>）后自动启用；当前可先使用上方预设数据浏览。
          </Hint>
        )}

        {/* 第一步：分子式输入与分析 */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-[14px] font-bold text-primary-dark bg-primary-light/50 px-2.5 py-1 rounded-lg">① 分子式</span>
          <input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="分子式，如 C4H8O2"
            className="flex-1 min-w-56 rounded-lg border border-gray-300 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button
            onClick={() => void runAnalysis(formula)}
            disabled={!enumReady || analyzing || !formula.trim()}
            title={!enumReady ? '能力开发中' : '分析分子式'}
          >
            {analyzing ? '分析中…' : '分析'}
          </Button>
        </div>

        {/* 分析结果卡 */}
        {analysis && analysis.ok === false ? (
          <Hint kind="error" className="mb-3">
            {analysis.warning ?? `无法分析分子式 ${analysis.formula}，请检查写法`}
          </Hint>
        ) : analysis ? (
          <div className="rounded-xl border border-primary-light bg-primary-light/20 px-4 py-3 mb-3">
            <div className="text-[22px] font-bold text-primary-dark">不饱和度 Ω = {analysis.dbe}</div>
            <div className="text-[13.5px] text-ink mt-1">{analysis.dbeNote}</div>
            <div className="text-[13.5px] font-mono text-ink-soft mt-1">{formatElements(analysis.elements)}</div>
            {analysis.warning && <div className="text-[12.5px] text-amber-700 mt-1">{analysis.warning}</div>}
          </div>
        ) : null}

        {/* 第二步：官能团限制（候选 chips 多选） */}
        {analysis && analysis.ok && (
          <div className="mb-3">
            <div className="text-[13.5px] font-semibold text-ink mb-1.5">
              ② 官能团限制（{selected.length > 0 ? `已选 ${selected.length} 类` : '请选择至少一个'}）
            </div>
            {analysis.candidates.length === 0 ? (
              <div className="text-[13px] text-ink-soft">该分子式暂无候选官能团分类</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {analysis.candidates.map((c) => {
                  const on = selected.includes(c.klass);
                  return (
                    <button
                      key={c.klass}
                      type="button"
                      disabled={!c.enumerable}
                      onClick={() => toggleClass(c.klass)}
                      title={c.incompatible ? `${c.incompatible}（${c.reason}）` : c.reason}
                      className={`relative px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
                        on
                          ? 'bg-primary text-white border-primary'
                          : c.enumerable
                            ? 'bg-white text-ink-soft border-gray-300 hover:bg-gray-50'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      {c.label}
                      {!c.enumerable && (
                        <span className="absolute -top-2 -right-1.5 bg-gray-400 text-white text-[10px] px-1 rounded-full leading-4 whitespace-nowrap max-w-40 truncate" title={c.incompatible ?? '暂不支持枚举'}>
                          {c.incompatible ? `已禁用：${c.incompatible}` : '暂不支持枚举'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Button
                onClick={() => void startEnumerate()}
                disabled={!enumReady || enumerating || selected.length === 0}
                title={selected.length === 0 ? '请先选择至少一个官能团类别' : '开始枚举'}
              >
                {enumerating ? '枚举中…' : '开始枚举'}
              </Button>
              {selected.length === 0 && <span className="text-[12.5px] text-ink-soft">请先选择至少一个官能团类别</span>}
            </div>
          </div>
        )}

        {/* 第三步：分步枚举结果 */}
        {enumResult ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-[15px] font-bold text-ink">
                共 {enumResult.count} 种同分异构体（按 {steps.length} 步展开）
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant={!revealAllSteps ? 'primary' : 'secondary'} onClick={() => { setRevealAllSteps(false); setRevealedSteps(0); }}>
                  逐步显示
                </Button>
                <Button size="sm" variant={revealAllSteps ? 'primary' : 'secondary'} onClick={() => setRevealAllSteps(true)} title="跳过步骤，直接显示最终结果">
                  跳过步骤，直接显示最终结果
                </Button>
              </div>
            </div>

            {enumResult.supported === false ? (
              <Hint kind="warn">
                该分子式不含所选官能团（如 醛/酮 通式 CnH2nO 与分子式不符），已清除选择。
                {enumResult.warning && <div className="mt-1 opacity-80">{enumResult.warning}</div>}
              </Hint>
            ) : steps.length === 0 ? (
              <Hint kind="info">未返回分步数据（共 {enumResult.count} 种）</Hint>
            ) : (
              <>
                {visibleSteps.map((st, k) => (
                  <div key={k} className="rounded-xl border border-gray-200 bg-white p-3.5 mb-3">
                    <div className="text-[14.5px] font-bold text-primary-dark">第 {k + 1} 步 · {st.label}</div>
                    <div className="mt-1.5 px-3 py-2 rounded-lg bg-blue-50 text-[13px] text-blue-900 leading-relaxed">{st.hint}</div>
                    <div className="mt-3 space-y-3">
                      {st.groups.map((g, gi) => (
                        <div key={gi}>
                          <div className="text-[13px] font-semibold text-ink mb-1.5">
                            {g.title}（{g.isomers.length} 种）
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {g.isomers.map((iso) => (
                              <div key={iso.smiles} className="rounded-xl border border-gray-200 bg-white p-2.5">
                                <div className="text-[13px] font-semibold text-ink text-center mb-1.5">{iso.name}</div>
                                <div className="flex justify-center">
                                  <StructureViewer smiles={iso.smiles} viewMode="skeletal" width={200} height={150} />
                                </div>
                                <div className="text-center text-[12px] text-ink-soft mt-1 font-mono">{iso.formula}</div>
                                <div className="text-center mt-1">
                                  <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-ink-soft">
                                    {CLASS_LABELS[iso.klass] ?? iso.klass}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!revealAllSteps && revealedSteps < steps.length && (
                  <div className="mb-2">
                    <Button onClick={() => setRevealedSteps((r) => r + 1)}>
                      显示第 {revealedSteps + 1} 步（共 {steps.length} 步）
                    </Button>
                    {revealedSteps > 0 && (
                      <Button variant="secondary" className="ml-2" onClick={() => setRevealedSteps(0)}>
                        重置
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : enumNote ? (
          <Hint kind="error">{enumNote}</Hint>
        ) : !analysis ? (
          <div className="text-center py-12 text-ink-soft">
            <div className="text-[16px] font-medium mb-2"> 请输入分子式开始分析</div>
            <div className="text-[13px] opacity-70">例如：CH₁₀、C₅H₁₂O、C₆H₁₂O₂，支持常见有机分子式格式</div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
