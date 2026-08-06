// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPanel from '../../components/LoginPanel';

vi.mock('../../api/client', () => ({
  phoneLogin: vi.fn(),
  sendSmsCode: vi.fn(),
  setToken: vi.fn(),
  updateProfile: vi.fn(),
}));

import { phoneLogin, sendSmsCode, setToken, updateProfile } from '../../api/client';
import type { User } from '../../api/client';

const mocked = {
  phoneLogin: vi.mocked(phoneLogin),
  sendSmsCode: vi.mocked(sendSmsCode),
  setToken: vi.mocked(setToken),
  updateProfile: vi.mocked(updateProfile),
};

const mePhone: User = {
  id: 1,
  phone_masked: '138****0000',
  nickname: '张三',
  register_channel: 'phone',
  member_level: 0,
};

describe('LoginPanel 登录面板', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录时展示手机号与验证码表单', () => {
    render(<LoginPanel me={null} onLogin={() => {}} />);
    expect(screen.getByPlaceholderText('手机号')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('验证码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('手机号格式错误时不发验证码', async () => {
    render(<LoginPanel me={null} onLogin={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('手机号'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    expect(mocked.sendSmsCode).not.toHaveBeenCalled();
    expect(screen.getByText('手机号格式不正确')).toBeInTheDocument();
  });

  it('发送成功回显 devCode 并启动倒计时', async () => {
    vi.useFakeTimers();
    try {
      mocked.sendSmsCode.mockResolvedValueOnce({
        code: 200,
        msg: 'ok',
        data: { sent: true, devCode: '123456', expiresIn: 300 },
        timestamp: 0,
        sign: '',
      });
      render(<LoginPanel me={null} onLogin={() => {}} />);
      fireEvent.change(screen.getByPlaceholderText('手机号'), {
        target: { value: '13800138000' },
      });
      fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
      await vi.advanceTimersByTimeAsync(0);
      expect(mocked.sendSmsCode).toHaveBeenCalledWith('13800138000');
      expect(screen.getByText(/开发模式：123456/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /60s 后可重发/ })).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(3000);
      expect(screen.getByRole('button', { name: /57s 后可重发/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('发送失败展示服务端错误文案', async () => {
    mocked.sendSmsCode.mockResolvedValueOnce({
      code: 429,
      msg: '发送太频繁',
      data: { sent: false },
      timestamp: 0,
      sign: '',
    });
    render(<LoginPanel me={null} onLogin={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    expect(await screen.findByText('发送太频繁')).toBeInTheDocument();
  });

  it('登录成功后合并游客记录并触发 onLogin', async () => {
    mocked.phoneLogin.mockResolvedValueOnce({
      code: 200,
      msg: 'ok',
      data: { user: mePhone, token: 'new-token', merged: { archives: 0, records: 1 } },
      timestamp: 0,
      sign: '',
    });
    const onLogin = vi.fn();
    render(<LoginPanel me={null} onLogin={onLogin} />);
    fireEvent.change(screen.getByPlaceholderText('手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('验证码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(mocked.phoneLogin).toHaveBeenCalledWith('13800138000', '123456', undefined);
    await waitFor(() => expect(mocked.setToken).toHaveBeenCalledWith('new-token'));
    expect(screen.getByText(/已将 1 条游客测算记录合并/)).toBeInTheDocument();
    expect(onLogin).toHaveBeenCalled();
  });

  it('登录失败展示错误提示且不触发 onLogin', async () => {
    mocked.phoneLogin.mockResolvedValueOnce({
      code: 403,
      msg: '验证码错误',
      data: { user: mePhone, token: '' },
      timestamp: 0,
      sign: '',
    });
    const onLogin = vi.fn();
    render(<LoginPanel me={null} onLogin={onLogin} />);
    fireEvent.change(screen.getByPlaceholderText('手机号'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByPlaceholderText('验证码'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(await screen.findByText('验证码错误')).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('已登录展示昵称并可编辑保存', async () => {
    mocked.updateProfile.mockResolvedValueOnce({
      code: 200,
      msg: 'ok',
      data: mePhone,
      timestamp: 0,
      sign: '',
    });
    const onLogin = vi.fn();
    render(<LoginPanel me={mePhone} onLogin={onLogin} />);
    expect(screen.getByText(/已登录/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '改昵称' }));
    const input = screen.getByPlaceholderText('昵称');
    fireEvent.change(input, { target: { value: '新昵称' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mocked.updateProfile).toHaveBeenCalledWith({ nickname: '新昵称' });
    await waitFor(() => expect(onLogin).toHaveBeenCalled());
  });
});
