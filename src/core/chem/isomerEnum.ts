/**
 * 高考大题向导 · 核心层：分子式分析（不饱和度 Ω + 官能团候选推导）+ 分步枚举
 * （碳链异构/位置异构/官能团异构，酯含"酸+醇拆分"）
 * 同步实现，不依赖 RDKit；命名复用 reverse/namer.ts 的 nameGraph（教材写法）。
 */
import { parseSmiles, type MoleculeGraph, adjacency, carbonIndices, type GAtom } from './graph';
import { nameGraph } from '../reverse/namer';

// ===================== 对外类型 =====================

export type IsomerClass =
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
  | 'aromatic-alcohol'
  | 'aromatic-aldehyde'
  | 'aromatic-acid'
  | 'aromatic-ester'
  | 'alkene' // 烯烃（可枚举：C3~C6）
  | 'cycloalkane' // 环烷烃（可枚举：C3~C6）
  | 'aromatic-hydrocarbon' // 烷基苯/芳香烃（苯环 + 1~2 碳侧链）
  // 候选推导新增（本引擎暂不枚举，一律 enumerable:false）
  | 'unsaturated-acid' // 不饱和羧酸（Ω=2 含 O）
  | 'unsaturated-ester' // 不饱和酯（Ω=2 含 O）
  | 'diketone' // 二酮（Ω=2 含 O）
  | 'aromatic-nitro' // 硝基芳香族（含 N）
  | 'aromatic-amine'; // 含氮芳香族（含 N）

export interface EnumQuery {
  formula: string;
  classes: IsomerClass[];
}

export interface EnumIsomer {
  smiles: string;
  name: string;
  formula: string;
  klass: IsomerClass;
}

export interface EnumStage {
  label: string;
  hint: string;
  groups: Array<{ title: string; isomers: EnumIsomer[] }>;
}

export interface EnumResult {
  formula: string;
  classes: IsomerClass[];
  count: number;
  isomers: EnumIsomer[];
  supported: boolean;
  warning?: string;
  stages?: EnumStage[];
}

export interface CandidateClass {
  klass: IsomerClass;
  label: string;
  reason: string;
  enumerable: boolean;
  /** 通式不兼容原因（如「该分子式不含醛/酮（通式 CnH2nO 不符）」）：前端展示为"已禁用+原因" */
  incompatible?: string;
}

export interface FormulaAnalysis {
  formula: string;
  ok: boolean;
  elements: Record<string, number>;
  dbe: number;
  dbeNote: string;
  candidates: CandidateClass[];
  warning?: string;
}

// ===================== 内部工具 =====================

/** WL 迭代标签（有界 + 规范重编号）。
 * 旧实现用字符串拼接逐代增长（每代约 ×4 长度，10 代后单签名可达 MB 级），C8+ 枚举因此
 * 指数级变慢；且简单整数重编号按"原子首次出现顺序"分配 id，同构图标签值会因序列化顺序
 * 不同而不一致（去重键失效）。本实现每代按去重后的标签串排序分配 id（与原子顺序无关），
 * 标签恒为 ≤n 个整数且同构图同键；1-WL 对树完备，仍能区分所有非同构骨架。 */
function wlLabels(g: MoleculeGraph, carbonOnly: boolean): number[] {
  const adj = adjacency(g);
  const n = g.atoms.length;
  const isC = new Set(carbonOnly ? carbonIndices(g) : g.atoms.map((_, i) => i));
  const initSigs = g.atoms.map((a) => `${a.element}:${a.hCount}:${a.charge}:${a.aromatic ? 1 : 0}`);
  // 初始标签规范编号：按去重后的初始签名排序分配（与原子顺序无关）
  const initId = new Map([...new Set(initSigs)].sort().map((s, k) => [s, k] as const));
  let label = initSigs.map((s) => initId.get(s)!);
  for (let iter = 0; iter < 10; iter++) {
    const m = new Array<string>(n);
    for (let i = 0; i < n; i++) {
      const neigh = adj[i]
        .filter((x) => isC.has(x.to))
        .map((x) => `${x.order}|${label[x.to]}`)
        .sort()
        .join(',');
      m[i] = label[i] + '#' + neigh;
    }
    // 规范重编号：按去重后的 m 串排序分配 id（同构图的多重集相同 → 同键）
    const idOf = new Map([...new Set(m)].sort().map((s, k) => [s, k] as const));
    label = m.map((s) => idOf.get(s)!);
  }
  return label;
}

/** WL 迭代图签名（去重键）：比 sameGraph 更强，可区分度序列相同的异构体（如 2-/3-甲基戊烷） */
export function graphKey(g: MoleculeGraph): string {
  const label = wlLabels(g, false);
  const nodes = label.slice().sort((a, b) => a - b).join(',');
  const edges = g.bonds
    .map((b) => [label[b.a], label[b.b]].sort((a, b) => a - b).join('<->'))
    .sort()
    .join(';');
  return nodes + '||' + edges;
}

/** 碳原子 WL 等价类（非碳 = -1） */
function wlCarbonClasses(g: MoleculeGraph): number[] {
  const n = g.atoms.length;
  const label = wlLabels(g, true);
  const cls = new Array<number>(n).fill(-1);
  const map = new Map<number, number>();
  for (const ci of carbonIndices(g)) {
    if (!map.has(label[ci])) map.set(label[ci], map.size);
    cls[ci] = map.get(label[ci])!;
  }
  return cls;
}

function elementSymbol(a: GAtom): string {
  if (a.charge === 0) return a.element;
  const sign = a.charge > 0 ? '+' : '-';
  const mag = Math.abs(a.charge);
  return `[${a.element}${sign}${mag > 1 ? mag : ''}]`;
}

/** 无环图 → SMILES（树形括号序列化，支持双键/三键/分支） */
function graphToSmiles(g: MoleculeGraph): string {
  const adj = adjacency(g);
  const visited = new Set<number>();
  const write = (node: number, parent: number): string => {
    visited.add(node);
    let s = elementSymbol(g.atoms[node]);
    const children = adj[node].filter((x) => x.to !== parent && !visited.has(x.to));
    for (const c of children) {
      const sym = c.order === 2 ? '=' : c.order === 3 ? '#' : '';
      s += '(' + sym + write(c.to, node) + ')';
    }
    return s;
  };
  return write(0, -1);
}

/** 在原图 target 碳上接一个片段（groupSmiles，attach 处为片段根原子），可选键级。
 * 返回构造图（原子索引与原图一致，hCount/bondOrderSum 重算），不重新序列化。 */
