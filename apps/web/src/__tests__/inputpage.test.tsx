// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Input from '../pages/Input';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    calculate: vi.fn(),
    createArchive: vi.fn(),
    getArchive: vi.fn(),
    guestLogin: vi.fn(),
    searchCities: vi.fn(),
    setToken: vi.fn(),
    updateArchive: vi.fn(),
  };
});

import {
  calculate,
  createArchive,
  getArchive,
  guestLogin,
  searchCities,
  setToken,
  updateArchive,
} from '../api/client';
import type { ApiResp, Archive, City, User } from '../api/client';

const mocked = {
  calculate: vi.mocked(calculate),
  createArchive: vi.mocked(createArchive),
  getArchive: vi.mocked(getArchive),
  guestLogin: vi.mocked(guestLogin),
  searchCities: vi.mocked(searchCities),
  setToken: vi.mocked(setToken),
  updateArchive: vi.mocked(updateArchive),
};

const ok = <T,>(data: T, code = 200): ApiResp<T> => ({
  code,
  msg: 'ok',
  data,
  timestamp: 0,
  sign: '',
});

const beijing: City = {
  name: '北京',
  province: '北京市',
  longitude: 116.4,
  latitude: 39.9,
  timezoneOffset: 8,
};

const guestUser: User = {
  id: 9,
  phone_masked: null,
  nickname: '游客',
  register_channel: 'guest',
  member_level: 0,
};

const archive = (over: Partial<Archive> = {}): Archive => ({
  id: 101,
  gender: 'male',
  solar_date: '1990-01-01',
  solar_time: null,
  city_name: null,
  province: null,
  longitude: null,
  latitude: null,
  timezone_offset: null,
  time_source: null,
  time_precision: 'minute',
  source_reliability: 'unknown',
  created_at: '2026-08-01',
  ...over,
});

