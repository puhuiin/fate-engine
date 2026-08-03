/**
 * L8 七级分级改运执行方案（V13）
 * PRD 七级改运体系：环境布局 / 行为抉择 / 认知思维 / 习惯体系 /
 * 因果化解 / 信息维度重构 / 心性破执。
 * 每级基于六维评分与主卡点动态生成可落地条目，并落库 luck_plan 表。
 */
import type { Db } from '../../db/client.js';
import type { BaziResult } from '../l2/bazi.js';
import type { L4Output } from '../l4/l4.js';
import type { L5Output } from '../l5/l5.js';

export interface LuckPlanItem {
  title: string;
  content: string;
  execCycle: string; // 每日/每周/每月/每季度/一次性
}

export interface LuckLevel {
  level: number;
  name: string;
  items: LuckPlanItem[];
}

export interface L8Output {
  levels: LuckLevel[];
  note: string;
}

const LEVEL_NAMES = [
  '环境布局',
  '行为抉择',
  '认知思维',
  '习惯体系',
  '因果化解',
  '信息维度重构',
  '心性破执',
];

const KNOT_REFRAME: Record<string, string> = {
  求认可与自我证明: '把「我要被认可」改写为「我认可我自己」，建立一份独立于外界评价的自我价值清单。',
  内在高压与紧绷: '允许「及格就好」的弹性标准，高压并非专业性的同义词，给自己设定安全阀。',
  规则依赖与框架感: '练习在没有现成规则的情境下做小决策，逐步训练对模糊的耐受度。',
  惯性依赖与行动迟滞: '把「想清楚再做」改写为「先做一版再说」，行动本身会产出信息。',
  边界与较劲心态: '把竞争视角切换为协作视角：同行者是杠杆，不是参照系。',
  能力与欲望落差: '把大目标拆成 30 天可完成的小步，让进度可量化、可看见。',
  舒适区依赖: '每周安排一件「轻微不适」的新尝试，逐步扩大舒适区半径。',
  宫位留白感: '把留白感当作「注意力分配的提示」：为对应领域主动安排固定时间投入。',
};

const KNOT_ACTION: Record<string, string> = {
  求认可与自我证明: '给过去某次「没被认可」的经历写一封信（不寄出），写完划掉，完成一次象征性的放下。',
  内在高压与紧绷: '把长期压力清单逐条写出来，划掉所有「不是今天必须」的项，给大脑做一次清理。',
  规则依赖与框架感: '本周在无规则场景做 3 次小决定（如换条路走、点没吃过的菜），训练弹性。',
  惯性依赖与行动迟滞: '为正在酝酿的事设置 24 小时「启动倒计时」，到点就发出第一版。',
  边界与较劲心态: '主动找一次「让利」的协作，体验双赢带来的关系收益。',
  能力与欲望落差: '把「想要的」拆出一个 30 天内能拿到的小成果，先完成它。',
  舒适区依赖: '主动报名一次需要公开发言的场合，用外部约定倒逼行动。',
  宫位留白感: '在留白对应的领域做一次「补课式」投入，例如感情/自我认知读一本书并写总结。',
};

