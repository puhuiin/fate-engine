// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Report from '../pages/Report';
import { useReportData, type ReportDataState } from '../hooks/useReportData';
import { useReportExport } from '../hooks/useReportExport';
import type { PlanItem, RiskItem } from '../api/client';

vi.mock('../hooks/useReportData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useReportData')>();
  return { ...actual, useReportData: vi.fn() };
});

vi.mock('../hooks/useReportExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useReportExport')>();
  return { ...actual, useReportExport: vi.fn() };
});

vi.mock('../pages/report/layers', () => ({
  Layer1: () => <div data-testid="layer-c1" />,
  Layer2: () => <div data-testid="layer-c2" />,
  Layer3: () => <div data-testid="layer-c3" />,
  Layer4: () => <div data-testid="layer-c4" />,
  Layer5: () => <div data-testid="layer-c5" />,
  Layer6: () => <div data-testid="layer-c6" />,
  Layer7: () => <div data-testid="layer-c7" />,
  Layer8: () => <div data-testid="layer-c8" />,
  Layer9: () => <div data-testid="layer-c9" />,
}));

const mockedData = vi.mocked(useReportData);
const mockedExport = vi.mocked(useReportExport);

const emptyData: ReportDataState = {
  l1: null,
  l2: null,
  l3: null,
  l4: null,
  l5: null,
  l6: null,
  l7: null,
  l8: null,
  l9: null,
};

const plan: PlanItem = {
  id: 1,
  level: 1,
  title: '晨间调息',
  content: '每日清晨静坐 10 分钟',
  exec_cycle: 'daily',
  status: 'pending',
  finished_at: null,
};

const risk: RiskItem = {
  id: 1,
  record_id: 5,
  year: '2026',
  trigger_condition: '连续熬夜超过两天',
  mitigation: '提前规划睡眠时间',
  risk_level: 2,
};

function reportState(over: Partial<ReturnType<typeof useReportData>> = {}) {
  return {
    data: emptyData,
    paidStatus: 0,
    calcType: 'standard',
    archiveId: 5,
    plans: [plan],
    risks: [risk],
    loading: false,
    unlocking: false,
    reCalcId: null,
    unlockError: '',
    loadError: '',
    unlocked: false,
    unlock: vi.fn(),
    togglePlan: vi.fn(),
    reCalc: vi.fn(),
    ...over,
  };
}

function renderReport(path = '/report/5') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/report/:id" element={<Report />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 报告页集成测试：mock 数据 hook 与层组件，验证解锁横幅/渠道选择/锁定层/导出/重测的页面编排 */
describe('Report 页面集成', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedData.mockReturnValue(reportState());
    mockedExport.mockReturnValue({
      copied: false,
      buildGuide: vi.fn(() => []),
      exportText: vi.fn(),
    });
  });

  it('加载中展示骨架屏', () => {
    mockedData.mockReturnValue(reportState({ loading: true }));
    renderReport();
    // 加载态直接返回骨架屏，不渲染报告主体
    expect(screen.queryByText(/深度报告解锁 ¥99/)).not.toBeInTheDocument();
    expect(screen.queryByText(/深度测算层已锁定/)).not.toBeInTheDocument();
  });

  it('加载失败展示错误与返回入口', () => {
    mockedData.mockReturnValue(reportState({ loadError: '记录不存在或无权访问', archiveId: null }));
    renderReport();
    expect(screen.getByText('记录不存在或无权访问')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回记录列表' })).toBeInTheDocument();
  });

  it('无效记录 ID 提示重新进入', () => {
    renderReport('/report/abc');
    expect(screen.getByText(/无效的记录 ID/)).toBeInTheDocument();
  });

  it('未解锁：展示解锁横幅与渠道选择，锁定 L4-L9', () => {
    renderReport();
    expect(screen.getByText(/深度报告解锁 ¥99/)).toBeInTheDocument();
    // 渠道选择器仅在解锁横幅中出现（锁定层不再重复渲染支付 UI）
    expect(screen.getAllByLabelText('支付渠道').length).toBe(1);
    expect(screen.getAllByRole('radio', { name: '微信支付' })[0]).toBeChecked();
    // 九层导航中 L4-L9 带锁定标记
    expect(screen.getAllByText(/🔒/).length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText(/深度测算层已锁定/).length).toBeGreaterThanOrEqual(6);
    // 锁定层仍保留独立解锁按钮（复用当前渠道）
    expect(screen.getAllByRole('button', { name: '解锁该层' }).length).toBeGreaterThanOrEqual(6);
  });

  it('选择渠道后点击立即解锁，以所选渠道调用 unlock', () => {
    const unlock = vi.fn();
    mockedData.mockReturnValue(reportState({ unlock }));
    renderReport();
    fireEvent.click(screen.getAllByRole('radio', { name: '支付宝' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '立即解锁' }));
    expect(unlock).toHaveBeenCalledWith('alipay');
  });

  it('解锁中禁用按钮并展示处理中文案', () => {
    mockedData.mockReturnValue(reportState({ unlocking: true }));
    renderReport();
    expect(screen.getByRole('button', { name: '支付处理中…' })).toBeDisabled();
  });

  it('解锁失败展示错误文案', () => {
    mockedData.mockReturnValue(reportState({ unlockError: '支付失败，请稍后重试' }));
    renderReport();
    // 错误仅在解锁横幅中展示，锁定层不再重复
    expect(screen.getAllByText('支付失败，请稍后重试').length).toBe(1);
  });

  it('已解锁：隐藏解锁横幅且锁定层解除', () => {
    mockedData.mockReturnValue(reportState({ unlocked: true, paidStatus: 1 }));
    renderReport();
    expect(screen.queryByText(/深度报告解锁 ¥99/)).not.toBeInTheDocument();
    expect(screen.queryByText(/深度测算层已锁定/)).not.toBeInTheDocument();
    expect(screen.getByText(/已解锁全量报告/)).toBeInTheDocument();
  });

  it('复制报告文本调用 exportText', async () => {
    const exportText = vi.fn().mockResolvedValue(undefined);
    mockedExport.mockReturnValue({
      copied: false,
      buildGuide: vi.fn(() => []),
      exportText,
    });
    renderReport();
    fireEvent.click(screen.getByRole('button', { name: '复制报告文本' }));
    expect(exportText).toHaveBeenCalledTimes(1);
  });

  it('基于档案重新测算触发 reCalc', () => {
    const reCalc = vi.fn();
    mockedData.mockReturnValue(reportState({ reCalc, reCalcId: null }));
    renderReport();
    fireEvent.click(screen.getByRole('button', { name: '基于此档案重新测算' }));
    expect(reCalc).toHaveBeenCalledTimes(1);
  });

  it('重新测算中按钮置灰', () => {
    mockedData.mockReturnValue(reportState({ reCalcId: 5 }));
    renderReport();
    expect(screen.getByRole('button', { name: '测算中…' })).toBeDisabled();
  });
});
