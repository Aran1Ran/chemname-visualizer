/**
 * 高考大题向导（6.2 同分异构体条件枚举）验收：
 * isomerEnum.ts 计数矩阵 / 候选推导顺序 / 不支持组合降级 / 名称抽检（教材写法）/
 * 分步分组 / 与预设数据集一致（RDKit canonical）/ IsomerBrowser 服务端渲染冒烟。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { analyzeFormula, enumerateIsomers, type EnumQuery, type EnumResult, type IsomerClass } from '../src/core/chem/isomerEnum';
import { parseSmiles, formulaOfGraph } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { initRDKit, parseSmiles as rdParse } from '../src/core/rdkit';
import { ISOMER_SETS } from '../src/data/isomerSets';
import { IsomerBrowser } from '../src/components/tools/IsomerBrowser';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

/** 锚点矩阵：分子式 + 类 → 期望数（后端交接矩阵） */
const ANCHORS: Array<{ formula: string; classes: IsomerClass[]; count: number; label: string }> = [
  { formula: 'C4H9Cl', classes: ['monohalo'], count: 4, label: '一氯丁烷' },
  { formula: 'C3H6Cl2', classes: ['dihalo'], count: 4, label: '二氯丙烷' },
  { formula: 'C4H8Cl2', classes: ['dihalo'], count: 9, label: '二氯丁烷' },
  { formula: 'C4H8O2', classes: ['acid', 'ester'], count: 6, label: '羧酸+酯' },
  { formula: 'C5H10O2', classes: ['ester'], count: 9, label: '酯' },
  { formula: 'C8H10O', classes: ['phenol', 'aromatic-ether', 'aromatic-alcohol'], count: 15, label: '含苯环' },
  { formula: 'C5H12', classes: ['alkane'], count: 3, label: '戊烷' },
  { formula: 'C6H14', classes: ['alkane'], count: 5, label: '己烷' },
];

function run(q: EnumQuery): EnumResult {
  const r = enumerateIsomers(q);
  expect(r.supported, `${q.formula} 应 supported，warning: ${r.warning ?? ''}`).toBe(true);
  return r;
}

describe('高考大题向导 · 分子式分析（analyzeFormula）', () => {
  it('C4H8O2：Ω=1，候选顺序 acid/ester 先于 aldehyde/ketone', () => {
    const a = analyzeFormula('C4H8O2');
    expect(a.ok).toBe(true);
    expect(a.dbe).toBe(1);
    expect(a.elements).toEqual({ C: 4, H: 8, O: 2 });
    const keys = a.candidates.map((c) => c.klass);
    expect(keys.slice(0, 2)).toEqual(['acid', 'ester']);
    expect(keys.indexOf('acid')).toBeLessThan(keys.indexOf('aldehyde'));
    expect(keys.indexOf('ester')).toBeLessThan(keys.indexOf('ketone'));
    // 通式不符的醛/酮候选标记不兼容（C4H8O2 含 2 个 O，醛/酮通式 CnH2nO 需 1 个 O）
    expect(a.candidates.filter((c) => c.enumerable).map((c) => c.klass)).toEqual(['acid', 'ester']);
    const aldehyde = a.candidates.find((c) => c.klass === 'aldehyde')!;
    const ketone = a.candidates.find((c) => c.klass === 'ketone')!;
    expect(aldehyde.enumerable).toBe(false);
    expect(aldehyde.incompatible).toContain('通式');
    expect(ketone.enumerable).toBe(false);
    expect(ketone.incompatible).toContain('通式');
    expect(a.candidates[0].reason).toContain('优先考虑羧酸');
  });

  it('C4H8：烯烃/环烷烃候选可枚举（MISSING-009：C3~C6 支持枚举，顺反不计）', () => {
    const a = analyzeFormula('C4H8');
    expect(a.ok).toBe(true);
    expect(a.dbe).toBe(1);
    const alkene = a.candidates.find((c) => c.klass === 'alkene');
    expect(alkene).toBeTruthy();
    expect(alkene!.enumerable).toBe(true);
    const cyclo = a.candidates.find((c) => c.klass === 'cycloalkane');
    expect(cyclo).toBeTruthy();
    expect(cyclo!.enumerable).toBe(true);
    // C7+ 超出教学范围 → 候选置灰
    const a7 = analyzeFormula('C7H14');
    expect(a7.candidates.find((c) => c.klass === 'alkene')!.enumerable).toBe(false);
  });

  it('C8H10O：Ω=4，酚/芳香醚/芳香醇候选均可枚举', () => {
    const a = analyzeFormula('C8H10O');
    expect(a.ok).toBe(true);
    expect(a.dbe).toBe(4);
    for (const k of ['phenol', 'aromatic-ether', 'aromatic-alcohol']) {
      const c = a.candidates.find((x) => x.klass === k);
      expect(c, `${k} 候选`).toBeTruthy();
      expect(c!.enumerable, `${k} 应可枚举`).toBe(true);
    }
  });

  it('C11H24：超出教学范围（碳数需 1~10），warning 提示不崩溃', () => {
    const a = analyzeFormula('C11H24');
    expect(a.ok).toBe(false);
    expect(a.warning).toContain('碳数需在 1~10');
  });

  it('非法输入（空串/不支持原子）：ok=false 且有 warning，不抛错', () => {
    expect(() => analyzeFormula('')).not.toThrow();
    expect(analyzeFormula('').ok).toBe(false);
    const a = analyzeFormula('SiH4');
    expect(a.ok).toBe(false);
    expect(a.warning).toBeTruthy();
  });

  it('下标字符输入（C₈H₈O₂，课件/文档复制常见）应归一化识别', () => {
    const a = analyzeFormula('C₈H₈O₂');
    expect(a.ok, a.warning).toBe(true);
    expect(a.elements).toEqual({ C: 8, H: 8, O: 2 });
  });

  it('C8H8O2（Ω=5：苯环+羰基，如苯甲酸甲酯/甲基苯甲酸）：候选不应为空', () => {
    const a = analyzeFormula('C8H8O2');
    expect(a.ok).toBe(true);
    expect(a.dbe).toBe(5);
    expect(a.candidates.length, `候选应包含芳香酸/酯类，当前为空（${a.dbeNote}）`).toBeGreaterThan(0);
  });
});

