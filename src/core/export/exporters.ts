/**
 * PNG/SVG 导出
 * - PNG：离屏 Kekule 渲染 + 可选编号覆盖层（SVG 合成）
 * - SVG：RDKit get_svg（本地生成、自包含）
 */
import { molblockOf, svgOf } from '../rdkit';
import { molFromMolblock, renderMoleculeOffscreen, atomCoords, transformCoordToContext } from '../kekule';

export interface ExportOptions {
  width: number;
  height: number;
  background: 'white' | 'transparent';
  showH: boolean;
  scale: 1 | 2;
  atomColors?: Array<{ index: number; color: string }>;
  /** 编号覆盖层（position → 原子索引，基于隐式分子图） */
  numbering?: Array<{ position: number; atomIndex: number }>;
  numberingColor?: string;
}

/** 生成 PNG Blob */
export async function exportPng(smiles: string, opts: ExportOptions): Promise<Blob | null> {
  const mb = await molblockOf(smiles, { coords: true });
  if (!mb) return null;
  const mol = molFromMolblock(mb);
  const scale = opts.scale === 2 ? 2 : 1;
  const w = opts.width * scale;
  const h = opts.height * scale;
  const result = renderMoleculeOffscreen(mol, {
    width: w,
    height: h,
    displayType: 'skeletal',
    hydrogenLevel: opts.showH ? 'all' : 'none',
    nodeLabelMode: opts.showH ? 'shown' : 'smart',
    colors: { background: opts.background === 'white' ? '#ffffff' : null, atom: '#111827', bond: '#374151', hetero: '#047857' },
    atomColors: opts.atomColors,
  });
  const canvas = result.canvas;

  // 编号覆盖层：绘制到同一 canvas
  if (opts.numbering && opts.numbering.length > 0) {
    const coords = atomCoords(mol);
    const nodes = mol.getNodes?.() ?? mol.getAtoms?.() ?? [];
    const points: Array<{ x: number; y: number } | null> = coords.map((c) => (c ? transformCoordToContext(result, c) : null));
    const texts = opts.numbering
      .map(({ position, atomIndex }) => {
        const p = points[atomIndex];
        if (!p) return '';
        return `<circle cx="${p.x - 16 * scale}" cy="${p.y - 16 * scale}" r="${10 * scale}" fill="${opts.numberingColor ?? '#1d4ed8'}" opacity="0.15"/>
          <text x="${p.x - 16 * scale}" y="${p.y - 16 * scale + 4 * scale}" font-size="${13 * scale}" font-weight="700" text-anchor="middle" fill="${opts.numberingColor ?? '#1d4ed8'}" font-family="Microsoft YaHei, sans-serif">${position}</text>`;
      })
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${texts}</svg>`;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('覆盖层合成失败'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  result.destroy();
  return blob;
}

/** 生成 SVG 字符串 */
export async function exportSvg(smiles: string, width: number, height: number, opts: { numbering?: boolean } = {}): Promise<string | null> {
  const details = opts.numbering ? JSON.stringify({ addAtomIndices: true, legend: '' }) : undefined;
  return svgOf(smiles, width, height, details);
}

/** 下载 Blob 为文件 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob(['\uFEFF' + text], { type: mime });
  downloadBlob(blob, filename);
}
