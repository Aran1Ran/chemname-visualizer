/**
 * 高考有机大题验证语料测试（可复跑）
 * 数据源：./highschool-corpus.data.ts（CORPUS：输入 + 化学期望）
 *
 * 分节约定：
 *  A. 通过验收（PASS）   —— 当前实现正确的行为，必须保持绿色；
 *  B. 缺陷（BUG）        —— 用 it.fails 固化「当前输出错误、应修复」的行为。
 *                           修复后该测试会报红（表示已修好），届时移除 it.fails 并转入 A 节；
 *  C. 未实现（MISSING）  —— 固化「当前明确不支持」的行为（绿色），开发完成后转 A 节；
 *  D. 范围外（OUT）      —— 预期边界行为（绿色）。
 *
 * 化学期望依据：教材式命名约定、高考考纲口径、RDKit 规范化（canonical 以 RDKit 为准）。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseAndBuild, nameToStructure } from '../src/core/naming/pipeline';
import { parseSmiles, formulaOfGraph } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { analyzeEquivalentH } from '../src/core/chem/symmetry';
import { analyzeCisTrans } from '../src/core/chem/geometric';
import { enumerateIsomers, analyzeFormula } from '../src/core/chem/isomerEnum';
import { judgeAnswer } from '../src/core/practice/judge';
import { initRDKit } from '../src/core/rdkit';
import { FORMULA_ONLY } from '../src/data/formulaOnly';
import { CORPUS } from './highschool-corpus.data';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

const byId = (id: string) => CORPUS.find((c) => c.id === id)!;
const fwdOf = (name: string) => parseAndBuild(name);
const revOf = (smiles: string) => nameGraph(parseSmiles(smiles));
const eqHOf = (smiles: string) => analyzeEquivalentH(parseSmiles(smiles));
const cisOf = (smiles: string) => analyzeCisTrans(parseSmiles(smiles));

// ============ A. 通过验收（PASS） ============

/** 正向解析 + 分子式 全对的用例 */
const PASS_FWD: string[] = [
  '3.1', '3.3', '3.6', '3.7', '4.4', '4.5', '4.6', '4.10', '4.11', '4.12', '4.13', '4.14', '4.16',
  '5.1', '5.4', '5.7', '5.8', '5.9', '5.10', '5.11', '5.12', '5.13', '5.14',
  '6.6', '6.7', '6.9', '6.10', '6.11', '6.12', '7.1', '7.2', '7.3', '7.6', '7.7', '10.6',
  // 批A 转正（MISSING → A 节，16 项）：联苯/二苯甲烷/均三甲苯/3,5-二甲基苯酚/邻间对苯二甲酸/
  // PET 单体/水杨酸甲酯/酒石酸/柠檬酸/苯丙氨酸/四氯化碳/乙酸苯酯/二乙酸乙二酯/草酸二乙酯
  '1.1', '1.4', '3.2', '3.5', '3.8', '3.9', '3.10', '3.11', '4.1', '4.7', '4.8', '4.9', '5.6', '6.1', '6.4', '6.5',
  // 批B 转正（2 项）：三苯甲烷、对乙酰氨基酚
  '1.7', '4.3',
  // 批E 转正（4 项）：萘/蒽/1-甲基萘/2-甲基萘（稠环正向，FUSED_TEMPLATES 模板直建）
  '2.1', '2.2', '2.4', '2.5',
];

describe('A1 正向解析（名称 → 结构）· 通过验收', () => {
  for (const id of PASS_FWD) {
    const c = byId(id);
    it(`${id} ${c.name} → ${c.formula}`, () => {
      const r = fwdOf(c.name!);
      expect(r.ok, `${c.name} 解析失败: ${r.error?.message}`).toBe(true);
      expect(formulaOfGraph(r.built!.graph), `${c.name} 分子式`).toBe(c.formula);
    });
  }
});

describe('A2 nameToStructure（RDKit 校验）· 通过验收', () => {
  for (const id of PASS_FWD) {
    const c = byId(id);
    it(`${id} ${c.name} → RDKit canonical + 分子式`, async () => {
      const n = await nameToStructure(c.name!);
      expect(n.ok, `${c.name} 失败: ${n.error?.message}`).toBe(true);
      expect(n.rdkitValid).toBe(true);
      expect(n.formula, `${c.name} 分子式`).toBe(c.formula);
    });
  }
});

