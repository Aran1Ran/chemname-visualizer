/**
 * Kekule.js 服务层：封装低层 2D 渲染管线（CanvasRendererBridge + CompositeMolecule2DRenderer）。
 * - 氢显示、分子显示类型（键线式/结构简式）、原子着色、背景
 * - 坐标映射（供覆盖层 SVG 精确定位）
 * - 离屏渲染（导出 PNG 用）
 */
import { Kekule, type KekuleMolecule, type KekuleRenderer, type KekuleRenderContext, type Render2DConfigsInstance } from 'kekule';

export type DisplayType = 'skeletal' | 'condensed';
export type HydrogenLevel = 'none' | 'all' | 'labeled' | 'explicit';

export interface RenderOptions {
  width: number;
  height: number;
  displayType?: DisplayType;
  hydrogenLevel?: HydrogenLevel;
  /** 原子标签显示模式；'smart' = 按显示类型自动（键线式隐藏碳符号） */
  nodeLabelMode?: 'smart' | 'shown' | 'hidden';
  /** 全局颜色 */
  colors?: {
    atom?: string;
    bond?: string;
    hetero?: string;
    background?: string | null; // null = 透明背景
  };
  /** 按原子索引指定颜色（如母体蓝/取代基红） */
  atomColors?: ReadonlyArray<{ index: number; color: string }>;
  bondLineWidth?: number;
  unitLength?: number;
  /** 默认 false：自动生成 2D 坐标（若分子无坐标） */
  allowAutoCoords?: boolean;
}

export interface KekuleRenderResult {
  canvas: HTMLCanvasElement;
  renderer: KekuleRenderer;
  context: KekuleRenderContext;
  mol: KekuleMolecule;
  destroy: () => void;
}

function hydrogenLevelValue(level: HydrogenLevel | undefined): number {
  switch (level) {
    case 'none':
      return Kekule.Render.HydrogenDisplayLevel.NONE;
    case 'all':
      return Kekule.Render.HydrogenDisplayLevel.ALL;
    case 'explicit':
      return Kekule.Render.HydrogenDisplayLevel.EXPLICIT;
    case 'labeled':
    default:
      return Kekule.Render.HydrogenDisplayLevel.LABELED;
  }
}

function nodeLabelModeValue(mode: 'smart' | 'shown' | 'hidden' | undefined): number {
  switch (mode) {
    case 'shown':
      return Kekule.Render.NodeLabelDisplayMode.SHOWN;
    case 'hidden':
      return Kekule.Render.NodeLabelDisplayMode.HIDDEN;
    case 'smart':
    default:
      return Kekule.Render.NodeLabelDisplayMode.SMART;
  }
}

/** 从 MolBlock 或 SMILES 构造 Kekule 分子对象 */
export function molFromMolblock(molblock: string): KekuleMolecule {
  return Kekule.IO.loadFormatData(molblock, 'mol');
}

export function molFromSmiles(smiles: string): KekuleMolecule {
  return Kekule.IO.loadFormatData(smiles, 'smi');
}

export function ensureCoords(mol: KekuleMolecule): boolean {
  // 注意：Kekule 1.x 已将化学类扁平化到顶层（Kekule.Molecule 等），
  // 且构建中不再包含 Kekule.Chem.CoordGenerator（勿再引用 Kekule.Chem.*）。
  // 本项目始终使用 RDKit 生成的带 2D 坐标的 MolBlock，此处仅做存在性检查。
  try {
    const atoms = mol.getNodes?.() ?? mol.getAtoms?.() ?? [];
    const first = atoms[0];
    if (first && typeof first.getCoord2D === 'function') {
      const c = first.getCoord2D();
      return !!(c && (c.x !== 0 || c.y !== 0));
    }
  } catch {
    /* 忽略 */
  }
  return false;
}