function addGroup(g: MoleculeGraph, target: number, groupSmiles: string, order = 1): MoleculeGraph {
  const frag = parseSmiles(groupSmiles);
  const offset = g.atoms.length;
  const atoms = g.atoms.map((a) => ({ ...a }));
  const bonds = g.bonds.map((b) => ({ ...b }));
  for (const fa of frag.atoms) {
    atoms.push({ ...fa, originalIndex: offset + fa.originalIndex });
  }
  for (const fb of frag.bonds) {
    bonds.push({ a: offset + fb.a, b: offset + fb.b, order: fb.order, aromatic: fb.aromatic });
  }
  bonds.push({ a: target, b: offset, order, aromatic: false });
  // 重算键级和与隐氢
  for (const a of atoms) a.bondOrderSum = 0;
  for (const b of bonds) {
    atoms[b.a].bondOrderSum += b.order;
    atoms[b.b].bondOrderSum += b.order;
  }
  for (const a of atoms) {
    let valence: number;
    switch (a.element) {
      case 'C': valence = 4; break;
      case 'N': valence = 3; break;
      case 'O': valence = 2; break;
      case 'Cl': case 'Br': case 'F': case 'I': valence = 1; break;
      default: valence = 4;
    }
    if (a.charge > 0) valence += a.charge;
    else if (a.charge < 0) valence += a.charge;
    let h = valence - a.bondOrderSum;
    if (h < 0) h = 0;
    a.hCount = Math.round(h);
  }
  return { smiles: '', atoms, bonds };
}

/** 以 root 为根的树形片段序列化（根 = 连接点 = 第一个原子） */
function treeFromRoot(g: MoleculeGraph, root: number): string {
  const adj = adjacency(g);
  const write = (node: number, parent: number): string => {
    let s = elementSymbol(g.atoms[node]);
    const children = adj[node].filter((x) => x.to !== parent);
    for (const c of children) {
      s += '(' + write(c.to, node) + ')';
    }
    return s;
  };
  return write(root, -1);
}

/** n 碳烷烃骨架枚举（扩展法：n-1 骨架在不等价碳上加甲基，价键过滤 + WL 键去重）
 * 支持 n≤10（C9H20=35、C10H22=75）；>10 超出编号教学范围返回空。 */
function alkaneSkeletons(n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return ['C'];
  if (n > 10) return []; // 主链 >10 碳：超出高中编号教学范围（parseFormula 层已拦截）
  const prev = alkaneSkeletons(n - 1);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sk of prev) {
    const g = parseSmiles(sk);
    const classes = wlCarbonClasses(g);
    const uniqueCls = [...new Set(classes.filter((c) => c >= 0))];
    for (const cls of uniqueCls) {
      const target = carbonIndices(g).find((_, i) => classes[i] === cls)!;
      const g2 = addGroup(g, target, 'C');
      if (g2.atoms[target].bondOrderSum > 4) continue; // 中心碳超价（如新戊烷中心再加甲基）
      const smiles = graphToSmiles(g2);
      const key = graphKey(parseSmiles(smiles));
      if (!seen.has(key)) {
        seen.add(key);
        out.push(smiles);
      }
    }
  }
  return out;
}

/** 单官能团位置异构：每个骨架上不等价碳放一个片段 */
function monoSubstituted(skeletons: string[], groupSmiles: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sk of skeletons) {
    const g = parseSmiles(sk);
    const classes = wlCarbonClasses(g);
    const cIdx = carbonIndices(g);
    const uniqueCls = [...new Set(classes.filter((c) => c >= 0))];
    for (const cls of uniqueCls) {
      const target = cIdx.find((_, i) => classes[i] === cls)!;
      const g2 = addGroup(g, target, groupSmiles);
      const smiles = graphToSmiles(g2);
      const key = graphKey(parseSmiles(smiles));
      if (!seen.has(key)) {
        seen.add(key);
        out.push(smiles);
      }
    }
  }
  return out;
}

/** 双官能团位置异构：两个片段放碳对（可同碳），价键过滤 + WL 去重 */
function diSubstituted(skeletons: string[], groupSmiles: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sk of skeletons) {
    const g = parseSmiles(sk);
    const cIdx = carbonIndices(g);
    for (let i = 0; i < cIdx.length; i++) {
      for (let j = i; j < cIdx.length; j++) {
        const g1 = addGroup(g, cIdx[i], groupSmiles);
        const g2 = addGroup(g1, cIdx[j], groupSmiles);
        if (!g2.atoms.every((a) => (a.element === 'C' ? a.bondOrderSum <= 4 : true))) continue;
        const smiles = graphToSmiles(g2);
        const key = graphKey(parseSmiles(smiles));
        if (!seen.has(key)) {
          seen.add(key);
          out.push(smiles);
        }
      }
    }
  }
  return out;
}

/** 根原子在 WL 迭代后的标签（用于区分同一碳骨架的不同连接点，如正/异/仲/叔丁基） */
function rootSignature(g: MoleculeGraph, target: number): string {
  const label = wlLabels(g, true);
  return String(label[target]);
}

/** n 碳烷基的所有异构片段（根 = 连接点，如 丁基 4 种） */
function alkylFragments(n: number): string[] {
  if (n <= 0) return [];
  const skeletons = alkaneSkeletons(n);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sk of skeletons) {
    const g = parseSmiles(sk);
    const classes = wlCarbonClasses(g);
    const cIdx = carbonIndices(g);
    const uniqueCls = [...new Set(classes.filter((c) => c >= 0))];
    for (const cls of uniqueCls) {
      const target = cIdx.find((_, i) => classes[i] === cls)!;
      // 价键过滤：根碳在骨架内 bondOrderSum>3（四取代，如新戊烷中心）→ 连接后五价非法
      if (g.atoms[target].bondOrderSum > 3) continue;
      const frag = treeFromRoot(g, target);
      // 去重键 = 图签名 + 根原子签名（同一碳骨架不同连接点 = 不同烷基）
      const key = graphKey(parseSmiles(frag)) + '|root:' + rootSignature(g, target);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(frag);
      }
    }
  }
  return out;
}

/** 醚：拆分为 a+b=totalC（a≤b），两烷基片段组合 */
function etherIsomers(totalC: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let a = 1; a <= Math.floor(totalC / 2); a++) {
    const b = totalC - a;
    for (const fa of alkylFragments(a)) {
      for (const fb of alkylFragments(b)) {
        const g = parseSmiles(fa + 'O' + fb);
        const key = graphKey(g);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(g.smiles);
        }
      }
    }
  }
  return out;
}

