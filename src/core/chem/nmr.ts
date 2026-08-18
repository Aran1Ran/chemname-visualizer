/**
 * 氢谱模拟模型：由等效氢分析结果生成简化 NMR 谱数据
 */
import { analyzeEquivalentH, type EquivalentHAnalysis } from './symmetry';
import { type MoleculeGraph } from './graph';

export interface NmrPeak {
  shift: number;
  count: number;
  kind: string;
  ratio: string;
  /** 峰颜色（按类） */
  color: string;
}

export interface NmrData {
  peaks: NmrPeak[];
  /** x 轴范围（ppm） */
  xMin: number;
  xMax: number;
  /** 总氢数 */
  totalH: number;
  analysis: EquivalentHAnalysis;
}

const CLASS_COLORS = ['#3b82f6', '#dc2626', '#059669', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16'];

export function buildNmr(graph: MoleculeGraph): NmrData {
  const analysis = analyzeEquivalentH(graph);
  const peaks: NmrPeak[] = analysis.classes.map((c, i) => ({
    shift: c.shift,
    count: c.count,
    kind: c.kind,
    ratio: String(c.count),
    color: CLASS_COLORS[i % CLASS_COLORS.length],
  }));
  const shifts = peaks.map((p) => p.shift);
  const xMin = shifts.length ? Math.max(0, Math.min(...shifts) - 1.2) : 0;
  const xMax = shifts.length ? Math.min(13, Math.max(...shifts) + 1.2) : 12;
  const totalH = peaks.reduce((s, p) => s + p.count, 0);
  return { peaks, xMin, xMax, totalH, analysis };
}
