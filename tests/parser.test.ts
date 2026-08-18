/**
 * 名称解析 + 结构构建 测试（覆盖需求 1.1 全部示例名称）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseAndBuild, nameToStructure } from '../src/core/naming/pipeline';
import { formulaOfGraph } from '../src/core/chem/graph';
import { initRDKit, parseSmiles } from '../src/core/rdkit';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

/** 需求列出的全部名称 → 期望分子式 */
const CASES: Array<{ name: string; formula: string; refSmiles?: string }> = [
  { name: '丙烷', formula: 'C3H8', refSmiles: 'CCC' },
  { name: '2-甲基丙烷', formula: 'C4H10', refSmiles: 'CC(C)C' },
  { name: '2,3-二甲基己烷', formula: 'C8H18', refSmiles: 'CC(C)C(C)CCC' },
  { name: '2,2,3-三甲基丁烷', formula: 'C7H16', refSmiles: 'CC(C)C(C)(C)C' },
  { name: '正戊烷', formula: 'C5H12', refSmiles: 'CCCCC' },
  { name: '异丁烷', formula: 'C4H10', refSmiles: 'CC(C)C' },
  { name: '1-丁烯', formula: 'C4H8', refSmiles: 'C=CCC' },
  { name: '2-丁烯', formula: 'C4H8', refSmiles: 'CC=CC' },
  { name: '1,3-丁二烯', formula: 'C4H6', refSmiles: 'C=CC=C' },
  { name: '2-丁炔', formula: 'C4H6', refSmiles: 'CC#CC' },
  { name: '乙炔', formula: 'C2H2', refSmiles: 'C#C' },
  { name: '2-溴丁烷', formula: 'C4H9Br', refSmiles: 'CCC(Br)C' },
  { name: '1,2-二溴乙烷', formula: 'C2H4Br2', refSmiles: 'BrCCBr' },
  { name: '乙醇', formula: 'C2H6O', refSmiles: 'CCO' },
  { name: '3-甲基-1-丁醇', formula: 'C5H12O', refSmiles: 'CC(C)CCO' },
  { name: '2-丙醇', formula: 'C3H8O', refSmiles: 'CC(O)C' },
  { name: '乙二醇', formula: 'C2H6O2', refSmiles: 'OCCO' },
  { name: '乙醛', formula: 'C2H4O', refSmiles: 'CC=O' },
  { name: '丙醛', formula: 'C3H6O', refSmiles: 'CCC=O' },
  { name: '丙酮', formula: 'C3H6O', refSmiles: 'CC(=O)C' },
  { name: '2-丁酮', formula: 'C4H8O', refSmiles: 'CCC(=O)C' },
  { name: '乙酸', formula: 'C2H4O2', refSmiles: 'CC(=O)O' },
  { name: '2-甲基丙酸', formula: 'C4H8O2', refSmiles: 'CC(C)C(=O)O' },
  { name: '苯甲酸', formula: 'C7H6O2', refSmiles: 'O=C(O)c1ccccc1' },
  { name: '乙酸乙酯', formula: 'C4H8O2', refSmiles: 'CCOC(C)=O' },
  { name: '甲酸甲酯', formula: 'C2H4O2', refSmiles: 'COC=O' },
  { name: '甲苯', formula: 'C7H8', refSmiles: 'Cc1ccccc1' },
  { name: '苯酚', formula: 'C6H6O', refSmiles: 'Oc1ccccc1' },
  { name: '对二甲苯', formula: 'C8H10', refSmiles: 'Cc1ccc(C)cc1' },
  { name: '硝基苯', formula: 'C6H5NO2', refSmiles: 'O=[N+]([O-])c1ccccc1' },
];

describe('名称解析与构建（全量示例）', () => {
  beforeAll(async () => {
    await initRDKit(() => WASM_PATH);
  }, 60000);

  for (const c of CASES) {
    it(`解析并构建「${c.name}」→ ${c.formula}`, async () => {
      const r = parseAndBuild(c.name);
      expect(r.ok, r.error?.message).toBe(true);
      expect(r.smiles).toBeTruthy();
      const formula = formulaOfGraph(r.built!.graph);
      expect(formula).toBe(c.formula);
    });
  }

  for (const c of CASES) {
    if (!c.refSmiles) continue;
    it(`RDKit 规范化「${c.name}」与参照一致`, async () => {
      const r = await nameToStructure(c.name);
      expect(r.ok, r.error?.message).toBe(true);
      const ref = await parseSmiles(c.refSmiles!);
      expect(ref.ok).toBe(true);
      if (ref.ok) {
        expect(r.canonicalSmiles).toBe(ref.canonical);
      }
    });
  }
});

describe('容错输入', () => {
  it('全角逗号', () => {
    const r = parseAndBuild('2，3-二甲基己烷');
    expect(r.ok).toBe(true);
    expect(formulaOfGraph(r.built!.graph)).toBe('C8H18');
  });
  it('多余空格', () => {
    const r = parseAndBuild(' 2-甲基丙烷 ');
    expect(r.ok).toBe(true);
  });
  it('中文数字位置', () => {
    const r = parseAndBuild('二三-二甲基己烷');
    expect(r.ok).toBe(true);
  });
  it('无逗号位置串', () => {
    const r = parseAndBuild('23-二甲基己烷');
    expect(r.ok).toBe(true);
    expect(formulaOfGraph(r.built!.graph)).toBe('C8H18');
  });
});

describe('非法名称提示', () => {
  it('位置越界', () => {
    const r = parseAndBuild('5-甲基丙烷');
    expect(r.ok).toBe(false);
    expect(r.error?.message).toContain('超出');
  });
  it('无法识别的取代基', () => {
    const r = parseAndBuild('2-甲某基丙烷');
    expect(r.ok).toBe(false);
  });
  it('空输入', () => {
    const r = parseAndBuild('');
    expect(r.ok).toBe(false);
  });
});

describe('错误名称的结构构建（供诊断用）', () => {
  it('3-甲基丁烷可构建出结构（编号错误）', () => {
    const r = parseAndBuild('3-甲基丁烷');
    expect(r.ok).toBe(true);
    expect(formulaOfGraph(r.built!.graph)).toBe('C5H12');
  });
  it('1-甲基丙烷可构建（实质为丁烷）', () => {
    const r = parseAndBuild('1-甲基丙烷');
    expect(r.ok).toBe(true);
    expect(formulaOfGraph(r.built!.graph)).toBe('C4H10');
  });
  it('2-乙基丙烷可构建（实质为 2-甲基丁烷）', () => {
    const r = parseAndBuild('2-乙基丙烷');
    expect(r.ok).toBe(true);
    expect(formulaOfGraph(r.built!.graph)).toBe('C5H12');
  });
});