/** 醛：R-CHO，R = C(totalC-1) 烷基 */
function aldehydeIsomers(totalC: number): string[] {
  if (totalC === 1) return ['C=O'];
  return alkylFragments(totalC - 1).map((r) => r + 'C=O');
}

/** 酮：碳骨架内碳放 =O（需 ≥2 个碳邻居，价键过滤） */
function ketoneIsomers(totalC: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sk of alkaneSkeletons(totalC)) {
    const g = parseSmiles(sk);
    const adj = adjacency(g);
    const classes = wlCarbonClasses(g);
    const cIdx = carbonIndices(g);
    const uniqueCls = [...new Set(classes.filter((c) => c >= 0))];
    for (const cls of uniqueCls) {
      const target = cIdx.find((_, i) => classes[i] === cls)!;
      const cNeighbors = adj[target].filter((x) => g.atoms[x.to].element === 'C').length;
      if (cNeighbors < 2) continue; // 醛型（羰基碳只连 1 个碳）归醛
      const g2 = addGroup(g, target, 'O', 2);
      if (g2.atoms[target].bondOrderSum > 4) continue;
      const smiles = graphToSmiles(g2);
      const key = graphKey(parseSmiles(smiles));
      if (!seen.has(key)) {
        seen.add(key);
        out.push(smiles);
      }
    }
  }
  return out;
}

/** 酸：R-COOH，R = C(totalC-1) 烷基 */
function acidIsomers(totalC: number): string[] {
  if (totalC === 1) return ['C(=O)O'];
  return alkylFragments(totalC - 1).map((r) => r + 'C(=O)O');
}

/** 酯：RCOOR' 拆分，n(酸碳)+m(醇碳)=totalC */
function esterIsomers(totalC: number): { smiles: string; title: string }[] {
  const seen = new Set<string>();
  const out: { smiles: string; title: string }[] = [];
  for (let n = 1; n <= totalC - 1; n++) {
    const m = totalC - n;
    const acidRs = n === 1 ? [''] : alkylFragments(n - 1);
    const alcoholRs = alkylFragments(m);
    const acidBase = n === 1 ? 'C(=O)O' : undefined;
    for (const ar of acidRs) {
      const acidPart = ar === '' ? acidBase! : ar + 'C(=O)O';
      for (const al of alcoholRs) {
        const g = parseSmiles(acidPart + al);
        const key = graphKey(g);
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ smiles: g.smiles, title: `酸部分 ${n} 碳 + 醇部分 ${m} 碳` });
        }
      }
    }
  }
  return out;
}

/** 含苯环（C7H8O / C8H10O 特化）：苯环 + 侧链组合 */
function aromaticSmiles(subs: Array<[number, string]>): string {
  const map = new Map(subs);
  // 苯环 6 位：位1 取代基挂首 'c1'，位2..5 各为 "环碳 + 取代基括号"，位6 取代基挂结尾 'c1' 之后
  let s = 'c1';
  const f1 = map.get(1);
  if (f1) s += '(' + f1 + ')';
  for (let p = 2; p <= 5; p++) {
    s += 'c';
    const frag = map.get(p);
    if (frag) s += '(' + frag + ')';
  }
  s += 'c1';
  const f6 = map.get(6);
  if (f6) s += '(' + f6 + ')';
  return s;
}

function aromaticIsomers(totalC: number): { smiles: string; klass: IsomerClass }[] {
  const out: { smiles: string; klass: IsomerClass }[] = [];
  const k = totalC - 6; // 侧链碳数
  if (k === 1) {
    // C7H8O：甲酚 3 / 苯甲醚 1 / 苯甲醇 1
    out.push({ smiles: aromaticSmiles([[1, 'O'], [2, 'C']]), klass: 'phenol' });
    out.push({ smiles: aromaticSmiles([[1, 'O'], [3, 'C']]), klass: 'phenol' });
    out.push({ smiles: aromaticSmiles([[1, 'O'], [4, 'C']]), klass: 'phenol' });
    out.push({ smiles: aromaticSmiles([[1, 'OC']]), klass: 'aromatic-ether' });
    out.push({ smiles: aromaticSmiles([[1, 'CO']]), klass: 'aromatic-alcohol' });
    return out;
  }
  if (k === 2) {
    // C8H10O：乙基苯酚 3 + 二甲酚 6；苯乙醚 1 + 甲基苯甲醚 3；苯乙醇 + 1-苯乙醇
    out.push({ smiles: aromaticSmiles([[1, 'O'], [2, 'CC']]), klass: 'phenol' });
    out.push({ smiles: aromaticSmiles([[1, 'O'], [3, 'CC']]), klass: 'phenol' });
    out.push({ smiles: aromaticSmiles([[1, 'O'], [4, 'CC']]), klass: 'phenol' });
    for (const [p1, p2] of [
      [2, 3], [2, 4], [2, 5], [2, 6], [3, 4], [3, 5],
    ] as Array<[number, number]>) {
      out.push({ smiles: aromaticSmiles([[1, 'O'], [p1, 'C'], [p2, 'C']]), klass: 'phenol' });
    }
    out.push({ smiles: aromaticSmiles([[1, 'OCC']]), klass: 'aromatic-ether' });
    for (const p of [2, 3, 4] as const) {
      out.push({ smiles: aromaticSmiles([[1, 'OC'], [p, 'C']]), klass: 'aromatic-ether' });
    }
    out.push({ smiles: aromaticSmiles([[1, 'CCO']]), klass: 'aromatic-alcohol' });
    out.push({ smiles: aromaticSmiles([[1, 'C(O)C']]), klass: 'aromatic-alcohol' });
    return out;
  }
  return out; // 其他侧链碳数暂不支持（调用方判定 supported）
}

// ===================== 分子式分析 =====================

const SUPPORTED_ELEMENTS = ['C', 'H', 'O', 'N', 'Cl', 'Br'];

/** 解析分子式 'C4H8O2' → 元素计数（先 NFKC 归一化，兼容 Unicode 下标/全角：C₈H₈O₂、Ｃ４Ｈ８Ｏ２） */
function parseFormula(formula: string): { ok: boolean; elements: Record<string, number>; warning?: string } {
  const normalized = formula.normalize('NFKC');
  const elements: Record<string, number> = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(normalized))) {
    consumed += m[0].length;
    const el = m[1];
    if (!SUPPORTED_ELEMENTS.includes(el)) {
      return { ok: false, elements: {}, warning: `不支持的原子「${el}」` };
    }
    elements[el] = (elements[el] ?? 0) + (m[2] ? parseInt(m[2], 10) : 1);
  }
  if (consumed !== normalized.length || Object.keys(elements).length === 0) {
    return { ok: false, elements: {}, warning: '分子式无法解析（支持 C/H/O/N/Cl/Br）' };
  }
  const C = elements['C'] ?? 0;
  if (C <= 0) {
    return { ok: false, elements: {}, warning: '碳数需在 1~10（教学范围）' };
  }
  if (C > 10) {
    return { ok: false, elements: {}, warning: '主链超过 10 个碳，超出高中编号教学范围（碳数需在 1~10）' };
  }
  return { ok: true, elements };
}

