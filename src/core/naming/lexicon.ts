/**
 * 中文系统命名法词表（高中人教版范围）
 */

/** 碳数词干 → 链长 */
export const STEM_LEN: Record<string, number> = {
  甲: 1, 乙: 2, 丙: 3, 丁: 4, 戊: 5, 己: 6, 庚: 7, 辛: 8, 壬: 9, 癸: 10,
};

/** 链长 → 碳数词干 */
export const LEN_STEM: string[] = ['', '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 母体后缀 */
export const SUFFIXES = ['烷', '烯', '炔', '醇', '醛', '酮', '酸', '酯', '胺', '腈', '苯', '酚', '酰胺'] as const;
export type Suffix = (typeof SUFFIXES)[number];

/** 中文数字（位置/倍数） */
export const CN_DIGITS: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};
export const CN_DIGIT_CHARS = '一二三四五六七八九十';

export const ARABIC_DIGITS = '0123456789';

/** 倍数词（二甲基 的 二） */
export const MULTIPLIERS: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
};

/** 位置相关的前缀：邻/间/对 + 均/偏/连（苯环位次，1 位起） */
export const ORTHO_META_PARA: Record<string, number[]> = {
  邻: [1, 2],
  间: [1, 3],
  对: [1, 4],
  均: [1, 3, 5],
  偏: [1, 2, 4],
  连: [1, 2, 3],
};

/**
 * 取代基表：name → 片段信息
 * kind: 'alkyl' 烷基碳链 / 'halogen' 卤素 / 'group' 官能团原子
 * smiles: 以连接键形式给出（写 SMILES 时拼在父链后）
 */
export interface SubstituentInfo {
  kind: 'alkyl' | 'halogen' | 'group';
  /** 片段 SMILES（如 甲基 = 'C'，乙基 = 'CC'，羟基 = 'O'，硝基 = '[N+](=O)[O-]'） */
  smiles: string;
  /** 片段根原子在 smiles 中的索引（连接点） */
  attachIndex: number;
  /** 片段碳数（用于最长链分析时的提示文案） */
  carbonCount: number;
}

export const SUBSTITUENTS: Record<string, SubstituentInfo> = {
  甲基: { kind: 'alkyl', smiles: 'C', attachIndex: 0, carbonCount: 1 },
  乙基: { kind: 'alkyl', smiles: 'CC', attachIndex: 0, carbonCount: 2 },
  正丙基: { kind: 'alkyl', smiles: 'CCC', attachIndex: 0, carbonCount: 3 },
  丙基: { kind: 'alkyl', smiles: 'CCC', attachIndex: 0, carbonCount: 3 },
  异丙基: { kind: 'alkyl', smiles: 'CC(C)', attachIndex: 1, carbonCount: 3 },
  正丁基: { kind: 'alkyl', smiles: 'CCCC', attachIndex: 0, carbonCount: 4 },
  丁基: { kind: 'alkyl', smiles: 'CCCC', attachIndex: 0, carbonCount: 4 },
  异丁基: { kind: 'alkyl', smiles: 'CC(C)C', attachIndex: 0, carbonCount: 4 },
  仲丁基: { kind: 'alkyl', smiles: 'CCC(C)', attachIndex: 2, carbonCount: 4 },
  叔丁基: { kind: 'alkyl', smiles: 'C(C)(C)C', attachIndex: 0, carbonCount: 4 },
  苯基: { kind: 'alkyl', smiles: 'c1ccccc1', attachIndex: 0, carbonCount: 6 },
  溴: { kind: 'halogen', smiles: 'Br', attachIndex: 0, carbonCount: 0 },
  氯: { kind: 'halogen', smiles: 'Cl', attachIndex: 0, carbonCount: 0 },
  氟: { kind: 'halogen', smiles: 'F', attachIndex: 0, carbonCount: 0 },
  碘: { kind: 'halogen', smiles: 'I', attachIndex: 0, carbonCount: 0 },
  羟基: { kind: 'group', smiles: 'O', attachIndex: 0, carbonCount: 0 },
  氨基: { kind: 'group', smiles: 'N', attachIndex: 0, carbonCount: 0 },
  硝基: { kind: 'group', smiles: '[N+](=O)[O-]', attachIndex: 0, carbonCount: 0 },
  甲氧基: { kind: 'group', smiles: 'OC', attachIndex: 0, carbonCount: 1 },
  乙氧基: { kind: 'group', smiles: 'OCC', attachIndex: 0, carbonCount: 2 },
  醛基: { kind: 'group', smiles: 'C=O', attachIndex: 0, carbonCount: 1 },
  羧基: { kind: 'group', smiles: 'C(=O)O', attachIndex: 0, carbonCount: 1 },
  乙烯基: { kind: 'alkyl', smiles: 'C=C', attachIndex: 0, carbonCount: 2 },
  乙炔基: { kind: 'alkyl', smiles: 'C#C', attachIndex: 0, carbonCount: 2 },
  乙酰氧基: { kind: 'group', smiles: 'OC(=O)C', attachIndex: 0, carbonCount: 2 },
};

