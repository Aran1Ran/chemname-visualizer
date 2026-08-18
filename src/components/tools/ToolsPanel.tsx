/**
 * 教学工具面板：同分异构体 / 官能团高亮 / 等效氢+氢谱 / 编号动画 / 顺反异构判定 / 转化路线图
 */
import React, { useState } from 'react';
import { IsomerBrowser } from './IsomerBrowser';
import { FgHighlight } from './FgHighlight';
import { EquivalentHPanel } from './EquivalentH';
import { NumberingDemo } from './NumberingDemo';
import { CisTransPanel } from './CisTransPanel';
import { ReactionRoadmap } from './ReactionRoadmap';

const TOOLS = [
  { id: 'isomer', label: '同分异构体' },
  { id: 'fg', label: '官能团高亮' },
  { id: 'h', label: '等效氢与氢谱' },
  { id: 'num', label: '碳链编号动画' },
  { id: 'cis', label: '顺反异构判定' },
  { id: 'roadmap', label: '转化路线图' },
] as const;

export default function ToolsPanel() {
  const [tool, setTool] = useState<(typeof TOOLS)[number]['id']>('isomer');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-[13.5px] font-medium border transition-colors ${
              tool === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-ink-soft border-gray-300 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tool === 'isomer' && <IsomerBrowser />}
      {tool === 'fg' && <FgHighlight />}
      {tool === 'h' && <EquivalentHPanel />}
      {tool === 'num' && <NumberingDemo />}
      {tool === 'cis' && <CisTransPanel />}
      {tool === 'roadmap' && <ReactionRoadmap />}
    </div>
  );
}
