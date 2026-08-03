import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Link } from 'react-router-dom';
import Input from './pages/Input';
import Loading from './pages/Loading';
import Report from './pages/Report';
import History from './pages/History';
import { getMe } from './api/client';

export default function App() {
  const [user, setUser] = useState<{ phone_masked: string | null; nickname: string } | null>(null);

  useEffect(() => {
    if (localStorage.getItem('fate_token')) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => setUser(null));
    }
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
        <Routes>
          <Route path="/" element={<Input />} />
          <Route path="/edit/:id" element={<Input />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  );
}
