/**
 * 核心层扩展测试：醚类命名闭环 / 环烷烃 / 双官能团（烯·炔+醇醛酮酸腈）/
 * 芳香族多取代 / 判题改进 / NMR 位移与最简比 / 数据扩展 / 结构简式
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseAndBuild } from '../src/core/naming/pipeline';
import { parseSmiles, formulaOfGraph } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { analyzeEquivalentH } from '../src/core/chem/symmetry';
import { condensedFormula } from '../src/core/chem/condensed';
import { ISOMER_SETS } from '../src/data/isomerSets';
import { REACTION_NODES, REACTION_EDGES, findPath } from '../src/data/reactionNetwork';
import { initRDKit } from '../src/core/rdkit';
import { judgeAnswer } from '../src/core/practice/judge';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

/** 名称 → 结构 → 反向命名 互逆 */
function roundTrip(name: string): string {
  const r = parseAndBuild(name);
  expect(r.ok, `${name} 解析失败: ${r.error?.message}`).toBe(true);
  const n = nameGraph(parseSmiles(r.smiles!));
  expect(n.ok, `${name} 命名失败: ${n.error}`).toBe(true);
  return n.name;
}

describe('醚类命名闭环', () => {
  const CASES: Array<{ name: string; formula: string }> = [
    { name: '乙醚', formula: 'C4H10O' },
    { name: '二甲醚', formula: 'C2H6O' },
    { name: '甲乙醚', formula: 'C3H8O' },
    { name: '甲丙醚', formula: 'C4H10O' },
    { name: '乙丙醚', formula: 'C5H12O' },
    { name: '甲基异丙基醚', formula: 'C4H10O' },
    { name: '乙基异丙基醚', formula: 'C5H12O' },
    { name: '甲基叔丁基醚', formula: 'C5H12O' },
    { name: '甲基仲丁基醚', formula: 'C5H12O' },
    { name: '甲基异丁基醚', formula: 'C5H12O' },
    { name: '苯甲醚', formula: 'C7H8O' },
    { name: '苯乙醚', formula: 'C8H10O' },
  ];
  for (const c of CASES) {
    it(`${c.name} 解析构建（${c.formula}）且图→名互逆`, () => {
      const r = parseAndBuild(c.name);
      expect(r.ok, r.error?.message).toBe(true);
      expect(formulaOfGraph(r.built!.graph)).toBe(c.formula);
      expect(roundTrip(c.name)).toBe(c.name);
    });
  }
  it('甲醚（别名）规范名为 二甲醚', () => {
    const r = parseAndBuild('甲醚');
    expect(r.ok).toBe(true);
    expect(nameGraph(parseSmiles(r.smiles!)).name).toBe('二甲醚');
  });
  it('RDKit 规范化一致（甲乙醚 → CCOC）', async () => {
    const r = parseAndBuild('甲乙醚');
    expect(r.ok).toBe(true);
    const rdkit = await import('../src/core/rdkit').then((m) => m.parseSmiles(r.smiles!));
    expect(rdkit.ok).toBe(true);
    if (rdkit.ok) expect(rdkit.canonical).toBe('CCOC');
  });
  it('判题：乙醚 对 CCOCC 判对，correctName 为 乙醚', async () => {
    const r = await judgeAnswer('CCOCC', '乙醚');
    expect(r.correct).toBe(true);
    expect(r.correctName).toBe('乙醚');
  });
  it('判题：甲丙醚 对 CCCOC 判对', async () => {
    const r = await judgeAnswer('CCCOC', '甲丙醚');
    expect(r.correct).toBe(true);
    expect(r.correctName).toBe('甲丙醚');
  });
  it('判题：甲基叔丁基醚 对 COC(C)(C)C 判对', async () => {
    const r = await judgeAnswer('COC(C)(C)C', '甲基叔丁基醚');
    expect(r.correct).toBe(true);
  });
});

describe('环烷烃命名', () => {
  const CASES: Array<{ name: string; formula: string }> = [
    { name: '环丙烷', formula: 'C3H6' },
    { name: '环丁烷', formula: 'C4H8' },
    { name: '环己烷', formula: 'C6H12' },
    { name: '甲基环丙烷', formula: 'C4H8' },
    { name: '1,1-二甲基环丙烷', formula: 'C5H10' },
    { name: '1,2-二甲基环丙烷', formula: 'C5H10' },
    { name: '乙基环丁烷', formula: 'C6H12' },
  ];
  for (const c of CASES) {
    it(`${c.name} 解析构建（${c.formula}）且图→名互逆`, () => {
      const r = parseAndBuild(c.name);
      expect(r.ok, r.error?.message).toBe(true);
      expect(formulaOfGraph(r.built!.graph)).toBe(c.formula);
      expect(roundTrip(c.name)).toBe(c.name);
    });
  }
  it('甲基环丙烷 SMILES 为 CC1CC1 且判题正确', async () => {
    const r = parseAndBuild('甲基环丙烷');
    expect(r.ok).toBe(true);
    const rdkit = await import('../src/core/rdkit').then((m) => m.parseSmiles(r.smiles!));
    expect(rdkit.ok).toBe(true);
    if (rdkit.ok) expect(rdkit.canonical).toBe('CC1CC1');
    const j = await judgeAnswer('CC1CC1', '甲基环丙烷');
    expect(j.correct).toBe(true);
  });
});

