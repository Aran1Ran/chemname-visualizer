/**
 * 官能团示例分子数据回归测试：
 * 保证「未找到官能团」横幅中的每个示例都真的能被对应官能团 SMARTS 命中，
 * 避免示例失效误导学生；同时验证 matchCount 与未命中行为。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initRDKit } from '../src/core/rdkit';
import { FUNCTIONAL_GROUPS, highlightFunctionalGroup } from '../src/core/chem/fgroups';
import { GROUP_EXAMPLES } from '../src/data/fgExamples';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

describe('官能团示例分子数据（GROUP_EXAMPLES）', () => {
  beforeAll(async () => {
    await initRDKit(() => WASM_PATH);
  }, 60000);

  it('每个官能团都配置了示例', () => {
    for (const g of FUNCTIONAL_GROUPS) {
      const examples = GROUP_EXAMPLES[g.id];
      expect(examples, `缺少 ${g.id}（${g.name}）的示例`).toBeTruthy();
      expect(examples!.length, `${g.id} 至少应有 1 个示例`).toBeGreaterThan(0);
    }
  });

  for (const g of FUNCTIONAL_GROUPS) {
    it(`${g.name}：所有示例都能命中`, async () => {
      for (const ex of GROUP_EXAMPLES[g.id] ?? []) {
        const r = await highlightFunctionalGroup(ex.smiles, g);
        expect(r, `${ex.label}（${ex.smiles}）应命中 ${g.name}`).not.toBeNull();
        expect(r!.atoms.length, `${ex.label} 命中原子数应 > 0`).toBeGreaterThan(0);
      }
    });
  }

  it('matchCount 反映独立匹配处数（1,3-丁二烯含 2 处 C=C）', async () => {
    const alkene = FUNCTIONAL_GROUPS.find((g) => g.id === 'alkene')!;
    const r = await highlightFunctionalGroup('C=CC=C', alkene);
    expect(r).not.toBeNull();
    expect(r!.matchCount).toBe(2);
    expect(r!.atoms.length).toBe(4);
  });

  it('不含该官能团的分子返回 null（乙烷无羟基）', async () => {
    const hydroxyl = FUNCTIONAL_GROUPS.find((g) => g.id === 'hydroxyl')!;
    expect(await highlightFunctionalGroup('CC', hydroxyl)).toBeNull();
  });
});
