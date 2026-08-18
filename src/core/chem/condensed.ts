/**
 * 结构简式（condensed formula）生成器
 * 教科书风格：CH3CH(CH3)CH2CH3、CH3CH2OH、CH3COOH、CH3COOCH2CH3、CH2=CHCH3、HCOOCH3 等
 * 多苯环/多酯：苯环保留 C6H5/C6H4 标记（联苯 → C6H5-C6H5）；多酯拆分
 * （二乙酸乙二酯 → CH3COOCH2CH2OOCCH3）；无法表达时降级为分子式（不输出错误串）。
 */
import { type MoleculeGraph, adjacency, formulaOfGraph } from './graph';

export function condensedFormula(graph: MoleculeGraph): string {
  const rings = findAllRings(graph);
  const esters = findAllEsters(graph);
  // 多苯环（联苯/二苯甲烷/二苯醚等）：苯环保留 C6H5 标记
  if (rings.length >= 2) {
    const multi = condensedPolybenzene(graph, rings);
    if (multi) return multi;
    return formulaOfGraph(graph); // 带取代基多苯环（4-甲基联苯）/三苯甲烷等 → 降级分子式
  }
  // 多酯（二乙酸乙二酯/乙二酸二乙酯）：拆分两个酯基
  if (esters.length >= 2) {
    const multi = condensedMultiEster(graph, esters);
    if (multi) return multi;
    return formulaOfGraph(graph);
  }
  // 桥环/稠环多环碳系统（降冰片烯/菲 Kekulé 等）：无法简式表达 → 降级分子式（不输出链式错串）
  if (carbonCycleCount(graph) >= 2) return formulaOfGraph(graph);
  const ring = rings[0] ?? null;
  if (ring) return condensedBenzene(graph, ring);
  const ester = esters[0] ?? null;
  if (ester) return condensedEster(graph, ester);
  const ether = findEther(graph);
  if (ether) return condensedEther(graph, ether);
  return condensedChain(graph);
}

