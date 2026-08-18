/**
 * 反向命名引擎：分子图 → 中文系统命名（高中范围）
 * 用于：错误诊断（重导出正确名称）、反向练习（答案/错误分类）。
 * 实现要点：碳骨架路径枚举 + 官能团检测 + IUPAC 编号规则（最长链 → 最小编号）。
 */
import { type MoleculeGraph, type GAtom, adjacency, carbonIndices, type GBond } from '../chem/graph';
import { LEN_STEM } from '../naming/lexicon';

export interface NamerSubstituent {
  name: string;
  positions: number[];
  atoms: number[];
}

export interface NamedResult {
  ok: boolean;
  name: string;
  suffix: string; // 烷/烯/炔/醇/醛/酮/酸/酯/胺/苯/酚
  parentChainLen: number;
  /** 主链原子索引（按位次 1..N 排列；苯环为环原子） */
  chainAtomIndices: number[];
  /** 位次 → 原子索引 */
  numbering: Map<number, number>;
  substituentGroups: NamerSubstituent[];
  /** 官能团（后缀对应）原子索引 */
  fgAtoms: number[];
  /** 官能团位次（后缀 醇/烯/炔/酮/酸/醛/胺） */
  fgPositions: number[];
  /** 酯：酸/醇部分信息 */
  ester?: { acidLen: number; alcoholLen: number; acidName: string; alcoholName?: string };
  smiles: string;
  error?: string;
}

interface FgInstance {
  /** 参与主链选择的碳（醇/酮/酸/醛为官能团碳；烯/炔为双键两个碳中的第一个） */
  carbons: number[];
  atoms: number[];
}

interface FgInfo {
  type: 'acid' | 'ester' | 'amide' | 'aldehyde' | 'ketone' | 'nitrile' | 'alcohol' | 'amine' | 'ether' | 'alkene' | 'alkyne' | 'none';
  instances: FgInstance[];
  atoms: number[];
}

/** 检测官能团（返回最高优先级的类别及其全部实例） */
function detectFg(graph: MoleculeGraph): FgInfo {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const carbonyls: number[] = [];
  for (const b of graph.bonds) {
    if (b.order === 2 && atoms[b.a].element === 'C' && atoms[b.b].element === 'O') carbonyls.push(b.a);
    if (b.order === 2 && atoms[b.b].element === 'C' && atoms[b.a].element === 'O') carbonyls.push(b.b);
  }
  // 酸实例
  const acidInst: FgInstance[] = [];
  const esterInst: FgInstance[] = [];
  const aldehydeInst: FgInstance[] = [];
  const ketoneInst: FgInstance[] = [];
  const esterO = new Set<number>();
  for (const c of carbonyls) {
    const oNeighbors = adj[c].filter((n) => atoms[n.to].element === 'O');
    const singleO = oNeighbors.find((n) => adj[c].find((x) => x.to === n.to)?.order === 1);
    if (singleO) {
      const oAtom = atoms[singleO.to];
      const oOtherC = adj[singleO.to].filter((n) => n.to !== c && atoms[n.to].element === 'C');
      if (oAtom.hCount >= 1 && oOtherC.length === 0) {
        acidInst.push({ carbons: [c], atoms: [c, singleO.to, ...oNeighbors.map((n) => n.to)] });
        continue;
      }
      if (oOtherC.length > 0) {
        esterInst.push({ carbons: [c], atoms: [c, singleO.to, ...oNeighbors.map((n) => n.to)] });
        esterO.add(singleO.to);
        continue;
      }
    }
    const cNeighbors = adj[c].filter((n) => atoms[n.to].element === 'C');
    if (atoms[c].hCount >= 1 && cNeighbors.length <= 1) {
      aldehydeInst.push({ carbons: [c], atoms: [c, ...oNeighbors.map((n) => n.to)] });
    } else {
      ketoneInst.push({ carbons: [c], atoms: [c, ...oNeighbors.map((n) => n.to)] });
    }
  }
  // 酰胺（乙酰胺 / N,N-二甲基甲酰胺）：羰基碳单键连 N（任意氢数），无单键 O（否则为酸/酯）
  const amideInst: FgInstance[] = [];
  for (const c of carbonyls) {
    const oNeighbors = adj[c].filter((n) => atoms[n.to].element === 'O');
    const hasSingleO = oNeighbors.some((n) => adj[c].find((x) => x.to === n.to)?.order === 1);
    if (hasSingleO) continue; // 酸/酯
    const nNeighbor = adj[c].find((x) => atoms[x.to].element === 'N');
    if (nNeighbor) {
      amideInst.push({ carbons: [c], atoms: [c, ...oNeighbors.map((n) => n.to), nNeighbor.to] });
    }
  }
  if (amideInst.length) return { type: 'amide', instances: amideInst, atoms: amideInst.flatMap((i) => i.atoms) };
  if (acidInst.length) return { type: 'acid', instances: acidInst, atoms: acidInst.flatMap((i) => i.atoms) };
  if (esterInst.length) return { type: 'ester', instances: esterInst, atoms: esterInst.flatMap((i) => i.atoms) };
  if (aldehydeInst.length) return { type: 'aldehyde', instances: aldehydeInst, atoms: aldehydeInst.flatMap((i) => i.atoms) };
  if (ketoneInst.length) return { type: 'ketone', instances: ketoneInst, atoms: ketoneInst.flatMap((i) => i.atoms) };
  // 腈：C≡N（优先级高于 醇/胺/烯，低于 醛/酮）
  const nitrileInst: FgInstance[] = [];
  for (const b of graph.bonds) {
    if (b.order !== 3) continue;
    let cIdx = -1;
    let nIdx = -1;
    if (atoms[b.a].element === 'C' && atoms[b.b].element === 'N') {
      cIdx = b.a;
      nIdx = b.b;
    } else if (atoms[b.b].element === 'C' && atoms[b.a].element === 'N') {
      cIdx = b.b;
      nIdx = b.a;
    }
    if (cIdx >= 0) nitrileInst.push({ carbons: [cIdx], atoms: [cIdx, nIdx] });
  }
  if (nitrileInst.length) return { type: 'nitrile', instances: nitrileInst, atoms: nitrileInst.flatMap((i) => i.atoms) };
  // 醇：C-O(H)
  const alcoholInst: FgInstance[] = [];
  for (const b of graph.bonds) {
    if (b.order !== 1) continue;
    let cIdx = -1;
    let oIdx = -1;
    if (atoms[b.a].element === 'C' && atoms[b.b].element === 'O') {
      cIdx = b.a;
      oIdx = b.b;
    } else if (atoms[b.b].element === 'C' && atoms[b.a].element === 'O') {
      cIdx = b.b;
      oIdx = b.a;
    }
    if (cIdx < 0) continue;
    if (esterO.has(oIdx)) continue;
    if (atoms[oIdx].hCount >= 1 && adj[oIdx].filter((n) => n.to !== cIdx && atoms[n.to].element === 'C').length === 0) {
      if (!alcoholInst.some((i) => i.carbons[0] === cIdx)) {
        alcoholInst.push({ carbons: [cIdx], atoms: [cIdx, oIdx] });
      }
    }
  }
  if (alcoholInst.length) return { type: 'alcohol', instances: alcoholInst, atoms: alcoholInst.flatMap((i) => i.atoms) };
  // 胺：N(H2)-C
  const amineInst: FgInstance[] = [];
  for (const b of graph.bonds) {
    if (b.order !== 1) continue;
    let cIdx = -1;
    let nIdx = -1;
    if (atoms[b.a].element === 'C' && atoms[b.b].element === 'N') {
      cIdx = b.a;
      nIdx = b.b;
    } else if (atoms[b.b].element === 'C' && atoms[b.a].element === 'N') {
      cIdx = b.b;
      nIdx = b.a;
    }
    if (cIdx < 0) continue;
    if (atoms[nIdx].hCount >= 2 && adj[nIdx].filter((n) => atoms[n.to].element === 'C').length <= 1) {
      amineInst.push({ carbons: [cIdx], atoms: [cIdx, nIdx] });
    }
  }
  if (amineInst.length) return { type: 'amine', instances: amineInst, atoms: amineInst.flatMap((i) => i.atoms) };
  // 醚：O 连接两个脂肪碳（不含酯桥氧；苯甲醚由芳香路径处理）
  const etherInst: FgInstance[] = [];
  for (const b of graph.bonds) {
    if (b.order !== 1) continue;
    let oIdx = -1;
    if (atoms[b.a].element === 'O') oIdx = b.a;
    else if (atoms[b.b].element === 'O') oIdx = b.b;
    if (oIdx < 0) continue;
    if (esterO.has(oIdx)) continue;
    if (atoms[oIdx].hCount > 0) continue;
    const cNeighbors = adj[oIdx].filter((n) => atoms[n.to].element === 'C');
    if (cNeighbors.length !== 2) continue;
    if (cNeighbors.some((n) => atoms[n.to].aromatic)) continue;
    if (!etherInst.some((i) => i.atoms[0] === oIdx)) {
      etherInst.push({ carbons: [cNeighbors[0].to, cNeighbors[1].to], atoms: [oIdx, cNeighbors[0].to, cNeighbors[1].to] });
    }
  }
  if (etherInst.length) return { type: 'ether', instances: etherInst, atoms: etherInst.flatMap((i) => i.atoms) };
  // 烯/炔：全部非芳香多重键
  const alkeneBonds: Array<[number, number]> = [];
  const alkyneBonds: Array<[number, number]> = [];
  for (const b of graph.bonds) {
    if (b.aromatic) continue;
    if (atoms[b.a].element === 'C' && atoms[b.b].element === 'C') {
      if (b.order === 2) alkeneBonds.push([b.a, b.b]);
      if (b.order === 3) alkyneBonds.push([b.a, b.b]);
    }
  }
  if (alkeneBonds.length) {
    return {
      type: 'alkene',
      instances: alkeneBonds.map(([a, b]) => ({ carbons: [a, b], atoms: [a, b] })),
      atoms: alkeneBonds.flat(),
    };
  }
  if (alkyneBonds.length) {
    return {
      type: 'alkyne',
      instances: alkyneBonds.map(([a, b]) => ({ carbons: [a, b], atoms: [a, b] })),
      atoms: alkyneBonds.flat(),
    };
  }
  return { type: 'none', instances: [], atoms: [] };
}

/** 枚举所有简单路径（仅碳原子），返回路径原子索引数组 */
function allCarbonPaths(graph: MoleculeGraph, maxDepth = 10): number[][] {
  const cIdx = carbonIndices(graph);
  const idxSet = new Set(cIdx);
  const adj = adjacency(graph);
  const paths: number[][] = [];
  const dfs = (start: number, visited: Set<number>, current: number[]): void => {
    if (current.length > maxDepth) return;
    paths.push([...current]);
    const last = current[current.length - 1];
    for (const n of adj[last]) {
      if (!idxSet.has(n.to)) continue;
      if (visited.has(n.to)) continue;
      visited.add(n.to);
      current.push(n.to);
      dfs(start, visited, current);
      current.pop();
      visited.delete(n.to);
    }
  };
  for (const s of cIdx) {
    const visited = new Set<number>([s]);
    dfs(s, visited, [s]);
  }
  return paths;
}

/** 判断路径是否为苯环（6 个芳香碳成环） */
function findBenzeneRing(graph: MoleculeGraph): number[] | null {
  const aromaticC = graph.atoms.map((a, i) => (a.element === 'C' && a.aromatic ? i : -1)).filter((i) => i >= 0);
  if (aromaticC.length < 6) return null;
  const adj = adjacency(graph);
  // 找 6 元芳香环
  const find = (start: number, current: number[], visited: Set<number>): number[] | null => {
    if (current.length === 6) {
      const last = current[5];
      if (adj[last].some((n) => n.to === start)) return [...current];
      return null;
    }
    const last = current[current.length - 1];
    for (const n of adj[last]) {
      if (!graph.atoms[n.to].aromatic) continue;
      if (visited.has(n.to)) continue;
      if (n.to === start && current.length < 5) continue;
      visited.add(n.to);
      current.push(n.to);
      const r = find(start, current, visited);
      if (r) return r;
      current.pop();
      visited.delete(n.to);
    }
    return null;
  };
  for (const s of aromaticC) {
    const r = find(s, [s], new Set([s]));
    if (r) return r;
  }
  return null;
}

