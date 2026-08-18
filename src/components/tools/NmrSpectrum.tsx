/**
 * 简化核磁共振氢谱（SVG 自绘）
 */
import React, { useMemo } from 'react';
import { buildNmr, type NmrPeak } from '../../core/chem/nmr';
import { parseSmiles } from '../../core/chem/graph';

export function NmrSpectrum({ smiles, width = 560, height = 260 }: { smiles: string; width?: number; height?: number }) {
  const data = useMemo(() => {
    try {
      return buildNmr(parseSmiles(smiles));
    } catch {
      return null;
    }
  }, [smiles]);

  // 同位移峰水平微错开：按 shift 分组，组内第 i 个峰 x 偏移 (i-(n-1)/2)*16px，
  // 使同位移的多个峰（如甘油 3.7/3.7、苯乙烯环区 7.2×3）并排可见，标注互不遮挡
  const laidOut = useMemo(() => {
    if (!data) return [] as Array<NmrPeak & { index: number; dx: number; grouped: boolean }>;
    const groups = new Map<number, number[]>();
    data.peaks.forEach((p, i) => {
      const key = Math.round(p.shift * 10); // 避免浮点误差
      const arr = groups.get(key);
      if (arr) arr.push(i);
      else groups.set(key, [i]);
    });
    return data.peaks.map((p, i) => {
      const members = groups.get(Math.round(p.shift * 10))!;
      const n = members.length;
      const idx = members.indexOf(i);
      return { ...p, index: i, dx: (idx - (n - 1) / 2) * 16, grouped: n > 1 };
    });
  }, [data]);

  if (!data) return <div className="text-[13px] text-ink-soft">无法生成氢谱</div>;

  const { peaks, xMin, xMax, totalH, analysis } = data;
  const margin = { l: 40, r: 16, t: 24, b: 34 };
  const plotW = width - margin.l - margin.r;
  const plotH = height - margin.t - margin.b;
  const px = (ppm: number) => margin.l + ((xMax - ppm) / (xMax - xMin)) * plotW; // 位移右大左小
  const maxCount = Math.max(...peaks.map((p) => p.count), 1);
  const py = (count: number) => margin.t + plotH - (count / maxCount) * plotH * 0.78 - plotH * 0.04;

  return (
    <div>
      <svg width={width} height={height} className="bg-white rounded-lg border border-gray-200">
        {/* 轴 */}
        <line x1={margin.l} y1={margin.t + plotH} x2={width - margin.r} y2={margin.t + plotH} stroke="#374151" strokeWidth={1.5} />
        <line x1={margin.l} y1={margin.t} x2={margin.l} y2={margin.t + plotH} stroke="#374151" strokeWidth={1.5} />
        {/* 刻度（每 1 ppm） */}
        {Array.from({ length: Math.floor(xMax - xMin) + 1 }, (_, k) => {
          const ppm = Math.round(xMin + k);
          if (ppm > xMax) return null;
          return (
            <g key={ppm}>
              <line x1={px(ppm)} y1={margin.t + plotH} x2={px(ppm)} y2={margin.t + plotH + 5} stroke="#9ca3af" />
              <text x={px(ppm)} y={margin.t + plotH + 18} textAnchor="middle" fontSize={11} fill="#6b7280">
                {ppm}
              </text>
            </g>
          );
        })}
        {/* 峰（同位移峰按分组水平错开） */}
        {laidOut.map((p) => {
          const x = Math.min(Math.max(px(p.shift) + p.dx, margin.l + 10), width - margin.r - 10); // clamp 防出界
          const y = py(p.count);
          const h = margin.t + plotH - y;
          const w = Math.max(18, 40 - laidOut.length * 2);
          return (
            <g key={p.index}>
              {/* 积分台阶（峰面积比） */}
              <path
                d={`M ${x - w / 2} ${y + h} L ${x - w / 2} ${y + h * 0.45} L ${x + w / 2} ${y + h * 0.45} L ${x + w / 2} ${y + h}`}
                fill="none"
                stroke={p.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {/* 峰形 */}
              <path
                d={`M ${x - w} ${y + h} Q ${x - w / 2} ${y - h * 0.15} ${x} ${y} Q ${x + w / 2} ${y - h * 0.15} ${x + w} ${y + h}`}
                fill="none"
                stroke={p.color}
                strokeWidth={2.2}
              />
              {/* 标注：nH 与 δ x.x；同位移多峰时补「第k类」区分（k=分析中的类序号，与面板颜色对应） */}
              <text x={x} y={y - 10} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={p.color}>
                {p.count}H
              </text>
              <text x={x} y={y - h * 0.28 - 4} textAnchor="middle" fontSize={10.5} fill="#6b7280">
                δ {p.shift.toFixed(1)}
                {p.grouped ? ` · 第${p.index + 1}类` : ''}
              </text>
            </g>
          );
        })}
        <text x={width / 2} y={height - 4} textAnchor="middle" fontSize={12} fill="#374151">
          化学位移 δ / ppm
        </text>
      </svg>
      {/* 统计 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="font-semibold text-ink">{analysis.classCount} 类等效氢</span>
        <span className="text-ink-soft">比例 {analysis.ratioText || '—'}</span>
        <span className="text-ink-soft">一氯代物 {analysis.monochloroCount} 种</span>
        <span className="text-ink-soft">总氢数 {totalH}</span>
      </div>
    </div>
  );
}
