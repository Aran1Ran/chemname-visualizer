/**
 * 批 B 验收：namer 反向命名扩展锚点矩阵（后端交接）
 * 多苯环/稠环/苯二甲酸/芳香酰胺/苄酯/单碳多卤省略位次/最小位次/氨基词序+连字符/
 * 桥环防护（ok:false + 超范围提示，不输出链烯错名）。
 */
import { describe, it, expect } from 'vitest';
import { parseSmiles } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';

function rev(smiles: string): { ok: boolean; name: string; error: string } {
  const n = nameGraph(parseSmiles(smiles));
  return { ok: n.ok, name: n.name, error: n.error ?? '' };
}

describe('批B · 多苯环反向命名（BUG-A3）', () => {
  const CASES: Array<[string, string]> = [
    ['c1ccc(-c2ccccc2)cc1', '联苯'],
    ['c1ccccc1Cc2ccccc2', '二苯甲烷'],
    ['C(c1ccccc1)(c2ccccc2)c3ccccc3', '三苯甲烷'],
    ['c1ccccc1CCc2ccccc2', '1,2-二苯基乙烷'],
    ['C(=Cc1ccccc1)c2ccccc2', '1,2-二苯乙烯'],
    ['C(#Cc1ccccc1)c2ccccc2', '二苯乙炔'],
    ['O(c1ccccc1)c2ccccc2', '二苯醚'],
    ['Cc1ccc(-c2ccccc2)cc1', '4-甲基联苯'],
  ];
  for (const [smiles, name] of CASES) {
    it(`${smiles} → ${name}`, () => {
      const r = rev(smiles);
      expect(r.ok, r.error).toBe(true);
      expect(r.name).toBe(name);
    });
  }
});

describe('批B · 稠环反向命名（BUG-A4）', () => {
  const CASES: Array<[string, string]> = [
    ['c1ccc2ccccc2c1', '萘'],
    ['c1ccc2cc3ccccc3cc2c1', '蒽'],
    ['C1=CC=C2C=CC3=CC=CC=C3C2=C1', '菲'],
    ['c1cc(C)c2ccccc2c1', '1-甲基萘'],
    ['Cc1ccc2ccccc2c1', '2-甲基萘'],
    ['Oc1ccc2ccccc2c1', '2-萘酚'],
  ];
  for (const [smiles, name] of CASES) {
    it(`${smiles} → ${name}`, () => {
      const r = rev(smiles);
      expect(r.ok, r.error).toBe(true);
      expect(r.name).toBe(name);
    });
  }
});

describe('批B · 苯二甲酸与 PET（BUG-A5）', () => {
  const CASES: Array<[string, string]> = [
    ['OC(=O)c1ccccc1C(=O)O', '邻苯二甲酸'],
    ['OC(=O)c1cccc(C(=O)O)c1', '间苯二甲酸'],
    ['OC(=O)c1ccc(C(=O)O)cc1', '对苯二甲酸'],
    ['OC(=O)c1ccc(C(=O)OCCO)cc1', '对苯二甲酸乙二醇酯'],
  ];
  for (const [smiles, name] of CASES) {
    it(`${smiles} → ${name}`, () => {
      const r = rev(smiles);
      expect(r.ok, r.error).toBe(true);
      expect(r.name).toBe(name);
    });
  }
});

describe('批B · 芳香酰胺/苄酯（BUG-A6/A7）', () => {
  it('对乙酰氨基酚 → 对乙酰氨基酚', () => {
    const r = rev('CC(=O)Nc1ccc(O)cc1');
    expect(r.ok, r.error).toBe(true);
    expect(r.name).toBe('对乙酰氨基酚');
  });
  it('乙酰苯胺 → 乙酰苯胺', () => {
    const r = rev('CC(=O)Nc1ccccc1');
    expect(r.ok, r.error).toBe(true);
    expect(r.name).toBe('乙酰苯胺');
  });
  it('乙酸苄酯 → 乙酸苄酯；二乙酸乙二酯 → 二乙酸乙二酯', () => {
    expect(rev('CC(=O)OCc1ccccc1').name).toBe('乙酸苄酯');
    expect(rev('CC(=O)OCCOC(=O)C').name).toBe('二乙酸乙二酯');
  });
});

describe('批B · 最小位次（BUG-B1）与单碳多卤省略位次（BUG-B4）', () => {
  it('2,4-二氯甲苯 / 1,2,4-三甲苯（最小位次）', () => {
    expect(rev('Cc1ccc(Cl)cc1Cl').name).toBe('2,4-二氯甲苯');
    expect(rev('Cc1ccc(C)c(C)c1').name).toBe('1,2,4-三甲苯');
  });
  it('四氯甲烷 / 三氯甲烷（单碳多卤省略位次）', () => {
    expect(rev('ClC(Cl)(Cl)Cl').name).toBe('四氯甲烷');
    expect(rev('ClC(Cl)Cl').name).toBe('三氯甲烷');
  });
  it('2-氯丁烷 → 2-氯丁烷（回归）', () => {
    expect(rev('CCC(Cl)C').name).toBe('2-氯丁烷');
  });
});

describe('批B · 氨基酸词序与连字符（BUG-B6）', () => {
  it('苯丙氨酸 → 2-氨基-3-苯基丙酸（氨基在前）', () => {
    expect(rev('OC(=O)C(N)Cc1ccccc1').name).toBe('2-氨基-3-苯基丙酸');
  });
  it('2-氨基-2-甲基丙酸 → 同名（氨基在前）', () => {
    expect(rev('CC(C)(N)C(=O)O').name).toBe('2-氨基-2-甲基丙酸');
  });
});

describe('批B · 桥环/多环防护（BUG-B5）', () => {
  it('降冰片烯（桥环）：nameGraph ok=false，错误含「超出」，不输出链烯错名', () => {
    const r = rev('C1=CC2CC1CC2');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/超出|超范围/);
    expect(r.error).not.toMatch(/庚烯/);
  });
});
