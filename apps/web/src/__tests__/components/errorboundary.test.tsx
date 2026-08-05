// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../../components/ErrorBoundary';

/** 正常渲染的子树 */
function Healthy() {
  return <div>正常内容</div>;
}

/** 渲染期抛错，用于验证错误边界兜底 */
function Broken(): ReactNode {
  throw new Error('boom');
}

describe('ErrorBoundary 全局错误边界', () => {
  it('子组件正常时不拦截渲染', () => {
    render(
      <ErrorBoundary>
        <Healthy />
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
    expect(screen.queryByText(/页面出错了/)).not.toBeInTheDocument();
  });

  it('子组件抛错时展示兜底并允许重试', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <Broken />
        </ErrorBoundary>,
      );
      expect(screen.getByText(/页面出错了/)).toBeInTheDocument();
      expect(screen.getByText('boom')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '返回首页' })).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});