/** 反向命名与期望一致的用例（5.7 氯仿反向为 1,1,1-三氯甲烷，属 BUG-B4，不在本组） */
const PASS_REV: string[] = [
  '3.1', '3.3', '3.6', '3.7', '4.4', '4.5', '4.6', '4.11', '4.12', '4.16',
  '5.1', '5.4', '5.8', '5.9', '5.10', '5.11', '5.12', '5.13', '5.14',
  '6.6', '6.7', '6.9', '6.10', '6.11', '6.12', '7.1', '7.2', '7.3', '7.6', '7.7',
  // 批A 转正（反向）：均三甲苯 → 1,3,5-三甲苯
  '3.2',
];

describe('A3 反向命名（结构 → 名称）· 通过验收', () => {
  for (const id of PASS_REV) {
    const c = byId(id);
    it(`${id} ${c.smiles} → ${c.reverseName}`, () => {
      const n = revOf(c.smiles);
      expect(n.ok, `${c.smiles} 反向命名失败: ${n.error}`).toBe(true);
      expect(n.name).toBe(c.reverseName);
    });
  }
});

describe('A4 等效氢 / 一氯代物 · 通过验收', () => {
  for (const c of CORPUS) {
    if (!c.smiles || c.hClasses === undefined) continue;
    it(`${c.id} ${c.smiles} → 等效氢 ${c.hClasses} 类`, () => {
      const eq = eqHOf(c.smiles);
      expect(eq.classCount, `${c.smiles} 等效氢类数`).toBe(c.hClasses);
    });
    if (c.monoCl !== undefined) {
      it(`${c.id} ${c.smiles} → 一氯代物 ${c.monoCl} 种`, () => {
        const eq = eqHOf(c.smiles);
        expect(eq.monochloroCount, `${c.smiles} 一氯代物种类`).toBe(c.monoCl);
      });
    }
  }
});

describe('A5 顺反异构存在性 · 通过验收', () => {
  for (const c of CORPUS) {
    if (!c.smiles || c.cisTrans === undefined) continue;
    it(`${c.id} ${c.smiles} → 顺反 ${c.cisTrans ? '存在' : '不存在'}`, () => {
      const ct = cisOf(c.smiles);
      expect(ct.hasCisTrans, `${c.smiles} 顺反判定: ${JSON.stringify(ct.bonds)}`).toBe(c.cisTrans);
    });
  }
});

describe('A6 同分异构体计数 · 通过验收', () => {
  // 8.9（烷基苯，见 C 节独立 it）、8.11（烯烃/环烷，见 C 节独立 it）不在本组（data 字段为旧口径）
  const ISO_PASS: string[] = ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7', '8.8', '8.10', '8.12'];
  for (const id of ISO_PASS) {
    const c = byId(id);
    it(`${c.id} ${c.isoFormula} [${c.isoClasses?.join('+')}] = ${c.isoCount}`, () => {
      const en = enumerateIsomers({ formula: c.isoFormula!, classes: c.isoClasses as Parameters<typeof enumerateIsomers>[0]['classes'] });
      expect(en.supported, `${c.isoFormula} 不可枚举: ${en.warning}`).toBe(true);
      expect(en.count, `${c.isoFormula} 异构计数`).toBe(c.isoCount);
    });
  }
});

// ============ B. 缺陷（BUG）· it.fails 固化「当前错误、待修复」 ============