describe('高考大题向导 · 枚举计数矩阵（锚点 8 项）', () => {
  for (const an of ANCHORS) {
    it(`${an.formula} + ${an.label} = ${an.count} 种：supported、分步扁平化一致、产物可解析且命名互逆`, () => {
      const r = run({ formula: an.formula, classes: an.classes });
      expect(r.count).toBe(an.count);
      expect(r.isomers).toHaveLength(an.count);
      // stages 扁平化产物 = isomers（去重后集合一致）
      const flat = r.stages!.flatMap((s) => s.groups.flatMap((g) => g.isomers));
      expect(flat.length).toBe(an.count);
      expect(new Set(flat.map((i) => i.smiles))).toEqual(new Set(r.isomers.map((i) => i.smiles)));
      // 每个产物：分子式正确、可解析、命名互逆
      for (const iso of r.isomers) {
        expect(iso.formula).toBe(an.formula);
        let g: ReturnType<typeof parseSmiles>;
        expect(() => {
          g = parseSmiles(iso.smiles);
        }, `${iso.smiles} 应可解析`).not.toThrow();
        expect(formulaOfGraph(g!)).toBe(an.formula);
        const n = nameGraph(g!);
        expect(n.ok, `${iso.smiles} 命名失败: ${n.error}`).toBe(true);
        expect(n.name, `${iso.smiles} 命名与枚举 name 不一致`).toBe(iso.name);
      }
    });
  }

  it('C4H8O2 酸+酯：酸 2 种、酯 4 种（共 6）', () => {
    const r = run({ formula: 'C4H8O2', classes: ['acid', 'ester'] });
    expect(r.isomers.filter((i) => i.klass === 'acid')).toHaveLength(2);
    expect(r.isomers.filter((i) => i.klass === 'ester')).toHaveLength(4);
  });

  it('C8H10O：酚 9、芳香醚 4、芳香醇 2（共 15）', () => {
    const r = run({ formula: 'C8H10O', classes: ['phenol', 'aromatic-ether', 'aromatic-alcohol'] });
    expect(r.isomers.filter((i) => i.klass === 'phenol')).toHaveLength(9);
    expect(r.isomers.filter((i) => i.klass === 'aromatic-ether')).toHaveLength(4);
    expect(r.isomers.filter((i) => i.klass === 'aromatic-alcohol')).toHaveLength(2);
  });

  it('锚点组与预设数据集一致（RDKit canonical 集合覆盖）', async () => {
    for (const an of ANCHORS) {
      const set = ISOMER_SETS.find((s) => s.formula === an.formula);
      if (!set) continue;
      const r = run({ formula: an.formula, classes: an.classes });
      const canon = async (smiles: string): Promise<string> => {
        const rr = await rdParse(smiles);
        if (!rr.ok) throw new Error(`RDKit 解析失败: ${smiles}: ${rr.reason}`);
        return rr.canonical;
      };
      const enumSet = new Set<string>();
      for (const iso of r.isomers) enumSet.add(await canon(iso.smiles));
      for (const entry of set.isomers) {
        const c = await canon(entry.smiles);
        expect(enumSet.has(c), `${an.formula} 数据集条目「${entry.name}」(${entry.smiles}) 不在枚举结果中`).toBe(true);
      }
      expect(enumSet.size).toBe(an.count);
    }
  });
});

