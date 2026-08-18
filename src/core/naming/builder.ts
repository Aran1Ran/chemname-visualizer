/**
 * 结构构建器：ParsedResult → 分子图（带教学标注）+ SMILES
 * 构建时同步生成 SMILES 供 RDKit 校验与规范化。
 */
import { parseSmiles, type MoleculeGraph, type GAtom, type GBond } from '../chem/graph';
import { SUBSTITUENTS as SUBST_TABLE, FUSED_TEMPLATES } from './lexicon';
import { parseName, type ParsedResult, type ParsedParent, type ParsedSubstituent } from './parser';

export interface SubstituentGroup {
  name: string;
  positions: number[];
  atomIndices: number[];
}

export interface BuiltMolecule {
  graph: MoleculeGraph;
  smiles: string;
  /** 母体链原子索引（按位次 1..N 排列） */
  chainAtomIndices: number[];
  substituentGroups: SubstituentGroup[];
  /** 官能团原子索引 */
  fgAtomIndices: number[];
  isBenzene: boolean;
  isCyclic: boolean;
  /** 苯环/环烷环原子（按 1..N 位次） */
  ringAtomIndices: number[];
  parsed: ParsedResult;
}

class Builder {
  atoms: GAtom[] = [];
  bonds: GBond[] = [];
  chainAtomIndices: number[] = [];
  substituentGroups: SubstituentGroup[] = [];
  fgAtomIndices: number[] = [];
  ringAtomIndices: number[] = [];

  addAtom(element: string, opts: { aromatic?: boolean; charge?: number; label?: string; chainPos?: number; groupName?: string } = {}): number {
    const idx = this.atoms.length;
    this.atoms.push({
      element,
      aromatic: opts.aromatic ?? false,
      charge: opts.charge ?? 0,
      isotope: null,
      explicitH: 0,
      hCount: 0,
      bondOrderSum: 0,
      inRing: false,
      originalIndex: idx,
      label: opts.label,
      chainPos: opts.chainPos,
      groupName: opts.groupName,
    });
    return idx;
  }

  addBond(a: number, b: number, order: number, aromatic = false): void {
    this.bonds.push({ a, b, order, aromatic });
    this.atoms[a].bondOrderSum += order;
    this.atoms[b].bondOrderSum += order;
    if (aromatic) {
      this.atoms[a].inRing = true;
      this.atoms[b].inRing = true;
    }
  }

  /** 追加一个片段图（取代基等），返回片段根原子（在合并图中的索引） */
  appendFragment(fragmentSmiles: string, attachIndex: number, label: string, groupName: string): number {
    const frag = parseSmiles(fragmentSmiles);
    const offset = this.atoms.length;
    const rootNew = offset + attachIndex;
    for (const fa of frag.atoms) {
      const idx = this.addAtom(fa.element, { aromatic: fa.aromatic, charge: fa.charge, label, groupName });
      this.atoms[idx].inRing = fa.inRing;
      this.atoms[idx].explicitH = fa.explicitH;
    }
    for (const fb of frag.bonds) {
      this.addBond(offset + fb.a, offset + fb.b, fb.order, fb.aromatic);
    }
    return rootNew;
  }

  /** 计算全部隐氢 */
  computeH(): void {
    for (const atom of this.atoms) {
      let valence: number;
      switch (atom.element) {
        case 'C': valence = 4; break;
        case 'N': valence = 3; break;
        case 'O': valence = 2; break;
        case 'S': valence = 2; break;
        case 'P': valence = 3; break;
        case 'F': case 'Cl': case 'Br': case 'I': valence = 1; break;
        case 'B': valence = 3; break;
        default: valence = 4;
      }
      if (atom.charge > 0) valence += atom.charge;
      else if (atom.charge < 0) valence += atom.charge;
      let h = valence - atom.bondOrderSum;
      if (h < 0) h = 0;
      if (atom.explicitH > 0) h = atom.explicitH;
      atom.hCount = Math.round(h);
    }
  }

  elementSymbol(atom: GAtom): string {
    const el = atom.element;
    if (atom.charge === 0) return el;
    const sign = atom.charge > 0 ? '+' : '-';
    const mag = Math.abs(atom.charge);
    return `[${el}${sign}${mag > 1 ? mag : ''}]`;
  }
}

/** 树形片段序列化（从 node 出发，避开 blocked 集合与 parent）；支持含苯环的片段（甲酸苯甲酯/苯乙酸） */
function serializeTree(b: Builder, node: number, blocked: Set<number>, parent: number): string {
  if (blocked.has(node)) return '';
  const nextBlocked = new Set(blocked);
  nextBlocked.add(node);
  // 片段内含芳香环（如苄基 C6H5CH2-）：整个环按 c1...c1 序列化，否则展开成非法分支
  if (b.atoms[node].aromatic) {
    const ring = collectAromaticRing(b, node);
    if (ring) return serializeAromaticRing(b, ring, nextBlocked);
  }
  let s = b.elementSymbol(b.atoms[node]);
  const children = b.bonds
    .filter((bd) => {
      const other = bd.a === node ? bd.b : bd.a;
      return (bd.a === node || bd.b === node) && !nextBlocked.has(other) && other !== parent;
    })
    .map((bd) => ({ to: bd.a === node ? bd.b : bd.a, order: bd.order }));
  for (const c of children) {
    const sub = serializeTree(b, c.to, nextBlocked, node);
    if (sub) {
      const sym = c.order === 2 ? '=' : c.order === 3 ? '#' : c.order === 1.5 ? '' : '';
      s += '(' + sym + sub + ')';
    }
  }
  return s;
}

