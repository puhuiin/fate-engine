/**
 * L2 深度术数维度（V2 新增）
 * 在基础排盘之上提供确定性结构化维度：格局法、用神喜忌、神煞落宫、
 * 地支刑冲合害、十二长生、藏干透干。全部为纯函数，同输入同输出；
 * 文案一律倾向性参考 + 祛魅，不输出绝对吉凶断言。
 */
import type { BaziResult } from './bazi.js';

/** 天干顺序索引（甲0..癸9），地支顺序索引（子0..丑12） */
const GAN_INDEX: Record<string, number> = {
  甲: 0,
  乙: 1,
  丙: 2,
  丁: 3,
  戊: 4,
  己: 5,
  庚: 6,
  辛: 7,
  壬: 8,
  癸: 9,
};
const ZHI_INDEX: Record<string, number> = {
  子: 0,
  丑: 1,
  寅: 2,
  卯: 3,
  辰: 4,
  巳: 5,
  午: 6,
  未: 7,
  申: 8,
  酉: 9,
  戌: 10,
  亥: 11,
};

const SHI_ER_STAGES = [
  '长生',
  '沐浴',
  '冠带',
  '临官',
  '帝旺',
  '衰',
  '病',
  '死',
  '墓',
  '绝',
  '胎',
  '养',
];

/** 五行相生：生我者（如金生水，生'水'者为'金'） */
const SHENG_WO: Record<string, string> = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
/** 五行相生：我生者 */
const WO_SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克：克我者 */
const KE_WO: Record<string, string> = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };
/** 五行相克：我克者 */
const WO_KE: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
/** 五行顺序（并列时优先级） */
const WX_ORDER = ['木', '火', '土', '金', '水'];

const GE_JU_MAIN: Record<string, string> = {
  正官: '正官格',
  七杀: '七杀格',
  正印: '正印格',
  偏印: '偏印格',
  正财: '正财格',
  偏财: '偏财格',
  食神: '食神格',
  伤官: '伤官格',
};

/** 建禄（禄神）：天干 → 地支 */
const LU_ZHI: Record<string, string> = {
  甲: '寅',
  乙: '卯',
  丙: '巳',
  丁: '午',
  戊: '巳',
  己: '午',
  庚: '申',
  辛: '酉',
  壬: '亥',
  癸: '子',
};

/** 羊刃：天干 → 地支 */
const YANG_REN_ZHI: Record<string, string> = {
  甲: '卯',
  乙: '辰',
  丙: '午',
  丁: '未',
  戊: '午',
  己: '未',
  庚: '酉',
  辛: '戌',
  壬: '子',
  癸: '丑',
};

/** 天乙贵人：日干 → 地支组（天/地） */
const TIAN_YI_GUI_REN: Record<string, string[]> = {
  甲: ['丑', '未'],
  戊: ['丑', '未'],
  庚: ['丑', '未'],
  乙: ['子', '申'],
  己: ['子', '申'],
  丙: ['亥', '酉'],
  丁: ['亥', '酉'],
  壬: ['卯', '巳'],
  癸: ['卯', '巳'],
  辛: ['午', '寅'],
};

/** 三合局：日支所在局 → 该局四要素 */
interface SanHe {
  zi: string[];
  tao: string;
  ma: string;
  hua: string;
  jiang: string;
}
const SAN_HE: Record<string, SanHe> = {
  申: { zi: ['申', '子', '辰'], tao: '酉', ma: '寅', hua: '辰', jiang: '子' },
  子: { zi: ['申', '子', '辰'], tao: '酉', ma: '寅', hua: '辰', jiang: '子' },
  辰: { zi: ['申', '子', '辰'], tao: '酉', ma: '寅', hua: '辰', jiang: '子' },
  寅: { zi: ['寅', '午', '戌'], tao: '卯', ma: '申', hua: '戌', jiang: '午' },
  午: { zi: ['寅', '午', '戌'], tao: '卯', ma: '申', hua: '戌', jiang: '午' },
  戌: { zi: ['寅', '午', '戌'], tao: '卯', ma: '申', hua: '戌', jiang: '午' },
  巳: { zi: ['巳', '酉', '丑'], tao: '午', ma: '亥', hua: '丑', jiang: '酉' },
  酉: { zi: ['巳', '酉', '丑'], tao: '午', ma: '亥', hua: '丑', jiang: '酉' },
  丑: { zi: ['巳', '酉', '丑'], tao: '午', ma: '亥', hua: '丑', jiang: '酉' },
  亥: { zi: ['亥', '卯', '未'], tao: '子', ma: '巳', hua: '未', jiang: '卯' },
  卯: { zi: ['亥', '卯', '未'], tao: '子', ma: '巳', hua: '未', jiang: '卯' },
  未: { zi: ['亥', '卯', '未'], tao: '子', ma: '巳', hua: '未', jiang: '卯' },
};

