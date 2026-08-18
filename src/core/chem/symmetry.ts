/**
 * 等效氢分析：Weisfeiler-Lehman 迭代细化求重原子等价类 → 氢类
 * 输出：等效氢种类数、每类个数/比例、一氯代物种类数
 */
import { type MoleculeGraph, adjacency } from './graph';

export interface HClassInfo {
  /** 该类氢所在的原子（代表原子） */
  atomIndices: number[];
  /** 该类氢总数 */
  count: number;
  /** 原子类型：CH / OH / NH */
  kind: 'CH' | 'OH' | 'NH';
  /** 简化化学位移（ppm） */
  shift: number;
}

export interface EquivalentHAnalysis {
  /** 氢类（按位移升序） */
  classes: HClassInfo[];
  /** 比例文本，如 3:2:1 */
  ratioText: string;
  /** 等效氢种类数 */
  classCount: number;
  /** 一氯代物种类数（碳上氢类数） */
  monochloroCount: number;
  /** 分子式 */
  formula: string;
}

/**
 * 重原子等价类：WL 迭代细化（返回每个重原子的等价类编号，非重原子为 -1）。
 * 供等效氢分析（analyzeEquivalentH）与顺反判定（geometric.ts）复用。
 */
export function equivalenceClasses(graph: MoleculeGraph): number[] {
  const n = graph.atoms.length;
  const adj = adjacency(graph);
  // 重原子：非 H
  const heavy: number[] = [];
  const heavyIdx = new Map<number, number>();
  graph.atoms.forEach((a, i) => {
    if (a.element !== 'H') {
      heavyIdx.set(i, heavy.length);
      heavy.push(i);
    }
  });
  const m = heavy.length;
  if (m === 0) return [];

  // 初始签名：元素 + 氢数 + 电荷 + 芳香性
  let classes = new Array<number>(m).fill(0);
  const sigToClass = new Map<string, number>();
  heavy.forEach((gi, i) => {
    const a = graph.atoms[gi];
    const sig = `${a.element}|${a.hCount}|${a.charge}|${a.aromatic ? 1 : 0}`;
    if (!sigToClass.has(sig)) sigToClass.set(sig, sigToClass.size);
    classes[i] = sigToClass.get(sig)!;
  });

  for (let iter = 0; iter < 12; iter++) {
    const newSigToClass = new Map<string, number>();
    const newClasses = new Array<number>(m).fill(0);
    for (let i = 0; i < m; i++) {
      const gi = heavy[i];
      const a = graph.atoms[gi];
      // 邻居签名（键级 + 邻居当前类）
      const neigh = adj[gi]
        .filter((x) => heavyIdx.has(x.to))
        .map((x) => `${x.order}:${classes[heavyIdx.get(x.to)!]}`)
        .sort()
        .join(',');
      const sig = `${a.element}|${a.hCount}|${a.charge}|${a.aromatic ? 1 : 0}|${neigh}`;
      if (!newSigToClass.has(sig)) newSigToClass.set(sig, newSigToClass.size);
      newClasses[i] = newSigToClass.get(sig)!;
    }
    // 收敛判断
    const same = newClasses.every((c, i) => c === classes[i]) && newSigToClass.size === sigToClass.size;
    classes = newClasses;
    sigToClass.clear();
    newSigToClass.forEach((v, k) => sigToClass.set(k, v));
    if (same) break;
  }

  const result = new Array<number>(n).fill(-1);
  heavy.forEach((gi, i) => {
    result[gi] = classes[i];
  });
  return result;
}

