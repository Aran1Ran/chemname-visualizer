/**
 * 结构简式生成器测试
 */
import { describe, it, expect } from 'vitest';
import { parseSmiles } from '../src/core/chem/graph';
import { condensedFormula } from '../src/core/chem/condensed';

const CASES: Array<{ smiles: string; condensed: string }> = [
  { smiles: 'CCC', condensed: 'CH3CH2CH3' },
  { smiles: 'CC(C)C', condensed: 'CH3CH(CH3)CH3' },
  { smiles: 'CC(C)CC', condensed: 'CH3CH(CH3)CH2CH3' },
  { smiles: 'CC(C)C(C)CCC', condensed: 'CH3CH(CH3)CH(CH3)CH2CH2CH3' },
  { smiles: 'CCCCC', condensed: 'CH3CH2CH2CH2CH3' },
  { smiles: 'C=CC', condensed: 'CH2=CHCH3' },
  { smiles: 'CC=CC', condensed: 'CH3CH=CHCH3' },
  { smiles: 'C#C', condensed: 'CH≡CH' },
  { smiles: 'CCBr', condensed: 'CH3CH2Br' },
  { smiles: 'CCO', condensed: 'CH3CH2OH' },
  { smiles: 'CC(O)C', condensed: 'CH3CH(OH)CH3' },
  { smiles: 'OCCO', condensed: 'HOCH2CH2OH' },
  { smiles: 'CC=O', condensed: 'CH3CHO' },
  { smiles: 'CCC=O', condensed: 'CH3CH2CHO' },
  { smiles: 'CC(=O)C', condensed: 'CH3COCH3' },
  { smiles: 'CCC(=O)C', condensed: 'CH3CH2COCH3' },
  { smiles: 'CC(=O)O', condensed: 'CH3COOH' },
  { smiles: 'CC(=O)OCC', condensed: 'CH3COOCH2CH3' },
  { smiles: 'COC=O', condensed: 'HCOOCH3' },
  { smiles: 'Cc1ccccc1', condensed: 'C6H5CH3' },
  { smiles: 'Oc1ccccc1', condensed: 'C6H5OH' },
  { smiles: 'O=[N+]([O-])c1ccccc1', condensed: 'C6H5NO2' },
];

describe('结构简式', () => {
  for (const c of CASES) {
    it(`${c.smiles} → ${c.condensed}`, () => {
      const graph = parseSmiles(c.smiles);
      expect(condensedFormula(graph)).toBe(c.condensed);
    });
  }
});
