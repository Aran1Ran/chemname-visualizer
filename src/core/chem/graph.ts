/**
 * 分子图结构（自有实现）
 * - SMILES 解析器：覆盖高中教学范围（链/支链/双键三键/芳香环/括号原子/电荷/显式 H）
 * - 隐氢计算、分子式统计、环标记等基础工具
 * RDKit 负责校验与规范化；本图结构用于命名、对称性、分子式、结构简式等分析。
 */

export interface GAtom {
  element: string;
  aromatic: boolean;
  charge: number;
  isotope: number | null;
  explicitH: number; // 括号内显式 H（[NH2] → 2）
  hCount: number; // 计算后的总氢数
  bondOrderSum: number; // 键级和（芳香键按 1.5）
  inRing: boolean;
  originalIndex: number;
  /** 教学标注：母体/取代基/官能团等 */
  label?: string;
  /** 主链位次（1..N），母体链原子 */
  chainPos?: number;
  /** 教学分组 id（如取代基组名） */
  groupName?: string;
}

export interface GBond {
  a: number;
  b: number;
  order: number; // 1 | 2 | 3 | 1.5
  aromatic: boolean;
}

export interface MoleculeGraph {
  smiles: string;
  atoms: GAtom[];
  bonds: GBond[];
}

/** 元素价态表（中性） */
const VALENCE: Record<string, number> = {
  C: 4,
  N: 3,
  O: 2,
  S: 2,
  P: 3,
  F: 1,
  Cl: 1,
  Br: 1,
  I: 1,
  B: 3,
  Si: 4,
  H: 1,
};

const ORGANIC_SINGLE = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'I', 'H']);
const ORGANIC_DOUBLE = new Set(['Cl', 'Br']);
const KNOWN_SINGLE = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'I', 'H']);
const KNOWN_DOUBLE = new Set(['Cl', 'Br', 'Si', 'Se', 'Sn']);
const AROMATIC = new Set(['c', 'n', 'o', 's', 'p']);

export class SmilesParseError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(`SMILES 解析错误 @${position}: ${message}`);
    this.position = position;
  }
}