/** 找全部 6 元芳香环（去重；用于多苯环/稠环检测） */
function findAllBenzeneRings(graph: MoleculeGraph): number[][] {
  const aromaticC = graph.atoms.map((a, i) => (a.element === 'C' && a.aromatic ? i : -1)).filter((i) => i >= 0);
  if (aromaticC.length < 6) return [];
  const adj = adjacency(graph);
  const seen = new Set<string>();
  const out: number[][] = [];
  const find = (start: number, current: number[], visited: Set<number>): number[] | null => {
    if (current.length === 6) {
      const last = current[5];
      if (adj[last].some((n) => n.to === start)) return [...current];
      return null;
    }
    const last = current[current.length - 1];
    for (const n of adj[last]) {
      if (!graph.atoms[n.to].aromatic) continue;
      if (visited.has(n.to)) continue;
      if (n.to === start && current.length < 5) continue;
      visited.add(n.to);
      current.push(n.to);
      const r = find(start, current, visited);
      if (r) return r;
      current.pop();
      visited.delete(n.to);
    }
    return null;
  };
  for (const s of aromaticC) {
    const r = find(s, [s], new Set([s]));
    if (r) {
      const key = [...r].sort((a, b) => a - b).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    }
  }
  return out;
}

/** 环内两原子沿环的最短距离（步数） */
function ringDistance(ring: number[], a: number, b: number): number {
  const ia = ring.indexOf(a);
  const ib = ring.indexOf(b);
  const d = Math.abs(ia - ib);
  return Math.min(d, ring.length - d);
}

/** 多苯环系统命名：联苯/二苯甲烷/三苯甲烷/1,2-二苯基乙烷/1,2-二苯乙烯/二苯乙炔/二苯醚/4-甲基联苯 */
function detectPolyphenyl(graph: MoleculeGraph): string | null {
  const rings = findAllBenzeneRings(graph);
  if (rings.length < 2) return null;
  const atoms = graph.atoms;
  const adj = adjacency(graph);

  // 三苯甲烷：非芳香中心碳连 ≥3 个不同环
  if (rings.length >= 3) {
    for (let ci = 0; ci < atoms.length; ci++) {
      if (atoms[ci].element !== 'C' || atoms[ci].aromatic) continue;
      const linked = new Set<number>();
      let extraHeavy = 0;
      for (const nb of adj[ci]) {
        if (atoms[nb.to].element === 'H') continue;
        if (atoms[nb.to].aromatic) {
          const ri = rings.findIndex((r) => r.includes(nb.to));
          if (ri >= 0) linked.add(ri);
        } else {
          extraHeavy++;
        }
      }
      if (linked.size >= 3 && extraHeavy === 0) return '三苯甲烷';
    }
  }

  for (let i = 0; i < rings.length; i++) {
    for (let j = i + 1; j < rings.length; j++) {
      const RA = new Set(rings[i]);
      const RB = new Set(rings[j]);
      // 稠合环（共享 ≥2 原子，如萘/蒽/菲）不属于多苯环类，跳过（由 detectFusedAromatic 处理）
      if (rings[i].filter((a) => RB.has(a)).length >= 2) continue;
      // 直接单键相连：联苯型
      for (const a of rings[i]) {
        for (const nb of adj[a]) {
          if (nb.order !== 1 || !RB.has(nb.to)) continue;
          const b = nb.to;
          // 环上其它取代基（甲基/卤素等）
          const ringSubs = (ring: number[], conn: number): Array<{ name: string; atom: number }> => {
            const set = new Set(ring);
            const out: Array<{ name: string; atom: number }> = [];
            for (const r of ring) {
              if (r === conn) continue;
              for (const x of adj[r]) {
                if (set.has(x.to) || RA.has(x.to) || RB.has(x.to)) continue;
                if (atoms[x.to].element === 'H') continue;
                const nm = substituentName(graph, x.to, new Set([...RA, ...RB]));
                if (nm) out.push({ name: nm, atom: r });
              }
            }
            return out;
          };
          const subsA = ringSubs(rings[i], a);
          const subsB = ringSubs(rings[j], b);
          if (subsA.length === 0 && subsB.length === 0) return '联苯';
          if (subsA.length + subsB.length === 1) {
            const [mainRing, conn, sub] = subsA.length === 1
              ? [rings[i], a, subsA[0]]
              : [rings[j], b, subsB[0]];
            const pos = ringDistance(mainRing, conn, sub.atom) + 1;
            if (sub.name === '甲基') return `${pos}-甲基联苯`;
            return `${pos}-${sub.name}联苯`;
          }
          return null;
        }
      }
      // 桥连接：二苯甲烷/1,2-二苯基乙烷/二苯乙烯/二苯乙炔/二苯醚
      // （BFS 必须避开全部环原子，否则稠环共享原子会被误当桥）
      const bridge = polyphenylBridge(graph, rings[i], rings[j], new Set(rings.flat()));
      if (bridge) return bridge;
    }
  }
  return null;
}

/** 两苯环间桥片段命名（CH2/CH2CH2/CH=CH/C≡C/O）；allRings 内原子不可作桥 */
function polyphenylBridge(graph: MoleculeGraph, ringA: number[], ringB: number[], allRings: Set<number>): string | null {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const setB = new Set(ringB);
  for (const start of ringA) {
    for (const nb of adj[start]) {
      if (allRings.has(nb.to)) continue;
      // BFS 找到 ringB 的最短非环路径（只走非环原子）
      const parent = new Map<number, number>();
      const queue = [nb.to];
      const seen = new Set<number>([nb.to]);
      let reached: number | null = null;
      while (queue.length && reached === null) {
        const cur = queue.shift()!;
        for (const x of adj[cur]) {
          if (seen.has(x.to)) continue;
          seen.add(x.to);
          parent.set(x.to, cur);
          if (setB.has(x.to)) {
            reached = x.to;
            break;
          }
          if (!allRings.has(x.to)) queue.push(x.to);
        }
      }
      if (reached === null) continue;
      // 还原路径（不含两端环原子：reached 属于 ringB，从它的前驱开始）
      const path: number[] = [];
      let cur = parent.get(reached)!;
      while (cur !== nb.to) {
        path.unshift(cur);
        cur = parent.get(cur)!;
      }
      path.unshift(nb.to);
      if (path.length === 1) {
        const el = atoms[path[0]].element;
        if (el === 'O') return '二苯醚';
        if (el === 'C') return '二苯甲烷';
      } else if (path.length === 2 && atoms[path[0]].element === 'C' && atoms[path[1]].element === 'C') {
        const bond = graph.bonds.find((bd) => (bd.a === path[0] && bd.b === path[1]) || (bd.a === path[1] && bd.b === path[0]));
        if (bond?.order === 2) return '1,2-二苯乙烯';
        if (bond?.order === 3) return '二苯乙炔';
        if (bond?.order === 1) return '1,2-二苯基乙烷';
      }
    }
  }
  return null;
}

/** 链上某原子到位次（沿链索引） */
function pathPosition(chain: number[], atomIdx: number): number {
  return chain.indexOf(atomIdx) + 1;
}

/** 简单命名结果（多苯环/稠环/菲：无取代基分组） */
function simpleNamed(graph: MoleculeGraph, chain: number[], name: string): NamedResult {
  const numbering = new Map<number, number>();
  chain.forEach((a, i) => numbering.set(i + 1, a));
  return {
    ok: true,
    name,
    suffix: '苯',
    parentChainLen: chain.length,
    chainAtomIndices: chain,
    numbering,
    substituentGroups: [],
    fgAtoms: [],
    fgPositions: [],
    smiles: graph.smiles,
  };
}

/** 稠环芳烃：萘/蒽（含取代基：1/2-甲基萘、2-萘酚） */
function detectFusedAromatic(graph: MoleculeGraph): string | null {
  const rings = findAllBenzeneRings(graph);
  if (rings.length < 2) return null;
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  // 稠合判定：两环共享 ≥2 个原子（独立苯环 → 联苯类，由 detectPolyphenyl 处理）
  let fused = false;
  for (let i = 0; i < rings.length; i++) {
    for (let j = i + 1; j < rings.length; j++) {
      if (rings[i].filter((a) => rings[j].includes(a)).length >= 2) fused = true;
    }
  }
  if (!fused) return null;
  const aromaticC = graph.atoms.filter((a) => a.aromatic).length;
  const allAtoms = new Set(rings.flat());
  if (aromaticC === 10 && rings.length === 2) {
    // 萘 + 取代基（甲基/羟基）
    const subs: Array<{ name: string; atom: number }> = [];
    for (const r of allAtoms) {
      for (const nb of adj[r]) {
        if (allAtoms.has(nb.to) || atoms[nb.to].element === 'H') continue;
        const nm = substituentName(graph, nb.to, allAtoms);
        if (nm) subs.push({ name: nm, atom: r });
      }
    }
    if (subs.length === 0) return '萘';
    if (subs.length === 1) {
      const pos = naphthalenePosition(graph, rings, subs[0].atom);
      const nm = subs[0].name;
      if (nm === '羟基') return `${pos}-萘酚`;
      if (nm === '甲基') return `${pos}-甲基萘`;
      return `${pos}-${nm}萘`;
    }
    return null;
  }
  if (aromaticC === 14 && rings.length === 3) {
    return '蒽';
  }
  return null;
}

/** 萘单取代位次：α（与稠合点相邻）→ 1；β → 2（2/3、6/7 互为对称等价，取小位次） */
function naphthalenePosition(graph: MoleculeGraph, rings: number[][], subAtom: number): number {
  const all = new Set(rings.flat());
  const adj = adjacency(graph);
  const deg3 = new Set([...all].filter((a) => adj[a].filter((x) => all.has(x.to)).length === 3));
  for (const nb of adj[subAtom]) {
    if (deg3.has(nb.to)) return 1; // α 位
  }
  return 2; // β 位
}

/** 非芳香多环碳系统：全 sp2 稠环（菲 Kekulé 式）或桥环（超出教学范围） */
function detectNonAromaticPolycycle(graph: MoleculeGraph): { kind: 'fused' | 'bridge'; carbonCount: number; cycleCount: number } | null {
  const cIdx = carbonIndices(graph);
  if (cIdx.length < 6) return null;
  const cSet = new Set(cIdx);
  const adj = adjacency(graph);
  let edgeCount = 0;
  for (const b of graph.bonds) {
    if (cSet.has(b.a) && cSet.has(b.b)) edgeCount++;
  }
  const visited = new Set<number>();
  let comps = 0;
  for (const ci of cIdx) {
    if (visited.has(ci)) continue;
    comps++;
    const stack = [ci];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const x of adj[cur]) {
        if (cSet.has(x.to) && !visited.has(x.to)) stack.push(x.to);
      }
    }
  }
  const cycleCount = edgeCount - cIdx.length + comps;
  if (cycleCount < 2) return null;
  // 环碳是否全 sp2（每个环碳有双键/三键或芳香键）
  const allSp2 = cIdx.every((ci) => {
    const a = graph.atoms[ci];
    return a.aromatic || adj[ci].some((x) => x.order === 2 || x.order === 3);
  });
  return { kind: allSp2 ? 'fused' : 'bridge', carbonCount: cIdx.length, cycleCount };
}

