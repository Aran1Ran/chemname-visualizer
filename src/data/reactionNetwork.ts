/**
 * 官能团转化路线图（人教版选择性必修三"整理与提升"）
 * 节点：烃类与主要官能团；边：试剂/条件/反应类型/方程式
 */
export interface ReactionNode {
  id: string;
  label: string;
  icon: string;
}

export interface ReactionEdge {
  from: string;
  to: string;
  /** 反应类型 */
  type: string;
  /** 试剂与条件 */
  condition: string;
  /** 示例方程式（文本） */
  equation: string;
  /** 箭头标签 */
  label: string;
}

export const REACTION_NODES: ReactionNode[] = [
  { id: 'alkane', label: '烷烃', icon: 'CₙH₂ₙ₊₂' },
  { id: 'alkene', label: '烯烃', icon: 'C=C' },
  { id: 'alkyne', label: '炔烃', icon: 'C≡C' },
  { id: 'aromatic', label: '芳香烃', icon: 'Ar' },
  { id: 'haloalkane', label: '卤代烃', icon: 'R-X' },
  { id: 'alcohol', label: '醇', icon: 'R-OH' },
  { id: 'aldehyde', label: '醛', icon: 'R-CHO' },
  { id: 'ketone', label: '酮', icon: 'R-CO-R' },
  { id: 'acid', label: '羧酸', icon: 'R-COOH' },
  { id: 'ester', label: '酯', icon: 'R-COOR' },
  { id: 'phenol', label: '苯酚', icon: 'C₆H₅OH' },
];