/** 六冲 */
const CHONG: Record<string, string> = {
  子: '午',
  午: '子',
  丑: '未',
  未: '丑',
  寅: '申',
  申: '寅',
  卯: '酉',
  酉: '卯',
  辰: '戌',
  戌: '辰',
  巳: '亥',
  亥: '巳',
};
/** 六合 */
const HE: Record<string, string> = {
  子: '丑',
  丑: '子',
  寅: '亥',
  亥: '寅',
  卯: '戌',
  戌: '卯',
  辰: '酉',
  酉: '辰',
  巳: '申',
  申: '巳',
  午: '未',
  未: '午',
};
/** 三刑组合（数组内互为三刑） */
const XING_GROUPS: string[][] = [
  ['寅', '巳', '申'],
  ['丑', '戌', '未'],
  ['子', '卯'],
  ['辰', '午', '酉', '亥'],
];
/** 六害 */
const HAI: Record<string, string> = {
  子: '未',
  未: '子',
  丑: '午',
  午: '丑',
  寅: '巳',
  巳: '寅',
  卯: '辰',
  辰: '卯',
  申: '亥',
  亥: '申',
  酉: '戌',
  戌: '酉',
};

/** 阳干（顺行十二长生） */
const YANG_GAN = ['甲', '丙', '戊', '庚', '壬'];
/** 阳干长生位：甲亥、丙寅、戊寅、庚巳、壬申 */
const YANG_CHANG_SHENG: Record<string, number> = { 甲: 11, 丙: 2, 戊: 2, 庚: 5, 壬: 8 };
/** 阴干长生位：乙午、丁酉、己酉、辛子、癸卯 */
const YIN_CHANG_SHENG: Record<string, number> = { 乙: 6, 丁: 9, 己: 9, 辛: 0, 癸: 3 };

export interface GeJuResult {
  name: string;
  mainShiShen: string;
  transGan: string | null;
  monthZhi: string;
  note: string;
}

export interface YongShenResult {
  method: string;
  yong: string;
  xi: string;
  ji: string;
  tiaoHou: string;
  note: string;
}

export interface ShenShaResult {
  name: string;
  position: string;
  zi: string;
}

export interface XingChongResult {
  type: string;
  a: string;
  b: string;
}

export interface ShiErChangShengResult {
  positions: Array<{ position: string; zhi: string; stage: string; tendency: string }>;
}

export interface TouGanResult {
  position: string;
  hideGan: string[];
  tou: string[];
}

export interface DeepAnalysis {
  geju: GeJuResult;
  yongShen: YongShenResult;
  shenSha: ShenShaResult[];
  xingChong: XingChongResult[];
  shiErChangSheng: ShiErChangShengResult;
  touGan: TouGanResult[];
}

const POSITION_NAMES: Record<string, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  time: '时柱',
};

/** 日主在指定地支的十二长生状态（阳顺阴逆，从长生位偏移） */
export function shiErChangShengOf(dayGan: string, zhi: string): string {
  const zi = ZHI_INDEX[zhi];
  if (GAN_INDEX[dayGan] === undefined || zi === undefined) return '';
  if (YANG_GAN.includes(dayGan)) {
    const base = YANG_CHANG_SHENG[dayGan];
    return SHI_ER_STAGES[(zi - base + 12) % 12];
  }
  const base = YIN_CHANG_SHENG[dayGan];
  return SHI_ER_STAGES[(base - zi + 12) % 12];
}

