/**
 * RDKit.js Node 环境冒烟测试：验证 wasm 加载与核心服务函数
 * （浏览器端同一条代码路径，locateFile 指向本地 public 中的 wasm）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initRDKit, getMol, formulaOf, substructMatches, molblockOf, inchiOf, parseSmiles } from '../src/core/rdkit';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

describe('RDKit 服务层', () => {
  beforeAll(async () => {
    await initRDKit(() => WASM_PATH);
  }, 60000);

  it('加载成功并获得版本号', async () => {
    const { getRDKit } = await import('../src/core/rdkit');
    const rdkit = await getRDKit();
    expect(rdkit.version()).toMatch(/^\d{4}\./);
  });

  it('解析并规范化 SMILES', async () => {
    const r = await parseSmiles('CC(C)C');
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 2-甲基丙烷的规范 SMILES
      expect(r.canonical).toBe('CC(C)C');
    }
  });

  it('无法解析的 SMILES 返回失败', async () => {
    const r = await parseSmiles('NotARealSmiles');
    expect(r.ok).toBe(false);
  });

  it('计算分子式', async () => {
    // formulaOf 通过 MolBlock 兜底统计
    const f1 = await formulaOf('CC(C)C');
    expect(f1).toBe('C4H10');
    const f2 = await formulaOf('CCO');
    expect(f2).toBe('C2H6O');
    const f3 = await formulaOf('CC(=O)Oc1ccccc1');
    expect(f3).toBe('C8H8O2');
  });

  it('生成带 2D 坐标的 v2000 MolBlock', async () => {
    const mb = await molblockOf('CCC', { coords: true });
    expect(mb).toBeTruthy();
    expect(mb!.includes('V2000')).toBe(true);
    // 坐标存在：原子行 x,y,z 中前两个非零
    const atomLines = mb!.split('\n').slice(4, 4 + 3);
    const hasCoords = atomLines.every((l) => /^\s+[\d.-]+\s+[\d.-]+/.test(l));
    expect(hasCoords).toBe(true);
  });

  it('子结构匹配（羟基）', async () => {
    const matches = await substructMatches('CCO', '[OX2H1]');
    expect(matches.length).toBeGreaterThan(0);
    // 乙醇中羟基 O 是 2 号原子（索引 2）
    expect(matches[0].atoms).toContain(2);
  });

  it('InChI 生成', async () => {
    const inchi = await inchiOf('CC(C)C');
    expect(inchi).toContain('InChI=1S/C4H10');
  });

  it('getMol 缓存复用', async () => {
    const m1 = await getMol('CCC');
    const m2 = await getMol('CCC');
    expect(m1).toBe(m2);
  });
});
