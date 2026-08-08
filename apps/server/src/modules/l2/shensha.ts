/**
 * L2 术数算力池 - 神煞格局流派（V1）
 * 以日干/年支/月支为主查神煞，标识落在四柱哪一支（或哪一干），并给出文化隐喻解读。
 * 全部为表驱动确定性算法；解读遵循祛魅口径（文化隐喻，非宿命论）。
 */
import type { BaziResult } from './bazi.js';

export interface ShenShaStar {
  name: string;
  /** 落宫柱位（year/month/day/time） */
  pillar: string;
  /** 命中的干支字符（地支神煞为支，天干神煞为干） */
  at: string;
  note: string;
}

export interface ShenShaGroup {
  group: string;
  stars: ShenShaStar[];
  interpretation: string;
}

export interface ShenShaData {
  groups: ShenShaGroup[];
  /** 口径说明（主流神煞以日干为主、年支辅助） */
  note: string;
}

const PILLAR_LABEL: Record<string, string> = {
  year: '年',
  month: '月',
  day: '日',
  time: '时',
};

/** 三合局：以年支查桃花/驿马/华盖 */
const SANHE: Record<string, { tao: string; yi: string; gai: string }> = {
  申: { tao: '酉', yi: '寅', gai: '辰' },
  子: { tao: '酉', yi: '寅', gai: '辰' },
  辰: { tao: '酉', yi: '寅', gai: '辰' },
  寅: { tao: '卯', yi: '申', gai: '戌' },
  午: { tao: '卯', yi: '申', gai: '戌' },
  戌: { tao: '卯', yi: '申', gai: '戌' },
  巳: { tao: '午', yi: '亥', gai: '丑' },
  酉: { tao: '午', yi: '亥', gai: '丑' },
  丑: { tao: '午', yi: '亥', gai: '丑' },
  亥: { tao: '子', yi: '巳', gai: '未' },
  卯: { tao: '子', yi: '巳', gai: '未' },
  未: { tao: '子', yi: '巳', gai: '未' },
};

/** 孤辰寡宿：以年支三会查 */
const GUCHEN_GUSU: Record<string, { gu: string; guSu: string }> = {
  亥: { gu: '寅', guSu: '戌' },
  子: { gu: '寅', guSu: '戌' },
  丑: { gu: '寅', guSu: '戌' },
  寅: { gu: '巳', guSu: '丑' },
  卯: { gu: '巳', guSu: '丑' },
  辰: { gu: '巳', guSu: '丑' },
  巳: { gu: '申', guSu: '辰' },
  午: { gu: '申', guSu: '辰' },
  未: { gu: '申', guSu: '辰' },
  申: { gu: '亥', guSu: '未' },
  酉: { gu: '亥', guSu: '未' },
  戌: { gu: '亥', guSu: '未' },
};

/** 天乙贵人（按日干）：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，庚辛逢马虎 */
const TIANYI: Record<string, string[]> = {
  甲: ['丑', '未'],
  戊: ['丑', '未'],
  庚: ['丑', '未'],
  乙: ['子', '申'],
  己: ['子', '申'],
  丙: ['亥', '酉'],
  丁: ['亥', '酉'],
  壬: ['卯', '巳'],
  癸: ['卯', '巳'],
  辛: ['寅', '午'],
};

/** 文昌贵人（按日干）：甲乙巳午报君知，丙戊申宫丁己鸡，庚猪辛鼠壬逢虎，癸人见卯入云梯 */
const WENCHANG: Record<string, string> = {
  甲: '巳',
  乙: '午',
  丙: '申',
  戊: '申',
  丁: '酉',
  己: '酉',
  庚: '亥',
  辛: '子',
  壬: '寅',
  癸: '卯',
};

/** 禄神（按日干） */
const LUSHEN: Record<string, string> = {
  甲: '寅',
  乙: '卯',
  丙: '巳',
  戊: '巳',
  丁: '午',
  己: '午',
  庚: '申',
  辛: '酉',
  壬: '亥',
  癸: '子',
};

