/**
 * 验收测试：等效氢分析、同分异构体数据、命名互逆
 */
import { describe, it, expect } from 'vitest';
import { parseSmiles } from '../src/core/chem/graph';
import { analyzeEquivalentH } from '../src/core/chem/symmetry';
import { nameGraph } from '../src/core/reverse/namer';
import { ISOMER_SETS } from '../src/data/isomerSets';
import { BANK } from '../src/data/smilesLibrary';

describe('验收：等效氢分析', () => {
  const CASES: Array<{ name: string; smiles: string; classes: number; ratio: string }> = [
    { name: '甲烷', smiles: 'C', classes: 1, ratio: '4' },
    { name: '乙烷', smiles: 'CC', classes: 1, ratio: '6' },
    { name: '丙烷', smiles: 'CCC', classes: 2, ratio: '3:1' },
    { name: '正丁烷', smiles: 'CCCC', classes: 2, ratio: '3:2' },
    { name: '异丁烷', smiles: 'CC(C)C', classes: 2, ratio: '9:1' },
    { name: '新戊烷', smiles: 'CC(C)(C)C', classes: 1, ratio: '12' },
    { name: '乙醇', smiles: 'CCO', classes: 3, ratio: '3:2:1' },
    { name: '乙酸', smiles: 'CC(=O)O', classes: 2, ratio: '3:1' },
    { name: '甲苯', smiles: 'Cc1ccccc1', classes: 4, ratio: '3:2:2:1' },
    { name: '对二甲苯', smiles: 'Cc1ccc(C)cc1', classes: 2, ratio: '3:2' },
    // ── 考试分子扩展（需求方拍板口径；后端 symmetry.ts 修正后锁定）──
    { name: '乙酸乙酯', smiles: 'CC(=O)OCC', classes: 3, ratio: '3:3:2' },
    { name: '2-丁烯', smiles: 'CC=CC', classes: 2, ratio: '3:1' },
    { name: '丙炔', smiles: 'CC#C', classes: 2, ratio: '3:1' },
    { name: '乙醛', smiles: 'CC=O', classes: 2, ratio: '3:1' },
    { name: '丙酮', smiles: 'CC(=O)C', classes: 1, ratio: '6' },
    { name: '甘油', smiles: 'OCC(O)CO', classes: 4, ratio: '4:1:2:1' },
    { name: '苯乙烯', smiles: 'C=Cc1ccccc1', classes: 5, ratio: '1:2:2:2:1' },
  ];

  for (const c of CASES) {
    it(`${c.name}：${c.classes} 类等效氢（比例 ${c.ratio}）`, () => {
      const a = analyzeEquivalentH(parseSmiles(c.smiles));
      expect(a.classCount).toBe(c.classes);
      expect(a.ratioText).toBe(c.ratio);
    });
  }
});

describe('验收：一氯代物种类数', () => {
  // 口径：一氯代物种类数 = 碳上氢等效类数（O-H/N-H 活泼氢不计，醛氢不能氯代也不计）
  const CASES: Array<{ name: string; smiles: string; count: number }> = [
    { name: '乙酸乙酯', smiles: 'CC(=O)OCC', count: 3 },
    { name: '2-丁烯', smiles: 'CC=CC', count: 2 },
    { name: '丙炔', smiles: 'CC#C', count: 2 },
    { name: '乙醛', smiles: 'CC=O', count: 1 }, // 醛氢不计 → 仅 CH3 可氯代
    { name: '丙酮', smiles: 'CC(=O)C', count: 1 },
    { name: '甘油', smiles: 'OCC(O)CO', count: 2 }, // 仅碳上氢：CH2 类 + CH 类
    { name: '苯乙烯', smiles: 'C=Cc1ccccc1', count: 5 },
  ];

  for (const c of CASES) {
    it(`${c.name}：一氯代物 ${c.count} 种`, () => {
      const a = analyzeEquivalentH(parseSmiles(c.smiles));
      expect(a.monochloroCount, `${c.name} 一氯代物种类数`).toBe(c.count);
    });
  }
});

describe('验收：同分异构体数据', () => {
  it('C5H12 有 3 种', () => {
    const set = ISOMER_SETS.find((s) => s.key === 'C5H12');
    expect(set).toBeTruthy();
    expect(set!.isomers).toHaveLength(3);
  });
  it('C6H14 有 5 种', () => {
    const set = ISOMER_SETS.find((s) => s.key === 'C6H14');
    expect(set!.isomers).toHaveLength(5);
  });
  it('C4H10O 有 7 种', () => {
    const set = ISOMER_SETS.find((s) => s.key === 'C4H10O');
    expect(set!.isomers).toHaveLength(7);
  });
  it('每个异构体的图可解析且可命名', () => {
    for (const s of ISOMER_SETS) {
      for (const iso of s.isomers) {
        const g = parseSmiles(iso.smiles);
        const n = nameGraph(g);
        expect(n.ok, `${iso.smiles} 命名失败: ${n.error}`).toBe(true);
        expect(n.name.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('验收：题库完整性', () => {
  it('每个难度等级至少 5 题', () => {
    for (let lv = 1; lv <= 6; lv++) {
      const count = BANK.filter((b) => b.level === lv).length;
      expect(count, `L${lv} 题库 ${count} 题`).toBeGreaterThanOrEqual(5);
    }
  });
  it('每题结构可解析且命名与目标一致', () => {
    for (const b of BANK) {
      const g = parseSmiles(b.smiles);
      const n = nameGraph(g);
      expect(n.ok, `${b.smiles} 命名失败`).toBe(true);
    }
  });
});
