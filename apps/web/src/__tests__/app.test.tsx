// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    getMe: vi.fn(),
  };
});

vi.mock('../pages/Input', () => ({ default: () => <div data-testid="page-input">录入页</div> }));
vi.mock('../pages/Loading', () => ({
  default: () => <div data-testid="page-loading">测算中</div>,
}));
vi.mock('../pages/Report', () => ({ default: () => <div data-testid="page-report">报告页</div> }));
vi.mock('../pages/History', () => ({
  default: () => <div data-testid="page-history">历史页</div>,
}));

import { getMe, AUTH_CHANGED_EVENT, TOAST_EVENT } from '../api/client';
import type { User } from '../api/client';

const mockedGetMe = vi.mocked(getMe);

const user = (over: Partial<User> = {}): User => ({
  id: 1,
  phone_masked: null,
  nickname: '阿宝',
  register_channel: 'guest',
  member_level: 0,
  ...over,
});

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/** App 路由级集成测试：懒加载路由切换、全局 401 toast、登录态刷新与用户 chip */
describe('App 路由与应用外壳', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  });

  it('默认路由渲染录入页', async () => {
    renderApp();
    expect(await screen.findByTestId('page-input')).toBeInTheDocument();
  });

  it('点击导航切换到历史页', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('link', { name: '我的记录' }));
    expect(await screen.findByTestId('page-history')).toBeInTheDocument();
  });

  it('直接访问报告路由渲染报告页', async () => {
    renderApp('/report/5');
    expect(await screen.findByTestId('page-report')).toBeInTheDocument();
  });

  it('无 token 时展示游客模式且不请求 getMe', async () => {
    renderApp();
    expect(await screen.findByTestId('page-input')).toBeInTheDocument();
    expect(screen.getByText('游客模式')).toBeInTheDocument();
    expect(mockedGetMe).not.toHaveBeenCalled();
  });

  it('已登录展示手机号 chip', async () => {
    localStorage.setItem('fate_token', 't');
    mockedGetMe.mockResolvedValue({
      code: 200,
      msg: 'ok',
      data: user({ phone_masked: '138****0000', nickname: '张三' }),
      timestamp: 0,
      sign: '',
    });
    renderApp();
    expect(await screen.findByText('138****0000')).toBeInTheDocument();
  });

  it('已登录无手机号时展示昵称 chip', async () => {
    localStorage.setItem('fate_token', 't');
    mockedGetMe.mockResolvedValue({
      code: 200,
      msg: 'ok',
      data: user(),
      timestamp: 0,
      sign: '',
    });
    renderApp();
    expect(await screen.findByText('阿宝')).toBeInTheDocument();
  });

  it('getMe 失败回退为游客模式', async () => {
    localStorage.setItem('fate_token', 't');
    mockedGetMe.mockRejectedValue(new Error('401'));
    renderApp();
    expect(await screen.findByText('游客模式')).toBeInTheDocument();
  });

  it('AUTH_CHANGED 事件触发重新拉取用户信息', async () => {
    localStorage.setItem('fate_token', 't');
    mockedGetMe.mockResolvedValue({
      code: 200,
      msg: 'ok',
      data: user(),
      timestamp: 0,
      sign: '',
    });
    renderApp();
    await screen.findByText('阿宝');
    expect(mockedGetMe).toHaveBeenCalledTimes(1);

    // 昵称变更后广播事件，chip 应随之刷新
    mockedGetMe.mockResolvedValue({
      code: 200,
      msg: 'ok',
      data: user({ nickname: '新昵称' }),
      timestamp: 0,
      sign: '',
    });
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    expect(await screen.findByText('新昵称')).toBeInTheDocument();
    expect(mockedGetMe).toHaveBeenCalledTimes(2);
  });

  it('TOAST_EVENT 展示全局 toast 后自动消失', async () => {
    vi.useFakeTimers();
    try {
      renderApp();
      // 冲刷懒加载组件与初次渲染的微任务/计时器，再触发 toast
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      window.dispatchEvent(
        new CustomEvent<string>(TOAST_EVENT, { detail: '登录已过期，请重新登录' }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText('登录已过期，请重新登录')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3400);
      });
      expect(screen.queryByText('登录已过期，请重新登录')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('未知路由不匹配任何页面', async () => {
    renderApp('/no-such-page');
    expect(screen.queryByTestId('page-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-history')).not.toBeInTheDocument();
  });
});
