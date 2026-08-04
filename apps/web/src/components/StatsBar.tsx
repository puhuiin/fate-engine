import type { StatsOverview } from '../api/client';

/** 「我的记录」页顶部统计看板：档案 / 测算 / 解锁率 / 改运完成 / 重点风险 */
export default function StatsBar({ stats }: { stats: StatsOverview }) {
  const items = [
    { num: stats.archivesCount, label: '档案' },
    { num: stats.totalRecords, label: '测算' },
    { num: `${stats.unlockRate}%`, label: '解锁率' },
    {
      num: stats.totalPlans > 0 ? `${stats.planCompletionRate}%` : '-',
      label: '改运完成',
    },
    { num: stats.highRiskCount, label: '重点风险' },
  ];
  return (
    <div className="stats-bar">
      {items.map((it) => (
        <div className="stat-item" key={it.label}>
          <span className="stat-num">{it.num}</span>
          <span className="stat-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
