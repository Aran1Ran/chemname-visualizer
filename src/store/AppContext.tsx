/**
 * 全局应用状态：当前分子、视图模式、配色、活动模块
 */
import React, { createContext, useContext, useMemo, useReducer } from 'react';

export type ViewMode = 'full' | 'skeletal' | 'condensed';
export type ToolId = 'parse' | 'practice' | 'tools' | 'export';

export interface ColorScheme {
  skeleton: string; // 母体碳链（蓝）
  substituent: string; // 取代基/官能团（红）
  hydrogen: string; // 氢（灰）
  hetero: string; // 杂原子（绿）
  background: string;
}

export const DEFAULT_COLORS: ColorScheme = {
  skeleton: '#1d4ed8',
  substituent: '#dc2626',
  hydrogen: '#9ca3af',
  hetero: '#059669',
  background: '#ffffff',
};

export interface MoleculeInfo {
  smiles: string;
  canonicalSmiles: string;
  formula: string;
  condensed: string;
  name?: string;
  /** 教学标注结构（导出截图包用） */
  built?: import('../core/naming/builder').BuiltMolecule;
  named?: import('../core/reverse/namer').NamedResult;
}

interface AppState {
  engineReady: boolean;
  engineError: string | null;
  molecule: MoleculeInfo | null;
  viewMode: ViewMode;
  colors: ColorScheme;
  activeTool: ToolId;
}

type AppAction =
  | { type: 'engine-ready'; ready: boolean; error?: string | null }
  | { type: 'set-molecule'; molecule: MoleculeInfo | null }
  | { type: 'set-view'; view: ViewMode }
  | { type: 'set-colors'; colors: Partial<ColorScheme> }
  | { type: 'set-tool'; tool: ToolId };

const initialState: AppState = {
  engineReady: false,
  engineError: null,
  molecule: null,
  viewMode: 'full',
  colors: DEFAULT_COLORS,
  activeTool: 'parse',
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'engine-ready':
      return { ...state, engineReady: action.ready, engineError: action.error ?? null };
    case 'set-molecule':
      return { ...state, molecule: action.molecule };
    case 'set-view':
      return { ...state, viewMode: action.view };
    case 'set-colors':
      return { ...state, colors: { ...state.colors, ...action.colors } };
    case 'set-tool':
      return { ...state, activeTool: action.tool };
    default:
      return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> } | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用');
  return ctx;
}