function dbeNoteOf(dbe: number): string {
  if (dbe === 0) return '饱和无环（Ω=0）';
  if (dbe === 1) return '可能含 1 个 C=O（羧酸/酯/醛/酮）或 1 个 C=C 或 1 个环（Ω=1）';
  if (dbe === 4) return '可能含苯环（或 4 个不饱和度）（Ω=4）';
  return `不饱和度为 ${dbe}（Ω = C − H/2 + N/2 + 1，卤素按 H 计）`;
}

const CLASS_LABELS: Record<IsomerClass, string> = {
  alkane: '烷烃',
  monohalo: '一卤代烃',
  dihalo: '二卤代烃',
  alcohol: '醇',
  ether: '醚',
  aldehyde: '醛',
  ketone: '酮',
  acid: '羧酸',
  ester: '酯',
  phenol: '酚',
  'aromatic-ether': '芳香醚',
  'aromatic-alcohol': '芳香醇',
  'aromatic-aldehyde': '芳香醛',
  'aromatic-acid': '芳香酸',
  'aromatic-ester': '芳香酯',
  alkene: '烯烃',
  cycloalkane: '环烷烃',
  'aromatic-hydrocarbon': '烷基苯/芳香烃',
  'unsaturated-acid': '不饱和羧酸',
  'unsaturated-ester': '不饱和酯',
  diketone: '二酮',
  'aromatic-nitro': '硝基芳香族',
  'aromatic-amine': '含氮芳香族',
};

/** 通式兼容性检查（与 enumerateIsomers 的 checkSupported 通式部分一致）：
 * 公式不符合该类的通式（如醛/酮需 CnH2nO）→ 返回不兼容原因，候选标记为"已禁用"。 */
function formulaCompatible(klass: IsomerClass, els: Record<string, number>): { ok: boolean; reason?: string } {
  const C = els['C'] ?? 0;
  const H = els['H'] ?? 0;
  const O = els['O'] ?? 0;
  const N = els['N'] ?? 0;
  const X = (els['Cl'] ?? 0) + (els['Br'] ?? 0);
  const bad = (reason: string) => ({ ok: false, reason });
  switch (klass) {
    case 'alkane':
      return H === 2 * C + 2 && O === 0 && N === 0 && X === 0 ? { ok: true } : bad('该分子式不含烷烃（通式 CnH2n+2 不符）');
    case 'monohalo':
      return X === 1 && H === 2 * C + 1 && O === 0 && N === 0 ? { ok: true } : bad('该分子式不含一卤代烃（通式 CnH2n+1X 不符）');
    case 'dihalo':
      return X === 2 && H === 2 * C && O === 0 && N === 0 ? { ok: true } : bad('该分子式不含二卤代烃（通式 CnH2nX2 不符）');
    case 'alcohol':
    case 'ether':
      return O === 1 && H === 2 * C + 2 && X === 0 && N === 0 ? { ok: true } : bad('该分子式不含饱和醇/醚（通式 CnH2n+2O 不符）');
    case 'aldehyde':
    case 'ketone':
      return O === 1 && H === 2 * C && X === 0 && N === 0 ? { ok: true } : bad('该分子式不含醛/酮（通式 CnH2nO 不符）');
    case 'acid':
    case 'ester':
      return O === 2 && H === 2 * C && X === 0 && N === 0 ? { ok: true } : bad('该分子式不含羧酸/酯（通式 CnH2nO2 不符）');
    case 'phenol':
    case 'aromatic-ether':
    case 'aromatic-alcohol': {
      const dbe = C - H / 2 + 1;
      return dbe === 4 && O === 1 && X === 0 && N === 0 ? { ok: true } : bad('该分子式不含酚/芳香醚/芳香醇（需 Ω=4 且 1 个 O）');
    }
    case 'aromatic-aldehyde': {
      const dbe = C - H / 2 + 1;
      return dbe === 5 && O === 1 && X === 0 && N === 0 ? { ok: true } : bad('该分子式不含芳香醛（需 Ω=5 且 1 个 O）');
    }
    case 'aromatic-acid': {
      const dbe = C - H / 2 + 1;
      return dbe === 5 && O === 2 && X === 0 && N === 0 ? { ok: true } : bad('该分子式不含芳香酸（需 Ω=5 且 2 个 O）');
    }
    case 'aromatic-ester': {
      const dbe = C - H / 2 + 1;
      return dbe === 5 && O === 2 && X === 0 && N === 0 ? { ok: true } : bad('该分子式不含芳香酯（需 Ω=5 且 2 个 O）');
    }
    case 'alkene':
    case 'cycloalkane':
      return O === 0 && X === 0 && N === 0 && H === 2 * C ? { ok: true } : bad('该分子式不含烯烃/环烷烃（通式 CnH2n 不符）');
    case 'aromatic-hydrocarbon': {
      const dbe = C - H / 2 + 1;
      return dbe === 4 && O === 0 && X === 0 && N === 0 ? { ok: true } : bad('该分子式不含烷基苯（需 Ω=4 且无杂原子）');
    }
    default:
      // 候选推导新增类（不饱和酸/酯/二酮/硝基芳香族等）：无通式定义，不做兼容标记
      return { ok: true };
  }
}

