import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  calculate,
  deleteArchive,
  deleteRecord,
  getMe,
  getStatsOverview,
  guestLogin,
  listArchives,
  listOrders,
  listRecords,
  setToken,
  type Archive,
  type OrderRecord,
  type StatsOverview,
  type User,
} from '../api/client';
import LoginPanel from '../components/LoginPanel';
import StatsBar from '../components/StatsBar';
import ArchivesTable from '../components/ArchivesTable';
import RecordsTable, { type RecordRow } from '../components/RecordsTable';

const PAGE_SIZE = 20;

export default function History() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  const load = async (targetPage: number) => {
    setLoadError('');
    const [rec, arc, user, st, od] = await Promise.allSettled([
      listRecords(targetPage, PAGE_SIZE),
      listArchives(),
      getMe(),
      getStatsOverview(),
      listOrders(),
    ]);
    if (rec.status === 'fulfilled') {
      const d = rec.value.data as unknown as { list?: RecordRow[]; total?: number };
      setRecords((prev) => (targetPage === 1 ? (d.list ?? []) : [...prev, ...(d.list ?? [])]));
      setTotal(d.total ?? 0);
      setPage(targetPage);
    }
    if (arc.status === 'fulfilled') setArchives(arc.value.data as Archive[]);
    if (user.status === 'fulfilled') setMe(user.value.data);
    if (st.status === 'fulfilled') setStats(st.value.data);
    if (od.status === 'fulfilled') setOrders(od.value.data);
    if (rec.status === 'rejected' && arc.status === 'rejected') {
      setLoadError('数据加载失败，请检查网络后重试');
    }
    setLoading(false);
  };

  useEffect(() => {
    load(1);
  }, []);

  const loadMore = async () => {
    if (loadingMore || records.length >= total) return;
    setLoadingMore(true);
    try {
      await load(page + 1);
    } catch {
      setLoadError('加载更多失败，请稍后重试');
    } finally {
      setLoadingMore(false);
    }
  };

  const ensureGuest = async () => {
    if (!localStorage.getItem('fate_token')) {
      const guest = await guestLogin();
      setToken(guest.data.token);
    }
  };

  const runCalc = async (archiveId: number) => {
    try {
      await ensureGuest();
      const calc = await calculate(archiveId, 'standard');
      navigate('/loading', { state: { recordId: calc.data.recordId } });
    } catch {
      window.alert('测算失败，请重试');
    }
  };

  const removeArchive = async (a: Archive) => {
    if (
      !window.confirm(
        `确定删除档案「${a.solar_date}${a.solar_time ? ` ${a.solar_time.slice(0, 5)}` : ''}」？其测算记录与方案将一并清除。`,
      )
    )
      return;
    try {
      await deleteArchive(a.id);
      await load(1);
    } catch {
      window.alert('删除档案失败，请稍后重试');
    }
  };

  const removeRecord = async (r: RecordRow) => {
    if (!window.confirm('确定删除这条测算记录？其改运方案与订单将一并清除。')) return;
    try {
      await deleteRecord(r.id);
      await load(1);
    } catch {
      window.alert('删除记录失败，请稍后重试');
    }
  };

  return (
    <div className="card">
      <h2>我的测算记录</h2>

      <LoginPanel me={me} onLogin={() => load(1)} />

      {stats && <StatsBar stats={stats} />}

      {loading && <p className="dim">记录加载中…</p>}
      {!loading && loadError && (
        <p className="error">
          {loadError}{' '}
          <button
            className="link-btn"
            onClick={() => {
              setLoading(true);
              load(1);
            }}
          >
            重试
          </button>
        </p>
      )}

      {!loading && !loadError && (
        <>
          <h3>我的档案</h3>
          <ArchivesTable archives={archives} onCalc={runCalc} onDelete={removeArchive} />

          <h3>测算历史</h3>
          <RecordsTable records={records} onDelete={removeRecord} />
          {total > records.length && (
            <div className="pager">
              <button className="ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '加载中…' : `加载更多（${records.length}/${total}）`}
              </button>
            </div>
          )}

          {orders.length > 0 && (
            <>
              <h3>我的订单</h3>
              <table className="kv">
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>金额</th>
                    <th>状态</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="mono">{o.order_no}</td>
                      <td>¥{(o.amount_cents / 100).toFixed(2)}</td>
                      <td>
                        <span className={`pill order-status ${o.entitlement_status}`}>
                          {o.entitlement_status === 'granted'
                            ? '已解锁'
                            : o.entitlement_status === 'expired'
                              ? '已过期'
                              : '待支付'}
                        </span>
                      </td>
                      <td className="dim">{o.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
