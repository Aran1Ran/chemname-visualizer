/**
 * 包 A（第四节 4.1~4.4 复杂命名）验收
 * 四.1 多取代基组合 / 四.2 卤代烷复杂位次 / 四.3 多官能团（羟基酸/醛、氨基酸）/
 * 四.4 二酸与多元（乙二酸/丁二酸/乙二酸二乙酯）。
 * 断言一律教材写法：不出现"1-溴乙烷"式；3-乙基-2-甲基戊烷等书写顺序以结构等价为准。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseAndBuild } from '../src/core/naming/pipeline';
import { parseSmiles, formulaOfGraph, sameGraph } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { judgeAnswer } from '../src/core/practice/judge';
import { initRDKit } from '../src/core/rdkit';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

/** 解析并断言分子式，返回 built */
function build(name: string, formula: string) {
  const r = parseAndBuild(name);
  expect(r.ok, `${name} 解析失败: ${r.error?.message}`).toBe(true);
  expect(formulaOfGraph(r.built!.graph), `${name} 分子式`).toBe(formula);
  return r.built!;
}

/** 互逆：名称 → 结构 → 反向命名（可选期望反向名） */
function roundTrip(name: string, formula: string, expectName?: string): string {
  const built = build(name, formula);
  const n = nameGraph(built.graph);
  expect(n.ok, `${name} 反向命名失败: ${n.error}`).toBe(true);
  if (expectName !== undefined) expect(n.name, `${name} 反向名`).toBe(expectName);
  return n.name;
}

/** 俗名等价：a↔b 同构，且俗名 a 反向输出系统名 b */
function commonEq(a: string, b: string, formula: string) {
  const ga = build(a, formula);
  const gb = build(b, formula);
  expect(sameGraph(ga.graph, gb.graph), `${a} 与 ${b} 应同构`).toBe(true);
  const n = nameGraph(ga.graph);
  expect(n.ok, `${a} 反向命名失败`).toBe(true);
  expect(n.name, `${a} 反向应输出系统名`).toBe(b);
}

describe('包A · 四.1 多取代基组合', () => {
  const CASES: Array<{ name: string; formula: string; rt?: string }> = [
    { name: '3-乙基-2-甲基戊烷', formula: 'C8H18', rt: '2-甲基-3-乙基戊烷' }, // 位次升序等价名
    { name: '2,4-二甲基-3-乙基戊烷', formula: 'C9H20' },
    { name: '2,2-二甲基-3-乙基己烷', formula: 'C10H22' },
    { name: '3,3-二乙基戊烷', formula: 'C9H20' },
    { name: '2-甲基-1,3-丁二烯', formula: 'C5H8' },
  ];
  for (const c of CASES) {
    it(`${c.name} → ${c.formula}，互逆${c.rt ? `（反向 ${c.rt}）` : ''}`, () => {
      roundTrip(c.name, c.formula, c.rt);
    });
  }
  it('异戊二烯（俗名）↔ 2-甲基-1,3-丁二烯 同构，反向系统名', () => {
    commonEq('异戊二烯', '2-甲基-1,3-丁二烯', 'C5H8');
  });
});

describe('包A · 四.2 卤代烷复杂位次', () => {
  const CASES: Array<{ name: string; formula: string }> = [
    { name: '1,2-二氯乙烷', formula: 'C2H4Cl2' },
    { name: '2,3-二氯丁烷', formula: 'C4H8Cl2' },
    { name: '1,1,2,2-四氯乙烷', formula: 'C2H2Cl4' },
    { name: '2-氯-2-甲基丙烷', formula: 'C4H9Cl' },
  ];
  for (const c of CASES) {
    it(`${c.name} → ${c.formula} 互逆`, () => {
      roundTrip(c.name, c.formula);
    });
  }
  it('判题：2-氯-2-甲基丙烷、1,1,2,2-四氯乙烷 判对', async () => {
    expect((await judgeAnswer('CC(C)(C)Cl', '2-氯-2-甲基丙烷')).correct).toBe(true);
    expect((await judgeAnswer('ClC(Cl)C(Cl)Cl', '1,1,2,2-四氯乙烷')).correct).toBe(true);
  });
});

