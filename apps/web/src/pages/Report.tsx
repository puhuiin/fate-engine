import { type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useReportData } from '../hooks/useReportData';
import { useReportExport } from '../hooks/useReportExport';
import { LAYER_NAMES, MODULE_HINT } from '../layers';
import { Layer1, Layer2, Layer3, Layer4, Layer5, Layer6, Layer7, Layer8, Layer9 } from './report/layers';

export default function Report() {
  const { id } = useParams();
  const navigate = useNavigate();
  const recordId = Number(id);

  const {
    data,
    calcType,
    archiveId,
    plans,
    risks,
    loading,
    unlocking,
    reCalcId,
    unlockError,
    loadError,
    unlocked,
    unlock,
    togglePlan,
    reCalc,
  } = useReportData(recordId);

  const { copied, buildGuide, exportText } = useReportExport();

  if (!Number.isInteger(recordId) || recordId <= 0) {
    return (
      <div className="card">
        <p className="error">
          无效的记录 ID，请从<a href="/history">记录列表</a>进入。
        </p>
      </div>
    );
  }
  if (loading) return <div className="card">读取报告中…</div>;
  if (loadError) {
    return (
      <div className="card">
        <p className="error">{loadError}</p>
        <p className="dim">
          请检查网络后 <Link to={`/history`}>返回记录列表</Link> 重试。
        </p>
      </div>
    );
  }

  const layers: Array<{ layer: number; name: string; ready: boolean; locked: boolean; el?: ReactNode }> = [
    { layer: 1, name: LAYER_NAMES[0], ready: !!data.l1, locked: false, el: data.l1 ? <Layer1 l1={data.l1} /> : undefined },
    { layer: 2, name: LAYER_NAMES[1], ready: !!data.l2, locked: false, el: data.l2 ? <Layer2 l2={data.l2} /> : undefined },
    { layer: 3, name: LAYER_NAMES[2], ready: !!data.l3, locked: false, el: data.l3 ? <Layer3 l3={data.l3} /> : undefined },
    { layer: 4, name: LAYER_NAMES[3], ready: !!data.l4, locked: !unlocked, el: data.l4 ? <Layer4 l4={data.l4} /> : undefined },
    { layer: 5, name: LAYER_NAMES[4], ready: !!data.l5, locked: !unlocked, el: data.l5 ? <Layer5 l5={data.l5} /> : undefined },
    { layer: 6, name: LAYER_NAMES[5], ready: !!data.l6, locked: !unlocked, el: data.l6 ? <Layer6 l6={data.l6} risks={risks} /> : undefined },
    { layer: 7, name: LAYER_NAMES[6], ready: !!data.l7, locked: !unlocked, el: data.l7 ? <Layer7 l7={data.l7} /> : undefined },
    { layer: 8, name: LAYER_NAMES[7], ready: !!data.l8, locked: !unlocked, el: data.l8 ? <Layer8 l8={data.l8} plans={plans} onToggle={togglePlan} /> : undefined },
    { layer: 9, name: LAYER_NAMES[8], ready: !!data.l9, locked: !unlocked, el: data.l9 ? <Layer9 l9={data.l9} /> : undefined },
  ];

  const scrollToLayer = (layer: number) => {
    document.getElementById(`layer-${layer}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onReCalc = async () => {
    reCalc((rid) => navigate('/loading', { state: { recordId: rid } }));
  };

  const plainGuide = buildGuide({
    trueSolarHours: data.l1 ? data.l1.timeCorrection.trueSolarHours : undefined,
    l3: data.l3,
    l5: data.l5,
    l7: data.l7,
    l9: data.l9,
    unlocked,
    risks,
  });

  return (
    <div className="report">
      <div className="card">
        <h2>测算报告</h2>
        <p className="hint">
          九层输出结构（PRD 规格）。基础层免费，深度层（L4-L9）付费解锁
          {unlocked ? '，当前已解锁全量报告。' : '。'}
          <span className={`pill calc-badge ${calcType}`}>
            {calcType === 'quantum' ? '量子展开' : calcType === 'ultimate' ? '终极演算' : '标准测算'}
          </span>
        </p>
        <button type="button" className="ghost export-btn" onClick={() => exportText({ data, unlocked, risks, recordId })}>
          {copied ? '已复制报告 ✓' : '复制报告文本'}
        </button>
        <button type="button" className="ghost export-btn" onClick={() => window.print()}>
          打印 / 保存 PDF
        </button>
        {!unlocked && (
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
            l.el
          )}
          {!l.ready && <p className="dim">该层属于「{MODULE_HINT[l.layer]}」模块，将在后续阶段接入。</p>}
        </div>
      ))}

      <div className="card report-foot">
        <Link to="/">再测一次</Link> · <Link to="/history">查看历史记录</Link>
        {archiveId && (
          <button className="ghost" type="button" onClick={onReCalc} disabled={!!reCalcId}>
            {reCalcId ? '测算中…' : '基于此档案重新测算'}
          </button>
        )}
        <button className="ghost float-right" type="button" onClick={scrollTop}>
          回到顶部 ↑
        </button>
      </div>
    </div>
  );
}
