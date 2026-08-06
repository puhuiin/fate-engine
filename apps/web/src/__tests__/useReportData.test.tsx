// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useReportData } from '../hooks/useReportData';
import type { L1Result, RecordDetail } from '../api/client';

const api = vi.hoisted(() => ({
  getRecord: vi.fn(),
  getPlans: vi.fn(),
  getRisks: vi.fn(),
  createUnlockOrder: vi.fn(),
  payOrder: vi.fn(),
  patchPlan: vi.fn(),
  calculate: vi.fn(),
}));

vi.mock('../api/client', () => api);

const ok = (data: unknown) => ({ code: 200, msg: '', data, timestamp: 0, sign: '' });
const fail = (code: number, msg: string) => ({
  code,
  msg,
  data: null,
  timestamp: 0,
  sign: '',
});

const l1a = { marker: 'a' } as unknown as L1Result;
const l1b = { marker: 'b' } as unknown as L1Result;

function recordOf(l1: L1Result | null, paidStatus = 0): RecordDetail {
  return {
    id: 1,
    archive_id: 1,
    calc_type: 'standard',
    status: 'completed',
    created_at: '2026-01-01 00:00:00',
    report: { l1, l2: null, l3: null, l4: null, l5: null, l6: null, l7: null, l8: null, l9: null },
    paidStatus,
    dataError: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getPlans.mockResolvedValue(ok({ plans: [], doneCount: 0, total: 0 }));
  api.getRisks.mockResolvedValue(ok({ risks: [], total: 0, locked: true }));
});