/** 判断某原子的环境（用于化学位移） */
function shiftOf(graph: MoleculeGraph, atomIdx: number, kind: 'CH' | 'OH' | 'NH'): number {
  const a = graph.atoms[atomIdx];
  const adj = adjacency(graph);
  if (kind === 'OH') {
    const cNeighbor = adj[atomIdx].find((x) => graph.atoms[x.to].element === 'C');
    if (!cNeighbor) return 4.5;
    if (graph.atoms[cNeighbor.to].aromatic) return 6.5; // 酚羟基
    // 羧酸羟基：连接的 C 双键连 O（δ~11.5）
    if (adj[cNeighbor.to].some((x) => x.order === 2 && graph.atoms[x.to].element === 'O')) return 11.5;
    return 4.5; // 醇羟基
  }
  if (kind === 'NH') return 1.6;
  // CH
  if (a.aromatic) {
    // 苯环 H：按取代调整
    const neighbors = adj[atomIdx];
    if (neighbors.some((x) => graph.atoms[x.to].element === 'O')) return 6.9; // 苯酚邻位
    return 7.2;
  }
  const h = a.hCount;
  // 检查邻居
  for (const nb of adj[atomIdx]) {
    const el = graph.atoms[nb.to].element;
    const order = nb.order;
    if (el === 'O' && order === 2) {
      // 醛氢（-CHO，δ~9.7）vs 羰基 α-CH3/CH2（CH3CO，δ~2.1）
      return h === 1 ? 9.7 : 2.1;
    }
    if (el === 'O') return h >= 3 ? 3.4 : 3.7; // C-O
    if (el === 'Br' || el === 'Cl' || el === 'F' || el === 'I') return 3.2;
    if (el === 'N') return 2.5;
    if (el === 'C' && order === 2) {
      // 双键碳上的氢：=CH2 → 5.1；=CH → 5.0（烯氢）
      return h >= 2 ? 5.1 : 5.0;
    }
    if (el === 'C' && order === 3) {
      // 三键碳上的氢：≡CH → 2.5（炔氢）
      return h === 1 ? 2.5 : 1.9;
    }
    if (el === 'C' && graph.atoms[nb.to].aromatic) return 2.3; // 苄基
    if (el === 'C') {
      if (adj[nb.to].some((x) => x.order === 2 && graph.atoms[x.to].element === 'O')) return 2.1; // 羰基 α-C（CH3CO-）
      if (adj[nb.to].some((x) => x.order === 2 && graph.atoms[x.to].element === 'C')) return 2.0; // 烯丙位 CH3/CH2
    }
  }
  if (h >= 3) return 0.9;
  if (h === 2) return 1.3;
  return 1.6;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** 等效氢分析主入口 */
export function analyzeEquivalentH(graph: MoleculeGraph): EquivalentHAnalysis {
  const classes = equivalenceClasses(graph);
  const adj = adjacency(graph);

  // 组：原子类 → H 计数与代表信息
  const groups = new Map<number, { count: number; atoms: number[]; kind: 'CH' | 'OH' | 'NH'; shift: number }>();
  graph.atoms.forEach((a, i) => {
    if (a.element === 'H' || a.hCount <= 0) return;
    const cls = classes[i];
    if (cls < 0) return;
    let kind: 'CH' | 'OH' | 'NH' = 'CH';
    if (a.element === 'O') kind = 'OH';
    else if (a.element === 'N') kind = 'NH';
    const entry = groups.get(cls) ?? { count: 0, atoms: [] as number[], kind, shift: 0 };
    entry.count += a.hCount;
    entry.atoms.push(i);
    entry.kind = kind;
    entry.shift = shiftOf(graph, i, kind);
    groups.set(cls, entry);
  });

  const classesArr: HClassInfo[] = [...groups.values()].map((g) => ({
    atomIndices: g.atoms,
    count: g.count,
    kind: g.kind,
    shift: g.shift,
  }));

  // 按位移排序
  classesArr.sort((a, b) => a.shift - b.shift);

  // 比例：最简整数比（单类保持原氢数）
  let ratioText: string;
  if (classesArr.length > 1) {
    const counts = classesArr.map((c) => c.count);
    let g = counts.reduce((acc, c) => gcd(acc, c), 0);
    if (g <= 0) g = 1;
    ratioText = counts.map((c) => c / g).join(':');
  } else {
    ratioText = String(classesArr[0]?.count ?? 0);
  }
  // 一氯代物种类数：碳上氢等效类数；醛氢（-CHO 的 H）不能氯代，不计入
  const isAldehydeH = (i: number): boolean => {
    const a = graph.atoms[i];
    return a.element === 'C' && a.hCount === 1 && adj[i].some((n) => n.order === 2 && graph.atoms[n.to].element === 'O');
  };
  const monochloroCount = new Set(
    classesArr
      .filter((c) => c.kind === 'CH')
      .flatMap((c) => c.atomIndices.filter((i) => !isAldehydeH(i)).map((i) => classes[i]))
  ).size;

  return {
    classes: classesArr,
    ratioText,
    classCount: classesArr.length,
    monochloroCount,
    formula: '',
  };
}