/** 解析 SMILES 为分子图（教学子集）。失败抛 SmilesParseError。 */
export function parseSmiles(smiles: string): MoleculeGraph {
  const s = smiles.trim();
  const atoms: GAtom[] = [];
  const bonds: GBond[] = [];
  const ringClosures = new Map<number, { atom: number; order: number }>();
  const stack: number[] = []; // 分支返回栈（当前原子索引栈底为链起点）
  let prevAtom: number | null = null;
  let pendingBond = 0; // 0 = 隐式，1/2/3/1.5
  let i = 0;

  const addAtom = (element: string, aromatic: boolean, explicitH: number, charge: number, isotope: number | null): number => {
    const idx = atoms.length;
    atoms.push({
      element,
      aromatic,
      charge,
      isotope,
      explicitH,
      hCount: 0,
      bondOrderSum: 0,
      inRing: false,
      originalIndex: idx,
    });
    return idx;
  };

  const addBond = (a: number, b: number, order: number): void => {
    bonds.push({ a, b, order, aromatic: order === 1.5 });
  };

  const connect = (a: number, b: number, order: number): void => {
    addBond(a, b, order);
    atoms[a].bondOrderSum += order;
    atoms[b].bondOrderSum += order;
  };

  const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

  const readBracket = (): void => {
    // 假定 i 指向 '['，解析到匹配的 ']'
    let j = i + 1;
    let isotope: number | null = null;
    let element = '';
    let charge = 0;
    let explicitH = 0;
    // isotope
    if (isDigit(s[j])) {
      let num = '';
      while (j < s.length && isDigit(s[j])) {
        num += s[j];
        j++;
      }
      isotope = parseInt(num, 10);
    }
    // element（1-2 字符）
    if (j < s.length && /[A-Z]/.test(s[j])) {
      element = s[j];
      j++;
      if (j < s.length && /[a-z]/.test(s[j]) && element !== 'H') {
        element += s[j];
        j++;
      }
    } else if (j < s.length && /[a-z]/.test(s[j])) {
      // 芳香原子 in bracket 较少见，简单支持 [nH]
      element = s[j];
      j++;
    } else {
      throw new SmilesParseError('括号内缺少元素符号', j);
    }
    // 内部内容：H 数、电荷（简化为顺序无关的常见形式 [NH2]、[O-]、[N+](=O)、[2+]/[+2]）
    let inner = s.slice(j, s.indexOf(']', j) === -1 ? s.length : s.indexOf(']', j));
    // 提取显式 H
    const hMatch = inner.match(/H(\d?)/);
    if (hMatch) {
      explicitH = hMatch[1] ? parseInt(hMatch[1], 10) : 1;
    }
    // 提取电荷
    const chargeMatch = inner.match(/([+-])(\d?)|(\d)([+-])/);
    if (chargeMatch) {
      if (chargeMatch[1]) {
        const n = chargeMatch[2] ? parseInt(chargeMatch[2], 10) : 1;
        charge = chargeMatch[1] === '+' ? n : -n;
      } else if (chargeMatch[3]) {
        const n = parseInt(chargeMatch[3], 10);
        charge = chargeMatch[4] === '+' ? n : -n;
      }
    }
    const end = s.indexOf(']', j);
    if (end === -1) throw new SmilesParseError('括号未闭合', j);
    i = end + 1;
    const aromatic = AROMATIC.has(element);
    const idx = addAtom(element, aromatic, explicitH, charge, isotope);
    attach(idx);
  };

  const attach = (idx: number): void => {
    // 与上一原子成键（若有 pendingBond）
    if (prevAtom !== null) {
      let order = pendingBond;
      if (order === 0) {
        order = atoms[idx].aromatic && atoms[prevAtom].aromatic ? 1.5 : 1;
      }
      connect(prevAtom, idx, order);
    }
    pendingBond = 0;
    prevAtom = idx;
  };

  /** 环闭合：ringNum 已开环则连回，否则记录待闭合 */
  const handleRingClosure = (ringNum: number, pos: number): void => {
    if (prevAtom === null) throw new SmilesParseError('环编号前无原子', pos);
    if (ringClosures.has(ringNum)) {
      const other = ringClosures.get(ringNum)!;
      ringClosures.delete(ringNum);
      let order = pendingBond;
      if (order === 0) {
        const a1 = atoms[other.atom];
        const a2 = atoms[prevAtom];
        order = a1.aromatic && a2.aromatic ? 1.5 : 1;
      }
      connect(other.atom, prevAtom, order);
      atoms[other.atom].inRing = true;
      atoms[prevAtom].inRing = true;
      pendingBond = 0;
    } else {
      let order = pendingBond;
      if (order === 0) order = 1;
      ringClosures.set(ringNum, { atom: prevAtom, order });
      pendingBond = 0;
    }
  };

  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      stack.push(prevAtom as number);
      i++;
      continue;
    }
    if (ch === ')') {
      prevAtom = stack.pop() ?? null;
      pendingBond = 0;
      i++;
      continue;
    }
    if (ch === '-') {
      pendingBond = 1;
      i++;
      continue;
    }
    if (ch === '=') {
      pendingBond = 2;
      i++;
      continue;
    }
    if (ch === '#') {
      pendingBond = 3;
      i++;
      continue;
    }
    if (ch === ':') {
      pendingBond = 1.5;
      i++;
      continue;
    }
    if (ch === '[') {
      readBracket();
      continue;
    }
    if (ch === '%') {
      // %nn：两位数字环号（多位环）
      const d1 = s[i + 1];
      const d2 = s[i + 2];
      if (!isDigit(d1) || !isDigit(d2)) {
        throw new SmilesParseError('环编号 % 后需两位数字', i);
      }
      const ringNum = parseInt(d1 + d2, 10);
      i += 3;
      handleRingClosure(ringNum, i);
      continue;
    }
    if (isDigit(ch)) {
      // 单数字环闭合；连续数字（如 "12"）逐个处理——同一原子可同时闭合环 1 与环 2
      // （邻苯二甲酸酐 c2ccccc12；多位环号须用 %nn）
      const ringNum = parseInt(ch, 10);
      i++;
      handleRingClosure(ringNum, i);
      continue;
    }
    // 有机元素（芳香或脂肪）——双字母优先（Br/Cl/Si）
    const two = s.slice(i, i + 2);
    let element = ch;
    let aromatic = false;
    if (KNOWN_DOUBLE.has(two)) {
      element = two;
      i++;
    } else if (AROMATIC.has(ch)) {
      element = ch.toUpperCase();
      aromatic = true;
    } else if (KNOWN_SINGLE.has(ch)) {
      // 单字母有机子集
    } else {
      throw new SmilesParseError(`无法识别的符号 '${ch}'`, i);
    }
    i++;
    const idx = addAtom(element, aromatic, 0, 0, null);
    attach(idx);
  }

  if (ringClosures.size > 0) {
    throw new SmilesParseError('存在未闭合的环', s.length);
  }
  if (atoms.length === 0) {
    throw new SmilesParseError('空 SMILES', 0);
  }

  // 隐氢计算
  for (const atom of atoms) {
    let valence = VALENCE[atom.element] ?? 4;
    // 电荷调整（教学常见：N+ → 4，O- → 1）
    if (atom.charge > 0) valence += atom.charge;
    else if (atom.charge < 0) valence += atom.charge; // O- → 2-1=1
    let h = valence - atom.bondOrderSum;
    // 芳香杂原子兜底（如吡啶 n：键级和 3，价 3 → 0 ✓）
    if (h < 0) h = 0;
    if (atom.explicitH > 0 && atom.explicitH !== h) {
      // 显式 H 优先（[CH3] 等）
      h = atom.explicitH;
    }
    atom.hCount = Math.round(h);
  }

  markRings({ smiles: s, atoms, bonds });

  return { smiles: s, atoms, bonds };
}