/** 将分子渲染到容器（容器内已有的 Kekule canvas 会被替换） */
export function renderMolecule(container: HTMLElement, mol: KekuleMolecule, opts: RenderOptions): KekuleRenderResult {
  // 清理旧 canvas
  container.querySelectorAll('canvas').forEach((c) => c.remove());

  const transparent = opts.colors?.background === null || opts.colors?.background === undefined ? false : false;
  const alpha = transparent;

  const bridge = new Kekule.Render.CanvasRendererBridge();
  // 注意：不要传 overSamplingRatio —— Kekule 1.x 会同时把 canvas 像素尺寸与 CSS 尺寸
  // 都乘以该比例（画布溢出容器），且 transformCoordToContext 返回的是物理像素坐标，
  // 与覆盖层 SVG 的逻辑尺寸不匹配，导致"图画位置不对"。
  // 需要高清输出时请直接放大 width/height（如导出 2x）。
  const ctx = bridge.createContext(container, opts.width, opts.height, {
    alpha,
  });

  // 背景填充（透明则跳过）
  const bg = opts.colors?.background;
  if (bg && bg !== 'transparent') {
    const c = ctx.canvas.getContext('2d');
    if (c) {
      c.fillStyle = bg;
      c.fillRect(0, 0, opts.width, opts.height);
    }
  }

  // 重要：Kekule 1.0.4 的低层渲染器忽略构造时的 renderConfigs（构造参数被注释），
  // 绘制选项必须通过 draw(ctx, null, options) 传入，且需用 convert2DConfigsToPlainHash 生成
  // （其中包含 displayLabelConfigs 等，缺失会在绘制带电原子时崩溃）。
  const configs = Kekule.Render.getRender2DConfigs();
  try {
    const mdc = configs.getMoleculeDisplayConfigs();
    mdc.setDefMoleculeDisplayType(
      opts.displayType === 'condensed' ? Kekule.Render.MoleculeDisplayType.CONDENSED : Kekule.Render.MoleculeDisplayType.SKELETAL
    );
    mdc.setDefHydrogenDisplayLevel(hydrogenLevelValue(opts.hydrogenLevel));
    mdc.setDefNodeDisplayMode(nodeLabelModeValue(opts.nodeLabelMode));
  } catch {
    /* 使用默认配置 */
  }

  try {
    const cc = configs.getColorConfigs();
    if (opts.colors?.atom) cc.setAtomColor(opts.colors.atom);
    if (opts.colors?.bond) cc.setBondColor(opts.colors.bond);
    if (opts.colors?.hetero) cc.setHeteroAtomColor(opts.colors.hetero);
    if (bg) cc.setBackgroundColor(bg);
  } catch {
    /* 忽略 */
  }

  try {
    const lc = configs.getLengthConfigs();
    if (opts.bondLineWidth !== undefined) lc.setBondLineWidth(opts.bondLineWidth);
    if (opts.unitLength !== undefined) lc.setUnitLength(opts.unitLength);
  } catch {
    /* 忽略 */
  }

  // 生成绘制选项（含 displayLabelConfigs 等全部默认值）
  let drawOptions: Record<string, unknown> = {};
  try {
    const conv = (Kekule.Render as { RenderOptionUtils?: { convert2DConfigsToPlainHash?: (c: unknown) => Record<string, unknown> } }).RenderOptionUtils;
    if (conv && typeof conv.convert2DConfigsToPlainHash === 'function') {
      drawOptions = conv.convert2DConfigsToPlainHash(configs);
    }
  } catch {
    /* 使用空选项 */
  }
  // 关键：autofit 负责"缩放适配 + 居中"。但注意 Kekule 1.x 的富文本标签字号会
  // 乘以 autofit 的 zoom（baseTextRender.js ~L602），小分子被 autofit 放大数倍时
  // 标签随之放大（如 14px→61px），导致"字号过大"且标签超出画布被截断。
  // 因此：不用 autofit，改用 autoShrink（仅当分子过大时缩小，标签与分子同比例），
  // 并用 unitLength 提供适度的基础放大（键长 25→35px、标签 14→19.6px，比例协调）。
  drawOptions.autofit = false;
  drawOptions.autoShrink = true;
  drawOptions.unitLength = 1.4;

  // 逐原子着色（母体蓝 / 取代基红 / 氢灰 / 杂原子绿 等）
  if (opts.atomColors && opts.atomColors.length) {
    const atoms = mol.getNodes() ?? mol.getAtoms() ?? [];
    for (const ac of opts.atomColors) {
      const atom = atoms[ac.index];
      if (atom) {
        try {
          atom.setRenderOption('color', ac.color);
        } catch {
          /* 忽略无法设置的原子 */
        }
      }
    }
  }

  if (opts.allowAutoCoords !== false) {
    ensureCoords(mol);
  }

  // 通过工厂按对象类型选择渲染器（普通 Molecule 无 getSubMolecules，
  // 直接使用 CompositeMolecule2DRenderer 会崩溃——1.x 须用 get2DRendererClass 选择）
  let RendererClass: unknown = (Kekule.Render as { get2DRendererClass?: (obj: unknown) => unknown }).get2DRendererClass?.(mol);
  if (typeof RendererClass !== 'function') {
    RendererClass = Kekule.Render.CompositeMolecule2DRenderer;
  }
  const renderer = new (RendererClass as new (o: KekuleMolecule, b: unknown, c: unknown, p: unknown) => KekuleRenderer)(mol, bridge, undefined, null);
  // baseCoord = 分子绘制中心（context 坐标）。Kekule 1.x 中不传 baseCoord 时
  // 分子会画在画布原点（左上角）并溢出——表现为"图画位置不对"。
  renderer.draw(ctx, { x: opts.width / 2, y: opts.height / 2 }, drawOptions);

  const result: KekuleRenderResult = {
    canvas: ctx.canvas,
    renderer,
    context: ctx,
    mol,
    destroy: () => {
      try {
        bridge.releaseContext(ctx);
      } catch {
        /* ignore */
      }
    },
  };
  return result;
}

