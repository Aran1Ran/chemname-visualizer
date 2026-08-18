/**
 * 同分异构体数据集（高中范围，SMILES + 中文名）
 * 覆盖：烷烃 C1-C6 碳架异构、C4H10O 醇/醚、C4H8 烯烃（+环烷）、C8H10 芳香族
 */
export interface IsomerEntry {
  smiles: string;
  name: string;
  formula: string;
  /** 官能团类别（C8H10O 等混合组：酚/醚/醇） */
  group?: string;
  /** 俗名/别名（展示时可拼为「name（alias）」，判题以结构为准） */
  alias?: string;
}

export const ISOMER_SETS: Array<{
  key: string;
  label: string;
  formula: string;
  description: string;
  isomers: IsomerEntry[];
}> = [
  {
    key: 'C4H10',
    label: 'C₄H₁₀ 丁烷',
    formula: 'C4H10',
    // 正-前缀为教材习惯写法，与命名器标准名（丁烷）等价，判题以结构为准
    description: '丁烷的碳架异构（正-前缀为教材习惯写法，与命名器标准名「丁烷」等价，判题以结构为准）',
    isomers: [
      { smiles: 'CCCC', name: '正丁烷', formula: 'C4H10' },
      { smiles: 'CC(C)C', name: '2-甲基丙烷', alias: '异丁烷', formula: 'C4H10' },
    ],
  },
  {
    key: 'C5H12',
    label: 'C₅H₁₂ 戊烷',
    formula: 'C5H12',
    // 正-前缀为教材习惯写法，与命名器标准名（戊烷）等价，判题以结构为准
    description: '戊烷的碳架异构（正-前缀为教材习惯写法，与命名器标准名「戊烷」等价，判题以结构为准）',
    isomers: [
      { smiles: 'CCCCC', name: '正戊烷', formula: 'C5H12' },
      { smiles: 'CC(C)CC', name: '2-甲基丁烷', alias: '异戊烷', formula: 'C5H12' },
      { smiles: 'CC(C)(C)C', name: '2,2-二甲基丙烷', alias: '新戊烷', formula: 'C5H12' },
    ],
  },
  {
    key: 'C6H14',
    label: 'C₆H₁₄ 己烷',
    formula: 'C6H14',
    // 正-前缀为教材习惯写法，与命名器标准名（己烷）等价，判题以结构为准
    description: '己烷的碳架异构（5 种）（正-前缀为教材习惯写法，与命名器标准名「己烷」等价，判题以结构为准）',
    isomers: [
      { smiles: 'CCCCCC', name: '正己烷', formula: 'C6H14' },
      { smiles: 'CC(C)CCC', name: '2-甲基戊烷', formula: 'C6H14' },
      { smiles: 'CCC(C)CC', name: '3-甲基戊烷', formula: 'C6H14' },
      { smiles: 'CC(C)(C)CC', name: '2,2-二甲基丁烷', formula: 'C6H14' },
      { smiles: 'CC(C)C(C)C', name: '2,3-二甲基丁烷', formula: 'C6H14' },
    ],
  },
  {
    key: 'C4H10O',
    label: 'C₄H₁₀O 丁醇/醚',
    formula: 'C4H10O',
    description: '醇与醚的官能团异构（7 种）',
    isomers: [
      { smiles: 'CCCCO', name: '1-丁醇', formula: 'C4H10O' },
      { smiles: 'CC(O)CC', name: '2-丁醇', formula: 'C4H10O' },
      { smiles: 'CC(C)CO', name: '2-甲基-1-丙醇', formula: 'C4H10O' },
      { smiles: 'CC(C)(C)O', name: '2-甲基-2-丙醇', formula: 'C4H10O' },
      { smiles: 'CCOCC', name: '乙醚', formula: 'C4H10O' },
      { smiles: 'CCCOC', name: '甲丙醚', formula: 'C4H10O' },
      { smiles: 'CC(C)OC', name: '甲基异丙基醚', formula: 'C4H10O' },
    ],
  },
  {
    key: 'C4H8',
    label: 'C₄H₈ 丁烯/环烷',
    formula: 'C4H8',
    description: '烯烃位置异构与环烷烃',
    isomers: [
      { smiles: 'C=CCC', name: '1-丁烯', formula: 'C4H8' },
      { smiles: 'CC=CC', name: '2-丁烯', formula: 'C4H8' },
      { smiles: 'CC(C)=C', name: '2-甲基丙烯', formula: 'C4H8' },
      { smiles: 'C1CCC1', name: '环丁烷', formula: 'C4H8' },
      { smiles: 'CC1CC1', name: '甲基环丙烷', formula: 'C4H8' },
    ],
  },
  {
    key: 'C2H6O',
    label: 'C₂H₆O 乙醇/二甲醚',
    formula: 'C2H6O',
    description: '醇与醚的官能团异构（2 种）',
    isomers: [
      { smiles: 'CCO', name: '乙醇', formula: 'C2H6O' },
      { smiles: 'COC', name: '二甲醚', formula: 'C2H6O' },
    ],
  },
  {
    key: 'C3H6O',
    label: 'C₃H₆O 丙醛/丙酮/烯丙醇',
    formula: 'C3H6O',
    description: '醛、酮、烯醇的官能团异构（3 种）',
    isomers: [
      { smiles: 'CCC=O', name: '丙醛', formula: 'C3H6O' },
      { smiles: 'CC(=O)C', name: '丙酮', formula: 'C3H6O' },
      { smiles: 'C=CCO', name: '2-丙烯-1-醇', alias: '烯丙醇', formula: 'C3H6O' },
    ],
  },
  {
    key: 'C4H9Cl',
    label: 'C₄H₉Cl 一氯丁烷',
    formula: 'C4H9Cl',
    description: '一氯丁烷的碳架与位置异构（4 种）',
    isomers: [
      { smiles: 'CCCCCl', name: '1-氯丁烷', formula: 'C4H9Cl' },
      { smiles: 'CCC(Cl)C', name: '2-氯丁烷', formula: 'C4H9Cl' },
      { smiles: 'CC(C)CCl', name: '1-氯-2-甲基丙烷', formula: 'C4H9Cl' },
      { smiles: 'CC(C)(C)Cl', name: '2-氯-2-甲基丙烷', formula: 'C4H9Cl' },
    ],
  },
  {
    key: 'C5H12O',
    label: 'C₅H₁₂O 戊醇/醚',
    formula: 'C5H12O',
    description: '戊醇（8 种）与戊基醚（6 种）共 14 种',
    isomers: [
      { smiles: 'CCCCCO', name: '1-戊醇', formula: 'C5H12O' },
      { smiles: 'CCCC(O)C', name: '2-戊醇', formula: 'C5H12O' },
      { smiles: 'CCC(O)CC', name: '3-戊醇', formula: 'C5H12O' },
      { smiles: 'CCC(C)CO', name: '2-甲基-1-丁醇', formula: 'C5H12O' },
      { smiles: 'CC(C)CCO', name: '3-甲基-1-丁醇', formula: 'C5H12O' },
      { smiles: 'CCC(C)(C)O', name: '2-甲基-2-丁醇', formula: 'C5H12O' },
      { smiles: 'CC(C)C(O)C', name: '3-甲基-2-丁醇', formula: 'C5H12O' },
      { smiles: 'CC(C)(C)CO', name: '2,2-二甲基-1-丙醇', formula: 'C5H12O' },
      { smiles: 'COCCCC', name: '甲丁醚', formula: 'C5H12O' },
      { smiles: 'CCOCCC', name: '乙丙醚', formula: 'C5H12O' },
      { smiles: 'CCOC(C)C', name: '乙基异丙基醚', formula: 'C5H12O' },
      { smiles: 'COCC(C)C', name: '甲基异丁基醚', formula: 'C5H12O' },
      { smiles: 'COC(C)CC', name: '甲基仲丁基醚', formula: 'C5H12O' },
      { smiles: 'COC(C)(C)C', name: '甲基叔丁基醚', formula: 'C5H12O' },
    ],
  },
  {
    key: 'C8H10',
    label: 'C₈H₁₀ 芳香族',
    formula: 'C8H10',
    description: '乙苯与二甲苯（4 种）',
    isomers: [
      { smiles: 'CCc1ccccc1', name: '乙苯', formula: 'C8H10' },
      { smiles: 'Cc1ccccc1C', name: '邻二甲苯', formula: 'C8H10' },
      { smiles: 'Cc1cccc(C)c1', name: '间二甲苯', formula: 'C8H10' },
      { smiles: 'Cc1ccc(C)cc1', name: '对二甲苯', formula: 'C8H10' },
    ],
  },
  {
    key: 'C1-C3',
    label: 'C₁–C₃ 烷烃',
    formula: 'C1-C3',
    description: '甲烷/乙烷/丙烷（各一种）',
    isomers: [
      { smiles: 'C', name: '甲烷', formula: 'CH4' },
      { smiles: 'CC', name: '乙烷', formula: 'C2H6' },
      { smiles: 'CCC', name: '丙烷', formula: 'C3H8' },
    ],
  },
  {
    key: 'C3H6Cl2',
    label: 'C₃H₆Cl₂ 二氯丙烷',
    formula: 'C3H6Cl2',
    description: '二氯丙烷（4 种）',
    isomers: [
      { smiles: 'CCC(Cl)Cl', name: '1,1-二氯丙烷', formula: 'C3H6Cl2' },
      { smiles: 'CC(Cl)CCl', name: '1,2-二氯丙烷', formula: 'C3H6Cl2' },
      { smiles: 'ClCCCCl', name: '1,3-二氯丙烷', formula: 'C3H6Cl2' },
      { smiles: 'CC(Cl)(Cl)C', name: '2,2-二氯丙烷', formula: 'C3H6Cl2' },
    ],
  },
  {
    key: 'C4H8Cl2',
    label: 'C₄H₈Cl₂ 二氯丁烷',
    formula: 'C4H8Cl2',
    description: '二氯丁烷（9 种）：正丁烷骨架 6 + 2-甲基丙烷骨架 3',
    isomers: [
      { smiles: 'CCCC(Cl)Cl', name: '1,1-二氯丁烷', formula: 'C4H8Cl2' },
      { smiles: 'CCC(Cl)CCl', name: '1,2-二氯丁烷', formula: 'C4H8Cl2' },
      { smiles: 'CC(Cl)CCCl', name: '1,3-二氯丁烷', formula: 'C4H8Cl2' },
      { smiles: 'ClCCCCCl', name: '1,4-二氯丁烷', formula: 'C4H8Cl2' },
      { smiles: 'CCC(Cl)(Cl)C', name: '2,2-二氯丁烷', formula: 'C4H8Cl2' },
      { smiles: 'CC(Cl)C(Cl)C', name: '2,3-二氯丁烷', formula: 'C4H8Cl2' },
      { smiles: 'CC(C)C(Cl)Cl', name: '1,1-二氯-2-甲基丙烷', formula: 'C4H8Cl2' },
      { smiles: 'CC(Cl)(C)CCl', name: '1,2-二氯-2-甲基丙烷', formula: 'C4H8Cl2' },
      { smiles: 'ClCC(C)CCl', name: '1,3-二氯-2-甲基丙烷', formula: 'C4H8Cl2' },
    ],
  },
  {
    key: 'C4H8O2',
    label: 'C₄H₈O₂ 羧酸与酯',
    formula: 'C4H8O2',
    description: '羧酸 2 种 + 酯 4 种（6 种）',
    isomers: [
      { smiles: 'CCCC(=O)O', name: '丁酸', formula: 'C4H8O2' },
      { smiles: 'CC(C)C(=O)O', name: '2-甲基丙酸', formula: 'C4H8O2' },
      { smiles: 'O=COCCC', name: '甲酸丙酯', formula: 'C4H8O2' },
      { smiles: 'O=COC(C)C', name: '甲酸异丙酯', formula: 'C4H8O2' },
      { smiles: 'CC(=O)OCC', name: '乙酸乙酯', formula: 'C4H8O2' },
      { smiles: 'CCC(=O)OC', name: '丙酸甲酯', formula: 'C4H8O2' },
    ],
  },
  {
    key: 'C5H10O2',
    label: 'C₅H₁₀O₂ 酯',
    formula: 'C5H10O2',
    description: '酯（9 种）：甲酸丁酯 4 + 乙酸丙酯 2 + 丙酸乙酯 1 + 丁酸甲酯 1 + 2-甲基丙酸甲酯 1',
    isomers: [
      { smiles: 'O=COCCCC', name: '甲酸丁酯', formula: 'C5H10O2' },
      { smiles: 'O=COCC(C)C', name: '甲酸异丁酯', formula: 'C5H10O2' },
      { smiles: 'O=COC(C)CC', name: '甲酸仲丁酯', formula: 'C5H10O2' },
      { smiles: 'O=COC(C)(C)C', name: '甲酸叔丁酯', formula: 'C5H10O2' },
      { smiles: 'CC(=O)OCCC', name: '乙酸丙酯', formula: 'C5H10O2' },
      { smiles: 'CC(=O)OC(C)C', name: '乙酸异丙酯', formula: 'C5H10O2' },
      { smiles: 'CCC(=O)OCC', name: '丙酸乙酯', formula: 'C5H10O2' },
      { smiles: 'CCCC(=O)OC', name: '丁酸甲酯', formula: 'C5H10O2' },
      { smiles: 'CC(C)C(=O)OC', name: '2-甲基丙酸甲酯', formula: 'C5H10O2' },
    ],
  },
  {
    key: 'C8H10O',
    label: 'C₈H₁₀O 含苯环',
    formula: 'C8H10O',
    description: '酚 9（邻/间/对乙基苯酚 + 二甲酚 6）+ 醚 4（苯乙醚 + 甲基苯甲醚 3）+ 醇 2（苯乙醇/1-苯乙醇），共 15 种',
    isomers: [
      { smiles: 'Oc1ccccc1CC', name: '邻乙基苯酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'Oc1cccc(CC)c1', name: '间乙基苯酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'Oc1ccc(CC)cc1', name: '对乙基苯酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'Cc1cccc(O)c1C', name: '2,3-二甲酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'Oc1c(C)cc(C)cc1', name: '2,4-二甲酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'Cc1cc(O)c(C)cc1', name: '2,5-二甲酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'Cc1cccc(C)c1O', name: '2,6-二甲酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'Oc1ccc(C)c(C)c1', name: '3,4-二甲酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'Cc1cc(O)cc(C)c1', name: '3,5-二甲酚', formula: 'C8H10O', group: '酚' },
      { smiles: 'CCOc1ccccc1', name: '苯乙醚', formula: 'C8H10O', group: '醚' },
      { smiles: 'COc1ccccc1C', name: '邻甲基苯甲醚', formula: 'C8H10O', group: '醚' },
      { smiles: 'COc1cccc(C)c1', name: '间甲基苯甲醚', formula: 'C8H10O', group: '醚' },
      { smiles: 'COc1ccc(C)cc1', name: '对甲基苯甲醚', formula: 'C8H10O', group: '醚' },
      { smiles: 'OCCc1ccccc1', name: '苯乙醇', formula: 'C8H10O', group: '醇' },
      { smiles: 'CC(O)c1ccccc1', name: '1-苯乙醇', formula: 'C8H10O', group: '醇' },
    ],
  },
];
