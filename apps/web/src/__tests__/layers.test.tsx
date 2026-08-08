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
  daYun: [{ index: 0, ganzhi: '壬子', startAge: 3, endAge: 12, startYear: 2005, endYear: 2014 }],
  currentDaYun: {
    index: 2,
    ganzhi: '甲寅',
    startAge: 23,
    endAge: 32,
    startYear: 2025,
    endYear: 2034,
  },
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
      data: {
        yearNaYin: '杨柳木',
        dayNaYin: '壁上土',
        dayNaYinWuXing: '土',
        profile: '稳健务实。',
      },
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
          {
            name: '官杀（事业/权威）',
            category: '正官/七杀',
            count: 2,
            level: '中',
            note: '力量适中。',
          },
          {
            name: '印星（庇护/学问）',
            category: '正印/偏印',
            count: 4,
            level: '强',
            note: '力量突出。',
          },
          {
            name: '财星（资源/经营）',
            category: '正财/偏财',
            count: 1,
            level: '弱',
            note: '力量偏弱。',
          },
          {
            name: '食伤（才华/表达）',
            category: '食神/伤官',
            count: 3,
            level: '强',
            note: '力量突出。',
          },
          {
            name: '比劫（同伴/竞争）',
            category: '比肩/劫财',
            count: 3,
            level: '强',
            note: '力量突出。',
          },
        ],
        summary: '印星、食伤、比劫力量突出。',
        note: '十神六亲为关系结构参考。',
      },
    },
    {
      school: '调候用神',
      version: 'V1',
      note: '以日干×月令查调候用神。',
      data: {
        day: '辛',
        month: '亥',
        season: '冬',
        use: ['壬', '丙'],
        usePresent: ['壬'],
        useMissing: ['丙'],
        balanced: false,
        principle: '寒冬水冷木枯，急需火（丙丁）暖局。',
        summary: '辛日主生于亥月（冬），穷通宝鉴取调候用神「壬、丙」。',
        note: '调候用神关注「气候环境」。',
      },
    },
    {
      school: '病药论',
      version: 'V1',
      note: '以五行失衡为病、制化补益为药。',
      data: {
        bings: [
          { wx: '土', count: 3, type: '偏旺', desc: '土偏旺壅滞为病。' },
          { wx: '木', count: 0, type: '不及', desc: '木缺失为病。' },
        ],
        yaos: [
          { wx: '木', role: '克', desc: '以木克土制约过旺之气。' },
          { wx: '水', role: '生', desc: '以水生木补足所缺之源。' },
        ],
        summary: '本命病在土偏旺与缺木，药取木、水。',
        note: '病药论为分析视角之一。',
      },
    },
    {
      school: '刑冲合害',
      version: 'V1',
      note: '以干支关系考察。',
      data: {
        ganHe: [{ a: '甲', b: '己', pos: '年月', hua: '土', desc: '甲己合土，相吸凝聚。' }],
        zhiHe: [],
        zhiChong: [{ a: '子', b: '午', pos: '月日', desc: '子午相冲，主变动张力。' }],
        zhiHai: [{ a: '午', b: '丑', pos: '年日', desc: '丑午相害，隐形摩擦。' }],
        zhiXing: [
          { a: '丑', b: '戌', pos: '日时', kind: '恃势之刑', desc: '丑戌恃势之刑，束缚反复。' },
        ],
        sanHe: [
          { zhis: ['申', '子', '辰'], pos: '四柱地支', name: '水局', desc: '申子辰三合水局。' },
        ],
        sanHui: [],
        daYunJiao: [
          { dir: '大运', ganzhi: '甲寅', kind: '六合', desc: '大运甲寅之寅与月柱亥六合。' },
        ],
        summary:
          '本命干支关系：天干五合1处（甲己）、六冲1处（子午）、六害1处（午丑）、三刑1处（丑戌）。',
        note: '刑冲合害属结构分析视角。',
      },
    },
  ],
  conflicts: ['神煞格局、十神六亲均以八字四柱为坐标，与八字流派同源一致。'],
  schoolNote: '多流派并行。',
  dayPrecisionOnly: false,
  bazi: baseBazi,
};

describe('Layer2 八流派渲染', () => {
  it('渲染 8 个流派区块', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText('八字命理（V2）')).toBeTruthy();
    expect(screen.getByText('纳音五行论命（V1）')).toBeTruthy();
    expect(screen.getByText('神煞格局（V1）')).toBeTruthy();
    expect(screen.getByText('五运六气（V1）')).toBeTruthy();
    expect(screen.getByText('十神六亲（V1）')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /调候用神/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /病药论/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /刑冲合害/ })).toBeTruthy();
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

  it('渲染调候用神状态与处方', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText('壬、丙')).toBeTruthy();
    expect(screen.getByText('辛日主 × 亥月（冬季）')).toBeTruthy();
    expect(screen.getByText('有所欠缺')).toBeTruthy();
  });

  it('渲染病药论病与药', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getAllByText('土').length > 0).toBeTruthy();
    expect(screen.getByText('过旺')).toBeTruthy();
    expect(screen.getByText('克')).toBeTruthy();
    expect(screen.getByText(/本命病在土偏旺与缺木，药取木、水/)).toBeTruthy();
  });

  it('渲染八字身宫/胎息', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText(/庚戌 \/ 丙子/)).toBeTruthy();
  });

  it('渲染多流派冲突溯源', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText('多流派冲突溯源')).toBeTruthy();
  });

  it('渲染刑冲合害关系明细', () => {
    render(<Layer2 l2={l2} />);
    expect(screen.getByText('甲己')).toBeTruthy();
    expect(screen.getByText('子午')).toBeTruthy();
    expect(screen.getByText('午丑')).toBeTruthy();
    expect(screen.getByText('恃势之刑')).toBeTruthy();
    expect(screen.getByText(/申子辰三合成水局/)).toBeTruthy();
    expect(screen.getByText('甲寅')).toBeTruthy();
  });
});
