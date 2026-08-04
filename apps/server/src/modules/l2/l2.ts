/**
 * L2 术数算力池（V1）
 * 多流派并行原始测算：现阶段实现「八字命理」与「纳音五行论命」两个流派，
 * 输出原始数据 + 流派口径说明；冲突项交由 L7 元规则内核归一。
 */
import { buildBazi, type BaziResult } from './bazi.js';

export interface L2School {
  school: string;
  version: string;
  note: string;
  data: Record<string, unknown>;
}

export interface L2Output {
  schools: L2School[];
  /** 跨流派冲突说明（交由 L7 归一） */
  conflicts: string[];
  /** 流派口径总说明（含误差影响） */
  schoolNote: string;
  /** 是否缺少时辰（仅日柱精度） */
  dayPrecisionOnly: boolean;
  /** 八字排盘原始结果（供 L3/L4 复用） */
  bazi: BaziResult;
}

const NAYIN_PROFILE: Record<string, string> = {
  金: '刚毅明理、讲求原则与条理，对细节敏感，在规则清晰的领域往往能建立深度专业能力。',
  木: '生长进取、乐于开拓，重视成长与创新，适合需要突破和创造的领域。',
  水: '灵活通透、洞察力强，善于应变与沟通，信息处理与关系协调是突出优势。',
  火: '热情外向、表达与行动力强，感染力突出，适合需要传播与开创的场景。',
  土: '稳健务实、承载与执行力强，耐得住深耕，适合需要长期积累的领域。',
};

/** 纳音名末字即五行（如 金箔金 -> 金） */
function naYinWuXing(naYin: string): string {
  const last = naYin.slice(-1);
  return last in { 金: 1, 木: 1, 水: 1, 火: 1, 土: 1 } ? last : '';
}

export function runL2(
  clockTime: Date,
  gender: string,
  timeKnown: boolean,
  currentYear?: number,
): L2Output {
  const bazi = buildBazi(clockTime, gender, currentYear);

  const pillarRows = ['year', 'month', 'day', 'time'].map((k) => {
    const p = bazi.pillars[k as keyof typeof bazi.pillars];
    return {
      position: k,
      ganzhi: p.ganzhi,
      gan: p.gan,
      zhi: p.zhi,
      wuxing: `${p.wuxingGan}${p.wuxingZhi === p.wuxingGan ? '' : p.wuxingZhi}`,
      nayin: p.nayin,
      shishenGan: p.shishenGan,
      shishenZhi: p.shishenZhi.join('/'),
      hideGan: p.hideGan.join('/'),
      dishi: p.dishi,
    };
  });

  const dayNaYin = bazi.pillars.day.nayin;
  const dayNaYinWx = naYinWuXing(dayNaYin);
  const dayMasterWx = bazi.dayMaster.wuxing;

  const schools: L2School[] = [
    {
      school: '八字命理',
      version: 'V1',
      note: '以日主（日干）为中心，考察四柱五行生克、十神结构与行运走势。',
      data: {
        pillars: pillarRows,
        dayMaster: bazi.dayMaster,
        strength: bazi.strength,
        wuxingCount: bazi.wuxingCount,
        shishenStats: bazi.shishenStats,
        xunKong: bazi.xunKong,
        taiYuan: bazi.taiYuan,
        mingGong: bazi.mingGong,
        daYun: bazi.daYun,
        currentDaYun: bazi.currentDaYun,
      },
    },
    {
      school: '纳音五行论命',
      version: 'V1',
      note: '以年柱纳音与日柱纳音综合取象，作文化性参考视角。',
      data: {
        yearNaYin: bazi.pillars.year.nayin,
        dayNaYin,
        dayNaYinWuXing: dayNaYinWx,
        profile: NAYIN_PROFILE[dayNaYinWx] ?? '纳音取象信息不足，仅供参考。',
      },
    },
  ];

  // 多流派冲突溯源：八字以日干论命，纳音以日柱纳音论命
  const conflicts: string[] = [];
  if (dayMasterWx && dayNaYinWx && dayMasterWx !== dayNaYinWx) {
    conflicts.push(
      `八字流派以日主（${bazi.dayMaster.gan}，五行${dayMasterWx}）为坐标，纳音流派以日柱纳音（${dayNaYin}，五行${dayNaYinWx}）为坐标，两派主星五行不同，结论需由 L7 元规则内核统一。`,
    );
  } else if (dayNaYinWx) {
    conflicts.push('八字与纳音两派主星五行一致，无显著冲突，可直接归一。');
  }

  return {
    schools,
    conflicts,
    schoolNote: timeKnown
      ? '八字/纳音排盘基于 L1 真太阳时校正后的时辰，干支已按「节」分界取用；误差等级与置信度见 L1 层公示。'
      : '未提供具体出生时间，本次按正午占位排盘，时柱与大运仅作参考，结论置信度显著下降。',
    dayPrecisionOnly: !timeKnown,
    bazi,
  };
}
