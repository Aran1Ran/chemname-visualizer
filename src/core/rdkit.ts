/**
 * RDKit.js 服务层：负责 SMILES 解析/校验、规范化、2D 坐标、分子式、子结构匹配、SVG。
 * 全部在浏览器端本地计算，无任何网络请求。
 */
import initRDKitModuleLoader, { type RDKitModule, type JSMol } from '@rdkit/rdkit';

let modulePromise: Promise<RDKitModule> | null = null;
let moduleInstance: RDKitModule | null = null;

export function initRDKit(locateFile?: () => string): Promise<RDKitModule> {
  if (!modulePromise) {
    modulePromise = initRDKitModuleLoader({
      // 浏览器：WASM 已由 scripts/copy-assets.mjs 复制到 public/，随 base:'./' 相对加载
      // Node（测试）：可传入绝对路径
      locateFile: locateFile ?? (() => 'RDKit_minimal.wasm'),
    })
      .then((m) => {
        moduleInstance = m;
        try {
          m.prefer_coordgen(true);
        } catch {
          /* 旧版本无此方法则忽略 */
        }
        return m;
      })
      .catch((err) => {
        modulePromise = null;
        throw err;
      });
  }
  return modulePromise;
}

export function getRDKitSync(): RDKitModule | null {
  return moduleInstance;
}

export async function getRDKit(): Promise<RDKitModule> {
  return initRDKit();
}

/** 简单的 SMILES → JSMol LRU 缓存，避免重复解析 */
const MOL_CACHE = new Map<string, JSMol>();
const MOL_CACHE_MAX = 96;

function cacheMol(smiles: string, mol: JSMol): void {
  if (MOL_CACHE.has(smiles)) return;
  MOL_CACHE.set(smiles, mol);
  if (MOL_CACHE.size > MOL_CACHE_MAX) {
    const oldest = MOL_CACHE.keys().next().value;
    if (oldest !== undefined) {
      const evicted = MOL_CACHE.get(oldest);
      MOL_CACHE.delete(oldest);
      try {
        evicted?.delete();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function getMol(smiles: string): Promise<JSMol | null> {
  const cached = MOL_CACHE.get(smiles);
  if (cached) return cached;
  const rdkit = await getRDKit();
  const mol = rdkit.get_mol(smiles);
  if (!mol) return null;
  cacheMol(smiles, mol);
  return mol;
}

export async function parseSmiles(smiles: string): Promise<{ ok: true; mol: JSMol; canonical: string } | { ok: false; reason: string }> {
  const rdkit = await getRDKit();
  const mol = rdkit.get_mol(smiles);
  if (!mol) {
    return { ok: false, reason: 'RDKit 无法解析该 SMILES' };
  }
  const canonical = mol.get_smiles();
  if (!canonical) {
    mol.delete();
    return { ok: false, reason: '无法规范化该 SMILES' };
  }
  return { ok: true, mol, canonical };
}

/** 返回带 2D 坐标的 v2000 MolBlock */
export async function molblockOf(smiles: string, opts: { coords?: boolean; explicitH?: boolean } = {}): Promise<string | null> {
  const mol = await getMol(smiles);
  if (!mol) return null;
  if (opts.coords && !mol.has_coords()) {
    mol.set_new_coords(true);
  }
  if (opts.explicitH) {
    // 若需要显式氢，先确保坐标，再加氢生成 MolBlock
    return molblockOfExplicitH(mol);
  }
  return mol.get_molblock();
}

function molblockOfExplicitH(mol: JSMol): string {
  // RDKit 的 add_hs() 返回带显式氢的 v2000 MolBlock（含坐标）
  const withH = mol.add_hs();
  return withH;
}

export async function formulaOf(smiles: string): Promise<string> {
  // 注意：该版本 RDKit descriptors 不含 formula 字段；v2000 隐氢不在原子行中。
  // 这里通过 add_hs() 生成显式氢 MolBlock 再统计，得到含氢分子式。
  const mol = await getMol(smiles);
  if (!mol) return '';
  try {
    const withH = mol.add_hs();
    return formulaFromMolblock(withH);
  } catch {
    return '';
  }
}

/** 从 v2000/v3000 MolBlock 统计分子式（兜底用） */
export function formulaFromMolblock(molblock: string): string {
  const lines = molblock.split('\n');
  const counts = new Map<string, number>();
  for (const line of lines) {
    const m = line.match(/^\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([A-Za-z][a-z]?)/);
    if (m) {
      const el = m[1];
      if (/^[A-Z][a-z]?$/.test(el) && el !== 'R' && el !== '*') {
        counts.set(el, (counts.get(el) ?? 0) + 1);
      }
    }
  }
  return serializeFormula(counts);
}

export function serializeFormula(counts: Map<string, number>): string {
  const order = ['C', 'H', 'O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'B', 'Si'];
  const keys = Array.from(counts.keys()).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  return keys
    .map((k) => (counts.get(k)! > 1 ? k + counts.get(k) : k))
    .join('');
}

export interface SubstructureMatch {
  atoms: number[];
  bonds: number[];
}

export async function substructMatches(smiles: string, smarts: string): Promise<SubstructureMatch[]> {
  const rdkit = await getRDKit();
  const mol = await getMol(smiles);
  if (!mol) return [];
  const qmol = rdkit.get_qmol(smarts);
  if (!qmol) return [];
  try {
    const raw = mol.get_substruct_matches(qmol);
    const parsed = JSON.parse(raw) as Array<{ atoms: number[]; bonds: number[] }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  } finally {
    qmol.delete();
  }
}

export async function inchiOf(smiles: string): Promise<string> {
  const mol = await getMol(smiles);
  if (!mol) return '';
  try {
    return mol.get_inchi();
  } catch {
    return '';
  }
}

/** 生成分子 SVG（宽度/高度 px） */
export async function svgOf(smiles: string, width: number, height: number, details?: string): Promise<string> {
  const mol = await getMol(smiles);
  if (!mol) return '';
  try {
    if (details) {
      return mol.get_svg_with_highlights(details);
    }
    return mol.get_svg(width, height);
  } catch {
    return '';
  }
}

/** 获取重原子数量 */
export async function heavyAtomCount(smiles: string): Promise<number> {
  const mol = await getMol(smiles);
  if (!mol) return 0;
  try {
    const desc = JSON.parse(mol.get_descriptors()) as Record<string, unknown>;
    return typeof desc.numHeavyAtoms === 'number' ? desc.numHeavyAtoms : 0;
  } catch {
    return 0;
  }
}