describe('高考大题向导 · 名称抽检（教材写法）', () => {
  it('C8H10O：15 个名称两两不同，关键名称各出现一次', () => {
    const r = run({ formula: 'C8H10O', classes: ['phenol', 'aromatic-ether', 'aromatic-alcohol'] });
    const names = r.isomers.map((i) => i.name);
    expect(names).toHaveLength(15);
    expect(new Set(names).size).toBe(15);
    for (const want of [
      '邻乙基苯酚', '间乙基苯酚', '对乙基苯酚',
      '2,6-二甲酚', '3,5-二甲酚',
      '邻甲基苯甲醚', '苯乙醚', '苯乙醇', '1-苯乙醇',
    ]) {
      expect(names.filter((n) => n === want).length, `「${want}」应恰好出现 1 次`).toBe(1);
    }
  });

  it('C5H10O2 酯：9 个名称各出现一次（甲酸丁酯 4 + 乙酸丙酯 2 + 丙酸乙酯 1 + 丁酸甲酯 1 + 2-甲基丙酸甲酯 1）', () => {
    const r = run({ formula: 'C5H10O2', classes: ['ester'] });
    const names = r.isomers.map((i) => i.name);
    expect(names).toHaveLength(9);
    for (const want of [
      '甲酸叔丁酯', '甲酸仲丁酯', '甲酸异丁酯', '甲酸丁酯',
      '乙酸丙酯', '乙酸异丙酯',
      '丙酸乙酯', '丁酸甲酯', '2-甲基丙酸甲酯',
    ]) {
      expect(names.filter((n) => n === want).length, `「${want}」应恰好出现 1 次`).toBe(1);
    }
  });

  it('C4H9Cl：位次写法为教材式（链长 3 需位次），无严格 IUPAC 省略', () => {
    const r = run({ formula: 'C4H9Cl', classes: ['monohalo'] });
    const names = r.isomers.map((i) => i.name);
    expect(names).toContain('1-氯丁烷');
    expect(names).toContain('2-氯丁烷');
    expect(names).toContain('1-氯-2-甲基丙烷');
    expect(names).toContain('2-氯-2-甲基丙烷');
    // 禁止出现「1-溴乙烷」式对链长 2 的无谓位次（此处断言链长 2 卤代烃名不带位次）
    expect(names.some((n) => n.includes('1-氯乙烷'))).toBe(false);
  });
});

