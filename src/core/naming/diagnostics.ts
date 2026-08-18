/**
 * 错误诊断：输入名称 vs 按规则重导出的正确名称
 * - 母体不是最长碳链（2-乙基丙烷 → 2-甲基丁烷）
 * - 编号方向不对（3-甲基丁烷 → 2-甲基丁烷）
 * - 1 号位取代基并入主链（1-甲基丙烷 → 丁烷）
 * - 取代基名称/数量不符
 */
import { parseAndBuild } from './pipeline';
import { normalizeName } from './normalize';
import { nameGraph, type NamedResult } from '../reverse/namer';
import { type ParsedResult, type ParsedSubstituent } from './parser';

export type DiagnosisType =
  | 'ok'
  | 'not-longest-chain'
  | 'numbering'
  | 'position-1-substituent'
  | 'substituent-mismatch'
  | 'parse-error'
  | 'invalid-structure';

export interface Diagnosis {
  type: DiagnosisType;
  isCorrect: boolean;
  inputName: string;
  normalized: string;
  correctName: string | null;
  message: string;
  /** 检查项列表（补氢检查的四项核对） */
  checks: Array<{ label: string; ok: boolean; detail: string }>;
  /** 学生声明的母体链原子（按位次） */
  inputChainIndices: number[] | null;
  /** 按规则重编号的母体链原子 */
  correctChainIndices: number[] | null;
  /** 输入声明的取代基 */
  inputSubstituents: Array<{ name: string; positions: number[] }> | null;
  /** 规则重编号后的取代基 */
  correctSubstituents: Array<{ name: string; positions: number[] }> | null;
  /** 供展示：结构的 SMILES（错误结构与正确结构是同一分子，编号不同） */
  smiles: string | null;
  named: NamedResult | null;
  parsed: ParsedResult | null;
}

const STEM_CN: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八' };

function formatSubs(subs: Array<{ name: string; positions: number[] }>): string {
  return subs
    .map((g) => `${g.positions.join(',')}位${g.name}`)
    .join('、');
}

export function diagnose(inputRaw: string): Diagnosis {
  const base = {
    inputName: inputRaw,
    normalized: normalizeName(inputRaw),
    correctName: null as string | null,
    message: '',
    checks: [] as Array<{ label: string; ok: boolean; detail: string }>,
    inputChainIndices: null as number[] | null,
    correctChainIndices: null as number[] | null,
    inputSubstituents: null as Array<{ name: string; positions: number[] }> | null,
    correctSubstituents: null as Array<{ name: string; positions: number[] }> | null,
    smiles: null as string | null,
    named: null as NamedResult | null,
    parsed: null as ParsedResult | null,
  };

  const r = parseAndBuild(inputRaw);
  if (!r.ok || !r.built || !r.smiles) {
    return {
      type: 'parse-error',
      isCorrect: false,
      ...base,
      message: r.error?.message ?? '无法解析该名称',
    };
  }

  const graph = r.built.graph;
  const named = nameGraph(graph);
  if (!named.ok) {
    return {
      type: 'invalid-structure',
      isCorrect: false,
      ...base,
      smiles: r.smiles,
      named,
      parsed: r.parsed,
      message: '该名称描述的结构不符合命名规则，无法按 IUPAC 规则编号。',
    };
  }

  const inputName = normalizedNameOfInput(r.parsed!, inputRaw.trim());
  const isCorrect = inputName === named.name;
  const inputSubs = subsOfParsed(r.parsed!);
  const correctSubs = named.substituentGroups.map((g) => ({ name: g.name, positions: g.positions }));

  base.smiles = r.smiles;
  base.named = named;
  base.parsed = r.parsed;
  base.inputChainIndices = r.built.chainAtomIndices;
  base.correctChainIndices = named.chainAtomIndices;
  base.inputSubstituents = inputSubs;
  base.correctSubstituents = correctSubs;
  base.correctName = named.name;

  if (isCorrect) {
    return {
      type: 'ok',
      isCorrect: true,
      ...base,
      message: `命名正确：「${named.name}」`,
      checks: [
        { label: '最长链', ok: true, detail: `主链为 ${named.parentChainLen} 个碳的${named.suffix}` },
        { label: '编号', ok: true, detail: '位次最小，编号方向正确' },
        { label: '取代基', ok: true, detail: inputSubs.length ? formatSubs(inputSubs) : '无取代基' },
        { label: '结构', ok: true, detail: '名称与结构一致' },
      ],
    };
  }

  // 分类诊断
  const declaredLen = r.parsed!.kind === 'systematic' ? r.parsed!.parent.chainLen : r.parsed!.kind === 'ester' ? r.parsed!.ester.acidParent.chainLen : named.parentChainLen;
  const actualLen = named.parentChainLen;
  const checks: Diagnosis['checks'] = [];
  checks.push({ label: '最长链', ok: declaredLen >= actualLen, detail: declaredLen < actualLen ? `您声明的主链 ${declaredLen} 个碳，实际最长链 ${actualLen} 个碳` : `主链 ${actualLen} 个碳 ✓` });

  if (declaredLen < actualLen) {
    // 母体不是最长碳链
    const hasPos1 = inputSubs.some((g) => g.positions.includes(1));
    const hasLongAlkyl = inputSubs.some((g) => g.name.endsWith('基') && g.name !== '甲基');
    if (hasPos1) {
      const sub = inputSubs.find((g) => g.positions.includes(1))!;
      checks.push({ label: '编号', ok: false, detail: `${sub.name}在 1 号位——1 号位取代基应并入主链` });
      return {
        type: 'position-1-substituent',
        isCorrect: false,
        ...base,
        message: `1号位不能有取代基。如果${sub.name}在1号位，它实际上就是主链的一部分，该结构为${named.name}，无需编号。`,
        checks,
      };
    }
    if (hasLongAlkyl) {
      const sub = inputSubs.find((g) => g.name.endsWith('基') && g.name !== '甲基')!;
      return {
        type: 'not-longest-chain',
        isCorrect: false,
        ...base,
        message: `您选择的母体不是最长碳链。最长链实际有 ${actualLen} 个碳；「${sub.name}」的前${sub.name === '乙基' ? 1 : 2}个碳应并入主链，剩余支链为${correctSubs[0]?.name ?? '甲基'}。正确名称应为「${named.name}」。`,
        checks,
      };
    }
    return {
      type: 'not-longest-chain',
      isCorrect: false,
      ...base,
      message: `您选择的母体不是最长碳链。如果把支链并入主链，主链实际有 ${actualLen} 个碳。正确名称应为「${named.name}」。`,
      checks,
    };
  }

  if (declaredLen === actualLen) {
    // 编号/取代基问题
    const subDiff = compareSubs(inputSubs, correctSubs);
    if (subDiff.kind === 'numbering') {
      checks.push({ label: '编号', ok: false, detail: subDiff.detail });
      return {
        type: 'numbering',
        isCorrect: false,
        ...base,
        message: `您选择的母体不是最长碳链。如果把支链并入主链，主链实际有 ${actualLen} 个碳，${correctSubs[0] ? correctSubs[0].name + '在' + correctSubs[0].positions.join(',') + '号位' : ''}。正确名称应为「${named.name}」。`,
        checks,
      };
    }
    checks.push({ label: '取代基', ok: false, detail: subDiff.detail });
    return {
      type: 'substituent-mismatch',
      isCorrect: false,
      ...base,
      message: `取代基与命名规则不符：${subDiff.detail}。正确名称应为「${named.name}」。`,
      checks,
    };
  }

  return {
    type: 'substituent-mismatch',
    isCorrect: false,
    ...base,
    message: `名称与结构不一致，正确名称应为「${named.name}」。`,
    checks,
  };
}