/** 判定取代基名称（根原子为 root，其子树 = 非链原子） */
function substituentName(graph: MoleculeGraph, root: number, chainSet: Set<number>): string {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const el = atoms[root].element;
  if (el === 'Br' || el === 'Cl' || el === 'F' || el === 'I') {
    return { Br: '溴', Cl: '氯', F: '氟', I: '碘' }[el] ?? el;
  }
  if (el === 'N') {
    // 硝基？N 连两个 O
    const oNeighbors = adj[root].filter((n) => atoms[n.to].element === 'O');
    if (oNeighbors.length >= 2) return '硝基';
    return '氨基';
  }
  if (el === 'O' && atoms[root].hCount >= 1) {
    // 羟基前缀（多官能团：2-羟基丙酸/氨基乙酸 的 羟基/氨基 作前缀）
    return '羟基';
  }
  if (el === 'O' && atoms[root].hCount === 0) {
    // 酰氧基：O-C(=O)-CH3（乙酰氧基，阿司匹林）
    const cSide = adj[root].find((x) => atoms[x.to].element === 'C');
    if (cSide && adj[cSide.to].some((x) => x.order === 2 && atoms[x.to].element === 'O')) {
      return '乙酰氧基';
    }
  }
  if (el !== 'C') return el;
  // 芳香根（苯环直接作取代基）：苯基（如苯丙氨酸的侧链、二苯醚的另一环）
  if (atoms[root].aromatic) {
    return '苯基';
  }
  // 收集碳子树（只统计碳原子；O/N 等杂原子不入树）
  const tree: Array<{ node: number; children: number[] }> = [];
  const visited = new Set<number>([root]);
  const queue: number[] = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    const children: number[] = [];
    for (const n of adj[cur]) {
      if (chainSet.has(n.to) || visited.has(n.to)) continue;
      if (atoms[n.to].element !== 'C') continue;
      visited.add(n.to);
      children.push(n.to);
      queue.push(n.to);
    }
    tree.push({ node: cur, children });
  }
  const totalC = tree.length;
  const rootChildren = tree[0].children;
  // 乙烯基/乙炔基：碳子树内含 C=C / C≡C（苯乙烯/苯乙炔）
  if (tree.some((t) => adj[t.node].some((nb) => nb.order === 2 && atoms[nb.to].element === 'C' && tree.some((t2) => t2.node === nb.to)))) {
    return '乙烯基';
  }
  if (tree.some((t) => adj[t.node].some((nb) => nb.order === 3 && atoms[nb.to].element === 'C' && tree.some((t2) => t2.node === nb.to)))) {
    return '乙炔基';
  }
  if (totalC === 1) return '甲基';
  if (totalC === 2) return '乙基';
  if (totalC === 3) {
    // 丙基（直链）或异丙基（根带两个甲基）
    if (rootChildren.length === 2) return '异丙基';
    return '丙基';
  }
  if (totalC === 4) {
    // 根的子树叶数
    if (rootChildren.length === 3) return '叔丁基';
    if (rootChildren.length === 2) {
      // 仲丁基：根连 1 个甲基 + 1 个乙基；异丁基：根为 CH2 连 CH(CH3)2
      const sizes = rootChildren.map((c) => subtreeSize(tree, c));
      if (sizes.includes(1) && sizes.includes(2)) return '仲丁基';
      return '异丁基';
    }
    // 单支链：异丁基（CH2-CH(CH3)2）或正丁基（线性 4 链）
    if (rootChildren.length === 1) {
      const child = rootChildren[0];
      const grand = tree.find((t) => t.node === child)?.children ?? [];
      if (grand.length === 2) return '异丁基';
    }
    return '丁基';
  }
  if (totalC === 5) {
    // 沿单链找分支点：-CH2-CH2-CH(CH3)2 → 异戊基（乙酸异戊酯）
    if (rootChildren.length === 1) {
      let cur = rootChildren[0];
      for (let d = 0; d < 4; d++) {
        const entry = tree.find((t) => t.node === cur);
        const kids = entry?.children ?? [];
        if (kids.length === 2) return '异戊基';
        if (kids.length !== 1) break;
        cur = kids[0];
      }
    }
    return '戊基';
  }
  return '戊基'; // 超出教学范围，简化
}

function subtreeSize(tree: Array<{ node: number; children: number[] }>, rootNode: number): number {
  const entry = tree.find((t) => t.node === rootNode);
  if (!entry) return 0;
  let size = 1;
  for (const c of entry.children) size += subtreeSize(tree, c);
  return size;
}

/** 倍数词（二/三/四...） */
const MULT_NAMES: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十' };

/** 组装规范名称 */
function composeName(opts: {
  stem: string;
  suffix: string;
  fgPositions: number[];
  fgMultiplier?: number;
  substituents: NamerSubstituent[];
  chainLen: number;
  extraEne?: { positions: number[]; bond: '烯' | '炔' };
}): string {
  const { stem, suffix, fgPositions, substituents } = opts;
  const parts: string[] = [];
  // 简单卤代烃（溴乙烷/氯甲烷等）：链长 ≤2 且单取代时省略位次
  // 简单单取代（卤素/氨基/羟基等）：链长 ≤2 时省略位次（溴乙烷/氯甲烷/氨基乙酸）
  // 单碳（链长 1）：位次无意义，全部省略（四氯化碳 → 四氯甲烷，无"1,1,1,1-"）
  const simpleHalo = opts.chainLen === 1 || (opts.chainLen <= 2 && substituents.length === 1 && substituents[0].positions.length === 1);
  // 取代基：按位次排序，同类合并（positions 已按位次排序）
  for (const sub of substituents) {
    const posStr = simpleHalo ? '' : sub.positions.join(',') + '-';
    const multStr = sub.positions.length > 1 ? MULT_NAMES[sub.positions.length] : '';
    parts.push(posStr + multStr + sub.name);
  }
  // 官能团位次（后缀）
  const fgMult = opts.fgMultiplier ?? (fgPositions.length > 0 ? fgPositions.length : 1);
  let suffixPart = stem;
  const isMultiFg = fgPositions.length > 1;

  // 双官能团：X-烯/炔[stem]-[fg位次-]后缀（2-丙烯-1-醇 / 2-丙烯酸 / 3-丁烯-2-酮）
  if (opts.extraEne && (suffix === '醇' || suffix === '醛' || suffix === '酮' || suffix === '酸' || suffix === '腈')) {
    let needLocant = false;
    if (suffix === '酸' || suffix === '醛' || suffix === '腈') {
      needLocant = false;
    } else if (suffix === '酮') {
      needLocant = opts.chainLen >= 4;
    } else {
      // 醇
      needLocant = opts.chainLen >= 3;
    }
    const eneLocPart = opts.extraEne.positions.join(',') + '-';
    suffixPart = eneLocPart + stem + opts.extraEne.bond + (needLocant ? '-' + fgPositions.join(',') + '-' + suffix : suffix);
    const name = parts.length > 0 ? parts.join('-') + (/^\d/.test(suffixPart) ? '-' : '') + suffixPart : suffixPart;
    return name;
  }

  if (suffix === '烯' || suffix === '炔' || suffix === '醇' || suffix === '酮' || suffix === '酸' || suffix === '醛' || suffix === '腈' || suffix === '酰胺') {
    // 位次书写规则：
    // - 酸/醛/腈/酰胺：官能团固定 1 位，不写位次
    // - 酮：羰基不在 1 位，仅链长 ≥4 时写位次（2-丁酮；丙酮不写）
    // - 醇：链长 ≥3 写位次（1-丙醇/2-丙醇）；多元醇连续占满全链时不写（乙二醇/丙三醇）
    // - 烯/炔：链长 ≥4 或位次 ≠1 或多元时写位次
    let needLocant = false;
    if (suffix === '酸' || suffix === '醛' || suffix === '腈' || suffix === '酰胺') {
      needLocant = false;
    } else if (suffix === '酮') {
      needLocant = opts.chainLen >= 4;
    } else if (suffix === '醇') {
      if (isMultiFg) {
        const consecutive = fgPositions.every((p, i) => p === i + 1);
        const fullChain = fgPositions.length === opts.chainLen;
        needLocant = !(consecutive && fullChain);
      } else {
        needLocant = opts.chainLen >= 3;
      }
    } else {
      // 烯/炔
      needLocant = opts.chainLen >= 4 || fgPositions[0] !== 1 || isMultiFg;
    }
    if (needLocant) {
      suffixPart = fgPositions.join(',') + '-' + stem;
    }
    if (fgMult > 1) suffixPart += MULT_NAMES[fgMult];
    suffixPart += suffix;
  } else {
    suffixPart = stem + suffix;
  }
  const name = parts.length > 0 ? parts.join('-') + (/^\d/.test(suffixPart) ? '-' : '') + suffixPart : suffixPart;
  return name;
}

/** 主入口：图 → 中文名 */
export function nameGraph(graph: MoleculeGraph): NamedResult {
  const atoms = graph.atoms;
  // 苯环系
  const ring = findBenzeneRing(graph);
  if (ring) {
    // 多苯环系统（联苯/二苯甲烷/三苯甲烷/1,2-二苯基乙烷/二苯乙烯/二苯乙炔/二苯醚/4-甲基联苯）优先
    const pp = detectPolyphenyl(graph);
    if (pp) return simpleNamed(graph, ring, pp);
    // 稠环芳烃（萘/蒽/1,2-甲基萘/2-萘酚）
    const fused = detectFusedAromatic(graph);
    if (fused) return simpleNamed(graph, ring, fused);
    // 芳香醇（苯乙醇/1-苯乙醇）与苯基脂肪醛/酸（苯乙醛/苯乙酸）先于苯环系处理
    const aol = detectAromaticAlcohol(graph, ring);
    if (aol) {
      return nameAromaticAlcohol(graph, ring, aol);
    }
    const acc = detectAromaticCarbonylChain(graph, ring);
    if (acc) {
      return nameAromaticCarbonylChain(graph, ring, acc);
    }
    return nameAromatic(graph, ring);
  }
  // 非芳香碳环：环烷烃 / 环烯烃
  const cyclo = detectCycloalkane(graph);
  if (cyclo) {
    return nameCyclo(graph, cyclo);
  }
  // 非芳香多环：全 sp2 稠环（菲 Kekulé 式）或桥环（超出教学范围，绝不输出链烯错名）
  const poly = detectNonAromaticPolycycle(graph);
  if (poly) {
    if (poly.kind === 'fused' && poly.carbonCount === 14 && poly.cycleCount === 3) {
      return simpleNamed(graph, carbonIndices(graph), '菲');
    }
    return {
      ok: false,
      name: '',
      suffix: '烷',
      parentChainLen: 0,
      chainAtomIndices: [],
      numbering: new Map(),
      substituentGroups: [],
      fgAtoms: [],
      fgPositions: [],
      smiles: graph.smiles,
      error: '桥环/多环结构超出高中教学范围',
    };
  }
  const fg = detectFg(graph);
  const carbonAdj = adjacency(graph);
  const cIdx = carbonIndices(graph);
  const cSet = new Set(cIdx);

  // 酯：酸部分 + 醇部分（先检二醇二酯：二乙酸乙二酯）
  if (fg.type === 'ester') {
    const diol = nameGlycolDiester(graph, fg);
    if (diol) return diol;
    return nameEster(graph, fg);
  }
  // 醚：R1-O-R2
  if (fg.type === 'ether') {
    return nameEther(graph, fg);
  }

  // 收集所有候选链（碳路径），过滤出符合 FG 约束的最长链
  const paths = allCarbonPaths(graph).filter((p) => p.length >= 1);
  // FG 必须包含的碳
  const mustInclude = new Set<number>();
  for (const inst of fg.instances) {
    for (const c of inst.carbons) mustInclude.add(c);
  }
  let maxLen = 0;
  const validPaths = paths.filter((p) => {
    if (fg.type === 'none') return true;
    for (const c of mustInclude) {
      if (!p.includes(c)) return false;
    }
    return true;
  });
  for (const p of validPaths) maxLen = Math.max(maxLen, p.length);
  const candidates = validPaths.filter((p) => p.length === maxLen);

  if (candidates.length === 0) {
    return { ok: false, name: '', suffix: fg.type, parentChainLen: maxLen, chainAtomIndices: [], numbering: new Map(), substituentGroups: [], fgAtoms: fg.atoms, fgPositions: [], smiles: graph.smiles, error: '无法确定主链' };
  }

  // 对每个候选链 × 两种方向，计算评分
  interface Scored {
    chain: number[];
    numbering: Map<number, number>;
    fgPositions: number[];
    substituents: NamerSubstituent[];
    key: string;
  }
  const scored: Scored[] = [];
  for (const chain of candidates) {
    for (const rev of [false, true]) {
      const order = rev ? [...chain].reverse() : [...chain];
      const chainSet = new Set(chain);
      // 官能团位次
      let fgPositions: number[] = [];
      if (fg.type === 'acid' || fg.type === 'aldehyde' || fg.type === 'nitrile' || fg.type === 'amide') {
        // 酸/醛/腈/酰胺：官能团碳必须在 1 号位（从官能团端编号）
        const pos = order.indexOf(fg.instances[0].carbons[0]) + 1;
        if (pos !== 1) continue;
        fgPositions = fg.instances.map((i) => order.indexOf(i.carbons[0]) + 1).sort((a, b) => a - b);
      } else if (fg.type === 'ketone' || fg.type === 'alcohol' || fg.type === 'amine') {
        fgPositions = fg.instances.map((i) => order.indexOf(i.carbons[0]) + 1).sort((a, b) => a - b);
      } else if (fg.type === 'alkene' || fg.type === 'alkyne') {
        fgPositions = fg.instances
          .map((i) => Math.min(order.indexOf(i.carbons[0]) + 1, order.indexOf(i.carbons[1]) + 1))
          .sort((a, b) => a - b);
      }
      // 取代基
      const subMap = new Map<string, number[]>();
      const subAtoms = new Map<string, number[]>();
      const fgAtomSet = new Set(fg.atoms);
      for (let pos = 0; pos < order.length; pos++) {
        const atom = order[pos];
        for (const n of carbonAdj[atom]) {
          if (chainSet.has(n.to)) continue;
          if (fgAtomSet.has(n.to)) continue;
          const name = substituentName(graph, n.to, chainSet);
          if (!name) continue;
          const list = subMap.get(name) ?? [];
          list.push(pos + 1);
          subMap.set(name, list);
          const al = subAtoms.get(name) ?? [];
          al.push(n.to);
          subAtoms.set(name, al);
        }
      }
      const substituents: NamerSubstituent[] = [...subMap.entries()]
        .map(([name, positions]) => ({ name, positions: positions.sort((a, b) => a - b), atoms: subAtoms.get(name) ?? [] }))
        .sort((a, b) => {
          const pa = a.positions[0];
          const pb = b.positions[0];
          if (pa !== pb) return pa - pb;
          return SUBST_ORDER[a.name] - SUBST_ORDER[b.name];
        });
      // 评分键：fg 位次升序 | 取代基数量（多者优先，用 -count）| 取代基位次序列
      const fgKey = fgPositions.slice().sort((a, b) => a - b).join(',');
      const subCountKey = -substituents.reduce((s, g) => s + g.positions.length, 0);
      const subPosKey = substituents
        .flatMap((g) => g.positions)
        .sort((a, b) => a - b)
        .join(',');
      const key = `${fgKey}|${subCountKey}|${subPosKey}`;
      const numbering = new Map<number, number>();
      order.forEach((a, i) => numbering.set(i + 1, a));
      scored.push({ chain: order, numbering, fgPositions, substituents, key });
    }
  }
  if (scored.length === 0) {
    return { ok: false, name: '', suffix: fg.type, parentChainLen: maxLen, chainAtomIndices: [], numbering: new Map(), substituentGroups: [], fgAtoms: fg.atoms, fgPositions: [], smiles: graph.smiles, error: '无法按规则编号' };
  }
  // 选最优：fg 位次最小 → 取代基最多 → 取代基位次最小
  scored.sort((a, b) => {
    const ka = a.key.split('|');
    const kb = b.key.split('|');
    for (let i = 0; i < 3; i++) {
      const xa = ka[i];
      const xb = kb[i];
      if (i === 1) {
        // subCountKey = -取代基数：数值升序 = 取代基数量降序（多者优先）
        const na = parseInt(xa, 10);
        const nb = parseInt(xb, 10);
        if (na !== nb) return na - nb;
      } else {
        if (xa !== xb) return xa < xb ? -1 : 1;
      }
    }
    return 0;
  });
  const best = scored[0];

  const suffixMap: Record<string, string> = {
    acid: '酸',
    amide: '酰胺',
    aldehyde: '醛',
    ketone: '酮',
    nitrile: '腈',
    alcohol: '醇',
    amine: '胺',
    alkene: '烯',
    alkyne: '炔',
    none: '烷',
  };
  const suffix = suffixMap[fg.type];
  const fgMult = fg.instances.length > 1 ? fg.instances.length : 1;
  const stem = LEN_STEM[maxLen];

  // 双官能团：链内非官能团的 C=C/C≡C（丙烯酸 → 2-丙烯酸；烯丙醇 → 2-丙烯-1-醇）
  let extraEne: { positions: number[]; bond: '烯' | '炔' } | undefined;
  if (fg.type !== 'none' && fg.type !== 'alkene' && fg.type !== 'alkyne') {
    const chainSet = new Set(best.chain);
    const eneP: number[] = [];
    const yneP: number[] = [];
    for (const bd of graph.bonds) {
      if (bd.aromatic) continue;
      if (!chainSet.has(bd.a) || !chainSet.has(bd.b)) continue;
      if (atoms[bd.a].element !== 'C' || atoms[bd.b].element !== 'C') continue;
      const posA = best.chain.indexOf(bd.a) + 1;
      const posB = best.chain.indexOf(bd.b) + 1;
      const loc = Math.min(posA, posB);
      if (bd.order === 2) eneP.push(loc);
      else if (bd.order === 3) yneP.push(loc);
    }
    if (eneP.length) extraEne = { positions: [...new Set(eneP)].sort((a, b) => a - b), bond: '烯' };
    else if (yneP.length) extraEne = { positions: [...new Set(yneP)].sort((a, b) => a - b), bond: '炔' };
  }

  let name = composeName({
    stem,
    suffix,
    fgPositions: best.fgPositions,
    fgMultiplier: fgMult,
    substituents: best.substituents,
    chainLen: maxLen,
    extraEne,
  });

  // 酰胺 N 取代基（N,N-二甲基甲酰胺 / N-甲基乙酰胺）
  if (fg.type === 'amide') {
    const nPrefix = amideNPrefix(graph, fg);
    if (nPrefix) name = nPrefix + (/^\d/.test(name) ? '-' : '') + name;
  }

  return {
    ok: true,
    name,
    suffix,
    parentChainLen: maxLen,
    chainAtomIndices: best.chain,
    numbering: best.numbering,
    substituentGroups: best.substituents,
    fgAtoms: fg.atoms,
    fgPositions: best.fgPositions,
    smiles: graph.smiles,
  };
}