describe('包A · 四.3 多官能团（羟基酸/羟基醛/氨基酸）', () => {
  const CASES: Array<{ name: string; formula: string }> = [
    { name: '2-羟基丙酸', formula: 'C3H6O3' },
    { name: '4-羟基丁醛', formula: 'C4H8O2' },
    { name: '2-羟基丙醛', formula: 'C3H6O2' },
    { name: '氨基乙酸', formula: 'C2H5NO2' },
    { name: '2-氨基丙酸', formula: 'C3H7NO2' },
  ];
  for (const c of CASES) {
    it(`${c.name} → ${c.formula} 互逆（教材写法，非"O"前缀）`, () => {
      roundTrip(c.name, c.formula);
    });
  }
  it('2-羟基丁二酸 → C4H6O5 可解析出结构（不锁反向全串）', () => {
    const built = build('2-羟基丁二酸', 'C4H6O5');
    const n = nameGraph(built.graph);
    expect(n.ok, `2-羟基丁二酸 反向失败: ${n.error}`).toBe(true);
  });
  it('氨基乙酸结构 = H2NCH2COOH（NCC(=O)O）', () => {
    const built = build('氨基乙酸', 'C2H5NO2');
    const ref = parseSmiles('NCC(=O)O');
    expect(sameGraph(built.graph, ref)).toBe(true);
  });
  it('俗名等价：乳酸/甘氨酸/丙氨酸/苹果酸 ↔ 系统名，反向输出系统名', () => {
    commonEq('乳酸', '2-羟基丙酸', 'C3H6O3');
    commonEq('甘氨酸', '氨基乙酸', 'C2H5NO2');
    commonEq('丙氨酸', '2-氨基丙酸', 'C3H7NO2');
    commonEq('苹果酸', '2-羟基丁二酸', 'C4H6O5');
  });
  it('判题：2-羟基丙酸/氨基乙酸/甘氨酸 判对', async () => {
    expect((await judgeAnswer('CC(O)C(=O)O', '2-羟基丙酸')).correct).toBe(true);
    expect((await judgeAnswer('NCC(=O)O', '氨基乙酸')).correct).toBe(true);
    expect((await judgeAnswer('NCC(=O)O', '甘氨酸')).correct).toBe(true);
  });
});

describe('包A · 四.4 二酸与多元', () => {
  const CASES: Array<{ name: string; formula: string }> = [
    { name: '乙二酸', formula: 'C2H2O4' },
    { name: '丁二酸', formula: 'C4H6O4' },
    { name: '乙二酸二乙酯', formula: 'C6H10O4' },
  ];
  for (const c of CASES) {
    it(`${c.name} → ${c.formula} 互逆`, () => {
      roundTrip(c.name, c.formula);
    });
  }
  it('乙二酸二乙酯结构 = C(=O)(OCC)C(=O)(OCC)', () => {
    const built = build('乙二酸二乙酯', 'C6H10O4');
    const ref = parseSmiles('C(=O)(OCC)C(=O)(OCC)');
    expect(sameGraph(built.graph, ref)).toBe(true);
  });
  it('草酸（俗名）↔ 乙二酸 同构，反向系统名', () => {
    commonEq('草酸', '乙二酸', 'C2H2O4');
  });
  it('判题：乙二酸/乙二酸二乙酯 判对', async () => {
    expect((await judgeAnswer('OC(=O)C(=O)O', '乙二酸')).correct).toBe(true);
    expect((await judgeAnswer('C(=O)(OCC)C(=O)(OCC)', '乙二酸二乙酯')).correct).toBe(true);
  });
});

describe('包A · 边界回归', () => {
  it('溴乙烷/氯甲烷 仍省略位次（教材写法，simpleHalo 放宽未破坏）', () => {
    expect(roundTrip('溴乙烷', 'C2H5Br', '溴乙烷')).toBe('溴乙烷');
    expect(roundTrip('氯甲烷', 'CH3Cl', '氯甲烷')).toBe('氯甲烷');
  });
  it('乙酸二乙酯（单酸+二酯）解析应失败（parseEster 校验）', () => {
    const r = parseAndBuild('乙酸二乙酯');
    expect(r.ok).toBe(false);
  });
});
