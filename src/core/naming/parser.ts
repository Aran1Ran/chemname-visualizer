/**
 * 中文系统命名解析器（高中范围）
 * 输入：规范化后的名称字符串
 * 输出：结构化 ParsedResult（俗名 / 系统名 / 酯）
 * 任何无法解析的情况抛 ParseError（带友好提示）。
 */
import {
  STEM_LEN,
  LEN_STEM,
  SUFFIXES,
  SUBSTITUENTS,
  SUBSTITUENT_NAMES,
  COMMON_NAMES,
  MULTIPLIERS,
  ORTHO_META_PARA,
  STEM_ALKYL,
  FUSED_TEMPLATES,
  type Suffix,
} from './lexicon';
import { parsePositionString } from './normalize';

export interface ParsedSubstituent {
  name: string; // 取代基名（甲基/溴/羟基...）
  positions: number[]; // 附着位置（可为空 → builder 默认）
  count: number; // 倍数（二甲基 → 2）
}

export interface ParsedParent {
  stem: string;
  chainLen: number;
  suffix: Suffix;
  multiplier: number; // 二烯/二醇 的倍数，默认 1
  positions: number[]; // 官能团位次（醇/烯/炔/酮/酸/醛/腈）
  cyclic: boolean; // 环烷烃
  benzene: boolean; // 苯环系
  /** 双官能团：母体名中嵌入的烯/炔（如 "2-丙烯-1-醇" 的 烯@2） */
  extraEne?: { positions: number[]; bond: '烯' | '炔' };
  /** 氧代（酸/酯链内羰基，如 "3-氧代丁酸" 的 3-）：在对应链位加 =O */
  oxo?: number[];
}

export interface ParsedEster {
  acidParent: ParsedParent;
  acidSubstituents: ParsedSubstituent[];
  alcoholStem: string;
  alcoholLen: number;
  /** 醇基个数（二酸二酯 = 2，如 乙二酸二乙酯） */
  alcoholMult?: number;
  /** 乙烯酯（乙酸乙烯酯：醇部分为 -O-CH=CH2） */
  alcoholVinyl?: boolean;
  /** 支链醇基片段（乙酸异戊酯：-O-CH2CH2CH(CH3)2） */
  alcoholBranchSmiles?: string;
}

export interface ParsedEther {
  /** 醚键两侧的烷基（苯基 = 芳香环） */
  left: EtherSide;
  right: EtherSide;
  /** 两侧相同（对称醚，如 乙醚/二甲醚） */
  symmetric: boolean;
  /** 苯基醚：苯环上额外取代基（如 邻甲基苯甲醚 的 甲基@2；位次以 O 连的环碳为 1） */
  ringSubstituents?: ParsedSubstituent[];
}

export interface EtherSide {
  name: string; // 甲基/乙基/异丙基/苯基...
  smiles: string; // 片段 SMILES（连接键形式）
  attachIndex: number;
  carbonCount: number;
}

export type ParsedResult =
  | {
      kind: 'common';
      raw: string;
      normalized: string;
      systematicName: string;
      smiles: string;
    }
  | {
      kind: 'systematic';
      raw: string;
      normalized: string;
      parent: ParsedParent;
      substituents: ParsedSubstituent[];
      /** 苯环系邻间对前缀（如 '对'）或显式位置 */
      aromaticPrefix?: string;
      /** 酰胺 N 上取代基（N,N-二甲基甲酰胺 的 二甲基，附着在 N 而非链碳） */
      nSubstituents?: ParsedSubstituent[];
    }
  | {
      kind: 'ester';
      raw: string;
      normalized: string;
      ester: ParsedEster;
    }
  | {
      kind: 'fused';
      raw: string;
      normalized: string;
      /** 稠环芳烃（萘/蒽/菲）+ 位次取代基（1-甲基萘、2-萘酚） */
      fused: { base: string; substituents: ParsedSubstituent[] };
    }
  | {
      kind: 'ether';
      raw: string;
      normalized: string;
      ether: ParsedEther;
    };

export class ParseError extends Error {
  hint?: string;
  position?: number;
  constructor(message: string, hint?: string, position?: number) {
    super(message);
    this.hint = hint;
    this.position = position;
  }
}

const STEM_CHARS = Object.keys(STEM_LEN);
const STEM_SET = new Set(STEM_CHARS);

/** 从右往左找父体词段：返回 { start, stem, multiplier, suffix, ene } */
function findParentSegment(s: string): { stemStart: number; stem: string; multiplier: number; suffix: Suffix; ene: '烯' | '炔' | null } | null {
  // 两字后缀（酰胺）优先；否则单字后缀
  const isAmide = s.endsWith('酰胺');
  const suffix = isAmide ? '酰胺' : s[s.length - 1];
  if (!SUFFIXES.includes(suffix as Suffix)) return null;
  const suffixLen = isAmide ? 2 : 1;
  for (let i = s.length - 1 - suffixLen; i >= 0; i--) {
    const ch = s[i];
    if (!STEM_SET.has(ch)) continue;
    let j = i + 1;
    // 词干后紧跟的 烯/炔：可能是母体后缀本身（丁烯/丙炔），也可能是嵌入的双官能团（2-丙烯-1-醇 中的 烯）
    let ene: '烯' | '炔' | null = null;
    if (s[j] === '烯' || s[j] === '炔') {
      if (j === s.length - suffixLen && s.slice(j, j + suffixLen) === suffix) {
        // 丁烯/丙炔：烯/炔 即后缀
        return { stemStart: i, stem: ch, multiplier: 1, suffix: s[j] as Suffix, ene: null };
      }
      ene = s[j] as '烯' | '炔';
      j++;
    }
    // 倍数词（二/三...），紧跟后缀
    let multText = '';
    while (j < s.length && /[一二三四五六七八九十0-9]/.test(s[j])) {
      multText += s[j];
      j++;
    }
    // 双官能团：烯/炔 后可有官能团位次 "-1-"（如 2-丙烯-1-醇）
    if (ene && j < s.length && s.slice(j, j + suffixLen) !== suffix) {
      const locMatch = s.slice(j).match(/^-?([0-9一二三四五六七八九十,，]+)-/);
      if (locMatch) j += locMatch[0].length;
    }
    if (j === s.length - suffixLen && s.slice(j, j + suffixLen) === suffix) {
      let mult = 1;
      if (multText.length > 0) {
        if (/^\d+$/.test(multText)) mult = parseInt(multText, 10);
        else if (multText in MULTIPLIERS) mult = MULTIPLIERS[multText];
        else mult = 0;
      }
      if (mult === 0) continue;
      return { stemStart: i, stem: ch, multiplier: mult, suffix: suffix as Suffix, ene };
    }
  }
  return null;
}

