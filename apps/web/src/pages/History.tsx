import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  calculate,
  cancelOrder,
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
import { SkeletonRows } from '../components/Skeleton';

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
  const [loadMoreError, setLoadMoreError] = useState('');
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  // 请求序号：仅接受最新一次 load 的响应，避免「加载更多」与「刷新/删除」并发互相覆盖
  const loadSeq = useRef(0);
  // 测算防重：同一时间只允许一次测算请求
  const calcRunning = useRef(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const cancelLock = useRef(false);

  const load = async (targetPage: number, isLoadMore = false) => {
    const seq = ++loadSeq.current;
    setLoadError('');
    setLoadMoreError('');
    const [rec, arc, user, st, od] = await Promise.allSettled([
      listRecords(targetPage, PAGE_SIZE),
      listArchives(),
      getMe(),
      getStatsOverview(),
      listOrders(),
    ]);
    if (seq !== loadSeq.current) return;
    if (rec.status === 'fulfilled' && rec.value.code === 200) {
      const d = rec.value.data;
      setRecords((prev) => (targetPage === 1 ? (d.list ?? []) : [...prev, ...(d.list ?? [])]));
      setTotal(d.total ?? 0);
      setPage(targetPage);
    }
    if (arc.status === 'fulfilled' && arc.value.code === 200) setArchives(arc.value.data ?? []);
    if (user.status === 'fulfilled' && user.value.code === 200) setMe(user.value.data);
    if (st.status === 'fulfilled' && st.value.code === 200) setStats(st.value.data);
    if (od.status === 'fulfilled' && od.value.code === 200) setOrders(od.value.data ?? []);
    if (rec.status === 'rejected' || (rec.status === 'fulfilled' && rec.value.code !== 200)) {
      if (isLoadMore) setLoadMoreError('加载更多失败，请稍后重试');
      else setLoadError('数据加载失败，请检查网络后重试');
    }
    setLoading(false);
  };

  useEffect(() => {
    load(1);
  }, []);

  const loadMore = async () => {
    if (loadingMore || records.length >= total) return;
    setLoadingMore(true);
    await load(page + 1, true);
    setLoadingMore(false);
  };

  const ensureGuest = async () => {
    if (!localStorage.getItem('fate_token')) {
      const guest = await guestLogin();
      if (guest.code !== 200) {
        throw new Error(guest.msg || '游客登录失败，请重试');
      }
      setToken(guest.data.token);
    }
  };

  const runCalc = async (archiveId: number) => {
    if (calcRunning.current) return;
    calcRunning.current = true;
    try {
      await ensureGuest();
      const calc = await calculate(archiveId, 'standard');
      if (calc.code !== 200) {
        window.alert(calc.msg || '测算失败，请重试');
        return;
      }
      navigate('/loading', { state: { recordId: calc.data.recordId } });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '测算失败，请重试');
    } finally {
      calcRunning.current = false;
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

  const cancelOne = async (o: OrderRecord) => {
    if (!window.confirm('确定取消该待支付订单？取消后需重新下单才能解锁深度报告。')) return;
    if (cancelLock.current) return;
    cancelLock.current = true;
    setCancellingId(o.id);
    try {
      const res = await cancelOrder(o.id);
      if (res.code !== 200) {
        window.alert(res.msg || '取消失败，请稍后重试');
        return;
      }
      await load(1);
    } catch {
      window.alert('取消失败，请稍后重试');
    } finally {
      cancelLock.current = false;
      setCancellingId(null);
    }
  };

  return (
    <div className="card">
      <h2>我的测算记录</h2>

      <LoginPanel me={me} onLogin={() => load(1)} />

      {stats && <StatsBar stats={stats} />}

      {loading && (
        <div className="skeleton-block">
          <SkeletonRows rows={4} cols={3} />
        </div>
      )}
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
          {loadMoreError && <p className="error">{loadMoreError}</p>}

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
                    <th></th>
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
                      <td>
                        {o.entitlement_status === 'pending' && (
                          <button
                            className="link-btn danger"
                            disabled={cancellingId === o.id}
                            onClick={() => cancelOne(o)}
                          >
                            {cancellingId === o.id ? '取消中…' : '取消订单'}
                          </button>
                        )}
                      </td>
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
