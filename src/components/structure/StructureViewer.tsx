/**
 * StructureViewer：Kekule.js 结构渲染 + SVG 覆盖层（编号/球/高亮）
 * - 三视图：完整结构式（全部原子含 H，Kekule 隐式氢显示）/ 键线式 / 结构简式（文本）
 * - 原子像素坐标映射供覆盖层使用（覆盖层索引 = 分子图原子索引）
 */
import React, { useEffect, useRef, useState } from 'react';
import { molblockOf } from '../../core/rdkit';
import {
  atomCoords,
  estimateRenderBox,
  molFromMolblock,
  renderMolecule,
  transformCoordToContext,
  type KekuleRenderResult,
} from '../../core/kekule';
import { condensedFormula } from '../../core/chem/condensed';
import { parseSmiles as parseGraph } from '../../core/chem/graph';
import type { BuiltMolecule } from '../../core/naming/builder';

export type ViewMode = 'full' | 'skeletal' | 'condensed';

export interface AtomPixel {
  x: number;
  y: number;
  element: string;
}

export interface OverlayContext {
  pixels: Array<AtomPixel | null>;
  box: { x1: number; y1: number; x2: number; y2: number } | null;
  width: number;
  height: number;
}

export interface StructureViewerProps {
  smiles: string;
  viewMode?: ViewMode;
  width?: number;
  height?: number;
  /** 原子着色（索引 → 颜色） */
  atomColors?: Array<{ index: number; color: string }>;
  /** 覆盖层渲染函数（接收原子像素坐标） */
  overlay?: (ctx: OverlayContext) => React.ReactNode;
  bondLineWidth?: number;
  condensedOverride?: string;
  className?: string;
  onRendered?: (ctx: OverlayContext) => void;
  ariaLabel?: string;
}

export function StructureViewer({
  smiles,
  viewMode = 'full',
  width = 460,
  height = 340,
  atomColors,
  overlay,
  bondLineWidth,
  condensedOverride,
  className,
  onRendered,
  ariaLabel,
}: StructureViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixels, setPixels] = useState<Array<AtomPixel | null> | null>(null);
  const [box, setBox] = useState<OverlayContext['box']>(null);
  const [error, setError] = useState<string | null>(null);
  const renderRef = useRef<KekuleRenderResult | null>(null);
  const renderIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const id = ++renderIdRef.current;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      setError(null);
      setPixels(null);
      setBox(null);
      try {
        const mb = await molblockOf(smiles, { coords: true });
        if (!mb || cancelled || id !== renderIdRef.current) return;
        const mol = molFromMolblock(mb);
        renderRef.current?.destroy();
        const result = renderMolecule(container, mol, {
          width,
          height,
          displayType: 'skeletal',
          hydrogenLevel: viewMode === 'full' ? 'all' : 'none',
          nodeLabelMode: viewMode === 'full' ? 'shown' : 'smart',
          colors: { background: '#ffffff' },
          atomColors,
          bondLineWidth,
        });
        renderRef.current = result;
        const coords = atomCoords(mol);
        const box = estimateRenderBox(result);
        const nodes = mol.getNodes?.() ?? mol.getAtoms?.() ?? [];
        const px: Array<AtomPixel | null> = coords.map((c, i) => {
          if (!c) return null;
          const p = transformCoordToContext(result, c);
          let element = '';
          try {
            element = nodes[i]?.getElement() ?? '';
          } catch {
            /* ignore */
          }
          return { x: p.x, y: p.y, element };
        });
        if (cancelled || id !== renderIdRef.current) return;
        setPixels(px);
        setBox(box);
        onRendered?.({ pixels: px, box, width, height });
      } catch (e) {
        if (cancelled || id !== renderIdRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smiles, viewMode, atomColors, width, height, bondLineWidth]);

  useEffect(() => {
    return () => {
      renderRef.current?.destroy();
      renderRef.current = null;
    };
  }, []);

  const overlayCtx: OverlayContext = { pixels: pixels ?? [], box, width, height };

  return (
    <div className={`relative ${className ?? ''}`} style={{ width, height }} aria-label={ariaLabel}>
      <div ref={containerRef} style={{ width, height, position: 'absolute', inset: 0 }} />
      {viewMode === 'condensed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white rounded-lg">
          <span
            className="font-mono text-[22px] tracking-wide text-ink select-all"
            style={{ fontFamily: 'Consolas, "Courier New", "Microsoft YaHei", monospace' }}
          >
            {condensedOverride ?? (smiles ? condensedFormula(parseGraph(smiles)) : '')}
          </span>
        </div>
      )}
      {error && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-[13px] bg-white/80 rounded-lg">{error}</div>}
      {viewMode !== 'condensed' && pixels && (
        <svg width={width} height={height} className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
          {overlay ? overlay(overlayCtx) : null}
        </svg>
      )}
    </div>
  );
}

/** 由 BuiltMolecule 的教学标注生成原子着色（母体蓝/取代基红/官能团红/杂原子绿） */
export function colorizeBuilt(
  built: BuiltMolecule,
  colors: { skeleton: string; substituent: string; hetero: string }
): Array<{ index: number; color: string }> {
  const out: Array<{ index: number; color: string }> = [];
  const parentSet = new Set(built.chainAtomIndices);
  const subSet = new Set(built.substituentGroups.flatMap((g) => g.atomIndices));
  const fgSet = new Set(built.fgAtomIndices);
  built.graph.atoms.forEach((a, i) => {
    let color: string | null = null;
    if (parentSet.has(i) && a.element === 'C') color = colors.skeleton;
    else if (subSet.has(i) || fgSet.has(i)) color = colors.substituent;
    else if (a.element === 'C') color = colors.substituent;
    else color = colors.hetero;
    if (color) out.push({ index: i, color });
  });
  return out;
}

export type { BuiltMolecule };
