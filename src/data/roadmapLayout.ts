/**
 * 官能团转化路线图布局（节点坐标 + 视口尺寸）
 * 与 src/data/reactionNetwork.ts 的 REACTION_NODES / REACTION_EDGES 配套：
 * 键必须 ⊇ 全部节点 id 与边端点（tests/ 有防回归断言）。
 * 布局分三排：
 *   第一排 y=60  烷烃/烯烃/炔烃/芳香烃
 *   第二排 y=180 卤代烃/醇/醛/羧酸
 *   第三排 y=300 苯酚（卤代烃水解产物）/ 酯（羧酸酯化产物）
 */
export const NODE_POS: Record<string, { x: number; y: number }> = {
  alkane: { x: 70, y: 60 },
  alkene: { x: 220, y: 60 },
  alkyne: { x: 370, y: 60 },
  aromatic: { x: 520, y: 60 },
  haloalkane: { x: 145, y: 180 },
  alcohol: { x: 295, y: 180 },
  aldehyde: { x: 445, y: 180 },
  ketone: { x: 370, y: 300 },
  acid: { x: 595, y: 180 },
  phenol: { x: 145, y: 300 },
  ester: { x: 595, y: 300 },
};

export const ROADMAP_W = 830;
export const ROADMAP_H = 350;
