/**
 * 高考有机大题验证语料库（数据驱动）
 * 每条：输入（名称 或 SMILES）+ 化学期望（分子式/等效氢/一氯代物/顺反/异构计数/反向名）。
 * 期望值依据：教材式命名约定、高考考纲口径、RDKit 规范化（canonical 以 RDKit 为准）。
 * 用途：tests/highschool-corpus.test.ts 断言 + 验证报告数据源。
 */
export interface CorpusCase {
  /** 编号（类.序号，如 1.1） */
  id: string;
  /** 类别 1..10 */
  cat: number;
  /** 正向输入名称（可空：仅结构层验证） */
  name?: string;
  /** 结构层 SMILES */
  smiles: string;
  /** 期望分子式 */
  formula?: string;
  /** 期望等效氢类数 */
  hClasses?: number;
  /** 期望一氯代物种类数 */
  monoCl?: number;
  /** 期望顺反异构是否存在 */
  cisTrans?: boolean;
  /** 异构计数：公式 */
  isoFormula?: string;
  /** 异构计数：类别 */
  isoClasses?: string[];
  /** 异构计数期望 */
  isoCount?: number;
  /** 期望反向命名 */
  reverseName?: string;
  /** 备注 */
  note?: string;
}

export const CORPUS: CorpusCase[] = [
  // ============ 类1 多苯环/联苯 ============
  { id: '1.1', cat: 1, name: '联苯', smiles: 'c1ccc(-c2ccccc2)cc1', formula: 'C12H10', hClasses: 3, monoCl: 3, note: '命名预期 MISSING（多苯环词表）' },
  { id: '1.2', cat: 1, smiles: 'c1ccc(-c2ccc(-c3ccccc3)cc2)cc1', formula: 'C18H14', hClasses: 4, note: '对三联苯 结构层；中央环 4H 全等效（含 C2↔C3 反射）' },
  { id: '1.3', cat: 1, smiles: 'c1cc(-c2ccccc2)cc(-c3ccccc3)c1', formula: 'C18H14', note: '间三联苯 结构层' },
  { id: '1.4', cat: 1, name: '二苯甲烷', smiles: 'c1ccccc1Cc2ccccc2', formula: 'C13H12', hClasses: 4, note: '命名预期 MISSING' },
  { id: '1.5', cat: 1, smiles: 'C(=Cc1ccccc1)c2ccccc2', formula: 'C14H12', hClasses: 4, note: '反-二苯乙烯 结构层；反向命名预期漏第二个苯环' },
  { id: '1.6', cat: 1, smiles: 'C(=Cc1ccccc1)c2ccccc2', cisTrans: true, note: '二苯乙烯顺反：两端各两个不同基团 → 存在' },
  { id: '1.7', cat: 1, name: '三苯甲烷', smiles: 'C(c1ccccc1)(c2ccccc2)c3ccccc3', formula: 'C19H16', hClasses: 4, note: '命名预期 MISSING' },
  { id: '1.8', cat: 1, smiles: 'C(#Cc1ccccc1)c2ccccc2', formula: 'C14H10', note: '二苯乙炔 结构层' },
  { id: '1.9', cat: 1, smiles: 'O(c1ccccc1)c2ccccc2', formula: 'C12H10O', hClasses: 3, note: '二苯醚 结构层' },
  { id: '1.10', cat: 1, smiles: 'Cc1ccc(-c2ccccc2)cc1', formula: 'C13H12', hClasses: 6, note: '4-甲基联苯 结构层' },
  { id: '1.11', cat: 1, smiles: 'c1ccccc1CCc2ccccc2', formula: 'C14H14', hClasses: 4, note: '1,2-二苯基乙烷 结构层' },
  { id: '1.12', cat: 1, name: '联苯', smiles: 'c1ccc(-c2ccccc2)cc1', note: 'nameToStructure 公式核验（并入 1.1 输出，不重复断言）' },

  // ============ 类2 稠环芳烃 ============
  { id: '2.1', cat: 2, name: '萘', smiles: 'c1ccc2ccccc2c1', formula: 'C10H8', hClasses: 2, monoCl: 2, note: '命名预期 MISSING；等效氢 2 类 = 高考结论' },
  { id: '2.2', cat: 2, name: '蒽', smiles: 'c1ccc2cc3ccccc3cc2c1', formula: 'C14H10', hClasses: 3, monoCl: 3, note: '命名预期 MISSING' },
  { id: '2.3', cat: 2, smiles: 'C1=CC=C2C=CC3=CC=CC=C3C2=C1', formula: 'C14H10', hClasses: 5, note: '菲 结构层（Kekulé 式；C2 轴下 10H → 5 对；芳香"12"双闭合形式为 parser 已知限制）' },
  { id: '2.4', cat: 2, name: '1-甲基萘', smiles: 'c1cc(C)c2ccccc2c1', formula: 'C11H10', note: '命名预期 MISSING；甲基在 α 位（邻稠合点），SMILES 避免尾部"12"双闭合' },
  { id: '2.5', cat: 2, name: '2-甲基萘', smiles: 'Cc1ccc2ccccc2c1', formula: 'C11H10', note: '命名预期 MISSING' },
  { id: '2.6', cat: 2, smiles: 'Oc1ccc2ccccc2c1', formula: 'C10H8O', note: '2-萘酚 结构层；highlight 酚羟基' },

  // ============ 类3 多取代基苯环 ============
  { id: '3.1', cat: 3, name: '1,2,3-三甲苯', smiles: 'Cc1c(C)c(C)ccc1', formula: 'C9H12', hClasses: 4, monoCl: 4, reverseName: '1,2,3-三甲苯' },
  { id: '3.2', cat: 3, name: '均三甲苯', smiles: 'Cc1cc(C)cc(C)c1', formula: 'C9H12', hClasses: 2, monoCl: 2, reverseName: '1,3,5-三甲苯', note: '均三甲苯俗名 → 1,3,5-三甲苯' },
  { id: '3.3', cat: 3, name: '2,4,6-三硝基甲苯', smiles: 'Cc1c([N+]([O-])=O)cc([N+]([O-])=O)cc1[N+]([O-])=O', formula: 'C7H5N3O6', hClasses: 2, monoCl: 2, reverseName: '2,4,6-三硝基甲苯' },
  { id: '3.4', cat: 3, name: '2,4-二氯甲苯', smiles: 'Cc1ccc(Cl)cc1Cl', formula: 'C7H6Cl2', hClasses: 4, note: '反向命名可能为 2,4-二氯甲苯（位次风格）' },
  { id: '3.5', cat: 3, name: '3,5-二甲基苯酚', smiles: 'Cc1cc(C)cc(O)c1', formula: 'C8H10O', hClasses: 4, note: '反向命名可能为 3,5-二甲酚 风格' },
  { id: '3.6', cat: 3, name: '对硝基甲苯', smiles: 'O=[N+]([O-])c1ccc(C)cc1', formula: 'C7H7NO2', hClasses: 3, monoCl: 3, reverseName: '对硝基甲苯' },
  { id: '3.7', cat: 3, name: '邻氯甲苯', smiles: 'Cc1ccccc1Cl', formula: 'C7H7Cl', hClasses: 5, reverseName: '邻氯甲苯', note: '2-氯甲苯 别名' },
  { id: '3.8', cat: 3, name: '邻苯二甲酸', smiles: 'OC(=O)c1ccccc1C(=O)O', formula: 'C8H6O4', hClasses: 3, note: '正向命名预期 MISSING（苯二甲酸系列）' },
  { id: '3.9', cat: 3, name: '间苯二甲酸', smiles: 'OC(=O)c1cccc(C(=O)O)c1', formula: 'C8H6O4', note: '正向命名预期 MISSING' },
  { id: '3.10', cat: 3, name: '对苯二甲酸', smiles: 'OC(=O)c1ccc(C(=O)O)cc1', formula: 'C8H6O4', hClasses: 2, monoCl: 1, note: '正向命名预期 MISSING；等效氢=1 环 CH + 1 OH' },
  { id: '3.11', cat: 3, name: '对苯二甲酸乙二醇酯', smiles: 'OC(=O)c1ccc(C(=O)OCCO)cc1', formula: 'C10H10O5', note: 'PET 单体层面；命名预期 MISSING（高聚物）' },
  { id: '3.12', cat: 3, name: '1,2,4-三甲苯', smiles: 'Cc1ccc(C)c(C)c1', formula: 'C9H12', hClasses: 6, reverseName: '1,2,4-三甲苯' },
  { id: '3.13', cat: 3, name: '2,4-二硝基甲苯', smiles: 'Cc1ccc([N+]([O-])=O)cc1[N+]([O-])=O', formula: 'C7H6N2O4', note: '反向命名可能为 2,4-二硝基甲苯' },
  { id: '3.14', cat: 3, smiles: 'O=C1OC(=O)c2ccccc12', formula: 'C8H4O3', note: '邻苯二甲酸酐 结构层；RDKit 合法但 parser 不支持同原子"12"双环闭合 → 记录 BUG' },

  // ============ 类4 多官能团组合 ============
  { id: '4.1', cat: 4, name: '水杨酸甲酯', smiles: 'COC(=O)c1ccccc1O', formula: 'C8H8O3', hClasses: 6, note: '冬青油；正向命名预期 MISSING；不对称二取代苯环 4 个环 H 全不等效' },
  { id: '4.2', cat: 4, name: '阿司匹林', smiles: 'CC(=O)Oc1ccccc1C(=O)O', formula: 'C9H8O4', hClasses: 6, monoCl: 5, reverseName: '邻乙酰氧基苯甲酸', note: '乙酰水杨酸；4 环 CH 各异 + 甲基 + COOH' },
  { id: '4.3', cat: 4, name: '对乙酰氨基酚', smiles: 'CC(=O)Nc1ccc(O)cc1', formula: 'C8H9NO2', hClasses: 5, note: '扑热息痛；芳香酰胺命名预期 MISSING/BUG' },
  { id: '4.4', cat: 4, name: '对羟基苯甲酸', smiles: 'OC(=O)c1ccc(O)cc1', formula: 'C7H6O3', hClasses: 4, reverseName: '对羟基苯甲酸' },
  { id: '4.5', cat: 4, name: '乳酸', smiles: 'CC(O)C(=O)O', formula: 'C3H6O3', hClasses: 4, reverseName: '2-羟基丙酸', note: '俗名已有' },
  { id: '4.6', cat: 4, name: '苹果酸', smiles: 'O=C(O)C(O)CC(=O)O', formula: 'C4H6O5', hClasses: 5, reverseName: '2-羟基丁二酸', note: '俗名已有；不对称二酸 2 个 COOH 不等效' },
  { id: '4.7', cat: 4, name: '酒石酸', smiles: 'OC(=O)C(O)C(O)C(=O)O', formula: 'C4H6O6', hClasses: 3, note: '正向命名预期 MISSING' },
  { id: '4.8', cat: 4, name: '柠檬酸', smiles: 'OC(=O)CC(O)(CC(=O)O)C(=O)O', formula: 'C6H8O7', hClasses: 4, note: '正向命名预期 MISSING；对称二 CH2 + 醇 OH + 2 类 COOH' },
  { id: '4.9', cat: 4, name: '苯丙氨酸', smiles: 'OC(=O)C(N)Cc1ccccc1', formula: 'C9H11NO2', note: '正向命名预期 MISSING' },
  { id: '4.10', cat: 4, name: '2-氨基-2-甲基丙酸', smiles: 'CC(C)(N)C(=O)O', formula: 'C4H9NO2', hClasses: 3, reverseName: '2-氨基-2-甲基丙酸', note: '正向位次解析高风险点' },
  { id: '4.11', cat: 4, name: '甘氨酸', smiles: 'NCC(=O)O', formula: 'C2H5NO2', reverseName: '氨基乙酸', note: '俗名已有' },
  { id: '4.12', cat: 4, name: '丙氨酸', smiles: 'CC(N)C(=O)O', formula: 'C3H7NO2', reverseName: '2-氨基丙酸', note: '俗名已有' },
  { id: '4.13', cat: 4, name: '葡萄糖', smiles: 'O=CC(O)C(O)C(O)C(O)CO', formula: 'C6H12O6', note: '链式；俗名已有' },
  { id: '4.14', cat: 4, name: '果糖', smiles: 'OCC(=O)C(O)C(O)C(O)CO', formula: 'C6H12O6', note: '链式；俗名已有' },
  { id: '4.15', cat: 4, name: '麦芽糖', smiles: '', formula: 'C12H22O11', note: '分子式层面（FORMULA_ONLY 数据表校验）' },
  { id: '4.16', cat: 4, name: '乙二醇', smiles: 'OCCO', formula: 'C2H6O2', hClasses: 2, reverseName: '乙二醇' },

  // ============ 类5 含氮/含卤 ============
  { id: '5.1', cat: 5, name: '硝基苯', smiles: 'O=[N+]([O-])c1ccccc1', formula: 'C6H5NO2', hClasses: 3, reverseName: '硝基苯' },
  { id: '5.2', cat: 5, name: '2,4-二硝基甲苯', smiles: 'Cc1ccc([N+]([O-])=O)cc1[N+]([O-])=O', formula: 'C7H6N2O4', note: '反向命名可能为 2,4-二硝基甲苯' },
  { id: '5.3', cat: 5, name: '三氯乙烯', smiles: 'ClC(Cl)=CCl', formula: 'C2HCl3', hClasses: 1, note: '正向命名预期 BUG（无位次三卤代烯）' },
  { id: '5.4', cat: 5, name: '1,1,2-三氯乙烯', smiles: 'ClC(Cl)=CCl', formula: 'C2HCl3', hClasses: 1, reverseName: '1,1,2-三氯乙烯', note: '显式位次预期可解析' },
  { id: '5.5', cat: 5, smiles: 'ClC(Cl)=C(Cl)Cl', formula: 'C2Cl4', hClasses: 0, note: '四氯乙烯 结构层；无 H' },
  { id: '5.6', cat: 5, name: '四氯化碳', smiles: 'ClC(Cl)(Cl)Cl', formula: 'CCl4', hClasses: 0, note: '正向命名预期 MISSING（碳无词干）' },
  { id: '5.7', cat: 5, name: '氯仿', smiles: 'ClC(Cl)Cl', formula: 'CHCl3', hClasses: 1, reverseName: '三氯甲烷', note: '俗名已有' },
  { id: '5.8', cat: 5, name: '溴苯', smiles: 'Brc1ccccc1', formula: 'C6H5Br', hClasses: 3, reverseName: '溴苯' },
  { id: '5.9', cat: 5, name: '1-溴丙烷', smiles: 'CCCBr', formula: 'C3H7Br', hClasses: 3, reverseName: '1-溴丙烷' },
  { id: '5.10', cat: 5, name: '2-溴丙烷', smiles: 'CC(Br)C', formula: 'C3H7Br', hClasses: 2, reverseName: '2-溴丙烷' },
  { id: '5.11', cat: 5, name: '2,3-二溴丁烷', smiles: 'CC(Br)C(Br)C', formula: 'C4H8Br2', hClasses: 2, reverseName: '2,3-二溴丁烷' },
  { id: '5.12', cat: 5, name: '1,2-二溴苯', smiles: 'Brc1ccccc1Br', formula: 'C6H4Br2', hClasses: 2, monoCl: 2, reverseName: '邻二溴苯' },
  { id: '5.13', cat: 5, name: '2-氯乙醇', smiles: 'ClCCO', formula: 'C2H5ClO', hClasses: 3, reverseName: '氯乙醇', note: '链≤2 单取代省略位次（教材式）' },
  { id: '5.14', cat: 5, name: '1,3-二氯-2-丙醇', smiles: 'ClCC(O)CCl', formula: 'C3H6Cl2O', hClasses: 3, reverseName: '1,3-二氯-2-丙醇' },
  { id: '5.15', cat: 5, name: '甲胺', smiles: 'CN', formula: 'CH5N', hClasses: 2, note: '脂肪胺缺省位次高风险点' },
  { id: '5.16', cat: 5, name: '乙胺', smiles: 'CCN', formula: 'C2H7N', hClasses: 3, note: '脂肪胺缺省位次高风险点' },

  // ============ 类6 酯/酰胺 ============
  { id: '6.1', cat: 6, name: '乙酸苯酯', smiles: 'CC(=O)Oc1ccccc1', formula: 'C8H8O2', hClasses: 4, reverseName: '乙酸苯酯', note: '正向命名预期 MISSING（醇部分"苯"）' },
  { id: '6.2', cat: 6, name: '苯甲酸甲酯', smiles: 'COC(=O)c1ccccc1', formula: 'C8H8O2', hClasses: 4, reverseName: '苯甲酸甲酯' },
  { id: '6.3', cat: 6, name: '乙酸苄酯', smiles: 'CC(=O)OCc1ccccc1', formula: 'C9H10O2', note: '正向（苄 在 BRANCH_ALCOHOL）预期可解析；反向命名预期 BUG' },
  { id: '6.4', cat: 6, name: '二乙酸乙二酯', smiles: 'CC(=O)OCCOC(=O)C', formula: 'C6H10O4', hClasses: 2, note: '乙二醇二乙酸酯；命名预期 MISSING；2 CH3 等效 + 2 CH2 等效' },
  { id: '6.5', cat: 6, name: '草酸二乙酯', smiles: 'CCOC(=O)C(=O)OCC', formula: 'C6H10O4', hClasses: 2, note: '酯酸部分不走俗名表 → 预期 MISSING' },
  { id: '6.6', cat: 6, name: '乙二酸二乙酯', smiles: 'CCOC(=O)C(=O)OCC', formula: 'C6H10O4', hClasses: 2, reverseName: '乙二酸二乙酯' },
  { id: '6.7', cat: 6, name: '己二酸', smiles: 'OC(=O)CCCCC(=O)O', formula: 'C6H10O4', hClasses: 3, reverseName: '己二酸' },
  { id: '6.8', cat: 6, name: '己二胺', smiles: 'NCCCCCCN', formula: 'C6H16N2', hClasses: 4, note: '尼龙-66 单体；脂肪胺缺省位次 → 预期 BUG' },
  { id: '6.9', cat: 6, name: '乙酰胺', smiles: 'CC(=O)N', formula: 'C2H5NO', hClasses: 2, reverseName: '乙酰胺' },
  { id: '6.10', cat: 6, name: 'N-甲基乙酰胺', smiles: 'CC(=O)NC', formula: 'C3H7NO', hClasses: 3, reverseName: 'N-甲基乙酰胺' },
  { id: '6.11', cat: 6, name: '乙酸异戊酯', smiles: 'CC(=O)OCCC(C)C', formula: 'C7H14O2', reverseName: '乙酸异戊酯', note: '俗名/系统名路径' },
  { id: '6.12', cat: 6, name: '甲基丙烯酸甲酯', smiles: 'C=C(C)C(=O)OC', formula: 'C5H8O2', reverseName: '2-甲基-2-丙烯酸甲酯', note: '俗名已有' },

  // ============ 类7 环状/桥环 ============
  { id: '7.1', cat: 7, name: '环己烷', smiles: 'C1CCCCC1', formula: 'C6H12', hClasses: 1, monoCl: 1, reverseName: '环己烷' },
  { id: '7.2', cat: 7, name: '环己烯', smiles: 'C1CCCC=C1', formula: 'C6H10', hClasses: 3, reverseName: '环己烯' },
  { id: '7.3', cat: 7, name: '1-甲基环己烯', smiles: 'CC1=CCCCC1', formula: 'C7H12', hClasses: 6, reverseName: '1-甲基环己烯' },
  { id: '7.4', cat: 7, name: '环戊二烯', smiles: 'C1=CC=CC1', formula: 'C5H6', hClasses: 3, note: '默认位次预期 BUG（1,2-二烯 错构）' },
  { id: '7.5', cat: 7, name: '1,3-环戊二烯', smiles: 'C1=CC=CC1', formula: 'C5H6', hClasses: 3, note: '显式位次预期正确' },
  { id: '7.6', cat: 7, name: '环丁烷', smiles: 'C1CCC1', formula: 'C4H8', hClasses: 1, monoCl: 1, reverseName: '环丁烷' },
  { id: '7.7', cat: 7, name: '甲基环丙烷', smiles: 'CC1CC1', formula: 'C4H8', hClasses: 3, reverseName: '甲基环丙烷' },
  { id: '7.8', cat: 7, smiles: 'C1=CC2CC1CC2', formula: 'C7H10', hClasses: 4, cisTrans: false, note: '降冰片烯 结构层；命名预期 OUT/MISSING；环内双键无顺反' },

  // ============ 类8 同分异构体计数 ============
  { id: '8.1', cat: 8, smiles: '', isoFormula: 'C4H9Cl', isoClasses: ['monohalo'], isoCount: 4, note: '一氯丁烷 4 种' },
  { id: '8.2', cat: 8, smiles: '', isoFormula: 'C3H6Cl2', isoClasses: ['dihalo'], isoCount: 4, note: '二氯丙烷 4 种' },
  { id: '8.3', cat: 8, smiles: '', isoFormula: 'C4H8Cl2', isoClasses: ['dihalo'], isoCount: 9, note: '二氯丁烷 9 种' },
  { id: '8.4', cat: 8, smiles: '', isoFormula: 'C4H8O2', isoClasses: ['acid', 'ester'], isoCount: 6, note: '酸2 + 酯4' },
  { id: '8.5', cat: 8, smiles: '', isoFormula: 'C5H10O2', isoClasses: ['ester'], isoCount: 9, note: '酯 9 种' },
  { id: '8.6', cat: 8, smiles: '', isoFormula: 'C6H12O2', isoClasses: ['ester'], isoCount: 20, note: '酯 20 种' },
  { id: '8.7', cat: 8, smiles: '', isoFormula: 'C7H8O', isoClasses: ['phenol', 'aromatic-ether', 'aromatic-alcohol'], isoCount: 5, note: '酚3+醚1+醇1' },
  { id: '8.8', cat: 8, smiles: '', isoFormula: 'C8H10O', isoClasses: ['phenol', 'aromatic-ether', 'aromatic-alcohol'], isoCount: 15, note: '酚9+醚4+醇2；任务稿写 7 为口径差异' },
  { id: '8.9', cat: 8, smiles: '', isoFormula: 'C8H10', isoClasses: [], isoCount: 0, note: '芳香烃候选推导：引擎无烷基苯类 → 记录' },
  { id: '8.10', cat: 8, smiles: '', isoFormula: 'C8H8O2', isoClasses: ['aromatic-ester'], isoCount: 3, note: '苯甲酸甲酯/乙酸苯酯/甲酸苄酯' },
  { id: '8.11', cat: 8, smiles: '', isoFormula: 'C4H8', isoClasses: ['alkene'], isoCount: 0, note: '烯烃类 enumerable:false → 记录 OUT/MISSING' },
  { id: '8.12', cat: 8, smiles: '', isoFormula: 'C8H10O', isoClasses: ['phenol'], isoCount: 9, note: '酚类单独 9 种' },

  // ============ 类9 等效氢/一氯代物（含基础验收） ============
  { id: '9.1', cat: 9, smiles: 'CCO', formula: 'C2H6O', hClasses: 3, note: '乙醇：CH3+CH2+OH' },
  { id: '9.2', cat: 9, smiles: 'Cc1ccccc1', formula: 'C7H8', hClasses: 4, monoCl: 4, note: '甲苯' },
  { id: '9.3', cat: 9, smiles: 'Cc1ccc(C)cc1', formula: 'C8H10', hClasses: 2, monoCl: 2, note: '对二甲苯' },
  { id: '9.4', cat: 9, smiles: 'CC(=O)OCC', formula: 'C4H8O2', hClasses: 3, note: '乙酸乙酯' },
  { id: '9.5', cat: 9, smiles: 'CCC', formula: 'C3H8', hClasses: 2, monoCl: 2, note: '丙烷' },
  { id: '9.6', cat: 9, smiles: 'CC(C)C', formula: 'C4H10', hClasses: 2, monoCl: 2, note: '2-甲基丙烷' },
  { id: '9.7', cat: 9, smiles: 'c1ccccc1', formula: 'C6H6', hClasses: 1, monoCl: 1, note: '苯' },
  { id: '9.8', cat: 9, smiles: 'C1CCCCC1', formula: 'C6H12', hClasses: 1, monoCl: 1, note: '环己烷' },
  { id: '9.9', cat: 9, smiles: 'CCc1ccccc1', formula: 'C8H10', hClasses: 5, monoCl: 5, note: '乙苯' },
  { id: '9.10', cat: 9, smiles: 'c1ccc(-c2ccccc2)cc1', formula: 'C12H10', hClasses: 3, monoCl: 3, note: '联苯' },
  { id: '9.11', cat: 9, smiles: 'c1ccc2ccccc2c1', formula: 'C10H8', hClasses: 2, monoCl: 2, note: '萘' },
  { id: '9.12', cat: 9, smiles: 'Cc1c(C)c(C)ccc1', formula: 'C9H12', hClasses: 4, monoCl: 4, note: '1,2,3-三甲苯' },
  { id: '9.13', cat: 9, smiles: 'Cc1c([N+]([O-])=O)cc([N+]([O-])=O)cc1[N+]([O-])=O', formula: 'C7H5N3O6', hClasses: 2, monoCl: 2, note: 'TNT' },
  { id: '9.14', cat: 9, smiles: 'CC(=O)Oc1ccccc1C(=O)O', formula: 'C9H8O4', hClasses: 6, monoCl: 5, note: '阿司匹林（4 环 CH 各异 + 甲基 + COOH）' },
  { id: '9.15', cat: 9, smiles: 'CC(=O)Nc1ccc(O)cc1', formula: 'C8H9NO2', hClasses: 5, note: '对乙酰氨基酚（2 环 CH + 甲基 + NH + OH）' },
  { id: '9.16', cat: 9, smiles: 'ClCCO', formula: 'C2H5ClO', hClasses: 3, note: '2-氯乙醇' },
  { id: '9.17', cat: 9, smiles: 'ClCC(O)CCl', formula: 'C3H6Cl2O', hClasses: 3, monoCl: 2, note: '1,3-二氯-2-丙醇' },
  { id: '9.18', cat: 9, smiles: 'OC(=O)CCCCC(=O)O', formula: 'C6H10O4', hClasses: 3, note: '己二酸（对称二酸）' },

  // ============ 类10 顺反异构 ============
  { id: '10.1', cat: 10, smiles: 'CC=CC', formula: 'C4H8', cisTrans: true, note: '2-丁烯 → 存在' },
  { id: '10.2', cat: 10, smiles: 'CC=CCC', formula: 'C5H10', cisTrans: true, note: '2-戊烯 → 存在' },
  { id: '10.3', cat: 10, smiles: 'C=CCC', formula: 'C4H8', cisTrans: false, note: '1-丁烯 → 不存在' },
  { id: '10.4', cat: 10, smiles: 'CC(C)=C', formula: 'C4H8', cisTrans: false, note: '异丁烯 → 不存在' },
  { id: '10.5', cat: 10, smiles: 'ClC=CCl', formula: 'C2H2Cl2', cisTrans: true, note: '1,2-二氯乙烯 → 存在' },
  { id: '10.6', cat: 10, name: '顺式-2-丁烯', smiles: 'CC=CC', formula: 'C4H8', note: '顺/反前缀应被忽略，结构等价 2-丁烯' },
  { id: '10.7', cat: 10, smiles: 'CC(C)=C(C)C', formula: 'C6H12', cisTrans: false, note: '2,3-二甲基-2-丁烯 → 不存在' },
];
