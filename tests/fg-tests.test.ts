/**
 * 6.4 官能团检验数据（FgTest）验收
 * 六组（aldehyde/carboxyl/alkene/alkyne/halogen/hydroxyl）tests 数据完整性；
 * 其他组 tests 可选缺省不报错；highlightFunctionalGroup 行为由 fgExamples 回归。
 */
import { describe, it, expect } from 'vitest';
import { FUNCTIONAL_GROUPS, type FunctionalGroupDef } from '../src/core/chem/fgroups';

const byId = (id: string): FunctionalGroupDef => {
  const g = FUNCTIONAL_GROUPS.find((x) => x.id === id);
  expect(g, `缺少官能团组 ${id}`).toBeTruthy();
  return g!;
};

describe('6.4 官能团检验数据（FgTest）', () => {
  it('六组 tests 非空；name/reagent/phenomenon 非空；condition 允许为空串（无特别条件时省略，如石蕊试液/FeCl₃ 显色）', () => {
    for (const id of ['aldehyde', 'carboxyl', 'alkene', 'alkyne', 'halogen', 'hydroxyl']) {
      const g = byId(id);
      expect(g.tests, `${id} 应有 tests`).toBeTruthy();
      for (const t of g.tests!) {
        expect(t.name.length, `${id} name`).toBeGreaterThan(0);
        expect(t.reagent.length, `${id} reagent`).toBeGreaterThan(0);
        expect(typeof t.condition, `${id} condition`).toBe('string');
        expect(t.phenomenon.length, `${id} phenomenon`).toBeGreaterThan(0);
      }
    }
  });

  it('醛基：银镜反应（水浴加热）+ 新制氢氧化铜', () => {
    const t = byId('aldehyde').tests!;
    expect(t).toHaveLength(2);
    expect(t[0].name).toBe('银镜反应');
    expect(t[0].condition).toBe('水浴加热');
    expect(t[0].equation).toBeTruthy();
    expect(t.some((x) => x.name.includes('银镜'))).toBe(true);
    expect(t.some((x) => x.name.includes('氢氧化铜'))).toBe(true);
  });

  it('羧基：碳酸氢钠 + 石蕊试液', () => {
    const t = byId('carboxyl').tests!;
    expect(t).toHaveLength(2);
    expect(t[0].name).toBe('碳酸氢钠');
    expect(t[0].equation).toBeTruthy();
    expect(t.some((x) => x.name.includes('石蕊'))).toBe(true);
  });

  it('碳碳双键/三键：溴水 + 酸性 KMnO₄ 各 2 条', () => {
    for (const id of ['alkene', 'alkyne']) {
      const t = byId(id).tests!;
      expect(t, id).toHaveLength(2);
      expect(t.map((x) => x.name)).toEqual(['溴水', '酸性 KMnO₄']);
    }
  });

  it('卤素：水解后硝酸银检验（1 条，现象含沉淀）', () => {
    const t = byId('halogen').tests!;
    expect(t).toHaveLength(1);
    expect(t[0].name).toBe('水解后硝酸银检验');
    expect(t[0].phenomenon).toContain('沉淀');
  });

  it('羟基：两条均带「（仅酚羟基）」前缀，desc 注明仅对酚羟基', () => {
    const g = byId('hydroxyl');
    expect(g.tests).toHaveLength(2);
    for (const t of g.tests!) expect(t.name.startsWith('（仅酚羟基）'), t.name).toBe(true);
    expect(g.desc).toContain('仅对酚羟基');
  });

  it('其他组（ester/carbonyl/ether/nitrile/nitro/amino/benzene）不填 tests 不报错', () => {
    for (const id of ['ester', 'carbonyl', 'ether', 'nitrile', 'nitro', 'amino', 'benzene']) {
      expect(byId(id).tests, `${id} 应为可选缺省`).toBeUndefined();
    }
    const ids = FUNCTIONAL_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length); // id 唯一
  });
});