export interface RenderBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 估算分子渲染后的边界框（**像素**坐标；Kekule 原生返回化学坐标 box，此处做角点变换） */
export function estimateRenderBox(result: KekuleRenderResult): RenderBox | null {
  try {
    const box = result.renderer.estimateRenderBox(result.context, null, {}, false);
    if (!box) return null;
    const corners = [
      { x: box.x1, y: box.y1 },
      { x: box.x2, y: box.y1 },
      { x: box.x1, y: box.y2 },
      { x: box.x2, y: box.y2 },
    ].map((c) => transformCoordToContext(result, c));
    return {
      x1: Math.min(...corners.map((c) => c.x)),
      y1: Math.min(...corners.map((c) => c.y)),
      x2: Math.max(...corners.map((c) => c.x)),
      y2: Math.max(...corners.map((c) => c.y)),
    };
  } catch {
    return null;
  }
}

/** 化学坐标 → context 像素坐标（覆盖层定位用） */
export function transformCoordToContext(result: KekuleRenderResult, coord: { x: number; y: number }): { x: number; y: number } {
  const p = result.renderer.transformCoordToContext(result.context, result.mol, coord);
  return { x: p.x, y: p.y };
}

/** 获取分子各原子 2D 坐标（chem 坐标，未变换） */
export function atomCoords(mol: KekuleMolecule): Array<{ x: number; y: number } | null> {
  const nodes = mol.getNodes?.() ?? mol.getAtoms?.() ?? [];
  return nodes.map((n) => {
    try {
      const c = n.getCoord2D?.();
      return c ? { x: c.x, y: c.y } : null;
    } catch {
      return null;
    }
  });
}

/** 离屏渲染（导出用）：返回独立 canvas，不进 DOM */
export function renderMoleculeOffscreen(mol: KekuleMolecule, opts: RenderOptions): KekuleRenderResult {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;';
  document.body.appendChild(holder);
  const result = renderMolecule(holder, mol, opts);
  const originalDestroy = result.destroy.bind(result);
  result.destroy = () => {
    originalDestroy();
    holder.remove();
  };
  return result;
}