function renderInput(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Input />} />
        <Route path="/edit/:id" element={<Input />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillBasics(city = beijing) {
  fireEvent.change(screen.getByLabelText(/出生日期/), { target: { value: '1990-01-01' } });
  fireEvent.change(screen.getByLabelText(/出生时间/), { target: { value: '12:30' } });
  fireEvent.change(screen.getByLabelText(/出生城市/), { target: { value: '北京' } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  fireEvent.click(screen.getByText(/东经 116.4°/));
  return city;
}

/** 录入页集成测试：表单校验、游客登录、城市搜索防抖、创建/测算链路、编辑回填 */
describe('Input 录入页', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('未填出生日期提交提示', () => {
    renderInput();
    fireEvent.submit(screen.getByRole('button', { name: '开始测算' }).closest('form')!);
    expect(screen.getByText('请填写出生日期')).toBeInTheDocument();
  });

  it('精确到分钟时未填出生时间提示', () => {
    renderInput();
    fireEvent.change(screen.getByLabelText(/出生日期/), { target: { value: '1990-01-01' } });
    fireEvent.submit(screen.getByRole('button', { name: '开始测算' }).closest('form')!);
    expect(screen.getByText('请填写出生时间')).toBeInTheDocument();
  });

  it('输入城市但未从下拉选择时提示', async () => {
    vi.useFakeTimers();
    try {
      mocked.searchCities.mockResolvedValue(ok<City[]>([beijing]));
      renderInput();
      fireEvent.change(screen.getByLabelText(/出生日期/), { target: { value: '1990-01-01' } });
      fireEvent.change(screen.getByLabelText(/出生时间/), { target: { value: '12:30' } });
      fireEvent.change(screen.getByLabelText(/出生城市/), { target: { value: '北京' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      fireEvent.submit(screen.getByRole('button', { name: '开始测算' }).closest('form')!);
      expect(screen.getByText(/请从下拉列表选择城市/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('游客无 token：自动登录后创建档案并跳转测算', async () => {
    vi.useFakeTimers();
    try {
      mocked.guestLogin.mockResolvedValue(ok({ user: guestUser, token: 'guest-token' }));
      mocked.createArchive.mockResolvedValue(ok(archive()));
      mocked.calculate.mockResolvedValue(ok({ recordId: 77, report: [], stage: 'done' }));
      renderInput();
      await fillBasics();
      fireEvent.click(screen.getByRole('button', { name: '开始测算' }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(mocked.guestLogin).toHaveBeenCalledTimes(1);
      expect(mocked.setToken).toHaveBeenCalledWith('guest-token');
      expect(mocked.createArchive).toHaveBeenCalledWith(
        expect.objectContaining({
          solarDate: '1990-01-01',
          solarTime: '12:30',
          timePrecision: 'minute',
          cityName: '北京',
        }),
      );
      expect(mocked.calculate).toHaveBeenCalledWith(101, 'standard');
    } finally {
      vi.useRealTimers();
    }
  });

  it('已有 token：不重复游客登录', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('fate_token', 'existing');
      mocked.createArchive.mockResolvedValue(ok(archive()));
      mocked.calculate.mockResolvedValue(ok({ recordId: 77, report: [], stage: 'done' }));
      renderInput();
      await fillBasics();
      fireEvent.click(screen.getByRole('button', { name: '开始测算' }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(mocked.guestLogin).not.toHaveBeenCalled();
      expect(mocked.createArchive).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('保存档案失败展示错误且不触发测算', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('fate_token', 'existing');
      mocked.createArchive.mockResolvedValue(ok(archive(), 400));
      renderInput();
      await fillBasics();
      fireEvent.click(screen.getByRole('button', { name: '开始测算' }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(mocked.calculate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('编辑模式：回填档案信息并走更新链路', async () => {
    vi.useFakeTimers();
    try {
      mocked.getArchive.mockResolvedValue(
        ok(
          archive({
            id: 5,
            gender: 'female',
            solar_date: '1988-08-08',
            solar_time: '20:15',
            city_name: '上海',
            province: '上海市',
            longitude: 121.5,
            latitude: 31.2,
            timezone_offset: 8,
            source_reliability: 'family',
          }),
        ),
      );
      mocked.updateArchive.mockResolvedValue(ok(archive({ id: 5 })));
      mocked.calculate.mockResolvedValue(ok({ recordId: 88, report: [], stage: 'done' }));
      renderInput('/edit/5');

      // 回填完成后按钮可提交
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByRole('button', { name: '保存并重新测算' })).toBeEnabled();
      expect(screen.getByLabelText(/出生日期/)).toHaveValue('1988-08-08');
      expect(screen.getByLabelText(/出生时间/)).toHaveValue('20:15');
      expect(screen.getByLabelText(/出生城市/)).toHaveValue('上海（上海市）');
      expect(screen.getByRole('radio', { name: '女' })).toBeChecked();

      fireEvent.click(screen.getByRole('button', { name: '保存并重新测算' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(mocked.updateArchive).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ solarDate: '1988-08-08', gender: 'female' }),
      );
      expect(mocked.calculate).toHaveBeenCalledWith(5, 'standard');
    } finally {
      vi.useRealTimers();
    }
  });

  it('城市搜索防抖 250ms 后拉取候选并可选择', async () => {
    vi.useFakeTimers();
    try {
      mocked.searchCities.mockResolvedValue(ok<City[]>([beijing]));
      renderInput();
      const cityInput = screen.getByLabelText(/出生城市/);
      fireEvent.change(cityInput, { target: { value: '北京' } });

      // 未到防抖阈值不请求
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(mocked.searchCities).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(mocked.searchCities).toHaveBeenCalledWith('北京');
      expect(screen.getByText(/东经 116.4°/)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/东经 116.4°/));
      expect(cityInput).toHaveValue('北京（北京市）');
      expect(screen.queryByText(/东经 116.4°/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('日期级精度展示正午推定提示，时辰级不展示', () => {
    renderInput();
    const precision = screen.getByLabelText(/时间精确度/);
    fireEvent.change(precision, { target: { value: 'day' } });
    expect(screen.getByText(/按正午 12:00 推定时辰/)).toBeInTheDocument();
    fireEvent.change(precision, { target: { value: 'hour' } });
    expect(screen.queryByText(/按正午 12:00 推定时辰/)).not.toBeInTheDocument();
  });
});
