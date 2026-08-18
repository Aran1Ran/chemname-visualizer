/**
 * 批 3 验收：枚举候选推导扩展（#6）与烷烃枚举扩展（#7）
 * dbe=2 不饱和酸/酯/二酮候选、含 N 硝基/胺候选、通式不兼容降级（warning 含「通式」）、
 * 烷烃 C7/C8/C9 计数、>10 碳降级。既有枚举锚点由 isomer-enum.test.ts 自动回归。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { analyzeFormula, enumerateIsomers } from '../src/core/chem/isomerEnum';
import { initRDKit, parseSmiles as rdParse } from '../src/core/rdkit';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

describe('批3 · #6 候选推导扩展', () => {
  it('C4H6O2（Ω=2）：候选含 不饱和酸/不饱和酯/二酮，均置灰（enumerable=false），reason 含 Ω=2', () => {
    const a = analyzeFormula('C4H6O2');
    expect(a.ok).toBe(true);
    expect(a.dbe).toBe(2);
    expect(a.candidates.length).toBeGreaterThan(0);
    const keys = a.candidates.map((c) => c.klass);
    expect(keys, `候选=${keys.join(',')}`).toContain('unsaturated-acid');
    expect(keys).toContain('unsaturated-ester');
    expect(keys).toContain('diketone');
    for (const c of a.candidates) {
      expect(c.enumerable, `${c.klass} 应置灰`).toBe(false);
      expect(c.reason, `${c.klass} reason`).toContain('Ω=2');
    }
  });

  it('C8H7NO2（Ω=6）：候选含 硝基/含氮 类且置灰，不抛错', () => {
    const a = analyzeFormula('C8H7NO2');
    expect(a.ok).toBe(true);
    expect(a.dbe).toBe(6);
    expect(a.candidates.length).toBeGreaterThan(0);
    const keys = a.candidates.map((c) => c.klass);
    expect(keys.some((k) => k.includes('nitro') || k.includes('amine')), `候选=${keys.join(',')}`).toBe(true);
    for (const c of a.candidates) expect(c.enumerable, `${c.klass} 应置灰`).toBe(false);
  });

  it('C5H10O2 + 醛/酮：supported=false，warning 含「通式」，不抛错', () => {
    expect(() => {
      const r = enumerateIsomers({ formula: 'C5H10O2', classes: ['aldehyde', 'ketone'] });
      expect(r.supported).toBe(false);
      expect(r.warning).toBeTruthy();
      expect(r.warning!).toContain('通式');
    }).not.toThrow();
  });
});

describe('批3 · #7 烷烃枚举扩展', () => {
  const CASES: Array<{ formula: string; count: number; label: string }> = [
    { formula: 'C7H16', count: 9, label: '庚烷' },
    { formula: 'C8H18', count: 18, label: '辛烷' },
  ];
  for (const c of CASES) {
    it(`${c.label}（${c.formula}）= ${c.count} 种`, () => {
      const r = enumerateIsomers({ formula: c.formula, classes: ['alkane'] });
      expect(r.supported, r.warning).toBe(true);
      expect(r.count).toBe(c.count);
    });
  }

  it('壬烷（C9H20）= 35 种', () => {
    const r = enumerateIsomers({ formula: 'C9H20', classes: ['alkane'] });
    expect(r.supported, r.warning).toBe(true);
    expect(r.count).toBe(35);
  });

  it('癸烷（C10H22）= 75 种，RDKit canonical 去重后仍 75（性能已优化）', async () => {
    const r = enumerateIsomers({ formula: 'C10H22', classes: ['alkane'] });
    expect(r.supported, r.warning).toBe(true);
    expect(r.count).toBe(75);
    const canonSet = new Set<string>();
    for (const iso of r.isomers) {
      const rr = await rdParse(iso.smiles);
      if (!rr.ok) throw new Error(`RDKit 解析失败: ${iso.smiles}: ${rr.reason}`);
      canonSet.add(rr.canonical);
    }
    expect(canonSet.size, 'canonical 去重后应仍为 75（无重复结构）').toBe(75);
  }, 30000);

  it('主链 >10 碳（C11H24）：supported=false + warning 含「主链超过 10 个碳」，不抛错', () => {
    expect(() => {
      const r = enumerateIsomers({ formula: 'C11H24', classes: ['alkane'] });
      expect(r.supported).toBe(false);
      expect(r.count).toBe(0);
      expect(r.warning).toBeTruthy();
      expect(r.warning!).toContain('主链超过 10 个碳');
    }).not.toThrow();
  });
  // 既有锚点（C4H9Cl=4/C4H8Cl2=9/C4H8O2 酸酯=6/C8H10O=15）由 isomer-enum.test.ts 自动回归
});
