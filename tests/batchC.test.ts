/**
 * 批 C 验收：枚举器扩展（价键过滤/烷基苯/烯烃环烷烃）+ SMILES 环闭合解析
 * C6H12O2 酯=20（BUG-014）、C8H10 烷基苯=4（MISSING-008）、C3~C6 烯烃/环烷烃
 * 计数（MISSING-009）、邻苯二甲酸酐 "12" 双环闭合与 %nn 环号（BUG-015）。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { enumerateIsomers, analyzeFormula } from '../src/core/chem/isomerEnum';
import { parseSmiles, formulaOfGraph } from '../src/core/chem/graph';
import { initRDKit, parseSmiles as rdParse } from '../src/core/rdkit';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

function countOf(formula: string, classes: string[]): number {
  const r = enumerateIsomers({ formula, classes: classes as never });
  expect(r.supported, `${formula} [${classes}] 应可枚举: ${r.warning}`).toBe(true);
  return r.count;
}

describe('批C · 价键过滤（BUG-014）', () => {
  it('C6H12O2 酯 = 20（剔除非法五价碳结构）', () => {
    expect(countOf('C6H12O2', ['ester'])).toBe(20);
  });
  it('回归锚点：C5H10O2 酯=9 / C4H8O2 酸酯=6 / C8H10O=15 / C4H9Cl=4 / C4H8Cl2=9', () => {
    expect(countOf('C5H10O2', ['ester'])).toBe(9);
    expect(countOf('C4H8O2', ['acid', 'ester'])).toBe(6);
    expect(countOf('C8H10O', ['phenol', 'aromatic-ether', 'aromatic-alcohol'])).toBe(15);
    expect(countOf('C4H9Cl', ['monohalo'])).toBe(4);
    expect(countOf('C4H8Cl2', ['dihalo'])).toBe(9);
  });
});

describe('批C · 烷基苯（MISSING-008）', () => {
  it('C8H10 候选含 aromatic-hydrocarbon 且可枚举；枚举 = 4（乙苯 + 邻间对二甲苯）', () => {
    const a = analyzeFormula('C8H10');
    const hc = a.candidates.find((c) => c.klass === 'aromatic-hydrocarbon');
    expect(hc, 'C8H10 应含烷基苯候选').toBeTruthy();
    expect(hc!.enumerable).toBe(true);
    expect(countOf('C8H10', ['aromatic-hydrocarbon'])).toBe(4);
  });
  it('C7H8 = 1（甲苯）', () => {
    expect(countOf('C7H8', ['aromatic-hydrocarbon'])).toBe(1);
  });
});

describe('批C · 烯烃/环烷烃枚举（MISSING-009）', () => {
  it('C3H6 = 2（丙烯 + 环丙烷）', () => {
    expect(countOf('C3H6', ['alkene', 'cycloalkane'])).toBe(2);
  });
  it('C4H8 = 5（烯 3 + 环烷 2，顺反不计）', () => {
    expect(countOf('C4H8', ['alkene', 'cycloalkane'])).toBe(5);
  });
  it('C5H10 = 10（烯 5 + 环烷 5）', () => {
    expect(countOf('C5H10', ['alkene', 'cycloalkane'])).toBe(10);
  });
  it('C7H14 → supported:false + warning 含 C3~C6，不抛错', () => {
    expect(() => {
      const r = enumerateIsomers({ formula: 'C7H14', classes: ['alkene', 'cycloalkane'] });
      expect(r.supported).toBe(false);
      expect(r.warning).toContain('C3~C6');
    }).not.toThrow();
  });
});

describe('批C · SMILES 环闭合（BUG-015）', () => {
  it('邻苯二甲酸酐 O=C1OC(=O)c2ccccc12（同原子"12"双闭合）可解析且 RDKit 合法', async () => {
    const g = parseSmiles('O=C1OC(=O)c2ccccc12');
    expect(g.atoms.length).toBeGreaterThan(0);
    expect(formulaOfGraph(g)).toBe('C8H4O3');
    const rr = await rdParse('O=C1OC(=O)c2ccccc12');
    if (!rr.ok) throw new Error(rr.reason);
  });
  it('菲芳香式（c1ccc2c(c1)cc3ccccc3c2）可解析，分子式 C14H10，RDKit 合法', async () => {
    const g = parseSmiles('c1ccc2c(c1)cc3ccccc3c2');
    expect(formulaOfGraph(g)).toBe('C14H10');
    const rr = await rdParse('c1ccc2c(c1)cc3ccccc3c2');
    if (!rr.ok) throw new Error(rr.reason);
  });
  it('%nn 两位环号（环癸烷 C%10CCCCCCCCC%10）不回归', () => {
    const g = parseSmiles('C%10CCCCCCCCC%10');
    expect(formulaOfGraph(g)).toBe('C10H20');
  });
});
