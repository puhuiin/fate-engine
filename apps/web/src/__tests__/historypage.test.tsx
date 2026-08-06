// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import History from '../pages/History';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    getMe: vi.fn(),
    listRecords: vi.fn(),
    listArchives: vi.fn(),
    getStatsOverview: vi.fn(),
    listOrders: vi.fn(),
    cancelOrder: vi.fn(),
    deleteRecord: vi.fn(),
    deleteArchive: vi.fn(),
    guestLogin: vi.fn(),
    calculate: vi.fn(),
    setToken: vi.fn(),
  };
});

import {
  cancelOrder,
  deleteRecord,
  getMe,
  getStatsOverview,
  listArchives,
  listOrders,
  listRecords,
} from '../api/client';
import type {
  ApiResp,
  Archive,
  OrderRecord,
  RecordListItem,
  RecordsPage,
  StatsOverview,
  User,
} from '../api/client';

const mocked = {
  cancelOrder: vi.mocked(cancelOrder),
  deleteRecord: vi.mocked(deleteRecord),
  getMe: vi.mocked(getMe),
  getStatsOverview: vi.mocked(getStatsOverview),
  listArchives: vi.mocked(listArchives),
  listOrders: vi.mocked(listOrders),
  listRecords: vi.mocked(listRecords),
};

const ok = <T,>(data: T, code = 200): ApiResp<T> => ({
  code,
  msg: 'ok',
  data,
  timestamp: 0,
  sign: '',
});

const record: RecordListItem = {
  id: 11,
  archive_id: 1,
  calc_type: 'standard',
  status: 'done',
  paid_status: 0,
  created_at: '2026-08-01 10:00',
  solar_date: '1991-03-03',
  solar_time: '12:30',
  city_name: '北京',
};

const archive: Archive = {
  id: 1,
  gender: 'male',
  solar_date: '1990-01-01',
  solar_time: '12:30',
  city_name: '上海',
  province: null,
  longitude: null,
  latitude: null,
  timezone_offset: null,
  time_source: null,
  time_precision: 'minute',
  source_reliability: 'high',
  created_at: '2026-08-01',
};

const order: OrderRecord = {
  id: 101,
  order_no: 'F202608010001',
  amount_cents: 9900,
  entitlement_status: 'pending',
  created_at: '2026-08-01 10:00',
  record_id: 11,
  calc_type: 'standard',
  record_paid_status: 0,
};

const grantedOrder: OrderRecord = {
  ...order,
  id: 102,
  order_no: 'F202608010002',
  entitlement_status: 'granted',
  record_paid_status: 1,
};

const stats: StatsOverview = {
  archivesCount: 1,
  totalRecords: 1,
  paidRecords: 0,
  unlockRate: 0,
  totalPlans: 0,
  donePlans: 0,
  planCompletionRate: 0,
  highRiskCount: 0,
  lastRecordAt: null,
};

const me: User = {
  id: 1,
  phone_masked: null,
  nickname: '游客',
  register_channel: 'guest',
  member_level: 0,
};

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  );
}

