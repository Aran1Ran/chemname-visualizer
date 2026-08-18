/**
 * 反向练习题库（L1-L6 难度分级）
 * 每个条目：SMILES + 标准名称（判题以 SMILES 结构为准，名称仅用于展示/答案）
 */
export interface BankItem {
  smiles: string;
  name: string;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  type: string;
}

export const BANK: BankItem[] = [
  // L1 直链烷烃
  { smiles: 'CCC', name: '丙烷', level: 1, type: '烷烃' },
  { smiles: 'CCCC', name: '丁烷', level: 1, type: '烷烃' },
  { smiles: 'CCCCC', name: '戊烷', level: 1, type: '烷烃' },
  { smiles: 'CCCCCC', name: '己烷', level: 1, type: '烷烃' },
  { smiles: 'CCCCCCC', name: '庚烷', level: 1, type: '烷烃' },
  // L2 单支链烷烃
  { smiles: 'CC(C)C', name: '2-甲基丙烷', level: 2, type: '烷烃' },
  { smiles: 'CC(C)CC', name: '2-甲基丁烷', level: 2, type: '烷烃' },
  { smiles: 'CC(C)CCC', name: '2-甲基戊烷', level: 2, type: '烷烃' },
  { smiles: 'CCC(C)CC', name: '3-甲基戊烷', level: 2, type: '烷烃' },
  { smiles: 'CC(C)CCCC', name: '2-甲基己烷', level: 2, type: '烷烃' },
  { smiles: 'CCCC(C)CC', name: '3-甲基己烷', level: 2, type: '烷烃' },
  { smiles: 'CCCC(C)CCC', name: '4-甲基庚烷', level: 2, type: '烷烃' },
  // L3 多支链烷烃
  { smiles: 'CC(C)(C)C', name: '2,2-二甲基丙烷', level: 3, type: '烷烃' },
  { smiles: 'CC(C)C(C)C', name: '2,3-二甲基丁烷', level: 3, type: '烷烃' },
  { smiles: 'CCC(C)(C)C', name: '2,2-二甲基丁烷', level: 3, type: '烷烃' },
  { smiles: 'CC(C)CC(C)C', name: '2,4-二甲基戊烷', level: 3, type: '烷烃' },
  { smiles: 'CC(C)C(C)(C)C', name: '2,2,3-三甲基丁烷', level: 3, type: '烷烃' },
  { smiles: 'CC(C)C(C)CCC', name: '2,3-二甲基己烷', level: 3, type: '烷烃' },
  { smiles: 'CCC(C)(C)CCC', name: '3,3-二甲基己烷', level: 3, type: '烷烃' },
  { smiles: 'CC(C)(C)CC(C)(C)C', name: '2,2,4,4-四甲基戊烷', level: 3, type: '烷烃' },
  // L4 含官能团
  { smiles: 'CCO', name: '乙醇', level: 4, type: '醇' },
  { smiles: 'CO', name: '甲醇', level: 4, type: '醇' },
  { smiles: 'CCCO', name: '1-丙醇', level: 4, type: '醇' },
  { smiles: 'CC(O)C', name: '2-丙醇', level: 4, type: '醇' },
  { smiles: 'CCC(O)C', name: '2-丁醇', level: 4, type: '醇' },
  { smiles: 'CC=O', name: '乙醛', level: 4, type: '醛' },
  { smiles: 'CCC=O', name: '丙醛', level: 4, type: '醛' },
  { smiles: 'CC(=O)C', name: '丙酮', level: 4, type: '酮' },
  { smiles: 'CCC(=O)C', name: '2-丁酮', level: 4, type: '酮' },
  { smiles: 'CC(=O)O', name: '乙酸', level: 4, type: '羧酸' },
  { smiles: 'CCC(=O)O', name: '丙酸', level: 4, type: '羧酸' },
  { smiles: 'CC(=O)OCC', name: '乙酸乙酯', level: 4, type: '酯' },
  { smiles: 'CCC(=O)OC', name: '丙酸甲酯', level: 4, type: '酯' },
  { smiles: 'COC=O', name: '甲酸甲酯', level: 4, type: '酯' },
  { smiles: 'O=COCC', name: '甲酸乙酯', level: 4, type: '酯' },
  { smiles: 'CCBr', name: '溴乙烷', level: 4, type: '卤代烃' },
  { smiles: 'CC(Cl)C', name: '2-氯丙烷', level: 4, type: '卤代烃' },
  { smiles: 'CC(Cl)Cl', name: '1,1-二氯乙烷', level: 4, type: '卤代烃' },
  { smiles: 'BrCCBr', name: '1,2-二溴乙烷', level: 4, type: '卤代烃' },
  { smiles: 'CC#N', name: '乙腈', level: 4, type: '腈' },
  { smiles: 'CC(=O)N', name: '乙酰胺', level: 4, type: '酰胺' },
  // L5 烯/炔
  { smiles: 'C=C', name: '乙烯', level: 5, type: '烯烃' },
  { smiles: 'CC=C', name: '丙烯', level: 5, type: '烯烃' },
  { smiles: 'C=CCC', name: '1-丁烯', level: 5, type: '烯烃' },
  { smiles: 'CC=CC', name: '2-丁烯', level: 5, type: '烯烃' },
  { smiles: 'C=CC=C', name: '1,3-丁二烯', level: 5, type: '烯烃' },
  { smiles: 'CC(C)=C', name: '2-甲基丙烯', level: 5, type: '烯烃' },
  { smiles: 'C=C(C)CC', name: '2-甲基-1-丁烯', level: 5, type: '烯烃' },
  { smiles: 'C=CC(C)C', name: '3-甲基-1-丁烯', level: 5, type: '烯烃' },
  { smiles: 'CC=CCC', name: '2-戊烯', level: 5, type: '烯烃' },
  { smiles: 'C#C', name: '乙炔', level: 5, type: '炔烃' },
  { smiles: 'CC#C', name: '丙炔', level: 5, type: '炔烃' },
  { smiles: 'C#CCC', name: '1-丁炔', level: 5, type: '炔烃' },
  { smiles: 'CC#CC', name: '2-丁炔', level: 5, type: '炔烃' },
  { smiles: 'C=C(C)C=C', name: '2-甲基-1,3-丁二烯', level: 5, type: '烯烃' },
  { smiles: 'C1CCCC=C1', name: '环己烯', level: 5, type: '烯烃' },
  { smiles: 'C=CC(=O)O', name: '2-丙烯酸', level: 5, type: '羧酸' },
  // L6 芳香族
  { smiles: 'c1ccccc1', name: '苯', level: 6, type: '芳香烃' },
  { smiles: 'Cc1ccccc1', name: '甲苯', level: 6, type: '芳香烃' },
  { smiles: 'CCc1ccccc1', name: '乙苯', level: 6, type: '芳香烃' },
  { smiles: 'C=Cc1ccccc1', name: '苯乙烯', level: 6, type: '芳香烃' },
  { smiles: 'Cc1ccccc1C', name: '邻二甲苯', level: 6, type: '芳香烃' },
  { smiles: 'Cc1cccc(C)c1', name: '间二甲苯', level: 6, type: '芳香烃' },
  { smiles: 'Cc1ccc(C)cc1', name: '对二甲苯', level: 6, type: '芳香烃' },
  { smiles: 'Cc1ccccc1Cl', name: '邻氯甲苯', level: 6, type: '芳香族' },
  { smiles: 'Cc1ccc(Cl)cc1', name: '对氯甲苯', level: 6, type: '芳香族' },
  { smiles: 'O=[N+]([O-])c1ccc(C)cc1', name: '对硝基甲苯', level: 6, type: '芳香族' },
  { smiles: 'Cc1cccc(Cl)c1', name: '间氯甲苯', level: 6, type: '芳香族' },
  { smiles: 'O=[N+]([O-])c1ccccc1C', name: '邻硝基甲苯', level: 6, type: '芳香族' },
  { smiles: 'O=[N+]([O-])c1cccc(C)c1', name: '间硝基甲苯', level: 6, type: '芳香族' },
  { smiles: 'Cc1ccccc1Br', name: '邻溴甲苯', level: 6, type: '芳香族' },
  { smiles: 'Clc1ccc(Cl)cc1', name: '对二氯苯', level: 6, type: '卤代烃' },
  { smiles: 'Cc1c(C)c(C)ccc1', name: '1,2,3-三甲苯', level: 6, type: '芳香烃' },
  { smiles: 'Cc1c([N+]([O-])=O)cc([N+]([O-])=O)cc1([N+]([O-])=O)', name: '2,4,6-三硝基甲苯', level: 6, type: '芳香族' },
  { smiles: 'Oc1ccccc1', name: '苯酚', level: 6, type: '酚' },
  { smiles: 'O=Cc1ccccc1', name: '苯甲醛', level: 6, type: '醛' },
  { smiles: 'O=C(O)c1ccccc1', name: '苯甲酸', level: 6, type: '羧酸' },
  { smiles: 'O=[N+]([O-])c1ccccc1', name: '硝基苯', level: 6, type: '芳香族' },
  { smiles: 'Nc1ccccc1', name: '苯胺', level: 6, type: '胺' },
  { smiles: 'Clc1ccccc1', name: '氯苯', level: 6, type: '卤代烃' },
  { smiles: 'Brc1ccccc1', name: '溴苯', level: 6, type: '卤代烃' },
  // 第五节 考试结构库（推断/合成题常见物质；非芳香族归 L7）
  // 糖类（链式，name 为 namer 系统名输出；判题以 SMILES 结构为准）
  { smiles: 'O=CC(O)C(O)C(O)C(O)CO', name: '2,3,4,5,6-五羟基己醛', level: 7, type: '糖' },
  { smiles: 'OCC(=O)C(O)C(O)C(O)CO', name: '1,3,4,5,6-五羟基-2-己酮', level: 7, type: '糖' },
  // 油脂/酯类
  { smiles: 'CC(=O)OC=C', name: '乙酸乙烯酯', level: 7, type: '酯' },
  { smiles: 'C=C(C)C(=O)OC', name: '2-甲基-2-丙烯酸甲酯', level: 7, type: '酯' },
  { smiles: 'CC(=O)OCCC(C)C', name: '乙酸异戊酯', level: 7, type: '酯' },
  { smiles: 'OC(=O)c1ccccc1O', name: '邻羟基苯甲酸', level: 7, type: '羧酸' },
  { smiles: 'OC(=O)c1ccc(O)cc1', name: '对羟基苯甲酸', level: 7, type: '羧酸' },
  { smiles: 'CC(=O)Oc1ccccc1C(=O)O', name: '邻乙酰氧基苯甲酸', level: 7, type: '羧酸' },
  // 药物/材料单体
  { smiles: 'C=CCl', name: '氯乙烯', level: 7, type: '卤代烃' },
  // 工业/生活物质
  { smiles: 'C=O', name: '甲醛', level: 7, type: '醛' },
  { smiles: 'OCC(O)CO', name: '丙三醇', level: 7, type: '醇' },
];

export const LEVELS: Array<{ level: number; label: string; hint: string }> = [
  { level: 1, label: 'L1', hint: '直链烷烃（丙烷~庚烷）' },
  { level: 2, label: 'L2', hint: '单支链烷烃' },
  { level: 3, label: 'L3', hint: '多支链烷烃' },
  { level: 4, label: 'L4', hint: '含官能团（醇/醛/酸/酯/卤代/腈/酰胺）' },
  { level: 5, label: 'L5', hint: '烯烃与炔烃' },
  { level: 6, label: 'L6', hint: '芳香族（苯系）' },
  { level: 7, label: 'L7', hint: '考试结构库（糖/酯/材料/工业物质）' },
];

export function bankOfLevel(level: number): BankItem[] {
  return BANK.filter((b) => b.level === level);
}
