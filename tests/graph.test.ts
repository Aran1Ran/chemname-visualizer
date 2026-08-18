/**
 * 分子图（SMILES 解析器）单元测试
 */
import { describe, it, expect } from 'vitest';
import { parseSmiles, formulaOfGraph, carbonIndices, SmilesParseError } from '../src/core/chem/graph';

describe('SMILES 解析器', () => {
  it('烷烃链与支链', () => {
    const g = parseSmiles('CC(C)C');
    expect(g.atoms).toHaveLength(4);
    expect(g.bonds).toHaveLength(3);
    expect(formulaOfGraph(g)).toBe('C4H10');
    expect(carbonIndices(g)).toHaveLength(4);
  });

  it('2,3-二甲基丁烷', () => {
    const g = parseSmiles('CC(C)C(C)C');
    expect(formulaOfGraph(g)).toBe('C6H14');
    expect(g.bonds).toHaveLength(5);
  });

  it('新戊烷 2,2-二甲基丙烷', () => {
    const g = parseSmiles('CC(C)(C)C');
    expect(formulaOfGraph(g)).toBe('C5H12');
  });

  it('烯烃双键', () => {
    const g1 = parseSmiles('C=CC');
    expect(g1.bonds.find((b) => b.order === 2)).toBeTruthy();
    expect(formulaOfGraph(g1)).toBe('C3H6');
    const g2 = parseSmiles('CC=CC'); // 2-丁烯
    expect(formulaOfGraph(g2)).toBe('C4H8');
  });

  it('1,3-丁二烯与炔烃', () => {
    expect(formulaOfGraph(parseSmiles('C=CC=C'))).toBe('C4H6');
    expect(formulaOfGraph(parseSmiles('CC#C'))).toBe('C3H4');
    expect(formulaOfGraph(parseSmiles('CC#CC'))).toBe('C4H6');
    expect(formulaOfGraph(parseSmiles('C#C'))).toBe('C2H2');
  });

  it('醇/醛/酸/酯', () => {
    expect(formulaOfGraph(parseSmiles('CCO'))).toBe('C2H6O');
    expect(formulaOfGraph(parseSmiles('CC(C)O'))).toBe('C3H8O');
    expect(formulaOfGraph(parseSmiles('CC=O'))).toBe('C2H4O');
    expect(formulaOfGraph(parseSmiles('CCC=O'))).toBe('C3H6O');
    expect(formulaOfGraph(parseSmiles('CC(=O)O'))).toBe('C2H4O2');
    expect(formulaOfGraph(parseSmiles('CC(=O)OCC'))).toBe('C4H8O2');
    expect(formulaOfGraph(parseSmiles('O=COC'))).toBe('C2H4O2'); // 甲酸甲酯
  });

  it('卤代烃', () => {
    expect(formulaOfGraph(parseSmiles('CCBr'))).toBe('C2H5Br');
    expect(formulaOfGraph(parseSmiles('BrCCBr'))).toBe('C2H4Br2');
    expect(formulaOfGraph(parseSmiles('ClC(Cl)Cl'))).toBe('CHCl3');
  });

  it('芳香族', () => {
    const toluene = parseSmiles('Cc1ccccc1');
    expect(formulaOfGraph(toluene)).toBe('C7H8');
    // 苯环原子均标记 inRing
    const ringAtoms = toluene.atoms.filter((a) => a.inRing);
    expect(ringAtoms).toHaveLength(6);
    // 芳香键 order 1.5
    const aromaticBonds = toluene.bonds.filter((b) => b.aromatic);
    expect(aromaticBonds).toHaveLength(6);

    expect(formulaOfGraph(parseSmiles('Cc1ccc(C)cc1'))).toBe('C8H10'); // 对二甲苯
    expect(formulaOfGraph(parseSmiles('Oc1ccccc1'))).toBe('C6H6O'); // 苯酚
    expect(formulaOfGraph(parseSmiles('CCc1ccccc1'))).toBe('C8H10'); // 乙苯
    expect(formulaOfGraph(parseSmiles('Clc1ccccc1'))).toBe('C6H5Cl'); // 氯苯
  });

  it('电荷与括号原子（硝基苯）', () => {
    const nitro = parseSmiles('[O-][N+](=O)c1ccccc1');
    expect(formulaOfGraph(nitro)).toBe('C6H5NO2');
    const nPlus = nitro.atoms.find((a) => a.element === 'N');
    const oMinus = nitro.atoms.find((a) => a.element === 'O' && a.charge === -1);
    expect(nPlus?.charge).toBe(1);
    expect(oMinus?.charge).toBe(-1);
    expect(nPlus?.hCount).toBe(0);
    expect(oMinus?.hCount).toBe(0);
    // 苯环上 5 个 H
    const ringH = nitro.atoms.filter((a) => a.aromatic).reduce((s, a) => s + a.hCount, 0);
    expect(ringH).toBe(5);
  });

  it('显式 H（[NH2]）', () => {
    const aniline = parseSmiles('Nc1ccccc1');
    expect(formulaOfGraph(aniline)).toBe('C6H7N');
    const amine = parseSmiles('[NH2]C');
    expect(formulaOfGraph(amine)).toBe('CH5N'); // 甲胺
  });

  it('错误输入抛出异常', () => {
    expect(() => parseSmiles('')).toThrow(SmilesParseError);
    expect(() => parseSmiles('C1CC')).toThrow(SmilesParseError); // 未闭合环
    expect(() => parseSmiles('CC(X)C')).toThrow(SmilesParseError);
  });

  it('隐氢规则：双键碳无 H', () => {
    const acetone = parseSmiles('CC(=O)C');
    const o = acetone.atoms.find((a) => a.element === 'O');
    const carbonylC = acetone.atoms[1];
    expect(o?.hCount).toBe(0);
    expect(carbonylC.hCount).toBe(0);
    expect(formulaOfGraph(acetone)).toBe('C3H6O');
  });
});
