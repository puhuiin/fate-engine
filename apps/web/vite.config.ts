import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 生产构建时向 index.html 注入 CSP meta。
 * dev 模式不注入（Vite HMR 依赖 inline script），保证本地预览不受影响。
 * script-src 严格限定同源，缓解 XSS 外链脚本注入；
 * style-src 允许 unsafe-inline（React 内联 style 属性必需）；
 * connect-src 放行 http(s) 以兼容前后端分离部署。
 */
function cspInject(): Plugin {
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https: http:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta name="viewport"',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="viewport"`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), cspInject()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    allowedHosts: ['.monkeycode-ai.online'],
  },
});
