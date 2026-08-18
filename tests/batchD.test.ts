/**
 * 批 D 验收：condensedFormula 扩展（多苯环/二酯/芳香端基/降级兜底）
 * 联苯 C6H5-C6H5 风格（不输出 "CCHCHCHCHCH" 链式串）、二乙酸乙二酯双乙酰、
 * 乙二酸二乙酯不乱序、无法支持结构降级为分子式。
 * 乙基口径与既有单酯一致（CH2CH3，如乙酸乙酯 CH3COOCH2CH3）。
 */
import { describe, it, expect } from 'vitest';
import { parseSmiles } from '../src/core/chem/graph';
import { condensedFormula } from '../src/core/chem/condensed';

const c = (smiles: string) => condensedFormula(parseSmiles(smiles));

describe('批D · 多苯环 condensed（不含链式串）', () => {
  it('联苯 → C6H5-C6H5（第二苯环不展开为链式串）', () => {
    const s = c('c1ccc(-c2ccccc2)cc1');
    expect(s).toBe('C6H5-C6H5');
    expect(s).not.toContain('CCHCHCHCHCH');
  });
  it('二苯甲烷 → C6H5CH2C6H5', () => {
    expect(c('c1ccccc1Cc2ccccc2')).toBe('C6H5CH2C6H5');
  });
  it('二苯醚 → C6H5OC6H5', () => {
    expect(c('O(c1ccccc1)c2ccccc2')).toBe('C6H5OC6H5');
  });
  it('4-甲基联苯（环上有其它取代基）→ 降级分子式 C13H12', () => {
    expect(c('Cc1ccc(-c2ccccc2)cc1')).toBe('C13H12');
  });
  it('三苯甲烷 → 降级分子式 C19H16', () => {
    expect(c('C(c1ccccc1)(c2ccccc2)c3ccccc3')).toBe('C19H16');
  });
});

describe('批D · 芳香端基（单苯环二取代风格）', () => {
  it('对苯二甲酸 → HOOC-C6H4-COOH', () => {
    expect(c('OC(=O)c1ccc(C(=O)O)cc1')).toBe('HOOC-C6H4-COOH');
  });
  it('苯甲酸甲酯 → C6H5COOCH3（芳香酯分支，不再误判 COOH）', () => {
    expect(c('COC(=O)c1ccccc1')).toBe('C6H5COOCH3');
  });
});

describe('批D · 多酯（双乙酰/不乱序）', () => {
  it('二乙酸乙二酯 → CH3COOCH2CH2OOCCH3（两个乙酰）', () => {
    expect(c('CC(=O)OCCOC(=O)C')).toBe('CH3COOCH2CH2OOCCH3');
  });
  it('乙二酸二乙酯 → CH2CH3OOC-COOCH2CH3（不乱序；中间 0 碳 COO 间加 -）', () => {
    expect(c('CCOC(=O)C(=O)OCC')).toBe('CH2CH3OOC-COOCH2CH3');
  });
});

describe('批D · 降级兜底与回归', () => {
  it('桥环/稠环无法表达 → 降级分子式（不输出链式错误串）', () => {
    expect(c('C1=CC2CC1CC2')).toBe('C7H10'); // 降冰片烯
    expect(c('c1ccc2ccccc2c1')).toBe('C10H8'); // 萘
    expect(c('C1=CC=C2C=CC3=CC=CC=C3C2=C1')).toBe('C14H10'); // 菲 Kekulé 式
  });
  it('回归抽检：乙酸乙酯/甲酸甲酯/甲苯/苯酚/乙二醇（既有 22 项全绿即证）', () => {
    expect(c('CC(=O)OCC')).toBe('CH3COOCH2CH3');
    expect(c('COC=O')).toBe('HCOOCH3');
    expect(c('Cc1ccccc1')).toBe('C6H5CH3');
    expect(c('Oc1ccccc1')).toBe('C6H5OH');
    expect(c('OCCO')).toBe('HOCH2CH2OH');
  });
});
