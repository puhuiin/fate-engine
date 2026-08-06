import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LAYER_SKELETON } from '../layers';

export default function Loading() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { recordId: number } | null;
  const [doneCount, setDoneCount] = useState(0);

  const skip = () => {
    if (state) navigate(`/report/${state.recordId}`, { replace: true });
    else navigate('/');
  };

  useEffect(() => {
    if (!state) return;
    const total = LAYER_SKELETON.length;
    const interval = setInterval(() => {
      // updater 保持纯函数：只做数值推进，不在此调度导航/清理定时器
      setDoneCount((n) => (n >= total ? n : n + 1));
    }, 220);
    return () => clearInterval(interval);
  }, [state]);

  // 动画贯通后延迟跳转：独立 effect 持有导航定时器，cleanup 清理，
  // 组件卸载或依赖变化时不会残留一个「跳转到报告页」的悬挂定时器。
  useEffect(() => {
    if (!state || doneCount < LAYER_SKELETON.length) return;
    const t = setTimeout(() => navigate(`/report/${state.recordId}`, { replace: true }), 300);
    return () => clearTimeout(t);
  }, [doneCount, state, navigate]);

  if (!state) {
    return (
      <div className="card">
        <p>缺少测算数据，请返回重新测算。</p>
        <p className="dim">
          <Link to="/">返回首页</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card loading-card">
      <div className="orb" />
      <h2>全域演算中</h2>
      <p className="hint">
        {doneCount < LAYER_SKELETON.length && LAYER_SKELETON[doneCount]
          ? `正在贯通 L${LAYER_SKELETON[doneCount].layer} ${LAYER_SKELETON[doneCount].name}…`
          : '九层算力引擎贯通完毕…'}
      </p>
      <div className="layers">
        {LAYER_SKELETON.map((item) => {
          const isDone = item.layer <= doneCount;
          const isActive = item.layer === doneCount + 1;
          return (
            <div
              key={item.layer}
              className={`layer-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
            >
              <span className="layer-no">L{item.layer}</span>
              <span className="layer-name">{item.name}</span>
              <span className="layer-status">{isDone ? '✓' : isActive ? '→' : '…'}</span>
            </div>
          );
        })}
      </div>
      <button type="button" className="ghost skip-btn" onClick={skip}>
        跳过动画，立即查看报告
      </button>
    </div>
  );
}