export const REACTION_EDGES: ReactionEdge[] = [
  // 烷烃→芳香烃 重整边置于 烷烃→卤代烃 之前：findPath('alkane','phenol') 的 BFS 先命中重整路径
  { from: 'alkane', to: 'aromatic', type: '催化重整（芳构化）', condition: '高温高压，Pt/Re 等催化剂', equation: 'CₙH₂ₙ₊₂ —催化重整→ 芳烃 + H₂', label: '重整' },
  { from: 'alkane', to: 'haloalkane', type: '取代反应', condition: '光照 + Cl₂/Br₂', equation: 'CH₄ + Cl₂ —光照→ CH₃Cl + HCl', label: '卤代' },
  { from: 'alkene', to: 'alkane', type: '加成反应', condition: '催化剂 + H₂', equation: 'CH₂=CH₂ + H₂ —催化→ CH₃CH₃', label: '加氢' },
  { from: 'alkene', to: 'haloalkane', type: '加成反应', condition: 'HX 或 X₂', equation: 'CH₂=CH₂ + HBr → CH₃CH₂Br', label: '加成' },
  { from: 'alkene', to: 'alcohol', type: '加成反应', condition: '催化剂 + H₂O', equation: 'CH₂=CH₂ + H₂O —催化→ CH₃CH₂OH', label: '水化' },
  { from: 'alkyne', to: 'alkene', type: '加成反应', condition: '催化剂 + H₂（部分）', equation: 'CH≡CH + H₂ —催化→ CH₂=CH₂', label: '加氢' },
  { from: 'alkyne', to: 'haloalkane', type: '加成反应', condition: 'HX 或 X₂', equation: 'CH≡CH + HCl → CH₂=CHCl', label: '加成' },
  { from: 'aromatic', to: 'haloalkane', type: '取代反应', condition: 'FeBr₃ + Br₂ 或光照', equation: 'C₆H₆ + Br₂ —FeBr₃→ C₆H₅Br + HBr', label: '卤代' },
  { from: 'haloalkane', to: 'alcohol', type: '取代反应（水解）', condition: 'NaOH 水溶液，加热', equation: 'CH₃CH₂Br + NaOH —水△→ CH₃CH₂OH + NaBr', label: '水解' },
  // 注意：此处为芳基卤代烃（如氯苯/溴苯）水解，非烷基卤代烃（烷基卤代烃水解得醇）
  { from: 'haloalkane', to: 'phenol', type: '取代反应（水解）·芳基卤代烃（如氯苯）', condition: 'NaOH 水溶液，高温高压', equation: 'C₆H₅Br + NaOH —高温高压→ C₆H₅OH + NaBr', label: '水解' },
  { from: 'haloalkane', to: 'alkene', type: '消去反应', condition: 'NaOH 醇溶液，加热', equation: 'CH₃CH₂Br + NaOH —醇△→ CH₂=CH₂ + NaBr + H₂O', label: '消去' },
  { from: 'alcohol', to: 'alkene', type: '消去反应', condition: '浓 H₂SO₄，170℃', equation: 'CH₃CH₂OH —浓H₂SO₄,170℃→ CH₂=CH₂ + H₂O', label: '消去' },
  { from: 'alcohol', to: 'haloalkane', type: '取代反应', condition: 'HX（浓）', equation: 'CH₃CH₂OH + HBr → CH₃CH₂Br + H₂O', label: '取代' },
  { from: 'alcohol', to: 'aldehyde', type: '氧化反应', condition: 'Cu/Ag 催化，O₂，加热', equation: '2CH₃CH₂OH + O₂ —Cu,△→ 2CH₃CHO + 2H₂O', label: '氧化' },
  { from: 'alcohol', to: 'ketone', type: '氧化反应', condition: 'Cu/Ag 催化，O₂，加热（仲醇）', equation: '2CH₃CH(OH)CH₃ + O₂ —Cu,△→ 2CH₃COCH₃ + 2H₂O', label: '氧化（仲醇）' },
  { from: 'aldehyde', to: 'alcohol', type: '还原反应', condition: '催化剂 + H₂', equation: 'CH₃CHO + H₂ —催化→ CH₃CH₂OH', label: '还原' },
  { from: 'aldehyde', to: 'acid', type: '氧化反应', condition: 'O₂/催化剂 或 银氨/新制Cu(OH)₂', equation: '2CH₃CHO + O₂ —催化→ 2CH₃COOH', label: '氧化' },
  { from: 'aldehyde', to: 'acid', type: '氧化反应', condition: '银氨溶液 或 新制 Cu(OH)₂，加热', equation: 'CH₃CHO + 2Cu(OH)₂ —△→ CH₃COOH + Cu₂O↓ + 2H₂O', label: '银镜氧化' },
  { from: 'alkyne', to: 'aldehyde', type: '加成反应（水化）', condition: 'HgSO₄ + H₂SO₄，加热', equation: 'CH≡CH + H₂O —HgSO₄,H₂SO₄△→ CH₃CHO', label: '水化' },
  { from: 'haloalkane', to: 'acid', type: '氧化反应（多步）', condition: '先 NaOH 水溶液水解，再催化氧化（经醇、醛）', equation: 'RCH₂X —水解→ RCH₂OH —O₂,Cu△→ RCHO —O₂→ RCOOH', label: '氧化（经醇醛）' },
  { from: 'acid', to: 'ester', type: '酯化反应（取代）', condition: '醇 + 浓 H₂SO₄，加热', equation: 'CH₃COOH + CH₃CH₂OH —浓H₂SO₄,△→ CH₃COOCH₂CH₃ + H₂O', label: '酯化' },
  { from: 'ester', to: 'acid', type: '水解反应', condition: '酸或碱催化，水', equation: 'CH₃COOCH₂CH₃ + H₂O —酸→ CH₃COOH + CH₃CH₂OH', label: '水解' },
  { from: 'ester', to: 'alcohol', type: '水解反应', condition: '酸或碱催化，水', equation: 'CH₃COOCH₂CH₃ + H₂O —酸或碱→ CH₃COOH + CH₃CH₂OH（产物含醇）', label: '水解' },
];

/** 在路线图中查找路径（DFS 栈 + 出栈标记：按 REACTION_EDGES 的边顺序优先探索）。
 * 用 DFS 而非 BFS：BFS 恒返回最短路径（如 烷烃→卤代烃→苯酚 2 步），
 * 边顺序无法影响结果；DFS 按边的先后优先深入，使"重整"边置于"卤代"边之前时
 * 优先命中 烷烃→芳香烃→卤代烃→苯酚 路径（含 aromatic）。 */
export function findPath(from: string, to: string): ReactionEdge[] | null {
  if (from === to) return [];
  const adj = new Map<string, ReactionEdge[]>();
  for (const e of REACTION_EDGES) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e);
  }
  const stack: Array<{ node: string; path: ReactionEdge[] }> = [{ node: from, path: [] }];
  const visited = new Set<string>();
  while (stack.length) {
    const { node, path } = stack.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    const edges = adj.get(node) ?? [];
    // 逆序入栈：adjacency 顺序靠前的边先弹出（先探索）
    for (let i = edges.length - 1; i >= 0; i--) {
      const e = edges[i];
      if (e.to === to) return [...path, e];
      if (!visited.has(e.to)) stack.push({ node: e.to, path: [...path, e] });
    }
  }
  return null;
}
