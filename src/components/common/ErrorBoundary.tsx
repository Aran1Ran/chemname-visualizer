/**
 * 通用错误边界：子组件渲染抛错时降级为面板内错误提示，
 * 避免 React 18（无内置边界）整树卸载导致整页白屏。
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  /** 自定义降级 UI（默认中文提示 + 重试） */
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 组件渲染出错:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
          <div className="text-[14.5px] font-bold text-red-800">该面板渲染出错</div>
          <div className="mt-1 text-[13px] text-red-700/80">错误信息：{this.state.error.message}</div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-2 px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-[13px] font-medium hover:bg-red-700"
          >
            ↻ 重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
