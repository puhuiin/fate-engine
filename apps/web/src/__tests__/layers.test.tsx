// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Layer2 } from '../pages/report/layers';
import type { L2Result } from '../api/client';

const baseBazi = {
  gender: 'male',
  dayMaster: { gan: '辛', wuxing: '金' },
  strength: '中和',
  wuxingCount: { 金: 2, 木: 1, 水: 2, 火: 2, 土: 3 },
  shishenStats: [
    { name: '正印', count: 2 },
    { name: '偏印', count: 2 },
    { name: '伤官', count: 2 },
    { name: '比肩', count: 2 },
    { name: '正官', count: 1 },
    { name: '七杀', count: 1 },
    { name: '正财', count: 1 },
  ],
  xunKong: { xun: '甲午', kong: '辰巳' },
  taiYuan: '庚寅',
  mingGong: '乙未',
  shenGong: '庚戌',
  taiXi: '丙子',
  daYun: [
    { index: 0, ganzhi: '壬子', startAge: 3, endAge: 12, startYear: 2005, endYear: 2014 },
  ],
  currentDaYun: { index: 2, ganzhi: '甲寅', startAge: 23, endAge: 32, startYear: 2025, endYear: 2034 },
};

const pillar = (position: string) => ({
  position,
  ganzhi: '辛丑',
  gan: '辛',
  zhi: '丑',
  wuxing: '金土',
  nayin: '壁上土',
  shishenGan: '偏印',
  shishenZhi: '食神/偏印',
  hideGan: '己/癸/辛',
  dishi: '墓',
});

const l2: L2Result = {
  schools: [
    {
      school: '八字命理',
      version: 'V2',
      note: '以日主为中心。',
      data: {
        pillars: [
          { ...pillar('year'), zhi: '午', ganzhi: '壬午' },
          { ...pillar('month'), zhi: '亥', ganzhi: '辛亥' },
          { ...pillar('day') },
          { ...pillar('time'), zhi: '戌', ganzhi: '丙戌' },
        ],
        dayMaster: { gan: '辛', wuxing: '金' },
        strength: '中和',
        wuxingCount: {},
        shishenStats: [],
        xunKong: { xun: '甲午', kong: '辰巳' },
        taiYuan: '庚寅',
        mingGong: '乙未',
        shenGong: '庚戌',
        taiXi: '丙子',
        daYun: [],
        currentDaYun: null,
      },
    },
    {
      school: '纳音五行论命',
      version: 'V1',
      note: '以纳音取象。',
      data: { yearNaYin: '杨柳木', dayNaYin: '壁上土', dayNaYinWuXing: '土', profile: '稳健务实。' },
    },
    {
      school: '神煞格局',
      version: 'V1',
      note: '以日干/年支查神煞。',
      data: {
        groups: [
          {
            group: '贵人组',
            stars: [{ name: '天乙贵人', pillar: '年支', at: '午', note: '贵人星。' }],
            interpretation: '贵人缘较好。',
          },
        ],
        note: '神煞为文化隐喻参考。',
      },
    },
    {
      school: '五运六气',
      version: 'V1',
      note: '以年干支推气化。',
      data: {
        zhongYun: { name: '木运', phase: '太过', qi: '风', note: '壬年岁运太过。' },
        siTian: { ganzhi: '壬午', qi: '少阴君火', note: '午年司天。' },
        zaiQuan: { ganzhi: '壬午', qi: '阳明燥金', note: '在泉。' },
        keQi: [
          { step: '初之气', qi: '太阳寒水' },
          { step: '二之气', qi: '厥阴风木' },
          { step: '三之气', qi: '少阴君火' },
          { step: '四之气', qi: '太阴湿土' },
          { step: '五之气', qi: '少阳相火' },
          { step: '终之气', qi: '阳明燥金' },
        ],
        zhuQi: [
          { step: '初之气', qi: '厥阴风木' },
          { step: '二之气', qi: '少阴君火' },
          { step: '三之气', qi: '少阳相火' },
          { step: '四之气', qi: '太阴湿土' },
          { step: '五之气', qi: '阳明燥金' },
          { step: '终之气', qi: '太阳寒水' },
        ],
        xiangHe: { name: '平气', note: '气化互有制衡。' },
        note: '五运六气为气化参考。',
      },
    },
    {
      school: '十神六亲',
      version: 'V1',
      note: '以十神分布定六亲。',
      data: {
        relatives: [
          { name: '官杀（事业/权威）', category: '正官/七杀', count: 2, level: '中', note: '力量适中。' },
          { name: '印星（庇护/学问）', category: '正印/偏印', count: 4, level: '强', note: '力量突出。' },
          { name: '财星（资源/经营）', category: '正财/偏财', count: 1, level: '弱', note: '力量偏弱。' },
          { name: '食伤（才华/表达）', category: '食神/伤官', count: 3, level: '强', note: '力量突出。' },
          { name: '比劫（同伴/竞争）', category: '比肩/劫财', count: 3, level: '强', note: '力量突出。' },
        ],
        summary: '印星、食伤、比劫力量突出。',
        note: '十神六亲为关系结构参考。',
      },
    },
  ],
  conflicts: ['神煞格局、十神六亲均以八字四柱为坐标，与八字流派同源一致。'],
  schoolNote: '多流派并行。',
  dayPrecisionOnly: false,
  bazi: baseBazi,
};

describe('Layer2 五流派渲染', () => {
  it('渲染 5 个流派区块', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText('八字命理（V2）')).toBeTruthy();
    expect(screen.getByText('纳音五行论命（V1）')).toBeTruthy();
    expect(screen.getByText('神煞格局（V1）')).toBeTruthy();
    expect(screen.getByText('五运六气（V1）')).toBeTruthy();
    expect(screen.getByText('十神六亲（V1）')).toBeTruthy();
  });

  it('渲染神煞命中明细', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText(/天乙贵人（年支午）/)).toBeTruthy();
    expect(screen.getByText('贵人组')).toBeTruthy();
  });

  it('渲染五运六气中运与运气相合', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText('木运（太过）')).toBeTruthy();
    expect(screen.getByText('少阴君火')).toBeTruthy();
    expect(screen.getByText('平气')).toBeTruthy();
    expect(screen.getByText('客气六步（三之气即司天，终之气即在泉）')).toBeTruthy();
  });

  it('渲染六亲强度表', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText('印星（庇护/学问）')).toBeTruthy();
    expect(screen.getByText(/强（4）/)).toBeTruthy();
    expect(screen.getByText(/印星、食伤、比劫力量突出/)).toBeTruthy();
  });

  it('渲染八字身宫/胎息', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText(/庚戌 \/ 丙子/)).toBeTruthy();
  });

  it('渲染多流派冲突溯源', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText('多流派冲突溯源')).toBeTruthy();
  });
});