/** 候选官能团推导（高中范围规则表） */
function deriveCandidates(elements: Record<string, number>, dbe: number): CandidateClass[] {
  const C = elements['C'] ?? 0;
  const O = elements['O'] ?? 0;
  const N = elements['N'] ?? 0;
  const X = (elements['Cl'] ?? 0) + (elements['Br'] ?? 0);
  const hasO = O > 0;
  const hasX = X > 0;
  const out: CandidateClass[] = [];
  const def = (klass: IsomerClass, label: string, reason: string, enumerable: boolean) => {
    // 通式不符 → 标记不兼容（enumerable 降为 false，前端展示"已禁用+原因"）
    const compat = formulaCompatible(klass, elements);
    out.push({
      klass,
      label,
      reason,
      enumerable: enumerable && compat.ok,
      incompatible: compat.ok ? undefined : compat.reason,
    });
  };

  if (hasX && dbe === 0) {
    if (X === 1) def('monohalo', '一卤代烃', `含 1 个卤素且 Ω=0：一卤代烷烃（如 C4H9Cl）`, true);
    if (X === 2) def('dihalo', '二卤代烃', `含 2 个卤素且 Ω=0：二卤代烷烃（如 C3H6Cl2）`, true);
  }
  if (!hasO && !hasX && N === 0 && dbe === 0) {
    def('alkane', '烷烃', `CxHy 且 Ω=0：饱和烷烃`, true);
  }
  if (!hasO && !hasX && N === 0 && dbe === 1) {
    // 烯烃/环烷烃（C3~C6 可枚举；顺反不计）
    def('alkene', '烯烃', `CxHy 且 Ω=1：可能含 1 个 C=C（烯烃，顺反不计）`, C >= 3 && C <= 6);
    def('cycloalkane', '环烷烃', `CxHy 且 Ω=1：环烷烃（单环）`, C >= 3 && C <= 6);
  }
  if (hasO && dbe === 0) {
    def('alcohol', '醇', `含 O 且 Ω=0：饱和醇（C-O-H）`, true);
    def('ether', '醚', `含 O 且 Ω=0：饱和醚（C-O-C）`, true);
  }
  if (hasO && dbe === 1) {
    if (O >= 2) {
      def('acid', '羧酸', `2 个 O 且 Ω=1：优先考虑羧酸（-COOH）`, true);
      def('ester', '酯', `2 个 O 且 Ω=1：优先考虑酯（RCOOR'）`, true);
    }
    def('aldehyde', '醛', `含 O 且 Ω=1：可能含 1 个 C=O（醛，-CHO 在链端）`, true);
    def('ketone', '酮', `含 O 且 Ω=1：可能含 1 个 C=O（酮，羰基在链内）`, true);
  }
  // Ω=2 且含 O：不饱和酸/酯、二酮（C=C+C=O 或两个 C=O；本引擎暂不枚举 → enumerable:false）
  if (hasO && dbe === 2) {
    if (O >= 2) {
      def('unsaturated-acid', '不饱和羧酸', `Ω=2 且含 O：可能含 C=C+C=O（烯酸/烯酯）或两个 C=O（二酮），如 2-丙烯酸`, false);
      def('unsaturated-ester', '不饱和酯', `Ω=2 且含 O：可能含 C=C+C=O（不饱和酯，如 2-丙烯酸甲酯）`, false);
      def('diketone', '二酮', `Ω=2 且含 O：可能含两个 C=O（二酮，如 2,3-丁二酮）`, false);
    }
  }
  // 含 N：芳香族含氮类（硝基/苯胺等）；本引擎暂不枚举 → enumerable:false
  if (N >= 1 && C >= 6 && dbe >= 5) {
    def('aromatic-nitro', '硝基芳香族', `含 N 且 Ω≥5、C≥6：可能为硝基芳香族（苯环 + -NO2，如硝基甲苯/对硝基甲苯）`, false);
    def('aromatic-amine', '含氮芳香族', `含 N 且 Ω≥5、C≥6：可能为含氮芳香族（苯胺类/芳香酰胺类，如对乙酰氨基苯酚）`, false);
  }
  if (dbe === 4 && C >= 6 && hasO && N === 0 && !hasX) {
    // 生成器仅支持苯环 + 1~2 碳侧链（C≤8）
    def('phenol', '酚', `Ω=4 且 C≥6：可能含苯环（酚 -OH 连苯环）`, C <= 8);
    def('aromatic-ether', '芳香醚', `Ω=4 且 C≥6：可能含苯环（醚，如苯甲醚/苯乙醚）`, C <= 8);
    def('aromatic-alcohol', '芳香醇', `Ω=4 且 C≥6：可能含苯环（脂肪醇，如苯乙醇）`, C <= 8);
  }
  // 烷基苯/芳香烃（Ω=4 无杂原子，如甲苯/二甲苯/乙苯）
  if (dbe === 4 && C >= 7 && !hasO && !hasX && N === 0) {
    def('aromatic-hydrocarbon', '烷基苯/芳香烃', `Ω=4 且无杂原子：苯环 + 烷基侧链（烷基苯异构，如甲苯/二甲苯/乙苯）`, C <= 8);
  }
  // dbe=5：苯环 + 羰基（芳香醛/酸/酯，如苯甲醛/苯甲酸/苯甲酸甲酯）；k=C-6 侧链碳数
  if (dbe === 5 && C >= 7 && hasO && N === 0 && !hasX) {
    const enumerable = C <= 8; // 生成器支持苯环 + 1~2 碳侧链
    if (O === 1) {
      def('aromatic-aldehyde', '芳香醛', `Ω=5 且 C≥7：可能含苯环 + 1 个 C=O（芳香醛，如苯甲醛）`, enumerable);
    }
    if (O >= 2) {
      def('aromatic-acid', '芳香酸', `Ω=5 且 C≥7：可能含苯环 + 羧基（芳香酸，如苯甲酸）`, enumerable);
      def('aromatic-ester', '芳香酯', `Ω=5 且 C≥7：可能含苯环 + 酯基（芳香酯，如苯甲酸甲酯）`, enumerable);
    }
  }
  return out;
}

/** 分子式 → 不饱和度 Ω + 官能团候选推导 */
export function analyzeFormula(formula: string): FormulaAnalysis {
  const f = formula.trim();
  const parsed = parseFormula(f);
  if (!parsed.ok) {
    return { formula: f, ok: false, elements: {}, dbe: -1, dbeNote: '', candidates: [], warning: parsed.warning };
  }
  const C = parsed.elements['C'] ?? 0;
  const H = parsed.elements['H'] ?? 0;
  const N = parsed.elements['N'] ?? 0;
  const X = (parsed.elements['Cl'] ?? 0) + (parsed.elements['Br'] ?? 0);
  const dbe = C - (H + X) / 2 + N / 2 + 1;
  return {
    formula: f,
    ok: true,
    elements: parsed.elements,
    dbe,
    dbeNote: dbeNoteOf(dbe),
    candidates: deriveCandidates(parsed.elements, dbe),
  };
}

// ===================== 分步枚举 =====================

const STAGE_COPY: Record<string, { label: string; hint: string }> = {
  carbonChain: { label: '碳链异构', hint: '先把碳链排成不同碳架（直链/支链），数出互不等同的骨架。' },
  position: { label: '位置异构', hint: '固定碳架后，把官能团放到不同等效碳上，等效位点只算一次。' },
  acidChain: { label: '碳链异构', hint: '羧基固定在链端，只数碳架的异构。' },
  esterSplit: { label: '酯的拆分', hint: "按 RCOOR' 拆分：酸部分 n 碳、醇部分 m 碳（n+m=总碳数），分别数酸/醇的碳架异构再组合。" },
  fgType: { label: '官能团异构', hint: '保持分子式不变，换官能团类型（酚/醚/醇）。' },
  benzenePos: { label: '苯环定位', hint: '苯环上多取代时先定类型，再数邻/间/对等位置组合。' },
};