/** 羊刃（阳干取帝旺；阴干按主流不取） */
const YANGREN: Record<string, string> = {
  甲: '卯',
  丙: '午',
  戊: '午',
  庚: '酉',
  壬: '子',
};

/** 金舆（按日干）：甲龙乙蛇丙戊羊，丁己猴歌庚犬方，辛猪壬牛癸逢虎 */
const JINYU: Record<string, string> = {
  甲: '辰',
  乙: '巳',
  丙: '未',
  戊: '未',
  丁: '申',
  己: '申',
  庚: '戌',
  辛: '亥',
  壬: '丑',
  癸: '寅',
};

/** 天德（按月支）：正丁二坤宫，三壬四辛同，五亥六甲上，七癸八艮中，九丙十居乙，子巽丑庚中 */
const TIANDE: Record<string, string> = {
  寅: '丁',
  卯: '申',
  辰: '壬',
  巳: '辛',
  午: '亥',
  未: '甲',
  申: '癸',
  酉: '寅',
  戌: '丙',
  亥: '乙',
  子: '巳',
  丑: '庚',
};

/** 月德（按月支三合）：寅午戌月丙，申子辰月壬，亥卯未月甲，巳酉丑月庚 */
const YUEDE: Record<string, string> = {
  寅: '丙',
  午: '丙',
  戌: '丙',
  申: '壬',
  子: '壬',
  辰: '壬',
  亥: '甲',
  卯: '甲',
  未: '甲',
  巳: '庚',
  酉: '庚',
  丑: '庚',
};

/** 魁罡（按日柱）：庚辰/庚戌/壬辰/戊戌 */
const KUIJIANG = new Set(['庚辰', '庚戌', '壬辰', '戊戌']);

const STAR_NOTES: Record<string, string> = {
  天乙贵人: '贵人星，主逢难有助、易得赏识与提携，为吉星之首。',
  文昌贵人: '主文思敏捷、学习与表达之才，利考试著述与智识发展。',
  禄神: '主衣食之禄与稳定资源，象征事业根基与财务来源。',
  羊刃: '主果断刚烈、行动力强，也主个性锐利，需防冲动失衡。',
  金舆: '主福荫与出行庇佑，象征体面与身后支持。',
  天德: '主仁厚顺遂，遇事多有化解之机，为德星。',
  月德: '主心地宽和、福泽随身，与天德并称二德。',
  魁罡: '主刚决爽朗、办事利落，也主傲气，宜修涵养。',
  桃花: '主魅力与人缘，象征社交吸引力与情感际遇的多样性。',
  驿马: '主动态机遇，主迁移、变动、奔波中见机会。',
  华盖: '主孤高内省、艺术哲学倾向，好玄学思辨。',
  孤辰: '主内心独立的倾向，情感表达偏内敛。',
  寡宿: '主对独处的适应力，人际亲密度节奏偏慢。',
};

/** 命中目标：地支神煞查四柱支，天干神煞查四柱干 */
function findStar(
  bazi: BaziResult,
  name: string,
  targets: { gan?: string[]; zhi?: string[] },
): ShenShaStar[] {
  const hits: ShenShaStar[] = [];
  const pillars = bazi.pillars;
  (['year', 'month', 'day', 'time'] as const).forEach((p) => {
    if (targets.zhi?.includes(pillars[p].zhi)) {
      hits.push({
        name,
        pillar: PILLAR_LABEL[p] + '支',
        at: pillars[p].zhi,
        note: STAR_NOTES[name] ?? '',
      });
    }
    if (targets.gan?.includes(pillars[p].gan)) {
      hits.push({
        name,
        pillar: PILLAR_LABEL[p] + '干',
        at: pillars[p].gan,
        note: STAR_NOTES[name] ?? '',
      });
    }
  });
  return hits;
}