describe('B 缺陷 BUG（当前输出错误；修复后本组会转红提示移除标记）', () => {
  // BUG-A1：脂肪胺缺省位次 → N 丢失（甲胺→甲烷、乙胺→乙烷、己二胺→己烷）【批A 已修复，转正】
  it('BUG-A1 甲胺应构建 CH5N（已修复）', () => {
    expect(formulaOfGraph(fwdOf('甲胺').built!.graph)).toBe('CH5N');
  });
  it('BUG-A1 乙胺应构建 C2H7N（已修复）', () => {
    expect(formulaOfGraph(fwdOf('乙胺').built!.graph)).toBe('C2H7N');
  });
  it('BUG-A1 己二胺应构建 C6H16N2（已修复）', () => {
    expect(formulaOfGraph(fwdOf('己二胺').built!.graph)).toBe('C6H16N2');
  });

  // BUG-A2：芳香酸酯 buildEster 把苯环按碳链构建（苯甲酸甲酯 → 己酸甲酯）【批A 已修复，转正】
  it('BUG-A2 苯甲酸甲酯 canonical 应为 C8H8O2 苯环酯（已修复）', async () => {
    const n = await nameToStructure('苯甲酸甲酯');
    expect(n.ok && n.formula).toBe('C8H8O2');
  });
  it('BUG-A2 judgeAnswer 对「苯甲酸甲酯」应判对（已修复）', async () => {
    const j = await judgeAnswer('COC(=O)c1ccccc1', '苯甲酸甲酯');
    expect(j.correct, j.feedback.join('; ')).toBe(true);
  });

  // BUG-A3：多苯环反向命名错误（苯基误判为戊基/丢环）【批B 已修复，转正】
  it('BUG-A3 联苯反向命名应为 联苯（已修复）', () => {
    expect(revOf('c1ccc(-c2ccccc2)cc1').name).toBe('联苯');
  });
  it('BUG-A3 二苯甲烷反向命名应为 二苯甲烷（已修复）', () => {
    expect(revOf('c1ccccc1Cc2ccccc2').name).toBe('二苯甲烷');
  });
  it('BUG-A3 反-二苯乙烯反向命名不应丢第二个苯环（已修复）', () => {
    expect(revOf('C(=Cc1ccccc1)c2ccccc2').name).not.toBe('苯乙烯');
  });
  // BUG-A4：稠环芳烃被误判为取代苯【批B 已修复，转正】
  it('BUG-A4 萘反向命名应为 萘（已修复）', () => {
    expect(revOf('c1ccc2ccccc2c1').name).toBe('萘');
  });
  it('BUG-A4 蒽反向命名应为 蒽（已修复）', () => {
    expect(revOf('c1ccc2cc3ccccc3cc2c1').name).toBe('蒽');
  });
  // BUG-A5：苯二甲酸第二个羧基丢失（反向 → 苯甲酸）【批B 已修复，转正】
  it('BUG-A5 对苯二甲酸反向命名应为 对苯二甲酸（已修复）', () => {
    expect(revOf('OC(=O)c1ccc(C(=O)O)cc1').name).toBe('对苯二甲酸');
  });
  it('BUG-A5 邻苯二甲酸反向命名不应丢第二个羧基（已修复）', () => {
    expect(revOf('OC(=O)c1ccccc1C(=O)O').name).toBe('邻苯二甲酸');
  });

  // BUG-A6：芳香酰胺 N-酰基丢失（对乙酰氨基酚 → 苯酚）【批B 已修复，转正】
  it('BUG-A6 对乙酰氨基酚反向命名应为 对乙酰氨基酚（已修复）', () => {
    expect(revOf('CC(=O)Nc1ccc(O)cc1').name).toBe('对乙酰氨基酚');
  });
  // BUG-A7：苄酯/二酯反向命名丢失酯基【批B 已修复，转正】
  it('BUG-A7 乙酸苄酯反向命名应为 乙酸苄酯（已修复）', () => {
    expect(revOf('CC(=O)OCc1ccccc1').name).toBe('乙酸苄酯');
  });
  it('BUG-A7 二乙酸乙二酯反向命名应为 二乙酸乙二酯（已修复）', () => {
    expect(revOf('CC(=O)OCCOC(=O)C').name).toBe('二乙酸乙二酯');
  });

  // BUG-B1：苯环多取代不取最小位次【批B 已修复，转正】
  it('BUG-B1 2,4-二氯甲苯反向命名应为 2,4-二氯甲苯（已修复）', () => {
    expect(revOf('Cc1ccc(Cl)cc1Cl').name).toBe('2,4-二氯甲苯');
  });
  it('BUG-B1 1,2,4-三甲苯反向命名应为 1,2,4-三甲苯（已修复）', () => {
    expect(revOf('Cc1ccc(C)c(C)c1').name).toBe('1,2,4-三甲苯');
  });
  // BUG-B2：环二烯默认位次丢双键（环戊二烯 → 环戊烯）【批A 已修复，转正】
  it('BUG-B2 环戊二烯应构建 C5H6（已修复）', () => {
    expect(formulaOfGraph(fwdOf('环戊二烯').built!.graph)).toBe('C5H6');
  });
  it('BUG-B2 1,3-环戊二烯应可解析（已修复）', () => {
    expect(fwdOf('1,3-环戊二烯').ok).toBe(true);
  });
  // BUG-B3：三氯乙烯（无位次）构建崩溃【批A 已修复，转正】
  it('BUG-B3 三氯乙烯应可解析或给出友好错误（已修复，不崩溃）', () => {
    const r = fwdOf('三氯乙烯');
    expect(r.ok || !/Cannot read properties/.test(r.error?.message ?? '')).toBe(true);
  });
  // BUG-B4：单碳多卤位次无意义【批B 已修复，转正】
  it('BUG-B4 四氯化碳反向命名应为 四氯甲烷（已修复，省略位次）', () => {
    expect(revOf('ClC(Cl)(Cl)Cl').name).toBe('四氯甲烷');
  });
  it('BUG-B4 氯仿反向命名应为 三氯甲烷（已修复，省略位次）', () => {
    expect(revOf('ClC(Cl)Cl').name).toBe('三氯甲烷');
  });
  // BUG-B5：桥环被误判为链烯【批B 实现"报错而非错名"；批E 惰性清理：改为正常断言（与 batchB 一致）】
  it('BUG-B5 降冰片烯：nameGraph 应 ok:false 且错误含「超出」（桥环报错而非错名，已修复）', () => {
    const n = revOf('C1=CC2CC1CC2');
    expect(n.ok).toBe(false);
    expect(n.error ?? '').toMatch(/超出|超范围/);
  });
  // BUG-B6：氨基酸反向命名【批B 已修复，转正】
  it('BUG-B6 苯丙氨酸反向命名应为 2-氨基-3-苯基丙酸（已修复）', () => {
    expect(revOf('OC(=O)C(N)Cc1ccccc1').name).toBe('2-氨基-3-苯基丙酸');
  });
  it('BUG-B6 2-氨基-2-甲基丙酸反向命名应为 氨基在前（已修复）', () => {
    expect(revOf('CC(C)(N)C(=O)O').name).toBe('2-氨基-2-甲基丙酸');
  });
  // BUG-B7：同分异构体计数含非法结构（C6H12O2 酯 = 21，其中 1 个五价碳非法 → 应为 20）【批C 已修复，转正】
  it('BUG-B7 C6H12O2 酯枚举应为 20（已修复，价键过滤剔除非法五价碳）', () => {
    expect(enumerateIsomers({ formula: 'C6H12O2', classes: ['ester'] }).count).toBe(20);
  });
  // BUG-B8：SMILES 同原子双环闭合 "12" 被误解析为环 12（邻苯二甲酸酐 RDKit 合法 SMILES 无法解析）【批C 已修复，转正】
  it('BUG-B8 邻苯二甲酸酐 SMILES 应可解析（"12"双闭合已支持）', () => {
    expect(parseSmiles('O=C1OC(=O)c2ccccc12').atoms.length).toBeGreaterThan(0);
  });
});