/** 类 → 公式可行性检查（通式不符 → 返回 supported:false + warning，绝不 throw） */
function checkSupported(klass: IsomerClass, els: Record<string, number>): { ok: boolean; warning?: string } {
  // 通式检查（与候选推导的 formulaCompatible 一致）
  const compat = formulaCompatible(klass, els);
  if (!compat.ok) return { ok: false, warning: compat.reason };
  const C = els['C'] ?? 0;
  const bad = (reason: string) => ({ ok: false, warning: reason });
  // 引擎能力范围检查（芳香族侧链碳数）
  switch (klass) {
    case 'phenol':
    case 'aromatic-ether':
    case 'aromatic-alcohol': {
      const k = C - 6;
      if (k < 1 || k > 2) return bad('芳香族枚举目前支持苯环 + 1~2 碳侧链（C7H8O / C8H10O）');
      return { ok: true };
    }
    case 'aromatic-aldehyde': {
      const k = C - 6;
      if (k < 1 || k > 2) return bad('芳香醛枚举目前支持苯环 + 1~2 碳侧链（C7H6O / C8H8O）');
      return { ok: true };
    }
    case 'aromatic-acid': {
      const k = C - 6;
      if (k < 1 || k > 2) return bad('芳香酸枚举目前支持苯环 + 1~2 碳侧链（C7H6O2 / C8H8O2）');
      return { ok: true };
    }
    case 'aromatic-ester': {
      const k = C - 6;
      if (k !== 2) return bad('芳香酯枚举目前支持苯环 + 2 碳侧链（C8H8O2）');
      return { ok: true };
    }
    case 'alkene':
    case 'cycloalkane':
      // 烯烃/环烷烃：C3~C6 可枚举（顺反不计）；>C6 超出教学范围
      if (C < 3 || C > 6) return bad('烯烃/环烷烃枚举目前支持 C3~C6（C7+ 超出教学范围）');
      return { ok: true };
    case 'aromatic-hydrocarbon': {
      const k = C - 6;
      if (k < 1 || k > 2) return bad('烷基苯枚举目前支持苯环 + 1~2 碳侧链（C7H8 / C8H10）');
      return { ok: true };
    }
    case 'unsaturated-acid':
    case 'unsaturated-ester':
    case 'diketone':
    case 'aromatic-nitro':
    case 'aromatic-amine':
      // 候选推导可见但引擎不枚举的类
      return bad(`暂不支持枚举类「${CLASS_LABELS[klass] ?? klass}」`);
    default:
      // 烷/卤代/醇/醚/醛/酮/酸/酯：通式已通过 → 支持
      return { ok: true };
  }
}

/** 生成某类的全部异构（smiles 列表） */
function generateFor(klass: IsomerClass, els: Record<string, number>): string[] {
  const C = els['C'] ?? 0;
  switch (klass) {
    case 'alkane':
      return alkaneSkeletons(C);
    case 'monohalo':
      return monoSubstituted(alkaneSkeletons(C), els['Br'] ? 'Br' : 'Cl');
    case 'dihalo':
      return diSubstituted(alkaneSkeletons(C), els['Br'] ? 'Br' : 'Cl');
    case 'alcohol':
      return monoSubstituted(alkaneSkeletons(C), 'O');
    case 'ether':
      return etherIsomers(C);
    case 'aldehyde':
      return aldehydeIsomers(C);
    case 'ketone':
      return ketoneIsomers(C);
    case 'acid':
      return acidIsomers(C);
    case 'ester':
      return esterIsomers(C).map((e) => e.smiles);
    case 'phenol':
    case 'aromatic-ether':
    case 'aromatic-alcohol':
      return aromaticIsomers(C).filter((x) => x.klass === klass).map((x) => x.smiles);
    case 'aromatic-aldehyde':
    case 'aromatic-acid':
    case 'aromatic-ester':
      return aromaticCarbonylIsomers(C, klass);
    case 'alkene':
      return alkeneIsomers(C);
    case 'cycloalkane':
      return cycloalkaneIsomers(C);
    case 'aromatic-hydrocarbon':
      return aromaticHydrocarbonIsomers(C);
    default:
      return [];
  }
}

/** 芳香醛/酸/酯枚举（苯环 + 1~2 碳侧链）：苯甲醛/苯乙醛/甲基苯甲醛、苯甲酸/苯乙酸/甲基苯甲酸、苯甲酸甲酯/乙酸苯酯/甲酸苄酯 */
function aromaticCarbonylIsomers(totalC: number, klass: IsomerClass): string[] {
  const k = totalC - 6;
  const out: string[] = [];
  if (klass === 'aromatic-aldehyde') {
    if (k === 1) {
      out.push('O=Cc1ccccc1'); // 苯甲醛
    } else if (k === 2) {
      out.push('O=CCc1ccccc1'); // 苯乙醛
      out.push('O=Cc1ccccc1C'); // 邻甲基苯甲醛
      out.push('O=Cc1cccc(C)c1'); // 间
      out.push('O=Cc1ccc(C)cc1'); // 对
    }
  } else if (klass === 'aromatic-acid') {
    if (k === 1) {
      out.push('O=C(O)c1ccccc1'); // 苯甲酸
    } else if (k === 2) {
      out.push('O=C(O)Cc1ccccc1'); // 苯乙酸
      out.push('O=C(O)c1ccccc1C'); // 邻甲基苯甲酸
      out.push('O=C(O)c1cccc(C)c1'); // 间
      out.push('O=C(O)c1ccc(C)cc1'); // 对
    }
  } else if (klass === 'aromatic-ester' && k === 2) {
    out.push('COC(=O)c1ccccc1'); // 苯甲酸甲酯
    out.push('CC(=O)Oc1ccccc1'); // 乙酸苯酯
    out.push('O=COCc1ccccc1'); // 甲酸苄酯
  }
  return out;
}

/** 烷基苯异构：苯环 + 1~2 碳烷基侧链（甲苯 / 乙苯 + 邻间对二甲苯） */
function aromaticHydrocarbonIsomers(totalC: number): string[] {
  const k = totalC - 6;
  if (k === 1) return ['Cc1ccccc1']; // 甲苯
  if (k === 2) {
    return ['CCc1ccccc1', 'Cc1ccccc1C', 'Cc1cccc(C)c1', 'Cc1ccc(C)cc1']; // 乙苯 + 邻/间/对二甲苯
  }
  return [];
}

