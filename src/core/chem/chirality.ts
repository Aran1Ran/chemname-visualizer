/**
 * 手性碳检测（v2 边界内：只检测 + 提示，不做 R/S 命名）
 * 判定口径（高中）：sp3 碳（含隐式 H 共 4 个单键）所连 4 个基团两两不同
 * （用 symmetry.ts 的 equivalenceClasses 判断等价性；同为 H 视为等价）。
 * 说明：本判定为"4 基团不同"简化口径——meso 化合物（如 2,3-二氯丁烷）的中心碳
 * 按此口径仍标记为手性碳，不额外做分子对称面判断（对映体计数/消旋不在范围内）。
 */
import { type MoleculeGraph, adjacency } from './graph';
import { equivalenceClasses } from './symmetry';

export interface ChiralAnalysis {
  /** 是否存在手性碳 */
  hasChiral: boolean;
  /** 手性碳的图原子索引（如 2-氯丁烷的 C2） */
  chiralAtomIndices: number[];
  /** 提示文案 */
  hint: string;
}

/** 判定一个 sp3 碳是否手性：4 个单键（含隐式 H），所连 4 个基团两两不等价 */
function isChiralCarbon(graph: MoleculeGraph, eq: number[], idx: number): boolean {
  const a = graph.atoms[idx];
  if (a.element !== 'C') return false;
  // sp3：重原子键级和 + 隐式 H = 4，且全部为单键（无双/三键/芳香键）
  // 注意：bondOrderSum 只计图中重原子键，隐式 H 在 hCount 中
  if (a.bondOrderSum + a.hCount !== 4) return false;
  const bonds = graph.bonds.filter((b) => b.a === idx || b.b === idx);
  if (bonds.some((b) => b.order !== 1)) return false;
  // 所连重原子（非 H）
  const heavyNeighbors = bonds.map((b) => (b.a === idx ? b.b : b.a)).filter((n) => graph.atoms[n].element !== 'H');
  const hCount = a.hCount;
  // 4 个基团 = 重原子基团 + H 组；H 数 ≥2 则 H 组自等（CH2/CH3 不可能手性）
  if (hCount >= 2) return false;
  if (heavyNeighbors.length + (hCount === 1 ? 1 : 0) !== 4) return false;
  // 重原子基团两两不同：等价类编号互异（等价的基团视为相同）
  const classIds = heavyNeighbors.map((n) => eq[n]);
  return new Set(classIds).size === heavyNeighbors.length;
}

export function analyzeChirality(graph: MoleculeGraph): ChiralAnalysis {
  const eq = equivalenceClasses(graph);
  const chiralAtomIndices: number[] = [];
  graph.atoms.forEach((_, i) => {
    if (isChiralCarbon(graph, eq, i)) chiralAtomIndices.push(i);
  });
  const hasChiral = chiralAtomIndices.length > 0;
  const hint = hasChiral
    ? '该碳连有 4 个不同基团，为手性碳，存在对映异构（教学中仅作提示，不做 R/S 命名）'
    : '未检测到手性碳：所有 sp3 碳的 4 个基团中均存在等价基团（或无非手性 sp3 碳）';
  return { hasChiral, chiralAtomIndices, hint };
}
