/**
 * 包 C（第五节考试结构库 + 多官能团优先级深度）验收
 * C2 多官能团锚点（7+1）互逆+判题、优先级负例、结构库判题、糖类分子式。
 * C1 banknames 一致性由 banknames.test.ts 自动覆盖（遍历全部 BANK 含 9 条新条目），
 * fgExamples 命中由 fgExamples.test.ts 自动覆盖（SMARTS 变更），本文件不重复。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseAndBuild } from '../src/core/naming/pipeline';
import { parseSmiles, formulaOfGraph } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { judgeAnswer } from '../src/core/practice/judge';
import { FORMULA_ONLY } from '../src/data/formulaOnly';
import { initRDKit } from '../src/core/rdkit';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

/** 解析并断言分子式，返回 built */
function build(name: string, formula: string) {
  const r = parseAndBuild(name);
  expect(r.ok, `${name} 解析失败: ${r.error?.message}`).toBe(true);
  expect(formulaOfGraph(r.built!.graph), `${name} 分子式`).toBe(formula);
  return r.built!;
}

/** 互逆：名称 → 结构 → 反向命名（可选期望反向名） */
function roundTrip(name: string, formula: string, expectName?: string): string {
  const built = build(name, formula);
  const n = nameGraph(built.graph);
  expect(n.ok, `${name} 反向命名失败: ${n.error}`).toBe(true);
  if (expectName !== undefined) expect(n.name, `${name} 反向名`).toBe(expectName);
  return n.name;
}

describe('包C · C2 多官能团深度锚点（7+1）', () => {
  const CASES: Array<{ name: string; formula: string; smiles: string }> = [
    { name: '2-羟基丙酸甲酯', formula: 'C4H8O3', smiles: 'CC(O)C(=O)OC' },
    { name: '氯乙酸', formula: 'C2H3ClO2', smiles: 'ClCC(=O)O' },
    { name: '2-氯丙酸', formula: 'C3H5ClO2', smiles: 'CC(Cl)C(=O)O' },
    { name: '2-氨基丙醛', formula: 'C3H7NO', smiles: 'CC(N)C=O' },
    { name: '4-羟基-2-丁酮', formula: 'C4H8O2', smiles: 'CC(=O)CCO' },
    { name: '邻硝基苯酚', formula: 'C6H5NO3', smiles: 'O=[N+]([O-])c1ccccc1O' },
    { name: '2-甲基-2-丙烯酸甲酯', formula: 'C5H8O2', smiles: 'C=C(C)C(=O)OC' },
  ];
  for (const c of CASES) {
    it(`${c.name} → ${c.formula} 互逆 + 判题判对`, async () => {
      roundTrip(c.name, c.formula);
      const j = await judgeAnswer(c.smiles, c.name);
      expect(j.correct, `${c.name} 判题: ${j.feedback.join('; ')}`).toBe(true);
    });
  }
  it('甲基丙烯酸甲酯（俗名）→ 结构 C5H8O2，反向系统名 2-甲基-2-丙烯酸甲酯', () => {
    roundTrip('甲基丙烯酸甲酯', 'C5H8O2', '2-甲基-2-丙烯酸甲酯');
  });
});

describe('包C · C2 优先级负例（官能团优先级：酸 > 醛）', () => {
  it('2-羟基丙酸结构 对「2-羟基丙醛」→ 判错且反馈含官能团优先级提示', async () => {
    const j = await judgeAnswer('CC(O)C(=O)O', '2-羟基丙醛');
    expect(j.correct).toBe(false);
    expect(j.feedback.some((f) => f.includes('羧酸')), JSON.stringify(j.feedback)).toBe(true);
    expect(j.errorTypes).toContain('官能团');
  });
});

describe('包C · 结构库（考试常见分子，BANK 判题）', () => {
  const CASES: Array<{ name: string; smiles: string }> = [
    { name: '氯乙烯', smiles: 'C=CCl' },
    { name: '乙酸乙烯酯', smiles: 'CC(=O)OC=C' },
    { name: '甲基丙烯酸甲酯', smiles: 'C=C(C)C(=O)OC' },
    { name: '甲酸乙酯', smiles: 'O=COCC' },
    { name: '乙酸异戊酯', smiles: 'CC(=O)OCCC(C)C' },
    { name: '氯乙酸', smiles: 'ClCC(=O)O' },
    { name: '甲醛', smiles: 'C=O' },
    { name: '甘油', smiles: 'OCC(O)CO' },
    { name: '葡萄糖', smiles: 'O=CC(O)C(O)C(O)C(O)CO' },
    { name: '果糖', smiles: 'OCC(=O)C(O)C(O)C(O)CO' },
  ];
  for (const c of CASES) {
    it(`判题：${c.name} 判对`, async () => {
      const j = await judgeAnswer(c.smiles, c.name);
      expect(j.correct, `${c.name} 判题: ${j.feedback.join('; ')}`).toBe(true);
    });
  }
});

describe('包C · 糖类分子式', () => {
  it('葡萄糖/果糖 链式分子式 C6H12O6', () => {
    expect(formulaOfGraph(parseSmiles('O=CC(O)C(O)C(O)C(O)CO'))).toBe('C6H12O6');
    expect(formulaOfGraph(parseSmiles('OCC(=O)C(O)C(O)C(O)CO'))).toBe('C6H12O6');
  });
  it('蔗糖/麦芽糖 C12H22O11、淀粉/纤维素 (C6H10O5)n 以数据形式存在（独立表 FORMULA_ONLY，仅展示不判题）', () => {
    const names = FORMULA_ONLY.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['蔗糖', '麦芽糖', '淀粉', '纤维素']));
    const by = (n: string) => FORMULA_ONLY.find((e) => e.name === n)!;
    expect(by('蔗糖').formula).toBe('C12H22O11');
    expect(by('麦芽糖').formula).toBe('C12H22O11');
    expect(by('淀粉').formula).toBe('(C6H10O5)n');
    expect(by('纤维素').formula).toBe('(C6H10O5)n');
    // 分子式层面数据不携带 SMILES（不参与结构判题）
    for (const e of FORMULA_ONLY) expect(e.note.length).toBeGreaterThan(0);
  });
});
