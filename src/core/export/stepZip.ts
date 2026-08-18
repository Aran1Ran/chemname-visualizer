/**
 * 分步解析截图包（ZIP，本地 JSZip 生成）
 */
import JSZip from 'jszip';
import { exportPng, downloadBlob } from './exporters';
import { chainOnlySmiles } from '../naming/chainOnly';
import { colorizeBuilt } from '../../components/structure/StructureViewer';
import type { BuiltMolecule } from '../../core/naming/builder';
import type { NamedResult } from '../../core/reverse/namer';
import { tutorialTexts } from '../../core/naming/tutorial';
import { formulaOfGraph } from '../../core/chem/graph';

/** 生成四步截图 ZIP */
export async function exportStepZip(built: BuiltMolecule, named: NamedResult): Promise<void> {
  const zip = new JSZip();
  const texts = tutorialTexts(built, named);
  const colors = { skeleton: '#1d4ed8', substituent: '#dc2626', hetero: '#059669' };
  const W = 640;
  const H = 440;
  const chainSmiles = chainOnlySmiles(built);
  const chainN = named.chainAtomIndices.length;
  const chainIsFull = chainSmiles === built.smiles;

  // 步骤 1：母体骨架
  const p1 = await exportPng(chainSmiles, {
    width: W,
    height: H,
    background: 'white',
    showH: false,
    scale: 2,
    atomColors: chainIsFull ? colorizeBuilt(built, colors) : undefined,
  });
  if (p1) zip.file('步骤1-识别母体.png', p1);

  // 步骤 2：编号
  const numbering = Array.from({ length: chainN }, (_, i) => ({ position: i + 1, atomIndex: i }));
  const p2 = await exportPng(chainSmiles, {
    width: W,
    height: H,
    background: 'white',
    showH: false,
    scale: 2,
    numbering,
  });
  if (p2) zip.file('步骤2-编号定位.png', p2);

  // 步骤 3：取代基（完整结构 + 取代基红）
  const p3 = await exportPng(built.smiles, {
    width: W,
    height: H,
    background: 'white',
    showH: false,
    scale: 2,
    atomColors: colorizeBuilt(built, colors),
  });
  if (p3) zip.file('步骤3-识别取代基.png', p3);

  // 步骤 4：补氢 + 分子式
  const p4 = await exportPng(built.smiles, {
    width: W,
    height: H,
    background: 'white',
    showH: true,
    scale: 2,
    atomColors: colorizeBuilt(built, colors),
  });
  if (p4) zip.file('步骤4-补氢检查.png', p4);

  // 说明
  const readme =
    `ChemName Visualizer · 分步解析截图包\n` +
    `名称：${named.name}\n` +
    `分子式：${formulaOfGraph(built.graph)}\n` +
    `SMILES：${built.smiles}\n\n` +
    texts.map((t, i) => `【步骤${i + 1}】${t.title}\n${t.text}\n规则：${t.why}\n`).join('\n');
  zip.file('步骤说明.txt', '\uFEFF' + readme);

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `分步解析-${named.name}.zip`);
}
