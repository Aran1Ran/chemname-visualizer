/**
 * 练习报告导出（CSV / TXT）
 */
import { type PracticeRecord } from '../storage';
import { downloadText } from './exporters';

export function exportReportCsv(records: PracticeRecord[]): void {
  const header = ['时间', '难度', '题目SMILES', '目标名称', '学生答案', '是否正确', '尝试次数', '错误类型', '耗时(ms)'];
  const lines = records.map((r) => [
    new Date(r.ts).toLocaleString('zh-CN', { hour12: false }),
    'L' + r.level,
    r.smiles,
    r.targetName,
    r.answer,
    r.correct ? '正确' : '错误',
    String(r.attempts),
    r.errorTypes.join('、'),
    String(r.durationMs),
  ]);
  const csv = [header, ...lines].map((row) => row.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  downloadText(csv, '练习记录.csv', 'text/csv;charset=utf-8');
}

export function exportReportTxt(records: PracticeRecord[]): void {
  const total = records.length;
  const correct = records.filter((r) => r.correct).length;
  const lines: string[] = [
    'ChemName Visualizer 练习报告',
    '生成时间：' + new Date().toLocaleString('zh-CN', { hour12: false }),
    `总题数：${total} · 正确：${correct} · 正确率：${total ? Math.round((correct / total) * 100) : 0}%`,
    '='.repeat(60),
  ];
  for (const r of records) {
    lines.push(
      `[${new Date(r.ts).toLocaleString('zh-CN', { hour12: false })}] L${r.level} ${r.targetName} | 答案：${r.answer} | ${r.correct ? '✓' : '✗'}（尝试${r.attempts}次）${r.errorTypes.length ? ' | 错误：' + r.errorTypes.join('、') : ''}`
    );
  }
  downloadText(lines.join('\r\n'), '练习报告.txt');
}