/** 格局法：月令取格（透干优先；建禄/羊刃格最优先） */
export function resolveGeJu(bazi: BaziResult): GeJuResult {
  const month = bazi.pillars.month;
  const monthZhi = month.zhi;
  const dayGan = bazi.dayMaster.gan;

  if (YANG_REN_ZHI[dayGan] === monthZhi) {
    return {
      name: '羊刃格',
      mainShiShen: '羊刃',
      transGan: null,
      monthZhi,
      note: `月令为日主${dayGan}之羊刃位，属外格（羊刃格）。传统取象认为羊刃主刚锐果决，但需制化得宜；此为文化参考，具体须结合大运流年综合研判。`,
    };
  }
  if (LU_ZHI[dayGan] === monthZhi) {
    return {
      name: '建禄格',
      mainShiShen: '建禄',
      transGan: null,
      monthZhi,
      note: `月令为日主${dayGan}之禄位，属建禄格。传统取象认为月令得禄、自立自强，喜透官杀或食伤引导；此为文化参考，须结合全局综合研判。`,
    };
  }

  const hide = month.hideGan;
  const shishenByHide = month.shishenZhi;
  const dayGans = [bazi.pillars.year.gan, bazi.pillars.month.gan, bazi.pillars.day.gan, bazi.pillars.time.gan];

  // 透干优先：月支藏干中，最先出现在四柱天干者成格
  let transGan: string | null = null;
  let mainShiShen = '';
  let name = '';
  for (let i = 0; i < hide.length; i++) {
    if (dayGans.includes(hide[i])) {
      transGan = hide[i];
      mainShiShen = shishenByHide[i] ?? '';
      name = GE_JU_MAIN[mainShiShen] ?? `${mainShiShen}格`;
      break;
    }
  }
  if (!transGan) {
    mainShiShen = shishenByHide[0] ?? '';
    name = GE_JU_MAIN[mainShiShen] ?? `${mainShiShen}格`;
  }

  const transNote = transGan
    ? `月支${monthZhi}藏干${hide.join('/')}，其中「${transGan}」透出天干，以${mainShiShen}成格（透干成格）。`
    : `月支${monthZhi}本气为「${hide[0] ?? ''}」，对应日主之${mainShiShen}，以本气成格。`;
  return {
    name,
    mainShiShen,
    transGan,
    monthZhi,
    note: `${transNote} 传统命理以格局作命局层次参考，但格局高低须结合五行生克、刑冲合害与大运流年综合研判；此为文化参考，不作宿命断言。`,
  };
}

/** 用神喜忌：扶抑补缺法 + 季节调候 */
export function resolveYongShen(bazi: BaziResult): YongShenResult {
  const dayWx = bazi.dayMaster.wuxing;
  const wc = bazi.wuxingCount;

  // 克泄耗（我克/克我/我生）与生扶（生我/同我）
  const keXieHao = [WO_KE[dayWx], KE_WO[dayWx], WO_SHENG[dayWx]].filter((x): x is string => !!x);
  const shengFu = [SHENG_WO[dayWx], dayWx];

  const monthZhi = bazi.pillars.month.zhi;
  const monthIndex = ZHI_INDEX[monthZhi] ?? 0;
  // 季节：亥子丑=冬(11,0,1) 巳午未=夏(5,6,7)
  const isWinter = monthIndex === 11 || monthIndex === 0 || monthIndex === 1;
  const isSummer = monthIndex === 5 || monthIndex === 6 || monthIndex === 7;

  let method = '';
  let yong = '';
  if (bazi.strength === '偏旺') {
    method = '扶抑（偏旺取克泄耗补缺）';
    const sorted = [...keXieHao].sort((a, b) => (wc[a] ?? 0) - (wc[b] ?? 0));
    yong = sorted[0];
  } else if (bazi.strength === '偏弱') {
    method = '扶抑（偏弱取生扶补缺）';
    const sorted = [...shengFu].sort((a, b) => (wc[a] ?? 0) - (wc[b] ?? 0));
    yong = sorted[0];
  } else {
    method = '中和取调候/补缺';
    if (isWinter) yong = '火';
    else if (isSummer) yong = '水';
    else {
      const all = WX_ORDER.filter((w) => w !== dayWx);
      yong = all.sort((a, b) => (wc[a] ?? 0) - (wc[b] ?? 0))[0];
    }
  }

  const xi = SHENG_WO[yong] ?? '';
  const ji = yong ? [KE_WO[yong], WO_KE[yong]].filter(Boolean) : [];

  let tiaoHou = '';
  if (isWinter) {
    tiaoHou = '冬生需调候：火暖局（寒金需丙丁之火）';
  } else if (isSummer) {
    tiaoHou = '夏生需调候：水润局（炎土需壬癸之水）';
  } else {
    tiaoHou = '春/秋生调候需求平缓';
  }

  return {
    method,
    yong,
    xi: xi || '—',
    ji: ji.length > 0 ? ji.join('、') : '—',
    tiaoHou,
    note: `扶抑法以日主${bazi.dayMaster.gan}（五行${dayWx}，命局${bazi.strength}）为坐标，取「${yong}」为用神倾向；喜「${xi || '—'}」，忌「${ji.join('、') || '—'}」。${tiaoHou}。用神喜忌为传统文化参考工具，反映五行平衡的象征性提示，不作为实际决策依据。`,
  };
}

