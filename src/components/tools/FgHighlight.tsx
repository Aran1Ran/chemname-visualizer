/**
 * 官能团高亮：SMARTS 匹配 → 目标原子红色、其他灰色圈出
 * 支持两种输入：SMILES 或 中文名称（自动解析）；含 SMILES 教学提示（碳碳双键等写法）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FUNCTIONAL_GROUPS, highlightFunctionalGroup } from '../../core/chem/fgroups';
import { getMol } from '../../core/rdkit';
import { GROUP_EXAMPLES } from '../../data/fgExamples';
import { parseAndBuild } from '../../core/naming/pipeline';
import { StructureViewer } from '../structure/StructureViewer';
import { HighlightCirclesOverlay } from '../nameParse/overlays';
import { Card, Collapse, Hint } from '../common/ui';
import { SMILES_HINTS, smileHintForError } from '../../data/smilesHints';

type InputMode = 'smiles' | 'name';

/** 官能团检验方法（后端将为 FUNCTIONAL_GROUPS 成员加可选字段 tests，此处为前端占位类型） */
interface FgTest {
  name: string;
  reagent: string;
  condition: string;
  phenomenon: string;
  equation?: string;
}

export function FgHighlight() {
  const [mode, setMode] = useState<InputMode>('smiles');
  const [smiles, setSmiles] = useState('CCO');
  const [nameInput, setNameInput] = useState('乙醇');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameOk, setNameOk] = useState(false);
  const [groupId, setGroupId] = useState('hydroxyl');
  const [hit, setHit] = useState<{ atoms: number[]; bonds: Array<[number, number]>; matchCount: number } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const group = useMemo(() => FUNCTIONAL_GROUPS.find((g) => g.id === groupId) ?? FUNCTIONAL_GROUPS[0], [groupId]);

  /** 名称 → SMILES（复用名称解析管线） */
  const resolveName = useCallback((name: string): string | null => {
    const r = parseAndBuild(name);
    if (!r.ok || !r.smiles) {
      setNameError(r.error?.message ?? '无法解析该名称');
      setNameOk(false);
      return null;
    }
    setNameError(null);
    setNameOk(true);
    return r.smiles;
  }, []);

  const applyName = useCallback(() => {
    const s = resolveName(nameInput);
    if (s) setSmiles(s);
  }, [nameInput, resolveName]);

  const activeSmiles = mode === 'name' ? (nameOk ? smiles : '') : smiles;

  useEffect(() => {
    if (!activeSmiles) {
      setHit(null);
      setInvalid(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    (async () => {
      // 先确认 SMILES 合法（getMol 失败即无法解析），避免把「写错」误报成「未找到」
      const mol = await getMol(activeSmiles);
      if (cancelled) return;
      if (!mol) {
        setInvalid(true);
        setHit(null);
        setBusy(false);
        return;
      }
      const r = await highlightFunctionalGroup(activeSmiles, group);
      if (!cancelled) {
        setInvalid(false);
        setHit(r ? { atoms: r.atoms, bonds: r.bonds, matchCount: r.matchCount } : null);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSmiles, group]);

  const smilesErrorHint = useMemo(() => smileHintForError(smiles), [smiles]);
  // 「未命中」：有输入、非忙碌、非非法 SMILES、且无匹配（结构图灰度化 + 醒目横幅）
  const miss = !!activeSmiles && !busy && !hit && !invalid;
  // 官能团检验方法（后端交付 tests 字段后自动出现；未交付时为空 → 不渲染该区）
  const tests = (group as { tests?: FgTest[] }).tests ?? [];

  return (
    <Card title="官能团高亮" subtitle="选择官能团类型，目标原子红色圈出，其余变灰">
      {/* 输入方式切换 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('smiles')}
            className={`px-3 py-1.5 text-[13px] font-medium ${mode === 'smiles' ? 'bg-primary text-white' : 'bg-white text-ink-soft hover:bg-gray-50'}`}
          >
            SMILES 输入
          </button>
          <button
            type="button"
            onClick={() => setMode('name')}
            className={`px-3 py-1.5 text-[13px] font-medium ${mode === 'name' ? 'bg-primary text-white' : 'bg-white text-ink-soft hover:bg-gray-50'}`}
          >
            中文名称输入
          </button>
        </div>
        {mode === 'name' && nameOk && (
          <span className="text-[12.5px] text-emerald-600">✓ 已解析为结构</span>
        )}
      </div>

      {mode === 'smiles' ? (
        <>
          <div className="flex flex-wrap gap-2 mb-1.5">
            <input
              value={smiles}
              onChange={(e) => setSmiles(e.target.value)}
              placeholder="SMILES，如 CCO、CC(=O)O、C=C（双键用 =）"
              className="rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] w-72 focus:outline-none focus:ring-2 focus:ring-primary/40 h-[44px]"
            />
            <div className="flex flex-wrap gap-2">
              {FUNCTIONAL_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupId(g.id)}
                  title={g.desc}
                  className={`px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                    groupId === g.id ? 'bg-red-600 text-white border-red-600' : 'bg-white text-ink-soft border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-2">
            <Collapse label="❓ 如何用 SMILES 输入（碳碳双键等写法）" defaultOpen>
              <div className="space-y-1">
                {SMILES_HINTS.map((h) => (
                  <div key={h.example} className="flex gap-2 text-[13px]">
                    <code className="bg-gray-100 rounded px-1.5 py-0.5 font-mono text-[12px] whitespace-nowrap">{h.example}</code>
                    <span className="text-ink-soft">{h.desc}</span>
                  </div>
                ))}
                <div className="pt-1 text-[12.5px] text-primary-dark">
                  提示：碳碳双键用 <code className="bg-blue-50 rounded px-1 font-mono">=</code> 表示，碳碳三键用{' '}
                  <code className="bg-blue-50 rounded px-1 font-mono">#</code> 表示。
                </div>
              </div>
            </Collapse>
          </div>
          {smilesErrorHint && (
            <div className="mb-2">
              <Hint kind="warn">{smilesErrorHint}</Hint>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-2 mb-1.5">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyName()}
            placeholder="输入中文名称，如：乙醇、2-丁烯、乙酸乙酯"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-[13.5px] w-72 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={applyName}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-primary text-white hover:bg-primary-dark"
          >
            解析名称
          </button>
          <div className="flex flex-wrap gap-2">
            {FUNCTIONAL_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                title={g.desc}
                className={`px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                  groupId === g.id ? 'bg-red-600 text-white border-red-600' : 'bg-white text-ink-soft border-gray-300 hover:bg-gray-50'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
          {nameError && (
            <div className="w-full">
              <Hint kind="error" closable onClose={() => setNameError(null)}>
                {nameError}
                <div className="mt-1 text-[12.5px] opacity-80">支持：乙醇、2-丁烯、乙酸、乙酸乙酯、对二甲苯、硝基苯 等系统名与常见俗名。</div>
              </Hint>
            </div>
          )}
          {mode === 'name' && nameOk && (
            <div className="w-full text-[12.5px] text-ink-soft">
              已解析为结构（SMILES：<code className="bg-gray-100 rounded px-1 font-mono">{smiles}</code>），以下为该结构中的官能团高亮。
            </div>
          )}
        </div>
      )}

      {/* 未命中时结构图整体灰度，强化「没找到」的视觉反馈 */}
      <div className={`flex items-center justify-center min-h-[400px] transition-all duration-300 ${miss ? 'opacity-80 grayscale' : ''}`}>
        <StructureViewer
          smiles={activeSmiles || 'CCO'}
          viewMode="skeletal"
          width={560}
          height={420}
          overlay={(ctx) =>
            hit ? (
              <g>
                {/* 非目标原子变灰：白色半透明层 + 灰色描边 */}
                <g>
                  {ctx.pixels.map((p, i) =>
                    p && !hit.atoms.includes(i) ? (
                      <circle key={i} cx={p.x} cy={p.y} r={13} fill="rgba(255,255,255,0.55)" />
                    ) : null
                  )}
                </g>
                <HighlightCirclesOverlay ctx={ctx} atoms={hit.atoms} color="#dc2626" radius={15} pulse />
              </g>
            ) : (
              <g />
            )
          }
        />
      </div>

      {/* 匹配结果状态区（教学醒目横幅） */}
      <div className="mt-3">
        {!activeSmiles ? (
          <div className="text-[13.5px] text-ink-soft">
            {mode === 'name' ? '请输入中文名称并点击「解析名称」后查看官能团匹配结果' : '请输入 SMILES，将实时匹配所选官能团'}
          </div>
        ) : busy ? (
          <div className="flex items-center gap-2.5 text-[14px] text-ink-soft">
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
            正在匹配 {group.name}…
          </div>
        ) : invalid ? (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-red-600 text-white flex items-center justify-center text-[15px] font-bold">✕</span>
              <div>
                <div className="text-[15px] font-bold text-red-800">无法解析该 SMILES</div>
                <div className="mt-0.5 text-[14px] text-red-900/90">
                  <code className="bg-red-100 rounded px-1 font-mono">{activeSmiles}</code> 不是合法的 SMILES 写法，请检查原子符号、括号与键符是否匹配。
                </div>
              </div>
            </div>
          </div>
        ) : hit ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[15px] font-bold">✓</span>
              <div>
                <div className="text-[15px] font-bold text-emerald-800">已找到 {group.name}</div>
                <div className="mt-0.5 text-[14px] text-emerald-900">
                  共 <b>{hit.matchCount}</b> 处、<b>{hit.atoms.length}</b> 个原子（{group.desc}），已在上方结构中红色圈出。
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3.5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-amber-500 text-white flex items-center justify-center text-[17px] font-bold animate-pulse">!</span>
              <div className="flex-1">
                <div className="text-[15.5px] font-bold text-amber-900">未找到「{group.name}」官能团</div>
                <div className="mt-1 text-[14px] leading-relaxed text-amber-900/90">
                  该分子（<code className="bg-amber-100 rounded px-1 font-mono">{activeSmiles}</code>）中没有 {group.desc}。
                </div>
                <div className="mt-2.5 text-[14px] font-semibold text-amber-900">👉 试试输入含该官能团的分子：</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(GROUP_EXAMPLES[group.id] ?? []).map((ex) => (
                    <button
                      key={ex.smiles}
                      type="button"
                      onClick={() => {
                        setMode('smiles');
                        setSmiles(ex.smiles);
                      }}
                      title={`点击加载 ${ex.label}（${ex.smiles}）并匹配 ${group.name}`}
                      className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[13.5px] font-medium text-amber-900 hover:bg-amber-100 hover:border-amber-400 active:scale-[0.98] transition-all"
                    >
                      {ex.label}
                      <code className="ml-1.5 font-mono text-[12px] text-amber-600">{ex.smiles}</code>
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 text-[13.5px] text-amber-800/85">或在上方切换其他官能团类型，继续检查该分子。</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 官能团检验方法（命中且该组有检验数据时显示） */}
      {hit && tests.length > 0 && (
        <div className="mt-4">
          <div className="text-[15px] font-bold text-ink mb-2"> 官能团检验方法</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tests.map((t, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4 bg-white">
                <div className="text-[14px] font-bold text-primary-dark mb-2">{t.name}</div>
                {t.equation && (
                  <div className="mb-2">
                    <Collapse label="方程式" defaultOpen>
                      <div className="font-mono text-[13px] leading-relaxed bg-gray-50 rounded-lg px-3 py-2">{t.equation}</div>
                    </Collapse>
                  </div>
                )}
                <div className="space-y-1.5 text-[13.5px]">
                  <div className="flex gap-1">
                    <span className="font-medium text-ink shrink-0">试剂：</span>
                    <span className="text-ink-soft">{t.reagent}</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="font-medium text-ink shrink-0">条件：</span>
                    <span className="text-ink-soft">{t.condition}</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="font-medium text-ink shrink-0">现象：</span>
                    <span className="text-ink-soft">{t.phenomenon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
