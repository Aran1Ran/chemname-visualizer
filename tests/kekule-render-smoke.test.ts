/**
 * Kekule 渲染管线冒烟测试（Node + 模拟 2D context）
 * 验证：MolBlock 解析 → renderMolecule 全部配置调用 → renderer.draw 完整执行 → 坐标映射
 * （无法画真实像素，但能捕获命名空间/API 误用导致的崩溃——即线上 'CoordGenerator' 类问题）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { initRDKit, molblockOf } from '../src/core/rdkit';
import { molFromMolblock, renderMolecule, atomCoords, transformCoordToContext } from '../src/core/kekule';

const WASM_PATH = fileURLToPath(new URL('../public/RDKit_minimal.wasm', import.meta.url));

/** 模拟 2D context：预置完整 Canvas 2D API（方法 no-op，属性给默认值），未知属性返回 undefined */
function makeFakeCtx(canvasRef: unknown) {
  const METHODS = [
    'arc', 'arcTo', 'beginPath', 'bezierCurveTo', 'clearRect', 'clip', 'closePath', 'createImageData',
    'createLinearGradient', 'createPattern', 'createRadialGradient', 'drawFocusIfNeeded', 'drawImage',
    'ellipse', 'fill', 'fillRect', 'fillText', 'getImageData', 'getLineDash', 'getTransform',
    'isPointInPath', 'isPointInStroke', 'lineTo', 'measureText', 'moveTo', 'putImageData',
    'quadraticCurveTo', 'rect', 'reset', 'resetTransform', 'restore', 'rotate',
    'roundRect', 'save', 'scale', 'setLineDash', 'setTransform', 'stroke', 'strokeRect', 'strokeText',
    'transform', 'translate',
  ];
  const target: Record<string, unknown> = {
    canvas: canvasRef,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
    font: '', textAlign: 'start', textBaseline: 'alphabetic', globalAlpha: 1,
    globalCompositeOperation: 'source-over', shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)',
    shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none', imageSmoothingEnabled: true,
    lineDashOffset: 0, direction: 'inherit',
  };
  for (const m of METHODS) {
    target[m] = () => undefined;
  }
  (target.measureText as () => unknown) = () => ({ width: 10 });
  (target.createLinearGradient as () => unknown) = () => ({ addColorStop: () => undefined });
  (target.createRadialGradient as () => unknown) = () => ({ addColorStop: () => undefined });
  (target.getImageData as () => unknown) = () => ({ data: [] });
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === 'string' && prop in t) return t[prop];
      return undefined;
    },
    set(t, prop, v) {
      (t as Record<string, unknown>)[prop as string] = v;
      return true;
    },
  });
}

/** 最小 DOM 垫片 */
function installDomShim() {
  const g = globalThis as Record<string, unknown>;
  if (g.document) return;
  class FakeCanvas {
    style: Record<string, string> = {};
    children: unknown[] = [];
    ownerDocument: unknown;
    _ctx: unknown;
    _w = 4;
    _h = 4;
    constructor() {
      this._ctx = makeFakeCtx(this);
      this.ownerDocument = g.document;
    }
    getContext() {
      return this._ctx;
    }
    get width() {
      return this._w;
    }
    set width(v: number) {
      this._w = v;
    }
    get height() {
      return this._h;
    }
    set height(v: number) {
      this._h = v;
    }
    appendChild(c: unknown) {
      this.children.push(c);
      return c;
    }
    removeChild(c: unknown) {
      this.children = this.children.filter((x) => x !== c);
      return c;
    }
    querySelectorAll() {
      return [];
    }
    setAttribute() {
      return undefined;
    }
  }
  g.document = {
    createElement: (tag: string) => (tag === 'canvas' ? new FakeCanvas() : { style: {}, ownerDocument: g.document }),
  } as unknown as Document;
}

describe('Kekule 渲染管线（Node 冒烟）', () => {
  beforeAll(async () => {
    installDomShim();
    await initRDKit(() => WASM_PATH);
  }, 60000);

  it('renderMolecule 完整执行（2-甲基丙烷）', async () => {
    const mb = await molblockOf('CC(C)C', { coords: true });
    expect(mb).toBeTruthy();
    const mol = molFromMolblock(mb!);
    const holder = { ownerDocument: (globalThis as unknown as { document: Document }).document, querySelectorAll: () => [], appendChild: () => undefined, removeChild: () => undefined } as unknown as HTMLElement;
    const result = renderMolecule(holder, mol, {
      width: 200,
      height: 150,
      
      displayType: 'skeletal',
      hydrogenLevel: 'all',
      nodeLabelMode: 'shown',
      colors: { background: '#ffffff' },
      atomColors: [{ index: 0, color: '#1d4ed8' }],
    });
    expect(result.canvas).toBeTruthy();
    const coords = atomCoords(mol);
    expect(coords).toHaveLength(4);
    const p = transformCoordToContext(result, coords[0]!);
    expect(Number.isFinite(p.x)).toBe(true);
    result.destroy();
  }, 60000);

  it('renderMolecule 完整执行（乙醇、硝基苯、乙酸乙酯、丁二烯）', async () => {
    const holder = { ownerDocument: (globalThis as unknown as { document: Document }).document, querySelectorAll: () => [], appendChild: () => undefined, removeChild: () => undefined } as unknown as HTMLElement;
    for (const smi of ['CCO', 'O=[N+]([O-])c1ccccc1', 'CC(=O)OCC', 'C=CC=C']) {
      const mb = await molblockOf(smi, { coords: true });
      expect(mb, smi).toBeTruthy();
      const mol = molFromMolblock(mb!);
      const result = renderMolecule(holder, mol, {
        width: 200,
        height: 150,
        
        displayType: 'skeletal',
        hydrogenLevel: 'all',
        nodeLabelMode: 'shown',
        colors: { background: '#ffffff' },
      });
      expect(result.canvas, smi).toBeTruthy();
      result.destroy();
    }
  }, 60000);

  it('renderMolecule 完整执行（键线式无 H，对二甲苯）', async () => {
    const mb = await molblockOf('Cc1ccc(C)cc1', { coords: true });
    const mol = molFromMolblock(mb!);
    const holder = { ownerDocument: (globalThis as unknown as { document: Document }).document, querySelectorAll: () => [], appendChild: () => undefined, removeChild: () => undefined } as unknown as HTMLElement;
    const result = renderMolecule(holder, mol, {
      width: 200,
      height: 150,
      displayType: 'skeletal',
      hydrogenLevel: 'none',
      nodeLabelMode: 'smart',
      colors: { background: '#ffffff' },
    });
    expect(result.canvas).toBeTruthy();
    result.destroy();
  }, 60000);
});
