/**
 * 6.3 顺反异构"是否存在"判定验收（analyzeCisTrans）
 * 规则：双键两端碳各连两个不同基团 → 存在；=CH₂/相同基团/环内双键 → 不存在。
 * 只判"是否存在"，不做 Z/E 命名（知识范围第五节边界）。
 */
import { describe, it, expect } from 'vitest';
import { parseSmiles } from '../src/core/chem/graph';
import { analyzeCisTrans } from '../src/core/chem/geometric';
import { equivalenceClasses } from '../src/core/chem/symmetry';

/** 锚点矩阵（后端交接）：smiles → 期望存在性 + 至少一条 bond 的 reason 片段 */
const CASES: Array<{ smiles: string; expectCis: boolean; reasonPart?: string; label: string }> = [
  { smiles: 'CC=CC', expectCis: true, reasonPart: '两端碳各连两个不同基团', label: '2-丁烯' },
  { smiles: 'CCC=CC', expectCis: true, reasonPart: '两端碳各连两个不同基团', label: '2-戊烯' },
  { smiles: 'C=C', expectCis: false, reasonPart: '=CH₂ 两个氢相同', label: '乙烯' },
  { smiles: 'C=CCC', expectCis: false, reasonPart: '=CH₂ 两个氢相同', label: '1-丁烯' },
  { smiles: 'ClC(Cl)=C', expectCis: false, label: '1,1-二氯乙烯' },
  { smiles: 'CC=C(C)C', expectCis: false, label: '2-甲基-2-丁烯' },
  { smiles: 'C1CCCC=C1', expectCis: false, reasonPart: '环内双键', label: '环己烯' },
];

describe('6.3 顺反异构"是否存在"判定（analyzeCisTrans）', () => {
  for (const c of CASES) {
    it(`${c.label}（${c.smiles}）→ ${c.expectCis ? '存在顺反异构' : '不存在顺反异构'}`, () => {
      const r = analyzeCisTrans(parseSmiles(c.smiles));
      expect(r.hasCisTrans).toBe(c.expectCis);
      if (c.reasonPart) {
        expect(
          r.bonds.some((b) => b.reason.includes(c.reasonPart!)),
          `${c.smiles} 无 bond 的 reason 含「${c.reasonPart}」`
        ).toBe(true);
      }
    });
  }

  it('bonds 数据完整性：aIndex/bIndex 为合法图原子索引，且两原子间确为双键', () => {
    for (const c of CASES) {
      const g = parseSmiles(c.smiles);
      const r = analyzeCisTrans(g);
      const n = g.atoms.length;
      for (const b of r.bonds) {
        expect(b.aIndex, `${c.smiles} aIndex`).toBeGreaterThanOrEqual(0);
        expect(b.aIndex).toBeLessThan(n);
        expect(b.bIndex, `${c.smiles} bIndex`).toBeGreaterThanOrEqual(0);
        expect(b.bIndex).toBeLessThan(n);
        const found = g.bonds.find(
          (gb) => (gb.a === b.aIndex && gb.b === b.bIndex) || (gb.a === b.bIndex && gb.b === b.aIndex)
        );
        expect(found, `${c.smiles} 无对应双键`).toBeTruthy();
        expect(found!.order).toBe(2);
      }
    }
  });

  it('bondCount = C=C 双键总数', () => {
    expect(analyzeCisTrans(parseSmiles('C=C')).bondCount).toBe(1);
    expect(analyzeCisTrans(parseSmiles('CC=CC')).bondCount).toBe(1);
    expect(analyzeCisTrans(parseSmiles('C=CC=C')).bondCount).toBe(2); // 1,3-丁二烯
    expect(analyzeCisTrans(parseSmiles('CC(C)C')).bondCount).toBe(0); // 无异构无烯烃
  });

  it('equivalenceClasses 导出不影响 analyzeEquivalentH：由 acceptance 等效氢 17 项自动回归（此处仅验证导出存在）', () => {
    expect(typeof equivalenceClasses).toBe('function');
  });
});
