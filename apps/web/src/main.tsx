import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

/**
 * 预先启用 React Router v7 行为开关，消除 v6 弃用警告并平滑后续升级：
 * - v7_startTransition：路由状态更新包裹于 React.startTransition，降低并发更新阻塞
 * - v7_relativeSplatPath：splat 路由内的相对路径解析与 v7 一致
 */
const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={ROUTER_FUTURE_FLAGS}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
