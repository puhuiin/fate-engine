import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  calculate,
  createArchive,
  getArchive,
  guestLogin,
  searchCities,
  setToken,
  updateArchive,
  type City,
} from '../api/client';

const PRECISIONS = [
  { value: 'minute', label: '精确到分钟' },
  { value: 'hour', label: '只知道时辰' },
  { value: 'day', label: '只知道日期' },
  { value: 'fuzzy', label: '日期也不确定' },
];

const SOURCES = [
  { value: 'certificate', label: '出生证明/医院记录' },
  { value: 'family', label: '家人记忆' },
  { value: 'estimate', label: '估摸的' },
  { value: 'unknown', label: '不清楚来源' },
];

const GENDERS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他/保密' },
];

const CALC_TYPES = [
  {
    value: 'standard',
    label: '标准测算',
    desc: '九层全量报告 + 3 个关键分叉点',
  },
  {
    value: 'quantum',
    label: '量子展开',
    desc: '分叉点展开至 5 个，附各行运窗口',
  },
  {
    value: 'ultimate',
    label: '终极演算',
    desc: '全生命周期分叉点 + 完整行运窗口',
  },
];

const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);

export default function Input() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const editId = id ? Number(id) : null;
  const [solarDate, setSolarDate] = useState('');
  const [solarTime, setSolarTime] = useState('');
  const [precision, setPrecision] = useState('minute');
  const [source, setSource] = useState('unknown');
  const [gender, setGender] = useState('male');
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<City | null>(null);
  const [calcType, setCalcType] = useState('standard');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const timeVisible = precision === 'minute' || precision === 'hour';

  useEffect(() => {
    if (!editId) return;
    let alive = true;
    setEditing(true);
    getArchive(editId)
      .then((res) => {
        if (!alive) return;
        const a = res.data;
        setSolarDate(a.solar_date);
        setSolarTime(a.solar_time ? a.solar_time.slice(0, 5) : '');
        setPrecision(a.time_precision ?? 'minute');
        setSource(a.source_reliability ?? 'unknown');
        setGender(a.gender ?? 'male');
        if (a.city_name) {
          setCity({
            name: a.city_name,
            province: a.province ?? '',
            longitude: a.longitude ?? 0,
            latitude: a.latitude ?? 0,
            timezoneOffset: a.timezone_offset ?? 8,
          });
        }
      })
      .catch(() => setError('加载档案失败，请返回重试'))
      .finally(() => alive && setEditing(false));
    return () => {
      alive = false;
    };
  }, [editId]);

  useEffect(() => {
    const q = cityQuery.trim();
    if (!q || city) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await searchCities(q);
        if (!cancelled && res.code === 200) setCities(res.data);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityQuery, city]);

  async function submit() {
    setError('');
    if (!solarDate) {
      setError('请填写出生日期');
      return;
    }
    if (timeVisible && !solarTime) {
      setError('请填写出生时间');
      return;
    }
    if (cityQuery.trim() && !city) {
      setError('请从下拉列表选择城市；如不确定可清空出生城市输入框');
      return;
    }
    setBusy(true);
    try {
      if (!localStorage.getItem('fate_token')) {
        const guest = await guestLogin();
        if (guest.code !== 200) {
          throw new Error(guest.msg || '游客登录失败，请重试');
        }
        setToken(guest.data.token);
      }
      const payload = {
        gender,
        solarDate,
        solarTime: timeVisible ? solarTime : undefined,
        timePrecision: precision,
        sourceReliability: source,
        cityName: city?.name,
        longitude: city?.longitude,
        latitude: city?.latitude,
      };
      const res = editId ? await updateArchive(editId, payload) : await createArchive(payload);
      if (res.code !== 200) {
        setError(res.msg || '保存档案失败，请重试');
        return;
      }
      const calc = await calculate(res.data.id, calcType);
      if (calc.code !== 200) {
        setError(calc.msg || '测算失败，请重试');
        return;
      }
      navigate('/loading', { state: { recordId: calc.data.recordId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '测算失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="card input-card"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2>{editId ? '编辑生辰信息' : '录入生辰信息'}</h2>
      <p className="hint">
        {editId
          ? '修改后将重新测算并生成新的报告，原记录保留可回溯。'
          : '用于时空校正层（L1）的真太阳时与误差评级，你的信息将脱敏存储。'}
      </p>

      <label className="field">
        <span>出生日期（公历）</span>
        <input
          type="date"
          min="1900-01-01"
          max={today}
          autoComplete="bday"
          value={solarDate}
          onChange={(e) => setSolarDate(e.target.value)}
        />
      </label>

      {timeVisible && (
        <label className="field">
          <span>出生时间（钟表时间）</span>
          <input
            type="time"
            autoComplete="off"
            value={solarTime}
            onChange={(e) => setSolarTime(e.target.value)}
          />
        </label>
      )}

      <label className="field">
        <span>时间精确度</span>
        <select value={precision} onChange={(e) => setPrecision(e.target.value)}>
          {PRECISIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>时间来源</span>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>性别</span>
        <div className="radio-row">
          {GENDERS.map((g) => (
            <label key={g.value} className="radio">
              <input
                type="radio"
                name="gender"
                value={g.value}
                checked={gender === g.value}
                onChange={() => setGender(g.value)}
              />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <span>测算模式</span>
        <div className="calc-type-row">
          {CALC_TYPES.map((c) => (
            <label key={c.value} className={`calc-type ${calcType === c.value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="calcType"
                value={c.value}
                checked={calcType === c.value}
                onChange={() => setCalcType(c.value)}
              />
              <strong>{c.label}</strong>
              <span>{c.desc}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="field">
        <span>出生城市</span>
        <input
          type="text"
          placeholder="输入城市名，如：北京"
          autoComplete="off"
          value={city ? `${city.name}（${city.province}）` : cityQuery}
          onChange={(e) => {
            setCity(null);
            setCityQuery(e.target.value);
          }}
        />
        {!city && cities.length > 0 && (
          <div className="city-list">
            {cities.map((c) => (
              <button
                key={c.name}
                type="button"
                className="city-item"
                onClick={() => {
                  setCity(c);
                  setCities([]);
                }}
              >
                {c.name} · {c.province}（东经 {c.longitude}°）
              </button>
            ))}
          </div>
        )}
      </label>

      {error && <p className="error">{error}</p>}

      {editing && <p className="dim">正在读取档案…</p>}

      <button type="submit" className="primary" disabled={busy || editing}>
        {editing ? '读取中…' : busy ? '演算中…' : editId ? '保存并重新测算' : '开始测算'}
      </button>

      <p className="footnote">
        九层引擎全量上线：时空校正 → 术数算力 → 科学祛魅 → 权重量化 → 因果溯源 → 量子多线 →
        元规则内核 → 七级改运 → 实相兜底。
      </p>
    </form>
  );
}