/** 神煞落宫：仅报告落入四柱天干/地支者 */
export function resolveShenSha(bazi: BaziResult): ShenShaResult[] {
  const dayGan = bazi.dayMaster.gan;
  const dayZhi = bazi.pillars.day.zhi;
  const result: ShenShaResult[] = [];
  const add = (name: string, zhi: string) => {
    for (const key of ['year', 'month', 'day', 'time'] as const) {
      const p = bazi.pillars[key];
      if (p.zhi === zhi || p.gan === zhi) {
        result.push({ name, position: POSITION_NAMES[key], zi: p.zhi === zhi ? p.zhi : p.gan });
      }
    }
  };

  for (const g of TIAN_YI_GUI_REN[dayGan] ?? []) add('天乙贵人', g);
  const sh = SAN_HE[dayZhi];
  if (sh) {
    add('桃花', sh.tao);
    add('驿马', sh.ma);
    add('华盖', sh.hua);
    add('将星', sh.jiang);
  }
  const lu = LU_ZHI[dayGan];
  if (lu) add('禄神', lu);
  const yr = YANG_REN_ZHI[dayGan];
  if (yr) add('羊刃', yr);

  return result;
}

/** 地支刑冲合害：四柱地支两两配对 */
export function resolveXingChong(bazi: BaziResult): XingChongResult[] {
  const zhis = (['year', 'month', 'day', 'time'] as const).map((k) => ({
    position: POSITION_NAMES[k],
    zhi: bazi.pillars[k].zhi,
  }));
  const out: XingChongResult[] = [];
  for (let i = 0; i < zhis.length; i++) {
    for (let j = i + 1; j < zhis.length; j++) {
      const a = zhis[i];
      const b = zhis[j];
      const aLabel = `${a.position}${a.zhi}`;
      const bLabel = `${b.position}${b.zhi}`;
      if (CHONG[a.zhi] === b.zhi) out.push({ type: '六冲', a: aLabel, b: bLabel });
      else if (HE[a.zhi] === b.zhi) out.push({ type: '六合', a: aLabel, b: bLabel });
      else if (HAI[a.zhi] === b.zhi) out.push({ type: '六害', a: aLabel, b: bLabel });
      else {
        for (const group of XING_GROUPS) {
          if (group.includes(a.zhi) && group.includes(b.zhi)) {
            out.push({ type: '相刑', a: aLabel, b: bLabel });
            break;
          }
        }
      }
    }
  }
  // 三合局：三支齐
  const zhiSet = new Set(zhis.map((z) => z.zhi));
  for (const key of Object.keys(SAN_HE)) {
    if (SAN_HE[key].zi.every((z) => zhiSet.has(z))) {
      const present = SAN_HE[key].zi.filter((z) => zhiSet.has(z));
      out.push({ type: '三合', a: present.join(''), b: '' });
      break;
    }
  }
  return out;
}

/** 十二长生：日主在四柱支 + 当前大运支 */
export function resolveShiErChangSheng(bazi: BaziResult): ShiErChangShengResult {
  const positions: ShiErChangShengResult['positions'] = [];
  const push = (position: string, zhi: string) => {
    if (!zhi) return;
    const stage = shiErChangShengOf(bazi.dayMaster.gan, zhi);
    const tendency =
      stage === '长生' || stage === '临官' || stage === '帝旺'
        ? '得地'
        : stage === '衰' || stage === '病' || stage === '死' || stage === '墓'
          ? '需养'
          : '平稳';
    positions.push({ position, zhi, stage, tendency });
  };
  for (const key of ['year', 'month', 'day', 'time'] as const) {
    push(POSITION_NAMES[key], bazi.pillars[key].zhi);
  }
  const dy = bazi.currentDaYun?.ganzhi?.[1];
  if (dy) push('当前大运', dy);
  return { positions };
}

/** 藏干透干 */
export function resolveTouGan(bazi: BaziResult): TouGanResult[] {
  const dayGans = [bazi.pillars.year.gan, bazi.pillars.month.gan, bazi.pillars.day.gan, bazi.pillars.time.gan];
  return (['year', 'month', 'day', 'time'] as const).map((k) => {
    const p = bazi.pillars[k];
    return {
      position: POSITION_NAMES[k],
      hideGan: p.hideGan,
      tou: p.hideGan.filter((g) => dayGans.includes(g)),
    };
  });
}

export function runDeepAnalysis(bazi: BaziResult): DeepAnalysis {
  return {
    geju: resolveGeJu(bazi),
    yongShen: resolveYongShen(bazi),
    shenSha: resolveShenSha(bazi),
    xingChong: resolveXingChong(bazi),
    shiErChangSheng: resolveShiErChangSheng(bazi),
    touGan: resolveTouGan(bazi),
  };
}