/** 页面级集成测试：React Router + 真实组件树 + mock api，验证加载/空态/失败重试/订单取消/分页/删除的完整交互 */
describe('History 页面集成', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('加载成功渲染档案、记录与订单表', async () => {
    mocked.listRecords.mockResolvedValue(
      ok<RecordsPage>({ list: [record], total: 1, page: 1, pageSize: 20 }),
    );
    mocked.listArchives.mockResolvedValue(ok<Archive[]>([archive]));
    mocked.getMe.mockResolvedValue(ok<User | null>(me));
    mocked.getStatsOverview.mockResolvedValue(ok<StatsOverview>(stats));
    mocked.listOrders.mockResolvedValue(ok<OrderRecord[]>([order, grantedOrder]));

    renderHistory();

    expect(await screen.findByText(/1990-01-01/)).toBeInTheDocument();
    expect(screen.getByText('上海')).toBeInTheDocument();
    expect(screen.getByText(/1991-03-03/)).toBeInTheDocument();
    expect(screen.getByText('F202608010001')).toBeInTheDocument();
    expect(screen.getByText('F202608010002')).toBeInTheDocument();
    // 待支付订单显示取消按钮，已解锁订单不显示
    expect(screen.getAllByRole('button', { name: '取消订单' })).toHaveLength(1);
    expect(screen.getByText('待支付')).toBeInTheDocument();
    expect(screen.getByText('已解锁')).toBeInTheDocument();
    expect(screen.getAllByText('¥99.00')).toHaveLength(2);
  });

  it('无数据时展示空态且不渲染订单区块', async () => {
    mocked.listRecords.mockResolvedValue(
      ok<RecordsPage>({ list: [], total: 0, page: 1, pageSize: 20 }),
    );
    mocked.listArchives.mockResolvedValue(ok<Archive[]>([]));
    mocked.getMe.mockResolvedValue(ok<User | null>(null));
    mocked.getStatsOverview.mockResolvedValue(ok<StatsOverview>(stats));
    mocked.listOrders.mockResolvedValue(ok<OrderRecord[]>([]));

    renderHistory();

    expect(await screen.findByText('还没有出生档案，去首页录入第一份吧。')).toBeInTheDocument();
    expect(screen.getByText('还没有测算记录，去首页开始第一次测算吧。')).toBeInTheDocument();
    expect(screen.queryByText('我的订单')).not.toBeInTheDocument();
  });

  it('加载失败展示错误并可点击重试恢复', async () => {
    mocked.listRecords.mockRejectedValueOnce(new Error('network down'));
    mocked.listArchives.mockResolvedValue(ok<Archive[]>([archive]));
    mocked.getMe.mockResolvedValue(ok<User | null>(me));
    mocked.getStatsOverview.mockResolvedValue(ok<StatsOverview>(stats));
    mocked.listOrders.mockResolvedValue(ok<OrderRecord[]>([]));

    renderHistory();

    expect(await screen.findByText('数据加载失败，请检查网络后重试')).toBeInTheDocument();

    mocked.listRecords.mockResolvedValueOnce(
      ok<RecordsPage>({ list: [record], total: 1, page: 1, pageSize: 20 }),
    );
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText(/1990-01-01/)).toBeInTheDocument();
    expect(screen.queryByText('数据加载失败，请检查网络后重试')).not.toBeInTheDocument();
  });

  it('取消订单二次确认后调用接口并刷新', async () => {
    mocked.listRecords.mockResolvedValue(
      ok<RecordsPage>({ list: [record], total: 1, page: 1, pageSize: 20 }),
    );
    mocked.listArchives.mockResolvedValue(ok<Archive[]>([archive]));
    mocked.getMe.mockResolvedValue(ok<User | null>(me));
    mocked.getStatsOverview.mockResolvedValue(ok<StatsOverview>(stats));
    mocked.listOrders.mockResolvedValue(ok<OrderRecord[]>([order]));
    mocked.cancelOrder.mockResolvedValue(ok(order));

    renderHistory();
    const cancelBtn = await screen.findByRole('button', { name: '取消订单' });

    fireEvent.click(cancelBtn);

    await waitFor(() => expect(mocked.cancelOrder).toHaveBeenCalledWith(101));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('确定取消该待支付订单'));
    // 取消成功后重新拉取列表
    await waitFor(() => expect(mocked.listRecords.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('取消订单确认被拒时放弃请求', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mocked.listRecords.mockResolvedValue(
      ok<RecordsPage>({ list: [record], total: 1, page: 1, pageSize: 20 }),
    );
    mocked.listArchives.mockResolvedValue(ok<Archive[]>([archive]));
    mocked.getMe.mockResolvedValue(ok<User | null>(me));
    mocked.getStatsOverview.mockResolvedValue(ok<StatsOverview>(stats));
    mocked.listOrders.mockResolvedValue(ok<OrderRecord[]>([order]));

    renderHistory();
    const cancelBtn = await screen.findByRole('button', { name: '取消订单' });

    fireEvent.click(cancelBtn);

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(mocked.cancelOrder).not.toHaveBeenCalled();
  });

  it('记录分页：加载更多按下一页追加', async () => {
    const page1 = Array.from({ length: 20 }, (_, i) => ({
      ...record,
      id: i + 1,
      solar_date: `1990-02-${String(i + 1).padStart(2, '0')}`,
    }));
    const page2 = [record];
    mocked.listRecords
      .mockResolvedValueOnce(ok<RecordsPage>({ list: page1, total: 21, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(ok<RecordsPage>({ list: page2, total: 21, page: 2, pageSize: 20 }));
    mocked.listArchives.mockResolvedValue(ok<Archive[]>([archive]));
    mocked.getMe.mockResolvedValue(ok<User | null>(me));
    mocked.getStatsOverview.mockResolvedValue(ok<StatsOverview>(stats));
    mocked.listOrders.mockResolvedValue(ok<OrderRecord[]>([]));

    renderHistory();

    const loadMoreBtn = await screen.findByRole('button', { name: /加载更多（20\/21）/ });
    fireEvent.click(loadMoreBtn);

    await waitFor(() => expect(mocked.listRecords).toHaveBeenCalledWith(2, 20));
    // 第二页记录（1991-03-03）出现，且加载更多按钮消失（20+1=21 已达总量）
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /加载更多/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/1991-03-03/)).toBeInTheDocument();
  });

  it('删除记录二次确认后调用接口并刷新', async () => {
    mocked.listRecords.mockResolvedValue(
      ok<RecordsPage>({ list: [record], total: 1, page: 1, pageSize: 20 }),
    );
    mocked.listArchives.mockResolvedValue(ok<Archive[]>([archive]));
    mocked.getMe.mockResolvedValue(ok<User | null>(me));
    mocked.getStatsOverview.mockResolvedValue(ok<StatsOverview>(stats));
    mocked.listOrders.mockResolvedValue(ok<OrderRecord[]>([]));
    mocked.deleteRecord.mockResolvedValue(ok({ removed: true }));

    renderHistory();
    // 记录表与档案表都有「删除」按钮，需定位到包含「查看报告」链接的记录行
    const recordRow = (await screen.findByText(/1991-03-03/)).closest('tr')!;
    const delBtn = within(recordRow).getByRole('button', { name: '删除' });

    fireEvent.click(delBtn);

    await waitFor(() => expect(mocked.deleteRecord).toHaveBeenCalledWith(11));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('确定删除这条测算记录'));
    await waitFor(() => expect(mocked.listRecords.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
