/**
 * 分子式层面展示数据（无 SMILES、不参与结构判题）
 * 覆盖：糖类二糖/多糖等天然高分子，仅提供分子式与说明供教学展示。
 */
export interface FormulaOnlyEntry {
  name: string;
  formula: string;
  note: string;
}

export const FORMULA_ONLY: FormulaOnlyEntry[] = [
  { name: '蔗糖', formula: 'C12H22O11', note: '一分子葡萄糖与一分子果糖脱水缩合' },
  { name: '麦芽糖', formula: 'C12H22O11', note: '两分子葡萄糖脱水缩合' },
  { name: '淀粉', formula: '(C6H10O5)n', note: '天然高分子（多糖），葡萄糖聚合' },
  { name: '纤维素', formula: '(C6H10O5)n', note: '天然高分子（多糖），葡萄糖聚合' },
];
