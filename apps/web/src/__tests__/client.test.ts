// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TOAST_EVENT,
  clearToken,
  getToken,
  listRecords,
  notifyToast,
  setToken,
} from '../api/client';

/**
 * api client 传输层测试：重试策略、401 全局登出+toast、非 JSON 响应、外部取消入口。
 * 通过 mock global fetch 验证 request() 的行为契约。
 */

const json = (code: number, data: unknown) => {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code, data, msg: '', timestamp: 0, sign: '' }),
  } as unknown as Response;
};

describe('request 传输层', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GET 网络失败自动重试后成功', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(json(200, { list: [], total: 0, page: 1, pageSize: 10 }));
    const res = await listRecords(1, 10);
    expect(res.code).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('GET 连续失败超过重试上限则抛错', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    await expect(listRecords(1, 10)).rejects.toThrow('网络请求超时或失败');
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('非幂等请求不重试（POST 只发一次）', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    const { guestLogin } = await import('../api/client');
    await expect(guestLogin()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('响应非 JSON 时报错并提示 HTTP 状态', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
      json: async () => 'bad gateway',
    } as unknown as Response);
    await expect(listRecords()).rejects.toThrow('服务响应异常');
  });

  it('401 清除本地 token 并触发全局 toast 事件', async () => {
    setToken('tok-abc');
    expect(getToken()).toBe('tok-abc');
    fetchMock.mockResolvedValue(json(401, null));
    const toastMsgs: string[] = [];
    const onToast = (e: Event) => toastMsgs.push((e as CustomEvent<string>).detail);
    window.addEventListener(TOAST_EVENT, onToast);
    try {
      await expect(listRecords()).rejects.toThrow('登录已过期');
      expect(getToken()).toBe('');
      expect(toastMsgs).toContain('登录已过期，请重新登录');
    } finally {
      window.removeEventListener(TOAST_EVENT, onToast);
    }
  });

  it('外部 AbortSignal 取消：立即中止且不触发重试', async () => {
    const calls: Array<AbortSignal | null> = [];
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          calls.push(init?.signal ?? null);
          const sig = init?.signal;
          if (sig?.aborted) {
            reject(new DOMException('aborted', 'AbortError'));
            return;
          }
          sig?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const ctrl = new AbortController();
    const p = listRecords(1, 10, { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0]?.aborted).toBe(true);
  });

  it('listRecords 固定返回分页结构并携带分页参数', async () => {
    fetchMock.mockResolvedValue(json(200, { list: [], total: 3, page: 2, pageSize: 20 }));
    await listRecords(2, 20);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=20');
  });

  it('JSON 但缺少 code 字段报格式异常', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [], msg: '' }),
    } as unknown as Response);
    await expect(listRecords()).rejects.toThrow('服务响应格式异常');
  });

  it('业务错误码（非 401）原样透传且不触发登出', async () => {
    setToken('tok');
    fetchMock.mockResolvedValue(json(500, null));
    const res = await listRecords();
    expect(res.code).toBe(500);
    expect(getToken()).toBe('tok');
  });

  it('请求挂起超过超时阈值自动中止并抛超时错误', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const p = listRecords(1, 10);
    const assertion = expect(p).rejects.toThrow('网络请求超时或失败');
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe('notifyToast', () => {
  it('dispatch TOAST_EVENT 携带消息', () => {
    const msgs: string[] = [];
    const onToast = (e: Event) => msgs.push((e as CustomEvent<string>).detail);
    window.addEventListener(TOAST_EVENT, onToast);
    notifyToast('测试提示');
    expect(msgs).toEqual(['测试提示']);
    window.removeEventListener(TOAST_EVENT, onToast);
  });

  it('clearToken 触发登录态变更事件并清空存储', () => {
    setToken('tok');
    const fired: string[] = [];
    window.addEventListener('fate:auth-changed', () => fired.push('changed'));
    clearToken();
    expect(getToken()).toBe('');
    expect(fired).toEqual(['changed']);
  });
});
