import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getRecord,
  getPlans,
  getRisks,
  createUnlockOrder,
  payOrder,
  patchPlan,
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
import { LAYER_NAMES, MODULE_HINT } from '../layers';
import { buildExportText, Layer1, Layer2, Layer3, Layer4, Layer5, Layer6, Layer7, Layer8, Layer9 } from './report/layers';
import { buildPlainGuide, type PlainPoint } from './report/plain';

/** 单层渲染错误边界：某一层出错仅降级该层，不拖垮整份报告 */
class LayerBoundary extends Component<{ layer: number; children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError(): { broken: boolean } {
    return { broken: true };
  }
  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error(`L${this.props.layer} render error:`, err, info.componentStack);
  }
  render(): ReactNode {
    if (this.state.broken) {
      return (
        <div className="lock-card">
          <strong>该层渲染异常</strong>
          <p>这一层的数据暂时无法展示，不影响其他分层。可刷新页面重试。</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Report() {
  const { id } = useParams();
  const recordId = Number(id);
  const [l1, setL1] = useState<L1Result | null>(null);
  const [l2, setL2] = useState<L2Result | null>(null);
  const [l3, setL3] = useState<L3Result | null>(null);
  const [l4, setL4] = useState<L4Result | null>(null);
  const [l5, setL5] = useState<L5Result | null>(null);
  const [l6, setL6] = useState<L6Result | null>(null);
  const [l7, setL7] = useState<L7Result | null>(null);
  const [l8, setL8] = useState<L8Result | null>(null);
  const [l9, setL9] = useState<L9Result | null>(null);
  const [paidStatus, setPaidStatus] = useState(0);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    const res = await getRecord(recordId);
    if (res.code !== 200) throw new Error(res.msg || '记录不存在或无权访问');
    if (res.data?.dataError) throw new Error('该记录报告数据异常，请返回记录列表重新测算');
    const r = res.data?.report;
    setL1(r?.l1 ?? null);
    setL2(r?.l2 ?? null);
    setL3(r?.l3 ?? null);
    setL4(r?.l4 ?? null);
    setL5(r?.l5 ?? null);
    setL6(r?.l6 ?? null);
    setL7(r?.l7 ?? null);
    setL8(r?.l8 ?? null);
    setL9(r?.l9 ?? null);
    setPaidStatus(res.data?.paidStatus ?? 0);
    setLoadError('');
    return res;
  }, [recordId]);

  useEffect(() => {
    (async () => {
      try {
        await reload();
        const [pl, rk] = await Promise.all([getPlans(recordId), getRisks(recordId)]);
        if (pl.data) setPlans(pl.data.plans);
        if (rk.data) setRisks(rk.data.risks);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : '报告加载失败，请刷新重试');
      } finally {
        setLoading(false);
      }
    })();
  }, [reload, recordId]);

  const unlock = async () => {
    setUnlocking(true);
    setUnlockError('');
    try {
      const o = await createUnlockOrder(recordId);
      if (!o.data.alreadyUnlocked) {
        await payOrder(o.data.order.id, 'mock');
      }
      await reload();
      const [pl, rk] = await Promise.all([getPlans(recordId), getRisks(recordId)]);
      if (pl.data) setPlans(pl.data.plans);
      if (rk.data) setRisks(rk.data.risks);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : '解锁失败，请稍后重试');
    } finally {
      setUnlocking(false);
    }
  };

  const togglePlan = async (plan: PlanItem) => {
    const next: 'done' | 'pending' = plan.status === 'done' ? 'pending' : 'done';
    const before = plans.map((p) => (p.id === plan.id ? { ...p, status: next } : p));
    setPlans(before);
    try {
      const res = await patchPlan(plan.id, { status: next });
      if (res.data) {
        setPlans((cur) => cur.map((p) => (p.id === plan.id ? res.data : p)));
      }
    } catch {
      setPlans((cur) => cur.map((p) => (p.id === plan.id ? { ...p, status: plan.status } : p)));
    }
  };

  if (!Number.isInteger(recordId) || recordId <= 0) {
    return (
      <div className="card">
        <p className="error">无效的记录 ID，请从<a href="/history">记录列表</a>进入。</p>
      </div>
    );
  }
  if (loading) return <div className="card">读取报告中…</div>;
  if (loadError) {
    return (
      <div className="card">
        <p className="error">{loadError}</p>
        <p className="dim">请检查网络后 <Link to={`/history`}>返回记录列表</Link> 重试。</p>
      </div>
    );
  }

  const layers: Array<{ layer: number; name: string; ready: boolean; locked: boolean; el?: ReactNode }> = [
    { layer: 1, name: LAYER_NAMES[0], ready: !!l1, locked: false, el: l1 ? <Layer1 l1={l1} /> : undefined },
    { layer: 2, name: LAYER_NAMES[1], ready: !!l2, locked: false, el: l2 ? <Layer2 l2={l2} /> : undefined },
    { layer: 3, name: LAYER_NAMES[2], ready: !!l3, locked: false, el: l3 ? <Layer3 l3={l3} /> : undefined },
    { layer: 4, name: LAYER_NAMES[3], ready: !!l4, locked: paidStatus !== 1, el: l4 ? <Layer4 l4={l4} /> : undefined },
    { layer: 5, name: LAYER_NAMES[4], ready: !!l5, locked: paidStatus !== 1, el: l5 ? <Layer5 l5={l5} /> : undefined },
    { layer: 6, name: LAYER_NAMES[5], ready: !!l6, locked: paidStatus !== 1, el: l6 ? <Layer6 l6={l6} risks={risks} /> : undefined },
    { layer: 7, name: LAYER_NAMES[6], ready: !!l7, locked: paidStatus !== 1, el: l7 ? <Layer7 l7={l7} /> : undefined },
    { layer: 8, name: LAYER_NAMES[7], ready: !!l8, locked: paidStatus !== 1, el: l8 ? <Layer8 l8={l8} plans={plans} onToggle={togglePlan} /> : undefined },
    { layer: 9, name: LAYER_NAMES[8], ready: !!l9, locked: paidStatus !== 1, el: l9 ? <Layer9 l9={l9} /> : undefined },
  ];

  const scrollToLayer = (layer: number) => {
    document.getElementById(`layer-${layer}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fmtHour = (h: number): string => {
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const unlocked = paidStatus === 1;
  const plainGuide: PlainPoint[] = buildPlainGuide({
    trueSolar: l1 ? fmtHour(l1.timeCorrection.trueSolarHours) : undefined,
    personality: l3?.personality,
    strengths: l3?.strengths,
    growth: l3?.growth,
    mainKnot: unlocked ? l5?.mainKnot : undefined,
    synthesis: unlocked ? l7?.synthesis : undefined,
    essence: unlocked ? l9?.essence : undefined,
    risk: unlocked && risks.length > 0 ? `${risks[0].trigger_condition}（应对：${risks[0].mitigation}）` : undefined,
  });

  const exportText = async () => {
    const text = buildExportText({
      l1,
      l2,
      l3,
      l4: unlocked ? l4 : null,
      l5: unlocked ? l5 : null,
      l6: unlocked ? l6 : null,
      l7: unlocked ? l7 : null,
      l8: unlocked ? l8 : null,
      l9: unlocked ? l9 : null,
      risks: unlocked ? risks : [],
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fate-report-${recordId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="report">
      <div className="card">
        <h2>测算报告</h2>
        <p className="hint">
          九层输出结构（PRD 规格）。基础层免费，深度层（L4-L9）付费解锁
          {paidStatus === 1 ? '，当前已解锁全量报告。' : '。'}
        </p>
        <button type="button" className="ghost export-btn" onClick={exportText}>
          {copied ? '已复制报告 ✓' : '复制报告文本'}
        </button>
        <button type="button" className="ghost export-btn" onClick={() => window.print()}>
          打印 / 保存 PDF
        </button>
        {paidStatus !== 1 && (
          <div className="lock-banner">
            <strong>深度报告解锁 ¥99</strong>
            <p>解锁 L4 六维落地、L5 卡点溯源、L6 命运线、L7 综合结论、L8 改运方案、L9 课题总结。</p>
            {unlockError && <p className="error">{unlockError}</p>}
            <button className="unlock-btn" onClick={unlock} disabled={unlocking}>
              {unlocking ? '支付处理中…' : '立即解锁'}
            </button>
          </div>
        )}

        {plainGuide.length > 0 && (
          <section className="exec-summary">
            <h3>先看这里：三分钟读懂报告</h3>
            <p className="hint">下面把结论翻译成大白话，详细内容在对应分层里。</p>
            <ul className="plain-points">
              {plainGuide.map((pt, i) => (
                <li key={i}>
                  <span className="point-tag">{pt.tag}</span>
                  <div>
                    <strong>{pt.title}</strong>
                    <p>{pt.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            {!unlocked && (
              <p className="dim">解锁深度报告后，这里会补充「卡点 / 综合结论 / 核心要义」等关键结论。</p>
            )}
            <p className="dim plain-disclaimer">以上为启发式文化解读，仅供自我观察参考，不作任何决策依据。</p>
          </section>
        )}

        <nav className="layer-nav">
          {layers.map((l) => (
            <button
              key={l.layer}
              type="button"
              onClick={() => scrollToLayer(l.layer)}
              className={`layer-nav-btn ${l.locked ? 'locked' : ''}`}
            >
              L{l.layer}
              {l.locked ? ' 🔒' : ''}
            </button>
          ))}
        </nav>
      </div>

      {layers.map((l) => (
        <div key={l.layer} id={`layer-${l.layer}`} className={`card layer-card ${l.ready ? 'ready' : 'pending'}`}>
          <div className="layer-head">
            <span className="layer-badge">L{l.layer}</span>
            <h3>{l.name}</h3>
            <span className={`pill ${l.ready ? 'pill-ready' : 'pill-pending'}`}>
              {l.ready ? '已上线' : '待上线'}
            </span>
          </div>
          {l.locked ? (
            <div className="lock-card">
              <strong>深度测算层已锁定</strong>
              <p>该层为付费深度内容，解锁后可查看完整解析与行动方案。</p>
              {unlockError && <p className="error">{unlockError}</p>}
              <button className="unlock-btn" onClick={unlock} disabled={unlocking}>
                {unlocking ? '处理中…' : '解锁该层'}
              </button>
            </div>
          ) : (
            <LayerBoundary layer={l.layer}>{l.el}</LayerBoundary>
          )}
          {!l.ready && <p className="dim">该层属于「{MODULE_HINT[l.layer]}」模块，将在后续阶段接入。</p>}
        </div>
      ))}

      <div className="card report-foot">
        <Link to="/">再测一次</Link> · <Link to="/history">查看历史记录</Link>
        <button className="ghost float-right" type="button" onClick={scrollTop}>
          回到顶部 ↑
        </button>
      </div>
    </div>
  );
}
