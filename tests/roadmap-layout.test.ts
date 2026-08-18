/**
 * 路线图布局与数据一致性（防白屏回归）
 * 背景：REACTION_NODES/REACTION_EDGES 扩展（如新增苯酚）时，若组件布局表
 * NODE_POS 未同步，ReactionRoadmap 渲染访问 undefined 坐标抛 TypeError，
 * React 整树卸载 → 白屏（历史 bug）。本文件锁定"布局表键 ⊇ 节点 ∪ 边端点"，
 * 并保证所有节点在视口内、互不重叠。
 */
import { describe, it, expect } from 'vitest';
import { NODE_POS, ROADMAP_W, ROADMAP_H } from '../src/data/roadmapLayout';
import { REACTION_NODES, REACTION_EDGES, findPath } from '../src/data/reactionNetwork';

// 与 ReactionRoadmap.tsx 中节点 rect 尺寸一致
const NODE_W = 68;
const NODE_H = 40;

describe('路线图布局与数据一致性（防白屏回归）', () => {
  it('布局键覆盖全部节点 id（含苯酚/酯）', () => {
    for (const nd of REACTION_NODES) {
      expect(NODE_POS[nd.id], `缺少节点 ${nd.id}（${nd.label}）的布局`).toBeTruthy();
    }
  });

  it('布局键覆盖全部边端点', () => {
    for (const e of REACTION_EDGES) {
      expect(NODE_POS[e.from], `边 ${e.from}->${e.to} 起点无布局`).toBeTruthy();
      expect(NODE_POS[e.to], `边 ${e.from}->${e.to} 终点无布局`).toBeTruthy();
    }
  });

  it('全部节点坐标与尺寸在视口内', () => {
    for (const nd of REACTION_NODES) {
      const p = NODE_POS[nd.id];
      expect(p.x, `${nd.id} x`).toBeGreaterThanOrEqual(0);
      expect(p.x + NODE_W, `${nd.id} 右缘`).toBeLessThanOrEqual(ROADMAP_W);
      expect(p.y, `${nd.id} y`).toBeGreaterThanOrEqual(0);
      expect(p.y + NODE_H, `${nd.id} 下缘`).toBeLessThanOrEqual(ROADMAP_H);
    }
  });

  it('节点矩形互不重叠', () => {
    const rects = REACTION_NODES.map((nd) => ({ id: nd.id, x: NODE_POS[nd.id].x, y: NODE_POS[nd.id].y }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + NODE_W && a.x + NODE_W > b.x && a.y < b.y + NODE_H && a.y + NODE_H > b.y;
        expect(overlap, `${a.id} 与 ${b.id} 节点重叠`).toBe(false);
      }
    }
  });

  it('苯酚/酯位于第三排，与卤代烃/羧酸纵向对齐', () => {
    expect(NODE_POS.phenol.y).toBe(NODE_POS.haloalkane.y + 120); // 180 → 300
    expect(NODE_POS.ester.y).toBe(NODE_POS.acid.y + 120);
    expect(NODE_POS.phenol.x).toBe(NODE_POS.haloalkane.x);
    expect(NODE_POS.ester.x).toBe(NODE_POS.acid.x);
  });
});

describe('反应网络扩展（6.5：酮节点 + 5 条新边）', () => {
  it('REACTION_NODES 含酮节点（label「酮」）', () => {
    const ketone = REACTION_NODES.find((n) => n.id === 'ketone');
    expect(ketone).toBeTruthy();
    expect(ketone!.label).toBe('酮');
  });

  it('新增边存在且 from/to/type/condition/equation/label 均非空', () => {
    const edges: Array<[string, string]> = [
      ['ester', 'alcohol'],
      ['haloalkane', 'acid'],
      ['alcohol', 'ketone'],
      ['alkyne', 'aldehyde'],
    ];
    // aldehyde→acid 为两条并列边
    const aldehydeAcid = REACTION_EDGES.filter((e) => e.from === 'aldehyde' && e.to === 'acid');
    expect(aldehydeAcid.length).toBe(2);
    for (const [f, t] of edges) {
      const e = REACTION_EDGES.find((x) => x.from === f && x.to === t);
      expect(e, `${f}->${t} 应存在`).toBeTruthy();
      expect(e!.type.length, `${f}->${t} type`).toBeGreaterThan(0);
      expect(e!.condition.length, `${f}->${t} condition`).toBeGreaterThan(0);
      expect(e!.equation.length, `${f}->${t} equation`).toBeGreaterThan(0);
      expect(e!.label.length, `${f}->${t} label`).toBeGreaterThan(0);
    }
  });

  it('findPath 可达性：酯→醇、醇→酮、炔→醛、烯→醛、卤代烃→羧酸', () => {
    expect(findPath('ester', 'alcohol')).not.toBeNull();
    expect(findPath('alcohol', 'ketone')).not.toBeNull();
    expect(findPath('alkyne', 'aldehyde')).not.toBeNull();
    expect(findPath('alkene', 'aldehyde')).not.toBeNull();
    expect(findPath('haloalkane', 'acid')).not.toBeNull();
  });
});
