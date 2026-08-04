import { useEffect, useState } from 'react';
import { phoneLogin, sendSmsCode, setToken, updateProfile, type User } from '../api/client';

/**
 * 登录 / 个人资料编辑面板。
 * 内部管理手机号、验证码、倒计时与昵称编辑状态；登录成功后回调通知父组件刷新数据。
 */
export default function LoginPanel({ me, onLogin }: { me: User | null; onLogin: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [smsMsg, setSmsMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [editNick, setEditNick] = useState(false);
  const [nickDraft, setNickDraft] = useState('');

  useEffect(() => {
    setNickDraft(me?.nickname ?? '');
  }, [me]);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = setInterval(() => setSmsCooldown((n) => n - 1), 1000);
    return () => clearInterval(timer);
  }, [smsCooldown > 0]);

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
      // 携带当前游客 token，登录成功后把游客数据合并到手机号账号
      const guestToken = localStorage.getItem('fate_token') || undefined;
      const res = await phoneLogin(phone, code, guestToken);
      if (res.code !== 200) {
        setSmsMsg(res.msg || '验证码错误或已过期');
        return;
      }
      setToken(res.data.token);
      const merged = res.data.merged?.records ?? 0;
      setSmsMsg(
        merged > 0
          ? `登录成功，已将 ${merged} 条游客测算记录合并到该账号`
          : '登录成功，当前展示该账号的记录',
      );
      onLogin();
    } catch {
      setSmsMsg('验证码错误或已过期');
    } finally {
      setBusy(false);
    }
  };

  const saveNickname = async () => {
    const nickname = nickDraft.trim();
    if (!nickname || nickname.length > 30) {
      setSmsMsg('昵称需为 1-30 个字符');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ nickname });
      setSmsMsg('昵称已更新');
      setEditNick(false);
      onLogin();
    } catch {
      setSmsMsg('昵称更新失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-box">
      {me?.phone_masked ? (
        <p className="hint">
          已登录：
          {editNick ? (
            <>
              <input
                className="nick-input"
                maxLength={30}
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                placeholder="昵称"
              />
              <button className="link-btn" disabled={busy} onClick={saveNickname}>
                保存
              </button>
              <button className="link-btn" onClick={() => setEditNick(false)}>
                取消
              </button>
            </>
          ) : (
            <>
              {me.nickname}（{me.phone_masked}）
              <button className="link-btn" onClick={() => setEditNick(true)}>
                改昵称
              </button>
            </>
          )}
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
  );
}
