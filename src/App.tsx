import { useEffect } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { initRDKit } from './core/rdkit';
import ParsePanel from './components/nameParse/ParsePanel';
import PracticePanel from './components/practice/PracticePanel';
import ToolsPanel from './components/tools/ToolsPanel';
import ExportPanel from './components/export/ExportPanel';
import type { ToolId } from './store/AppContext';

const TABS: Array<{ id: ToolId; label: string; desc: string }> = [
  { id: 'parse', label: '名称 → 结构', desc: '分步解析 · 错误诊断' },
  { id: 'practice', label: '反向练习', desc: '结构 → 名称 · 错题本' },
  { id: 'tools', label: '教学工具', desc: '异构体 · 等效氢 · 编号动画' },
  { id: 'export', label: '导出', desc: 'PNG/SVG · 截图包 · 报告' },
];

function Shell() {
  const { state, dispatch } = useApp();

  useEffect(() => {
    initRDKit()
      .then((m) => dispatch({ type: 'engine-ready', ready: true }))
      .catch((e) => dispatch({ type: 'engine-ready', ready: false, error: String(e) }));
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-[15px] font-bold shadow-sm">
            C
          </div>
          <div>
            <div className="text-[15.5px] font-bold text-ink leading-tight">ChemName Visualizer</div>
            <div className="text-[11.5px] text-ink-soft leading-tight">有机化学命名可视化教学工具 · 完全离线</div>
          </div>
        </div>
        <div className="flex-1" />
        <div
          className={`flex items-center gap-1.5 text-[12.5px] rounded-full px-3 py-1 ${
            state.engineReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}
          title={state.engineError ?? undefined}
        >
          <span className={`w-2 h-2 rounded-full ${state.engineReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          {state.engineReady ? '化学引擎就绪' : '引擎加载中…'}
        </div>
      </header>

      {/* Tab 栏 */}
      <nav className="bg-white border-b border-gray-200 px-4 flex gap-1 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dispatch({ type: 'set-tool', tool: t.id })}
            className={`px-4 py-2 text-[15px] font-medium border-b-2 transition-colors ${
              state.activeTool === t.id
                ? 'border-primary text-primary-dark'
                : 'border-transparent text-ink-soft hover:text-ink hover:bg-gray-50'
            }`}
            title={t.desc}
          >
            {t.label}
            <span className="ml-1.5 text-[11.5px] text-ink-soft/70 hidden lg:inline">{t.desc}</span>
          </button>
        ))}
      </nav>

      {/* 内容区 */}
      <main className="flex-1 p-4 overflow-y-auto">
        {!state.engineReady ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-ink-soft">
              <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <div className="text-[14.5px]">正在加载本地化学引擎（RDKit WebAssembly）…</div>
              <div className="text-[12.5px] mt-1">首次加载约 1-3 秒，之后无需网络</div>
            </div>
          </div>
        ) : state.activeTool === 'parse' ? (
          <ParsePanel />
        ) : state.activeTool === 'practice' ? (
          <PracticePanel />
        ) : state.activeTool === 'tools' ? (
          <ToolsPanel />
        ) : (
          <ExportPanel />
        )}
      </main>

      {/* 页脚提示：教学辅助性质声明 */}
      <footer className="shrink-0 bg-white border-t border-gray-200 px-4 py-2 text-center text-[12px] text-ink-soft">
        教学辅助工具 · 解析与命名结果请人工核验 · 完全离线运行
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