describe('双官能团命名（烯/炔 + 醇/醛/酮/酸/腈）', () => {
  const CASES: Array<{ name: string; formula: string }> = [
    { name: '2-丙烯-1-醇', formula: 'C3H6O' },
    { name: '丙烯酸', formula: 'C3H4O2' },
    { name: '2-丙烯酸', formula: 'C3H4O2' },
    { name: '乙腈', formula: 'C2H3N' },
    { name: '2-丙烯腈', formula: 'C3H3N' },
    { name: '3-丁烯-2-酮', formula: 'C4H6O' },
  ];
  for (const c of CASES) {
    it(`${c.name} 解析构建（${c.formula}）`, () => {
      const r = parseAndBuild(c.name);
      expect(r.ok, r.error?.message).toBe(true);
      expect(formulaOfGraph(r.built!.graph)).toBe(c.formula);
    });
  }
  it('烯丙醇（俗名）→ C=CCO，图→名为 2-丙烯-1-醇', () => {
    const r = parseAndBuild('烯丙醇');
    expect(r.ok, r.error?.message).toBe(true);
    expect(formulaOfGraph(r.built!.graph)).toBe('C3H6O');
    expect(roundTrip('2-丙烯-1-醇')).toBe('2-丙烯-1-醇');
    const n = nameGraph(parseSmiles(r.smiles!));
    expect(n.name).toBe('2-丙烯-1-醇');
  });
  it('2-丙烯酸 判题正确（对 C=CC(=O)O）', async () => {
    const j = await judgeAnswer('C=CC(=O)O', '2-丙烯酸');
    expect(j.correct).toBe(true);
    expect(j.correctName).toBe('2-丙烯酸');
  });
  it('乙腈 判题正确', async () => {
    const j = await judgeAnswer('CC#N', '乙腈');
    expect(j.correct).toBe(true);
  });
  it('额外边界：1,3-戊二烯 / 2-甲基丙醛 / 3-戊酮 / 环戊烷 / 邻溴甲苯 互逆', () => {
    expect(roundTrip('1,3-戊二烯')).toBe('1,3-戊二烯');
    expect(roundTrip('2-甲基丙醛')).toBe('2-甲基丙醛');
    expect(roundTrip('3-戊酮')).toBe('3-戊酮');
    expect(roundTrip('环戊烷')).toBe('环戊烷');
    expect(roundTrip('邻溴甲苯')).toBe('邻溴甲苯');
  });
});

describe('芳香族多取代与苯乙烯/苯甲醚', () => {
  const CASES: Array<{ name: string; formula: string }> = [
    { name: '邻氯甲苯', formula: 'C7H7Cl' },
    { name: '对氯甲苯', formula: 'C7H7Cl' },
    { name: '对硝基甲苯', formula: 'C7H7NO2' },
    { name: '苯乙烯', formula: 'C8H8' },
    { name: '苯甲醚', formula: 'C7H8O' },
    { name: '对二氯苯', formula: 'C6H4Cl2' },
  ];
  for (const c of CASES) {
    it(`${c.name} 解析构建（${c.formula}）且图→名互逆`, () => {
      const r = parseAndBuild(c.name);
      expect(r.ok, r.error?.message).toBe(true);
      expect(formulaOfGraph(r.built!.graph)).toBe(c.formula);
      expect(roundTrip(c.name)).toBe(c.name);
    });
  }
  it('判题：对氯甲苯 判对', async () => {
    const j = await judgeAnswer('Cc1ccc(Cl)cc1', '对氯甲苯');
    expect(j.correct).toBe(true);
  });
  it('判题：苯乙烯 判对', async () => {
    const j = await judgeAnswer('C=Cc1ccccc1', '苯乙烯');
    expect(j.correct).toBe(true);
  });
});

describe('判题改进', () => {
  it('二甲苯 邻/间/对 定向反馈', async () => {
    const r = await judgeAnswer('Cc1ccc(C)cc1', '邻二甲苯');
    expect(r.correct).toBe(false);
    expect(r.feedback.some((f) => f.includes('邻/间/对'))).toBe(true);
    expect(r.feedback.some((f) => f.includes('对位'))).toBe(true);
    expect(r.errorTypes).toContain('编号方向');
  });
  it('醛 vs 酮 官能团优先级提示', async () => {
    const r = await judgeAnswer('CCC=O', '丙酮');
    expect(r.correct).toBe(false);
    expect(r.feedback.some((f) => f.includes('醛基 -CHO 在链端'))).toBe(true);
    expect(r.errorTypes).toContain('官能团');
  });
  it('漏写取代基不再重复报倍数词', async () => {
    const r = await judgeAnswer('CC(C)(C)C', '甲基丙烷');
    expect(r.correct).toBe(false);
    const mulCount = r.feedback.filter((f) => f.includes('倍数词')).length;
    expect(mulCount).toBeLessThanOrEqual(1);
  });
});

