// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecordsTable from '../../components/RecordsTable';
import ArchivesTable, { formatPrecision } from '../../components/ArchivesTable';
import StatsBar from '../../components/StatsBar';
import type { RecordListItem } from '../../api/client';
import type { Archive } from '../../api/client';

// 与 main.tsx 一致，预先启用 v7 行为开关，消除测试运行时的 React Router 弃用警告
const ROUTER_FUTURE_FLAGS = { v7_startTransition: true, v7_relativeSplatPath: true };

describe('RecordsTable 测算历史表格', () => {
  it('空记录显示占位文案', () => {
    render(<RecordsTable records={[]} onDelete={() => {}} />);
    expect(screen.getByText(/还没有测算记录/)).toBeInTheDocument();
  });

  it('渲染记录行：日期、模式徽标、深度标签与操作链接', () => {
    const records: RecordListItem[] = [
      {
        id: 1,
        archive_id: 1,
        calc_type: 'quantum',
        status: 'completed',
        paid_status: 1,
        created_at: '2026-01-01 10:00:00',
        solar_date: '2002-11-29',
        solar_time: '20:40',
        city_name: '北京',
      },
    ];
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <RecordsTable records={records} onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('2002-11-29 20:40')).toBeInTheDocument();
    expect(screen.getByText('北京')).toBeInTheDocument();
    expect(screen.getByText('量子')).toBeInTheDocument();
    expect(screen.getByText('深度版')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看报告' })).toHaveAttribute('href', '/report/1');
  });

  it('基础版记录展示「基础版」标签', () => {
    const records: RecordListItem[] = [
      {
        id: 2,
        archive_id: 1,
        calc_type: 'standard',
        status: 'completed',
        paid_status: 0,
        created_at: '2026-01-01 10:00:00',
        solar_date: '2000-01-01',
        solar_time: null,
        city_name: null,
      },
    ];
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <RecordsTable records={records} onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('标准')).toBeInTheDocument();
    expect(screen.getByText('基础版')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('点击删除触发 onDelete 回调', () => {
    const records: RecordListItem[] = [
      {
        id: 3,
        archive_id: 1,
        calc_type: 'standard',
        status: 'completed',
        paid_status: 0,
        created_at: '2026-01-01 10:00:00',
        solar_date: '2000-01-01',
        solar_time: null,
        city_name: null,
      },
    ];
    const onDelete = vi.fn();
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <RecordsTable records={records} onDelete={onDelete} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(onDelete).toHaveBeenCalledWith(records[0]);
  });
});

describe('ArchivesTable 出生档案表格', () => {
  it('空档案显示占位文案', () => {
    render(<ArchivesTable archives={[]} onCalc={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/还没有出生档案/)).toBeInTheDocument();
  });

  it('渲染档案并响应测算/删除操作', () => {
    const archives: Archive[] = [
      {
        id: 1,
        gender: 'female',
        solar_date: '2002-11-29',
        solar_time: '20:40:00',
        city_name: '北京',
        province: '北京市',
        longitude: 116.4,
        latitude: 39.9,
        timezone_offset: 8,
        time_source: 'certificate',
        time_precision: 'minute',
        source_reliability: 'certificate',
        created_at: '2026-01-01 10:00:00',
      },
    ];
    const onCalc = vi.fn();
    const onDelete = vi.fn();
    render(
      <MemoryRouter future={ROUTER_FUTURE_FLAGS}>
        <ArchivesTable archives={archives} onCalc={onCalc} onDelete={onDelete} />
      </MemoryRouter>,
    );
    expect(screen.getByText('2002-11-29 20:40')).toBeInTheDocument();
    expect(screen.getByText('分钟')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '测算' }));
    expect(onCalc).toHaveBeenCalledWith(1);
    expect(screen.getByRole('link', { name: '编辑' })).toHaveAttribute('href', '/edit/1');
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(onDelete).toHaveBeenCalledWith(archives[0]);
  });

  it('formatPrecision 精度映射', () => {
    expect(formatPrecision('minute')).toBe('分钟');
    expect(formatPrecision('hour')).toBe('时辰');
    expect(formatPrecision('day')).toBe('日期');
    expect(formatPrecision(undefined)).toBe('模糊');
  });
});

describe('StatsBar 统计看板', () => {
  it('渲染五项统计', () => {
    render(
      <StatsBar
        stats={{
          archivesCount: 2,
          totalRecords: 5,
          paidRecords: 3,
          unlockRate: 60,
          totalPlans: 10,
          donePlans: 4,
          planCompletionRate: 40,
          highRiskCount: 1,
          lastRecordAt: null,
        }}
      />,
    );
    const nums = screen.getAllByText(/\d+/);
    expect(nums.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('档案')).toBeInTheDocument();
    expect(screen.getByText('测算')).toBeInTheDocument();
    expect(screen.getByText('解锁率')).toBeInTheDocument();
    expect(screen.getByText('改运完成')).toBeInTheDocument();
    expect(screen.getByText('重点风险')).toBeInTheDocument();
  });

  it('无改运计划时完成率显示占位 -', () => {
    render(
      <StatsBar
        stats={{
          archivesCount: 0,
          totalRecords: 0,
          paidRecords: 0,
          unlockRate: 0,
          totalPlans: 0,
          donePlans: 0,
          planCompletionRate: 0,
          highRiskCount: 0,
          lastRecordAt: null,
        }}
      />,
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