/** 输入名称的规范形式（俗名 → 系统名） */
function normalizedNameOfInput(parsed: ParsedResult, normalized: string): string {
  if (parsed.kind === 'common') return parsed.systematicName;
  return normalized;
}

function subsOfParsed(parsed: ParsedResult): Array<{ name: string; positions: number[] }> {
  if (parsed.kind === 'systematic') {
    return parsed.substituents.map((g: ParsedSubstituent) => ({
      name: g.name,
      positions: g.positions.length ? g.positions : defaultPositionsFor(parsed.parent.chainLen, g.count),
    }));
  }
  if (parsed.kind === 'ester') {
    return parsed.ester.acidSubstituents.map((g: ParsedSubstituent) => ({
      name: g.name,
      positions: g.positions.length ? g.positions : defaultPositionsFor(parsed.ester.acidParent.chainLen, g.count),
    }));
  }
  return [];
}

function defaultPositionsFor(chainLen: number, count: number): number[] {
  const out: number[] = [];
  let p = 2;
  while (out.length < count && p <= chainLen) {
    out.push(p);
    if (out.length < count) out.push(p);
    p++;
  }
  while (out.length < count) out.push(chainLen);
  return out;
}

type SubDiff = { kind: 'same' | 'numbering' | 'mismatch'; detail: string };

function compareSubs(
  input: Array<{ name: string; positions: number[] }>,
  correct: Array<{ name: string; positions: number[] }>
): SubDiff {
  const inKey = input
    .flatMap((g) => g.positions.map((p) => `${p}:${g.name}`))
    .sort()
    .join(';');
  const okKey = correct
    .flatMap((g) => g.positions.map((p) => `${p}:${g.name}`))
    .sort()
    .join(';');
  if (inKey === okKey) return { kind: 'same', detail: '' };
  // 仅编号不同：相同的取代基集合，不同位次
  const inNames = [...input].sort((a, b) => a.name.localeCompare(b.name)).map((g) => g.name).join('|');
  const okNames = [...correct].sort((a, b) => a.name.localeCompare(b.name)).map((g) => g.name).join('|');
  if (inNames === okNames) {
    return { kind: 'numbering', detail: '位次不是最小，应从离取代基更近的一端编号' };
  }
  return { kind: 'mismatch', detail: `您写的取代基为「${formatSubs(input)}」，按规则应为「${formatSubs(correct)}」` };
}

export { STEM_CN };