const GAN_SET = new Set(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
const isGan = (c: string): boolean => GAN_SET.has(c);

const star = {
  zhi: (v: string | string[]) => ({ zhi: Array.isArray(v) ? v : [v] }),
  gan: (v: string) => ({ gan: [v] }),
};

export function buildShenSha(bazi: BaziResult): ShenShaData {
  const dayGan = bazi.dayMaster.gan;
  const yearZhi = bazi.pillars.year.zhi;
  const monthZhi = bazi.pillars.month.zhi;
  const dayGanzhi = bazi.pillars.day.ganzhi;

  const tianyi = findStar(bazi, '天乙贵人', star.zhi(TIANYI[dayGan] ?? []));
  const wenchang = findStar(bazi, '文昌贵人', star.zhi(WENCHANG[dayGan] ?? ''));
  const lushen = findStar(bazi, '禄神', star.zhi(LUSHEN[dayGan] ?? ''));
  const yangren = findStar(bazi, '羊刃', star.zhi(YANGREN[dayGan] ?? ''));
  const jinyu = findStar(bazi, '金舆', star.zhi(JINYU[dayGan] ?? ''));

  const sanhe = SANHE[yearZhi];
  const tao = sanhe ? findStar(bazi, '桃花', star.zhi(sanhe.tao)) : [];
  const yi = sanhe ? findStar(bazi, '驿马', star.zhi(sanhe.yi)) : [];
  const gai = sanhe ? findStar(bazi, '华盖', star.zhi(sanhe.gai)) : [];

  const guChen = GUCHEN_GUSU[yearZhi];
  const gu = guChen ? findStar(bazi, '孤辰', star.zhi(guChen.gu)) : [];
  const guSu = guChen ? findStar(bazi, '寡宿', star.zhi(guChen.guSu)) : [];

  const tianDe = findStar(
    bazi,
    '天德',
    isGan(TIANDE[monthZhi] ?? '') ? star.gan(TIANDE[monthZhi]) : star.zhi(TIANDE[monthZhi] ?? ''),
  );
  const yueDe = findStar(bazi, '月德', star.gan(YUEDE[monthZhi] ?? ''));
  const kuiGang = KUIJIANG.has(dayGanzhi)
    ? [
        {
          name: '魁罡',
          pillar: '日柱',
          at: dayGanzhi,
          note: STAR_NOTES['魁罡'] ?? '',
        },
      ]
    : [];

  const groupsDef = [
    {
      group: '贵人组',
      stars: [...tianyi, ...tianDe, ...yueDe],
      interpretation: '贵人组以日干天乙与月支天德、月德合参，主贵人缘与顺遂度，吉星多重者遇事多有人助。',
    },
    {
      group: '资源组',
      stars: [...lushen, ...yangren, ...jinyu],
      interpretation: '资源组看禄神、羊刃与金舆，禄主根基稳定、刃主进取锐度、舆主体面支持，刚柔相济为佳。',
    },
    {
      group: '智识组',
      stars: [...wenchang, ...kuiGang],
      interpretation: '智识组看文昌与魁罡，文昌利文思学习，魁罡主刚决爽朗，文质相兼则表达有力。',
    },
    {
      group: '人际组',
      stars: [...tao, ...gu, ...guSu],
      interpretation: '人际组看桃花与孤辰寡宿，桃花主魅力流动，孤寡主独立节律，二者平衡则外圆内方。',
    },
    {
      group: '动态组',
      stars: [...yi, ...gai],
      interpretation: '动态组看驿马与华盖，驿马主变动机遇、华盖主静深内省，动静相参见人生节奏。',
    },
  ];

  const nonEmpty = groupsDef.filter((g) => g.stars.length > 0);

  return {
    groups:
      nonEmpty.length > 0
        ? nonEmpty
        : [
            {
              group: '神煞概览',
              stars: [],
              interpretation: '本命未见显著神煞组合，以常规五行十神论断为主。',
            },
          ],
    note: '神煞以日干查天乙/文昌/禄神/羊刃/金舆，以月支查天德/月德，以年支查桃花/驿马/华盖/孤辰寡宿；传统文化隐喻参考，不作宿命判断。',
  };
}