describe('useReportData 加载', () => {
  it('加载成功填充九层数据与解锁状态', async () => {
    api.getRecord.mockResolvedValue(ok(recordOf(l1a, 1)));
    const { result } = renderHook(() => useReportData(1));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.l1).toEqual(l1a);
    expect(result.current.unlocked).toBe(true);
  });

  it('加载失败设置 loadError 并结束 loading', async () => {
    api.getRecord.mockRejectedValue(new Error('网络请求超时或失败'));
    const { result } = renderHook(() => useReportData(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toContain('网络请求超时');
  });

  it('数据异常（dataError）提示重新测算', async () => {
    api.getRecord.mockResolvedValue(ok({ ...recordOf(null), dataError: true }));
    const { result } = renderHook(() => useReportData(1));
    await waitFor(() => expect(result.current.loadError).toContain('报告数据异常'));
  });
});

describe('useReportData 竞态防护', () => {
  it('切换 recordId：旧请求被 abort，晚到的旧响应不覆盖新数据', async () => {
    let releaseOld!: (v: unknown) => void;
    let oldSignal: AbortSignal | undefined;
    api.getRecord.mockImplementationOnce((_id: number, opts?: { signal?: AbortSignal }) => {
      oldSignal = opts?.signal;
      return new Promise((res) => {
        releaseOld = res;
      });
    });
    api.getRecord.mockImplementationOnce((_id: number, opts?: { signal?: AbortSignal }) => {
      if (opts?.signal?.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
      return Promise.resolve(ok(recordOf(l1b, 1)));
    });

    const { result, rerender } = renderHook(({ id }: { id: number }) => useReportData(id), {
      initialProps: { id: 1 },
    });
    rerender({ id: 2 });
    await waitFor(() => expect(api.getRecord).toHaveBeenCalledTimes(2));
    expect(oldSignal?.aborted).toBe(true);

    act(() => {
      releaseOld(ok(recordOf(l1a)));
    });
    await waitFor(() => expect(result.current.data.l1).toEqual(l1b));
  });
});

describe('useReportData 解锁支付', () => {
  it('成功流程：创建订单 → 支付 → 刷新报告与计划', async () => {
    api.getRecord.mockResolvedValue(ok(recordOf(l1a, 1)));
    api.createUnlockOrder.mockResolvedValue(
      ok({
        order: { id: 10, amount_cents: 9900, entitlement_status: 'pending' },
        alreadyUnlocked: false,
      }),
    );
    api.payOrder.mockResolvedValue(ok({ order: { id: 10 }, paidStatus: 1 }));
    const { result } = renderHook(() => useReportData(1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      void result.current.unlock();
    });
    await waitFor(() => expect(api.createUnlockOrder).toHaveBeenCalledTimes(1));
    expect(api.payOrder).toHaveBeenCalledWith(10, 'wechat');
    await waitFor(() => expect(result.current.unlocked).toBe(true));
    await waitFor(() => expect(result.current.unlocking).toBe(false));
  });

  it('支付 410（订单过期）时重建订单重试一次', async () => {
    api.getRecord.mockResolvedValue(ok(recordOf(l1a, 1)));
    api.createUnlockOrder
      .mockResolvedValueOnce(
        ok({
          order: { id: 10, amount_cents: 9900, entitlement_status: 'pending' },
          alreadyUnlocked: false,
        }),
      )
      .mockResolvedValueOnce(
        ok({
          order: { id: 11, amount_cents: 9900, entitlement_status: 'pending' },
          alreadyUnlocked: false,
        }),
      );
    api.payOrder
      .mockResolvedValueOnce(fail(410, '订单已过期'))
      .mockResolvedValueOnce(ok({ order: { id: 11 }, paidStatus: 1 }));
    const { result } = renderHook(() => useReportData(1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      void result.current.unlock();
    });
    await waitFor(() => expect(api.createUnlockOrder).toHaveBeenCalledTimes(2));
    expect(api.payOrder).toHaveBeenLastCalledWith(11, 'wechat');
    await waitFor(() => expect(result.current.unlocked).toBe(true));
    expect(result.current.unlockError).toBe('');
  });

  it('支付失败（非 410）设置 unlockError，不重试', async () => {
    api.getRecord.mockResolvedValue(ok(recordOf(l1a, 0)));
    api.createUnlockOrder.mockResolvedValue(
      ok({
        order: { id: 10, amount_cents: 9900, entitlement_status: 'pending' },
        alreadyUnlocked: false,
      }),
    );
    api.payOrder.mockResolvedValue(fail(500, '支付渠道暂不可用'));
    const { result } = renderHook(() => useReportData(1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      void result.current.unlock();
    });
    await waitFor(() => expect(result.current.unlocking).toBe(false));
    expect(result.current.unlockError).toContain('支付渠道暂不可用');
    expect(api.createUnlockOrder).toHaveBeenCalledTimes(1);
  });
});

describe('useReportData 改运打卡', () => {
  const plan = {
    id: 7,
    level: 1,
    title: 't',
    content: 'c',
    exec_cycle: 'daily',
    status: 'pending' as const,
    finished_at: null,
  };

  it('乐观更新成功按响应回填', async () => {
    api.getRecord.mockResolvedValue(ok(recordOf(l1a, 1)));
    api.getPlans.mockResolvedValue(ok({ plans: [plan], doneCount: 0, total: 1 }));
    const done = { ...plan, status: 'done' as const };
    api.patchPlan.mockResolvedValue(ok(done));
    const { result } = renderHook(() => useReportData(1));
    await waitFor(() =>
      expect(result.current.plans.find((p) => p.id === 7)?.status).toBe('pending'),
    );
    act(() => {
      void result.current.togglePlan(plan);
    });
    await waitFor(() => expect(result.current.plans.find((p) => p.id === 7)?.status).toBe('done'));
  });

  it('请求失败回滚乐观更新', async () => {
    api.getRecord.mockResolvedValue(ok(recordOf(l1a, 1)));
    api.getPlans.mockResolvedValue(ok({ plans: [plan], doneCount: 0, total: 1 }));
    api.patchPlan.mockRejectedValue(new Error('网络错误'));
    const { result } = renderHook(() => useReportData(1));
    await waitFor(() =>
      expect(result.current.plans.find((p) => p.id === 7)?.status).toBe('pending'),
    );
    act(() => {
      void result.current.togglePlan(plan);
    });
    await waitFor(() =>
      expect(result.current.plans.find((p) => p.id === 7)?.status).toBe('pending'),
    );
  });
});
