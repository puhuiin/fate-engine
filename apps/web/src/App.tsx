import { Suspense, lazy, useEffect, useState } from 'react';
import { NavLink, Route, Routes, Link } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AUTH_CHANGED_EVENT, getMe } from './api/client';

const Input = lazy(() => import('./pages/Input'));
const Loading = lazy(() => import('./pages/Loading'));
const Report = lazy(() => import('./pages/Report'));
const History = lazy(() => import('./pages/History'));

export default function App() {
  const [user, setUser] = useState<{ phone_masked: string | null; nickname: string } | null>(null);

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
      <main className="content">
        <ErrorBoundary>
          <Suspense fallback={<div className="card">加载中…</div>}>
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
