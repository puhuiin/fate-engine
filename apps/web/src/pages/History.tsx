import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  calculate,
  deleteArchive,
  deleteRecord,
  getMe,
  guestLogin,
  listArchives,
  listRecords,
  phoneLogin,
  sendSmsCode,
  setToken,
  type Archive,
} from '../api/client';

interface RecordRow {
  id: number;
  archive_id: number;
  solar_date: string;
  solar_time: string | null;
  city_name: string | null;
  paid_status: number;
}

export default function History() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [me, setMe] = useState<{ phone_masked: string | null; nickname: string } | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [smsMsg, setSmsMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');

  const PAGE_SIZE = 20;

  const load = async (targetPage: number) => {
    setLoadError('');
    const [rec, arc, user] = await Promise.allSettled([
      listRecords(targetPage, PAGE_SIZE),
      listArchives(),
      getMe(),
    ]);
    if (rec.status === 'fulfilled') {
      const d = rec.value.data as unknown as { list?: RecordRow[]; total?: number };
      setRecords((prev) =>
        targetPage === 1 ? (d.list ?? []) : [...prev, ...(d.list ?? [])],
      );
      setTotal(d.total ?? 0);
      setPage(targetPage);
    }
    if (arc.status === 'fulfilled') setArchives(arc.value.data as Archive[]);
    if (user.status === 'fulfilled') setMe(user.value.data);
    if (rec.status === 'rejected' && arc.status === 'rejected') {
      setLoadError('数据加载失败，请检查网络后重试');
    }
    setLoading(false);
  };

  useEffect(() => {
    load(1);
  }, []);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = setInterval(() => setSmsCooldown((n) => n - 1), 1000);
    return () => clearInterval(timer);
  }, [smsCooldown > 0]);

  const loadMore = async () => {
    if (loadingMore || records.length >= total) return;
    setLoadingMore(true);
    try {
      await load(page + 1);
    } catch {
      setSmsMsg('加载更多失败，请稍后重试');
    } finally {
      setLoadingMore(false);
    }
  };

  const sendCode = async () => {
    setSmsMsg('');
    if (!/^1\d{10}$/.test(phone)) {
      setSmsMsg('手机号格式不正确');
      return;
    }
    setBusy(true);
    try {
      const res = await sendSmsCode(phone);
      if (res.code === 200) {
        setSmsMsg(res.data?.devCode ? `验证码已发送（开发模式：${res.data.devCode}）` : '验证码已发送');
        setSmsCooldown(60);
      } else {
        setSmsMsg(res.msg || '发送失败，请稍后重试');
      }
    } catch {
      setSmsMsg('发送失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    if (!/^1\d{10}$/.test(phone) || !code) {
      setSmsMsg('请填写手机号与验证码');
      return;
    }
    setBusy(true);
    try {
      const res = await phoneLogin(phone, code);
      if (res.code !== 200) {
        setSmsMsg(res.msg || '验证码错误或已过期');
        return;
      }
      setToken(res.data.token);
      setSmsMsg('登录成功，当前展示该账号的记录（游客数据不会自动迁移）');
      await load(1);
    } catch {
      setSmsMsg('验证码错误或已过期');
    } finally {
      setBusy(false);
    }
  };

  const ensureGuest = async () => {
    if (!localStorage.getItem('fate_token')) {
      const guest = await guestLogin();
      setToken(guest.data.token);
    }
  };

  const runCalc = async (archiveId: number) => {
    setBusy(true);
    try {
      await ensureGuest();
      const calc = await calculate(archiveId, 'standard');
      navigate('/loading', { state: { recordId: calc.data.recordId } });
    } catch {
      setSmsMsg('测算失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const removeArchive = async (a: Archive) => {
    if (!window.confirm(`确定删除档案「${a.solar_date}${a.solar_time ? ` ${a.solar_time.slice(0, 5)}` : ''}」？其测算记录与方案将一并清除。`)) return;
    try {
      await deleteArchive(a.id);
      await load(1);
    } catch {
      setSmsMsg('删除档案失败，请稍后重试');
    }
  };

  const removeRecord = async (r: RecordRow) => {
    if (!window.confirm('确定删除这条测算记录？其改运方案与订单将一并清除。')) return;
    try {
      await deleteRecord(r.id);
      await load(1);
    } catch {
      setSmsMsg('删除记录失败，请稍后重试');
    }
  };

  return (
    <div className="card">
      <h2>我的测算记录</h2>

      <div className="login-box">
        {me?.phone_masked ? (
          <p className="hint">
            已登录：{me.nickname}（{me.phone_masked}）
          </p>
        ) : (
          <div className="login-form">
            <p className="hint">游客数据保存在本设备，用手机号登录后可在其他设备同步记录。</p>
            <div className="login-row">
              <input
                type="tel"
                maxLength={11}
                placeholder="手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <button className="ghost" disabled={busy || smsCooldown > 0} onClick={sendCode}>
                {smsCooldown > 0 ? `${smsCooldown}s 后可重发` : '发送验证码'}
              </button>
            </div>
            <div className="login-row">
              <input
                type="text"
                maxLength={6}
                placeholder="验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="primary" disabled={busy} onClick={login}>
                登录
              </button>
            </div>
            {smsMsg && <p className="hint">{smsMsg}</p>}
          </div>
        )}
      </div>

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
          {archives.length === 0 && <p className="dim">还没有出生档案，去首页录入第一份吧。</p>}
          {archives.length > 0 && (
            <table className="kv">
              <tbody>
                {archives.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.solar_date}
                      {a.solar_time ? ` ${a.solar_time.slice(0, 5)}` : ''}
                    </td>
                    <td>{a.city_name ?? '-'}</td>
                    <td>{a.time_precision === 'minute' ? '分钟' : a.time_precision === 'hour' ? '时辰' : a.time_precision === 'day' ? '日期' : '模糊'}</td>
                    <td>
                      <button className="link-btn" onClick={() => runCalc(a.id)}>
                        测算
                      </button>
                      <Link to={`/edit/${a.id}`} className="link-btn">
                        编辑
                      </Link>
                      <button className="link-btn danger" onClick={() => removeArchive(a)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>测算历史</h3>
          {records.length === 0 && <p className="dim">还没有测算记录，去首页开始第一次测算吧。</p>}
          {records.length > 0 && (
            <table className="kv">
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.solar_date}
                      {r.solar_time ? ` ${r.solar_time.slice(0, 5)}` : ''}
                    </td>
                    <td>{r.city_name ?? '-'}</td>
                    <td>
                      <span className={`paid-tag ${r.paid_status === 1 ? 'pro' : 'free'}`}>
                        {r.paid_status === 1 ? '深度版' : '基础版'}
                      </span>
                    </td>
                    <td>
                      <Link to={`/report/${r.id}`} className="link-btn">
                        查看报告
                      </Link>
                      <button className="link-btn danger" onClick={() => removeRecord(r)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > records.length && (
            <div className="pager">
              <button className="ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? '加载中…' : `加载更多（${records.length}/${total}）`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