const SUBST_ORDER: Record<string, number> = {
  溴: 1, 氯: 2, 乙基: 3, 氟: 4, 碘: 5, 氨基: 6, 甲基: 7, 羟基: 8, 硝基: 9,
  异丙基: 10, 丙基: 11, 叔丁基: 12, 仲丁基: 13, 异丁基: 14, 丁基: 15,
  乙烯基: 16,
};

/** 酰胺 N 上取代基前缀：N,N-二甲基 / N-甲基（附着在酰胺 N 而非链碳） */
function amideNPrefix(graph: MoleculeGraph, fg: FgInfo): string {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const groups = new Map<string, number>();
  for (const inst of fg.instances) {
    const nIdx = inst.atoms.find((a) => atoms[a].element === 'N');
    if (nIdx === undefined) continue;
    for (const nb of adj[nIdx]) {
      if (nb.to === inst.carbons[0]) continue;
      if (atoms[nb.to].element === 'H') continue;
      const nm = substituentName(graph, nb.to, new Set([nIdx, inst.carbons[0]]));
      if (!nm) continue;
      groups.set(nm, (groups.get(nm) ?? 0) + 1);
    }
  }
  const parts: string[] = [];
  for (const [nm, count] of groups) {
    const markers = 'N,'.repeat(count - 1) + 'N';
    const mult = count > 1 ? MULT_NAMES[count] : '';
    parts.push(markers + '-' + mult + nm);
  }
  return parts.join('-');
}

/** 检测简单非芳香碳环（环烷烃/环烯烃）；返回环路径或 null */
/** 检测简单非芳香碳环（环烷烃/环烯烃）；返回环路径或 null。
 * 环成员用碳子图叶子剥离求取（不依赖 parseSmiles 的 inRing 标记，
 * 对 builder 手工构造的 built.graph 同样有效）。 */
function detectCycloalkane(graph: MoleculeGraph): number[] | null {
  const cIdx = carbonIndices(graph);
  if (cIdx.length < 3) return null;
  const adj = adjacency(graph);
  // 碳子图叶子剥离 → 环碳（度 ≤1 的碳逐层剥除，余者成环）
  const cSet = new Set(cIdx);
  const deg = new Map<number, number>();
  for (const ci of cIdx) {
    deg.set(ci, adj[ci].filter((x) => cSet.has(x.to)).length);
  }
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
  if (ringC.length < 3) return null;
  const ringSet = new Set(ringC);
  // 简单单环：每个环内碳恰有 2 个环内邻居（稠环/螺环走链式逻辑）
  for (const r of ringC) {
    const inRingNeighbors = adj[r].filter((n) => ringSet.has(n.to)).length;
    if (inRingNeighbors !== 2) return null;
  }
  // 沿环提取路径
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
  return path.length === ringC.length ? path : null;
}

/** 环烷烃/环烯烃命名：甲基环丙烷 / 环己烷 / 环己烯 / 1,2-二甲基环丙烷 */
function nameCyclo(graph: MoleculeGraph, ring: number[]): NamedResult {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const ringSet = new Set(ring);
  const n = ring.length;

  // 环内多重键（环烯）
  const hasDouble = (a: number, b: number): boolean =>
    graph.bonds.some((bd) => (bd.a === a && bd.b === b) || (bd.a === b && bd.b === a)) &&
    graph.bonds.some((bd) => ((bd.a === a && bd.b === b) || (bd.a === b && bd.b === a)) && bd.order === 2);
  const isEne = ring.some((r, i) => hasDouble(r, ring[(i + 1) % n]));

  // 环外取代基
  interface RingSub {
    name: string;
    ringAtom: number;
    root: number;
  }
  const subs: RingSub[] = [];
  for (const r of ring) {
    for (const nb of adj[r]) {
      if (ringSet.has(nb.to)) continue;
      const el = atoms[nb.to].element;
      if (el === 'Br' || el === 'Cl' || el === 'F' || el === 'I') {
        subs.push({ name: { Br: '溴', Cl: '氯', F: '氟', I: '碘' }[el] ?? el, ringAtom: r, root: nb.to });
      } else if (el === 'C') {
        subs.push({ name: substituentName(graph, nb.to, ringSet), ringAtom: r, root: nb.to });
      }
    }
  }

  // 编号：环烯双键固定 1 位；环烷取最小位次集
  // 注意：每个起点都要尝试正/反两个方向（否则会漏掉某些编号方向，
  // 如 1-乙基-3-甲基环己烷 的 乙基@1 方向），再按位次和 + 次序规则择优
  const orientations: number[][] = [];
  if (isEne) {
    for (let rot = 0; rot < n; rot++) {
      const rotated = [...ring.slice(rot), ...ring.slice(0, rot)];
      if (hasDouble(rotated[0], rotated[1])) {
        orientations.push(rotated);
        orientations.push([...rotated].reverse());
      }
    }
  } else {
    for (let rot = 0; rot < n; rot++) {
      const rotated = [...ring.slice(rot), ...ring.slice(0, rot)];
      orientations.push(rotated);
      orientations.push([...rotated].reverse());
    }
  }
  let best: Array<{ name: string; pos: number; root: number }> | null = null;
  let bestOrder: number[] = [];
  let bestKey = '';
  for (const order of orientations) {
    const placed = subs.map((s) => ({ name: s.name, pos: order.indexOf(s.ringAtom) + 1, root: s.root }));
    const key = placed.map((p) => p.pos).sort((a, b) => a - b).join(',');
    if (best === null || key < bestKey || (key === bestKey && betterCycloSubs(placed, best))) {
      bestKey = key;
      best = placed;
      bestOrder = order;
    }
  }
  if (!best) {
    return { ok: false, name: '', suffix: isEne ? '烯' : '烷', parentChainLen: n, chainAtomIndices: ring, numbering: new Map(), substituentGroups: [], fgAtoms: [], fgPositions: [], smiles: graph.smiles, error: '环系编号失败' };
  }

  // 分组与名称
  const groups = new Map<string, number[]>();
  for (const p of best) {
    const list = groups.get(p.name) ?? [];
    list.push(p.pos);
    groups.set(p.name, list);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => a[1][0] - b[1][0]);
  const singleSubNoLocant = best.length === 1 && !isEne;
  const subParts: string[] = [];
  for (const [name, poss] of sortedGroups) {
    const posStr = singleSubNoLocant ? '' : poss.join(',') + '-';
    const multStr = poss.length > 1 ? MULT_NAMES[poss.length] : '';
    subParts.push(posStr + multStr + name);
  }
  const suffix = isEne ? '烯' : '烷';
  const name = (subParts.length ? subParts.join('-') : '') + '环' + LEN_STEM[n] + suffix;

  const numbering = new Map<number, number>();
  bestOrder.forEach((a, i) => numbering.set(i + 1, a));

  const substituentGroups: NamerSubstituent[] = sortedGroups.map(([gname, poss]) => ({
    name: gname,
    positions: poss.sort((a, b) => a - b),
    atoms: best.filter((p) => p.name === gname).map((p) => p.root),
  }));

  return {
    ok: true,
    name,
    suffix,
    parentChainLen: n,
    chainAtomIndices: bestOrder,
    numbering,
    substituentGroups,
    fgAtoms: isEne ? ring.filter((r) => hasDouble(r, ring[(ring.indexOf(r) + 1) % n])) : [],
    fgPositions: isEne ? [1] : [],
    smiles: graph.smiles,
  };
}

