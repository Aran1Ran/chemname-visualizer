/**
 * 反向练习题库 · 考纲合规审计（只读断言）
 * 说明：本文件只读校验题库数据与核心引擎的一致性，不修改功能代码与题库数据。
 *  - BANK（smilesLibrary.ts）：全链路一致性（名称→结构→RDKit canonical→反向命名）当前全部满足；
 *  - ISOMER_SETS（isomerSets.ts）：MISMATCH-001 / DUP-001 已于批H 修复
 *    （C8H10O 二甲酚组 smiles 修正，15 条 = 15 个不同结构），唯一性断言以 it.skip 预留、
 *    由测试对话评估后启用（去掉 skip 即可；断言逻辑已实现并验证）。
 *  - 唯一性判定用 graphKey（isomerEnum 去重键）+ RDKit canonical，勿用 sameGraph——
 *    弱指纹，邻乙基苯酚 vs 间乙基苯酚（度序列相同）会误报为同一结构。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseAndBuild } from '../src/core/naming/pipeline';
import { parseSmiles, formulaOfGraph } from '../src/core/chem/graph';
import { graphKey } from '../src/core/chem/isomerEnum';
import { nameGraph } from '../src/core/reverse/namer';
import { parseSmiles as rdkitParse, initRDKit } from '../src/core/rdkit';
import { BANK, LEVELS } from '../src/data/smilesLibrary';
import { ISOMER_SETS } from '../src/data/isomerSets';
import { judgeAnswer } from '../src/core/practice/judge';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

describe('题库考纲合规审计 · BANK 全链路一致性（当前满足，防回归）', () => {
  it('BANK 全部条目：名称可解析、分子式一致、结构与题库 SMILES 同构、反向命名一致', async () => {
    const issues: string[] = [];
    for (const b of BANK) {
      const p = parseAndBuild(b.name);
      if (!p.ok || !p.built) {
        issues.push(`${b.name} 无法解析: ${p.error?.message}`);
        continue;
      }
      const f = formulaOfGraph(p.built.graph);
      const fBank = formulaOfGraph(parseSmiles(b.smiles));
      if (f !== fBank) {
        issues.push(`${b.name}: 名称构建分子式 ${f} ≠ 题库分子式 ${fBank}`);
      }
      const rb = await rdkitParse(p.smiles!);
      const rbk = await rdkitParse(b.smiles);
      const canonBuilt = rb.ok ? rb.canonical : null;
      const canonBank = rbk.ok ? rbk.canonical : null;
      if (canonBuilt !== canonBank) {
        issues.push(`${b.name}: 名称构建结构 ${canonBuilt} ≠ 题库结构 ${canonBank}`);
      }
      const n = nameGraph(p.built.graph);
      if (!n.ok || n.name !== b.name) {
        issues.push(`${b.name}: 反向命名 ${n.ok ? n.name : n.error} ≠ 题库名`);
      }
    }
    expect(issues).toEqual([]);
  }, 120000);

  it('BANK 无重复 SMILES / 无跨级同结构', () => {
    const seen = new Map<string, string[]>();
    for (const b of BANK) {
      const list = seen.get(b.smiles) ?? [];
      list.push(`L${b.level}:${b.name}`);
      seen.set(b.smiles, list);
    }
    for (const [s, list] of seen) {
      expect(list.length, `重复 SMILES ${s}: ${list.join(', ')}`).toBe(1);
    }
  });
});

describe('题库考纲合规审计 · ISOMER_SETS（MISMATCH-001/DUP-001 已修复，唯一性断言启用）', () => {
  it('C8H10O 组 15 条应为 15 个不同结构（graphKey 互异，批H 修复后启用）', () => {
    const set = ISOMER_SETS.find((s) => s.key === 'C8H10O')!;
    expect(set.isomers).toHaveLength(15);
    const keys = set.isomers.map((e) => graphKey(parseSmiles(e.smiles)));
    expect(new Set(keys).size).toBe(15);
  });

  it('C8H10O 组 15 条分子式均为 C8H10O 且 RDKit canonical 互异（真 2,4-/3,4-二甲酚在列，批H 修复后启用）', async () => {
    const set = ISOMER_SETS.find((s) => s.key === 'C8H10O')!;
    const canon: string[] = [];
    for (const e of set.isomers) {
      expect(formulaOfGraph(parseSmiles(e.smiles)), e.name).toBe('C8H10O');
      const r = await rdkitParse(e.smiles);
      expect(r.ok, `${e.name} ${e.smiles}`).toBe(true);
      if (r.ok) canon.push(r.canonical);
    }
    expect(new Set(canon).size).toBe(15);
    // 真 2,4-/3,4-二甲酚（批H 修正后应存在）
    const c24 = await rdkitParse('Oc1c(C)cc(C)cc1');
    const c34 = await rdkitParse('Oc1ccc(C)c(C)c1');
    expect(c24.ok && c34.ok).toBe(true);
    if (c24.ok) expect(canon).toContain(c24.canonical);
    if (c34.ok) expect(canon).toContain(c34.canonical);
  });
});

describe('题库考纲合规审计 · ISOMER_SETS 全链路回灌（批H3：11 条位次式展示名已实现，全部转正式）', () => {
  // 可回灌解析：邻/间/对乙基苯酚 + 苯乙醚
  const OK: Array<[string, string]> = [
    ['邻乙基苯酚', 'Oc1ccccc1CC'],
    ['间乙基苯酚', 'Oc1cccc(CC)c1'],
    ['对乙基苯酚', 'Oc1ccc(CC)cc1'],
    ['苯乙醚', 'CCOc1ccccc1'],
  ];
  for (const [name, smiles] of OK) {
    it(`${name}：回灌解析且与 smiles 同构（graphKey）`, () => {
      const r = parseAndBuild(name);
      expect(r.ok, `${name}: ${r.error?.message}`).toBe(true);
      expect(graphKey(r.built!.graph)).toBe(graphKey(parseSmiles(smiles)));
    });
  }
  // 位次式展示名（MISMATCH-002）：批H3 已实现，去 skip 转正式（解析 + graphKey 同构 + 反向=展示名）
  const POS: Array<[string, string]> = [
    ['2,3-二甲酚', 'Cc1cccc(O)c1C'],
    ['2,4-二甲酚', 'Oc1c(C)cc(C)cc1'],
    ['2,5-二甲酚', 'Cc1cc(O)c(C)cc1'],
    ['2,6-二甲酚', 'Cc1cccc(C)c1O'],
    ['3,4-二甲酚', 'Oc1ccc(C)c(C)c1'],
    ['3,5-二甲酚', 'Cc1cc(O)cc(C)c1'],
    ['邻甲基苯甲醚', 'COc1ccccc1C'],
    ['间甲基苯甲醚', 'COc1cccc(C)c1'],
    ['对甲基苯甲醚', 'COc1ccc(C)cc1'],
    ['苯乙醇', 'OCCc1ccccc1'],
    ['1-苯乙醇', 'CC(O)c1ccccc1'],
  ];
  for (const [name, smiles] of POS) {
    it(`${name}：回灌解析 + graphKey 同构 + 反向=展示名（批H3 已实现）`, () => {
      const r = parseAndBuild(name);
      expect(r.ok, `${name}: ${r.error?.message}`).toBe(true);
      expect(graphKey(r.built!.graph)).toBe(graphKey(parseSmiles(smiles)));
      const n = nameGraph(r.built!.graph);
      expect(n.ok, `${name} 反向失败: ${n.error}`).toBe(true);
      expect(n.name, `${name} 反向`).toBe(name);
    });
  }
});

describe('题库考纲合规审计 · 位次式/完整写法等价（批H3 补强）', () => {
  it('2,6-二甲基苯酚 完整写法 ↔ 2,6-二甲酚 简写同构互逆', () => {
    const a = parseAndBuild('2,6-二甲基苯酚');
    const b = parseAndBuild('2,6-二甲酚');
    expect(a.ok && b.ok, `${a.error?.message} / ${b.error?.message}`).toBe(true);
    expect(graphKey(a.built!.graph)).toBe(graphKey(b.built!.graph));
    const n = nameGraph(a.built!.graph);
    expect(n.ok, n.error).toBe(true);
    expect(n.name).toBe('2,6-二甲酚');
  });
  it('邻/间/对乙基苯甲醚：解析 + 反向位次式（2-/3-/4-乙基苯甲醚）', () => {
    const cases: Array<[string, string]> = [
      ['邻乙基苯甲醚', '2-乙基苯甲醚'],
      ['间乙基苯甲醚', '3-乙基苯甲醚'],
      ['对乙基苯甲醚', '4-乙基苯甲醚'],
    ];
    for (const [input, reverse] of cases) {
      const r = parseAndBuild(input);
      expect(r.ok, `${input}: ${r.error?.message}`).toBe(true);
      const n = nameGraph(r.built!.graph);
      expect(n.ok, `${input} 反向失败`).toBe(true);
      expect(n.name, `${input} 反向`).toBe(reverse);
    }
  });
});

describe('题库考纲合规审计 · 俗名/系统名判题等价（alias，批H）', () => {
  it('水杨酸/甘油/乳酸/阿司匹林 与系统名 同构且判题等价', async () => {
    const pairs: Array<[string, string]> = [
      ['水杨酸', '邻羟基苯甲酸'],
      ['甘油', '丙三醇'],
      ['乳酸', '2-羟基丙酸'],
      ['阿司匹林', '乙酰水杨酸'],
    ];
    for (const [a, b] of pairs) {
      const ra = parseAndBuild(a);
      const rb = parseAndBuild(b);
      expect(ra.ok && rb.ok, `${a}/${b} 应可解析`).toBe(true);
      expect(graphKey(ra.built!.graph), `${a} 与 ${b} 应同构`).toBe(graphKey(rb.built!.graph));
      const j = await judgeAnswer(ra.smiles!, b);
      expect(j.correct, `${a} 结构判「${b}」: ${j.feedback.join(';')}`).toBe(true);
    }
  });
});

describe('题库考纲合规审计 · BANK 分级（批H H2 移题后）', () => {
  it('bankOfLevel(4/5/6/7) = 21/16/24/11（H2 移题后）', () => {
    expect(BANK.filter((b) => b.level === 4)).toHaveLength(21);
    expect(BANK.filter((b) => b.level === 5)).toHaveLength(16);
    expect(BANK.filter((b) => b.level === 6)).toHaveLength(24);
    expect(BANK.filter((b) => b.level === 7)).toHaveLength(11);
  });
  it('L4 hint 含「腈/酰胺」', () => {
    const l4 = LEVELS.find((l) => l.level === 4);
    expect(l4).toBeTruthy();
    expect(l4!.hint).toContain('腈');
    expect(l4!.hint).toContain('酰胺');
  });
});
