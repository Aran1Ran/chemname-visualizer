/**
 * 官能团目录（SMARTS）与高亮辅助
 */
import { substructMatches } from '../rdkit';

/** 官能团检验反应（教学文案，教材式） */
export interface FgTest {
  name: string;
  reagent: string;
  condition: string;
  phenomenon: string;
  equation?: string;
}

export interface FunctionalGroupDef {
  id: string;
  name: string;
  /** SMARTS 查询 */
  smarts: string;
  /** 说明 */
  desc: string;
  /** 检验反应（可选，既有组不填不报错） */
  tests?: FgTest[];
}

export const FUNCTIONAL_GROUPS: FunctionalGroupDef[] = [
  {
    id: 'hydroxyl',
    name: '羟基 -OH',
    smarts: '[OX2H1]',
    desc: '醇/酚的羟基（醇羟基无检验反应，检验仅对酚羟基）',
    tests: [
      { name: '（仅酚羟基）FeCl₃ 显色', reagent: 'FeCl₃ 溶液', condition: '', phenomenon: '溶液显紫色' },
      { name: '（仅酚羟基）溴水', reagent: '溴水', condition: '', phenomenon: '产生白色沉淀（三溴苯酚）' },
    ],
  },
  {
    id: 'aldehyde',
    name: '醛基 -CHO',
    smarts: '[CX3H1,CX3H2](=O)',
    desc: '醛基（醛）',
    tests: [
      {
        name: '银镜反应',
        reagent: '银氨溶液',
        condition: '水浴加热',
        phenomenon: '试管内壁出现光亮的银镜',
        equation: 'RCHO + 2[Ag(NH₃)₂]OH —水浴→ RCOONH₄ + 2Ag↓ + 3NH₃ + H₂O',
      },
      { name: '新制氢氧化铜', reagent: '新制 Cu(OH)₂ 悬浊液', condition: '加热', phenomenon: '产生砖红色沉淀 Cu₂O' },
    ],
  },
  {
    id: 'carboxyl',
    name: '羧基 -COOH',
    smarts: '[CX3](=O)[OX2H1]',
    desc: '羧基（羧酸）',
    tests: [
      {
        name: '碳酸氢钠',
        reagent: 'NaHCO₃ 溶液',
        condition: '常温',
        phenomenon: '产生无色气泡（CO₂）',
        equation: 'RCOOH + NaHCO₃ → RCOONa + CO₂↑ + H₂O',
      },
      { name: '石蕊试液', reagent: '石蕊试液', condition: '', phenomenon: '变红' },
    ],
  },
  { id: 'ester', name: '酯基 -COO-', smarts: '[CX3](=O)[OX2][CX3,CX4]', desc: '酯基（酯）' },
  { id: 'carbonyl', name: '羰基 =O', smarts: '[CX3]=[OX1]', desc: '碳氧双键（醛/酮/酸/酯）' },
  { id: 'ether', name: '醚键 C-O-C', smarts: '[CX4][OX2][CX4]', desc: '醚键（醚）' },
  { id: 'nitrile', name: '腈基 -C≡N', smarts: '[CX2]#[NX1]', desc: '腈基（腈）' },
  { id: 'nitro', name: '硝基 -NO2', smarts: '[N+](=O)[O-]', desc: '硝基' },
  { id: 'amino', name: '氨基 -NH2', smarts: '[NX3;H2;!$(NC=O)]', desc: '氨基（胺）' },
  {
    id: 'alkene',
    name: '碳碳双键 C=C',
    smarts: '[CX3]=[CX3]',
    desc: '碳碳双键（烯烃）',
    tests: [
      { name: '溴水', reagent: '溴水', condition: '', phenomenon: '溴水褪色（加成）' },
      { name: '酸性 KMnO₄', reagent: '酸性 KMnO₄ 溶液', condition: '', phenomenon: '紫红色褪去（氧化）' },
    ],
  },
  {
    id: 'alkyne',
    name: '碳碳三键 C≡C',
    smarts: '[CX2]#[CX2]',
    desc: '碳碳三键（炔烃）',
    tests: [
      { name: '溴水', reagent: '溴水', condition: '', phenomenon: '溴水褪色（加成）' },
      { name: '酸性 KMnO₄', reagent: '酸性 KMnO₄ 溶液', condition: '', phenomenon: '紫红色褪去（氧化）' },
    ],
  },
  { id: 'benzene', name: '苯环', smarts: 'c1ccccc1', desc: '苯环（芳香环）' },
  {
    id: 'halogen',
    name: '卤素 -X',
    smarts: '[F,Cl,Br,I]',
    desc: '氟/氯/溴/碘',
    tests: [
      {
        name: '水解后硝酸银检验',
        reagent: 'NaOH 水溶液（水解）→ 稀 HNO₃ 酸化 → AgNO₃ 溶液',
        condition: 'NaOH 水溶液加热水解，酸化后滴加 AgNO₃',
        phenomenon: '产生白色/浅黄色沉淀（AgCl/AgBr）',
        equation: 'R-X + NaOH —水△→ ROH + NaX；NaX + AgNO₃ → AgX↓',
      },
    ],
  },
];

export interface FgHighlightResult {
  group: FunctionalGroupDef;
  /** 命中的原子索引（去重合并） */
  atoms: number[];
  /** 命中的键（原子对） */
  bonds: Array<[number, number]>;
  /** 独立匹配处数（SMARTS 命中的次数，如 1,3-丁二烯对 C=C 为 2 处） */
  matchCount: number;
}

/** 在分子上查找官能团并返回命中原子 */
export async function highlightFunctionalGroup(smiles: string, group: FunctionalGroupDef): Promise<FgHighlightResult | null> {
  try {
    const matches = await substructMatches(smiles, group.smarts);
    if (matches.length === 0) return null;
    const atoms = [...new Set(matches.flatMap((m) => m.atoms))];
    const bonds = matches.flatMap((m) => m.bonds.map((bi) => [m.atoms[bi], m.atoms[bi + 1]] as [number, number]));
    return { group, atoms, bonds, matchCount: matches.length };
  } catch {
    return null;
  }
}
