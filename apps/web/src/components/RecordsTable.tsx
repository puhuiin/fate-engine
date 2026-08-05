import { Link } from 'react-router-dom';
import type { RecordListItem } from '../api/client';

export type RecordRow = RecordListItem;

/** 测算历史表格：查看报告 / 删除 */
export default function RecordsTable({
  records,
  onDelete,
}: {
  records: RecordRow[];
  onDelete: (r: RecordRow) => void;
}) {
  if (records.length === 0) {
    return <p className="dim">还没有测算记录，去首页开始第一次测算吧。</p>;
  }
  return (
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
              <span className={`pill calc-badge ${r.calc_type}`}>
                {r.calc_type === 'quantum' ? '量子' : r.calc_type === 'ultimate' ? '终极' : '标准'}
              </span>
            </td>
            <td>
              <span className={`paid-tag ${r.paid_status === 1 ? 'pro' : 'free'}`}>
                {r.paid_status === 1 ? '深度版' : '基础版'}
              </span>
            </td>
            <td>
              <Link to={`/report/${r.id}`} className="link-btn">
                查看报告
              </Link>
              <button className="link-btn danger" onClick={() => onDelete(r)}>
                删除
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
