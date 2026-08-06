import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 触发重试（清空 error 后让子树重建） */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string;
}

/** 全局错误边界：子组件抛错时渲染友好兜底，避免整页白屏 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : '未知渲染错误' };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error('Render error:', err, info.componentStack);
  }

  reset = (): void => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="card error-card">
          <h2>页面出错了</h2>
          <p className="error">{this.state.message}</p>
          <p className="dim">请返回重新进入；如反复出现请刷新页面。</p>
          <div className="btn-row">
            <button type="button" className="primary" onClick={this.reset}>
              重试
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              返回首页
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
