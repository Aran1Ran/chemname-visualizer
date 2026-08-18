/**
 * 批 4 验收：#11 路线图（alkane→aromatic 重整路径 + DFS 顺序优先）、
 * #9 手性碳检测（analyzeChirality，只检测不命名）。
 * 注：hint 是否含 "R/S" 字样——需求方已裁定**允许**（后端文案"不做 R/S 命名"），
 * 本文件不锁"不含 R/S"断言。
 */
import { describe, it, expect } from 'vitest';
import { parseSmiles } from '../src/core/chem/graph';
import { analyzeChirality } from '../src/core/chem/chirality';
import { REACTION_EDGES, findPath } from '../src/data/reactionNetwork';

describe('批4 · #11 路线图（重整路径）', () => {
  it('alkane→aromatic 边存在、字段非空，且位于 alkane→haloalkane 之前', () => {
    const iAro = REACTION_EDGES.findIndex((e) => e.from === 'alkane' && e.to === 'aromatic');
    const iHalo = REACTION_EDGES.findIndex((e) => e.from === 'alkane' && e.to === 'haloalkane');
    expect(iAro, 'alkane→aromatic 应存在').toBeGreaterThanOrEqual(0);
    expect(iHalo, 'alkane→haloalkane 应存在').toBeGreaterThanOrEqual(0);
    expect(iAro, '重整边应在卤代边之前').toBeLessThan(iHalo);
    const e = REACTION_EDGES[iAro];
    expect(e.type.length).toBeGreaterThan(0);
    expect(e.condition.length).toBeGreaterThan(0);
    expect(e.equation.length).toBeGreaterThan(0);
    expect(e.label.length).toBeGreaterThan(0);
  });

  it("findPath('alkane','phenol') 非 null，路径含 aromatic（首步至芳香烃）", () => {
    const p = findPath('alkane', 'phenol');
    expect(p).not.toBeNull();
    expect(p!.length).toBeGreaterThan(0);
    expect(p![0].to, `路径=${p!.map((e) => e.from + '->' + e.to).join(' | ')}`).toBe('aromatic');
    expect(p!.some((e) => e.from === 'aromatic' || e.to === 'aromatic')).toBe(true);
  });

  it('haloalkane→phenol 边 type 含「芳基卤代烃」，condition 保持', () => {
    const e = REACTION_EDGES.find((x) => x.from === 'haloalkane' && x.to === 'phenol');
    expect(e).toBeTruthy();
    expect(e!.type).toContain('芳基卤代烃');
    expect(e!.condition).toBe('NaOH 水溶液，高温高压');
  });

  it('回归：既有可达性断言不受影响（roadmap-layout 全绿即证）', () => {
    expect(findPath('aromatic', 'phenol')?.length).toBe(2);
    expect(findPath('ester', 'alcohol')).not.toBeNull();
    expect(findPath('alkyne', 'aldehyde')).not.toBeNull();
    expect(findPath('haloalkane', 'acid')).not.toBeNull();
  });
});

describe('批4 · #9 手性碳检测（analyzeChirality）', () => {
  it('阳性锚点：2-氯丁烷 C2 / 乳酸 C2 / 2-丁醇 C2', () => {
    const cases: Array<[string, number]> = [
      ['CC(Cl)CC', 1],
      ['CC(O)C(=O)O', 1],
      ['CCC(O)C', 1],
    ];
    for (const [smiles, count] of cases) {
      const r = analyzeChirality(parseSmiles(smiles));
      expect(r.hasChiral, `${smiles} 应检测到手性碳`).toBe(true);
      expect(r.chiralAtomIndices.length, `${smiles} 手性碳数`).toBe(count);
      expect(r.hint.length).toBeGreaterThan(0);
    }
  });

  it('阴性锚点：丙烷/乙醇/氯仿/2-溴丙烷/3-甲基戊烷/2,3-二甲基丁烷 均非手性', () => {
    for (const smiles of ['CCC', 'CCO', 'ClC(Cl)Cl', 'CC(Br)C', 'CCC(C)CC', 'CC(C)C(C)C']) {
      expect(analyzeChirality(parseSmiles(smiles)).hasChiral, `${smiles} 应非手性`).toBe(false);
    }
  });

  it('meso 2,3-二氯丁烷：按"4 基团不同"简化口径有 2 个手性碳（分子对称面不做判断）', () => {
    const r = analyzeChirality(parseSmiles('CC(Cl)C(Cl)C'));
    expect(r.hasChiral).toBe(true);
    expect(r.chiralAtomIndices.length).toBe(2);
  });

  it('hint：手性时含「手性碳」（R/S 字样口径待需求方裁定，本文件暂不锁）', () => {
    const r = analyzeChirality(parseSmiles('CC(Cl)CC'));
    expect(r.hint).toContain('手性碳');
    const neg = analyzeChirality(parseSmiles('CCC'));
    expect(neg.hint).toBeTruthy();
  });
});
