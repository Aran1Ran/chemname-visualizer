/**
 * 批 5 验收：#4 数据层补全（builder）
 * substituentGroups.atomIndices 补为取代基全部原子（连通域）、
 * fgAtomIndices 补烯/炔双键两端碳（母体为烯/炔时取代基原子并入）。
 */
import { describe, it, expect } from 'vitest';
import { parseAndBuild } from '../src/core/naming/pipeline';

function build(name: string) {
  const r = parseAndBuild(name);
  expect(r.ok, `${name} 解析失败: ${r.error?.message}`).toBe(true);
  return r.built!;
}

describe('批5 · #4 数据层补全（builder）', () => {
  it('2,2-二甲基-3-乙基己烷：乙基组含 [8,9]（根+末端），甲基组含 [6,7]', () => {
    const b = build('2,2-二甲基-3-乙基己烷');
    const ethyl = b.substituentGroups.find((g) => g.name === '乙基');
    const methyl = b.substituentGroups.find((g) => g.name === '甲基');
    expect(ethyl, '应含乙基组').toBeTruthy();
    expect(ethyl!.atomIndices.slice().sort((a, c) => a - c)).toEqual([8, 9]);
    expect(methyl, '应含甲基组').toBeTruthy();
    expect(methyl!.atomIndices.slice().sort((a, c) => a - c)).toEqual([6, 7]);
  });

  it('2-甲基-1,3-丁二烯：fgAtomIndices 含双键碳 [0,1,2,3] 与甲基 [4]', () => {
    const b = build('2-甲基-1,3-丁二烯');
    expect(b.fgAtomIndices.slice().sort((a, c) => a - c)).toEqual([0, 1, 2, 3, 4]);
  });

  it('回归：乙酸乙酯 fgAtomIndices 仍为 [4,5]（酯分支未动）', () => {
    const b = build('乙酸乙酯');
    expect(b.fgAtomIndices.slice().sort((a, c) => a - c)).toEqual([4, 5]);
  });

  it('多原子取代基：3-乙基戊烷 乙基长度 2；2-异丙基戊烷 异丙基长度 3', () => {
    const e = build('3-乙基戊烷');
    const ethyl = e.substituentGroups.find((g) => g.name === '乙基');
    expect(ethyl, '3-乙基戊烷应含乙基组').toBeTruthy();
    expect(ethyl!.atomIndices.length).toBe(2);
    const ip = build('2-异丙基戊烷');
    const isopropyl = ip.substituentGroups.find((g) => g.name === '异丙基');
    expect(isopropyl, '2-异丙基戊烷应含异丙基组').toBeTruthy();
    expect(isopropyl!.atomIndices.length).toBe(3);
  });

  it('邻氯甲苯：各取代基 atomIndices 不含芳香原子', () => {
    const b = build('邻氯甲苯');
    const aromatic = new Set(b.graph.atoms.map((a, i) => (a.aromatic ? i : -1)).filter((i) => i >= 0));
    for (const g of b.substituentGroups) {
      for (const i of g.atomIndices) {
        expect(aromatic.has(i), `${g.name} 不应含芳香原子 ${i}`).toBe(false);
      }
    }
  });

  it('烯母体：2-丁烯 fgAtomIndices=[1,2]；环己烯 fgAtomIndices 长度 2', () => {
    const b1 = build('2-丁烯');
    expect(b1.fgAtomIndices.slice().sort((a, c) => a - c)).toEqual([1, 2]);
    const b2 = build('环己烯');
    expect(b2.fgAtomIndices.length).toBe(2);
  });

  it('2-甲基-1,3-丁二烯 chainAtomIndices = [0,1,2,3]', () => {
    const b = build('2-甲基-1,3-丁二烯');
    expect(b.chainAtomIndices.slice().sort((a, c) => a - c)).toEqual([0, 1, 2, 3]);
  });
});
