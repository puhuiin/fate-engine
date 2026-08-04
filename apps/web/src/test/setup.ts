// vitest 全局 setup：为组件测试注册 jest-dom 断言，并在每个用例后清理 DOM
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