export function runL8(l4: L4Output, l5: L5Output, bazi: BaziResult): L8Output {
  const weak = l4.dimensions.filter((d) => d.total <= 60);
  const weakest = weak[0] ?? l4.dimensions[0];
  const knotName = l5.mainKnot;

  const levels: LuckLevel[] = [
    {
      level: 1,
      name: LEVEL_NAMES[0],
      items: [
        {
          title: '打造「目标可见」的工作/学习区',
          content:
            weak.some((d) => d.key === 'career' || d.key === 'wealth')
              ? '固定并优化工作/学习区：清除干扰物、保证光线，布置能提醒目标的视觉锚点（年度目标墙、待办看板）。'
              : '整理工作/学习区，让「最重要的三件事」处于一眼可见的位置。',
          execCycle: '一次性 + 每周微调',
        },
        {
          title: '优化睡眠环境',
          content:
            weak.some((d) => d.key === 'health')
              ? '优化睡眠环境（遮光、控温、电子设备移出卧室），睡眠是最划算的长期投资。'
              : '保持卧室的遮光与安静，固定入睡与起床时间。',
          execCycle: '每周',
        },
      ],
    },
    {
      level: 2,
      name: LEVEL_NAMES[1],
      items: [
        {
          title: `${weakest.name}维度的关键动作`,
          content: weakest.advice,
          execCycle: '每周',
        },
        {
          title: '建立周复盘仪式',
          content: '每周五做一次周复盘：记录本周三件成果、一个卡点、下周一个关键动作。',
          execCycle: '每周',
        },
      ],
    },
    {
      level: 3,
      name: LEVEL_NAMES[2],
      items: [
        {
          title: `针对「${knotName}」的认知重构`,
          content: KNOT_REFRAME[knotName] ?? '练习「事实-解读」分离：先记录客观事实，再标记自己的主观解读，避免自动联想。',
          execCycle: '持续 + 每日复盘',
        },
        {
          title: '事实与解读分离练习',
          content: '遇到负面反馈时，先区分「发生了什么」与「我认为它意味着什么」，给自己留出理性间隙。',
          execCycle: '每日',
        },
      ],
    },
    {
      level: 4,
      name: LEVEL_NAMES[3],
      items: [
        {
          title: '健康微习惯',
          content: '每周 3 次、每次 30 分钟的适量运动 + 固定作息，从最小单元开始建立。',
          execCycle: '每周 3 次',
        },
        {
          title: '技能深耕习惯',
          content: '每日 15 分钟专注深耕一个与目标相关的技能，用「最小可坚持」原则长期化。',
          execCycle: '每日',
        },
      ],
    },
    {
      level: 5,
      name: LEVEL_NAMES[4],
      items: [
        {
          title: `「${knotName}」的化解动作`,
          content: KNOT_ACTION[knotName] ?? '主动处理一段积压的关系：一次真诚的沟通，胜过反复的内耗。',
          execCycle: '一次性',
        },
        {
          title: '关系清理与偿还',
          content: '梳理一段长期积压的关系或承诺，完成一次真诚的沟通、感谢或兑现。',
          execCycle: '每月一次',
        },
      ],
    },
    {
      level: 6,
      name: LEVEL_NAMES[5],
      items: [
        {
          title: '跨领域信息输入',
          content: '每周接触一个与主业无关的领域信息源，刻意打破信息茧房。',
          execCycle: '每周',
        },
        {
          title: '高质量连接',
          content: '加入一个高质量同频社群或找到一位 mentor，让信息与机会经由人流动起来。',
          execCycle: '每月',
        },
      ],
    },
    {
      level: 7,
      name: LEVEL_NAMES[6],
      items: [
        {
          title: '心性练习',
          content: '每日 5 分钟正念或冥想，练习与「当下的自己」相处，不评判、不逃离。',
          execCycle: '每日',
        },
        {
          title: '自我认可清单',
          content: '每周记录 3 件「我做得不错的事」，把自我价值从外界评价手中拿回来。',
          execCycle: '每周',
        },
      ],
    },
  ];

  return {
    levels,
    note: `七级方案按「由外到内」排列：先改环境与行为（最快见效），再深入认知与心性（最持久）。日主${bazi.dayMaster.gan}（${bazi.dayMaster.wuxing}）提示的本性倾向已融入各条内容；执行时以 30 天为一个周期复盘迭代。`,
  };
}

/** 将七级方案落库 luck_plan 表（应在调用方事务内执行，避免记录与方案出现孤儿数据） */
export function insertLuckPlans(db: Db, recordId: number, l8: L8Output): void {
  const stmt = db.prepare(
    'INSERT INTO luck_plan (record_id, level, title, content, exec_cycle) VALUES (?, ?, ?, ?, ?)',
  );
  for (const level of l8.levels) {
    for (const item of level.items) {
      stmt.run(recordId, level.level, item.title, item.content, item.execCycle);
    }
  }
}
