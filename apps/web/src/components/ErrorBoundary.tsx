import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** 全局错误边界：渲染期异常不白屏，展示可恢复提示并允许重载 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="card">
        <h3>页面渲染出错</h3>
        <p className="error">抱歉，页面出现异常。可尝试刷新或返回首页。</p>
        <div className="actions">
          <button
            type="button"
            className="ghost"
            onClick={() => this.setState({ hasError: false })}
          >
            重试
          </button>
          <button type="button" className="ghost" onClick={() => window.location.replace('/')}>
            返回首页
          </button>
        </div>
      </div>
    );
  }
}
