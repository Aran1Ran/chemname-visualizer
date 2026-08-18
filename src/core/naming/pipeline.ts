/**
 * 名称 → 结构 管线：parse → build → RDKit 校验/规范化 → 分子式
 */
import { parseName, ParseError, type ParsedResult } from './parser';
import { buildFromParsed, type BuiltMolecule } from './builder';
import { normalizeName } from './normalize';
import { formulaOfGraph, parseSmiles } from '../chem/graph';
import { parseSmiles as rdkitParse, initRDKit } from '../rdkit';

export interface NameResult {
  ok: boolean;
  raw: string;
  normalized: string;
  parsed: ParsedResult | null;
  built: BuiltMolecule | null;
  smiles: string | null;
  canonicalSmiles: string | null;
  formula: string | null;
  rdkitValid: boolean;
  error: { message: string; hint?: string } | null;
}

/** 同步解析+构建（不依赖 RDKit）；失败返回带错误的结果 */
export function parseAndBuild(raw: string): {
  ok: boolean;
  normalized: string;
  parsed: ParsedResult | null;
  built: BuiltMolecule | null;
  smiles: string | null;
  error: { message: string; hint?: string } | null;
} {
  // 统一入口规范化：全角→半角、去空白、位置前缀中文数字→阿拉伯（增强输入容错）
  const normalized = normalizeName(raw);
  try {
    const parsed = parseName(normalized);
    const built = buildFromParsed(parsed);
    return { ok: true, normalized, parsed, built, smiles: built.smiles, error: null };
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, normalized, parsed: null, built: null, smiles: null, error: { message: e.message, hint: e.hint } };
    }
    return {
      ok: false,
      normalized,
      parsed: null,
      built: null,
      smiles: null,
      error: { message: e instanceof Error ? e.message : String(e) },
    };
  }
}

/** 完整管线（含 RDKit 校验与规范化） */
export async function nameToStructure(raw: string): Promise<NameResult> {
  const base = parseAndBuild(raw);
  if (!base.ok || !base.smiles) {
    return {
      ok: false,
      raw,
      normalized: base.normalized,
      parsed: null,
      built: null,
      smiles: null,
      canonicalSmiles: null,
      formula: null,
      rdkitValid: false,
      error: base.error,
    };
  }
  try {
    await initRDKit();
    const parsed = await rdkitParse(base.smiles);
    if (!parsed.ok) {
      return {
        ok: false,
        raw,
        normalized: base.normalized,
        parsed: base.parsed,
        built: base.built,
        smiles: base.smiles,
        canonicalSmiles: null,
        formula: formulaOfGraph(base.built!.graph),
        rdkitValid: false,
        error: { message: '构建的结构无法通过化学规则校验，请检查名称', hint: parsed.reason },
      };
    }
    // 用图结构计算分子式（RDKit 侧公式兜底由 formulaOf 负责，此处用本地计算保证一致性）
    const formula = formulaOfGraph(base.built!.graph);
    return {
      ok: true,
      raw,
      normalized: base.normalized,
      parsed: base.parsed,
      built: base.built,
      smiles: base.smiles,
      canonicalSmiles: parsed.canonical,
      formula,
      rdkitValid: true,
      error: null,
    };
  } catch (e) {
    return {
      ok: false,
      raw,
      normalized: base.normalized,
      parsed: base.parsed,
      built: base.built,
      smiles: base.smiles,
      canonicalSmiles: null,
      formula: base.built ? formulaOfGraph(base.built.graph) : null,
      rdkitValid: false,
      error: { message: '化学引擎初始化失败: ' + (e instanceof Error ? e.message : String(e)) },
    };
  }
}

/** 校验某个 SMILES 是否可被 RDKit 解析并返回规范 SMILES */
export async function validateSmiles(smiles: string): Promise<{ ok: boolean; canonical: string | null; reason?: string }> {
  try {
    await initRDKit();
    const r = await rdkitParse(smiles);
    return r.ok ? { ok: true, canonical: r.canonical } : { ok: false, canonical: null, reason: r.reason };
  } catch {
    return { ok: false, canonical: null, reason: 'RDKit 不可用' };
  }
}
