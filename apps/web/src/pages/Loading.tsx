import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LAYER_SKELETON } from '../layers';

export default function Loading() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { recordId: number } | null;
  const started = useRef(false);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    if (!state || started.current) return;
    started.current = true;
    const total = LAYER_SKELETON.length;
    const interval = setInterval(() => {
      setDoneCount((n) => {
        if (n + 1 >= total) {
          clearInterval(interval);
          setTimeout(() => navigate(`/report/${state.recordId}`, { replace: true }), 600);
        }
        return n + 1;
      });
    }, 420);
    return () => clearInterval(interval);
  }, [navigate, state]);

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
            <div key={item.layer} className={`layer-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
              <span className="layer-no">L{item.layer}</span>
              <span className="layer-name">{item.name}</span>
              <span className="layer-status">{isDone ? '✓' : isActive ? '→' : '…'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