/** 环烷编号次序规则：位次和相同取「较优基团给较小位次」（次序规则：乙基 > 甲基，烷基按碳数） */
const CYCLO_SUB_RANK: Record<string, number> = {
  甲基: 1, 乙基: 2, 丙基: 3, 异丙基: 3, 丁基: 4, 异丁基: 4, 仲丁基: 4, 叔丁基: 4,
  戊基: 5, 异戊基: 5, 己基: 6, 庚基: 7, 辛基: 8, 壬基: 9, 癸基: 10,
};
function cycloSubRank(name: string): number {
  return CYCLO_SUB_RANK[name] ?? 0;
}
/** a 是否优于 b：按位次升序逐位比较，较优基团（次序规则）在较小位次者胜 */
function betterCycloSubs(a: Array<{ name: string; pos: number }>, b: Array<{ name: string; pos: number }>): boolean {
  const sa = a.slice().sort((x, y) => x.pos - y.pos);
  const sb = b.slice().sort((x, y) => x.pos - y.pos);
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
    const ra = cycloSubRank(sa[i].name);
    const rb = cycloSubRank(sb[i].name);
    if (ra !== rb) return ra > rb;
  }
  return false;
}

const LINEAR_ALKYL = new Set(['甲基', '乙基', '丙基', '丁基', '戊基', '己基', '庚基', '辛基', '壬基', '癸基']);
const ALKYL_SHORT: Record<string, string> = { 甲基: '甲', 乙基: '乙', 丙基: '丙', 丁基: '丁', 戊基: '戊', 己基: '己', 庚基: '庚', 辛基: '辛', 壬基: '壬', 癸基: '癸' };

/** 醚命名：R1-O-R2 → 甲乙醚/甲丙醚/乙醚/甲基异丙基醚/苯甲醚 */
function nameEther(graph: MoleculeGraph, fg: FgInfo): NamedResult {
  const atoms = graph.atoms;
  const inst = fg.instances[0];
  const oIdx = inst.atoms[0];
  const c1 = inst.atoms[1];
  const c2 = inst.atoms[2];
  const sideA = longestChainFrom(graph, c1, new Set([oIdx]));
  const sideB = longestChainFrom(graph, c2, new Set([oIdx]));
  const nameA = substituentName(graph, c1, new Set([oIdx]));
  const nameB = substituentName(graph, c2, new Set([oIdx]));
  const lenA = sideA.length;
  const lenB = sideB.length;

  let name: string;
  if (nameA === nameB) {
    if (nameA === '甲基') name = '二甲醚';
    else if (nameA === '乙基') name = '乙醚';
    else if (nameA === '丙基') name = '二丙醚';
    else if (nameA === '丁基') name = '二丁醚';
    else name = '二' + nameA + '醚';
  } else {
    const bothLinear = LINEAR_ALKYL.has(nameA) && LINEAR_ALKYL.has(nameB);
    const [first, second] = lenA <= lenB ? [nameA, nameB] : [nameB, nameA];
    name = bothLinear ? ALKYL_SHORT[first] + ALKYL_SHORT[second] + '醚' : first + second + '醚';
  }

  const longerSide = lenA >= lenB ? sideA : sideB;
  const shorterRoot = lenA >= lenB ? c2 : c1;
  const shorterName = lenA >= lenB ? nameB : nameA;
  const numbering = new Map<number, number>();
  longerSide.forEach((a, i) => numbering.set(i + 1, a));
  const substituentGroups: NamerSubstituent[] =
    nameA === nameB ? [] : [{ name: shorterName, positions: [], atoms: [shorterRoot] }];
  return {
    ok: true,
    name,
    suffix: '醚',
    parentChainLen: Math.max(lenA, lenB),
    chainAtomIndices: longerSide,
    numbering,
    substituentGroups,
    fgAtoms: [oIdx],
    fgPositions: [],
    smiles: graph.smiles,
  };
}

/** 苯环位距（1 位起算的环距离：2→1 邻、3→2 间、4→3 对） */
function ringDist(pos: number): number {
  const d = Math.abs(pos - 1);
  return Math.min(d, 6 - d);
}

function distPrefix(dist: number): string {
  return dist === 1 ? '邻' : dist === 2 ? '间' : '对';
}

/** 检测芳香醇：苯环外 C 分支的子树含醇羟基（C-O(H) 单键，非羧基/酚） */
function detectAromaticAlcohol(graph: MoleculeGraph, ring: number[]): { root: number } | null {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const ringSet = new Set(ring);
  for (const r of ring) {
    for (const n of adj[r]) {
      if (ringSet.has(n.to) || atoms[n.to].element !== 'C') continue;
      const root = n.to;
      // 子树（避开环）中找连醇羟基的碳
      const stack = [root];
      const seen = new Set<number>(ringSet);
      while (stack.length) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        const isCarbonylC = adj[cur].some((x) => x.order === 2 && atoms[x.to].element === 'O');
        for (const nb of adj[cur]) {
          const el = atoms[nb.to].element;
          if (el === 'O' && nb.order === 1 && atoms[nb.to].hCount >= 1 && !isCarbonylC) {
            return { root };
          }
          if (el === 'C' && !ringSet.has(nb.to) && !seen.has(nb.to)) stack.push(nb.to);
        }
      }
    }
  }
  return null;
}

/** 芳香醇命名：苯乙醇 / 1-苯乙醇 / 苯甲醇（苯环作取代基的脂肪醇） */
function nameAromaticAlcohol(graph: MoleculeGraph, ring: number[], info: { root: number }): NamedResult {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const ringSet = new Set(ring);
  const chain = longestChainFrom(graph, info.root, ringSet);
  const ohC =
    chain.find(
      (ci) =>
        adj[ci].some((x) => atoms[x.to].element === 'O' && x.order === 1 && atoms[x.to].hCount >= 1) &&
        !adj[ci].some((y) => y.order === 2 && atoms[y.to].element === 'O')
    ) ?? chain[chain.length - 1];
  const ohIdx = chain.indexOf(ohC);
  const order = ohIdx > chain.length - 1 - ohIdx ? [...chain].reverse() : [...chain];
  const ohPos = order.indexOf(ohC) + 1;
  const phenylPos = order.indexOf(info.root) + 1;
  const len = chain.length;
  const stem = LEN_STEM[len] ?? '';

  let alcoholPart: string;
  if (len >= 3) alcoholPart = ohPos + '-' + stem + '醇';
  else alcoholPart = stem + '醇';
  let phenylPart: string;
  if (phenylPos === 1 && len === 1) phenylPart = '苯';
  else if (phenylPos === 1) phenylPart = '1-苯';
  else if (phenylPos === 2 && len === 2) phenylPart = '苯';
  else phenylPart = phenylPos + '-苯基';
  const name = phenylPart + alcoholPart;

  const numbering = new Map<number, number>();
  order.forEach((a, i) => numbering.set(i + 1, a));
  const ohO = adj[ohC].find((x) => atoms[x.to].element === 'O' && x.order === 1);
  return {
    ok: true,
    name,
    suffix: '醇',
    parentChainLen: len,
    chainAtomIndices: order,
    numbering,
    substituentGroups: [{ name: '苯基', positions: [phenylPos], atoms: [info.root] }],
    fgAtoms: ohO ? [ohO.to] : [],
    fgPositions: [ohPos],
    smiles: graph.smiles,
  };
}

/** 检测环外 C 分支子树是否含酯基 O-C(=O)-R（甲酸苄酯/乙酸苄酯等）；返回酯桥羰基碳或 null */
function subtreeHasAcylEster(graph: MoleculeGraph, root: number, ringSet: Set<number>): number | null {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const stack = [root];
  const seen = new Set<number>(ringSet);
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const nb of adj[cur]) {
      const el = atoms[nb.to].element;
      if (el === 'O' && nb.order === 1) {
        // O 的另一侧若为 C(=O)-R（任意酰基酯，不限于甲酸）→ 返回该羰基碳
        for (const x of adj[nb.to]) {
          if (x.to === cur) continue;
          const xe = atoms[x.to].element;
          if (xe === 'C' && adj[x.to].some((y) => y.order === 2 && atoms[y.to].element === 'O')) {
            return x.to;
          }
        }
      } else if (el === 'C') {
        if (!seen.has(nb.to)) stack.push(nb.to);
      }
    }
  }
  return null;
}

const ESTER_ALKYL_SHORT_AR: Record<string, string> = {
  甲基: '甲', 乙基: '乙', 丙基: '丙', 丁基: '丁',
  异丙基: '异丙', 正丙基: '丙', 异丁基: '异丁', 仲丁基: '仲丁', 叔丁基: '叔丁', 正丁基: '丁',
  苄基: '苄', 苯基: '苯',
};

/** 芳香酯命名：苯甲酸甲酯 / 乙酸苯酯 / 甲酸苄酯 */
function nameAromaticEster(
  graph: MoleculeGraph,
  ring: number[],
  info: { type: 'benzoate' | 'phenyl' | 'benzyl'; acidRoot: number; alkylRoot?: number },
  subs: Array<{ name: string; atom: number; root: number }>,
  groups: Map<string, number[]>
): string {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  if (info.type === 'benzoate' && info.alkylRoot !== undefined) {
    // 苯甲酸X酯：苯甲酸 + 醇烷基名
    const alkylName = substituentName(graph, info.alkylRoot, new Set(ring));
    const alk = ESTER_ALKYL_SHORT_AR[alkylName] ?? alkylName;
    if (subs.length === 0) return '苯甲酸' + alk + '酯';
    const g = [...groups.entries()][0];
    return distPrefix(ringDist(g[1][0])) + g[0] + '苯甲酸' + alk + '酯';
  }
  // 酸部分：从羰基碳延伸的碳链（避开酯桥氧侧）
  const oBridge = adj[info.acidRoot].find((x) => atoms[x.to].element === 'O' && x.order === 1);
  const acidChain = longestChainFrom(graph, info.acidRoot, oBridge ? new Set([oBridge.to]) : new Set());
  const acidStem = LEN_STEM[acidChain.length] ?? '';
  if (info.type === 'phenyl') {
    // 乙酸苯酯：酸名 + 苯酯（若有环上取代基则加前缀）
    const acidName = acidStem + '酸';
    if (subs.length === 0) return acidName + '苯酯';
    const g = [...groups.entries()][0];
    return distPrefix(ringDist(g[1][0])) + g[0] + acidName + '苯酯';
  }
  // 苄酯：甲酸苄酯
  const acidName = acidStem + '酸';
  return acidName + '苄酯';
}

/** 检测苯基脂肪醛/酸（苯乙醛/苯乙酸：苯环外 C 分支含 CHO/COOH 端基，且苯环不直接连羰基） */
function detectAromaticCarbonylChain(
  graph: MoleculeGraph,
  ring: number[]
): { root: number; kind: 'aldehyde' | 'acid' } | null {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const ringSet = new Set(ring);
  for (const r of ring) {
    for (const n of adj[r]) {
      if (ringSet.has(n.to) || atoms[n.to].element !== 'C') continue;
      const root = n.to;
      // 苯环直接连羰基（苯甲醛/苯甲酸）→ 交给 nameAromatic
      if (adj[root].some((x) => x.order === 2 && atoms[x.to].element === 'O')) continue;
      const stack = [root];
      const seen = new Set<number>(ringSet);
      while (stack.length) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        const hasO2 = adj[cur].some((x) => x.order === 2 && atoms[x.to].element === 'O');
        if (hasO2) {
          const singleOs = adj[cur].filter((x) => x.order === 1 && atoms[x.to].element === 'O');
          if (singleOs.length >= 1 && singleOs.every((x) => atoms[x.to].hCount >= 1)) {
            return { root, kind: 'acid' }; // COOH
          }
          if (singleOs.length === 0 && atoms[cur].hCount >= 1) {
            return { root, kind: 'aldehyde' }; // CHO
          }
        }
        for (const x of adj[cur]) {
          if (atoms[x.to].element === 'C' && !ringSet.has(x.to) && !seen.has(x.to)) stack.push(x.to);
        }
      }
    }
  }
  return null;
}

