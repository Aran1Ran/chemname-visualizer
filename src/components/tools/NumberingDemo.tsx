/**
 * 碳链编号动画：高亮最长链 → 两种编号方向 → 位次和比较 → 最优方案
 */
import React, { useMemo, useState } from 'react';
import { parseSmiles } from '../../core/chem/graph';
import { nameGraph } from '../../core/reverse/namer';
import { StructureViewer } from '../structure/StructureViewer';
import { BallsOverlay, NumbersOverlay, ArrowOverlay, HighlightCirclesOverlay } from '../nameParse/overlays';
import { Button, Card } from '../common/ui';

export function NumberingDemo() {
  const [smiles, setSmiles] = useState('CC(C)C(C)CCC');
  const [step, setStep] = useState(0);

  const named = useMemo(() => {
    try {
      return nameGraph(parseSmiles(smiles));
    } catch {
      return null;
    }
  }, [smiles]);

  if (!named || !named.ok) {
    return (
      <Card title="碳链编号动画">
        <input value={smiles} onChange={(e) => setSmiles(e.target.value)} className="w-72 rounded-lg border border-gray-300 px-3 py-1.5 text-[13.5px]" />
        <div className="text-ink-soft text-[13px] mt-2">无法解析该结构，请检查 SMILES</div>
      </Card>
    );
  }

  const n = named.parentChainLen;
  // 主链过长（>10 个碳）时不再进行编号教学：正常显示碳链，但给出提示
  const tooLong = n > 10;
  // 覆盖层像素索引 = 分子图原子索引；chainAtomIndices[i] 才是第 i+1 位的链原子（勿用 i）
  const numbering = named.chainAtomIndices.map((atomIdx, i) => ({ position: i + 1, atomIndex: atomIdx }));
  // 两种方案的位次
  const subPos = named.substituentGroups.flatMap((g) => g.positions);
  const fgPos = named.fgPositions[0];
  const locantsA = [...subPos, ...(fgPos > 0 ? [fgPos] : [])].sort((a, b) => a - b);
  const locantsB = locantsA.map((p) => n + 1 - p).sort((a, b) => a - b);
  const sumA = locantsA.reduce((s, x) => s + x, 0);
  const sumB = locantsB.reduce((s, x) => s + x, 0);
  const useA = sumA <= sumB;

  return (
    <Card
      title="碳链编号动画"
      subtitle={`结构：${named.name} · 主链 ${n} 个碳`}
      actions={
        <div className="flex gap-3">
          <Button size="sm" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="px-4 py-2.5 text-[14px]">
            上一步
          </Button>
          <Button size="sm" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={step === 3} className="px-4 py-2.5 text-[14px]">
            下一步
          </Button>
          {step < 3 && (
            <Button size="sm" variant="ghost" onClick={() => setStep(3)} title="跳过步骤，直接显示最终结果" className="px-4 py-2.5 text-[14px]">
              跳过步骤，直接显示最终结果
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          value={smiles}
          onChange={(e) => {
            setSmiles(e.target.value);
            setStep(0);
          }}
          placeholder="输入 SMILES"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-[14px] w-64 focus:outline-none focus:ring-2 focus:ring-primary/40 h-[44px]"
        />
        <div className="flex gap-2">
          {['① 最长链', '② 两种方向', '③ 位次和', '④ 最优方案'].map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`px-3 py-2 rounded-lg text-[13px] border ${
                step === i ? 'bg-primary text-white border-primary' : 'bg-white text-ink-soft border-gray-300 hover:bg-gray-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center">
        <div className="border border-gray-200 rounded-xl bg-white p-3 flex items-center justify-center min-h-[420px]">
          <StructureViewer
            smiles={smiles}
            viewMode="skeletal"
            width={560}
            height={420}
            overlay={(ctx) => {
              const chainIdx = named.chainAtomIndices;
              // 链端点 = chainAtomIndices 的首/尾元素（像素数组索引 = 图原子索引）
              const first = chainIdx.length ? ctx.pixels[chainIdx[0]] : null;
              const last = chainIdx.length ? ctx.pixels[chainIdx[chainIdx.length - 1]] : null;
              return (
                <g>
                  {step >= 0 && <HighlightCirclesOverlay ctx={ctx} atoms={chainIdx} color="#1d4ed8" radius={13} />}
                  {!tooLong && step >= 1 && first && last && (
                    <>
                      <ArrowOverlay from={first} to={last} color="#f59e0b" label={`方案A：位次 ${locantsA.join(',') || '—'}`} delay={100} labelDy={-16} offset={8} />
                      <ArrowOverlay from={last} to={first} color="#9ca3af" label={`方案B：位次 ${locantsB.join(',') || '—'}`} delay={450} labelDy={22} offset={-8} />
                    </>
                  )}
                  {!tooLong && step >= 3 && <NumbersOverlay ctx={ctx} numbering={numbering} color="#1d4ed8" delay={300} />}
                </g>
              );
            }}
          />
        </div>

        <div className="w-full lg:w-72 space-y-2.5">
          {tooLong && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-[13.5px] text-red-800">
              ⚠ 碳链主链长度需不高于十个才可判断编号。
              <div className="mt-1 opacity-80">当前主链有 {n} 个碳，已为您正常显示碳链结构，但跳过编号演示。</div>
            </div>
          )}
          {!tooLong && step === 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3.5 py-3 text-[13.5px] text-blue-900">
              蓝色圈内为主链（最长碳链，{n} 个碳）。编号前先确定主链。
            </div>
          )}
          {!tooLong && step === 1 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-3 text-[13.5px] text-amber-900">
              主链可从两端编号（方案A / 方案B）。两种方向的位次分别为：
              <div className="mt-1.5 font-mono">A：{locantsA.join(',') || '—'}　B：{locantsB.join(',') || '—'}</div>
            </div>
          )}
          {!tooLong && step === 2 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-3 text-[13.5px] text-amber-900">
              位次和比较：
              <div className="mt-1.5">
                方案A 位次和 = {sumA}　方案B 位次和 = {sumB}
              </div>
              <div className="mt-1.5 font-semibold">
                {useA ? '方案A 位次和更小 → 选择 A' : '方案B 位次和更小 → 选择 B'}
              </div>
            </div>
          )}
          {!tooLong && step === 3 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-3 text-[13.5px] text-emerald-900">
              最优编号方案：{named.name}
              <div className="mt-1.5">位次：{[...numbering.map((x) => x.position)].join(' → ')}</div>
              <div className="mt-1.5">规则：位次和最小（{Math.min(sumA, sumB)}），取代基位次最小。</div>
            </div>
          )}
          {!tooLong && step >= 1 && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3.5 py-2.5 text-[13px] text-ink-soft">
              提示：位次相同从哪端编号都一样（如 2-丁烯）。
            </div>
          )}
          {!tooLong && step >= 1 && (
            <Button size="sm" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              ← 回看
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 text-[13px] text-ink-soft leading-relaxed">
        与「名称 → 结构」分步解析联动：在解析面板输入名称后，可复制其 SMILES 到此进行编号演示。
      </div>
    </Card>
  );
}