/** 通过叶子剥离标记环成员（苯环 6 个原子全部 inRing） */
function markRings(graph: MoleculeGraph): void {
  const n = graph.atoms.length;
  const deg = new Array<number>(n).fill(0);
  const adj: number[][] = graph.atoms.map(() => []);
  for (const b of graph.bonds) {
    adj[b.a].push(b.b);
    adj[b.b].push(b.a);
    deg[b.a]++;
    deg[b.b]++;
  }
  const queue: number[] = [];
  for (let i = 0; i < n; i++) if (deg[i] === 1) queue.push(i);
  const removed = new Array<boolean>(n).fill(false);
  while (queue.length) {
    const v = queue.pop()!;
    removed[v] = true;
    for (const u of adj[v]) {
      if (!removed[u]) {
        deg[u]--;
        if (deg[u] === 1) queue.push(u);
      }
    }
  }
  for (let i = 0; i < n; i++) graph.atoms[i].inRing = !removed[i];
}

/** 从图统计分子式（Map 保序；用 serializeFormula 输出字符串） */
export function formulaCounts(graph: MoleculeGraph): Map<string, number> {
  const counts = new Map<string, number>();
  for (const atom of graph.atoms) {
    if (atom.element === 'H') continue;
    counts.set(atom.element, (counts.get(atom.element) ?? 0) + 1);
    if (atom.hCount > 0) {
      counts.set('H', (counts.get('H') ?? 0) + atom.hCount);
    }
  }
  return counts;
}

const FORMULA_ORDER = ['C', 'H', 'B', 'Br', 'Cl', 'F', 'I', 'N', 'O', 'P', 'S', 'Si'];

/** 将元素计数序列化为分子式字符串（Hill 顺序） */
export function serializeFormula(counts: Map<string, number>): string {
  const keys = Array.from(counts.keys()).sort((a, b) => {
    const ia = FORMULA_ORDER.indexOf(a);
    const ib = FORMULA_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  return keys.map((k) => (counts.get(k)! > 1 ? k + counts.get(k) : k)).join('');
}

/** 图的分子式（如 C4H10） */
export function formulaOfGraph(graph: MoleculeGraph): string {
  return serializeFormula(formulaCounts(graph));
}

/** 碳骨架邻接表（仅碳-碳键，含键级） */
export function carbonAdjacency(graph: MoleculeGraph): Array<Array<{ to: number; order: number }>> {
  const adj: Array<Array<{ to: number; order: number }>> = graph.atoms.map(() => []);
  for (const b of graph.bonds) {
    const a1 = graph.atoms[b.a];
    const a2 = graph.atoms[b.b];
    if (a1.element === 'C' && a2.element === 'C') {
      adj[b.a].push({ to: b.b, order: b.order });
      adj[b.b].push({ to: b.a, order: b.order });
    }
  }
  return adj;
}

/** 全部原子邻接表 */
export function adjacency(graph: MoleculeGraph): Array<Array<{ to: number; order: number }>> {
  const adj: Array<Array<{ to: number; order: number }>> = graph.atoms.map(() => []);
  for (const b of graph.bonds) {
    adj[b.a].push({ to: b.b, order: b.order });
    adj[b.b].push({ to: b.a, order: b.order });
  }
  return adj;
}

/** 碳原子索引列表 */
export function carbonIndices(graph: MoleculeGraph): number[] {
  return graph.atoms.map((a, i) => (a.element === 'C' ? i : -1)).filter((i) => i >= 0);
}

/** 判断两个图是否为同一结构（经 RDKit canonical SMILES 由调用方保证；此处提供图级快速校验） */
export function sameGraph(a: MoleculeGraph, b: MoleculeGraph): boolean {
  if (a.atoms.length !== b.atoms.length || a.bonds.length !== b.bonds.length) return false;
  // 简单指纹：元素计数与键级直方图
  const key = (g: MoleculeGraph): string => {
    const counts = new Map<string, number>();
    for (const at of g.atoms) {
      const k = at.element + (at.aromatic ? 'a' : '') + at.hCount;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const bc = new Map<number, number>();
    for (const b of g.bonds) {
      const k = b.order;
      bc.set(k, (bc.get(k) ?? 0) + 1);
    }
    return JSON.stringify([...counts.entries()].sort()) + '|' + JSON.stringify([...bc.entries()].sort());
  };
  return key(a) === key(b);
}