describe('高考大题向导 · 不支持组合降级（supported=false + warning，不抛错）', () => {
  const CASES: Array<{ formula: string; classes: IsomerClass[]; hint: string }> = [
    { formula: 'C4H9Cl', classes: ['alcohol'], hint: '饱和醇/醚' },
    { formula: 'C9H12O', classes: ['phenol'], hint: '侧链' },
    { formula: 'C7H14', classes: ['alkene', 'cycloalkane'], hint: 'C3~C6' },
  ];
  for (const c of CASES) {
    it(`${c.formula} + ${c.classes.join('/')} → supported=false + warning「${c.hint}」`, () => {
      expect(() => {
        const r = enumerateIsomers({ formula: c.formula, classes: c.classes });
        expect(r.supported).toBe(false);
        expect(r.count).toBe(0);
        expect(r.isomers).toHaveLength(0);
        expect(r.warning).toBeTruthy();
        expect(r.warning!).toContain(c.hint);
      }).not.toThrow();
    });
  }

  it('C4H8 + 烯烃/环烷烃 = 5（MISSING-009 已支持，顺反不计）', () => {
    const r = enumerateIsomers({ formula: 'C4H8', classes: ['alkene', 'cycloalkane'] });
    expect(r.supported, r.warning).toBe(true);
    expect(r.count).toBe(5);
  });

  it('未选择任何类别 → supported=false + warning', () => {
    const r = enumerateIsomers({ formula: 'C4H8O2', classes: [] });
    expect(r.supported).toBe(false);
    expect(r.warning).toContain('未指定');
  });
});

describe('高考大题向导 · 分步枚举分组', () => {
  it('C5H10O2 酯：四组拆分 1+4 / 2+3 / 3+2 / 4+1（数量 4/2/1/2）', () => {
    const r = run({ formula: 'C5H10O2', classes: ['ester'] });
    const groups = r.stages!.flatMap((s) => s.groups);
    const byTitle = (t: string) => groups.find((g) => g.title === t)?.isomers.length ?? -1;
    expect(byTitle('酸 1 碳 + 醇 4 碳')).toBe(4);
    expect(byTitle('酸 2 碳 + 醇 3 碳')).toBe(2);
    expect(byTitle('酸 3 碳 + 醇 2 碳')).toBe(1);
    expect(byTitle('酸 4 碳 + 醇 1 碳')).toBe(2);
  });

  it('C4H8O2 酸+酯：两段（碳链异构 → 酯的拆分），含 1+3 组', () => {
    const r = run({ formula: 'C4H8O2', classes: ['acid', 'ester'] });
    expect(r.stages!.map((s) => s.label)).toEqual(['碳链异构', '酯的拆分']);
    const titles = r.stages!.flatMap((s) => s.groups.map((g) => g.title));
    expect(titles).toContain('酸 1 碳 + 醇 3 碳');
  });

  it('C4H9Cl：两段展示（碳链异构 → 位置异构）', () => {
    const r = run({ formula: 'C4H9Cl', classes: ['monohalo'] });
    expect(r.stages!.map((s) => s.label)).toEqual(['碳链异构', '位置异构']);
  });

  it('C8H10O：官能团异构→苯环定位 重复三段（每类一段），酚/醚/醇分组齐全', () => {
    const r = run({ formula: 'C8H10O', classes: ['phenol', 'aromatic-ether', 'aromatic-alcohol'] });
    const labels = r.stages!.map((s) => s.label);
    expect(labels.filter((l) => l === '官能团异构')).toHaveLength(3);
    expect(labels.filter((l) => l === '苯环定位')).toHaveLength(3);
    const titles = r.stages!.flatMap((s) => s.groups.map((g) => g.title));
    expect(titles).toContain('酚（9 种）');
    expect(titles).toContain('醚（4 种）');
    expect(titles).toContain('醇（2 种）');
  });
});