describe('NMR 位移补全与最简比', () => {
  it('乙醛：醛氢 δ≈9.7', () => {
    const a = analyzeEquivalentH(parseSmiles('CC=O'));
    const aldehyde = a.classes.find((c) => c.kind === 'CH' && c.count === 1);
    expect(aldehyde).toBeTruthy();
    expect(aldehyde!.shift).toBeCloseTo(9.7, 1);
  });
  it('乙酸：羧基羟基 δ≈11.5，甲基 δ≈2.1', () => {
    const a = analyzeEquivalentH(parseSmiles('CC(=O)O'));
    const oh = a.classes.find((c) => c.kind === 'OH');
    const me = a.classes.find((c) => c.kind === 'CH');
    expect(oh!.shift).toBeCloseTo(11.5, 1);
    expect(me!.shift).toBeCloseTo(2.1, 1);
  });
  it('苯酚：酚羟基 δ≈6.5', () => {
    const a = analyzeEquivalentH(parseSmiles('Oc1ccccc1'));
    const oh = a.classes.find((c) => c.kind === 'OH');
    expect(oh!.shift).toBeCloseTo(6.5, 1);
  });
  it('2-丁烯：烯氢 =CH δ≈5.0，烯丙位 CH3 δ≈2.0', () => {
    const a = analyzeEquivalentH(parseSmiles('CC=CC'));
    const ch = a.classes.find((c) => c.kind === 'CH' && c.count === 2);
    const me = a.classes.find((c) => c.kind === 'CH' && c.count === 6);
    expect(ch!.shift).toBeCloseTo(5.0, 1);
    expect(me!.shift).toBeCloseTo(2.0, 1);
  });
  it('丙炔：炔氢 ≡CH δ≈2.5', () => {
    const a = analyzeEquivalentH(parseSmiles('CC#C'));
    const yne = a.classes.find((c) => c.kind === 'CH' && c.count === 1);
    expect(yne!.shift).toBeCloseTo(2.5, 1);
  });
  it('苯乙烯：=CH2 δ≈5.1，=CH δ≈5.0', () => {
    const a = analyzeEquivalentH(parseSmiles('C=Cc1ccccc1'));
    const ch2 = a.classes.find((c) => c.kind === 'CH' && c.count === 2);
    const ch = a.classes.find((c) => c.kind === 'CH' && c.count === 1);
    expect(ch2!.shift).toBeCloseTo(5.1, 1);
    expect(ch!.shift).toBeCloseTo(5.0, 1);
  });
  it('最简比：正丁烷 6:4 → 3:2', () => {
    const a = analyzeEquivalentH(parseSmiles('CCCC'));
    expect(a.ratioText).toBe('3:2');
  });
  it('单类比例保持原氢数（新戊烷 12）', () => {
    const a = analyzeEquivalentH(parseSmiles('CC(C)(C)C'));
    expect(a.ratioText).toBe('12');
  });
});

describe('数据扩展', () => {
  it('异构体集：C2H6O / C3H6O / C4H9Cl / C5H12O', () => {
    expect(ISOMER_SETS.find((s) => s.key === 'C2H6O')!.isomers).toHaveLength(2);
    expect(ISOMER_SETS.find((s) => s.key === 'C3H6O')!.isomers).toHaveLength(3);
    expect(ISOMER_SETS.find((s) => s.key === 'C4H9Cl')!.isomers).toHaveLength(4);
    expect(ISOMER_SETS.find((s) => s.key === 'C5H12O')!.isomers).toHaveLength(14);
  });
  it('反应网络：苯酚节点与 卤代烃→苯酚 边', () => {
    expect(REACTION_NODES.some((n) => n.id === 'phenol')).toBe(true);
    expect(REACTION_EDGES.some((e) => e.from === 'haloalkane' && e.to === 'phenol')).toBe(true);
    expect(findPath('aromatic', 'phenol')?.length).toBe(2); // 芳香烃→卤代烃→苯酚
  });
});

describe('结构简式（醚）', () => {
  it('二甲醚 → CH3OCH3', () => {
    expect(condensedFormula(parseSmiles('COC'))).toBe('CH3OCH3');
  });
  it('乙醚 → CH2CH3OCH2CH3', () => {
    expect(condensedFormula(parseSmiles('CCOCC'))).toBe('CH2CH3OCH2CH3');
  });
  it('甲基叔丁基醚 → CH3OC(CH3)(CH3)(CH3)', () => {
    expect(condensedFormula(parseSmiles('COC(C)(C)C'))).toBe('CH3OC(CH3)(CH3)(CH3)');
  });
  it('苯甲醚 → C6H5OCH3', () => {
    expect(condensedFormula(parseSmiles('COc1ccccc1'))).toBe('C6H5OCH3');
  });
  it('乙醇仍为 CH3CH2OH（回归）', () => {
    expect(condensedFormula(parseSmiles('CCO'))).toBe('CH3CH2OH');
  });
});
