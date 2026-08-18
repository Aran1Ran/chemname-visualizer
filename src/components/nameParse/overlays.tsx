/**
 * 结构覆盖层绘制助手：球（碳骨架动画）、位次编号、高亮圈、方向箭头
 */
import type { OverlayContext } from '../structure/StructureViewer';

/** 在指定原子处画圆球（动画逐个出现）；hollow 时为空心圆环（描边 + 无填充） */
export function BallsOverlay({
  ctx,
  atoms,
  color,
  radius = 10,
  delayBase = 0,
  interval = 220,
  withLabel,
  hollow,
  strokeWidth = 3,
  offsetX = 0,
  offsetY = 0,
  strokeOpacity,
}: {
  ctx: OverlayContext;
  atoms: number[];
  color: string;
  radius?: number;
  delayBase?: number;
  interval?: number;
  withLabel?: (idx: number) => string;
  /** 空心圆环（无填充 + 描边），默认实心 */
  hollow?: boolean;
  strokeWidth?: number;
  /** 圆心X/Y微调偏移（像素），用于修正完整结构式中文字标签与原子坐标的视觉偏差 */
  offsetX?: number;
  offsetY?: number;
  /** 描边不透明度（0~1），仅 hollow 模式生效；未设置时保持完全不透明 */
  strokeOpacity?: number;
}) {
  return (
    <g>
      {atoms.map((ai, i) => {
        const p = ctx.pixels[ai];
        if (!p) return null;
        const cx = p.x + offsetX;
        const cy = p.y + offsetY;
        const delay = delayBase + i * interval;
        return (
          <g key={ai} style={{ animation: `cv-pop 0.35s ease ${delay}ms both` }}>
            {hollow ? (
              // 纯空心圆：fill="none" + 描边，键线清晰可见
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity ?? 1} />
            ) : (
              <circle cx={cx} cy={cy} r={radius} fill={color} stroke="#fff" strokeWidth={2} />
            )}
            {withLabel && (
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={hollow ? color : '#fff'}>
                {withLabel(ai)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** 位次编号（1,2,3...） */
export function NumbersOverlay({
  ctx,
  numbering,
  color = '#1d4ed8',
  fontSize = 15,
  offset = 16,
  delay = 0,
  interval = 150,
}: {
  ctx: OverlayContext;
  numbering: Array<{ position: number; atomIndex: number }>;
  color?: string;
  fontSize?: number;
  offset?: number;
  delay?: number;
  interval?: number;
}) {
  return (
    <g>
      {numbering.map(({ position, atomIndex }, k) => {
        const p = ctx.pixels[atomIndex];
        if (!p) return null;
        return (
          <g key={position} style={{ animation: `cv-pop 0.3s ease ${delay + k * interval}ms both` }}>
            <circle cx={p.x - offset} cy={p.y - offset} r={10.5} fill={color} opacity={0.12} />
            <text
              x={p.x - offset}
              y={p.y - offset + 4.5}
              textAnchor="middle"
              fontSize={fontSize}
              fontWeight={700}
              fill={color}
              stroke="#ffffff"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {position}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** 高亮圈（圈出官能团/等效氢等） */
export function HighlightCirclesOverlay({
  ctx,
  atoms,
  color,
  radius = 15,
  dashed,
  pulse,
}: {
  ctx: OverlayContext;
  atoms: number[];
  color: string;
  radius?: number;
  dashed?: boolean;
  pulse?: boolean;
}) {
  return (
    <g>
      {atoms.map((ai) => {
        const p = ctx.pixels[ai];
        if (!p) return null;
        return (
          <g key={ai}>
            <circle
              cx={p.x}
              cy={p.y}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={2.2}
              strokeDasharray={dashed ? '5 3' : undefined}
            />
            {pulse && <circle cx={p.x} cy={p.y} r={radius} fill="none" stroke={color} strokeWidth={1.5} className="cv-pulse-ring" />}
          </g>
        );
      })}
    </g>
  );
}

/** 方向箭头（编号演示）；label 带白色描边（halo）避免与结构/其他标签重叠。
 * 自绘箭头三角（不依赖外部 marker defs，StructureViewer 未定义 cv-arrow）；
 * offset 为垂直于连线方向的偏移像素，用于同一条线的"方案A/B"错开显示。 */
export function ArrowOverlay({
  from,
  to,
  color = '#f59e0b',
  label,
  delay = 0,
  labelDy = 0,
  offset = 0,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
  label?: string;
  delay?: number;
  /** 标签垂直偏移（两条方向标签上下分开，避免重叠） */
  labelDy?: number;
  /** 垂直偏移（px）：方案A/B 两条线错开 6~10px，同屏可辨 */
  offset?: number;
}) {
  // 计算垂直单位向量，将整条线平移 offset
  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const len = Math.hypot(vx, vy) || 1;
  const nx = (-vy / len) * offset;
  const ny = (vx / len) * offset;
  const f = { x: from.x + nx, y: from.y + ny };
  const t = { x: to.x + nx, y: to.y + ny };

  const mx = (f.x + t.x) / 2;
  const my = (f.y + t.y) / 2 + labelDy;
  const angle = Math.atan2(t.y - f.y, t.x - f.x);
  const arrowLen = Math.min(13, len / 5);
  const wing = Math.min(6.5, arrowLen * 0.5);
  // 箭头三角：尖端在终点，两翼在终点回退 arrowLen 处
  const baseX = t.x - arrowLen * Math.cos(angle);
  const baseY = t.y - arrowLen * Math.sin(angle);
  const p1 = { x: baseX + wing * Math.cos(angle + Math.PI / 2), y: baseY + wing * Math.sin(angle + Math.PI / 2) };
  const p2 = { x: baseX + wing * Math.cos(angle - Math.PI / 2), y: baseY + wing * Math.sin(angle - Math.PI / 2) };
  return (
    <g style={{ animation: `cv-fade-in 0.3s ease ${delay}ms both` }}>
      <line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke={color} strokeWidth={2.5} />
      <polygon points={`${t.x},${t.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={color} />
      {label && (
        <text
          x={mx}
          y={my - 6}
          textAnchor="middle"
          fontSize={12.5}
          fontWeight={600}
          fill={color}
          stroke="#ffffff"
          strokeWidth={4}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** 全原子描边高亮（用于"其他部分变灰"的替代层） */
export function DimOverlay({ ctx }: { ctx: OverlayContext }) {
  return (
    <g>
      {ctx.pixels.map((p, i) =>
        p ? (
          <circle key={i} cx={p.x} cy={p.y} r={11} fill="rgba(255,255,255,0.45)" />
        ) : null
      )}
    </g>
  );
}
