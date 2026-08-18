/**
 * 批 2 验收：#8 新名称识别（甲酸苄酯/乙酰乙酸乙酯/DMF/顺反丁烯）、
 * #5 L6/L7 题库、#10 环烷编号次序、#3b tutorial 文案。
 * 判题以结构等价为准（俗名/系统名/书写顺序均可）；反向命名教材写法（无 Z/E）。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseAndBuild } from '../src/core/naming/pipeline';
import { parseSmiles, formulaOfGraph, sameGraph } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { judgeAnswer } from '../src/core/practice/judge';
import { BANK, LEVELS, bankOfLevel } from '../src/data/smilesLibrary';
import { tutorialTexts } from '../src/core/naming/tutorial';
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

describe('批2 · #8 新名称识别', () => {
  it('甲酸苯甲酯/甲酸苄酯：两写法判题均判对', async () => {
    expect((await judgeAnswer('O=COCc1ccccc1', '甲酸苯甲酯')).correct).toBe(true);
    expect((await judgeAnswer('O=COCc1ccccc1', '甲酸苄酯')).correct).toBe(true);
  });
  it('甲酸苯甲酯 → C8H8O2，反向统一输出甲酸苄酯；甲酸苄酯互逆', () => {
    roundTrip('甲酸苯甲酯', 'C8H8O2', '甲酸苄酯');
    roundTrip('甲酸苄酯', 'C8H8O2', '甲酸苄酯');
  });
  it('乙酰乙酸乙酯 → C6H10O3，结构 CC(=O)CC(=O)OCC；与 3-氧代丁酸乙酯 同构互逆', () => {
    const b1 = build('乙酰乙酸乙酯', 'C6H10O3');
    expect(sameGraph(b1.graph, parseSmiles('CC(=O)CC(=O)OCC')), '乙酰乙酸乙酯结构').toBe(true);
    expect(nameGraph(b1.graph).ok).toBe(true);
    const b2 = build('3-氧代丁酸乙酯', 'C6H10O3');
    expect(sameGraph(b1.graph, b2.graph), '两写法应同构').toBe(true);
    roundTrip('3-氧代丁酸乙酯', 'C6H10O3', '3-氧代丁酸乙酯');
  });
  it('乙酰乙酸乙酯/3-氧代丁酸乙酯 判题均判对', async () => {
    expect((await judgeAnswer('CC(=O)CC(=O)OCC', '乙酰乙酸乙酯')).correct).toBe(true);
    expect((await judgeAnswer('CC(=O)CC(=O)OCC', '3-氧代丁酸乙酯')).correct).toBe(true);
  });
  it('N,N-二甲基甲酰胺 → C3H7NO 互逆，结构 CN(C)C=O', () => {
    const b = build('N,N-二甲基甲酰胺', 'C3H7NO');
    expect(sameGraph(b.graph, parseSmiles('CN(C)C=O')), 'DMF 结构').toBe(true);
    roundTrip('N,N-二甲基甲酰胺', 'C3H7NO', 'N,N-二甲基甲酰胺');
  });
  it('顺式/反式-2-丁烯（含"式"与不带"式"）：同构 CC=CC，反向 2-丁烯 且不含 顺/反/Z/E', () => {
    for (const name of ['顺式-2-丁烯', '反式-2-丁烯', '顺-2-丁烯', '反-2-丁烯']) {
      const b = build(name, 'C4H8');
      expect(sameGraph(b.graph, parseSmiles('CC=CC')), `${name} 同构`).toBe(true);
      const n = nameGraph(b.graph);
      expect(n.ok, `${name} 反向`).toBe(true);
      expect(n.name, `${name} 反向名`).toBe('2-丁烯');
      expect(n.name, `${name} 不应含 Z/E/顺/反`).not.toMatch(/顺|反|Z|E/);
    }
  });
  it('判题：顺式/反式-2-丁烯 判对', async () => {
    expect((await judgeAnswer('CC=CC', '反式-2-丁烯')).correct).toBe(true);
    expect((await judgeAnswer('CC=CC', '顺式-2-丁烯')).correct).toBe(true);
  });
  it('回归：乙酰胺 roundTrip 乙酰胺', () => {
    roundTrip('乙酰胺', 'C2H5NO', '乙酰胺');
  });
});

describe('批2 · #10 环烷编号次序（乙基 > 甲基）', () => {
  it('nameGraph(CCC1CCCC(C)C1) = 1-乙基-3-甲基环己烷', () => {
    const n = nameGraph(parseSmiles('CCC1CCCC(C)C1'));
    expect(n.ok, n.error).toBe(true);
    expect(n.name).toBe('1-乙基-3-甲基环己烷');
  });
  it('1-乙基-3-甲基环己烷 → C9H18 互逆', () => {
    roundTrip('1-乙基-3-甲基环己烷', 'C9H18', '1-乙基-3-甲基环己烷');
  });
  it('1-甲基-3-乙基环己烷：可解析、同构，反向输出 1-乙基-3-甲基环己烷', () => {
    const a = build('1-甲基-3-乙基环己烷', 'C9H18');
    const b = build('1-乙基-3-甲基环己烷', 'C9H18');
    expect(sameGraph(a.graph, b.graph), '两写法应同构').toBe(true);
    const n = nameGraph(a.graph);
    expect(n.ok).toBe(true);
    expect(n.name).toBe('1-乙基-3-甲基环己烷');
  });
  it('判题：两种写法均判对', async () => {
    expect((await judgeAnswer('CCC1CCCC(C)C1', '1-乙基-3-甲基环己烷')).correct).toBe(true);
    expect((await judgeAnswer('CCC1CCCC(C)C1', '1-甲基-3-乙基环己烷')).correct).toBe(true);
  });
  it('回归：甲基环丙烷/1,2-二甲基环丙烷/环己烯/1-甲基环己烯 互逆', () => {
    roundTrip('甲基环丙烷', 'C4H8', '甲基环丙烷');
    roundTrip('1,2-二甲基环丙烷', 'C5H10', '1,2-二甲基环丙烷');
    roundTrip('环己烯', 'C6H10', '环己烯');
    roundTrip('1-甲基环己烯', 'C7H12', '1-甲基环己烯');
  });
});

describe('批2 · #5 L6/L7 题库', () => {
  it('LEVELS 含 level 7（L7 考试结构库）', () => {
    const l7 = LEVELS.find((l) => l.level === 7);
    expect(l7).toBeTruthy();
    expect(l7!.label).toBe('L7');
    expect(l7!.hint).toContain('考试结构库');
  });
  it('迁移 11 条至 level 7（批H LEVEL-003/004 裁定：甲酸乙酯移出至 L4，邻/对羟基苯甲酸、邻乙酰氧基苯甲酸入 L7）', () => {
    const names = bankOfLevel(7).map((b) => b.name);
    for (const want of [
      '2,3,4,5,6-五羟基己醛', '1,3,4,5,6-五羟基-2-己酮',
      '乙酸乙烯酯', '2-甲基-2-丙烯酸甲酯', '乙酸异戊酯',
      '邻羟基苯甲酸', '对羟基苯甲酸', '邻乙酰氧基苯甲酸',
      '氯乙烯', '甲醛', '丙三醇',
    ]) {
      expect(names, `L7 应含「${want}」`).toContain(want);
    }
    expect(names, 'L7 不应含已移出的「甲酸乙酯」').not.toContain('甲酸乙酯');
    expect(bankOfLevel(7)).toHaveLength(11);
  });
  it('bankOfLevel(6) 每条 SMILES 含芳香碳', () => {
    for (const b of bankOfLevel(6)) {
      const g = parseSmiles(b.smiles);
      expect(g.atoms.some((a) => a.aromatic), `${b.name}（${b.smiles}）应含苯环`).toBe(true);
    }
  });
  it('苯乙烯 type = 芳香烃', () => {
    const s = BANK.find((b) => b.name === '苯乙烯');
    expect(s).toBeTruthy();
    expect(s!.type).toBe('芳香烃');
  });
  // banknames 全量一致性由 banknames.test.ts 自动覆盖（遍历全部 BANK）
});

describe('批2 · #3b tutorial 文案（与 built 图一致）', () => {
  const CASES: Array<{
    name: string;
    formula: string;
    step1Include: string;
    step1Exclude?: string;
    step3Include?: string;
    motherCount?: number;
  }> = [
    { name: '2-甲基-2-丙烯酸甲酯', formula: 'C5H8O2', step1Include: '2-甲基-2-丙烯酸', step1Exclude: '母体是丙酯', step3Include: '2 号位上连接 1 个甲基', motherCount: 1 },
    { name: '水杨酸', formula: 'C7H6O3', step1Include: '苯甲酸', step1Exclude: '母体是己酸', step3Include: '2 号位上连接 1 个羟基' },
    { name: '氯乙酸', formula: 'C2H3ClO2', step1Include: '乙酸', step3Include: '2 号位上连接 1 个氯' },
    { name: '2,4-二甲基-3-乙基戊烷', formula: 'C9H20', step1Include: '戊烷', step3Include: '倍数词「二」' },
    { name: '乙酸异戊酯', formula: 'C7H14O2', step1Include: '乙酸', step1Exclude: '母体是乙酯', step3Include: '异戊基' },
    { name: '环己烯', formula: 'C6H10', step1Include: '环己烯', step1Exclude: '母体是己烯' },
  ];
  for (const c of CASES) {
    it(`${c.name}：tutorial 每步文案位次/基团与 built 一致，step4 分子式正确`, () => {
      const r = parseAndBuild(c.name);
      expect(r.ok, r.error?.message).toBe(true);
      const n = nameGraph(r.built!.graph);
      expect(n.ok).toBe(true);
      const texts = tutorialTexts(r.built!, n);
      expect(texts.length).toBeGreaterThanOrEqual(4);
      const step1 = texts[0].text + texts[0].why;
      const step3 = texts[2].text + texts[2].why;
      expect(step1, `${c.name} step1 应含「${c.step1Include}」`).toContain(c.step1Include);
      if (c.step1Exclude) expect(step1, `${c.name} step1 不应含「${c.step1Exclude}」`).not.toContain(c.step1Exclude);
      if (c.step3Include) expect(step3, `${c.name} step3 应含「${c.step3Include}」`).toContain(c.step3Include);
      if (c.motherCount !== undefined) {
        const all = texts.map((t) => t.text + t.why).join('');
        expect((all.match(/母体是/g) ?? []).length, `${c.name} 「母体是」出现次数`).toBe(c.motherCount);
      }
      expect(texts[3].text, `${c.name} step4 应含分子式 ${c.formula}`).toContain(c.formula);
    });
  }
});
