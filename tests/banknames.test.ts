import { it, expect } from 'vitest';
import { parseSmiles } from '../src/core/chem/graph';
import { nameGraph } from '../src/core/reverse/namer';
import { BANK } from '../src/data/smilesLibrary';

it('题库名称与命名器一致', () => {
  const mismatches: string[] = [];
  for (const b of BANK) {
    const n = nameGraph(parseSmiles(b.smiles));
    if (!n.ok) {
      mismatches.push(`${b.smiles} 命名失败`);
      continue;
    }
    if (n.name !== b.name) {
      mismatches.push(`${b.smiles}: 题库「${b.name}」vs 命名器「${n.name}」`);
    }
  }
  expect(mismatches).toEqual([]);
});