/** 可供 parser 识别的取代基名（含别名） */
export const SUBSTITUENT_NAMES: string[] = [
  '叔丁基', '异丁基', '仲丁基', '正丁基', '异丙基', '正丙基', '甲氧基', '乙氧基', '乙烯基', '乙炔基', '乙酰氧基',
  '甲基', '乙基', '丙基', '丁基', '苯基',
  '羟基', '氨基', '硝基', '醛基', '羧基',
  '溴', '氯', '氟', '碘',
];

/** 俗名表：俗名 → { 系统名, smiles } */
export interface CommonNameEntry {
  systematicName: string;
  smiles: string;
}

export const COMMON_NAMES: Record<string, CommonNameEntry> = {
  // 仅收录"系统名之外的俗名/别名"；乙醇、丙酮、乙酸、甲苯、苯酚等本身就是系统名，
  // 由 parser 走系统名路径解析（避免自引用递归）
  正戊烷: { systematicName: '戊烷', smiles: 'CCCCC' },
  正丁烷: { systematicName: '丁烷', smiles: 'CCCC' },
  正己烷: { systematicName: '己烷', smiles: 'CCCCCC' },
  异丁烷: { systematicName: '2-甲基丙烷', smiles: 'CC(C)C' },
  异戊烷: { systematicName: '2-甲基丁烷', smiles: 'CC(C)CC' },
  新戊烷: { systematicName: '2,2-二甲基丙烷', smiles: 'CC(C)(C)C' },
  异己烷: { systematicName: '2-甲基戊烷', smiles: 'CC(C)CCC' },
  新己烷: { systematicName: '2,2-二甲基丁烷', smiles: 'CCC(C)(C)C' },
  醋酸: { systematicName: '乙酸', smiles: 'CC(=O)O' },
  蚁酸: { systematicName: '甲酸', smiles: 'O=CO' },
  石炭酸: { systematicName: '苯酚', smiles: 'Oc1ccccc1' },
  甘油: { systematicName: '丙三醇', smiles: 'OCC(O)CO' },
  氯仿: { systematicName: '三氯甲烷', smiles: 'ClC(Cl)Cl' },
  烯丙醇: { systematicName: '2-丙烯-1-醇', smiles: 'C=CCO' },
  // 第四节复杂命名俗名
  异戊二烯: { systematicName: '2-甲基-1,3-丁二烯', smiles: 'C=C(C)C=C' },
  乳酸: { systematicName: '2-羟基丙酸', smiles: 'CC(O)C(=O)O' },
  苹果酸: { systematicName: '2-羟基丁二酸', smiles: 'O=C(O)C(O)CC(=O)O' },
  甘氨酸: { systematicName: '氨基乙酸', smiles: 'NCC(=O)O' },
  丙氨酸: { systematicName: '2-氨基丙酸', smiles: 'CC(N)C(=O)O' },
  草酸: { systematicName: '乙二酸', smiles: 'O=C(O)C(=O)O' },
  // 包 B：四.6/四.7
  丙烯腈: { systematicName: '2-丙烯腈', smiles: 'C=CC#N' },
  水杨酸: { systematicName: '邻羟基苯甲酸', smiles: 'OC(=O)c1ccccc1O' },
  阿司匹林: { systematicName: '邻乙酰氧基苯甲酸', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  乙酰水杨酸: { systematicName: '邻乙酰氧基苯甲酸', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  甲基丙烯酸甲酯: { systematicName: '2-甲基-2-丙烯酸甲酯', smiles: 'C=C(C)C(=O)OC' },
  乙酰乙酸乙酯: { systematicName: '3-氧代丁酸乙酯', smiles: 'CC(=O)CC(=O)OCC' },
  葡萄糖: { systematicName: '2,3,4,5,6-五羟基己醛', smiles: 'O=CC(O)C(O)C(O)C(O)CO' },
  果糖: { systematicName: '1,3,4,5,6-五羟基-2-己酮', smiles: 'OCC(=O)C(O)C(O)C(O)CO' },
  // 批A：高考语料俗名词条
  // systematicName 为空 = 系统名不可达，buildFromParsed 走 smiles 直建（结构正确、教学标注降级）
  联苯: { systematicName: '', smiles: 'c1ccc(-c2ccccc2)cc1' },
  二苯甲烷: { systematicName: '', smiles: 'c1ccccc1Cc2ccccc2' },
  三苯甲烷: { systematicName: '', smiles: 'C(c1ccccc1)(c2ccccc2)c3ccccc3' },
  二苯醚: { systematicName: '', smiles: 'O(c1ccccc1)c2ccccc2' },
  对乙酰氨基酚: { systematicName: '', smiles: 'CC(=O)Nc1ccc(O)cc1' },
  对苯二甲酸乙二醇酯: { systematicName: '', smiles: 'OC(=O)c1ccc(C(=O)OCCO)cc1' },
  二乙酸乙二酯: { systematicName: '', smiles: 'CC(=O)OCCOC(=O)C' },
  四氯化碳: { systematicName: '四氯甲烷', smiles: 'ClC(Cl)(Cl)Cl' },
  水杨酸甲酯: { systematicName: '邻羟基苯甲酸甲酯', smiles: 'COC(=O)c1ccccc1O' },
  酒石酸: { systematicName: '2,3-二羟基丁二酸', smiles: 'OC(=O)C(O)C(O)C(=O)O' },
  柠檬酸: { systematicName: '2-羟基丙烷-1,2,3-三羧酸', smiles: 'OC(=O)CC(O)(CC(=O)O)C(=O)O' },
  苯丙氨酸: { systematicName: '2-氨基-3-苯基丙酸', smiles: 'OC(=O)C(N)Cc1ccccc1' },
  // 对乙酰氨基酚：依赖批 B（芳香酰胺能力），本阶段留 MISSING，批 B 联调后转正
};

/** 词干简写 → 烷基名（甲苯/二甲苯 中的 甲） */
export const STEM_ALKYL: Record<string, string> = {
  甲: '甲基', 乙: '乙基', 丙: '丙基', 丁: '丁基',
  戊: '戊基', 己: '己基', 庚: '庚基', 辛: '辛基', 壬: '壬基', 癸: '癸基',
};

/** 稠环芳烃正向模板：基础模板 + 常见位次取代基变体（键 = '取代基名@位次'） */
export const FUSED_TEMPLATES: Record<string, { base: string; variants: Record<string, string> }> = {
  萘: {
    base: 'c1ccc2ccccc2c1',
    variants: {
      '甲基@1': 'c1cc(C)c2ccccc2c1',
      '甲基@2': 'Cc1ccc2ccccc2c1',
      '羟基@2': 'Oc1ccc2ccccc2c1',
    },
  },
  蒽: { base: 'c1ccc2cc3ccccc3cc2c1', variants: {} },
  菲: { base: 'c1ccc2c(c1)ccc1ccccc12', variants: {} },
};

/** 判断字符串是否为纯中文字符 */
export function isChineseChar(ch: string): boolean {
  return /[\u4e00-\u9fff]/.test(ch);
}