/** 苯基脂肪醛/酸命名：苯乙醛 / 苯乙酸 / 3-苯基丙酸（苯环作取代基） */
function nameAromaticCarbonylChain(
  graph: MoleculeGraph,
  ring: number[],
  info: { root: number; kind: 'aldehyde' | 'acid' }
): NamedResult {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const ringSet = new Set(ring);
  const chain = longestChainFrom(graph, info.root, ringSet);
  const carbonylC =
    chain.find((ci) => adj[ci].some((x) => x.order === 2 && atoms[x.to].element === 'O')) ?? chain[chain.length - 1];
  const carbonylIdx = chain.indexOf(carbonylC);
  const order = carbonylIdx > chain.length - 1 - carbonylIdx ? [...chain].reverse() : [...chain];
  const carbonylPos = order.indexOf(carbonylC) + 1;
  const phenylPos = order.indexOf(info.root) + 1;
  const len = chain.length;
  const stem = LEN_STEM[len] ?? '';
  const suffix = info.kind === 'aldehyde' ? '醛' : '酸';

  // 链上其它取代基（氨基等，苯丙氨酸 → 2-氨基-3-苯基丙酸）；苯环原子不算
  const fgSet = new Set<number>([carbonylC]);
  for (const x of adj[carbonylC]) {
    if (atoms[x.to].element === 'O') fgSet.add(x.to);
  }
  const otherSubs: Array<{ name: string; pos: number }> = [];
  for (let pos = 0; pos < order.length; pos++) {
    const atom = order[pos];
    for (const nb of adj[atom]) {
      if (order.includes(nb.to) || ringSet.has(nb.to)) continue;
      if (fgSet.has(nb.to) || atoms[nb.to].element === 'H') continue;
      const nm = substituentName(graph, nb.to, new Set(order));
      if (!nm) continue;
      otherSubs.push({ name: nm, pos: pos + 1 });
    }
  }

  // 组装：取代基（苯基 + 其它）按位次排序，位次相同按 SUBST_ORDER（氨基在甲基前）
  // 苯基部分特例：链 2 且苯基在 2 位 → '苯'（苯乙酸/苯乙醛）；链 1 位 → '1-苯'
  const phenylText =
    phenylPos === 2 && len === 2 ? '苯' : phenylPos === 1 ? '1-苯' : `${phenylPos}-苯基`;
  const parts: Array<{ text: string; pos: number; order: number }> = [
    { text: phenylText, pos: phenylPos, order: 0 },
    ...otherSubs.map((s) => ({ text: `${s.pos}-${s.name}`, pos: s.pos, order: SUBST_ORDER[s.name] ?? 99 })),
  ];
  parts.sort((a, b) => a.pos - b.pos || a.order - b.order);
  const prefix = parts.map((p) => p.text).join('-');
  // 官能团位次：酸/醛固定 1 位不写（苯丙酸/苯乙醛）；其余位次写（3-苯基-2-丙酸 类）
  const fgPart = len >= 3 && carbonylPos !== 1 ? `${carbonylPos}-${stem}${suffix}` : `${stem}${suffix}`;
  const name = prefix ? prefix + (/\d/.test(fgPart[0]) ? '-' : '') + fgPart : fgPart;

  const numbering = new Map<number, number>();
  order.forEach((a, i) => numbering.set(i + 1, a));
  const substituentGroups: NamerSubstituent[] = [
    { name: '苯基', positions: [phenylPos], atoms: [info.root] },
    ...groupOtherSubs(otherSubs),
  ].sort((a, b) => a.positions[0] - b.positions[0]);
  return {
    ok: true,
    name,
    suffix,
    parentChainLen: len,
    chainAtomIndices: order,
    numbering,
    substituentGroups,
    fgAtoms: [carbonylC],
    fgPositions: [carbonylPos],
    smiles: graph.smiles,
  };
}

/** 链上其它取代基按名合并 */
function groupOtherSubs(subs: Array<{ name: string; pos: number }>): NamerSubstituent[] {
  const map = new Map<string, number[]>();
  for (const s of subs) {
    const list = map.get(s.name) ?? [];
    list.push(s.pos);
    map.set(s.name, list);
  }
  return [...map.entries()].map(([name, poss]) => ({ name, positions: poss.sort((a, b) => a - b), atoms: [] }));
}

/** 苯环系命名 */
function nameAromatic(graph: MoleculeGraph, ring: number[]): NamedResult {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const ringSet = new Set(ring);
  // 环外取代基
  interface RingSub {
    name: string;
    atom: number; // 环原子
    root: number; // 取代基根
  }
  const subs: RingSub[] = [];
  let fgSuffix: string | null = null;
  let fgAtoms: number[] = [];
  let fgRingAtom: number | null = null; // 官能团（酚 OH / 醚 O / 醛 / 酸 / 酯）所在环原子（编号起点）
  let acidRingAtoms: number[] = []; // 多羧基（邻/间/对苯二甲酸：两个 COOH 的环原子）
  let etherAlkyl: string | null = null; // 苯甲醚/苯乙醚 的烷基名
  let pendingPhenol: { o: number; r: number } | null = null; // 已设的酚（酸/醛升级时转羟基取代基）
  // 芳香酯信息（苯环直接连酯基）：type=benzoate(苯甲酸酯) / phenyl(芳酯 O-C=O) / benzyl(苄酯 CH2-O-C=O)
  let esterInfo: { type: 'benzoate' | 'phenyl' | 'benzyl'; acidRoot: number; alkylRoot?: number; ringAtom?: number } | null = null;
  // 苯环多官能团优先级：酸 > 酯 > 醛 > 酚 > 胺（水杨酸 = 酸 + 酚羟基作取代基）
  const FG_PRIO_AR: Record<string, number> = { 酸: 5, 酯: 5, 醛: 4, 酚: 3, 胺: 2 };
  /** 酸 > 酯：芳酯氧（O-C(=O)-R）降为酰氧基取代基（阿司匹林 → 邻乙酰氧基苯甲酸） */
  const demotePhenylEster = (): void => {
    if (esterInfo?.type === 'phenyl' && esterInfo.ringAtom != null) {
      const o = adj[esterInfo.ringAtom].find((x) => !ringSet.has(x.to) && atoms[x.to].element === 'O');
      if (o) subs.push({ name: '乙酰氧基', atom: esterInfo.ringAtom, root: o.to });
      esterInfo = null;
    }
  };
  const promoteFg = (suffix: string, atomsArr: number[], ringAtom: number): void => {
    if (fgSuffix === '酚' && pendingPhenol) {
      subs.push({ name: '羟基', atom: pendingPhenol.r, root: pendingPhenol.o });
      pendingPhenol = null;
    }
    if (suffix === '酸') demotePhenylEster();
    fgSuffix = suffix;
    fgAtoms.push(...atomsArr);
    fgRingAtom = ringAtom;
  };
  for (const r of ring) {
    for (const n of adj[r]) {
      if (ringSet.has(n.to)) continue;
      const el = atoms[n.to].element;
      // 官能团类
      if (el === 'O') {
        if (atoms[n.to].hCount >= 1) {
          // OH → 酚（若已有更高优先级 fg（酸/醛/酯），降级为羟基取代基）
          if ((FG_PRIO_AR[fgSuffix ?? ''] ?? 0) > 3) {
            subs.push({ name: '羟基', atom: r, root: n.to });
          } else if (fgSuffix === '酚') {
            subs.push({ name: '羟基', atom: r, root: n.to }); // 多元酚第二个 OH
          } else {
            fgSuffix = '酚';
            fgAtoms.push(n.to);
            fgRingAtom = r;
            pendingPhenol = { o: n.to, r };
          }
        } else {
          // 醚氧或芳酯氧（乙酸苯酯：O-C(=O)-R）
          const otherC = adj[n.to].find((x) => !ringSet.has(x.to) && atoms[x.to].element === 'C');
          if (otherC && adj[otherC.to].some((x) => x.order === 2 && atoms[x.to].element === 'O')) {
            if (fgSuffix === '酸') {
              // 已有羧酸官能团：酰氧基作取代基（阿司匹林 → 邻乙酰氧基苯甲酸）
              subs.push({ name: '乙酰氧基', atom: r, root: n.to });
            } else {
              promoteFg('酯', [], r);
              esterInfo = { type: 'phenyl', acidRoot: otherC.to, ringAtom: r };
            }
          } else if (otherC) {
            etherAlkyl = substituentName(graph, otherC.to, ringSet);
            fgRingAtom = r; // 邻/间/对甲基苯甲醚的编号起点
          }
        }
      } else if (el === 'N') {
        const oNeighbors = adj[n.to].filter((x) => atoms[x.to].element === 'O');
        if (oNeighbors.length >= 2) {
          subs.push({ name: '硝基', atom: r, root: n.to });
        } else {
          // 酰氨基：环外 N 连羰基 C(=O)R（对乙酰氨基酚/乙酰苯胺，N-酰基不丢失）
          const acylC = adj[n.to].find(
            (x) => atoms[x.to].element === 'C' && adj[x.to].some((y) => y.order === 2 && atoms[y.to].element === 'O')
          );
          if (acylC) {
            const alkylRoot = adj[acylC.to].find((x) => x.to !== n.to && atoms[x.to].element === 'C' && x.order === 1);
            const alkylName = alkylRoot ? substituentName(graph, alkylRoot.to, new Set([n.to, acylC.to])) : '';
            const acylName = alkylName === '甲基' ? '乙酰氨基' : alkylName ? alkylName.replace(/基$/, '酰氨基') : '甲酰氨基';
            subs.push({ name: acylName, atom: r, root: n.to });
          } else if ((FG_PRIO_AR[fgSuffix ?? ''] ?? 0) > 2) {
            subs.push({ name: '氨基', atom: r, root: n.to });
          } else {
            promoteFg('胺', [n.to], r);
          }
        }
      } else if (el === 'Br' || el === 'Cl' || el === 'F' || el === 'I') {
        subs.push({ name: { Br: '溴', Cl: '氯', F: '氟', I: '碘' }[el] ?? el, atom: r, root: n.to });
      } else if (el === 'C') {
        // 羧基 C(=O)O / 酯基 C(=O)OR / 醛基 C(=O)H / 苄酯 CH2-O-C(=O)R / 烷基
        const isCarbonyl = adj[n.to].some((x) => x.order === 2 && atoms[x.to].element === 'O');
        if (isCarbonyl) {
          const singleO = adj[n.to].find((x) => atoms[x.to].element === 'O' && x.order === 1);
          if (singleO) {
            const oH = atoms[singleO.to].hCount >= 1;
            if (oH) {
              if (fgSuffix === '酸') {
                // 第二个 COOH（苯二甲酸）：累积，不覆盖首个
                acidRingAtoms.push(r);
                fgAtoms.push(n.to, singleO.to);
              } else {
                promoteFg('酸', [n.to, singleO.to], r);
                acidRingAtoms.push(r);
              }
            } else {
              // 苯甲酸酯：苯环直接连 C(=O)-OR（苯甲酸甲酯）
              const alk = adj[singleO.to].find((x) => x.to !== n.to && atoms[x.to].element === 'C');
              if (fgSuffix === '酸') {
                // 酸 + 苯甲酸酯并存（PET 单体：对苯二甲酸单乙二醇酯）：酯位记入酸位集
                acidRingAtoms.push(r);
                esterInfo = { type: 'benzoate', acidRoot: n.to, alkylRoot: alk ? alk.to : undefined };
              } else {
                promoteFg('酯', [n.to], r);
                esterInfo = { type: 'benzoate', acidRoot: n.to, alkylRoot: alk ? alk.to : undefined };
              }
            }
          } else {
            promoteFg('醛', [n.to], r);
          }
        } else {
          // 非羰基 C：子树若含 O-C(=O)-H（甲酸苄酯）则视为苄酯，否则作取代基
          // 注意：返回的是羰基碳图索引，可能为 0（falsy），须用 null 判断
          const benzylEster = subtreeHasAcylEster(graph, n.to, ringSet);
          if (benzylEster !== null) {
            promoteFg('酯', [], r);
            esterInfo = { type: 'benzyl', acidRoot: benzylEster };
          } else {
            const name = substituentName(graph, n.to, new Set([...ringSet, ...ring]));
            subs.push({ name, atom: r, root: n.to });
          }
        }
      } else {
        subs.push({ name: el, atom: r, root: n.to });
      }
    }
  }

  // 位置：官能团（酚/酸/醛）固定 1 位；无官能团时尝试每个取代基作起点 + 正/反两方向，
  // 取位次集字典序最小（2,4-二氯甲苯 非 4,6-；1,2,4-三甲苯 非 1,4,5-）；同名位次和相同时
  // 甲基优先 1 位（X-甲苯 教材写法）
  const positions: Array<{ name: string; pos: number; atom: number }> = [];
  if (subs.length > 0) {
    // 起点：官能团固定 1 位；无官能团且含甲基时甲基必须 1 位（甲苯系列，TNT → 2,4,6-三硝基甲苯）；
    // 否则尝试每个取代基 + 正/反两方向取位次集字典序最小（2,4-二氯甲苯 非 4,6-）
    let starts: number[];
    if (fgRingAtom != null) starts = [fgRingAtom];
    else if (subs.some((s) => s.name === '甲基')) starts = subs.filter((s) => s.name === '甲基').map((s) => s.atom);
    else starts = subs.map((s) => s.atom);
    let best: Array<{ name: string; pos: number; atom: number }> | null = null;
    let bestKey = '';
    for (const start of starts) {
      const firstIdx = ring.indexOf(start);
      for (const dir of [1, -1] as const) {
        const cand: Array<{ name: string; pos: number; atom: number }> = [];
        for (const s of subs) {
          const idx = ring.indexOf(s.atom);
          let pos = dir === 1 ? idx - firstIdx : firstIdx - idx;
          if (pos < 0) pos += 6;
          cand.push({ name: s.name, pos: pos + 1, atom: s.atom });
        }
        const key = cand.map((c) => c.pos).sort((a, b) => a - b).join(',');
        if (best === null || key < bestKey) {
          bestKey = key;
          best = cand;
        }
      }
    }
    positions.push(...(best ?? []));
  }

  // 同名合并
  const groups = new Map<string, number[]>();
  for (const p of positions) {
    const list = groups.get(p.name) ?? [];
    list.push(p.pos);
    groups.set(p.name, list);
  }
  const substituentGroups: NamerSubstituent[] = [...groups.entries()]
    .map(([name, poss]) => ({ name, positions: poss.sort((a, b) => a - b), atoms: [] }))
    .sort((a, b) => a.positions[0] - b.positions[0]);

  // 命名
  let name: string;
  if (fgSuffix === '酚') {
    if (subs.length === 0) {
      name = '苯酚';
    } else if (subs.length === 1) {
      // 邻/间/对 取代苯酚（编号以 OH 为 1）；酰氨基 → X酰氨基酚（对乙酰氨基酚，教材俗名）
      const g = [...groups.entries()][0];
      if (g[0].includes('酰氨基')) name = distPrefix(ringDist(g[1][0])) + g[0] + '酚';
      else name = distPrefix(ringDist(g[1][0])) + g[0] + '苯酚';
    } else if (subs.every((s) => s.name === '甲基')) {
      // 二甲酚/三甲酚（2,3-二甲酚）
      const poss = groups.get('甲基')!;
      name = poss.join(',') + '-' + MULT_NAMES[poss.length] + '甲酚';
    } else {
      name = subsToName(groups, '苯酚');
    }
  } else if (fgSuffix === '酸') {
    if (subs.length === 0 && acidRingAtoms.length <= 1) {
      name = '苯甲酸';
    } else if (subs.length === 1 && acidRingAtoms.length <= 1) {
      // 邻/间/对 取代苯甲酸（编号以 COOH 为 1）
      const g = [...groups.entries()][0];
      name = distPrefix(ringDist(g[1][0])) + g[0] + '苯甲酸';
    } else if (acidRingAtoms.length >= 2 && esterInfo?.type === 'benzoate') {
      // PET 单体：一个 COOH + 一个苯甲酸酯（对苯二甲酸单乙二醇酯）
      const poss = acidRingAtoms.map((a) => ring.indexOf(a) + 1).sort((a, b) => a - b);
      const d = Math.min(Math.abs(poss[0] - poss[1]), 6 - Math.abs(poss[0] - poss[1]));
      const posName = d === 1 ? '邻' : d === 2 ? '间' : '对';
      name = posName + '苯二甲酸乙二醇酯';
    } else if (acidRingAtoms.length >= 2 && subs.length === 0) {
      // 苯二甲酸：两个 COOH 按环距离判定邻/间/对（不依赖环路径起点）
      const poss = acidRingAtoms.map((a) => ring.indexOf(a) + 1).sort((a, b) => a - b);
      const d = Math.min(Math.abs(poss[0] - poss[1]), 6 - Math.abs(poss[0] - poss[1]));
      if (d === 1) name = '邻苯二甲酸';
      else if (d === 2) name = '间苯二甲酸';
      else if (d === 3) name = '对苯二甲酸';
      else name = poss.join(',') + '-苯二甲酸';
    } else {
      name = subsToName(groups, '苯甲酸');
    }
  } else if (fgSuffix === '醛') {
    if (subs.length === 0) {
      name = '苯甲醛';
    } else if (subs.length === 1) {
      // 邻/间/对 取代苯甲醛（编号以 CHO 为 1）
      const g = [...groups.entries()][0];
      name = distPrefix(ringDist(g[1][0])) + g[0] + '苯甲醛';
    } else {
      name = subsToName(groups, '苯甲醛');
    }
  } else if (fgSuffix === '酯' && esterInfo) {
    // 芳香酯：苯甲酸甲酯 / 乙酸苯酯 / 甲酸苄酯
    name = nameAromaticEster(graph, ring, esterInfo, subs, groups);
    return finishAromatic(graph, ring, name, '酯', substituentGroups, fgAtoms, fgSuffix);
  } else if (fgSuffix === '胺') {
    name = '苯胺';
  } else if (etherAlkyl) {
    if (subs.length === 0) {
      name = '苯' + (ALKYL_SHORT[etherAlkyl] ?? etherAlkyl) + '醚';
    } else if (subs.length === 1 && subs[0].name === '甲基') {
      // 邻/间/对甲基苯甲醚
      const pos = groups.get('甲基')![0];
      name = distPrefix(ringDist(pos)) + '甲基苯甲醚';
    } else {
      name = subsToName(groups, '苯甲醚');
    }
  } else if (subs.length === 0) {
    name = '苯';
  } else if (subs.length === 1) {
    // 单取代：甲苯/乙苯/苯乙烯/苯乙炔/硝基苯/氯苯...；酰氨基 → 乙酰苯胺 类
    const [gname] = [...groups.entries()][0];
    if (gname === '甲基') name = '甲苯';
    else if (gname === '乙基') name = '乙苯';
    else if (gname === '乙烯基') name = '苯乙烯';
    else if (gname === '乙炔基') name = '苯乙炔';
    else if (gname.includes('酰氨基')) name = gname.replace('氨基', '') + '苯胺';
    else name = gname + '苯';
  } else if (
    groups.get('甲基')?.length === 1 &&
    groups.get('甲基')![0] === 1 &&
    groups.size > 1 &&
    [...groups.entries()].filter(([nm]) => nm !== '甲基').reduce((s, [, poss]) => s + poss.length, 0) > 1
  ) {
    // 甲基@1 + 其他组多取代 → X-甲苯（2,4,6-三硝基甲苯；邻氯甲苯等单取代走邻/间/对分支）
    const others = [...groups.entries()].filter(([nm]) => nm !== '甲基');
    const parts = others.map(([nm, poss]) => {
      const mult = poss.length > 1 ? MULT_NAMES[poss.length] : '';
      return `${poss.join(',')}-${mult}${nm === '甲基' ? '甲' : nm}`;
    });
    name = parts.join('-') + '甲苯';
    return finishAromatic(graph, ring, name, '苯', substituentGroups, fgAtoms, fgSuffix);
  } else if (groups.size === 2 && subs.length === 2) {
    // 两种不同取代基：邻/间/对 + 非烷基名 + 烷基简写（邻氯甲苯/对硝基甲苯）
    const entries = [...groups.entries()];
    const alkEntry = entries.find(([nm]) => LINEAR_ALKYL.has(nm));
    const nonAlkEntry = entries.find(([nm]) => !LINEAR_ALKYL.has(nm));
    if (alkEntry && nonAlkEntry && alkEntry[1].length === 1 && nonAlkEntry[1].length === 1) {
      const d = Math.abs(alkEntry[1][0] - nonAlkEntry[1][0]);
      const dist = Math.min(d, 6 - d);
      const prefix = dist === 1 ? '邻' : dist === 2 ? '间' : '对';
      name = prefix + nonAlkEntry[0] + (ALKYL_SHORT[alkEntry[0]] ?? alkEntry[0]) + '苯';
      return finishAromatic(graph, ring, name, '苯', substituentGroups, fgAtoms, fgSuffix);
    }
    name = subsToName(groups);
  } else {
    // 多取代（全甲基时简写为 甲：1,2,3-三甲苯）
    const allMethyl = [...groups.keys()].every((k) => k === '甲基');
    const parts: string[] = [];
    for (const [gname, poss] of groups) {
      if (poss.length === 2 && subs.length === 2) {
        // 二取代：邻/间/对（二甲苯 / 二氯苯 / 二溴苯...）
        const [p1, p2] = poss;
        const diff = Math.abs(p1 - p2);
        const short = gname === '甲基' ? '甲' : gname;
        if (diff === 1 || diff === 5) {
          name = '邻二' + short + '苯';
          return finishAromatic(graph, ring, name, '苯', substituentGroups, fgAtoms, fgSuffix);
        }
        if (diff === 2 || diff === 4) {
          name = '间二' + short + '苯';
          return finishAromatic(graph, ring, name, '苯', substituentGroups, fgAtoms, fgSuffix);
        }
        if (diff === 3) {
          name = '对二' + short + '苯';
          return finishAromatic(graph, ring, name, '苯', substituentGroups, fgAtoms, fgSuffix);
        }
      }
      const posStr = poss.join(',');
      const mult = poss.length > 1 ? MULT_NAMES[poss.length] : '';
      const nm = allMethyl && gname === '甲基' ? '甲' : gname;
      parts.push(posStr + '-' + mult + nm);
    }
    name = parts.join('-') + '苯';
  }
  return finishAromatic(graph, ring, name, fgSuffix ?? '苯', substituentGroups, fgAtoms, fgSuffix);
}

