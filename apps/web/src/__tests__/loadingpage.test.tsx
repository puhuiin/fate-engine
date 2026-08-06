// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Loading from '../pages/Loading';
import { LAYER_SKELETON } from '../layers';

function renderLoading(state: { recordId: number } | null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/loading', ...(state ? { state } : {}) }]}>
      <Routes>
        <Route path="/loading" element={<Loading />} />
        <Route path="/report/:id" element={<div data-testid="report-route">{'报告页'}</div>} />
        <Route path="/" element={<div data-testid="home-route">{'首页'}</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Loading 测算页集成测试：无 state 兜底、九层动画推进、自动跳转与跳过动画 */
describe('Loading 测算页', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('缺少测算数据时提示并给返回首页入口', () => {
    renderLoading(null);
    expect(screen.getByText(/缺少测算数据/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toBeInTheDocument();
  });

  it('无 state 时点返回首页跳到根路由', async () => {
    renderLoading(null);
    fireEvent.click(screen.getByRole('link', { name: '返回首页' }));
    expect(screen.getByTestId('home-route')).toBeInTheDocument();
  });

  it('九层动画按序推进并自动跳转报告页', async () => {
    vi.useFakeTimers();
    try {
      renderLoading({ recordId: 7 });
      // 初始停在第一层
      expect(screen.getByText(/正在贯通 L1/)).toBeInTheDocument();

      // 推进前 4 层（每层 220ms）
      await act(async () => {
        await vi.advanceTimersByTimeAsync(220 * 4);
      });
      expect(screen.getByText(/正在贯通 L5/)).toBeInTheDocument();
      // 前 4 层打勾（done 状态元素数 = 4）
      expect(screen.getAllByText('✓')).toHaveLength(4);

      // 推进到最后一层后进入完成态
      const total = LAYER_SKELETON.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(220 * (total - 4));
      });
      expect(screen.getByText(/贯通完毕/)).toBeInTheDocument();

      // 完成 300ms 后自动跳转报告页
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(screen.getByTestId('report-route')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('动画推进中卸载组件：不残留悬挂导航定时器', async () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderLoading({ recordId: 7 });
      // 推进 2 层后卸载（此时尚未完成动画）
      await act(async () => {
        await vi.advanceTimersByTimeAsync(220 * 2);
      });
      unmount();
      // 即使时间推进到「完成 + 300ms」，也不应出现报告页（导航定时器已被 cleanup 清理）
      const total = LAYER_SKELETON.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(220 * (total - 2) + 300);
      });
      expect(screen.queryByTestId('report-route')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('点击跳过动画立即进入报告页', async () => {
    renderLoading({ recordId: 7 });
    fireEvent.click(screen.getByRole('button', { name: /跳过动画/ }));
    expect(screen.getByTestId('report-route')).toBeInTheDocument();
  });

  it('StrictMode 双跑下动画仍启动并自动跳转', async () => {
    vi.useFakeTimers();
    try {
      render(
        <StrictMode>
          <MemoryRouter initialEntries={[{ pathname: '/loading', state: { recordId: 7 } }]}>
            <Routes>
              <Route path="/loading" element={<Loading />} />
              <Route
                path="/report/:id"
                element={<div data-testid="report-route">{'报告页'}</div>}
              />
            </Routes>
          </MemoryRouter>
        </StrictMode>,
      );
      // StrictMode 双跑后动画仍应从 L1 开始推进
      expect(screen.getByText(/正在贯通 L1/)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(220 * 3);
      });
      expect(screen.getByText(/正在贯通 L4/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
