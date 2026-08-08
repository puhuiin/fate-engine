/**
 * L2 术数算力池 - 五运六气流派（V1）
 * 以出生年干支推中运（岁运太过/不及）、司天在泉（六气定位）、客气六步与主气六步，
 * 输出体质基调与气候禀赋参考。全部表驱动确定性算法。
 *
 * 五运六气是中医天人相应框架：中运定一年五行大气候的底色，
 * 司天在泉定位上下半年主气，客气/主气叠合成当年气化格局。
 */
export interface WuYunLiuQiData {
  /** 中运（岁运）：年干化运 + 太过/不及 */
  zhongYun: { name: string; phase: string; qi: string; note: string };
  /** 司天 */
  siTian: { ganzhi: string; qi: string; note: string };
  /** 在泉 */
  zaiQuan: { ganzhi: string; qi: string; note: string };
  /** 客气六步（初之气至终之气） */
  keQi: Array<{ step: string; qi: string }>;
  /** 主气六步（每年固定） */
  zhuQi: Array<{ step: string; qi: string }>;
  /** 运气相合：天符/岁会/平气 */
  xiangHe: { name: string; note: string };
  note: string;
}

/** 年干化运：甲己化土、乙庚化金、丙辛化水、丁壬化木、戊癸化火 */
const GAN_YUN: Record<string, { phase: string; qi: string }> = {
  甲: { phase: '土运', qi: '湿' },
  己: { phase: '土运', qi: '湿' },
  乙: { phase: '金运', qi: '燥' },
  庚: { phase: '金运', qi: '燥' },
  丙: { phase: '水运', qi: '寒' },
  辛: { phase: '水运', qi: '寒' },
  丁: { phase: '木运', qi: '风' },
  壬: { phase: '木运', qi: '风' },
  戊: { phase: '火运', qi: '热' },
  癸: { phase: '火运', qi: '热' },
};

/** 阳干太过、阴干不及 */
const TOO_MUCH = new Set(['甲', '丙', '戊', '庚', '壬']);

/** 年支定司天 */
const ZHI_SITIAN: Record<string, string> = {
  子: '少阴君火',
  午: '少阴君火',
  丑: '太阴湿土',
  未: '太阴湿土',
  寅: '少阳相火',
  申: '少阳相火',
  卯: '阳明燥金',
  酉: '阳明燥金',
  辰: '太阳寒水',
  戌: '太阳寒水',
  巳: '厥阴风木',
  亥: '厥阴风木',
};

/** 司天对宫定在泉 */
const SITIAN_ZAIQUAN: Record<string, string> = {
  子: '阳明燥金',
  午: '阳明燥金',
  丑: '太阳寒水',
  未: '太阳寒水',
  寅: '厥阴风木',
  申: '厥阴风木',
  卯: '少阴君火',
  酉: '少阴君火',
  辰: '太阴湿土',
  戌: '太阴湿土',
  巳: '少阳相火',
  亥: '少阳相火',
};

/** 三阴三阳序（客气六步按此循环） */
const QI_ORDER = ['厥阴风木', '少阴君火', '太阴湿土', '少阳相火', '阳明燥金', '太阳寒水'];

/** 主气六步（每年固定） */
const ZHU_QI = ['厥阴风木', '少阴君火', '少阳相火', '太阴湿土', '阳明燥金', '太阳寒水'];

const STEP_LABEL = ['初之气', '二之气', '三之气', '四之气', '五之气', '终之气'];

/** 六气五行取象 */
const QI_WUXING: Record<string, string> = {
  少阴君火: '火',
  少阳相火: '火',
  太阴湿土: '土',
  阳明燥金: '金',
  太阳寒水: '水',
  厥阴风木: '木',
};

/** 地支五行 */
const ZHI_WUXING: Record<string, string> = {
  子: '水',
  丑: '土',
  寅: '木',
  卯: '木',
  辰: '土',
  巳: '火',
  午: '火',
  未: '土',
  申: '金',
  酉: '金',
  戌: '土',
  亥: '水',
};

/** 年干化运五行取象（十干统运） */
const GAN_YUN_WX: Record<string, string> = {
  甲: '土',
  己: '土',
  乙: '金',
  庚: '金',
  丙: '水',
  辛: '水',
  丁: '木',
  壬: '木',
  戊: '火',
  癸: '火',
};

export function buildWuYunLiuQi(yearGan: string, yearZhi: string): WuYunLiuQiData {
  const yun = GAN_YUN[yearGan] ?? { phase: '', qi: '' };
  const tooMuch = TOO_MUCH.has(yearGan);
  const zhongYunNote = tooMuch
    ? `${yearGan}年（阳干）岁运太过，${yun.qi}性偏盛，体质以偏应之。`
    : `${yearGan}年（阴干）岁运不及，${yun.qi}性偏弱，需以调节补不足。`;

  const siTian = ZHI_SITIAN[yearZhi] ?? '';
  const zaiQuan = SITIAN_ZAIQUAN[yearZhi] ?? '';

  // 客气六步：司天位于三之气，初之气 = 司天在三阴三阳序中退两位
  const siTianIdx = QI_ORDER.findIndex((q) => q === siTian);
  const keQi = Array.from({ length: 6 }, (_, i) => {
    const idx = (((siTianIdx - 2 + i) % 6) + 6) % 6;
    return { step: STEP_LABEL[i], qi: QI_ORDER[idx] };
  });

  const zhuQi = ZHU_QI.map((qi, i) => ({ step: STEP_LABEL[i], qi }));

  // 运气相合：天符（岁运五行=司天五行）、岁会（岁运五行=年支五行）、平气
  const zhongYunWx = GAN_YUN_WX[yearGan] ?? '';
  const siTianWx = QI_WUXING[siTian] ?? '';
  const yearZhiWx = ZHI_WUXING[yearZhi] ?? '';
  let xiangHe: { name: string; note: string };
  if (zhongYunWx && siTianWx && zhongYunWx === siTianWx) {
    xiangHe = {
      name: '天符',
      note: `岁运五行（${zhongYunWx}）与司天五行（${siTianWx}）一致，气化极盛，禀赋受气候共振较强，需注意相应的偏性。`,
    };
  } else if (zhongYunWx && yearZhiWx && zhongYunWx === yearZhiWx) {
    xiangHe = {
      name: '岁会',
      note: `岁运五行（${zhongYunWx}）与年支五行（${yearZhiWx}）一致，气化相合而平和，禀赋稳定。`,
    };
  } else if (zhongYunWx) {
    xiangHe = {
      name: '平气',
      note: `岁运（${yun.phase}）与司天（${siTian}）五行不同，气化互有制衡，整体倾向平和。`,
    };
  } else {
    xiangHe = { name: '未定', note: '干支信息不足，运气相合暂不作判断。' };
  }

  return {
    zhongYun: {
      name: yun.phase || '未知',
      phase: tooMuch ? '太过' : '不及',
      qi: yun.qi || '',
      note: zhongYunNote,
    },
    siTian: {
      ganzhi: `${yearGan}${yearZhi}`,
      qi: siTian,
      note: `出生年支${yearZhi}对应司天为${siTian}，主管上半年气化。`,
    },
    zaiQuan: {
      ganzhi: `${yearGan}${yearZhi}`,
      qi: zaiQuan,
      note: `在泉为${zaiQuan}，主管下半年气化，与司天相对。`,
    },
    keQi,
    zhuQi,
    xiangHe,
    note: '五运六气为中医气化框架的文化参考，反映出生时点所禀的大气候底色，不作疾病断言。',
  };
}
