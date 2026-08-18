/**
 * 母体骨架 SMILES：仅主链碳（教学步骤 1-2 用）；环系返回完整结构
 */
import type { BuiltMolecule } from './builder';

export function chainOnlySmiles(built: BuiltMolecule): string {
  if (built.isBenzene || built.isCyclic) return built.smiles;
  const chain = built.chainAtomIndices;
  let s = '';
  for (let i = 0; i < chain.length; i++) {
    if (i > 0) {
      const bond = built.graph.bonds.find(
        (b) => (b.a === chain[i - 1] && b.b === chain[i]) || (b.a === chain[i] && b.b === chain[i - 1])
      );
      if (bond?.order === 2) s += '=';
      else if (bond?.order === 3) s += '#';
    }
    s += 'C';
  }
  return s || built.smiles;
}
