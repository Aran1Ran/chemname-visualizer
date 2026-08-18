/**
 * 批 A 验收：正向命名修复/扩展锚点矩阵（后端交接）
 * 胺类（BUG-001）/芳香酸酯（BUG-002）/环二烯（BUG-B2）/三氯乙烯（BUG-B3）/
 * 多苯环正向（MISSING-001）/苯二甲酸（MISSING-003）/均三甲苯（MISSING-004）/
 * 羟基酸氨基酸结构等价（MISSING-005）/四氯化碳（MISSING-006）。
 * 注：联苯/二苯甲烷反向命名待批 B（本批仅正向；语料 BUG-A3 it.fails 保持）。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseAndBuild } from '../src/core/naming/pipeline';
import { formulaOfGraph, sameGraph } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { judgeAnswer } from '../src/core/practice/judge';
import { initRDKit, parseSmiles as rdParse } from '../src/core/rdkit';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

/** 解析并断言分子式，返回 parseAndBuild 结果（含 smiles） */
function build(name: string, formula: string) {
  const r = parseAndBuild(name);
  expect(r.ok, `${name} 解析失败: ${r.error?.message}`).toBe(true);
  expect(formulaOfGraph(r.built!.graph), `${name} 分子式`).toBe(formula);
  return r;
}

/** RDKit canonical 断言 */
async function canonOf(r: { smiles: string | null }, expectCanon: string) {
  const rr = await rdParse(r.smiles!);
  expect(rr.ok, r.smiles ?? 'smiles 为空').toBe(true);
  if (rr.ok) expect(rr.canonical, r.smiles ?? '').toBe(expectCanon);
}

describe('批A · 胺类（BUG-001）', () => {
  const CASES: Array<{ name: string; formula: string; canonical: string }> = [
    { name: '甲胺', formula: 'CH5N', canonical: 'CN' },
    { name: '乙胺', formula: 'C2H7N', canonical: 'CCN' },
    { name: '二甲胺', formula: 'C2H7N', canonical: 'CNC' },
    { name: '三甲胺', formula: 'C3H9N', canonical: 'CN(C)C' },
    { name: '己二胺', formula: 'C6H16N2', canonical: 'NCCCCCCN' },
  ];
  for (const c of CASES) {
    it(`${c.name} → ${c.formula}（canonical ${c.canonical}）`, async () => {
      await canonOf(build(c.name, c.formula), c.canonical);
    });
  }
  it('回归：苯胺/甘氨酸/氨基乙酸 不破坏', () => {
    build('苯胺', 'C6H7N');
    build('甘氨酸', 'C2H5NO2');
    build('氨基乙酸', 'C2H5NO2');
  });
});

describe('批A · 芳香酸酯（BUG-002）', () => {
  it('苯甲酸甲酯 → C8H8O2，canonical COC(=O)c1ccccc1，判题判对', async () => {
    await canonOf(build('苯甲酸甲酯', 'C8H8O2'), 'COC(=O)c1ccccc1');
    const j = await judgeAnswer('COC(=O)c1ccccc1', '苯甲酸甲酯');
    expect(j.correct, j.feedback.join('; ')).toBe(true);
  });
  it('水杨酸甲酯 → C8H8O3', () => {
    build('水杨酸甲酯', 'C8H8O3');
  });
});

describe('批A · 环二烯（BUG-B2）与多卤烯（BUG-B3）', () => {
  it('环戊二烯/1,3-环戊二烯 → C5H6（canonical C1=CCC=C1）', async () => {
    for (const nm of ['环戊二烯', '1,3-环戊二烯']) {
      await canonOf(build(nm, 'C5H6'), 'C1=CCC=C1');
    }
  });
  it('三氯乙烯/1,1,2-三氯乙烯 → C2HCl3，不抛 TypeError（canonical ClC=C(Cl)Cl）', async () => {
    expect(() => {
      build('三氯乙烯', 'C2HCl3');
    }).not.toThrow();
    await canonOf(build('1,1,2-三氯乙烯', 'C2HCl3'), 'ClC=C(Cl)Cl');
  });
  it('四氯化碳 → CCl4（反向四氯甲烷待批B）', () => {
    build('四氯化碳', 'CCl4');
  });
});

describe('批A · 多苯环/苯二甲酸/均三甲苯（MISSING-001/003/004）', () => {
  it('联苯 → C12H10；二苯甲烷 → C13H12（正向；反向待批B）', () => {
    build('联苯', 'C12H10');
    build('二苯甲烷', 'C13H12');
  });
  it('邻/间/对苯二甲酸 → C8H6O4', () => {
    build('邻苯二甲酸', 'C8H6O4');
    build('间苯二甲酸', 'C8H6O4');
    build('对苯二甲酸', 'C8H6O4');
  });
  it('均三甲苯 → C9H12，反向 1,3,5-三甲苯', () => {
    const r = build('均三甲苯', 'C9H12');
    const n = nameGraph(r.built!.graph);
    expect(n.ok, n.error).toBe(true);
    expect(n.name).toBe('1,3,5-三甲苯');
  });
});

describe('批A · 羟基酸/氨基酸 结构等价（MISSING-005）', () => {
  it('酒石酸 ↔ 2,3-二羟基丁二酸 同构；判题判对', async () => {
    const t = parseAndBuild('酒石酸');
    const s = parseAndBuild('2,3-二羟基丁二酸');
    expect(t.ok && s.ok, `${t.error?.message} / ${s.error?.message}`).toBe(true);
    expect(sameGraph(t.built!.graph, s.built!.graph)).toBe(true);
    const j = await judgeAnswer('OC(=O)C(O)C(O)C(=O)O', '酒石酸');
    expect(j.correct, j.feedback.join('; ')).toBe(true);
  });
  it('柠檬酸 ↔ 2-羟基丙烷-1,2,3-三羧酸 同构；判题判对', async () => {
    const c = parseAndBuild('柠檬酸');
    const s = parseAndBuild('2-羟基丙烷-1,2,3-三羧酸');
    expect(c.ok && s.ok, `${c.error?.message} / ${s.error?.message}`).toBe(true);
    expect(sameGraph(c.built!.graph, s.built!.graph)).toBe(true);
    const j = await judgeAnswer('OC(=O)CC(O)(CC(=O)O)C(=O)O', '柠檬酸');
    expect(j.correct, j.feedback.join('; ')).toBe(true);
  });
  it('苯丙氨酸 → C9H11NO2；判题判对', async () => {
    build('苯丙氨酸', 'C9H11NO2');
    const j = await judgeAnswer('OC(=O)C(N)Cc1ccccc1', '苯丙氨酸');
    expect(j.correct, j.feedback.join('; ')).toBe(true);
  });
});