/** 碳子图环数（E - V + 分量数；≥2 = 桥环/稠环） */
function carbonCycleCount(graph: MoleculeGraph): number {
  const cIdx = graph.atoms.map((a, i) => (a.element === 'C' ? i : -1)).filter((i) => i >= 0);
  if (cIdx.length < 6) return 0;
  const cSet = new Set(cIdx);
  const adj = adjacency(graph);
  let edges = 0;
  for (const b of graph.bonds) {
    if (cSet.has(b.a) && cSet.has(b.b)) edges++;
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
  return edges - cIdx.length + comps;
}

/** 全部苯环（去重；用于多苯环检测） */
function findAllRings(graph: MoleculeGraph): number[][] {
  const aromaticC = graph.atoms.map((a, i) => (a.element === 'C' && a.aromatic ? i : -1)).filter((i) => i >= 0);
  if (aromaticC.length < 6) return [];
  const adj = adjacency(graph);
  const seen = new Set<string>();
  const out: number[][] = [];
  const find = (start: number, current: number[], visited: Set<number>): number[] | null => {
    if (current.length === 6) {
      return adj[current[5]].some((n) => n.to === start) ? [...current] : null;
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

/** 多苯环结构简式：联苯 C6H5-C6H5 / 二苯甲烷 C6H5CH2C6H5 / 二苯醚 C6H5OC6H5；不支持返回 null */
function condensedPolybenzene(graph: MoleculeGraph, rings: number[][]): string | null {
  if (rings.length !== 2) return null;
  const atoms = graph.atoms;
  const adj = adjacency(graph);
  const RA = new Set(rings[0]);
  const RB = new Set(rings[1]);
  // 环间连接原子（直接键两端 / 桥原子）排除在"其它取代基"之外
  const connAtoms = new Set<number>();
  // 直接单键：联苯
  for (const a of rings[0]) {
    for (const nb of adj[a]) {
      if (nb.order === 1 && RB.has(nb.to)) {
        connAtoms.add(a);
        connAtoms.add(nb.to);
      }
    }
  }
  // 桥原子：仅"连接两环"的中间原子（CH2/O 等）计入 connAtoms；普通取代基（如 4-甲基联苯
  // 的甲基）不算 → 触发"环上其它取代基"检查 → 降级分子式
  const reachesRingB = (start: number): boolean => {
    const stack = [start];
    const seen = new Set<number>([...RA, start]);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const x of adj[cur]) {
        if (RB.has(x.to)) return true;
        if (seen.has(x.to)) continue;
        if (atoms[x.to].element !== 'C' && atoms[x.to].element !== 'O') continue;
        seen.add(x.to);
        stack.push(x.to);
      }
    }
    return false;
  };
  for (const a of rings[0]) {
    for (const nb of adj[a]) {
      if (RA.has(nb.to) || RB.has(nb.to) || atoms[nb.to].element === 'H') continue;
      if (reachesRingB(nb.to)) connAtoms.add(nb.to);
    }
  }
  // 环上除环间连接外不得有其它取代基（否则降级）
  for (const ring of rings) {
    const other = new Set(ring);
    for (const r of ring) {
      for (const n of adj[r]) {
        if (other.has(n.to) || RA.has(n.to) || RB.has(n.to) || connAtoms.has(n.to)) continue;
        if (atoms[n.to].element !== 'H') return null;
      }
    }
  }
  // 直接单键：联苯
  for (const a of rings[0]) {
    for (const nb of adj[a]) {
      if (nb.order === 1 && RB.has(nb.to)) return 'C6H5-C6H5';
    }
  }
  // 桥：CH2 / O
  for (const a of rings[0]) {
    for (const nb of adj[a]) {
      if (RA.has(nb.to) || RB.has(nb.to)) continue;
      const el = atoms[nb.to].element;
      if (el === 'O') {
        const otherC = adj[nb.to].find((x) => x.to !== a && atoms[x.to].element === 'C' && RB.has(x.to));
        if (otherC) return 'C6H5OC6H5';
      }
      if (el === 'C') {
        const otherC = adj[nb.to].find((x) => x.to !== a && atoms[x.to].element === 'C' && RB.has(x.to));
        if (otherC && atoms[nb.to].hCount >= 2) return 'C6H5CH2C6H5';
      }
    }
  }
  return null;
}

/** 全部酯桥（多个酯基，如二酸二酯/二醇二酯） */
function findAllEsters(graph: MoleculeGraph): EsterInfo[] {
  const adj = adjacency(graph);
  const out: EsterInfo[] = [];
  const seenC = new Set<number>();
  const scan = (c: number): void => {
    if (seenC.has(c)) return;
    const singleOs = adj[c].filter((n) => graph.atoms[n.to].element === 'O' && n.order === 1);
    for (const o of singleOs) {
      const otherC = adj[o.to].filter((n) => n.to !== c && graph.atoms[n.to].element === 'C');
      if (otherC.length > 0) {
        seenC.add(c);
        out.push({ carbonylC: c, bridgeO: o.to, alcoholStart: otherC[0].to });
        return;
      }
    }
  };
  for (const b of graph.bonds) {
    if (b.order === 2 && graph.atoms[b.a].element === 'C' && graph.atoms[b.b].element === 'O') scan(b.a);
    if (b.order === 2 && graph.atoms[b.b].element === 'C' && graph.atoms[b.a].element === 'O') scan(b.b);
  }
  return out;
}

/** 碳原子间最短路径（只走碳） */
function carbonPathBetween(graph: MoleculeGraph, from: number, to: number): number[] | null {
  const adj = adjacency(graph);
  const parent = new Map<number, number>();
  const queue = [from];
  const seen = new Set<number>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj[cur]) {
      if (graph.atoms[n.to].element !== 'C' || seen.has(n.to)) continue;
      seen.add(n.to);
      parent.set(n.to, cur);
      if (n.to === to) {
        const path: number[] = [];
        let c = to;
        while (c !== from) {
          path.unshift(c);
          c = parent.get(c)!;
        }
        path.unshift(from);
        return path;
      }
      queue.push(n.to);
    }
  }
  return null;
}

/** 碳链简式（CHn 拼接，含双键/三键符号） */
function condensedCarbonChain(graph: MoleculeGraph, path: number[]): string {
  const adj = adjacency(graph);
  let out = '';
  for (let i = 0; i < path.length; i++) {
    if (i > 0) {
      const bond = graph.bonds.find(
        (b) => (b.a === path[i - 1] && b.b === path[i]) || (b.a === path[i] && b.b === path[i - 1])
      );
      if (bond?.order === 2) out += '=';
      else if (bond?.order === 3) out += '≡';
    }
    out += chStr(graph.atoms[path[i]].hCount);
  }
  return out;
}