/** 沿芳香键找经过 start 的 6 元芳香环路径；找不到返回 null */
function collectAromaticRing(b: Builder, start: number): number[] | null {
  const adjOf = (n: number): Array<{ to: number; order: number }> =>
    b.bonds.filter((x) => x.a === n || x.b === n).map((x) => ({ to: x.a === n ? x.b : x.a, order: x.order }));
  const path: number[] = [start];
  const seen = new Set<number>([start]);
  const find = (cur: number, depth: number): boolean => {
    if (depth === 6) {
      return adjOf(cur).some((x) => x.to === start);
    }
    for (const nb of adjOf(cur)) {
      if (!b.atoms[nb.to].aromatic) continue;
      if (nb.to === start && depth < 5) continue;
      if (seen.has(nb.to)) continue;
      seen.add(nb.to);
      path.push(nb.to);
      if (find(nb.to, depth + 1)) return true;
      path.pop();
      seen.delete(nb.to);
    }
    return false;
  };
  return find(start, 1) ? path : null;
}

/** 芳香环序列化为 c1...c1（含环上支链） */
function serializeAromaticRing(b: Builder, ring: number[], blocked: Set<number>): string {
  const ringSet = new Set(ring);
  const branchesOf = (atom: number): string => {
    let out = '';
    const branches = b.bonds
      .filter((bd) => {
        const other = bd.a === atom ? bd.b : bd.a;
        return (bd.a === atom || bd.b === atom) && !ringSet.has(other) && !blocked.has(other);
      })
      .map((bd) => ({ to: bd.a === atom ? bd.b : bd.a, order: bd.order }));
    for (const br of branches) {
      const frag = serializeTree(b, br.to, new Set([...blocked, ...ringSet]), atom);
      if (frag) {
        const sym = br.order === 2 ? '=' : br.order === 3 ? '#' : '';
        out += '(' + sym + frag + ')';
      }
    }
    return out;
  };
  let s = 'c1' + branchesOf(ring[0]);
  for (let i = 1; i < ring.length; i++) {
    s += 'c' + branchesOf(ring[i]);
  }
  // 闭合环：最后一个环原子已在循环中写出，此处仅加闭合数字
  return s + '1';
}

/** 缺省取代基位置（位置为空时） */
function defaultSubstituentPositions(sub: ParsedSubstituent, parent: ParsedParent): number[] {
  if (sub.positions.length > 0) return sub.positions;
  const k = sub.count;
  if (parent.suffix === '烷' || parent.cyclic) {
    // 烷烃/环烷：2,2,3,3,...（1 号位并入主链）
    const out: number[] = [];
    let p = 2;
    while (out.length < k && p <= parent.chainLen) {
      out.push(p);
      if (out.length < k) out.push(p);
      p++;
    }
    while (out.length < k) out.push(parent.chainLen);
    return out;
  }
  // 其他母体（醇/酸/醛/酮/胺等）：官能团占 1 位，取代基从 2 位起（氨基乙酸 → 氨基@2），
  // 按链长裁剪防越界（三氯乙酸 → 三氯全部落在 2 位）
  if (parent.suffix === '烯' || parent.suffix === '炔') {
    // 烯/炔：取代基可挂双键碳（1,1,2-三氯乙烯），按链长均摊（1,2,1,2...）
    return Array.from({ length: k }, (_, i) => 1 + (i % parent.chainLen));
  }
  return Array.from({ length: k }, (_, i) => Math.min(2 + i, parent.chainLen));
}

/** 环原子序列化（苯环/环烷/环烯烃），返回环 SMILES（含 '=' 双键符号） */
function serializeRing(b: Builder, ring: number[], aromatic: boolean): string {
  const n = ring.length;
  const ringSet = new Set(ring);
  let smiles = '';
  for (let i = 0; i < n; i++) {
    const el = b.atoms[ring[i]].element;
    if (i > 0) {
      // 环键多重键（环烯/环炔）
      const bond = b.bonds.find(
        (bd) => (bd.a === ring[i - 1] && bd.b === ring[i]) || (bd.a === ring[i] && bd.b === ring[i - 1])
      );
      if (bond && bond.order === 2) smiles += '=';
      else if (bond && bond.order === 3) smiles += '#';
    }
    if (i === 0) smiles += aromatic ? 'c1' : 'C1';
    else if (i === n - 1) smiles += aromatic ? 'c1' : 'C1';
    else smiles += aromatic ? 'c' : 'C';
    void el;
    const branches = b.bonds
      .filter((bd) => {
        const other = bd.a === ring[i] ? bd.b : bd.a;
        return (bd.a === ring[i] || bd.b === ring[i]) && !ringSet.has(other);
      })
      .map((bd) => ({ to: bd.a === ring[i] ? bd.b : bd.a, order: bd.order }));
    for (const br of branches) {
      const frag = serializeTree(b, br.to, new Set([...ringSet, ring[i]]), ring[i]);
      if (frag) {
        const sym = br.order === 2 ? '=' : br.order === 3 ? '#' : '';
        smiles += '(' + sym + frag + ')';
      }
    }
  }
  return smiles;
}

/** 取代基连通域：从根原子出发沿重原子键收集全部原子（避开主链/环与官能团原子）。
 * 用于补全 substituentGroups.atomIndices 为"根 + 支链末端全部原子"（如乙基 = [根, 末端]）。 */
