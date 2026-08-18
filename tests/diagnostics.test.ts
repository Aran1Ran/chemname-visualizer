/**
 * 错误诊断测试（模块 1.4 示例）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initRDKit } from '../src/core/rdkit';
import { diagnose } from '../src/core/naming/diagnostics';

beforeAll(async () => {
  await initRDKit(() => fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url)));
}, 60000);

describe('错误诊断', () => {
  it('3-甲基丁烷 → 提示编号问题并给出 2-甲基丁烷', () => {
    const d = diagnose('3-甲基丁烷');
    expect(d.isCorrect).toBe(false);
    expect(d.correctName).toBe('2-甲基丁烷');
    expect(d.type).toBe('numbering');
    expect(d.message).toContain('母体不是最长碳链');
    expect(d.message).toContain('2-甲基丁烷');
  });

  it('1-甲基丙烷 → 1 号位取代基并入主链', () => {
    const d = diagnose('1-甲基丙烷');
    expect(d.isCorrect).toBe(false);
    expect(d.type).toBe('position-1-substituent');
    expect(d.correctName).toBe('丁烷');
    expect(d.message).toContain('1号位不能有取代基');
  });

  it('2-乙基丙烷 → 母体不是最长碳链', () => {
    const d = diagnose('2-乙基丙烷');
    expect(d.isCorrect).toBe(false);
    expect(d.type).toBe('not-longest-chain');
    expect(d.correctName).toBe('2-甲基丁烷');
    expect(d.message).toContain('母体不是最长碳链');
  });

  it('正确名称 → ok', () => {
    const d = diagnose('2-甲基丙烷');
    expect(d.isCorrect).toBe(true);
    expect(d.type).toBe('ok');
    expect(d.correctName).toBe('2-甲基丙烷');
  });

  it('俗名也判定正确', () => {
    const d = diagnose('异戊烷');
    expect(d.isCorrect).toBe(true);
    expect(d.correctName).toBe('2-甲基丁烷');
  });
});
