/**
 * 官能团转化路线图（HTML 分层卡片布局）
 * 按化学氧化态分为 4 层，无 SVG 连线（无交叉/穿透/标签重叠）；
 * 拓扑关系用「出边 chip」与「点击节点出入边面板」承载；
 * 数据零改动：REACTION_NODES / REACTION_EDGES / findPath 原样使用。
 */
import React, { useMemo, useState } from 'react';
import { REACTION_NODES, REACTION_EDGES, findPath, type ReactionEdge } from '../../data/reactionNetwork';
import { Card } from '../common/ui';
import { ErrorBoundary } from '../common/ErrorBoundary';

/** 节点 → 氧化态层号（组件内定义，不改 src/data） */
const LAYER_OF: Record<string, number> = {
  alkane: 1,
  alkene: 1,
  alkyne: 1,
  aromatic: 1,
  haloalkane: 2,
  alcohol: 2,
  aldehyde: 3,
  ketone: 3,
  acid: 4,
  ester: 4,
  phenol: 4,
};

const LAYER_LABELS: Record<number, string> = {
  1: '烃类（烷/烯/炔/芳烃）',
  2: '卤代烃 / 醇',
  3: '醛 / 酮',
  4: '羧酸 / 酯 / 酚',
};

export function ReactionRoadmap() {
  const [from, setFrom] = useState('alcohol');
  const [to, setTo] = useState('acid');
  const [activeEdge, setActiveEdge] = useState<ReactionEdge | null>(null);
  // 点击节点查看其出入边关系（展开详情面板，再点同节点收起）
  const [selNode, setSelNode] = useState<string | null>(null);

  const path = useMemo(() => findPath(from, to), [from, to]);
  const pathKeys = useMemo(() => new Set((path ?? []).map((e) => `${e.from}->${e.to}`)), [path]);

  const layers = useMemo(() => {
    const ls = [1, 2, 3, 4];
    return ls.map((l) => ({
      layer: l,
      label: LAYER_LABELS[l],
      nodes: REACTION_NODES.filter((nd) => LAYER_OF[nd.id] === l),
    }));
  }, []);

  const outEdgesOf = (id: string) => REACTION_EDGES.filter((e) => e.from === id);
  const inEdgesOf = (id: string) => REACTION_EDGES.filter((e) => e.to === id);

  const selOut = useMemo(() => (selNode ? outEdgesOf(selNode) : []), [selNode]);
  const selIn = useMemo(() => (selNode ? inEdgesOf(selNode) : []), [selNode]);

  return (
    <ErrorBoundary>
      <Card title="官能团转化路线图">
        <div className="border-b border-gray-100 pb-3 mb-4">
          <div className="text-[15px] font-semibold text-ink mb-1">人教版选择性必修三「整理与提升」</div>
          <div className="text-[13.5px] text-ink-soft leading-relaxed">
            选择起点与终点，高亮转化路径；点击卡片查看该官能团的转化关系，点击「→ 目标 · 反应」标签查看反应条件与方程式。
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-[14px] font-medium text-ink">起点：</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 h-[44px] min-w-[100px]">
            {REACTION_NODES.map((nd) => (
              <option key={nd.id} value={nd.id}>
                {nd.label}
              </option>
            ))}
          </select>
          <span className="text-[14px] font-medium text-ink">→ 终点：</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 h-[44px] min-w-[100px]">
            {REACTION_NODES.map((nd) => (
              <option key={nd.id} value={nd.id}>
                {nd.label}
              </option>
            ))}
          </select>
          <span className="ml-1 text-[14px] leading-tight">
            {path ? (
              <span className="text-emerald-700 font-semibold">
                找到路径：{path.map((e) => e.from).join(' → ')} → {path.length ? path[path.length - 1].to : to}
              </span>
            ) : (
              <span className="text-red-600 font-medium">未找到可达路径</span>
            )}
          </span>
        </div>

        {/* 分层卡片流 */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] gap-4 items-start">
          {/* 左：分层卡片流 */}
          <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4">
          {layers.map(({ layer, label, nodes }, li) => (
            <div key={layer}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12.5px] font-semibold text-ink-soft whitespace-nowrap">
                  第{layer}层 · {label}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="flex flex-wrap gap-3 items-start">
                {nodes.map((nd) => {
                  const isFrom = nd.id === from;
                  const isTo = nd.id === to;
                  const isSel = nd.id === selNode;
                  const onPath = path?.some((e) => e.from === nd.id) || path?.some((e) => e.to === nd.id) || nd.id === from || nd.id === to;
                  const badge = isFrom ? '起点' : isTo ? '终点' : onPath ? '路径' : null;
                  return (
                    <div key={nd.id} className="flex flex-col items-center">
                      {/* 徽章占位区（无徽章时保留等高空白） */}
                      <div className="h-6 mb-1 flex items-center">
                        {badge && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${
                              isFrom ? 'bg-blue-500' : isTo ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </div>
                      <div
                        onClick={() => setSelNode(isSel ? null : nd.id)}
                        className={`relative w-44 rounded-xl border-2 px-3.5 py-3 cursor-pointer transition-all select-none min-h-[100px] ${
                          isFrom
                            ? 'bg-blue-50 border-blue-500 shadow-sm'
                            : isTo
                              ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                              : onPath
                                ? 'bg-amber-50 border-amber-400 shadow-sm'
                                : isSel
                                  ? 'bg-white border-primary ring-2 ring-primary/40'
                                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className={`text-[16px] font-bold ${isFrom ? 'text-blue-700' : isTo ? 'text-emerald-700' : onPath ? 'text-amber-800' : 'text-ink'}`}>
                            {nd.label}
                          </span>
                          {isSel && <span className="text-[11px] text-primary font-medium">已选中</span>}
                        </div>
                        <div className="text-[12.5px] text-ink-soft mt-0.5 font-mono">{nd.icon}</div>

                        {/* 出边 chip 列表（拓扑关系承载） */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {outEdgesOf(nd.id).map((e) => {
                            const active = activeEdge === e;
                            return (
                              <button
                                key={`${e.from}->${e.to}`}
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setActiveEdge(active ? null : e);
                                }}
                                title={`${e.condition}｜${e.equation}`}
                                className={`px-2 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                                  active
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                }`}
                              >
                                → {nodeLabel(e.to)} · {e.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* 层间主链方向箭头（氧化方向） */}
              {li < layers.length - 1 && (
                <div className="flex items-center gap-3 my-4 pl-2 border-t border-dashed border-gray-300 pt-3">
                  <span className="text-[14px] text-gray-400">▼</span>
                  <span className="text-[12.5px] font-medium text-gray-500">氧化方向（层升）</span>
                </div>
              )}
            </div>
          ))}
          </div>

          {/* 右：路径步骤面板（选中路径的先后顺序） */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[14.5px] font-bold text-ink">当前路径步骤</div>
              {path && path.length > 0 && <span className="text-[11.5px] text-ink-soft">共 {path.length} 步反应</span>}
            </div>
            {path === null ? (
              <div className="text-[13px] text-ink-soft leading-relaxed">未找到可达路径：请更换起点或终点。</div>
            ) : path.length === 0 ? (
              <div className="text-[13px] text-ink-soft">起点与终点相同，无需转化。</div>
            ) : (
              <ol className="space-y-0">
                {path.map((e, i) => (
                  <li key={`${e.from}->${e.to}`}>
                    {/* 步骤节点（起点为蓝，中间为琥珀） */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold text-white ${
                          i === 0 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className={`text-[14px] font-semibold ${i === 0 ? 'text-blue-700' : 'text-amber-800'}`}>
                        {nodeLabel(e.from)}
                      </span>
                      {i === 0 && <span className="text-[11px] text-blue-600 font-medium">起点</span>}
                    </div>
                    {/* 反应边（点击展开方程式） */}
                    <div className="ml-3 pl-4 border-l-2 border-dashed border-gray-200 py-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveEdge(activeEdge === e ? null : e)}
                        title={`${e.condition}｜${e.equation}`}
                        className={`w-full text-left rounded-lg px-2.5 py-1.5 border transition-colors ${
                          activeEdge === e ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-[13px] font-semibold text-ink">
                          {e.label} · {e.type}
                        </div>
                        <div className="text-[11.5px] text-ink-soft mt-0.5">{e.condition}</div>
                      </button>
                    </div>
                    {/* 终点节点（最后一步） */}
                    {i === path.length - 1 && (
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold text-white bg-emerald-600">
                          {path.length + 1}
                        </span>
                        <span className="text-[14px] font-semibold text-emerald-700">{nodeLabel(e.to)}</span>
                        <span className="text-[11px] text-emerald-600 font-medium">终点</span>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100 text-[12px] text-ink-soft leading-relaxed">
              点击步骤间的反应条查看条件与方程式；路径步骤与左侧卡片高亮同步。
            </div>
          </div>
        </div>

        {/* 点击边（chip）→ 方程式详情 */}
        {activeEdge && (
          <div className="mt-4 rounded-xl border border-primary-light bg-primary-light/30 px-4 py-3.5 cv-fade-in">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-bold text-ink">
                {nodeLabel(activeEdge.from)} → {nodeLabel(activeEdge.to)} · {activeEdge.type}
              </div>
              <button type="button" onClick={() => setActiveEdge(null)} className="text-ink-soft hover:text-ink text-lg leading-none">
                ✕
              </button>
            </div>
            <div className="mt-2 text-[14px] text-ink">试剂/条件：{activeEdge.condition}</div>
            <div className="mt-2 font-mono text-[13.5px] text-ink bg-white/80 rounded-lg px-3 py-2.5 border border-gray-200 leading-relaxed">{activeEdge.equation}</div>
          </div>
        )}

        {/* 点击节点 → 出入边关系详情面板 */}
        {selNode && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[15px] font-bold text-ink">「{nodeLabel(selNode)}」的转化关系</div>
              <button type="button" onClick={() => setSelNode(null)} className="text-ink-soft hover:text-ink text-lg leading-none" title="收起">
                ✕
              </button>
            </div>
            <div className="text-[13.5px] font-semibold text-ink mb-2">作为起点（出 {selOut.length} 条）</div>
            {selOut.length === 0 ? (
              <div className="text-[13px] text-ink-soft mb-4">该官能团无出边</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {selOut.map((e) => (
                  <EdgeRow key={`out-${e.from}-${e.to}`} e={e} active={activeEdge === e} onPick={setActiveEdge} />
                ))}
              </div>
            )}
            <div className="text-[13.5px] font-semibold text-ink mb-2">作为终点（入 {selIn.length} 条）</div>
            {selIn.length === 0 ? (
              <div className="text-[13px] text-ink-soft">该官能团无入边</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selIn.map((e) => (
                  <EdgeRow key={`in-${e.from}-${e.to}`} e={e} active={activeEdge === e} onPick={setActiveEdge} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 图例说明 */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="text-[14px] font-semibold text-ink mb-3">图例说明</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-4 rounded bg-blue-100 border border-blue-500" />
              <span className="text-[13px] text-ink-soft">起点官能团</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-4 rounded bg-emerald-100 border border-emerald-500" />
              <span className="text-[13px] text-ink-soft">终点官能团</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-4 rounded bg-amber-100 border border-amber-400" />
              <span className="text-[13px] text-ink-soft">路径上节点</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-[11px] text-gray-600">→ 醇 · 水解</div>
              <span className="text-[13px] text-ink-soft">转化标签（点击看详情）</span>
            </div>
          </div>
          <div className="mt-3 text-[12.5px] text-ink-soft leading-relaxed">
            分层按氧化态排列（第1层烃 → 第4层酸/酯/酚），卡片上的「→ 目标 · 反应」标签即该官能团的出边，点击查看条件与方程式；点击卡片查看完整出入边关系。
          </div>
        </div>
      </Card>
    </ErrorBoundary>
  );
}

function nodeLabel(id: string): string {
  return REACTION_NODES.find((n) => n.id === id)?.label ?? id;
}

/** 单条转化关系卡片（出入边面板用）；点击置为 activeEdge 展开方程式 */
function EdgeRow({ e, active, onPick }: { e: ReactionEdge; active: boolean; onPick: (e: ReactionEdge) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(e)}
      title="点击展开方程式"
      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
        active ? 'border-primary bg-primary-light/30' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className="text-[13.5px] font-semibold text-ink">
        {nodeLabel(e.from)} → {nodeLabel(e.to)} · {e.type}
      </div>
      <div className="text-[12.5px] text-ink-soft mt-0.5">{e.condition}</div>
      <div className="font-mono text-[12px] text-ink bg-white/80 rounded px-2 py-1 mt-1 border border-gray-100 leading-relaxed">{e.equation}</div>
    </button>
  );
}