/** 羰基碳的烷基侧简式（乙酸 → CH3，丙酸 → CH3CH2） */
function acidAlkylSide(graph: MoleculeGraph, ester: EsterInfo): string {
  const adj = adjacency(graph);
  const cSide = adj[ester.carbonylC].filter(
    (n) => graph.atoms[n.to].element === 'C' && n.to !== ester.alcoholStart
  );
  if (cSide.length === 0) return ''; // 甲酸（HCOO-）
  return alkylOf(graph, cSide[0].to, new Set([ester.carbonylC, ester.bridgeO]));
}

/** 多酯结构简式：二酸二酯（乙二酸二乙酯 C2H5OOC-COOC2H5）或二醇二酯（二乙酸乙二酯 CH3COOCH2CH2OOCCH3） */
function condensedMultiEster(graph: MoleculeGraph, esters: EsterInfo[]): string | null {
  if (esters.length !== 2) return null;
  const [e1, e2] = esters;
  const adj = adjacency(graph);
  // 二酸二酯：两个羰基经碳链相连（乙二酸 c1-c2 直接）
  const acidPath = carbonPathBetween(graph, e1.carbonylC, e2.carbonylC);
  if (acidPath && acidPath.length <= 6) {
    const alc1 = alkylOf(graph, e1.alcoholStart, new Set([e1.bridgeO, ...acidPath]));
    const alc2 = alkylOf(graph, e2.alcoholStart, new Set([e2.bridgeO, ...acidPath]));
    // 酸链中间碳（去掉两个羰基端点）
    const mid = acidPath.slice(1, -1);
    const midBody = condensedCarbonChain(graph, mid);
    return midBody ? `${alc1}OOC${midBody}COO${alc2}` : `${alc1}OOC-COO${alc2}`;
  }
  // 二醇二酯：两个酯的醇侧在同一碳链（乙二醇）
  const alcoPath = carbonPathBetween(graph, e1.alcoholStart, e2.alcoholStart);
  if (alcoPath && alcoPath.length >= 2 && alcoPath.length <= 6) {
    const a1 = acidAlkylSide(graph, e1);
    const a2 = acidAlkylSide(graph, e2);
    if (!a1 || !a2) return null;
    const alcoBody = condensedCarbonChain(graph, alcoPath);
    return `${a1}COO${alcoBody}OOC${a2}`;
  }
  return null;
}

/** 检测醚桥（O 连接两个非羰基碳，无 H） */
function findEther(graph: MoleculeGraph): { o: number; c1: number; c2: number } | null {
  const adj = adjacency(graph);
  for (const a of graph.atoms) {
    if (a.element !== 'O' || a.hCount > 0) continue;
    const idx = graph.atoms.indexOf(a);
    const cNeighbors = adj[idx].filter((n) => graph.atoms[n.to].element === 'C');
    if (cNeighbors.length !== 2) continue;
    // 排除酯桥/酸/醛 的 O（它们连羰基碳）
    const o1 = graph.atoms[cNeighbors[0].to];
    const o2 = graph.atoms[cNeighbors[1].to];
    const isCarbonyl = (ci: number): boolean => adj[ci].some((n) => n.order === 2 && graph.atoms[n.to].element === 'O');
    if (isCarbonyl(cNeighbors[0].to) || isCarbonyl(cNeighbors[1].to)) continue;
    return { o: idx, c1: cNeighbors[0].to, c2: cNeighbors[1].to };
  }
  return null;
}

/** 醚的结构简式：CH3CH2OCH2CH3 / CH3OCH3 */
function condensedEther(graph: MoleculeGraph, ether: { o: number; c1: number; c2: number }): string {
  const left = alkylGroup(graph, ether.c1, new Set([ether.o]));
  const right = alkylGroup(graph, ether.c2, new Set([ether.o]));
  return left + 'O' + right;
}