describe('高考大题向导 · 芳香醛/酸/酯枚举（裁定 A，Ω=5）', () => {
  const CARBONYL_ANCHORS: Array<{ formula: string; classes: IsomerClass[]; count: number; label: string }> = [
    { formula: 'C7H6O', classes: ['aromatic-aldehyde'], count: 1, label: '芳香醛' },
    { formula: 'C7H6O2', classes: ['aromatic-acid'], count: 1, label: '芳香酸' },
    { formula: 'C8H8O', classes: ['aromatic-aldehyde'], count: 4, label: '芳香醛' },
    { formula: 'C8H8O2', classes: ['aromatic-acid'], count: 4, label: '芳香酸' },
    { formula: 'C8H8O2', classes: ['aromatic-ester'], count: 3, label: '芳香酯' },
    { formula: 'C8H8O2', classes: ['aromatic-acid', 'aromatic-ester'], count: 7, label: '芳香酸+芳香酯' },
  ];
  for (const an of CARBONYL_ANCHORS) {
    it(`${an.formula} + ${an.label} = ${an.count} 种：supported、产物可解析且命名互逆`, () => {
      const r = run({ formula: an.formula, classes: an.classes });
      expect(r.count).toBe(an.count);
      expect(r.isomers).toHaveLength(an.count);
      for (const iso of r.isomers) {
        expect(iso.formula).toBe(an.formula);
        let g: ReturnType<typeof parseSmiles>;
        expect(() => {
          g = parseSmiles(iso.smiles);
        }, `${iso.smiles} 应可解析`).not.toThrow();
        expect(formulaOfGraph(g!)).toBe(an.formula);
        const n = nameGraph(g!);
        expect(n.ok, `${iso.smiles} 命名失败: ${n.error}`).toBe(true);
        expect(n.name, `${iso.smiles} 命名与枚举 name 不一致`).toBe(iso.name);
      }
    });
  }

  it('C9H10O2 + 芳香酸：侧链 k=3 超范围 → supported=false + warning，不抛错', () => {
    expect(() => {
      const r = enumerateIsomers({ formula: 'C9H10O2', classes: ['aromatic-acid'] });
      expect(r.supported).toBe(false);
      expect(r.count).toBe(0);
      expect(r.warning).toBeTruthy();
      expect(r.warning!).toContain('1~2 碳');
    }).not.toThrow();
  });

  it('名称抽检：C8H8O 芳香醛 4 名称（苯乙醛 + 邻/间/对甲基苯甲醛）', () => {
    const r = run({ formula: 'C8H8O', classes: ['aromatic-aldehyde'] });
    const names = r.isomers.map((i) => i.name);
    for (const want of ['苯乙醛', '邻甲基苯甲醛', '间甲基苯甲醛', '对甲基苯甲醛']) {
      expect(names.filter((n) => n === want).length, `「${want}」应恰好出现 1 次`).toBe(1);
    }
  });

  it('名称抽检：C8H8O2 芳香酸 4 名称（苯乙酸 + 3 甲基苯甲酸）', () => {
    const r = run({ formula: 'C8H8O2', classes: ['aromatic-acid'] });
    const names = r.isomers.map((i) => i.name);
    for (const want of ['苯乙酸', '邻甲基苯甲酸', '间甲基苯甲酸', '对甲基苯甲酸']) {
      expect(names.filter((n) => n === want).length, `「${want}」应恰好出现 1 次`).toBe(1);
    }
  });

  it('名称抽检：C8H8O2 芳香酯 3 名称（苯甲酸甲酯/乙酸苯酯/甲酸苄酯）', () => {
    const r = run({ formula: 'C8H8O2', classes: ['aromatic-ester'] });
    const names = r.isomers.map((i) => i.name);
    for (const want of ['苯甲酸甲酯', '乙酸苯酯', '甲酸苄酯']) {
      expect(names.filter((n) => n === want).length, `「${want}」应恰好出现 1 次`).toBe(1);
    }
  });

  it('候选：C8H8O2 含 aromatic-acid/aromatic-ester 且 enumerable=true；C9H10O2 候选 enumerable=false（k 超范围置灰）', () => {
    const a8 = analyzeFormula('C8H8O2');
    expect(a8.candidates.some((c) => c.klass === 'aromatic-acid' && c.enumerable)).toBe(true);
    expect(a8.candidates.some((c) => c.klass === 'aromatic-ester' && c.enumerable)).toBe(true);
    const a9 = analyzeFormula('C9H10O2');
    const acid = a9.candidates.find((c) => c.klass === 'aromatic-acid');
    expect(acid).toBeTruthy();
    expect(acid!.enumerable).toBe(false);
  });
});

describe('前端冒烟：IsomerBrowser 服务端渲染不抛错', () => {
  it('renderToString 正常输出三卡文案（接口就绪前显示「能力开发中」）', () => {
    let html = '';
    expect(() => {
      html = renderToString(React.createElement(IsomerBrowser));
    }).not.toThrow();
    expect(html).toContain('同分异构体浏览器');
    expect(html).toContain('高考大题模式');
    // node 环境无浏览器：useEffect 不执行 → 动态 import 未跑 → 仍显示降级文案
    expect(html).toContain('能力开发中');
  });
});
