/**
 * 反向命名引擎测试：SMILES → 中文系统名
 */
import { describe, it, expect } from 'vitest';
import { parseSmiles } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';

const CASES: Array<{ smiles: string; name: string }> = [
  { smiles: 'CCC', name: '丙烷' },
  { smiles: 'CC(C)C', name: '2-甲基丙烷' },
  { smiles: 'CC(C)C(C)CCC', name: '2,3-二甲基己烷' },
  { smiles: 'CC(C)C(C)(C)C', name: '2,2,3-三甲基丁烷' },
  { smiles: 'CCCCC', name: '戊烷' },
  { smiles: 'C=CCC', name: '1-丁烯' },
  { smiles: 'CC=CC', name: '2-丁烯' },
  { smiles: 'C=CC=C', name: '1,3-丁二烯' },
  { smiles: 'CC#CC', name: '2-丁炔' },
  { smiles: 'C#C', name: '乙炔' },
  { smiles: 'CCC(Br)C', name: '2-溴丁烷' },
  { smiles: 'BrCCBr', name: '1,2-二溴乙烷' },
  { smiles: 'CCO', name: '乙醇' },
  { smiles: 'CC(C)CCO', name: '3-甲基-1-丁醇' },
  { smiles: 'CC(O)C', name: '2-丙醇' },
  { smiles: 'OCCO', name: '乙二醇' },
  { smiles: 'CC=O', name: '乙醛' },
  { smiles: 'CCC=O', name: '丙醛' },
  { smiles: 'CC(=O)C', name: '丙酮' },
  { smiles: 'CCC(=O)C', name: '2-丁酮' },
  { smiles: 'CC(=O)O', name: '乙酸' },
  { smiles: 'CC(C)C(=O)O', name: '2-甲基丙酸' },
  { smiles: 'O=C(O)c1ccccc1', name: '苯甲酸' },
  { smiles: 'CCOC(C)=O', name: '乙酸乙酯' },
  { smiles: 'COC=O', name: '甲酸甲酯' },
  { smiles: 'Cc1ccccc1', name: '甲苯' },
  { smiles: 'Oc1ccccc1', name: '苯酚' },
  { smiles: 'Cc1ccc(C)cc1', name: '对二甲苯' },
  { smiles: 'Cc1ccccc1C', name: '邻二甲苯' },
  { smiles: 'O=[N+]([O-])c1ccccc1', name: '硝基苯' },
];

describe('反向命名（结构 → 名称）', () => {
  for (const c of CASES) {
    it(`${c.smiles} → ${c.name}`, () => {
      const graph = parseSmiles(c.smiles);
      const r = nameGraph(graph);
      expect(r.ok, r.error).toBe(true);
      expect(r.name).toBe(c.name);
    });
  }
});