function collectSubstituentAtoms(b: Builder, root: number, exclude: Set<number>): number[] {
  const out: number[] = [];
  const seen = new Set<number>(exclude);
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    for (const bd of b.bonds) {
      const other = bd.a === cur ? bd.b : bd.a;
      if ((bd.a === cur || bd.b === cur) && !seen.has(other) && b.atoms[other].element !== 'H') {
        stack.push(other);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

/** 芳香酸酯构建（苯甲酸甲酯 / 邻羟基苯甲酸甲酯 / 对苯二甲酸二甲酯）：苯环 + 酯基挂环 */
function buildAromaticEster(b: Builder, parsed: Extract<ParsedResult, { kind: 'ester' }>): BuiltMolecule {
  const ester = parsed.ester;
  const ring: number[] = [];
  for (let i = 0; i < 6; i++) {
    ring.push(b.addAtom('C', { aromatic: true, label: 'parent', chainPos: i + 1 }));
  }
  for (let i = 0; i < 6; i++) {
    b.addBond(ring[i], ring[(i + 1) % 6], 1.5, true);
  }
  b.ringAtomIndices = ring;
  b.chainAtomIndices = ring;

  // 羧基位（苯甲酸 [1]；对苯二甲酸 [1,4] 等）
  const acidPositions = ester.acidParent.positions.length ? ester.acidParent.positions : [1];
  const alcoMult = ester.alcoholMult ?? 1;
  // 醇链（同 buildEster：词干链 / 支链片段）
  const alcoChains: number[][] = [];
  for (let k = 0; k < Math.max(1, alcoMult); k++) {
    if (ester.alcoholBranchSmiles) {
      const root = b.appendFragment(ester.alcoholBranchSmiles, 0, 'substituent', '醇基');
      alcoChains.push([root]);
      continue;
    }
    const alco: number[] = [];
    for (let p = 1; p <= ester.alcoholLen; p++) {
      alco.push(b.addAtom('C', { label: 'substituent', groupName: '醇基' }));
    }
    for (let i = 0; i < ester.alcoholLen - 1; i++) {
      b.addBond(alco[i], alco[i + 1], 1);
    }
    if (ester.alcoholVinyl && ester.alcoholLen === 2) {
      const bi = b.bonds.find((bd) => (bd.a === alco[0] && bd.b === alco[1]) || (bd.a === alco[1] && bd.b === alco[0]));
      if (bi) {
        bi.order = 2;
        b.atoms[bi.a].bondOrderSum += 1;
        b.atoms[bi.b].bondOrderSum += 1;
      }
    }
    alcoChains.push(alco);
  }
  // 每个羧基位：环碳 → C(=O)(O-醇链)
  for (let k = 0; k < acidPositions.length; k++) {
    const target = ring[acidPositions[k] - 1];
    const c = b.addAtom('C', { label: 'fg', groupName: '酯基' });
    const o1 = b.addAtom('O', { label: 'fg', groupName: '酯基' });
    const o2 = b.addAtom('O', { label: 'fg', groupName: '酯基' });
    b.addBond(target, c, 1);
    b.addBond(c, o1, 2);
    b.addBond(c, o2, 1);
    const alco = alcoChains[Math.min(k, alcoChains.length - 1)];
    b.addBond(o2, alco[0], 1);
    b.fgAtomIndices.push(c, o1, o2);
  }
  // 酸部分取代基（邻羟基苯甲酸甲酯 的 羟基@2）
  for (const sub of ester.acidSubstituents) {
    const positions = defaultSubstituentPositions(sub, ester.acidParent);
    const info = SUBST_TABLE[sub.name];
    if (!info) throw new Error('未知取代基: ' + sub.name);
    const allAtoms: number[] = [];
    for (const pos of positions) {
      const target = ring[pos - 1];
      const root = b.appendFragment(info.smiles, info.attachIndex, 'substituent', sub.name);
      b.addBond(target, root, 1);
      allAtoms.push(...collectSubstituentAtoms(b, root, new Set([...ring, ...b.fgAtomIndices])));
    }
    b.substituentGroups.push({ name: sub.name, positions, atomIndices: [...new Set(allAtoms)].sort((x, y) => x - y) });
  }

  b.computeH();
  const smiles = serializeRing(b, ring, true);
  return {
    graph: { smiles, atoms: b.atoms, bonds: b.bonds },
    smiles,
    chainAtomIndices: b.chainAtomIndices,
    substituentGroups: b.substituentGroups,
    fgAtomIndices: b.fgAtomIndices,
    isBenzene: true,
    isCyclic: true,
    ringAtomIndices: b.ringAtomIndices,
    parsed,
  };
}

/** 构建苯环系 */
function buildBenzene(b: Builder, parsed: Extract<ParsedResult, { kind: 'systematic' }>): BuiltMolecule {
  const parent = parsed.parent;
  const ring: number[] = [];
  for (let i = 0; i < 6; i++) {
    ring.push(b.addAtom('C', { aromatic: true, label: 'parent', chainPos: i + 1 }));
  }
  for (let i = 0; i < 6; i++) {
    b.addBond(ring[i], ring[(i + 1) % 6], 1.5, true);
  }
  b.ringAtomIndices = ring;
  b.chainAtomIndices = ring;

  // 酚：1 位羟基
  if (parent.suffix === '酚') {
    const o = b.addAtom('O', { label: 'fg', groupName: '羟基' });
    b.addBond(ring[0], o, 1);
    b.fgAtomIndices.push(o);
  }
  // 苯甲酸 / 苯甲醛 / 苯胺；苯二甲酸（邻/间/对）→ 多个 COOH 挂环
  if (parent.suffix === '酸') {
    const acidPositions = parent.positions.length ? parent.positions : [1];
    for (const pos of acidPositions) {
      const c = b.addAtom('C', { label: 'fg', groupName: '羧基' });
      const o1 = b.addAtom('O', { label: 'fg', groupName: '羧基' });
      const o2 = b.addAtom('O', { label: 'fg', groupName: '羧基' });
      b.addBond(ring[pos - 1], c, 1);
      b.addBond(c, o1, 2);
      b.addBond(c, o2, 1);
      b.fgAtomIndices.push(c, o1, o2);
    }
  }
  if (parent.suffix === '醛') {
    const c = b.addAtom('C', { label: 'fg', groupName: '醛基' });
    const o = b.addAtom('O', { label: 'fg', groupName: '醛基' });
    b.addBond(ring[0], c, 1);
    b.addBond(c, o, 2);
    b.fgAtomIndices.push(c, o);
  }
  if (parent.suffix === '胺') {
    const n = b.addAtom('N', { label: 'fg', groupName: '氨基' });
    b.addBond(ring[0], n, 1);
    b.fgAtomIndices.push(n);
  }

  // 取代基（atomIndices 补全为取代基全部原子）
  for (const sub of parsed.substituents) {
    const positions = defaultSubstituentPositions(sub, parent);
    const info = SUBST_TABLE[sub.name];
    if (!info) throw new Error('未知取代基: ' + sub.name);
    const allAtoms: number[] = [];
    for (const pos of positions) {
      const target = ring[pos - 1];
      const root = b.appendFragment(info.smiles, info.attachIndex, 'substituent', sub.name);
      b.addBond(target, root, 1);
      allAtoms.push(...collectSubstituentAtoms(b, root, new Set([...ring, ...b.fgAtomIndices])));
    }
    b.substituentGroups.push({ name: sub.name, positions, atomIndices: [...new Set(allAtoms)].sort((x, y) => x - y) });
  }

  b.computeH();
  const smiles = serializeRing(b, ring, true);

  return {
    graph: { smiles, atoms: b.atoms, bonds: b.bonds },
    smiles,
    chainAtomIndices: b.chainAtomIndices,
    substituentGroups: b.substituentGroups,
    fgAtomIndices: b.fgAtomIndices,
    isBenzene: true,
    isCyclic: true,
    ringAtomIndices: b.ringAtomIndices,
    parsed,
  };
}

/** 构建环烷烃 */
function buildCycloalkane(b: Builder, parsed: Extract<ParsedResult, { kind: 'systematic' }>): BuiltMolecule {
  const parent = parsed.parent;
  const n = parent.chainLen;
  const ring: number[] = [];
  for (let i = 0; i < n; i++) {
    ring.push(b.addAtom('C', { label: 'parent', chainPos: i + 1 }));
  }
  for (let i = 0; i < n; i++) {
    b.addBond(ring[i], ring[(i + 1) % n], 1);
  }
  b.ringAtomIndices = ring;
  b.chainAtomIndices = ring;

  // 环烯/环炔：设环内多重键（环己烯 → C1=CCCCC1）
  if (parent.suffix === '烯' || parent.suffix === '炔') {
    const order = parent.suffix === '烯' ? 2 : 3;
    for (const pos of parent.positions) {
      const a = ring[pos - 1];
      const bi = b.bonds.find(
        (bd) => (bd.a === a && bd.b === ring[pos % n]) || (bd.a === ring[pos % n] && bd.b === a)
      );
      if (bi && bi.order !== order) {
        const delta = order - bi.order;
        bi.order = order;
        b.atoms[bi.a].bondOrderSum += delta;
        b.atoms[bi.b].bondOrderSum += delta;
      }
      // 官能团原子：双键/三键两端碳（环烯）
      b.fgAtomIndices.push(a, ring[pos % n]);
    }
  }

  for (const sub of parsed.substituents) {
    const positions = defaultSubstituentPositions(sub, parent);
    const info = SUBST_TABLE[sub.name];
    if (!info) throw new Error('未知取代基: ' + sub.name);
    const allAtoms: number[] = [];
    for (const pos of positions) {
      const target = ring[(pos - 1 + n) % n];
      const root = b.appendFragment(info.smiles, info.attachIndex, 'substituent', sub.name);
      b.addBond(target, root, 1);
      allAtoms.push(...collectSubstituentAtoms(b, root, new Set([...ring, ...b.fgAtomIndices])));
    }
    b.substituentGroups.push({ name: sub.name, positions, atomIndices: [...new Set(allAtoms)].sort((x, y) => x - y) });
    // 环烯/环炔：取代基原子并入官能团原子集（与链式烯烃口径一致）
    if (parent.suffix === '烯' || parent.suffix === '炔') b.fgAtomIndices.push(...allAtoms);
  }

  b.computeH();
  const smiles = serializeRing(b, ring, false);

  return {
    graph: { smiles, atoms: b.atoms, bonds: b.bonds },
    smiles,
    chainAtomIndices: b.chainAtomIndices,
    substituentGroups: b.substituentGroups,
    fgAtomIndices: b.fgAtomIndices,
    isBenzene: false,
    isCyclic: true,
    ringAtomIndices: b.ringAtomIndices,
    parsed,
  };
}

/** 构建链烃系（含官能团与取代基） */
function buildChain(b: Builder, parsed: Extract<ParsedResult, { kind: 'systematic' }>): BuiltMolecule {
  const parent = parsed.parent;
  const n = parent.chainLen;
  const chain: number[] = [];
  for (let p = 1; p <= n; p++) {
    chain.push(b.addAtom('C', { label: 'parent', chainPos: p }));
  }
  for (let i = 0; i < n - 1; i++) {
    b.addBond(chain[i], chain[i + 1], 1);
  }
  b.chainAtomIndices = chain;

  // 烯/炔：设置多重键（母体后缀，或双官能团嵌入的 烯/炔，如 2-丙烯-1-醇）
  const enePositions = parent.suffix === '烯' || parent.suffix === '炔' ? parent.positions : (parent.extraEne?.positions ?? []);
  const eneOrder = parent.suffix === '烯' || parent.suffix === '炔' ? (parent.suffix === '烯' ? 2 : 3) : parent.extraEne?.bond === '炔' ? 3 : 2;
  for (const pos of enePositions) {
    const bi = b.bonds.find(
      (bd) => (bd.a === chain[pos - 1] && bd.b === chain[pos]) || (bd.a === chain[pos] && bd.b === chain[pos - 1])
    );
    if (bi && bi.order !== eneOrder) {
      const delta = eneOrder - bi.order;
      bi.order = eneOrder;
      b.atoms[bi.a].bondOrderSum += delta;
      b.atoms[bi.b].bondOrderSum += delta;
    }
    // 官能团原子：双键/三键两端碳（母体为烯/炔时，如 2-甲基-1,3-丁二烯）
    if (parent.suffix === '烯' || parent.suffix === '炔') {
      b.fgAtomIndices.push(chain[pos - 1], chain[pos]);
    }
  }

  // 官能团
  if (parent.suffix === '醇') {
    for (const pos of parent.positions) {
      const o = b.addAtom('O', { label: 'fg', groupName: '羟基' });
      b.addBond(chain[pos - 1], o, 1);
      b.fgAtomIndices.push(o);
    }
  } else if (parent.suffix === '醛') {
    for (const pos of parent.positions) {
      const o = b.addAtom('O', { label: 'fg', groupName: '醛基' });
      b.addBond(chain[pos - 1], o, 2);
      b.fgAtomIndices.push(o);
    }
  } else if (parent.suffix === '酸') {
    for (const pos of parent.positions) {
      const o1 = b.addAtom('O', { label: 'fg', groupName: '羧基' });
      const o2 = b.addAtom('O', { label: 'fg', groupName: '羧基' });
      b.addBond(chain[pos - 1], o1, 2);
      b.addBond(chain[pos - 1], o2, 1);
      b.fgAtomIndices.push(o1, o2);
    }
  } else if (parent.suffix === '酮') {
    for (const pos of parent.positions) {
      const o = b.addAtom('O', { label: 'fg', groupName: '羰基' });
      b.addBond(chain[pos - 1], o, 2);
      b.fgAtomIndices.push(o);
    }
  } else if (parent.suffix === '腈') {
    for (const pos of parent.positions) {
      const n = b.addAtom('N', { label: 'fg', groupName: '腈基' });
      b.addBond(chain[pos - 1], n, 3);
      b.fgAtomIndices.push(n);
    }
  } else if (parent.suffix === '酰胺') {
    for (const pos of parent.positions) {
      const o = b.addAtom('O', { label: 'fg', groupName: '酰胺基' });
      const n = b.addAtom('N', { label: 'fg', groupName: '酰胺基' });
      b.addBond(chain[pos - 1], o, 2);
      b.addBond(chain[pos - 1], n, 1);
      b.fgAtomIndices.push(o, n);
      // N 取代基（N,N-二甲基甲酰胺：甲基附着在 N 上）
      for (const sub of parsed.nSubstituents ?? []) {
        const info = SUBST_TABLE[sub.name];
        if (!info) throw new Error('未知取代基: ' + sub.name);
        for (let k = 0; k < sub.count; k++) {
          const root = b.appendFragment(info.smiles, info.attachIndex, 'substituent', sub.name);
          b.addBond(n, root, 1);
        }
      }
    }
  } else if (parent.suffix === '胺') {
    for (const pos of parent.positions) {
      const nAtom = b.addAtom('N', { label: 'fg', groupName: '氨基' });
      b.addBond(chain[pos - 1], nAtom, 1);
      b.fgAtomIndices.push(nAtom);
      // N-烷基化（二甲胺/三甲胺：额外烷基挂 N）
      for (const sub of parsed.nSubstituents ?? []) {
        const info = SUBST_TABLE[sub.name];
        if (!info) throw new Error('未知取代基: ' + sub.name);
        for (let k = 0; k < sub.count; k++) {
          const root = b.appendFragment(info.smiles, info.attachIndex, 'substituent', sub.name);
          b.addBond(nAtom, root, 1);
        }
      }
    }
  }

  // 氧代（酸/酯链内羰基，如 3-氧代丁酸 的 3 位 =O）
  if (parent.oxo) {
    for (const pos of parent.oxo) {
      const o = b.addAtom('O', { label: 'fg', groupName: '羰基' });
      b.addBond(chain[pos - 1], o, 2);
      b.fgAtomIndices.push(o);
    }
  }

  // 取代基（atomIndices 补全为取代基全部原子）
  for (const sub of parsed.substituents) {
    const positions = defaultSubstituentPositions(sub, parent);
    const info = SUBST_TABLE[sub.name];
    if (!info) throw new Error('未知取代基: ' + sub.name);
    const allAtoms: number[] = [];
    for (const pos of positions) {
      const target = chain[pos - 1];
      const root = b.appendFragment(info.smiles, info.attachIndex, 'substituent', sub.name);
      b.addBond(target, root, 1);
      allAtoms.push(...collectSubstituentAtoms(b, root, new Set([...chain, ...b.fgAtomIndices])));
    }
    b.substituentGroups.push({ name: sub.name, positions, atomIndices: [...new Set(allAtoms)].sort((x, y) => x - y) });
    // 母体为烯/炔时：取代基原子并入官能团原子集（如 2-甲基-1,3-丁二烯 的甲基）
    if (parent.suffix === '烯' || parent.suffix === '炔') b.fgAtomIndices.push(...allAtoms);
  }

  b.computeH();

  // SMILES：主路径 = 链原子 1..N
  const mainSet = new Set(chain);
  let smiles = '';
  const visited = new Set<number>();
  for (let i = 0; i < n; i++) {
    visited.add(chain[i]);
    if (i > 0) {
      const bd = b.bonds.find(
        (x) => (x.a === chain[i - 1] && x.b === chain[i]) || (x.a === chain[i] && x.b === chain[i - 1])
      );
      const order = bd?.order ?? 1;
      if (order === 2) smiles += '=';
      else if (order === 3) smiles += '#';
    }
    smiles += b.elementSymbol(b.atoms[chain[i]]);
    const branches = b.bonds
      .filter((bd) => {
        const other = bd.a === chain[i] ? bd.b : bd.a;
        return (bd.a === chain[i] || bd.b === chain[i]) && !mainSet.has(other);
      })
      .map((bd) => ({ to: bd.a === chain[i] ? bd.b : bd.a, order: bd.order }));
    for (const br of branches) {
      const frag = serializeTree(b, br.to, new Set([...mainSet, ...visited]), chain[i]);
      if (frag) {
        const sym = br.order === 2 ? '=' : br.order === 3 ? '#' : '';
        smiles += '(' + sym + frag + ')';
      }
    }
  }

  return {
    graph: { smiles, atoms: b.atoms, bonds: b.bonds },
    smiles,
    chainAtomIndices: b.chainAtomIndices,
    substituentGroups: b.substituentGroups,
    fgAtomIndices: b.fgAtomIndices,
    isBenzene: false,
    isCyclic: false,
    ringAtomIndices: [],
    parsed,
  };
}

/** 构建酯（含二酸二酯：乙二酸二乙酯；酸部分多个羧基位 + 多个醇基） */
function buildEster(b: Builder, parsed: Extract<ParsedResult, { kind: 'ester' }>): BuiltMolecule {
  const ester = parsed.ester;
  // 芳香酸酯（苯甲酸甲酯/邻羟基苯甲酸甲酯/对苯二甲酸二甲酯）：酸部分为苯环系
  if (ester.acidParent.benzene) {
    return buildAromaticEster(b, parsed);
  }
  const acidN = ester.acidParent.chainLen;
  const alcoN = ester.alcoholLen;
  const chain: number[] = [];
  for (let p = 1; p <= acidN; p++) {
    chain.push(b.addAtom('C', { label: 'parent', chainPos: p }));
  }
  for (let i = 0; i < acidN - 1; i++) {
    b.addBond(chain[i], chain[i + 1], 1);
  }
  b.chainAtomIndices = chain;

  // 酸链内烯/炔（2-甲基-2-丙烯酸甲酯：extraEne）
  if (ester.acidParent.extraEne) {
    const order = ester.acidParent.extraEne.bond === '炔' ? 3 : 2;
    for (const pos of ester.acidParent.extraEne.positions) {
      const bi = b.bonds.find(
        (bd) => (bd.a === chain[pos - 1] && bd.b === chain[pos]) || (bd.a === chain[pos] && bd.b === chain[pos - 1])
      );
      if (bi && bi.order !== order) {
        const delta = order - bi.order;
        bi.order = order;
        b.atoms[bi.a].bondOrderSum += delta;
        b.atoms[bi.b].bondOrderSum += delta;
      }
    }
  }

  // 氧代（3-氧代丁酸乙酯：酸链内羰基 =O）
  if (ester.acidParent.oxo) {
    for (const pos of ester.acidParent.oxo) {
      const o = b.addAtom('O', { label: 'fg', groupName: '羰基' });
      b.addBond(chain[pos - 1], o, 2);
      b.fgAtomIndices.push(o);
    }
  }

  // 羧基位：单酸 [1]；二酸 [1, chainLen]（乙二酸 1,2 / 丁二酸 1,4）
  const acidPositions = ester.acidParent.positions.length ? ester.acidParent.positions : [1];
  const alcoMult = ester.alcoholMult ?? 1;
  // 醇链（alcoMult 个，二酸二酯时 2 个；乙烯酯时醇链含 C=C；支链醇用片段）
  const alcoChains: number[][] = [];
  for (let k = 0; k < Math.max(1, alcoMult); k++) {
    if (ester.alcoholBranchSmiles) {
      const root = b.appendFragment(ester.alcoholBranchSmiles, 0, 'substituent', '醇基');
      alcoChains.push([root]);
      continue;
    }
    const alco: number[] = [];
    for (let p = 1; p <= alcoN; p++) {
      alco.push(b.addAtom('C', { label: 'substituent', groupName: '醇基' }));
    }
    for (let i = 0; i < alcoN - 1; i++) {
      b.addBond(alco[i], alco[i + 1], 1);
    }
    if (ester.alcoholVinyl && alcoN === 2) {
      // 乙烯酯：-O-CH=CH2
      const bi = b.bonds.find((bd) => (bd.a === alco[0] && bd.b === alco[1]) || (bd.a === alco[1] && bd.b === alco[0]));
      if (bi) {
        bi.order = 2;
        b.atoms[bi.a].bondOrderSum += 1;
        b.atoms[bi.b].bondOrderSum += 1;
      }
    }
    alcoChains.push(alco);
  }
  // 每个羧基位：=O + 酯桥 O + 醇链
  const acidBridges = new Map<number, [number, number]>(); // 酸位碳 → [桥氧, 醇根]
  for (let k = 0; k < acidPositions.length; k++) {
    const target = chain[acidPositions[k] - 1];
    const o1 = b.addAtom('O', { label: 'fg', groupName: '酯基' });
    const o2 = b.addAtom('O', { label: 'fg', groupName: '酯基' });
    b.addBond(target, o1, 2);
    b.addBond(target, o2, 1);
    const alco = alcoChains[Math.min(k, alcoChains.length - 1)];
    b.addBond(o2, alco[0], 1);
    b.fgAtomIndices.push(o1, o2);
    acidBridges.set(target, [o2, alco[0]]);
  }

  // 酸部分取代基
  for (const sub of ester.acidSubstituents) {
    const positions = defaultSubstituentPositions(sub, ester.acidParent);
    const info = SUBST_TABLE[sub.name];
    if (!info) throw new Error('未知取代基: ' + sub.name);
    const allAtoms: number[] = [];
    for (const pos of positions) {
      const target = chain[pos - 1];
      const root = b.appendFragment(info.smiles, info.attachIndex, 'substituent', sub.name);
      b.addBond(target, root, 1);
      allAtoms.push(...collectSubstituentAtoms(b, root, new Set([...chain, ...b.fgAtomIndices])));
    }
    b.substituentGroups.push({ name: sub.name, positions, atomIndices: [...new Set(allAtoms)].sort((x, y) => x - y) });
  }

  b.computeH();

  // SMILES：酸链 1..N（含链间多重键），各羧基位分支 =O 与 (O + 醇链)
  const mainSet = new Set(chain);
  const visited = new Set<number>();
  let smiles = '';
  for (let i = 0; i < acidN; i++) {
    visited.add(chain[i]);
    if (i > 0) {
      // 链间键符号（酸链内烯/炔：2-甲基-2-丙烯酸甲酯）
      const cb = b.bonds.find(
        (bd) => (bd.a === chain[i - 1] && bd.b === chain[i]) || (bd.a === chain[i] && bd.b === chain[i - 1])
      );
      if (cb && cb.order === 2) smiles += '=';
      else if (cb && cb.order === 3) smiles += '#';
    }
    smiles += b.elementSymbol(b.atoms[chain[i]]);
    const branches = b.bonds
      .filter((bd) => {
        const other = bd.a === chain[i] ? bd.b : bd.a;
        return (bd.a === chain[i] || bd.b === chain[i]) && !mainSet.has(other);
      })
      .map((bd) => ({ to: bd.a === chain[i] ? bd.b : bd.a, order: bd.order }));
    for (const br of branches) {
      const sym = br.order === 2 ? '=' : br.order === 3 ? '#' : '';
      let frag: string;
      const bridge = acidBridges.get(chain[i]);
      if (bridge && br.to === bridge[0]) {
        // 酯桥：O + 醇链
        frag = b.elementSymbol(b.atoms[bridge[0]]);
        frag += serializeTree(b, bridge[1], new Set([...mainSet, bridge[0]]), bridge[0]);
      } else {
        frag = serializeTree(b, br.to, new Set([...mainSet, ...visited]), chain[i]);
      }
      if (frag) smiles += '(' + sym + frag + ')';
    }
  }

  return {
    graph: { smiles, atoms: b.atoms, bonds: b.bonds },
    smiles,
    chainAtomIndices: b.chainAtomIndices,
    substituentGroups: b.substituentGroups,
    fgAtomIndices: b.fgAtomIndices,
    isBenzene: false,
    isCyclic: false,
    ringAtomIndices: [],
    parsed,
  };
}

/** 醚树序列化：从 leftRoot 出发，醚桥 O 作为分支写入（支持支链烷基如异丙基/叔丁基） */
function serializeEther(b: Builder, leftRoot: number, oIdx: number, rightRoot: number): string {
  const adjOf = (n: number): Array<{ to: number; order: number }> =>
    b.bonds.filter((x) => x.a === n || x.b === n).map((x) => ({ to: x.a === n ? x.b : x.a, order: x.order }));
  const write = (node: number, parent: number, blocked: Set<number>): string => {
    let s = b.elementSymbol(b.atoms[node]);
    const children = adjOf(node).filter((c) => c.to !== parent && !blocked.has(c.to));
    for (const c of children) {
      if (c.to === oIdx) {
        s += '(' + b.elementSymbol(b.atoms[oIdx]) + write(rightRoot, oIdx, new Set([...blocked, node, oIdx])) + ')';
      } else {
        const sym = c.order === 2 ? '=' : c.order === 3 ? '#' : '';
        s += '(' + sym + write(c.to, node, new Set([...blocked, node])) + ')';
      }
    }
    return s;
  };
  return write(leftRoot, -1, new Set());
}

/** 构建醚：R1-O-R2（含苯基醚） */
function buildEther(b: Builder, parsed: Extract<ParsedResult, { kind: 'ether' }>): BuiltMolecule {
  const ether = parsed.ether;
  const { left, right } = ether;
  const phenylSide = left.name === '苯基' ? left : right.name === '苯基' ? right : null;
  const alkylSide = left.name === '苯基' ? right : left;

  const o = b.addAtom('O', { label: 'fg', groupName: '醚基' });
  b.fgAtomIndices.push(o);

  if (phenylSide) {
    // 苯基醚：苯环 + O + 烷基（苯甲醚/苯乙醚）
    const ring: number[] = [];
    for (let i = 0; i < 6; i++) {
      ring.push(b.addAtom('C', { aromatic: true, label: 'parent', chainPos: i + 1 }));
    }
    for (let i = 0; i < 6; i++) {
      b.addBond(ring[i], ring[(i + 1) % 6], 1.5, true);
    }
    b.ringAtomIndices = ring;
    b.chainAtomIndices = ring;
    b.addBond(ring[0], o, 1);
    // 苯环上额外取代基（邻/间/对甲基苯甲醚：甲基@2/3/4；位次以 O 连的环碳为 1）
    for (const rs of ether.ringSubstituents ?? []) {
      const subInfo = SUBST_TABLE[rs.name];
      if (!subInfo) throw new Error('未知取代基: ' + rs.name);
      for (const p of rs.positions) {
        const ringAtom = ring[p - 1];
        const root = b.appendFragment(subInfo.smiles, subInfo.attachIndex, 'substituent', rs.name);
        b.addBond(ringAtom, root, 1);
        b.substituentGroups.push({
          name: rs.name,
          positions: rs.positions,
          atomIndices: collectSubstituentAtoms(b, root, new Set([ringAtom])),
        });
      }
    }
    const alkylInfo = SUBST_TABLE[alkylSide.name];
    if (!alkylInfo) throw new Error('未知取代基: ' + alkylSide.name);
    const root = b.appendFragment(alkylInfo.smiles, alkylInfo.attachIndex, 'substituent', alkylSide.name);
    b.addBond(o, root, 1);
    b.substituentGroups.push({ name: alkylSide.name, positions: [], atomIndices: collectSubstituentAtoms(b, root, new Set([o])) });
    b.computeH();
    const smiles = serializeRing(b, ring, true);
    return {
      graph: { smiles, atoms: b.atoms, bonds: b.bonds },
      smiles,
      chainAtomIndices: b.chainAtomIndices,
      substituentGroups: b.substituentGroups,
      fgAtomIndices: b.fgAtomIndices,
      isBenzene: true,
      isCyclic: true,
      ringAtomIndices: b.ringAtomIndices,
      parsed,
    };
  }

  // 脂肪醚
  const lInfo = SUBST_TABLE[left.name];
  const rInfo = SUBST_TABLE[right.name];
  if (!lInfo || !rInfo) throw new Error('未知取代基: ' + (lInfo ? right.name : left.name));
  const leftFrag = parseSmiles(lInfo.smiles);
  const offset = b.atoms.length;
  const leftRoot = b.appendFragment(lInfo.smiles, lInfo.attachIndex, 'parent', left.name);
  const rightRoot = b.appendFragment(rInfo.smiles, rInfo.attachIndex, 'substituent', right.name);
  b.addBond(leftRoot, o, 1);
  b.addBond(o, rightRoot, 1);
  b.chainAtomIndices = leftFrag.atoms.map((_, k) => offset + k);
  b.substituentGroups.push({ name: right.name, positions: [], atomIndices: collectSubstituentAtoms(b, rightRoot, new Set([o])) });
  b.computeH();
  const smiles = serializeEther(b, leftRoot, o, rightRoot);
  return {
    graph: { smiles, atoms: b.atoms, bonds: b.bonds },
    smiles,
    chainAtomIndices: b.chainAtomIndices,
    substituentGroups: b.substituentGroups,
    fgAtomIndices: b.fgAtomIndices,
    isBenzene: false,
    isCyclic: false,
    ringAtomIndices: [],
    parsed,
  };
}

/** 稠环芳烃构建（萘/蒽/菲 + 位次取代基：1-甲基萘、2-萘酚）：模板 smiles 直建
 * （教学标注降级，结构与分子式/RDKit canonical 正确） */
function buildFusedAromatic(b: Builder, parsed: Extract<ParsedResult, { kind: 'fused' }>): BuiltMolecule {
  const fused = parsed.fused;
  const template = FUSED_TEMPLATES[fused.base];
  if (!template) throw new Error('未知稠环母体: ' + fused.base);
  let smiles = template.base;
  if (fused.substituents.length) {
    const keys: string[] = [];
    for (const sub of fused.substituents) {
      const poss = sub.positions.length ? sub.positions : [1];
      for (const p of poss) keys.push(`${sub.name}@${p}`);
    }
    const v = template.variants[keys.join('+')];
    if (!v) throw new Error(`暂不支持的稠环取代组合「${keys.join('+')}」`);
    smiles = v;
  }
  const g = parseSmiles(smiles);
  return {
    graph: g,
    smiles: g.smiles,
    chainAtomIndices: [],
    substituentGroups: [],
    fgAtomIndices: [],
    isBenzene: true,
    isCyclic: true,
    ringAtomIndices: g.atoms.map((_, i) => i),
    parsed,
  };
}

/** 主入口：ParsedResult → BuiltMolecule */
export function buildFromParsed(parsed: ParsedResult): BuiltMolecule {
  if (parsed.kind === 'common') {
    // 通过系统名递归构建，获得完整教学标注；防自引用兜底
    if (parsed.systematicName === parsed.normalized) {
      throw new Error('俗名表配置错误：系统名与俗名相同（' + parsed.normalized + '）');
    }
    if (parsed.systematicName) {
      try {
        const systematic = parseName(parsed.systematicName);
        return buildFromParsed(systematic);
      } catch {
        // 系统名不可达（联苯/二苯甲烷/对苯二甲酸乙二醇酯等特殊俗名）：smiles 直建
      }
    }
    // smiles 直建：结构/分子式/RDKit canonical 正确，教学标注（链位次/取代基组）降级为空
    const g = parseSmiles(parsed.smiles);
    return {
      graph: g,
      smiles: g.smiles,
      chainAtomIndices: [],
      substituentGroups: [],
      fgAtomIndices: [],
      isBenzene: g.atoms.some((a) => a.aromatic),
      isCyclic: false,
      ringAtomIndices: [],
      parsed,
    };
  }
  const b = new Builder();
  if (parsed.kind === 'fused') return buildFusedAromatic(b, parsed);
  if (parsed.kind === 'systematic') {
    if (parsed.parent.benzene) return buildBenzene(b, parsed);
    if (parsed.parent.cyclic) return buildCycloalkane(b, parsed);
    return buildChain(b, parsed);
  }
  if (parsed.kind === 'ether') return buildEther(b, parsed);
  return buildEster(b, parsed);
}
