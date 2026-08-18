/**
 * 真实渲染预览：skia-canvas 提供真实 2D context，完整走应用渲染管线输出 PNG
 * 用途：1) 验证修复后的画面位置/尺寸正确；2) 生成对照预览图供用户比对
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as skia from 'skia-canvas';
import { initRDKit, molblockOf } from '../src/core/rdkit';
import { molFromMolblock, renderMolecule, atomCoords, transformCoordToContext, ensureCoords } from '../src/core/kekule';

const { Canvas, Image } = skia;

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../preview', import.meta.url));

function installDomShim() {
  const g = globalThis as Record<string, unknown>;
  if (g.document) return;
  const makeCanvas = () => {
    const cv = new Canvas(4, 4);
    // 增强原始 skia Canvas：补充 DOM 接口（Kekule 桥接器需要 style/setAttribute 等）
    const ext = cv as unknown as Record<string, unknown>;
    ext.style = {};
    ext.setAttribute = () => undefined;
    ext.appendChild = () => undefined;
    ext.removeChild = () => undefined;
    ext.querySelectorAll = () => [];
    ext.ownerDocument = g.document;
    // skia 的 TextMetrics 在 Kekule 富文本布局调用链中可能返回异常边界值
    // （导致字符间距 44px、标签越界）；包装为普通 {width} 对象，模拟浏览器行为，
    // 使 Kekule 回退到 width 布局（与 Chromium 效果一致）。
    const ctx = cv.getContext('2d') as unknown as { measureText: (t: string) => unknown };
    const origMeasure = ctx.measureText.bind(ctx);
    ctx.measureText = (t: string) => ({ width: (origMeasure(t) as { width: number }).width });
    return cv;
  };
  g.document = {
    createElement: (tag: string) => (tag === 'canvas' ? makeCanvas() : { style: {}, ownerDocument: g.document }),
  } as unknown as Document;
}

interface PreviewSpec {
  file: string;
  smiles: string;
  label: string;
  width: number;
  height: number;
  full?: boolean;
}

const PREVIEWS: PreviewSpec[] = [
  { file: '1-2-甲基丙烷-完整结构式.png', smiles: 'CC(C)C', label: '2-甲基丙烷（完整结构式+编号）', width: 560, height: 400, full: true },
  { file: '2-2-甲基丙烷-键线式.png', smiles: 'CC(C)C', label: '2-甲基丙烷（键线式）', width: 560, height: 400 },
  { file: '3-2,3-二甲基己烷.png', smiles: 'CC(C)C(C)CCC', label: '2,3-二甲基己烷', width: 560, height: 400, full: true },
  { file: '4-硝基苯.png', smiles: 'O=[N+]([O-])c1ccccc1', label: '硝基苯（带电）', width: 560, height: 400, full: true },
  { file: '5-乙酸乙酯.png', smiles: 'CC(=O)OCC', label: '乙酸乙酯', width: 560, height: 400, full: true },
  { file: '6-甲苯-键线式.png', smiles: 'Cc1ccccc1', label: '甲苯', width: 560, height: 400 },
];

describe('真实渲染预览（skia-canvas）', () => {
  beforeAll(async () => {
    installDomShim();
    await initRDKit(() => WASM_PATH);
    mkdirSync(OUT_DIR, { recursive: true });
  }, 60000);

  for (const spec of PREVIEWS) {
    it(`渲染 ${spec.label} 并输出 PNG`, async () => {
      const mb = await molblockOf(spec.smiles, { coords: true });
      expect(mb, spec.smiles).toBeTruthy();
      const mol = molFromMolblock(mb!);
      expect(ensureCoords(mol)).toBe(true);
      const holder = {
        ownerDocument: (globalThis as unknown as { document: Document }).document,
        querySelectorAll: () => [],
        appendChild: () => undefined,
        removeChild: () => undefined,
      } as unknown as HTMLElement;
      const result = renderMolecule(holder, mol, {
        width: spec.width,
        height: spec.height,
        displayType: 'skeletal',
        hydrogenLevel: spec.full ? 'all' : 'none',
        nodeLabelMode: spec.full ? 'shown' : 'smart',
        colors: { background: '#ffffff' },
        atomColors: [{ index: 0, color: '#1d4ed8' }],
        bondLineWidth: 1.6,
      });
      // 坐标映射：化学坐标 → 画布像素
      const coords = atomCoords(mol);
      const pts = coords.map((c) => (c ? transformCoordToContext(result, c) : null));
      // 越界检测：所有原子都应在画布内（这就是"位置不对"的判据）
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        expect(p, `原子 ${i} 无坐标`).not.toBeNull();
        if (p) {
          expect(p.x, `原子 ${i} x 越界`).toBeGreaterThanOrEqual(0);
          expect(p.x, `原子 ${i} x 越界`).toBeLessThanOrEqual(spec.width);
          expect(p.y, `原子 ${i} y 越界`).toBeGreaterThanOrEqual(0);
          expect(p.y, `原子 ${i} y 越界`).toBeLessThanOrEqual(spec.height);
        }
      }
      // 中心性检查：原子分布应覆盖画布中部（而非挤在角落）
      const valid = pts.filter((p): p is { x: number; y: number } => !!p);
      if (valid.length) {
        const cx = valid.reduce((s, p) => s + p.x, 0) / valid.length;
        const cy = valid.reduce((s, p) => s + p.y, 0) / valid.length;
        expect(cx, '原子中心 x 应接近画布中心').toBeGreaterThan(spec.width * 0.3);
        expect(cx, '原子中心 x 应接近画布中心').toBeLessThan(spec.width * 0.7);
        expect(cy, '原子中心 y 应接近画布中心').toBeGreaterThan(spec.height * 0.3);
        expect(cy, '原子中心 y 应接近画布中心').toBeLessThan(spec.height * 0.7);
      }
      // 截断检测：边缘 14px 内不应有深色墨迹（结构线条/标签被画布切掉的判据）
      const edgeProbe = new Canvas(spec.width, spec.height);
      edgeProbe.getContext('2d').drawImage(result.canvas as unknown as skia.Canvas, 0, 0);
      const eData = edgeProbe
        .getContext('2d')
        .getImageData(0, 0, spec.width, spec.height).data as unknown as Uint8ClampedArray;
      let edgeInk = 0;
      for (let y = 0; y < spec.height; y++) {
        for (let x = 0; x < spec.width; x++) {
          const nearEdge = x < 14 || x >= spec.width - 14 || y < 14 || y >= spec.height - 14;
          if (!nearEdge) continue;
          const i = (y * spec.width + x) * 4;
          if (eData[i + 3] > 0 && eData[i] < 150) edgeInk++;
        }
      }
      expect(edgeInk, `${spec.label} 边缘14px内深色墨迹=${edgeInk}（结构被截断）`).toBeLessThanOrEqual(60);
      const buf = (result.canvas as unknown as { toBufferSync(t?: string): Buffer }).toBufferSync('png');
      expect(buf.length).toBeGreaterThan(200);
      writeFileSync(`${OUT_DIR}/${spec.file}`, buf);
      result.destroy();
    }, 60000);
  }

  it('diagnostic: measureText wrap active in render pipeline', async () => {
    // 验证 Kekule 渲染时 measureText 走的是被包装的版本（返回普通对象）
    const mb = await molblockOf('CCO', { coords: true });
    const mol = molFromMolblock(mb!);
    const holder = {
      ownerDocument: (globalThis as unknown as { document: Document }).document,
      querySelectorAll: () => [],
      appendChild: () => undefined,
      removeChild: () => undefined,
    } as unknown as HTMLElement;
    const r = renderMolecule(holder, mol, { width: 100, height: 80, displayType: 'skeletal', hydrogenLevel: 'all', nodeLabelMode: 'shown', colors: { background: '#ffffff' } });
    const canvas = r.canvas as unknown as skia.Canvas;
    const m = canvas.getContext('2d').measureText('CH') as unknown as { width: number; actualBoundingBoxRight?: number };
    console.log('[diag] measureText("CH") → width=', m.width.toFixed(1), 'actualBoundingBoxRight=', m.actualBoundingBoxRight);
    expect(m.width).toBeGreaterThan(5);
    r.destroy();
  }, 60000);
});
