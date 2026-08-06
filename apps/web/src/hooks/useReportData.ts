import { useCallback, useEffect, useState } from 'react';
import {
  calculate,
  createUnlockOrder,
  getPlans,
  getRecord,
  getRisks,
  patchPlan,
  payOrder,
  type L1Result,
  type L2Result,
  type L3Result,
  type L4Result,
  type L5Result,
  type L6Result,
  type L7Result,
  type L8Result,
  type L9Result,
  type PlanItem,
  type RiskItem,
} from '../api/client';

export interface ReportDataState {
  l1: L1Result | null;
  l2: L2Result | null;
  l3: L3Result | null;
  l4: L4Result | null;
  l5: L5Result | null;
  l6: L6Result | null;
  l7: L7Result | null;
  l8: L8Result | null;
  l9: L9Result | null;
}

/**
 * 报告页数据层 hook：集中管理九层报告、解锁状态、改运计划与风险项的加载与变更，
 * 将异步状态机从 UI 组件中剥离，组件只负责渲染。
 */
export function useReportData(recordId: number) {
  const [data, setData] = useState<ReportDataState>({
    l1: null,
    l2: null,
    l3: null,
    l4: null,
    l5: null,
    l6: null,
    l7: null,
    l8: null,
    l9: null,
  });
  const [paidStatus, setPaidStatus] = useState(0);
  const [calcType, setCalcType] = useState('standard');
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [reCalcId, setReCalcId] = useState<number | null>(null);
  const [unlockError, setUnlockError] = useState('');
  const [loadError, setLoadError] = useState('');

  const refreshPlansRisks = useCallback(async () => {
    const [pl, rk] = await Promise.all([getPlans(recordId), getRisks(recordId)]);
    if (pl.data) setPlans(pl.data.plans);
    if (rk.data) setRisks(rk.data.risks);
  }, [recordId]);

  const reload = useCallback(async () => {
    const res = await getRecord(recordId);
    if (res.code !== 200) throw new Error(res.msg || '记录不存在或无权访问');
    if (res.data?.dataError) throw new Error('该记录报告数据异常，请返回记录列表重新测算');
    const r = res.data?.report;
    setData({
      l1: r?.l1 ?? null,
      l2: r?.l2 ?? null,
      l3: r?.l3 ?? null,
      l4: r?.l4 ?? null,
      l5: r?.l5 ?? null,
      l6: r?.l6 ?? null,
      l7: r?.l7 ?? null,
      l8: r?.l8 ?? null,
      l9: r?.l9 ?? null,
    });
    setPaidStatus(res.data?.paidStatus ?? 0);
    if (res.data?.calc_type) setCalcType(String(res.data.calc_type));
    if (res.data?.archive_id && res.data.archive_id > 0) setArchiveId(res.data.archive_id);
    setLoadError('');
    return res;
  }, [recordId]);

  const unlock = useCallback(
    async (channel: string = 'wechat') => {
      setUnlocking(true);
      setUnlockError('');
      try {
        const o = await createUnlockOrder(recordId);
        if (o.code !== 200) throw new Error(o.msg || '创建解锁订单失败，请稍后重试');
        if (!o.data.alreadyUnlocked) {
          const pay = await payOrder(o.data.order.id, channel);
          if (pay.code !== 200) throw new Error(pay.msg || '支付失败，请稍后重试');
        }
        await reload();
        await refreshPlansRisks();
      } catch (e) {
        setUnlockError(e instanceof Error ? e.message : '解锁失败，请稍后重试');
      } finally {
        setUnlocking(false);
      }
    },
    [recordId, reload, refreshPlansRisks],
  );

  const togglePlan = useCallback(async (plan: PlanItem) => {
    const next: 'done' | 'pending' = plan.status === 'done' ? 'pending' : 'done';
    setPlans((cur) => cur.map((p) => (p.id === plan.id ? { ...p, status: next } : p)));
    try {
      const res = await patchPlan(plan.id, { status: next });
      if (res.data) {
        setPlans((cur) => cur.map((p) => (p.id === plan.id ? res.data : p)));
      }
    } catch {
      setPlans((cur) => cur.map((p) => (p.id === plan.id ? { ...p, status: plan.status } : p)));
    }
  }, []);

  const reCalc = useCallback(
    async (onNavigate: (recordId: number) => void) => {
      if (!archiveId) return;
      setReCalcId(archiveId);
      try {
        const res = await calculate(archiveId, calcType);
        if (res.code !== 200) throw new Error(res.msg || '重新测算失败，请稍后重试');
        onNavigate(res.data.recordId);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : '重新测算失败，请稍后重试');
      } finally {
        setReCalcId(null);
      }
    },
    [archiveId, calcType],
  );

  useEffect(() => {
    (async () => {
      try {
        // 报告与计划/风险无依赖，并行加载省一个 RTT
        await Promise.all([reload(), refreshPlansRisks()]);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : '报告加载失败，请刷新重试');
      } finally {
        setLoading(false);
      }
    })();
  }, [reload, refreshPlansRisks]);

  return {
    data,
    paidStatus,
    calcType,
    archiveId,
    plans,
    risks,
    loading,
    unlocking,
    reCalcId,
    unlockError,
    loadError,
    unlocked: paidStatus === 1,
    unlock,
    togglePlan,
    reCalc,
  };
}