/** 解析一个取代基名 token：'二甲基' → {mult:2, name:'甲基'}；'甲基' → {1,'甲基'}；'溴' → {1,'溴'}；'二甲' → {2,'甲基'} */
function parseSubstituentToken(tok: string): { mult: number; name: string } {
  if (!tok) throw new ParseError('缺少取代基名称', '例如：2-甲基、2,3-二甲基');
  // 按最长名称优先匹配
  const sorted = [...SUBSTITUENT_NAMES].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (tok === name) return { mult: 1, name };
    if (tok.endsWith(name)) {
      const prefix = tok.slice(0, tok.length - name.length);
      const n = parseMultiplier(prefix);
      if (n !== null) return { mult: n, name };
    }
  }
  // 词干简写：'二甲' → 二甲基；'甲' → 甲基
  const stemMatch = tok.match(/^([一二三四五六七八九十0-9]*)([甲乙丙丁戊己庚辛壬癸])$/);
  if (stemMatch) {
    const alkyl = STEM_ALKYL[stemMatch[2]];
    if (alkyl) {
      const n = parseMultiplier(stemMatch[1]);
      if (n !== null) return { mult: n, name: alkyl };
    }
  }
  throw new ParseError(`无法识别的取代基「${tok}」`, '请检查取代基名称（如 甲基、乙基、溴、羟基）');
}

function parseMultiplier(prefix: string): number | null {
  if (prefix.length === 0) return 1;
  if (/^\d+$/.test(prefix)) return parseInt(prefix, 10);
  if (prefix.length === 1 && prefix in MULTIPLIERS) return MULTIPLIERS[prefix];
  // '二三' 等（无十）
  if (/^[一二三四五六七八九十]+$/.test(prefix) && !prefix.includes('十')) {
    let total = 0;
    for (const ch of prefix) {
      const n = MULTIPLIERS[ch];
      if (n === undefined) return null;
      total += n;
    }
    return total;
  }
  return null;
}

/** 拆分前缀为取代基组 */
function parsePrefixGroups(prefix: string): ParsedSubstituent[] {
  const groups: ParsedSubstituent[] = [];
  if (!prefix) return groups;
  const tokens = prefix.split('-');
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    // 位置组：纯数字/中文数字（可为逗号分隔）
    if (/^[0-9一二三四五六七八九十,，]+$/.test(tok) && /[0-9一二三四五六七八九十]/.test(tok)) {
      const positions = parsePositionString(tok);
      i++;
      if (i >= tokens.length) {
        throw new ParseError(`位置「${tok}」后缺少取代基`, '例如：2-甲基、2,3-二甲基');
      }
      const { mult, name } = parseSubstituentToken(tokens[i]);
      groups.push({ name, positions, count: mult });
    } else {
      const { mult, name } = parseSubstituentToken(tok);
      groups.push({ name, positions: [], count: mult });
    }
    i++;
  }
  return groups;
}

/** 判断后缀是否需要/允许官能团位次 */
function suffixNeedsPosition(suffix: Suffix): boolean {
  return suffix === '醇' || suffix === '烯' || suffix === '炔' || suffix === '酮' || suffix === '酸' || suffix === '醛' || suffix === '腈' || suffix === '酰胺' || suffix === '胺';
}

/** 官能团缺省位次 */
function defaultFgPositions(suffix: Suffix, chainLen: number, mult: number): number[] {
  switch (suffix) {
    case '醇':
      return mult === 1 ? [1] : Array.from({ length: mult }, (_, k) => 1 + k);
    case '醛':
      return mult === 1 ? [1] : Array.from({ length: mult }, (_, k) => 1 + k);
    case '酰胺':
      return mult === 1 ? [1] : Array.from({ length: mult }, (_, k) => 1 + k);
    case '胺':
      // 单胺 [1]；多元胺（乙二胺/己二胺）两端各一 [1, 链长]
      if (mult === 1) return [1];
      if (mult === 2) return [1, chainLen];
      return Array.from({ length: mult }, (_, k) => 1 + k);
    case '酸':
      // 二元酸：两端各一（乙二酸 1,2 / 丙二酸 1,3 / 丁二酸 1,4），教材不写位次
      if (mult === 1) return [1];
      if (mult === 2) return [1, chainLen];
      return Array.from({ length: mult }, (_, k) => 1 + k);
    case '腈':
      return mult === 1 ? [1] : Array.from({ length: mult }, (_, k) => 1 + k);
    case '酮':
      return mult === 1 ? [2] : Array.from({ length: mult }, (_, k) => 2 + k);
    case '烯':
      // 单烯 [1]；二烯/三烯缺省取交替位次（1,3,5...，共轭二烯为教材常见形式，如环戊二烯）
      return mult === 1 ? [1] : Array.from({ length: mult }, (_, k) => 1 + 2 * k);
    case '炔':
      return mult === 1 ? [1] : Array.from({ length: mult }, (_, k) => 1 + 2 * k);
    default:
      return [];
  }
}

