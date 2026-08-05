import { Link } from 'react-router-dom';
import type { Archive } from '../api/client';

export function formatPrecision(p: string | undefined): string {
  return p === 'minute' ? '分钟' : p === 'hour' ? '时辰' : p === 'day' ? '日期' : '模糊';
}

/** 出生档案表格：测算 / 编辑 / 删除 */
export default function ArchivesTable({
  archives,
  onCalc,
  onDelete,
}: {
  archives: Archive[];
  onCalc: (id: number) => void;
  onDelete: (a: Archive) => void;
}) {
  if (archives.length === 0) {
    return <p className="dim">还没有出生档案，去首页录入第一份吧。</p>;
  }
  return (
    <table className="kv">
      <tbody>
        {archives.map((a) => (
          <tr key={a.id}>
            <td>
              {a.solar_date}
              {a.solar_time ? ` ${a.solar_time.slice(0, 5)}` : ''}
            </td>
            <td>{a.city_name ?? '-'}</td>
            <td>{formatPrecision(a.time_precision)}</td>
            <td>
              <button className="link-btn" onClick={() => onCalc(a.id)}>
                测算
              </button>
              <Link to={`/edit/${a.id}`} className="link-btn">
                编辑
              </Link>
              <button className="link-btn danger" onClick={() => onDelete(a)}>
                删除
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
