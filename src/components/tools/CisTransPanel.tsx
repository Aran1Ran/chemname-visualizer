/**
 * 顺反异构判定面板：输入分子 → 判定每个 C=C 双键两端碳是否各连两个不同基团
 * （存在顺反异构）；顺反双键用粗红线高亮，其余双键普通灰线。仅做展示。
 * 后端接口（src/core/chem/geometric.ts 的 analyzeCisTrans）未就绪时自动降级提示，
 * 交付后自动启用（运行时动态 import 检测）。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { parseAndBuild } from '../../core/naming/pipeline';
import { parseSmiles } from '../../core/chem/graph';
import { StructureViewer } from '../structure/StructureViewer';
import { Card, Hint } from '../common/ui';

// ---- 后端契约占位类型（src/core/chem/geometric.ts 交付后替换为真实导入）----
interface CisBondInfo {
  aIndex: number;
  bIndex: number;
  hasCisTrans: boolean;
  reason: string;
}
interface CisTransAnalysis {
  hasCisTrans: boolean;
  bondCount: number;
  bonds: CisBondInfo[];
}
interface GeometricModule {
  analyzeCisTrans: (graph: unknown) => CisTransAnalysis;
}

type InputMode = 'smiles' | 'name';

export function CisTransPanel() {
  const [mode, setMode] = useState<InputMode>('smiles');
  const [smiles, setSmiles] = useState('CC=CC');
  const [nameInput, setNameInput] = useState('2-丁烯');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameOk, setNameOk] = useState(false);
  const [analysis, setAnalysis] = useState<CisTransAnalysis | null>(null);
  const [ready, setReady] = useState(false); // 后端接口是否已交付
  const modRef = useRef<GeometricModule | null>(null);

  // 运行时自动检测接口就绪（变量路径避免 TS 静态解析不存在的模块）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const modPath = '../../core/chem/geometric';
        const mod = (await import(/* @vite-ignore */ modPath)) as GeometricModule;
        if (alive && mod && typeof mod.analyzeCisTrans === 'function') {
          modRef.current = mod;
          setReady(true);
        }
      } catch {
        /* 接口未就绪：保持 ready=false，提示「能力开发中」 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  // 输入变化即自动判定（接口未就绪时跳过）
  useEffect(() => {
    if (!ready || !activeSmiles) {
      setAnalysis(null);
      return;
    }
    try {
      const graph = parseSmiles(activeSmiles);
      setAnalysis(modRef.current!.analyzeCisTrans(graph));
    } catch {
      setAnalysis(null);
    }
  }, [ready, activeSmiles]);

  const highlightCount = analysis?.bonds.filter((b) => b.hasCisTrans).length ?? 0;

  return (
    <Card title="顺反异构判定" subtitle="C=C 双键两端碳各连两个不同基团 → 存在顺反异构（不做 Z/E 命名）">
      {!ready && (
        <Hint kind="warn" className="mb-3">
          「顺反异构判定」能力开发中：等待后端交付{' '}
          <code className="bg-amber-100 rounded px-1 font-mono">analyzeCisTrans</code>{' '}
          接口（<code className="bg-amber-100 rounded px-1 font-mono">src/core/chem/geometric.ts</code>）后自动启用。
        </Hint>
      )}

      {/* 输入方式切换 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('smiles')}
            className={`px-4 py-2 text-[14px] font-medium ${mode === 'smiles' ? 'bg-primary text-white' : 'bg-white text-ink-soft hover:bg-gray-50'}`}
          >
            SMILES 输入
          </button>
          <button
            type="button"
            onClick={() => setMode('name')}
            className={`px-4 py-2 text-[14px] font-medium ${mode === 'name' ? 'bg-primary text-white' : 'bg-white text-ink-soft hover:bg-gray-50'}`}
          >
            中文名称输入
          </button>
        </div>
        {mode === 'name' && nameOk && <span className="text-[13px] text-emerald-600 font-medium">✓ 已解析为结构</span>}
      </div>

      {mode === 'smiles' ? (
        <input
          value={smiles}
          onChange={(e) => setSmiles(e.target.value)}
          placeholder="SMILES，如 CC=CC（2-丁烯）"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] w-72 focus:outline-none focus:ring-2 focus:ring-primary/40 h-[44px]"
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyName()}
            placeholder="中文名称，如：2-丁烯、2-戊烯、乙烯"
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] w-72 focus:outline-none focus:ring-2 focus:ring-primary/40 h-[44px]"
          />
          <button
            type="button"
            onClick={applyName}
            className="px-4 py-2.5 rounded-lg text-[14px] font-medium bg-primary text-white hover:bg-primary-dark h-[44px]"
          >
            解析名称
          </button>
          {nameError && (
            <div className="w-full">
              <Hint kind="error" closable onClose={() => setNameError(null)}>
                {nameError}
              </Hint>
            </div>
          )}
        </div>
      )}

      {/* 结构区：顺反双键粗红线，其余双键普通线 */}
      <div className="flex items-center justify-center min-h-[400px] mt-3">
        <StructureViewer
          smiles={activeSmiles || 'CC=CC'}
          viewMode="skeletal"
          width={560}
          height={420}
          overlay={(ctx) => (
            <g>
              {(analysis?.bonds ?? []).map((b, i) => {
                const p1 = ctx.pixels[b.aIndex];
                const p2 = ctx.pixels[b.bIndex];
                if (!p1 || !p2) return null;
                return (
                  <line
                    key={i}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={b.hasCisTrans ? '#dc2626' : '#94a3b8'}
                    strokeWidth={b.hasCisTrans ? 4 : 2}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}
        />
      </div>

      {/* 结果区 */}
      <div className="mt-5 space-y-3">
        {!activeSmiles ? (
          <div className="text-[13.5px] text-ink-soft">
            {mode === 'name' ? '请输入中文名称并点击「解析名称」' : '输入分子后自动判定'}
          </div>
        ) : !ready ? (
          <div className="text-[13.5px] text-ink-soft">接口就绪后自动判定（当前能力开发中）</div>
        ) : !analysis ? (
          <div className="text-[13.5px] text-ink-soft">无法解析该分子</div>
        ) : analysis.hasCisTrans ? (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3.5 shadow-sm">
            <div className="text-[15px] font-bold text-red-800">该分子存在顺反异构（C=C 两端碳各连两个不同基团）</div>
            <div className="mt-1 text-[13.5px] text-red-900/90 leading-relaxed">
              共 {analysis.bondCount} 个双键，其中 {highlightCount} 个存在顺反异构（粗红线标出）
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5">
            <div className="text-[15px] font-bold text-ink">该分子不存在顺反异构</div>
            {analysis.bonds.length > 0 && (
              <div className="mt-2 space-y-1">
                {analysis.bonds.map((b, i) => (
                  <div key={i} className="text-[13px] text-ink-soft">
                    第 {i + 1} 个双键：{b.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