/** 烷基片段（含支链）：C(CH3)(CH3) 风格 */
function alkylGroup(graph: MoleculeGraph, root: number, blocked: Set<number>): string {
  const adj = adjacency(graph);
  const children = adj[root].filter((n) => graph.atoms[n.to].element === 'C' && !blocked.has(n.to));
  if (children.length <= 1) {
    // 直链：沿用线性遍历
    return alkylOf(graph, root, blocked);
  }
  // 支链：根 C + 各分支 (…)（如叔丁基 → C(CH3)(CH3)(CH3)）
  return chStr(graph.atoms[root].hCount) + children.map((c) => '(' + alkylOf(graph, c.to, new Set([...blocked, root])) + ')').join('');
}

/** 找苯环（6 个芳香碳成环） */
function findBenzene(graph: MoleculeGraph): number[] | null {
  const adj = adjacency(graph);
  const aromaticC = graph.atoms.map((a, i) => (a.element === 'C' && a.aromatic ? i : -1)).filter((i) => i >= 0);
  if (aromaticC.length < 6) return null;
  const find = (start: number, current: number[], visited: Set<number>): number[] | null => {
    if (current.length === 6) {
      return adj[current[5]].some((n) => n.to === start) ? [...current] : null;
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

function condensedBenzene(graph: MoleculeGraph, ring: number[]): string {
  const adj = adjacency(graph);
  const ringSet = new Set(ring);
  const subs: string[] = [];
  for (const r of ring) {
    for (const n of adj[r]) {
      if (ringSet.has(n.to)) continue;
      const el = graph.atoms[n.to].element;
      if (el === 'O') {
        if (graph.atoms[n.to].hCount >= 1) subs.push('OH');
        else {
          // 醚氧：苯甲醚 → OCH3
          const alk = adj[n.to].find((x) => !ringSet.has(x.to) && graph.atoms[x.to].element === 'C');
          subs.push(alk ? 'O' + alkylOf(graph, alk.to, new Set([...ringSet, n.to])) : 'O');
        }
      } else if (el === 'N') {
        const oN = adj[n.to].filter((x) => graph.atoms[x.to].element === 'O').length;
        subs.push(oN >= 2 ? 'NO2' : 'NH2');
      } else if (el === 'Br' || el === 'Cl' || el === 'F' || el === 'I') {
        subs.push(el);
      } else if (el === 'C') {
        const oN = adj[n.to].filter((x) => graph.atoms[x.to].element === 'O').length;
        if (oN >= 2) {
          // 羧基或酯基：桥 O 有 H → COOH；桥 O 无 H 连 C → COOR（苯甲酸甲酯 → C6H5COOCH3）
          const singleO = adj[n.to].find((x) => graph.atoms[x.to].element === 'O' && x.order === 1);
          if (singleO && graph.atoms[singleO.to].hCount >= 1) subs.push('COOH');
          else {
            const alk = adj[singleO!.to].find((x) => x.to !== n.to && graph.atoms[x.to].element === 'C');
            subs.push(alk ? 'COO' + alkylOf(graph, alk.to, new Set([...ringSet, n.to, singleO!.to])) : 'COO');
          }
        } else if (oN === 1) subs.push('CHO');
        else subs.push(alkylOf(graph, n.to, new Set([...ringSet, ...ring])));
      }
    }
  }
  if (subs.length === 0) return 'C6H6';
  if (subs.length === 1) {
    const s = subs[0];
    if (s === 'OH' || s === 'NH2' || s === 'NO2' || s === 'CHO' || s === 'COOH') return 'C6H5' + s;
    if (s.startsWith('CH') || s.startsWith('O')) return 'C6H5' + s;
    if (s.startsWith('COO')) return 'C6H5' + s;
    return 'C6H5-' + s;
  }
  // 二取代端基风格（对苯二甲酸 → HOOC-C6H4-COOH；位置不表达）
  if (subs.length === 2) {
    if (subs.every((s) => s === 'COOH')) return 'HOOC-C6H4-COOH';
    if (subs.every((s) => s === 'CHO')) return 'OHC-C6H4-CHO';
    if (subs.every((s) => s === 'NH2')) return 'H2N-C6H4-NH2';
    if (subs.every((s) => s === 'NO2')) return 'O2N-C6H4-NO2';
    if (subs.every((s) => s === 'OH')) return 'HO-C6H4-OH';
    if (subs.every((s) => s.startsWith('COO'))) {
      // 对苯二甲酸酯：COOCH3 → CH3OOC-C6H4-COOCH3
      const rs = subs.map((s) => s.slice(3));
      if (rs.every((r) => r.length > 0)) return `${rs[0]}OOC-C6H4-COO${rs[1]}`;
    }
  }
  return 'C6H4(' + subs.join(')(') + ')';
}

/** 烷基片段（从 root 出发，避开 blocked） */
function alkylOf(graph: MoleculeGraph, root: number, blocked: Set<number>): string {
  const adj = adjacency(graph);
  let cur = root;
  let out = '';
  const visited = new Set<number>([...blocked]);
  while (true) {
    visited.add(cur);
    out += chStr(graph.atoms[cur].hCount);
    const next = adj[cur].find((n) => graph.atoms[n.to].element === 'C' && !visited.has(n.to));
    if (!next) break;
    cur = next.to;
  }
  return out;
}

/** CHn 简写：0 → C，1 → CH，n → CHn */
function chStr(h: number): string {
  if (h <= 0) return 'C';
  if (h === 1) return 'CH';
  return 'CH' + h;
}

interface EsterInfo {
  carbonylC: number;
  bridgeO: number;
  alcoholStart: number;
}

/** 检测酯桥（O 连接羰基碳与另一碳） */
function findEster(graph: MoleculeGraph): EsterInfo | null {
  const adj = adjacency(graph);
  for (const b of graph.bonds) {
    if (b.order === 2 && graph.atoms[b.a].element === 'C' && graph.atoms[b.b].element === 'O') {
      const c = b.a;
      const singleOs = adj[c].filter((n) => graph.atoms[n.to].element === 'O' && n.order === 1);
      for (const o of singleOs) {
        const otherC = adj[o.to].filter((n) => n.to !== c && graph.atoms[n.to].element === 'C');
        if (otherC.length > 0) {
          return { carbonylC: c, bridgeO: o.to, alcoholStart: otherC[0].to };
        }
      }
    }
    if (b.order === 2 && graph.atoms[b.b].element === 'C' && graph.atoms[b.a].element === 'O') {
      const c = b.b;
      const singleOs = adj[c].filter((n) => graph.atoms[n.to].element === 'O' && n.order === 1);
      for (const o of singleOs) {
        const otherC = adj[o.to].filter((n) => n.to !== c && graph.atoms[n.to].element === 'C');
        if (otherC.length > 0) {
          return { carbonylC: c, bridgeO: o.to, alcoholStart: otherC[0].to };
        }
      }
    }
  }
  return null;
}

/** 最长 C-C 链（经过 must 时取最优，否则最长） */
function longestCarbonChain(graph: MoleculeGraph, must?: number): number[] {
  const adj = adjacency(graph);
  const cIdx = graph.atoms.map((a, i) => (a.element === 'C' ? i : -1)).filter((i) => i >= 0);
  let best: number[] = [];
  const dfs = (cur: number, visited: Set<number>, path: number[]): void => {
    if (must !== undefined && !path.includes(must)) {
      // 只收集包含 must 的路径
    } else if (path.length > best.length) {
      best = [...path];
    }
    if (path.length > 12) return;
    for (const n of adj[cur]) {
      if (graph.atoms[n.to].element !== 'C') continue;
      if (visited.has(n.to)) continue;
      visited.add(n.to);
      path.push(n.to);
      dfs(n.to, visited, path);
      path.pop();
      visited.delete(n.to);
    }
  };
  for (const s of cIdx) {
    dfs(s, new Set([s]), [s]);
  }
  return best;
}

/** 酯的结构简式：X酸Y酯 */
function condensedEster(graph: MoleculeGraph, ester: EsterInfo): string {
  const adj = adjacency(graph);
  const { carbonylC, bridgeO, alcoholStart } = ester;
  // 酸链：经过羰基碳的最长 C-C 链（不经过桥氧，天然排除醇侧）
  const chain = longestCarbonChain(graph, carbonylC);
  // 方向修正：链须从酸侧非羰基端开始（builder 序列化 C(=O)(OC(C))C 时羰基在前，
  // 标准 CC(=O)OCC 时甲基在前）——统一输出 CH3COO... 风格
  if (chain[0] === carbonylC && chain.length > 1) chain.reverse();
  const chainSet = new Set(chain);
  const parts: string[] = [];
  for (let i = 0; i < chain.length; i++) {
    const idx = chain[i];
    const atom = graph.atoms[idx];
    if (i > 0) {
      const bond = graph.bonds.find((b) => (b.a === chain[i - 1] && b.b === idx) || (b.a === idx && b.b === chain[i - 1]));
      if (bond?.order === 2) parts.push('=');
      else if (bond?.order === 3) parts.push('≡');
    }
    if (idx === carbonylC) {
      // C(=O)-O-醇
      const h = atom.hCount;
      let body = h > 0 ? 'HC' + (h > 1 ? h : '') : 'C';
      body += 'O'; // =O
      body += 'O'; // 桥氧
      // 醇部分
      const alco = alkylOf(graph, alcoholStart, new Set([...chainSet, bridgeO]));
      // 若羰基碳还有甲基侧，写在前面
      const cSide = adj[carbonylC].filter((n) => graph.atoms[n.to].element === 'C' && !chainSet.has(n.to));
      for (const s of cSide) {
        parts.push(alkylOf(graph, s.to, new Set([...chainSet, carbonylC])));
      }
      parts.push(body + alco);
      continue;
    }
    const hetero = adj[idx].filter((n) => graph.atoms[n.to].element !== 'C' && graph.atoms[n.to].element !== 'H');
    let body = chStr(atom.hCount);
    for (const h of hetero) {
      const el = graph.atoms[h.to].element;
      if (el === 'O') body += 'OH';
      else if (el === 'N') body += graph.atoms[h.to].hCount >= 2 ? 'NH2' : 'N';
      else body += el;
    }
    parts.push(body);
    const branches = adj[idx].filter((n) => graph.atoms[n.to].element === 'C' && !chainSet.has(n.to));
    for (const b of branches) {
      parts.push('(' + alkylOf(graph, b.to, new Set([...chainSet, idx])) + ')');
    }
  }
  return parts.join('');
}

/** 链式分子结构简式（非酯） */
function condensedChain(graph: MoleculeGraph): string {
  const adj = adjacency(graph);
  const best = longestCarbonChain(graph);
  const chainSet = new Set(best);
  const parts: string[] = [];
  for (let i = 0; i < best.length; i++) {
    const idx = best[i];
    const atom = graph.atoms[idx];
    if (i > 0) {
      const bond = graph.bonds.find((b) => (b.a === best[i - 1] && b.b === idx) || (b.a === idx && b.b === best[i - 1]));
      if (bond?.order === 2) parts.push('=');
      else if (bond?.order === 3) parts.push('≡');
    }
    const hetero = adj[idx].filter((n) => graph.atoms[n.to].element !== 'C' && graph.atoms[n.to].element !== 'H');
    const isEnd = i === 0 || i === best.length - 1;
    const carbonyl = hetero.some((h) => graph.atoms[h.to].element === 'O' && h.order === 2);
    let body: string;
    if (carbonyl) {
      body = chStr(atom.hCount) + 'O';
      const singleOs = hetero.filter((h) => graph.atoms[h.to].element === 'O' && h.order === 1);
      for (const o of singleOs) {
        body += graph.atoms[o.to].hCount >= 1 ? 'OH' : 'O';
      }
    } else {
      body = chStr(atom.hCount);
      for (const h of hetero) {
        const el = graph.atoms[h.to].element;
        if (el === 'O') {
          const isOh = graph.atoms[h.to].hCount >= 1;
          if (i === 0) body = (isOh ? 'HO' : 'O') + body;
          else body += isEnd ? (isOh ? 'OH' : 'O') : isOh ? '(OH)' : '(O)';
        } else if (el === 'N') {
          body += graph.atoms[h.to].hCount >= 2 ? (isEnd ? 'NH2' : '(NH2)') : 'N';
        } else {
          body += isEnd ? el : '(' + el + ')';
        }
      }
    }
    parts.push(body);
    const branches = adj[idx].filter((n) => graph.atoms[n.to].element === 'C' && !chainSet.has(n.to));
    for (const b of branches) {
      parts.push('(' + alkylOf(graph, b.to, new Set([...chainSet, idx])) + ')');
    }
  }
  return parts.join('');
}
