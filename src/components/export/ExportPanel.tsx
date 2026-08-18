/**
 * 模块 4：导出面板
 * 结构图 PNG/SVG、分步解析截图包（ZIP）、练习报告（CSV/TXT）
 */
import React, { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { exportPng, exportSvg, downloadBlob, downloadText } from '../../core/export/exporters';
import { exportStepZip } from '../../core/export/stepZip';
import { exportReportCsv, exportReportTxt } from '../../core/export/report';
import { loadRecords } from '../../core/storage';
import { StructureViewer } from '../structure/StructureViewer';
import { Button, Card, Hint } from '../common/ui';

export default function ExportPanel() {
  const { state } = useApp();
  const mol = state.molecule;
  const [smiles, setSmiles] = useState(mol?.smiles ?? '');
  const [bg, setBg] = useState<'white' | 'transparent'>('white');
  const [showH, setShowH] = useState(false);
  const [showNum, setShowNum] = useState(false);
  const [res, setRes] = useState<'1x' | '2x'>('2x');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const records = useMemo(() => loadRecords(), []);

  const currentSmiles = smiles || mol?.smiles || '';

  const numbering = useMemo(() => {
    if (!showNum || !mol?.built) return undefined;
    return mol.built.chainAtomIndices.map((atomIdx, i) => ({ position: i + 1, atomIndex: atomIdx }));
  }, [showNum, mol]);

  const doPng = async () => {
    if (!currentSmiles) return;
    setBusy('PNG');
    try {
      const blob = await exportPng(currentSmiles, {
        width: 720,
        height: 520,
        background: bg,
        showH,
        scale: res === '2x' ? 2 : 1,
        numbering,
      });
      if (blob) {
        downloadBlob(blob, `结构-${(mol?.name ?? 'structure').replace(/[\\/:*?"<>|]/g, '_')}.png`);
        setMsg('PNG 已导出');
      } else {
        setMsg('PNG 导出失败');
      }
    } finally {
      setBusy(null);
    }
  };

  const doSvg = async () => {
    if (!currentSmiles) return;
    setBusy('SVG');
    try {
      const svg = await exportSvg(currentSmiles, 720, 520, { numbering: showNum });
      if (svg) {
        downloadText(svg, `结构-${(mol?.name ?? 'structure').replace(/[\\/:*?"<>|]/g, '_')}.svg`, 'image/svg+xml;charset=utf-8');
        setMsg('SVG 已导出');
      } else {
        setMsg('SVG 导出失败');
      }
    } finally {
      setBusy(null);
    }
  };

  const doZip = async () => {
    if (!mol?.built || !mol.named) {
      setMsg('请先在「名称 → 结构」面板解析一个名称，再导出截图包');
      return;
    }
    setBusy('ZIP');
    try {
      await exportStepZip(mol.built, mol.named);
      setMsg('分步截图包已下载（ZIP）');
    } catch (e) {
      setMsg('ZIP 生成失败：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card title="结构图导出" subtitle="当前画布结构导出为 PNG / SVG（本地生成，无网络）">
        <div className="flex flex-col items-center">
          <div className="border border-gray-200 rounded-xl bg-white p-2 mb-3">
            <StructureViewer smiles={currentSmiles || 'CCO'} viewMode={showH ? 'full' : 'skeletal'} width={420} height={300} />
          </div>
          <div className="w-full max-w-md space-y-2.5">
            <div className="flex gap-2">
              <input
                value={smiles}
                onChange={(e) => setSmiles(e.target.value)}
                placeholder="SMILES（默认使用「名称 → 结构」中的分子）"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {mol && (
                <Button variant="ghost" size="sm" onClick={() => setSmiles(mol.smiles)}>
                  使用当前
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
                <input type="radio" checked={bg === 'white'} onChange={() => setBg('white')} className="accent-primary" /> 白色背景
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
                <input type="radio" checked={bg === 'transparent'} onChange={() => setBg('transparent')} className="accent-primary" /> 透明背景
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={showH} onChange={(e) => setShowH(e.target.checked)} className="accent-primary" /> 显示氢原子
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={showNum} onChange={(e) => setShowNum(e.target.checked)} className="accent-primary" /> 显示碳编号
              </label>
            </div>
            <div className="flex gap-2 text-[13px]">
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
                <input type="radio" checked={res === '1x'} onChange={() => setRes('1x')} className="accent-primary" /> 标准
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer">
                <input type="radio" checked={res === '2x'} onChange={() => setRes('2x')} className="accent-primary" /> 高清（2x）
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void doPng()} disabled={!!busy} className="flex-1">
                {busy === 'PNG' ? '导出中…' : '导出 PNG'}
              </Button>
              <Button variant="secondary" onClick={() => void doSvg()} disabled={!!busy} className="flex-1">
                {busy === 'SVG' ? '导出中…' : '导出 SVG'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="分步解析截图包" subtitle="一键导出四步教学图片序列（ZIP，可直接插入 PPT）">
          <p className="text-[13.5px] text-ink-soft mb-3">
            将「名称 → 结构」面板中的分子按四步（识别母体 / 编号定位 / 识别取代基 / 补氢检查）各导出一张高清 PNG，并附带步骤说明。
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={() => void doZip()} disabled={!!busy}>
              {busy === 'ZIP' ? '打包中…' : '导出分步截图包（ZIP）'}
            </Button>
            {!mol?.built && <span className="text-[12.5px] text-amber-600">提示：请先在「名称 → 结构」解析一个名称</span>}
          </div>
        </Card>

        <Card title="练习报告导出" subtitle={`当前共 ${records.length} 条练习记录`}>
          <p className="text-[13.5px] text-ink-soft mb-3">
            导出全部练习记录：时间、难度、题目结构、学生答案、是否正确、错误类型。CSV 带 UTF-8 BOM，可直接用 Excel 打开。
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => exportReportCsv(records)}>
              导出 CSV
            </Button>
            <Button variant="secondary" onClick={() => exportReportTxt(records)}>
              导出 TXT
            </Button>
          </div>
        </Card>

        {msg && (
          <Hint kind={msg.includes('失败') ? 'error' : 'success'} closable onClose={() => setMsg(null)}>
            {msg}
          </Hint>
        )}
      </div>
    </div>
  );
}
