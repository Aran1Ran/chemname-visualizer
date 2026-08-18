/**
 * 包 B（第四节 4.5~4.8：醚/腈/酰胺/芳香族扩展/环烯环烷）验收
 * 存量（醚 12 例、乙腈、苯乙烯、对硝基甲苯、氯代甲苯、对二氯苯、二甲苯、
 * 环烷 7 例、邻/对氯甲苯）由 extended/banknames 既有断言自动回归，本文件
 * 只固化缺口锚点；断言一律教材写法（邻/间/对、省略位次规则）。
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

/** 俗名等价：a↔b 同构，且 a 反向输出系统名 b */
function commonEq(a: string, b: string, formula: string) {
  const ga = build(a, formula);
  const gb = build(b, formula);
  expect(sameGraph(ga.graph, gb.graph), `${a} 与 ${b} 应同构`).toBe(true);
  const n = nameGraph(ga.graph);
  expect(n.ok, `${a} 反向命名失败`).toBe(true);
  expect(n.name, `${a} 反向应输出系统名`).toBe(b);
}

describe('包B · 四.6 腈与酰胺', () => {
  it('丙烯腈 → C3H3N，反向 2-丙烯腈', () => {
    roundTrip('丙烯腈', 'C3H3N', '2-丙烯腈');
  });
  it('乙酰胺 → C2H5NO 互逆', () => {
    roundTrip('乙酰胺', 'C2H5NO', '乙酰胺');
  });
  it('判题：乙酰胺 判对（CC(=O)N）', async () => {
    expect((await judgeAnswer('CC(=O)N', '乙酰胺')).correct).toBe(true);
  });
});

describe('包B · 四.7 芳香族扩展', () => {
  it('苯乙炔 → C8H6 互逆', () => {
    roundTrip('苯乙炔', 'C8H6', '苯乙炔');
  });
  it('1,2,3-三甲苯 → C9H12 互逆（反向"三甲苯"教材简写，非"三甲基苯"）', () => {
    roundTrip('1,2,3-三甲苯', 'C9H12', '1,2,3-三甲苯');
  });
  it('2,4,6-三硝基甲苯 → C7H5N3O6 可解析出结构（反向可达，不锁全串）', () => {
    const built = build('2,4,6-三硝基甲苯', 'C7H5N3O6');
    const n = nameGraph(built.graph);
    expect(n.ok, `TNT 反向失败: ${n.error}`).toBe(true);
  });
  it('邻/对羟基苯甲酸 → C7H6O3 互逆（教材邻/间/对写法）', () => {
    roundTrip('邻羟基苯甲酸', 'C7H6O3', '邻羟基苯甲酸');
    roundTrip('对羟基苯甲酸', 'C7H6O3', '对羟基苯甲酸');
  });
  it('水杨酸（俗名）↔ 邻羟基苯甲酸 同构，反向输出邻羟基苯甲酸', () => {
    commonEq('水杨酸', '邻羟基苯甲酸', 'C7H6O3');
  });
  it('阿司匹林/乙酰水杨酸 → C9H8O4 可解析可显示，两者同构（反向不锁全串）', () => {
    const a = build('阿司匹林', 'C9H8O4');
    const b = build('乙酰水杨酸', 'C9H8O4');
    expect(sameGraph(a.graph, b.graph), '阿司匹林 与 乙酰水杨酸 应同构').toBe(true);
    expect(nameGraph(a.graph).ok).toBe(true);
  });
});

describe('包B · 四.8 环烯与环烷取代', () => {
  it('甲基环己烷 → C7H14 互逆', () => {
    roundTrip('甲基环己烷', 'C7H14', '甲基环己烷');
  });
  it('环己烯 → C6H10 互逆，结构 C1CCCC=C1（双键存在，非 C1CCCCC1）', () => {
    const built = build('环己烯', 'C6H10');
    roundTrip('环己烯', 'C6H10', '环己烯');
    const ref = parseSmiles('C1CCCC=C1');
    expect(sameGraph(built.graph, ref), '环己烯应为 C1CCCC=C1').toBe(true);
    expect(sameGraph(built.graph, parseSmiles('C1CCCCC1')), '环己烯不应为环己烷').toBe(false);
  });
  it('1-甲基环己烯 → C7H12 互逆，反向保留「1-」（位次从取代基起算）', () => {
    const n = roundTrip('1-甲基环己烯', 'C7H12', '1-甲基环己烯');
    expect(n).toContain('1-');
  });
});

describe('包B · 存量防回归抽检（TNT 分支不得误伤邻/间/对写法）', () => {
  it('邻氯甲苯/对氯甲苯 反向仍为邻/对写法（非 TNT 多取代路径）', () => {
    roundTrip('邻氯甲苯', 'C7H7Cl', '邻氯甲苯');
    roundTrip('对氯甲苯', 'C7H7Cl', '对氯甲苯');
  });
  it('对二氯苯 互逆（对位写法）', () => {
    roundTrip('对二氯苯', 'C6H4Cl2', '对二氯苯');
  });
});