// ============ C. 未实现（MISSING）· 固化当前行为 ============

describe('C 未实现 MISSING（高考会考但程序明确不支持；开发后转 A 节）', () => {
  // 批A 转正 16 项、批B 转正 2 项、批E 转正 4 项（2.1 萘/2.2 蒽/2.4 1-甲基萘/2.5 2-甲基萘）；
  // 其余稠环衍生物超出范围（如 1,2-二甲基萘 多取代稠环不在范围）
  const MISSING_FWD: string[] = [];
  for (const id of MISSING_FWD) {
    const c = byId(id);
    it(`MISSING ${id} ${c.name} 正向解析当前不可用（未实现：${c.note}）`, () => {
      const r = fwdOf(c.name!);
      expect(r.ok, '若已实现请移除本断言并转入 A 节').toBe(false);
      expect(r.error?.message?.length ?? 0).toBeGreaterThan(0);
    });
  }
  it('MISSING 麦芽糖结构层不可解析（分子式层面支持见 D 节，属预期边界）', () => {
    expect(fwdOf('麦芽糖').ok).toBe(false);
  });
  it('8.9 C8H10 烷基苯候选与枚举（批C 已实现：aromatic-hydrocarbon，乙苯1+二甲苯3=4）', () => {
    const af = analyzeFormula('C8H10');
    const hc = af.candidates.find((c) => c.klass === 'aromatic-hydrocarbon');
    expect(hc, 'C8H10 应含烷基苯候选').toBeTruthy();
    expect(hc!.enumerable).toBe(true);
    expect(enumerateIsomers({ formula: 'C8H10', classes: ['aromatic-hydrocarbon'] }).count).toBe(4);
  });
  it('8.11 C4H8 烯烃/环烷烃枚举（批C 已实现：烯 3 + 环烷 2 = 5）', () => {
    const en = enumerateIsomers({ formula: 'C4H8', classes: ['alkene', 'cycloalkane'] });
    expect(en.supported, en.warning).toBe(true);
    expect(en.count).toBe(5);
  });
});

// ============ D. 范围外（OUT）· 预期行为 ============

describe('D 范围外 OUT（预期行为，不进开发清单）', () => {
  it('OUT 顺式-2-丁烯：顺/反前缀被忽略，结构等价 2-丁烯（不做 Z/E 命名，符合高中范围）', () => {
    const r = fwdOf('顺式-2-丁烯');
    expect(r.ok).toBe(true);
    expect(formulaOfGraph(r.built!.graph)).toBe('C4H8');
    expect(revOf('CC=CC').name).toBe('2-丁烯');
  });
  it('OUT 麦芽糖：分子式层面由 FORMULA_ONLY 数据表覆盖（C12H22O11），结构层不解析', () => {
    const by = FORMULA_ONLY.find((e) => e.name === '麦芽糖')!;
    expect(by.formula).toBe('C12H22O11');
  });
});