/** 烯烃：碳骨架内放一个 C=C（不等价边），WL 去重；顺反不计 */
function alkeneIsomers(totalC: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sk of alkaneSkeletons(totalC)) {
    const g = parseSmiles(sk);
    const seenEdges = new Set<string>();
    for (const bd of g.bonds) {
      if (bd.order !== 1) continue;
      if (g.atoms[bd.a].element !== 'C' || g.atoms[bd.b].element !== 'C') continue;
      const ekey = [bd.a, bd.b].sort((x, y) => x - y).join('-');
      if (seenEdges.has(ekey)) continue;
      seenEdges.add(ekey);
      // 克隆图，把该边改为双键，重算 hCount
      const atoms = g.atoms.map((a) => ({ ...a }));
      const bonds = g.bonds.map((b) => ({ ...b }));
      const bi = bonds.find((b) => (b.a === bd.a && b.b === bd.b) || (b.a === bd.b && b.b === bd.a));
      if (!bi || bi.order !== 1) continue;
      bi.order = 2;
      for (const a of atoms) a.bondOrderSum = 0;
      for (const b of bonds) {
        atoms[b.a].bondOrderSum += b.order;
        atoms[b.b].bondOrderSum += b.order;
      }
      // 价键过滤：双键端点碳键级和 ≤4（新戊烷中心 → 2,2-二甲基丙烯 五价碳，剔除）
      if (atoms[bd.a].bondOrderSum > 4 || atoms[bd.b].bondOrderSum > 4) continue;
      for (const a of atoms) {
        const valence = 4;
        a.hCount = Math.max(0, valence - a.bondOrderSum);
      }
      const smiles = graphToSmiles({ smiles: '', atoms, bonds });
      const g2 = parseSmiles(smiles);
      const key = graphKey(g2);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(smiles);
      }
    }
  }
  return out;
}

/** 单环图序列化：C1...C1 + 分支（环烷烃；可含甲基/乙基等侧链） */
function serializeCyclo(g: MoleculeGraph): string {
  const adj = adjacency(g);
  const cIdx = g.atoms.map((a, i) => (a.element === 'C' ? i : -1)).filter((i) => i >= 0);
  if (cIdx.length < 3) return '';
  const cSet = new Set(cIdx);
  // 叶子剥离 → 环碳
  const deg = new Map<number, number>();
  for (const ci of cIdx) deg.set(ci, adj[ci].filter((x) => cSet.has(x.to)).length);
  const queue = cIdx.filter((ci) => deg.get(ci)! <= 1);
  const removed = new Set<number>();
  while (queue.length) {
    const v = queue.pop()!;
    if (removed.has(v)) continue;
    removed.add(v);
    for (const x of adj[v]) {
      if (!cSet.has(x.to) || removed.has(x.to)) continue;
      const nd = deg.get(x.to)! - 1;
      deg.set(x.to, nd);
      if (nd <= 1) queue.push(x.to);
    }
  }
  const ringC = cIdx.filter((ci) => !removed.has(ci));
  if (ringC.length < 3) return '';
  const ringSet = new Set(ringC);
  const start = ringC[0];
  const path: number[] = [start];
  let prev = -1;
  let cur = start;
  for (let step = 0; step < ringC.length; step++) {
    const nexts = adj[cur].filter((n) => ringSet.has(n.to) && n.to !== prev);
    if (nexts.length === 0) break;
    const next = nexts[0].to;
    if (next === start && step > 0) break;
    path.push(next);
    prev = cur;
    cur = next;
  }
  if (path.length !== ringC.length) return '';
  const writeTree = (node: number, parent: number, blocked: Set<number>): string => {
    let s = elementSymbol(g.atoms[node]);
    const children = adj[node].filter((x) => x.to !== parent && !blocked.has(x.to));
    for (const c of children) {
      const sym = c.order === 2 ? '=' : c.order === 3 ? '#' : '';
      s += '(' + sym + writeTree(c.to, node, new Set([...blocked, node])) + ')';
    }
    return s;
  };
  const branchesOf = (atom: number): string => {
    let s = '';
    for (const br of adj[atom].filter((x) => !ringSet.has(x.to))) {
      s += '(' + writeTree(br.to, atom, new Set([...ringSet, atom])) + ')';
    }
    return s;
  };
  let s = 'C1' + branchesOf(start);
  for (let i = 1; i < path.length; i++) {
    s += 'C' + branchesOf(path[i]);
  }
  return s + '1';
}

/** 环烷烃碳架：n 元环 + 对 cyclo(n-1) 各等价碳加甲基（WL 去重） */
function cycloalkaneIsomers(totalC: number): string[] {
  if (totalC < 3) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (g: MoleculeGraph): void => {
    const smiles = serializeCyclo(g);
    if (!smiles) return;
    let g2: MoleculeGraph;
    try {
      g2 = parseSmiles(smiles);
    } catch {
      return;
    }
    const key = graphKey(g2);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(smiles);
    }
  };
  // 直接 n 元环
  const ringSmiles = 'C1' + 'C'.repeat(totalC - 2) + 'C1';
  add(parseSmiles(ringSmiles));
  // 对 n-1 环烷烃各等价碳加甲基
  if (totalC > 3) {
    for (const prev of cycloalkaneIsomers(totalC - 1)) {
      const g = parseSmiles(prev);
      const classes = wlCarbonClasses(g);
      const cIdx = carbonIndices(g);
      for (const cls of new Set(classes.filter((c) => c >= 0))) {
        const target = cIdx.find((_, i) => classes[i] === cls)!;
        const g2 = addGroup(g, target, 'C');
        if (g2.atoms[target].bondOrderSum > 4) continue;
        add(g2);
      }
    }
  }
  return out;
}

