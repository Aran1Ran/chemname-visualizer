/**
 * 反向练习判题测试
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initRDKit } from '../src/core/rdkit';
import { judgeAnswer } from '../src/core/practice/judge';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

beforeAll(async () => {
  await initRDKit(() => WASM_PATH);
}, 60000);

describe('反向练习判题', () => {
  it('正确答案判定正确', async () => {
    const r = await judgeAnswer('CC(C)C', '2-甲基丙烷');
    expect(r.correct).toBe(true);
    expect(r.parseOk).toBe(true);
  });

  it('俗名等价判对', async () => {
    const r = await judgeAnswer('CC(C)CC', '异戊烷');
    expect(r.correct).toBe(true);
  });

  it('母体判断错误', async () => {
    const r = await judgeAnswer('CC(C)C', '丁烷');
    expect(r.correct).toBe(false);
    expect(r.errorTypes).toContain('母体判断');
  });

  it('编号方向错误（位置写错）', async () => {
    const r = await judgeAnswer('CC(C)CCC', '3-甲基戊烷');
    expect(r.correct).toBe(false);
    expect(r.errorTypes).toContain('编号方向');
  });

  it('漏写倍数词', async () => {
    const r = await judgeAnswer('CC(C)(C)C', '甲基丙烷');
    expect(r.correct).toBe(false);
    // 甲基丙烷 → 默认 2-甲基丙烷，与 2,2-二甲基丙烷 不同
    expect(r.errorTypes.length).toBeGreaterThan(0);
  });

  it('无法识别的名称', async () => {
    const r = await judgeAnswer('CC(C)C', '甲某某基丙烷');
    expect(r.correct).toBe(false);
    expect(r.parseOk).toBe(false);
    expect(r.errorTypes).toContain('格式错误');
  });

  it('正确答案名称可展示', async () => {
    const r = await judgeAnswer('Cc1ccc(C)cc1', '二甲苯');
    expect(r.correctName).toBe('对二甲苯');
  });
});
