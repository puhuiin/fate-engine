import { Suspense, lazy, useEffect, useState } from 'react';
import { NavLink, Route, Routes, Link } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AUTH_CHANGED_EVENT, TOAST_EVENT, getMe } from './api/client';

/** 路由级代码分割：首屏只加载 Input，报告/历史等页面按需进入时再拉取 */
const Input = lazy(() => import('./pages/Input'));
const Loading = lazy(() => import('./pages/Loading'));
const Report = lazy(() => import('./pages/Report'));
const History = lazy(() => import('./pages/History'));

function RouteFallback() {
  return (
    <div className="card route-loading">
      <p className="dim">页面加载中…</p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<{ phone_masked: string | null; nickname: string } | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const refresh = () => {
      if (!localStorage.getItem('fate_token')) {
        setUser(null);
        return;
      }
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => setUser(null));
    };
    refresh();
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
  }, []);

  // 全局 toast：api 层 401 等全局性消息经 TOAST_EVENT 通知，非阻塞展示后自动消失
  useEffect(() => {
    let timer: number | undefined;
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      if (!msg) return;
      setToast(msg);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(''), 3200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          全域超验 · 命运演算
        </Link>
        <nav className="nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
            测算
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
            我的记录
          </NavLink>
        </nav>
        <span className="user-chip">
          {user?.phone_masked ? user.phone_masked : user?.nickname ? user.nickname : '游客模式'}
        </span>
      </header>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <main className="content">
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Input />} />
              <Route path="/edit/:id" element={<Input />} />
              <Route path="/loading" element={<Loading />} />
              <Route path="/report/:id" element={<Report />} />
              <Route path="/history" element={<History />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
