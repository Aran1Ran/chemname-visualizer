/**
 * 批 E 验收：E4 测试盲区——builder 链路 condensed 覆盖。
 * 背景：condensed.test.ts 用标准 SMILES 全绿，但 ParsePanel 简式视图走
 * parseAndBuild(name).smiles 的 builder 序列化，曾输出错误串（乙酸乙酯
 * "COOCH2CH3CH3"）漏网。本文件锁定 builder 链路（后端修复后转绿）。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseAndBuild } from '../src/core/naming/pipeline';
import { parseSmiles, formulaOfGraph } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { condensedFormula } from '../src/core/chem/condensed';
import { judgeAnswer } from '../src/core/practice/judge';
import { initRDKit } from '../src/core/rdkit';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

function builderCondensed(name: string): string {
  const r = parseAndBuild(name);
  if (!r.ok) return `PARSE_FAIL: ${r.error?.message}`;
  return condensedFormula(parseSmiles(r.smiles!));
}

describe('批E · E4 builder 链路 condensed（盲区覆盖）', () => {
  it('乙酸乙酯：parseAndBuild 的 smiles → CH3COOCH2CH3（防 builder 错串漏网）', () => {
    expect(builderCondensed('乙酸乙酯')).toBe('CH3COOCH2CH3');
  });
  it('丙酸乙酯：parseAndBuild 的 smiles → CH3CH2COOCH2CH3（不乱序）', () => {
    expect(builderCondensed('丙酸乙酯')).toBe('CH3CH2COOCH2CH3');
  });
  it('甲酸甲酯 builder 链路 → HCOOCH3（回归）', () => {
    expect(builderCondensed('甲酸甲酯')).toBe('HCOOCH3');
  });
  it('联苯 builder 链路 → C6H5-C6H5（回归，不含链式串）', () => {
    expect(builderCondensed('联苯')).toBe('C6H5-C6H5');
  });
});

describe('批E · E1 稠环正向（FUSED_TEMPLATES 模板直建）+ 互逆', () => {
  const CASES: Array<[string, string]> = [
    ['萘', 'C10H8'],
    ['1-甲基萘', 'C11H10'],
    ['2-甲基萘', 'C11H10'],
    ['蒽', 'C14H10'],
    ['2-萘酚', 'C10H8O'],
  ];
  for (const [name, formula] of CASES) {
    it(`${name} → ${formula} 正向解析 + 与反向互逆`, () => {
      const r = parseAndBuild(name);
      expect(r.ok, `${name}: ${r.error?.message}`).toBe(true);
      expect(formulaOfGraph(parseSmiles(r.smiles!)), `${name} 分子式`).toBe(formula);
      const n = nameGraph(parseSmiles(r.smiles!));
      expect(n.ok, `${name} 反向失败: ${n.error}`).toBe(true);
      expect(n.name, `${name} 互逆`).toBe(name);
    });
  }
});

describe('批E · E3-D4 二苯醚正向（COMMON_NAMES 直建）+ 互逆 + 判题', () => {
  it('二苯醚 → C12H10O，反向二苯醚，判题判对', async () => {
    const r = parseAndBuild('二苯醚');
    expect(r.ok, r.error?.message).toBe(true);
    expect(formulaOfGraph(parseSmiles(r.smiles!))).toBe('C12H10O');
    const n = nameGraph(parseSmiles(r.smiles!));
    expect(n.ok, n.error).toBe(true);
    expect(n.name).toBe('二苯醚');
    const j = await judgeAnswer('O(c1ccccc1)c2ccccc2', '二苯醚');
    expect(j.correct, j.feedback.join('; ')).toBe(true);
  });
  it('苯乙醚 回归不破坏', () => {
    const r = parseAndBuild('苯乙醚');
    expect(r.ok, r.error?.message).toBe(true);
    expect(formulaOfGraph(parseSmiles(r.smiles!))).toBe('C8H10O');
  });
});