/** 检查位置是否在链长范围内；返回修正后的位置或抛错 */
function validatePositions(positions: number[], chainLen: number, context: string): number[] {
  for (const p of positions) {
    if (p < 1 || p > chainLen) {
      throw new ParseError(`位置 ${p} 超出${context}的碳数范围（1~${chainLen}）`, `最长链只有 ${chainLen} 个碳`);
    }
  }
  return positions;
}

/** 解析苯环系（结尾为 苯/酚，或 苯+酸/醛/胺/乙烯，或 邻/间/对+取代基+苯甲酸等） */
function parseBenzene(s: string, raw: string): ParsedResult | null {
  const isBenzeneEnd = s.endsWith('苯') || s.endsWith('酚');
  const isBenzoFg = s.startsWith('苯') && (s.endsWith('酸') || s.endsWith('醛') || s.endsWith('胺') || s === '苯乙烯' || s === '苯乙炔');
  const isDiacid = s.endsWith('苯二甲酸');
  const isPosFg = /^[0-9一二三四五六七八九十,，]+-.+?(苯甲酸|苯甲醛|苯酚|苯胺|甲酚)$/.test(s); // 3,5-二甲基苯酚 / 3-羟基苯甲酸 / 2,4-二甲酚
  const omKey = Object.keys(ORTHO_META_PARA).find((om) => s.startsWith(om));
  const isOmBenzoFg = !!omKey && s.length > omKey.length + 2 && /(苯甲酸|苯甲醛|苯酚|苯胺)$/.test(s);
  if (!isBenzeneEnd && !isBenzoFg && !isOmBenzoFg && !isDiacid && !isPosFg) return null;
  // 邻/间/对 + 取代基 + 苯甲酸/苯甲醛/苯酚/苯胺（邻羟基苯甲酸、对羟基苯甲酸）
  if (isOmBenzoFg && omKey) {
    const rest = s.slice(omKey.length);
    const benzoMatch = rest.match(/^(.+?)(苯甲酸|苯甲醛|苯酚|苯胺)$/);
    if (benzoMatch) {
      const suffix = benzoMatch[2] === '苯甲酸' ? '酸' : benzoMatch[2] === '苯甲醛' ? '醛' : benzoMatch[2] === '苯酚' ? '酚' : '胺';
      const subs2 = splitBenzeneSubs(benzoMatch[1], s);
      // 官能团固定 1 位，取代基从 邻/间/对 对应位起（邻→2、间→3、对→4）
      const basePos = ORTHO_META_PARA[omKey][1];
      let pi2 = 0;
      for (const g of subs2) {
        g.positions = Array.from({ length: g.count }, (_, k) => basePos + pi2 + k);
        pi2 += g.count;
      }
      return {
        kind: 'systematic',
        raw,
        normalized: s,
        parent: { stem: '苯', chainLen: 6, suffix, multiplier: 1, positions: [1], cyclic: false, benzene: true },
        substituents: subs2,
        aromaticPrefix: omKey,
      };
    }
  }
  // 苯酚
  if (s === '苯酚') {
    return {
      kind: 'systematic',
      raw,
      normalized: s,
      parent: { stem: '苯', chainLen: 6, suffix: '酚', multiplier: 1, positions: [1], cyclic: false, benzene: true },
      substituents: [],
    };
  }
  if (s === '苯') {
    return {
      kind: 'systematic',
      raw,
      normalized: s,
      parent: { stem: '苯', chainLen: 6, suffix: '苯', multiplier: 1, positions: [], cyclic: false, benzene: true },
      substituents: [],
    };
  }
  // 苯甲酸 / 苯甲醛 / 苯胺
  if (s === '苯甲酸' || s === '苯甲醛' || s === '苯胺') {
    const suffix = s === '苯甲酸' ? '酸' : s === '苯甲醛' ? '醛' : '胺';
    return {
      kind: 'systematic',
      raw,
      normalized: s,
      parent: { stem: '苯', chainLen: 6, suffix, multiplier: 1, positions: [1], cyclic: false, benzene: true },
      substituents: [],
    };
  }
  // 苯乙烯 / 苯乙炔（苯环 + 乙烯基/乙炔基）
  if (s === '苯乙烯' || s === '苯乙炔') {
    const subName = s === '苯乙烯' ? '乙烯基' : '乙炔基';
    return {
      kind: 'systematic',
      raw,
      normalized: s,
      parent: { stem: '苯', chainLen: 6, suffix: '苯', multiplier: 1, positions: [], cyclic: false, benzene: true },
      substituents: [{ name: subName, positions: [1], count: 1 }],
    };
  }
  // 邻/间/对苯二甲酸 或 位次-苯二甲酸（两个 COOH 挂环；对苯二甲酸 → 1,4）
  if (isDiacid) {
    const prefix = s.slice(0, s.length - 4); // 去掉「苯二甲酸」
    let positions: number[] | null = null;
    if (prefix === '邻' || prefix === '间' || prefix === '对') {
      positions = [1, ORTHO_META_PARA[prefix][1]];
    } else {
      const posM = prefix.match(/^([0-9一二三四五六七八九十,，]+)-$/);
      if (posM) positions = parsePositionString(posM[1]);
    }
    if (positions) {
      return {
        kind: 'systematic',
        raw,
        normalized: s,
        parent: { stem: '苯', chainLen: 6, suffix: '酸', multiplier: 2, positions, cyclic: false, benzene: true },
        substituents: [],
      };
    }
  }
  // 位次-取代基 + 苯酚/苯甲酸/苯甲醛/苯胺（3,5-二甲基苯酚、2,4,6-三溴苯酚、3-羟基苯甲酸）
  const posFg = s.match(/^([0-9一二三四五六七八九十,，]+)-(.+?)(苯酚|苯甲酸|苯甲醛|苯胺)$/);
  if (posFg) {
    const suffix = posFg[3] === '苯甲酸' ? '酸' : posFg[3] === '苯甲醛' ? '醛' : posFg[3] === '苯酚' ? '酚' : '胺';
    const groups = parsePrefixGroups(posFg[1] + '-' + posFg[2]);
    return {
      kind: 'systematic',
      raw,
      normalized: s,
      parent: { stem: '苯', chainLen: 6, suffix, multiplier: 1, positions: [1], cyclic: false, benzene: true },
      substituents: groups,
    };
  }
  // 位次-二甲酚/三甲酚（"二甲酚" = 二甲基苯酚 简写：2,4-二甲酚 / 3,5-二甲酚；酚羟基固定 1 位）
  const posCresol = s.match(/^([0-9一二三四五六七八九十,，]+)-(二|三)甲酚$/);
  if (posCresol) {
    const n = posCresol[2] === '二' ? 2 : 3;
    const positions = parsePositionString(posCresol[1]);
    if (positions.length !== n) {
      throw new ParseError(`「${s}」位次数目与甲基个数不符`, `例如：2,4-二甲酚（两个甲基）；位次用逗号分隔`);
    }
    return {
      kind: 'systematic',
      raw,
      normalized: s,
      parent: { stem: '苯', chainLen: 6, suffix: '酚', multiplier: 1, positions: [1], cyclic: false, benzene: true },
      substituents: [{ name: '甲基', positions, count: n }],
    };
  }
  // 邻/间/对 前缀
  let prefixText = s;
  let orthoMetaPara: string | undefined;
  for (const om of Object.keys(ORTHO_META_PARA)) {
    if (s.startsWith(om)) {
      orthoMetaPara = om;
      prefixText = s.slice(om.length);
      break;
    }
  }
  // X苯 / 二X苯 / 1,2-二X苯 / 氯甲苯（多取代基）
  const benzeneMatch = prefixText.match(/^(.+?)(苯)$/);
  if (!benzeneMatch) {
    throw new ParseError(`无法解析芳香族名称「${s}」`, '支持：甲苯、二甲苯、苯酚、苯甲醛、苯甲酸、苯胺、硝基苯、氯苯、邻氯甲苯、苯乙烯等');
  }
  const inner = benzeneMatch[1];
  // 位置前缀（如 1,2-）
  let posText = '';
  let rest = inner;
  const posMatch = inner.match(/^([0-9一二三四五六七八九十,，]+)-/);
  if (posMatch) {
    posText = posMatch[1];
    rest = inner.slice(posMatch[0].length);
  }
  // 拆分 1~2 个取代基 token（氯甲苯 → 氯+甲基；二甲苯 → 甲基×2）
  const groups: ParsedSubstituent[] = splitBenzeneSubs(rest, s);
  let positions: number[];
  if (posText) {
    positions = parsePositionString(posText);
  } else if (orthoMetaPara) {
    positions = ORTHO_META_PARA[orthoMetaPara];
  } else {
    // 缺省：单组 → 1；多组（如 氯甲）或同组倍数 → 1,2 邻位
    const total = groups.reduce((acc, g) => acc + g.count, 0);
    positions = total === 1 ? [1] : Array.from({ length: total }, (_, k) => 1 + k);
  }
  // 按组依次分配位置；显式位次不足时（如 TNT：2,4,6-三硝基甲苯 的 甲基 未写位次），
  // 剩余组取未占用最小环位
  let pi = 0;
  const used = new Set<number>();
  for (const g of groups) {
    if (pi + g.count <= positions.length) {
      g.positions = positions.slice(pi, pi + g.count);
      for (const p of g.positions) used.add(p);
    } else {
      const rest: number[] = [];
      for (let p = 1; p <= 6 && rest.length < g.count; p++) {
        if (!used.has(p)) {
          rest.push(p);
          used.add(p);
        }
      }
      g.positions = rest;
    }
    pi += g.count;
  }
  return {
    kind: 'systematic',
    raw,
    normalized: s,
    parent: { stem: '苯', chainLen: 6, suffix: '苯', multiplier: 1, positions: [], cyclic: false, benzene: true },
    substituents: groups,
    aromaticPrefix: orthoMetaPara,
  };
}

