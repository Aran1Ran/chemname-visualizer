/**
 * 官能团示例分子数据（供「未找到官能团」时的教学引导）：
 * 每个示例都保证能被对应官能团的 SMARTS 命中，
 * 由 tests/fgExamples.test.ts 做回归验证，避免示例失效误导学生。
 */
export interface FgExample {
  /** 中文名称 */
  label: string;
  /** SMILES */
  smiles: string;
}

export const GROUP_EXAMPLES: Record<string, FgExample[]> = {
  hydroxyl: [
    { label: '甲醇', smiles: 'CO' },
    { label: '乙醇', smiles: 'CCO' },
    { label: '苯酚', smiles: 'Oc1ccccc1' },
    { label: '甘油', smiles: 'OCC(O)CO' },
  ],
  aldehyde: [
    { label: '乙醛', smiles: 'CC=O' },
    { label: '苯甲醛', smiles: 'O=Cc1ccccc1' },
    { label: '甲醛', smiles: 'C=O' },
  ],
  carboxyl: [
    { label: '乙酸', smiles: 'CC(=O)O' },
    { label: '苯甲酸', smiles: 'OC(=O)c1ccccc1' },
  ],
  ester: [
    { label: '乙酸甲酯', smiles: 'CC(=O)OC' },
    { label: '乙酸乙酯', smiles: 'CC(=O)OCC' },
    { label: '乙酸乙烯酯', smiles: 'CC(=O)OC=C' },
    { label: '甲酸乙酯', smiles: 'O=COCC' },
  ],
  carbonyl: [
    { label: '丙酮', smiles: 'CC(=O)C' },
    { label: '乙醛', smiles: 'CC=O' },
  ],
  alkene: [
    { label: '乙烯', smiles: 'C=C' },
    { label: '1,3-丁二烯', smiles: 'C=CC=C' },
    { label: '氯乙烯', smiles: 'C=CCl' },
    { label: '乙酸乙烯酯', smiles: 'CC(=O)OC=C' },
  ],
  alkyne: [
    { label: '乙炔', smiles: 'C#C' },
    { label: '2-丁炔', smiles: 'CC#CC' },
  ],
  halogen: [
    { label: '氯甲烷', smiles: 'CCl' },
    { label: '溴乙烷', smiles: 'CCBr' },
  ],
  amino: [
    { label: '甲胺', smiles: 'CN' },
    { label: '苯胺', smiles: 'Nc1ccccc1' },
  ],
  ether: [
    { label: '二甲醚', smiles: 'COC' },
    { label: '乙醚', smiles: 'CCOCC' },
  ],
  nitrile: [
    { label: '乙腈', smiles: 'CC#N' },
    { label: '丙烯腈', smiles: 'C=CC#N' },
  ],
  nitro: [
    { label: '硝基苯', smiles: 'O=[N+]([O-])c1ccccc1' },
    { label: '对硝基甲苯', smiles: 'O=[N+]([O-])c1ccc(C)cc1' },
  ],
  benzene: [
    { label: '苯', smiles: 'c1ccccc1' },
    { label: '甲苯', smiles: 'Cc1ccccc1' },
  ],
};