/** 多取代苯：1,2,3-三甲苯 / 1,2-二甲基-4-氯苯 风格（全甲基时甲基简写为 甲） */
function subsToName(groups: Map<string, number[]>, suffix = '苯'): string {
  const allMethyl = [...groups.keys()].every((k) => k === '甲基');
  const parts: string[] = [];
  for (const [gname, poss] of groups) {
    const posStr = poss.join(',');
    const mult = poss.length > 1 ? MULT_NAMES[poss.length] : '';
    const nm = allMethyl && gname === '甲基' ? '甲' : gname;
    parts.push(posStr + '-' + mult + nm);
  }
  return parts.join('-') + suffix;
}

function finishAromatic(
  graph: MoleculeGraph,
  ring: number[],
  name: string,
  suffix: string,
  substituentGroups: NamerSubstituent[],
  fgAtoms: number[],
  fgSuffix: string | null
): NamedResult {
  const numbering = new Map<number, number>();
  ring.forEach((a, i) => numbering.set(i + 1, a));
  return {
    ok: true,
    name,
    suffix,
    parentChainLen: 6,
    chainAtomIndices: ring,
    numbering,
    substituentGroups,
    fgAtoms,
    fgPositions: fgSuffix ? [1] : [],
    smiles: graph.smiles,
  };
}