/** 类 → 分步 stages（groups 承载最终产物，扁平化 = 全部 isomers；前置步骤仅给文案） */
function stagesFor(
  klass: IsomerClass,
  els: Record<string, number>,
  isomers: EnumIsomer[]
): EnumStage[] {
  const C = els['C'] ?? 0;
  const all = () => [{ title: '全部', isomers }];
  switch (klass) {
    case 'alkane':
      return [{ ...STAGE_COPY.carbonChain, groups: all() }];
    case 'monohalo':
    case 'dihalo':
    case 'alcohol':
      return [
        { ...STAGE_COPY.carbonChain, groups: [] },
        { ...STAGE_COPY.position, groups: all() },
      ];
    case 'ether': {
      const groups: Array<{ title: string; isomers: EnumIsomer[] }> = [];
      for (let a = 1; a <= Math.floor(C / 2); a++) {
        const b = C - a;
        const gs = isomers.filter((i) => etherSplitOf(i.smiles) === `${a}+${b}`);
        if (gs.length) groups.push({ title: `拆分 ${a} + ${b} 碳`, isomers: gs });
      }
      return [
        { ...STAGE_COPY.carbonChain, groups: [] },
        { ...STAGE_COPY.position, groups: groups.length ? groups : all() },
      ];
    }
    case 'aldehyde':
    case 'ketone':
      return [
        { ...STAGE_COPY.carbonChain, groups: [] },
        { ...STAGE_COPY.position, groups: all() },
      ];
    case 'acid':
      return [{ ...STAGE_COPY.acidChain, groups: all() }];
    case 'ester': {
      const groups: Array<{ title: string; isomers: EnumIsomer[] }> = [];
      for (let n = 1; n <= C - 1; n++) {
        const m = C - n;
        const gs = isomers.filter((i) => esterSplitOf(i.smiles) === `${n}+${m}`);
        if (gs.length) groups.push({ title: `酸 ${n} 碳 + 醇 ${m} 碳`, isomers: gs });
      }
      return [{ ...STAGE_COPY.esterSplit, groups: groups.length ? groups : all() }];
    }
    case 'phenol':
    case 'aromatic-ether':
    case 'aromatic-alcohol':
    case 'aromatic-aldehyde':
    case 'aromatic-acid':
    case 'aromatic-ester':
    case 'aromatic-hydrocarbon': {
      const groups: Array<{ title: string; isomers: EnumIsomer[] }> = [];
      const kinds: Record<string, string> = {
        phenol: '酚',
        'aromatic-ether': '醚',
        'aromatic-alcohol': '醇',
        'aromatic-aldehyde': '芳香醛',
        'aromatic-acid': '芳香酸',
        'aromatic-ester': '芳香酯',
        'aromatic-hydrocarbon': '烷基苯',
      };
      for (const [k, label] of Object.entries(kinds)) {
        const gs = isomers.filter((i) => i.klass === k);
        if (gs.length) groups.push({ title: `${label}（${gs.length} 种）`, isomers: gs });
      }
      return [
        { ...STAGE_COPY.fgType, groups: groups.length ? groups : all() },
        { ...STAGE_COPY.benzenePos, groups: [] },
      ];
    }
    case 'alkene':
    case 'cycloalkane':
      return [
        { ...STAGE_COPY.carbonChain, groups: [] },
        { ...STAGE_COPY.position, groups: all() },
      ];
    default:
      return [{ ...STAGE_COPY.carbonChain, groups: all() }];
  }
}

/** 从 start 出发的碳子树总大小（避开 blocked；用于醚/酯的拆分分组） */
function carbonSubtreeSize(g: MoleculeGraph, start: number, blocked: Set<number>): number {
  const adj = adjacency(g);
  const seen = new Set<number>(blocked);
  const stack = [start];
  let count = 0;
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    count++;
    for (const x of adj[cur]) {
      if (g.atoms[x.to].element !== 'C') continue;
      if (!seen.has(x.to)) stack.push(x.to);
    }
  }
  return count;
}

function etherSplitOf(smiles: string): string {
  const g = parseSmiles(smiles);
  const adj = adjacency(g);
  const oIdx = g.atoms.findIndex((a) => a.element === 'O');
  if (oIdx < 0) return '';
  const cNeighbors = adj[oIdx].filter((x) => g.atoms[x.to].element === 'C');
  const a = carbonSubtreeSize(g, cNeighbors[0].to, new Set([oIdx]));
  const b = carbonSubtreeSize(g, cNeighbors[1].to, new Set([oIdx]));
  return `${Math.min(a, b)}+${Math.max(a, b)}`;
}

function esterSplitOf(smiles: string): string {
  const g = parseSmiles(smiles);
  const adj = adjacency(g);
  const c = g.bonds.find(
    (b) => b.order === 2 && ((g.atoms[b.a].element === 'C' && g.atoms[b.b].element === 'O') || (g.atoms[b.b].element === 'C' && g.atoms[b.a].element === 'O'))
  );
  if (!c) return '';
  const carbonylC = g.atoms[c.a].element === 'C' ? c.a : c.b;
  const bridgeO = adj[carbonylC].find(
    (x) => g.atoms[x.to].element === 'O' && x.order === 1 && adj[x.to].some((y) => y.to !== carbonylC && g.atoms[y.to].element === 'C')
  );
  if (!bridgeO) return '';
  const alcoholStart = adj[bridgeO.to].find((x) => x.to !== carbonylC && g.atoms[x.to].element === 'C');
  if (!alcoholStart) return '';
  const acidLen = carbonSubtreeSize(g, carbonylC, new Set([bridgeO.to, alcoholStart.to]));
  const alcoholLen = carbonSubtreeSize(g, alcoholStart.to, new Set([bridgeO.to]));
  return `${acidLen}+${alcoholLen}`;
}

/** 主入口：条件枚举 */
export function enumerateIsomers(query: EnumQuery): EnumResult {
  const f = analyzeFormula(query.formula);
  if (!f.ok) {
    return { formula: query.formula, classes: query.classes, count: 0, isomers: [], supported: false, warning: f.warning ?? '分子式无法解析' };
  }
  if (!query.classes.length) {
    return { formula: f.formula, classes: [], count: 0, isomers: [], supported: false, warning: '未指定官能团类别' };
  }
  // 可行性检查
  for (const klass of query.classes) {
    const chk = checkSupported(klass, f.elements);
    if (!chk.ok) {
      return { formula: f.formula, classes: query.classes, count: 0, isomers: [], supported: false, warning: chk.warning };
    }
  }
  const stages: EnumStage[] = [];
  const all: EnumIsomer[] = [];
  for (const klass of query.classes) {
    const smilesList = generateFor(klass, f.elements);
    const isomers: EnumIsomer[] = smilesList.map((smiles) => {
      const g = parseSmiles(smiles);
      const nm = nameGraph(g);
      return { smiles, name: nm.ok ? nm.name : smiles, formula: f.formula, klass };
    });
    all.push(...isomers);
    stages.push(...stagesFor(klass, f.elements, isomers));
  }
  // stages 扁平化去重后应与 isomers 一致
  return {
    formula: f.formula,
    classes: query.classes,
    count: all.length,
    isomers: all,
    supported: true,
    stages,
  };
}
