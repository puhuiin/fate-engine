// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import History from '../pages/History';

const api = vi.hoisted(() => ({
  calculate: vi.fn(),
  cancelOrder: vi.fn(),
  deleteArchive: vi.fn(),
  deleteRecord: vi.fn(),
  getMe: vi.fn(),
  getStatsOverview: vi.fn(),
  guestLogin: vi.fn(),
  listArchives: vi.fn(),
  listOrders: vi.fn(),
  listRecords: vi.fn(),
  setToken: vi.fn(),
}));

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  calculate: api.calculate,
  cancelOrder: api.cancelOrder,
  deleteArchive: api.deleteArchive,
  deleteRecord: api.deleteRecord,
  getMe: api.getMe,
  getStatsOverview: api.getStatsOverview,
  guestLogin: api.guestLogin,
  listArchives: api.listArchives,
  listOrders: api.listOrders,
  listRecords: api.listRecords,
  setToken: api.setToken,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => navigateMock };
});

vi.mock('../components/LoginPanel', () => ({
  default: ({ me }: { me: { phone_masked: string | null; nickname: string } | null }) => (
    <div data-testid="login-panel">{me?.phone_masked ?? '游客模式'}</div>
  ),
}));
vi.mock('../components/StatsBar', () => ({ default: () => null }));
vi.mock('../components/Skeleton', () => ({ SkeletonRows: () => null }));
vi.mock('../components/ArchivesTable', () => ({
  default: ({
    archives,
    onCalc,
    onDelete,
  }: {
    archives: Array<{ id: number; solar_date: string }>;
    onCalc: (id: number) => void;
    onDelete: (a: { id: number }) => void;
  }) => (
    <div>
      {archives.map((a) => (
        <div key={a.id} data-testid={`archive-${a.id}`}>
          <span>{a.solar_date}</span>
          <button data-testid={`calc-${a.id}`} onClick={() => onCalc(a.id)}>
            测算
          </button>
          <button data-testid={`del-archive-${a.id}`} onClick={() => onDelete(a)}>
            删除档案
          </button>
        </div>
      ))}
    </div>
  ),
}));
vi.mock('../components/RecordsTable', () => ({
  default: ({
    records,
    onDelete,
  }: {
    records: Array<{ id: number; calc_type: string; created_at: string }>;
    onDelete: (r: { id: number }) => void;
  }) => (
    <div>
      {records.map((r) => (
        <div key={r.id} data-testid={`record-${r.id}`}>
          <span data-testid={`record-title-${r.id}`}>{`记录${r.id}`}</span>
          <button data-testid={`del-record-${r.id}`} onClick={() => onDelete(r)}>
            删除
          </button>
        </div>
      ))}
    </div>
  ),
}));

const ok = (data: unknown) => ({ code: 200, msg: '', data, timestamp: 0, sign: '' });

const rec1 = {
  id: 1,
  archive_id: 1,
  calc_type: 'standard',
  status: 'completed',
  created_at: '2026-01-01 00:00:00',
};
const rec2 = {
  id: 2,
  archive_id: 1,
  calc_type: 'standard',
  status: 'completed',
  created_at: '2026-01-02 00:00:00',
};

function seed({ total = 1, extra = [] }: { total?: number; extra?: (typeof rec1)[] } = {}) {
  api.listRecords.mockResolvedValue(ok({ list: [rec1, ...extra], total }));
  api.listArchives.mockResolvedValue(ok([{ id: 7, solar_date: '2002-11-29' }]));
  api.getMe.mockResolvedValue(ok({ phone_masked: '138****0000', nickname: '甲' }));
  api.getStatsOverview.mockResolvedValue(
    ok({ archivesCount: 1, totalRecords: total, totalPlans: 0 }),
  );
  api.listOrders.mockResolvedValue(ok([]));
}

beforeEach(() => {
  vi.clearAllMocks();
  seed();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('History 页面', () => {
  it('初始加载聚合五路接口并渲染记录/档案/登录态', async () => {
    render(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('record-title-1')).toHaveTextContent('记录1'));
    expect(api.listRecords).toHaveBeenCalledWith(1, 20);
    expect(api.listArchives).toHaveBeenCalledTimes(1);
    expect(api.getMe).toHaveBeenCalledTimes(1);
    expect(api.getStatsOverview).toHaveBeenCalledTimes(1);
    expect(api.listOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('archive-7')).toBeInTheDocument();
    expect(screen.getByTestId('login-panel')).toHaveTextContent('138****0000');
  });

  it('记录超出单页时显示加载更多，点击追加下一页', async () => {
    seed({ total: 3 });
    render(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('record-title-1')).toBeInTheDocument());
    expect(screen.queryByTestId('record-title-2')).not.toBeInTheDocument();
    const more = screen.getByText('加载更多（1/3）');
    api.listRecords.mockResolvedValue(ok({ list: [rec2], total: 3 }));
    await act(async () => {
      fireEvent.click(more);
    });
    await waitFor(() => expect(screen.getByTestId('record-title-2')).toBeInTheDocument());
    expect(api.listRecords).toHaveBeenLastCalledWith(2, 20);
  });

  it('确认后删除记录并重新加载', async () => {
    render(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('del-record-1')).toBeInTheDocument());
    api.deleteRecord.mockResolvedValue(ok({ deleted: true }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('del-record-1'));
    });
    expect(window.confirm).toHaveBeenCalled();
    expect(api.deleteRecord).toHaveBeenCalledWith(1);
    await waitFor(() => expect(api.listRecords).toHaveBeenCalledTimes(2));
  });

  it('取消订单经确认后调用接口并重新加载', async () => {
    api.listOrders.mockResolvedValue(
      ok([
        {
          id: 9,
          order_no: 'O2026010100001',
          amount_cents: 9900,
          entitlement_status: 'pending',
          created_at: '2026-01-01 00:00:00',
        },
      ]),
    );
    render(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('O2026010100001')).toBeInTheDocument());
    api.cancelOrder.mockResolvedValue(ok({ cancelled: true }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '取消订单' }));
    });
    expect(api.cancelOrder).toHaveBeenCalledWith(9);
    await waitFor(() => expect(api.listOrders).toHaveBeenCalledTimes(2));
  });

  it('订单取消进行中连点仅触发一次接口（防重）', async () => {
    api.listOrders.mockResolvedValue(
      ok([
        {
          id: 9,
          order_no: 'O2026010100001',
          amount_cents: 9900,
          entitlement_status: 'pending',
          created_at: '2026-01-01 00:00:00',
        },
      ]),
    );
    render(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '取消订单' })).toBeInTheDocument(),
    );
    api.cancelOrder.mockImplementation(() => new Promise(() => {}));
    const btn = screen.getByRole('button', { name: '取消订单' });
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(api.cancelOrder).toHaveBeenCalledTimes(1);
  });

  it('游客点击测算自动登录后跳转计算', async () => {
    localStorage.removeItem('fate_token');
    api.guestLogin.mockResolvedValue(ok({ token: 'guest-token-1' }));
    api.calculate.mockResolvedValue(ok({ recordId: 42, paidStatus: 0 }));
    render(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('calc-7')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTestId('calc-7'));
    });
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/loading', { state: { recordId: 42 } }),
    );
    expect(api.guestLogin).toHaveBeenCalled();
  });
});