/**
 * 拆分苯环取代基 token 序列：'氯甲' → [氯, 甲基]；'二甲' → [甲基×2]；'二氯' → [氯×2]
 */
function splitBenzeneSubs(rest: string, fullName: string): ParsedSubstituent[] {
  const out: ParsedSubstituent[] = [];
  const sorted = [...SUBSTITUENT_NAMES].sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < rest.length) {
    let matched = false;
    for (const name of sorted) {
      if (rest.startsWith(name, i)) {
        out.push({ name, positions: [], count: 1 });
        i += name.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    // 倍数词 + 完整取代基名（二氯苯 / 三硝基甲苯）
    const multNameMatch = rest.slice(i).match(/^([一二三四五六七八九十0-9])/);
    if (multNameMatch) {
      const n = parseMultiplier(multNameMatch[1]);
      const name = sorted.find((nm) => rest.startsWith(nm, i + 1));
      if (n !== null && name) {
        out.push({ name, positions: [], count: n });
        i += 1 + name.length;
        continue;
      }
    }
    // 词干简写（可带倍数）：甲/二甲/氯甲中的 甲
    const stemMatch = rest.slice(i).match(/^([一二三四五六七八九十0-9]?)([甲乙丙丁戊己庚辛壬癸])/);
    if (stemMatch) {
      const alkyl = STEM_ALKYL[stemMatch[2]];
      if (!alkyl) throw new ParseError(`无法解析苯环取代基「${rest.slice(i)}」（${fullName}）`);
      const n = parseMultiplier(stemMatch[1]);
      if (n === null) throw new ParseError(`无法解析苯环取代基「${rest.slice(i)}」`);
      out.push({ name: alkyl, positions: [], count: n });
      i += stemMatch[0].length;
      continue;
    }
    throw new ParseError(`无法解析苯环取代基「${rest.slice(i)}」（${fullName}）`, '支持：甲苯、二甲苯、邻氯甲苯、对硝基甲苯、苯乙烯等');
  }
  return out;
}

/** 解析酯（X酸Y酯） */
function parseEster(s: string, raw: string): ParsedResult | null {
  if (!s.endsWith('酯')) return null;
  const acidIdx = s.indexOf('酸');
  if (acidIdx <= 0) return null;
  const acidPart = s.slice(0, acidIdx + 1); // 含 酸
  const alcoholPart = s.slice(acidIdx + 1, s.length - 1); // 酯 之前的醇词干
  // 解析酸部分（递归：酸是 parent suffix=酸 的系统名；支持俗名表：草酸 → 乙二酸）
  let acidParsed: ParsedResult;
  try {
    const rawAcid = parseName(acidPart);
    acidParsed = rawAcid.kind === 'common' ? parseName(rawAcid.systematicName) : rawAcid;
  } catch {
    return null;
  }
  if (acidParsed.kind !== 'systematic') return null;
  // 支链醇短名（乙酸异丙酯/乙酸异戊酯：片段根=连接点=第一个原子）
  const BRANCH_ALCOHOL: Record<string, { smiles: string; len: number }> = {
    异丙: { smiles: 'C(C)C', len: 3 },
    异丁: { smiles: 'CC(C)C', len: 4 },
    异戊: { smiles: 'CCC(C)C', len: 5 },
    仲丁: { smiles: 'C(C)CC', len: 4 },
    叔丁: { smiles: 'C(C)(C)C', len: 4 },
    正丙: { smiles: 'CCC', len: 3 },
    正丁: { smiles: 'CCCC', len: 4 },
    正戊: { smiles: 'CCCCC', len: 5 },
    // 苯甲酯/苄酯（苯甲醇 HCOOCH2C6H5 的醇部分：苯基+CH2 = 苄基）
    苯甲: { smiles: 'Cc1ccccc1', len: 7 },
    苄: { smiles: 'Cc1ccccc1', len: 7 },
    // 苯酯（乙酸苯酯：醇部分为 -O-C6H5）
    苯: { smiles: 'c1ccccc1', len: 6 },
  };
  const branch = BRANCH_ALCOHOL[alcoholPart];
  if (branch) {
    return {
      kind: 'ester',
      raw,
      normalized: s,
      ester: {
        acidParent: acidParsed.parent,
        acidSubstituents: acidParsed.substituents,
        alcoholStem: alcoholPart,
        alcoholLen: branch.len,
        alcoholBranchSmiles: branch.smiles,
      },
    };
  }
  // 醇部分：'乙'（乙酯）/'二乙'（二乙酯）/'乙烯'（乙烯酯：乙酸乙烯酯）
  if (alcoholPart === '乙烯') {
    return {
      kind: 'ester',
      raw,
      normalized: s,
      ester: {
        acidParent: acidParsed.parent,
        acidSubstituents: acidParsed.substituents,
        alcoholStem: '乙烯',
        alcoholLen: 2,
        alcoholVinyl: true,
      },
    };
  }
  // 醇部分：词干（可带倍数：二乙酯）
  const alcoMatch = alcoholPart.match(/^([一二三四五六七八九十0-9]?)([甲乙丙丁戊己庚辛壬癸])$/);
  if (!alcoMatch) {
    return null;
  }
  const alcoMult = alcoMatch[1] ? parseMultiplier(alcoMatch[1]) : 1;
  if (alcoMult === null || alcoMult < 1) return null;
  // 二酯（二乙酯等）要求酸部分为二酸
  if (alcoMult > 1 && acidParsed.parent.multiplier < 2) return null;
  const alcoholStem = alcoMatch[2];
  const alcoholLen = STEM_LEN[alcoholStem];
  return {
    kind: 'ester',
    raw,
    normalized: s,
    ester: {
      acidParent: acidParsed.parent,
      acidSubstituents: acidParsed.substituents,
      alcoholStem,
      alcoholLen,
      alcoholMult: alcoMult,
    },
  };
}

/** 烷基片段表（醚侧基；name → 片段信息） */
const ETHER_ALKYL_NAMES = ['叔丁基', '异丁基', '仲丁基', '正丁基', '异丙基', '正丙基', '丁基', '丙基', '乙基', '甲基'];

/** 解析醚类名称：乙醚/二甲醚/甲乙醚/甲丙醚/甲基异丙基醚/苯甲醚/苯乙醚 */
function parseEther(s: string, raw: string): ParsedResult | null {
  if (!s.endsWith('醚')) return null;
  // 苯甲醚 / 苯乙醚（苯基 + 烷基）
  const aromaticMatch = s.match(/^苯([甲乙丙丁戊己庚辛壬癸])醚$/);
  if (aromaticMatch) {
    const alkylName = STEM_ALKYL[aromaticMatch[1]];
    const info = SUBSTITUENTS[alkylName];
    if (!info) return null;
    return {
      kind: 'ether',
      raw,
      normalized: s,
      ether: {
        left: { name: '苯基', smiles: 'c1ccccc1', attachIndex: 0, carbonCount: 6 },
        right: { name: alkylName, smiles: info.smiles, attachIndex: info.attachIndex, carbonCount: info.carbonCount },
        symmetric: false,
      },
    };
  }
  // 邻/间/对 + 甲基/乙基 + 苯甲醚（环上取代的苯甲醚：邻甲基苯甲醚 = CH3-C6H4-OCH3）
  const omAnisole = s.match(/^(邻|间|对)(甲基|乙基)苯甲醚$/);
  if (omAnisole) {
    const ringSub = omAnisole[2]; // 甲基/乙基
    const info = SUBSTITUENTS[ringSub];
    const methylInfo = SUBSTITUENTS['甲基'];
    if (!info || !methylInfo) return null;
    return {
      kind: 'ether',
      raw,
      normalized: s,
      ether: {
        left: { name: '苯基', smiles: 'c1ccccc1', attachIndex: 0, carbonCount: 6 },
        right: { name: '甲基', smiles: methylInfo.smiles, attachIndex: methylInfo.attachIndex, carbonCount: 1 },
        symmetric: false,
        ringSubstituents: [{ name: ringSub, positions: [ORTHO_META_PARA[omAnisole[1]][1]], count: 1 }],
      },
    };
  }
  const rest = s.slice(0, -1); // 去掉 醚
  if (!rest) return null;
  // token 化：倍数前缀 + 烷基序列
  const sides: EtherSide[] = [];
  let i = 0;
  let symMult = 1;
  // 开头的倍数词（二甲醚 → 二）
  const headMult = rest.match(/^([一二三四五六七八九十0-9])/);
  const sortedAlkyl = [...ETHER_ALKYL_NAMES].sort((a, b) => b.length - a.length);
  while (i < rest.length) {
    if (i === 0 && headMult) {
      const n = parseMultiplier(headMult[1]);
      if (n === null) return null;
      // 只有单一 token 时才允许倍数（二甲醚/二乙醚）
      symMult = n;
      i += headMult[0].length;
      continue;
    }
    let matched = false;
    for (const name of sortedAlkyl) {
      if (rest.startsWith(name, i)) {
        const info = SUBSTITUENTS[name];
        if (!info) return null;
        sides.push({ name, smiles: info.smiles, attachIndex: info.attachIndex, carbonCount: info.carbonCount });
        i += name.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    // 短词干：甲乙醚 的 甲/乙
    const stemCh = rest[i];
    if (stemCh in STEM_ALKYL) {
      const name = STEM_ALKYL[stemCh];
      const info = SUBSTITUENTS[name];
      if (!info) return null;
      sides.push({ name, smiles: info.smiles, attachIndex: info.attachIndex, carbonCount: info.carbonCount });
      i += 1;
      continue;
    }
    return null;
  }
  if (sides.length === 0 || sides.length > 2) return null;
  // 组装：单侧 → 对称醚
  let ether: ParsedEther;
  if (sides.length === 1) {
    if (symMult !== 1 && symMult !== 2) return null;
    ether = { left: sides[0], right: { ...sides[0] }, symmetric: true };
  } else {
    if (symMult !== 1) return null;
    ether = { left: sides[0], right: sides[1], symmetric: sides[0].name === sides[1].name };
  }
  return { kind: 'ether', raw, normalized: s, ether };
}

/** 解析系统名核心（链烃/环烃/苯系） */
function parseSystematicCore(s: string, raw: string, opts: { esterAcid?: boolean } = {}): ParsedResult {
  // 苯系优先
  const benzene = parseBenzene(s, raw);
  if (benzene) return benzene;

  // 苯基取代脂肪醇简写：苯乙醇（2-苯基乙醇）/ 1-苯乙醇（1-苯基乙醇）/ 苯甲醇
  const phenylAlcohol = s.match(/^([0-9一二三四五六七八九十,，]+-)?苯([甲乙丙丁戊己庚辛壬癸])醇$/);
  if (phenylAlcohol) {
    const stem = phenylAlcohol[2];
    const chainLen = STEM_LEN[stem];
    const explicitPos = phenylAlcohol[1] ? parsePositionString(phenylAlcohol[1].slice(0, -1)) : [];
    // 苯基位：显式位次优先（1-苯乙醇 → 1）；苯甲醇（1 碳）→ 1；其余缺省 2（苯乙醇 = 2-苯基乙醇）
    let phenylPos: number[];
    if (explicitPos.length) phenylPos = explicitPos;
    else if (chainLen === 1) phenylPos = [1];
    else phenylPos = [2];
    if (phenylPos[0] > chainLen) {
      throw new ParseError(`苯基位置 ${phenylPos[0]} 超出主链长度（${chainLen}）`);
    }
    return {
      kind: 'systematic',
      raw,
      normalized: s,
      parent: { stem, chainLen, suffix: '醇', multiplier: 1, positions: [1], cyclic: false, benzene: false },
      substituents: [{ name: '苯基', positions: phenylPos, count: 1 }],
    };
  }

  // 三羧酸/二羧酸等（柠檬酸：2-羟基丙烷-1,2,3-三羧酸 → 丙烷 + 羧基取代基）
  const triAcid = s.match(/^(.+?)([一二三四五六七八九十0-9]+)羧酸$/);
  if (triAcid) {
    const tail = triAcid[1];
    const posTail = tail.match(/([0-9一二三四五六七八九十,，]+)-$/);
    const baseName = posTail ? tail.slice(0, posTail.index).replace(/-$/, '') : tail.replace(/-+$/, '');
    const positions = posTail ? parsePositionString(posTail[1]) : [];
    const mult = parseMultiplier(triAcid[2]);
    if (mult !== null && mult >= 2) {
      const base = parseSystematicCore(baseName, raw, opts);
      if (base.kind === 'systematic') {
        return {
          ...base,
          substituents: [...base.substituents, { name: '羧基', positions, count: mult }],
        };
      }
    }
  }

  // 环前缀（可位于名称中部：甲基环丙烷 / 环己烷）
  let cyclic = false;
  let body = s;
  const ringIdx = s.indexOf('环');
  if (ringIdx >= 0) {
    cyclic = true;
    body = s.slice(0, ringIdx) + s.slice(ringIdx + 1);
  }

  const seg = findParentSegment(body);
  if (!seg) {
    throw new ParseError(`无法识别的母体（找不到碳数词干+后缀）「${s}」`, '母体形如：甲烷、丁烷、丙醇、丁烯、乙酸、苯甲酸 等');
  }

  const parentText = body.slice(seg.stemStart);
  let prefixText = body.slice(0, seg.stemStart);

  const chainLen = STEM_LEN[seg.stem];
  let parentPositions: number[] = [];
  let realPrefix = prefixText;
  let extraEne: { positions: number[]; bond: '烯' | '炔' } | undefined;

  // 氧代（酸/酯链内羰基，如 "3-氧代丁酸乙酯" 的 3-氧代）：从前缀中提取，不计入链上取代基
  let oxoPositions: number[] = [];
  const oxoMatch = prefixText.match(/([0-9一二三四五六七八九十,，]+)-氧代$/);
  if (oxoMatch) {
    oxoPositions = parsePositionString(oxoMatch[1]);
    prefixText = prefixText.slice(0, oxoMatch.index).replace(/-$/, '');
    realPrefix = prefixText;
  }
  // N 取代基（酰胺/胺：N,N-二甲基 / N-甲基 / 二甲胺 的 N-烷基化，附着在 N 上）
  let nSubstituents: ParsedSubstituent[] = [];
  if (seg.suffix === '酰胺' || seg.suffix === '胺') {
    const nRes = parseAmideNPrefix(realPrefix);
    nSubstituents = nRes.nSubs;
    realPrefix = nRes.rest;
  }
  // 胺的 N-烷基化简写：二甲胺/三甲胺（纯倍数前缀 + 单词干 + 胺）→ 词干烷基 ×(mult-1) 挂 N
  if (seg.suffix === '胺') {
    const amineN = realPrefix.match(/^([一二三四五六七八九十]+)$/);
    if (amineN) {
      const m = parseMultiplier(amineN[1]);
      if (m !== null && m >= 2) {
        nSubstituents.push({ name: STEM_ALKYL[seg.stem], positions: [], count: m - 1 });
        realPrefix = '';
      }
    }
  }

  if (seg.ene) {
    // 双官能团：parentText = [stem][烯/炔][fg位次-][后缀]；prefixText 尾部 = 烯/炔位次
    // 例：2-丙烯-1-醇（烯@2，醇@1）；2-丙烯酸（烯@2，酸@1 缺省）；3-丁烯-2-酮（烯@3，酮@2）
    const eneLocMatch = prefixText.match(/([0-9一二三四五六七八九十,，]+)-$/);
    let enePositions: number[];
    if (eneLocMatch) {
      enePositions = parsePositionString(eneLocMatch[1]);
      realPrefix = prefixText.slice(0, -eneLocMatch[0].length).replace(/-$/, '');
    } else {
      enePositions = [2]; // 缺省：官能团占据 1 位时双键在 2 位
      realPrefix = prefixText;
    }
    for (const p of enePositions) {
      if (p < 1 || p >= chainLen) {
        throw new ParseError(`烯/炔位置 ${p} 超出可成键范围（1~${chainLen - 1}）`, '双键位置 p 表示第 p 与第 p+1 个碳之间');
      }
    }
    extraEne = { positions: enePositions, bond: seg.ene };
    // fg 位次：parentText 去掉 [stem][烯/炔] 后
    const afterEne = parentText.slice(1 + seg.ene.length);
    const fgLocMatch = afterEne.match(/^-?([0-9一二三四五六七八九十,，]+)-/);
    if (fgLocMatch) parentPositions = parsePositionString(fgLocMatch[1]);
  } else if (cyclic && (seg.suffix === '烯' || seg.suffix === '炔')) {
    // 环烯/环炔：双键位次——显式位次（"1,3-环戊二烯" 的 "1,3-" 是双键位次）
    // 或缺省（环己烯 [1]；环二烯交替 [1,3]，如环戊二烯）；前缀其余部分归取代基
    const posOnly = prefixText.match(/^([0-9一二三四五六七八九十,，]+)-$/);
    if (posOnly) {
      parentPositions = parsePositionString(posOnly[1]);
      realPrefix = '';
    } else {
      parentPositions = defaultFgPositions(seg.suffix, chainLen, seg.multiplier);
      realPrefix = prefixText; // 1-甲基环己烯 的 1-甲基 归取代基
    }
  } else {
    // 父体位置前缀：位于词干之前、prefixText 尾部（如 "1,3-丁二烯" 的 "1,3-"、"3-甲基-1-丁醇" 的 "1-"）
    const parentPosMatch = prefixText.match(/([0-9一二三四五六七八九十,，]+)-$/);
    if (parentPosMatch) {
      parentPositions = parsePositionString(parentPosMatch[1]);
      // 去掉位置组及其分隔符 '-'
      realPrefix = prefixText.slice(0, parentPosMatch.index).replace(/-$/, '');
    }
  }

  const suffix = seg.suffix;

  // 校验倍数与链长
  if (suffix === '苯' || suffix === '酚') {
    // 由 parseBenzene 处理；到此处说明是 环X苯 之类非法组合
    throw new ParseError(`芳香族名称格式有误「${s}」`);
  }
  if (cyclic) {
    // 环烷/环烯：链长即环大小
    if (suffix === '醇' || suffix === '醛' || suffix === '酸' || suffix === '酮') {
      // 环醇等少见，暂不支持
    }
  }

  // 官能团位次
  let fgPositions = parentPositions;
  if (suffixNeedsPosition(suffix) && fgPositions.length === 0) {
    fgPositions = defaultFgPositions(suffix, chainLen, seg.multiplier);
  }
  if (fgPositions.length > 0) {
    validatePositions(fgPositions, chainLen, `${seg.stem}${suffix}`);
    // 烯/炔 位置必须 < 链长（双键连接 p 与 p+1）
    if (suffix === '烯' || suffix === '炔') {
      for (const p of fgPositions) {
        if (p >= chainLen) {
          throw new ParseError(`双键/三键位置 ${p} 超出可成键范围（最多 ${chainLen - 1}）`, '双键位置 p 表示第 p 与第 p+1 个碳之间');
        }
      }
    }
    // 酮：羰基碳需两个相邻碳（位置 2..链长-1）
    if (suffix === '酮') {
      for (const p of fgPositions) {
        if (p < 2 || p > chainLen - 1) {
          throw new ParseError(`酮的羰基位置 ${p} 不合法`, '酮羰基应在主链内部（2 号位到倒数第 2 位之间）');
        }
      }
    }
  }

  const parent: ParsedParent = {
    stem: seg.stem,
    chainLen,
    suffix,
    multiplier: seg.multiplier,
    positions: fgPositions,
    cyclic,
    benzene: false,
    extraEne,
    oxo: oxoPositions.length ? oxoPositions : undefined,
  };

  // 氧代位置校验：羰基在链内（2..链长-1，1 位已被官能团占据）
  if (parent.oxo) {
    for (const p of parent.oxo) {
      if (p < 2 || p > chainLen - 1) {
        throw new ParseError(`氧代位置 ${p} 不合法`, '氧代羰基应在主链内部（2 号位到倒数第 2 位之间）');
      }
    }
  }

  const substituents = parsePrefixGroups(realPrefix);

  // 校验取代基位置
  for (const sub of substituents) {
    if (sub.positions.length > 0) {
      validatePositions(sub.positions, chainLen, `${seg.stem}${suffix}主链`);
    }
    // 若位置为空，builder 负责分配默认位置
  }

  return {
    kind: 'systematic',
    raw,
    normalized: s,
    parent,
    substituents,
    nSubstituents: nSubstituents.length ? nSubstituents : undefined,
  };
}

/** 解析酰胺 N 取代基前缀：'N,N-二甲基-' / 'N-甲基-'（附着在酰胺 N 上，非链碳） */
function parseAmideNPrefix(prefix: string): { nSubs: ParsedSubstituent[]; rest: string } {
  const nSubs: ParsedSubstituent[] = [];
  let rest = prefix;
  while (/^N(?:,N)*[-]/.test(rest)) {
    const m = rest.match(/^(N(?:,N)*)-/);
    rest = rest.slice(m![0].length);
    const tokMatch = rest.match(/^([^-]+)/);
    if (!tokMatch) {
      throw new ParseError(`N-取代基标记后缺少基团名「${prefix}」`, '酰胺 N 取代基形如：N-甲基、N,N-二甲基');
    }
    const { mult, name } = parseSubstituentToken(tokMatch[1]);
    nSubs.push({ name, positions: [], count: mult });
    rest = rest.slice(tokMatch[1].length).replace(/^-/, '');
  }
  return { nSubs, rest };
}

/** 稠环芳烃：'萘' / '1-甲基萘' / '2-萘酚' / '蒽' / '菲' */
function parseFusedAromatic(s: string, raw: string): ParsedResult | null {
  const baseMatch = s.match(/(萘|蒽|菲)(酚)?$/);
  if (!baseMatch) return null;
  const base = baseMatch[1];
  const isPhenol = baseMatch[2] === '酚';
  const prefix = s.slice(0, baseMatch.index);
  const mk = (substituents: ParsedSubstituent[]): ParsedResult => ({
    kind: 'fused',
    raw,
    normalized: s,
    fused: { base, substituents },
  });
  if (!prefix) {
    // '萘' / '蒽' / '菲'；'萘酚' 缺位次 → 羟基@1
    return mk(isPhenol ? [{ name: '羟基', positions: [1], count: 1 }] : []);
  }
  if (isPhenol && /^[0-9一二三四五六七八九十,，]+-$/.test(prefix)) {
    // '2-萘酚'：位次即酚羟基位
    const pos = parsePositionString(prefix.slice(0, -1));
    return mk([{ name: '羟基', positions: pos, count: pos.length }]);
  }
  // '1-甲基萘' / '2-甲基萘'
  return mk(parsePrefixGroups(prefix));
}

/** 主入口：解析中文命名 */
export function parseName(raw: string): ParsedResult {
  const normalized = raw.trim();
  if (normalized.length === 0) {
    throw new ParseError('请输入名称', '例如：2-甲基丙烷、乙醇、乙酸乙酯');
  }
  // 顺式/反式 前缀：作为可忽略别名（结构不变；反向命名不输出 Z/E 标记）
  // 支持：反式-2-丁烯 / 顺式2-丁烯 / 反-2-丁烯 / 顺-2-丁烯
  let body = normalized;
  const ctMatch = normalized.match(/^(顺式|反式)(?:-)?/);
  if (ctMatch) {
    body = normalized.slice(ctMatch[0].length);
  } else {
    const ct2 = normalized.match(/^(顺|反)-/);
    if (ct2) body = normalized.slice(ct2[0].length);
  }
  // 俗名
  const common = COMMON_NAMES[body];
  if (common) {
    return {
      kind: 'common',
      raw,
      normalized: body,
      systematicName: common.systematicName,
      smiles: common.smiles,
    };
  }
  // 正/异/新 前缀的烷（不在俗名表时再尝试）
  const zheng = body.match(/^正([甲乙丙丁戊己庚辛壬癸]烷)$/);
  if (zheng) {
    return {
      kind: 'systematic',
      raw,
      normalized: body,
      parent: { stem: zheng[1][0], chainLen: STEM_LEN[zheng[1][0]], suffix: '烷', multiplier: 1, positions: [], cyclic: false, benzene: false },
      substituents: [],
    };
  }
  // 稠环芳烃（萘/蒽/菲 及 1-甲基萘、2-萘酚）
  const fused = parseFusedAromatic(body, raw);
  if (fused) return fused;
  // 酯
  const ester = parseEster(body, raw);
  if (ester) return ester;
  // 醚
  const ether = parseEther(body, raw);
  if (ether) return ether;
  // 系统名
  return parseSystematicCore(body, raw);
}

export { LEN_STEM };
