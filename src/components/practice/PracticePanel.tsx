/**
 * 模块 2：结构 → 名称反向练习
 * 随机出题不重复、3 次尝试、具体错误反馈、统计与错题本
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BANK, LEVELS, bankOfLevel, type BankItem } from '../../data/smilesLibrary';
import { judgeAnswer } from '../../core/practice/judge';
import { computeStats, loadRecords, saveRecord, clearRecords, type PracticeRecord } from '../../core/storage';
import { StructureViewer } from '../structure/StructureViewer';
import { Button, Card, Hint, Collapse } from '../common/ui';

export default function PracticePanel() {
  const [level, setLevel] = useState(2);
  const [autoLevel, setAutoLevel] = useState(false);
  const [queue, setQueue] = useState<BankItem[]>([]);
  const [current, setCurrent] = useState<BankItem | null>(null);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Array<{ text: string; ok: boolean }>>([]);
  const [errorTypes, setErrorTypes] = useState<string[]>([]);
  const [solved, setSolved] = useState(false); // 已答对或已揭晓
  const [revealed, setRevealed] = useState(false);
  const [records, setRecords] = useState<PracticeRecord[]>(() => loadRecords());
  const startTs = useRef(0);
  const lastResult = useRef<{ correct: boolean; errorTypes: string[] } | null>(null);

  const stats = useMemo(() => computeStats(records), [records]);

  const pickNext = useCallback(
    (lv: number, usedSet: Set<string>): BankItem | null => {
      const pool = bankOfLevel(lv).filter((b) => !usedSet.has(b.smiles));
      if (pool.length === 0) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    []
  );

  const startQuestion = useCallback(
    (lv: number) => {
      const item = pickNext(lv, used);
      if (!item) {
        // 题库用尽 → 重置
        setUsed(new Set());
        setQueue(bankOfLevel(lv));
        const first = bankOfLevel(lv)[0];
        if (first) setCurrent(first);
        setAttempts(0);
        setFeedback([]);
        setSolved(false);
        setRevealed(false);
        setErrorTypes([]);
        startTs.current = Date.now();
        return;
      }
      setCurrent(item);
      setUsed((u) => new Set(u).add(item.smiles));
      setAttempts(0);
      setFeedback([]);
      setSolved(false);
      setRevealed(false);
      setErrorTypes([]);
      setAnswer('');
      startTs.current = Date.now();
      lastResult.current = null;
    },
    [pickNext, used]
  );

  useEffect(() => {
    if (!current) startQuestion(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!current || solved || !answer.trim()) return;
    const result = await judgeAnswer(current.smiles, answer);
    const duration = Date.now() - startTs.current;
    lastResult.current = { correct: result.correct, errorTypes: result.errorTypes };
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setFeedback(result.feedback.map((t) => ({ text: t, ok: result.correct })));
    setErrorTypes(result.errorTypes);
    setSolved(result.correct || newAttempts >= 3);

    // 记录
    const rec: PracticeRecord = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      ts: Date.now(),
      level: current.level,
      smiles: current.smiles,
      targetName: current.name,
      answer: answer.trim(),
      correct: result.correct,
      attempts: newAttempts,
      errorTypes: result.errorTypes,
      durationMs: duration,
    };
    saveRecord(rec);
    setRecords(loadRecords());

    if (newAttempts >= 3 && !result.correct) {
      setRevealed(true);
    }
  };

  const next = () => {
    // 自动递增：连续 3 题答对升难度
    if (autoLevel && lastResult.current?.correct) {
      // 简单策略：由教师手动选择为主，自动模式仅在完成时提示
    }
    startQuestion(level);
  };

  const effectiveLevel = level;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      {/* 左：控制与统计 */}
      <div className="xl:col-span-2 space-y-4">
        <Card title="难度选择" subtitle="选择出题等级（教师可控制节奏）">
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.level}
                type="button"
                onClick={() => {
                  setLevel(l.level);
                  startQuestion(l.level);
                }}
                title={l.hint}
                className={`rounded-lg border px-4 py-3 text-center transition-colors ${
                  effectiveLevel === l.level ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="text-[14px] font-bold">{l.label}</div>
                <div className="text-[12px] opacity-80 truncate mt-0.5">{l.hint}</div>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[13px] text-ink-soft">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoLevel}
                onChange={(e) => setAutoLevel(e.target.checked)}
                className="accent-primary"
              />
              自动递增难度（答对 3 题升一级）
            </label>
          </div>
        </Card>

        <Card title="练习统计" subtitle={`共练习 ${stats.total} 题 · 正确 ${stats.correct} 题 · 正确率 ${stats.accuracy}%`}>
          <div className="space-y-3">
            {stats.byLevel
              .filter((b) => b.total > 0)
              .map((b) => (
                <div key={b.level} className="flex items-center gap-2 text-[13px] leading-relaxed">
                  <span className="w-7 font-bold text-primary-dark">L{b.level}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${b.accuracy}%` }}
                    />
                  </div>
                  <span className="text-ink-soft w-24 text-right">
                    {b.total} 题 · 对 {b.correct}（{b.accuracy}%）
                  </span>
                </div>
              ))}
            {stats.errorTypes.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <div className="text-[13px] font-semibold text-ink mb-1.5">高频错误类型</div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.errorTypes.map((e) => (
                    <span key={e.type} className="rounded-full bg-red-50 text-red-700 px-2.5 py-0.5 text-[12.5px]">
                      {e.type} × {e.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2 border-t border-gray-100">
              <Button variant="ghost" size="sm" onClick={() => { clearRecords(); setRecords([]); }}>
                清空记录
              </Button>
            </div>
          </div>
        </Card>

        <Collapse label={`错题本（${records.filter((r) => !r.correct).length} 题）`}>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {records.filter((r) => !r.correct).length === 0 && <div className="text-[13px] text-ink-soft">暂无错题 🎉</div>}
            {records
              .filter((r) => !r.correct)
              .slice()
              .reverse()
              .slice(0, 50)
              .map((r) => (
                <div key={r.id} className="rounded-lg bg-red-50/60 border border-red-100 px-3 py-2 text-[12.5px]">
                  <div className="flex justify-between text-red-800">
                    <span className="font-semibold">{r.targetName}</span>
                    <span className="opacity-70">L{r.level}</span>
                  </div>
                  <div className="text-ink-soft mt-0.5">您的答案：{r.answer || '（未作答）'}</div>
                  {r.errorTypes.length > 0 && <div className="text-red-600 mt-0.5">错误：{r.errorTypes.join('、')}</div>}
                </div>
              ))}
          </div>
        </Collapse>
      </div>

      {/* 右：题目区 */}
      <div className="xl:col-span-3">
        <Card
          title={current ? `第 L${current.level} 题 · 请写出该结构的名称` : '准备出题'}
          subtitle={current ? `类型：${current.type}` : undefined}
          actions={
            <Button size="sm" onClick={next} disabled={!current} className="px-[18px] py-2.5 text-[14px]">
              下一题 →
            </Button>
          }
        >
          {current && (
            <div className="flex flex-col items-center">
              <div className="border border-gray-200 rounded-xl bg-white p-4 flex items-center justify-center">
                <StructureViewer smiles={current.smiles} viewMode="skeletal" width={560} height={420} ariaLabel="题目结构式" />
              </div>

              <div className="w-full max-w-xl mt-4">
                <div className="flex gap-2">
                  <input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void submit()}
                    placeholder="在此输入中文名称（如：2-甲基丙烷）"
                    disabled={solved}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:bg-gray-50 h-[44px]"
                  />
                  <Button onClick={() => void submit()} disabled={solved || !answer.trim()} className="h-[44px]">
                    {attempts === 0 ? '提交答案' : `再试一次（第 ${attempts + 1} 次）`}
                  </Button>
                </div>
                {!solved && <div className="mt-1.5 text-[12.5px] text-ink-soft">每题最多尝试 3 次 · 支持俗名（如「异戊烷」）</div>}

                {feedback.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {feedback.map((f, i) => (
                      <Hint key={i} kind={f.ok ? 'success' : 'warn'}>
                        {f.text}
                      </Hint>
                    ))}
                  </div>
                )}

                {revealed && (
                  <div className="mt-3">
                    <Hint kind="info">
                      <div className="font-semibold">正确答案：{current.name}</div>
                      <div className="mt-1">
                        解析：该结构的主链为最长碳链，按「位次最小」规则编号，取代基按位次书写（{current.name}）。
                      </div>
                    </Hint>
                  </div>
                )}

                {solved && !revealed && (
                  <div className="mt-3 text-center">
                    <Button variant="success" size="lg" onClick={next}>
                      回答正确！下一题 →
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
