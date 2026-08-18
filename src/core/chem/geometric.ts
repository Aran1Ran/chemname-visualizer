/**
 * 顺反异构"是否存在"判定（高中范围）
 * 规则：双键两端碳各连两个不同基团 → 存在顺反异构；不做 Z/E 命名。
 * 环内双键、一端两基团相同 → 不存在（教学简化）。
 */
import { type MoleculeGraph, adjacency } from './graph';
import { equivalenceClasses } from './symmetry';

export interface CisTransBond {
  /** 双键两端碳的图原子索引 */
  aIndex: number;
  bIndex: number;
  hasCisTrans: boolean;
  /** 教学文案 */
  reason: string;
}

export interface CisTransAnalysis {
  /** 分子内是否存在至少一个可顺反的双键 */
  hasCisTrans: boolean;
  /** C=C 双键总数 */
  bondCount: number;
  bonds: CisTransBond[];
}

type SideGroup = { kind: 'H' } | { kind: 'atom'; idx: number };

/** 双键碳 c 除 other 外的两个取代基（每个隐式 H 一组，每个重原子邻居一组） */
function sideGroups(graph: MoleculeGraph, c: number, other: number): SideGroup[] {
  const adj = adjacency(graph);
  const atom = graph.atoms[c];
  const others = adj[c].filter((x) => x.to !== other).map((x) => x.to);
  const groups: SideGroup[] = [];
  for (let k = 0; k < atom.hCount; k++) {
    groups.push({ kind: 'H' });
  }
  for (const o of others) {
    groups.push({ kind: 'atom', idx: o });
  }
  // 双键碳取代基恒为 2（价 4 − 双键 2）；取前 2 保险
  return groups.slice(0, 2);
}

/** 两个取代基是否等价（同为隐式 H 等价；重原子按 WL 等价类） */
function groupsEquivalent(graph: MoleculeGraph, classes: number[], g1: SideGroup, g2: SideGroup): boolean {
  if (g1.kind === 'H' && g2.kind === 'H') return true;
  if (g1.kind === 'H' || g2.kind === 'H') return false;
  return classes[g1.idx] === classes[g2.idx];
}

/** 一端两基团相同的教学文案 */
function sameGroupReason(groups: SideGroup[]): string {
  const [g1, g2] = groups;
  if (g1.kind === 'H' && g2.kind === 'H') return '一端连两个相同基团（=CH₂ 两个氢相同）';
  if (g1.kind === 'atom' && g2.kind === 'atom') return '一端连两个相同基团（如 =C(CH₃)₂）';
  return '一端连两个相同基团';
}

/** 除被检双键外，a、b 间是否存在另一条路径（即双键在环内） */
function hasAlternatePath(graph: MoleculeGraph, a: number, b: number, skip: { a: number; b: number }): boolean {
  const adj = adjacency(graph);
  const stack = [a];
  const visited = new Set<number>([a]);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const x of adj[cur]) {
      if ((x.to === skip.a && cur === skip.b) || (x.to === skip.b && cur === skip.a)) continue;
      if (x.to === b) return true;
      if (!visited.has(x.to)) {
        visited.add(x.to);
        stack.push(x.to);
      }
    }
  }
  return false;
}

/** 顺反异构判定主入口 */
export function analyzeCisTrans(graph: MoleculeGraph): CisTransAnalysis {
  const classes = equivalenceClasses(graph);
  const bonds: CisTransBond[] = [];
  let any = false;
  for (const b of graph.bonds) {
    if (b.order !== 2 || b.aromatic) continue;
    const aEl = graph.atoms[b.a].element;
    const bEl = graph.atoms[b.b].element;
    if (aEl !== 'C' || bEl !== 'C') continue;
    let hasCisTrans: boolean;
    let reason: string;
    if (hasAlternatePath(graph, b.a, b.b, b)) {
      hasCisTrans = false;
      reason = '环内双键不作顺反判定（高中范围）';
    } else {
      const ga = sideGroups(graph, b.a, b.b);
      const gb = sideGroups(graph, b.b, b.a);
      const aDiff = !groupsEquivalent(graph, classes, ga[0], ga[1]);
      const bDiff = !groupsEquivalent(graph, classes, gb[0], gb[1]);
      if (aDiff && bDiff) {
        hasCisTrans = true;
        reason = '两端碳各连两个不同基团';
      } else {
        hasCisTrans = false;
        reason = !aDiff ? sameGroupReason(ga) : sameGroupReason(gb);
      }
    }
    bonds.push({ aIndex: b.a, bIndex: b.b, hasCisTrans, reason });
    if (hasCisTrans) any = true;
  }
  return { hasCisTrans: any, bondCount: bonds.length, bonds };
}