/** 酯命名：X酸Y酯 */
function nameEster(graph: MoleculeGraph, fg: FgInfo): NamedResult {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  // 二酸二酯（两个酯羰基，如 乙二酸二乙酯）
  if (fg.instances.length >= 2) {
    const di = nameDiEster(graph, fg);
    if (di) return di;
  }
  const c = fg.instances[0].carbons[0]; // 羰基碳
  // 酯桥 O：连 c 且连另一个 C
  const oBridge = adj[c].find((n) => atoms[n.to].element === 'O' && adj[n.to].some((x) => x.to !== c && atoms[x.to].element === 'C'));
  if (!oBridge) {
    return { ok: false, name: '', suffix: '酯', parentChainLen: 0, chainAtomIndices: [], numbering: new Map(), substituentGroups: [], fgAtoms: fg.atoms, fgPositions: [], smiles: graph.smiles, error: '酯结构异常' };
  }
  const oIdx = oBridge.to;
  const alcoholStart = adj[oIdx].find((n) => n.to !== c && atoms[n.to].element === 'C');
  if (!alcoholStart) {
    return { ok: false, name: '', suffix: '酯', parentChainLen: 0, chainAtomIndices: [], numbering: new Map(), substituentGroups: [], fgAtoms: fg.atoms, fgPositions: [], smiles: graph.smiles, error: '酯结构异常' };
  }
  // 酸链：从 c 出发沿 C-C（不含 oBridge/alcohol 侧）找最长链
  const acidChain = longestChainThrough(graph, c, new Set([oIdx, alcoholStart.to]));
  // 醇链：从 alcoholStart 出发的最长 C-C 链
  const alcoholChain = longestChainFrom(graph, alcoholStart.to, new Set([oIdx]));
  const acidLen = acidChain.length;
  const alcoholLen = alcoholChain.length;
  // 酸部分取代基
  const acidSubs: NamerSubstituent[] = [];
  const chainSet = new Set(acidChain);
  const fgAtomSet = new Set(fg.atoms);
  const oxoP: number[] = [];
  for (let pos = 0; pos < acidChain.length; pos++) {
    const atom = acidChain[pos];
    for (const n of adj[atom]) {
      if (chainSet.has(n.to)) continue;
      if (fgAtomSet.has(n.to)) continue;
      // 氧代：酸链内羰基 =O（3-氧代丁酸乙酯），是双键 O 而非取代基
      if (n.order === 2 && atoms[n.to].element === 'O') {
        oxoP.push(pos + 1);
        continue;
      }
      const nm = substituentName(graph, n.to, chainSet);
      if (!nm) continue;
      const idx = acidSubs.findIndex((g) => g.name === nm);
      if (idx >= 0) acidSubs[idx].positions.push(pos + 1);
      else acidSubs.push({ name: nm, positions: [pos + 1], atoms: [n.to] });
    }
  }
  if (oxoP.length) acidSubs.push({ name: '氧代', positions: [...new Set(oxoP)].sort((a, b) => a - b), atoms: [] });
  for (const g of acidSubs) g.positions.sort((a, b) => a - b);
  acidSubs.sort((a, b) => a.positions[0] - b.positions[0]);

  const acidStem = LEN_STEM[acidLen];
  // 酸链内烯/炔（2-甲基-2-丙烯酸甲酯：酸部分 2-甲基-2-丙烯酸）
  // 位次用"双键碳到羰基碳的酸侧 C-C 路径"（不经过桥氧），不依赖酸链选取方向
  let acidEne: { positions: number[]; bond: '烯' | '炔' } | undefined;
  const eneP: number[] = [];
  const yneP: number[] = [];
  const eneAtoms = new Set<number>();
  for (const bd of graph.bonds) {
    if (bd.aromatic) continue;
    if (bd.order !== 2 && bd.order !== 3) continue;
    if (atoms[bd.a].element !== 'C' || atoms[bd.b].element !== 'C') continue;
    if (bd.a === c || bd.b === c) continue;
    const dA = acidSideDist(graph, c, oIdx, bd.a);
    const dB = acidSideDist(graph, c, oIdx, bd.b);
    if (dA === null && dB === null) continue; // 醇侧（乙酸乙烯酯的 C=C）
    const loc = Math.min(dA ?? Infinity, dB ?? Infinity);
    const pos = loc + 1; // 羰基碳@1
    if (bd.order === 2) eneP.push(pos);
    else yneP.push(pos);
    eneAtoms.add(bd.a);
    eneAtoms.add(bd.b);
  }
  if (eneP.length) acidEne = { positions: [...new Set(eneP)].sort((a, b) => a - b), bond: '烯' };
  else if (yneP.length) acidEne = { positions: [...new Set(yneP)].sort((a, b) => a - b), bond: '炔' };
  // 酸侧双键碳不作为取代基（避免 乙烯基 重复计入）
  let acidSubsFiltered = acidSubs;
  if (eneAtoms.size > 0) {
    acidSubsFiltered = acidSubs.filter((g) => !(g.name === '乙烯基' || g.name === '乙炔基'));
  }
  // 醇部分用烷基名（甲酸甲酯/乙酸乙酯/乙酸乙烯酯/甲酸叔丁酯）
  const alcoholName = substituentName(graph, alcoholStart.to, new Set([oIdx]));
  const ESTER_ALKYL_SHORT: Record<string, string> = {
    甲基: '甲', 乙基: '乙', 丙基: '丙', 丁基: '丁', 戊基: '戊', 己基: '己',
    异丙基: '异丙', 正丙基: '丙', 异丁基: '异丁', 仲丁基: '仲丁', 叔丁基: '叔丁', 正丁基: '丁',
    异戊基: '异戊', 乙烯基: '乙烯',
  };
  const alcoholPart = ESTER_ALKYL_SHORT[alcoholName] ?? alcoholName;
  const acidPrefix = acidSubsFiltered.length
    ? acidSubsFiltered.map((g) => g.positions.join(',') + '-' + (g.positions.length > 1 ? LEN_STEM[g.positions.length] : '') + g.name).join('-')
    : '';
  let acidBody = acidStem + '酸';
  if (acidEne) {
    acidBody = acidEne.positions.join(',') + '-' + acidStem + acidEne.bond + '酸'; // 2-丙烯酸
  }
  // 酸部分带烯时，取代基前缀与酸名之间加 '-'（2-甲基-2-丙烯酸甲酯）
  const name = `${acidPrefix}${acidPrefix && acidEne ? '-' : ''}${acidBody}${alcoholPart}酯`;
  const numbering = new Map<number, number>();
  acidChain.forEach((a, i) => numbering.set(i + 1, a));
  return {
    ok: true,
    name,
    suffix: '酯',
    parentChainLen: acidLen,
    chainAtomIndices: acidChain,
    numbering,
    substituentGroups: acidSubs,
    fgAtoms: fg.atoms,
    fgPositions: [1],
    ester: { acidLen, alcoholLen, acidName: acidStem + '酸', alcoholName },
    smiles: graph.smiles,
  };
}

/** 二醇二酯（二乙酸乙二酯）：两个酯羰基的桥 O 连到同一碳链（乙二醇）两端 */
function nameGlycolDiester(graph: MoleculeGraph, fg: FgInfo): NamedResult | null {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  if (fg.instances.length < 2) return null;
  const c1 = fg.instances[0].carbons[0];
  const c2 = fg.instances[1].carbons[0];
  if (c1 === c2) return null;
  const alcoStartOf = (c: number): number | null => {
    const ob = adj[c].find(
      (x) => atoms[x.to].element === 'O' && x.order === 1 && adj[x.to].some((y) => y.to !== c && atoms[y.to].element === 'C')
    );
    if (!ob) return null;
    const al = adj[ob.to].find((x) => x.to !== c && atoms[x.to].element === 'C');
    return al ? al.to : null;
  };
  const a1 = alcoStartOf(c1);
  const a2 = alcoStartOf(c2);
  if (a1 === null || a2 === null) return null;
  // 醇侧同一碳链（碳路径）
  const carbonPath = (from: number, to: number): number[] | null => {
    const parent = new Map<number, number>();
    const queue = [from];
    const seen = new Set<number>([from]);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const x of adj[cur]) {
        if (atoms[x.to].element !== 'C' || seen.has(x.to)) continue;
        seen.add(x.to);
        parent.set(x.to, cur);
        if (x.to === to) {
          const path: number[] = [];
          let c = to;
          while (c !== from) {
            path.unshift(c);
            c = parent.get(c)!;
          }
          path.unshift(from);
          return path;
        }
        queue.push(x.to);
      }
    }
    return null;
  };
  const path = carbonPath(a1, a2);
  if (!path) return null;
  const glycolLen = path.length;
  if (glycolLen < 2 || glycolLen > 6) return null;
  const bridgeOf = (c: number): number =>
    adj[c].find(
      (x) => atoms[x.to].element === 'O' && x.order === 1 && adj[x.to].some((y) => y.to !== c && atoms[y.to].element === 'C')
    )!.to;
  const acidStemOf = (c: number): string => {
    const chain = longestChainFrom(graph, c, new Set([bridgeOf(c)]));
    return LEN_STEM[chain.length] ?? '';
  };
  const stem1 = acidStemOf(c1);
  const stem2 = acidStemOf(c2);
  if (!stem1 || stem1 !== stem2) return null;
  const glycolStem = LEN_STEM[glycolLen] ?? '';
  const name = `二${stem1}酸${glycolStem}二酯`;
  const numbering = new Map<number, number>();
  path.forEach((a, i) => numbering.set(i + 1, a));
  return {
    ok: true,
    name,
    suffix: '酯',
    parentChainLen: path.length,
    chainAtomIndices: path,
    numbering,
    substituentGroups: [],
    fgAtoms: fg.atoms,
    fgPositions: [1],
    smiles: graph.smiles,
  };
}

/** 二酸二酯命名：乙二酸二乙酯 / 丁二酸二乙酯（两个酯羰基经碳链相连） */
function nameDiEster(graph: MoleculeGraph, fg: FgInfo): NamedResult | null {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const c1 = fg.instances[0].carbons[0];
  const c2 = fg.instances[1].carbons[0];
  if (c1 === c2) return null;
  // 两羰基间最短碳路径（乙二酸 = 2 碳）
  const path = shortestCarbonPath(graph, c1, c2);
  if (!path || path.length < 2) return null;
  const acidLen = path.length;
  const acidStem = LEN_STEM[acidLen] ?? '';
  // 每个羰基的桥氧侧烷基（醇部分）
  const alcohols: string[] = [];
  const oBridgeOf = (c: number): number | null => {
    const ob = adj[c].find((x) => atoms[x.to].element === 'O' && x.order === 1 && adj[x.to].some((y) => y.to !== c && atoms[y.to].element === 'C'));
    return ob ? ob.to : null;
  };
  for (const c of [c1, c2]) {
    const ob = oBridgeOf(c);
    if (ob === null) return null;
    const alk = adj[ob].find((x) => x.to !== c && atoms[x.to].element === 'C');
    if (!alk) return null;
    alcohols.push(substituentName(graph, alk.to, new Set([c, ob])));
  }
  const [a1, a2] = alcohols;
  const short = (n: string): string => ESTER_ALKYL_SHORT_AR[n] ?? n;
  const alcoPart = a1 === a2 ? '二' + short(a1) + '酯' : short(a1) + '酯' + short(a2) + '酯';
  const name = acidStem + '二酸' + alcoPart;

  const numbering = new Map<number, number>();
  path.forEach((a, i) => numbering.set(i + 1, a));
  return {
    ok: true,
    name,
    suffix: '酯',
    parentChainLen: acidLen,
    chainAtomIndices: path,
    numbering,
    substituentGroups: [],
    fgAtoms: fg.atoms,
    fgPositions: [1, acidLen],
    ester: { acidLen, alcoholLen: 1, acidName: acidStem + '二酸' },
    smiles: graph.smiles,
  };
}

/** 两碳间最短路径（BFS，只走 C-C） */
function shortestCarbonPath(graph: MoleculeGraph, from: number, to: number): number[] | null {
  const adj = adjacency(graph);
  const queue: Array<{ node: number; path: number[] }> = [{ node: from, path: [from] }];
  const visited = new Set<number>([from]);
  while (queue.length) {
    const { node, path } = queue.shift()!;
    for (const x of adj[node]) {
      if (graph.atoms[x.to].element !== 'C') continue;
      if (x.to === to) return [...path, x.to];
      if (!visited.has(x.to)) {
        visited.add(x.to);
        queue.push({ node: x.to, path: [...path, x.to] });
      }
    }
  }
  return null;
}

/** 酸侧双键碳到羰基碳的 C-C 路径长度（必经桥氧 → 醇侧，返回 null） */
function acidSideDist(graph: MoleculeGraph, carbonylC: number, bridgeO: number, start: number): number | null {
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const queue: Array<{ node: number; dist: number }> = [{ node: start, dist: 1 }];
  const visited = new Set<number>([start]);
  while (queue.length) {
    const { node, dist } = queue.shift()!;
    for (const x of adj[node]) {
      if (x.to === carbonylC) return dist;
      if (atoms[x.to].element !== 'C') continue;
      if (visited.has(x.to)) continue;
      visited.add(x.to);
      queue.push({ node: x.to, dist: dist + 1 });
    }
  }
  return null;
}

/** 从 start 出发沿 C-C 键的最长链（避开 blocked） */
function longestChainFrom(graph: MoleculeGraph, start: number, blocked: Set<number>): number[] {
  const adj = adjacency(graph);
  let best: number[] = [start];
  const dfs = (cur: number, visited: Set<number>, path: number[]): void => {
    if (path.length > best.length) best = [...path];
    for (const n of adj[cur]) {
      if (graph.atoms[n.to].element !== 'C') continue;
      if (blocked.has(n.to) || visited.has(n.to)) continue;
      visited.add(n.to);
      path.push(n.to);
      dfs(n.to, visited, path);
      path.pop();
      visited.delete(n.to);
    }
  };
  dfs(start, new Set([start]), [start]);
  return best;
}

/** 经过 must 的最长链（从 must 出发向两端延伸） */
function longestChainThrough(graph: MoleculeGraph, must: number, blocked: Set<number>): number[] {
  const adj = adjacency(graph);
  // 从 must 出发向各方向的最长碳路径（不含 blocked）
  const arms: number[][] = [];
  for (const n of adj[must]) {
    if (graph.atoms[n.to].element !== 'C') continue;
    if (blocked.has(n.to)) continue;
    const path = longestChainFrom(graph, n.to, new Set([...blocked, must]));
    arms.push([must, ...path]);
  }
  if (arms.length === 0) return [must];
  // 取两条最长臂拼接
  arms.sort((a, b) => b.length - a.length);
  const longest = arms[0];
  if (arms.length === 1) return longest;
  // 第二长臂（避免重叠）
  const second = arms.find((a) => !a.slice(1).some((x) => longest.slice(1).includes(x))) ?? arms[1];
  const secondReversed = [...second].reverse();
  const combined = [...secondReversed.slice(0, -1), ...longest];
  return combined;
}

export { SUBST_ORDER };
