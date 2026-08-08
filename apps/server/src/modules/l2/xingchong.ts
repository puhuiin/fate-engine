/**
 * L2 刑冲合害流派（V1）
 * 考察四柱干支间的天干五合、地支六合/六冲/六害/三刑/三合/三会，
 * 并核对当前大运与命局地支的互动，输出干支关系结构的分析视角。
 * 属传统技法之一，解读均按文化隐喻口径（非宿命论）。
 */
import type { BaziResult } from './bazi.js';

export interface XingChongRelation {
  a: string;
  b: string;
  pos: string;
  desc: string;
}

export interface GanHeRelation extends XingChongRelation {
  hua: string;
}

export interface ZhiHeRelation extends XingChongRelation {
  hua: string;
}

export interface XingRelation extends XingChongRelation {
  kind: string;
}

export interface SanJuRelation {
  zhis: string[];
  pos: string;
  name: string;
  desc: string;
}

export interface DaYunRelation {
  dir: string;
  ganzhi: string;
  kind: string;
  desc: string;
}

export interface XingChongData {
  ganHe: GanHeRelation[];
  zhiHe: ZhiHeRelation[];
  zhiChong: XingChongRelation[];
  zhiHai: XingChongRelation[];
  zhiXing: XingRelation[];
  sanHe: SanJuRelation[];
  sanHui: SanJuRelation[];
  daYunJiao: DaYunRelation[];
  summary: string;
  note: string;
}

const POS = ['年', '月', '日', '时'];
const POS_DESC: Record<string, string> = {
  年月: '早年与原生环境的关联',
  年日: '祖辈根基与自我特质的呼应',
  年时: '先天禀赋与晚景走向的跨度',
  月日: '外界事业与内在心境的张力',
  月时: '事业推进与人生收尾的衔接',
  日时: '自我与家庭、晚运内部的磨合',
};

/** 天干五合：合化五行 */
const GAN_HE: Array<[string, string, string]> = [
  ['甲', '己', '土'],
  ['乙', '庚', '金'],
  ['丙', '辛', '水'],
  ['丁', '壬', '木'],
  ['戊', '癸', '火'],
];

/** 地支六合：合化五行 */
const ZHI_LIUHE: Array<[string, string, string]> = [
  ['子', '丑', '土'],
  ['寅', '亥', '木'],
  ['卯', '戌', '火'],
  ['辰', '酉', '金'],
  ['巳', '申', '水'],
  ['午', '未', '土'],
];

/** 地支六冲 */
const ZHI_CHONG: Array<[string, string]> = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥'],
];

/** 地支六害 */
const ZHI_HAI: Array<[string, string]> = [
  ['子', '未'],
  ['丑', '午'],
  ['寅', '巳'],
  ['卯', '辰'],
  ['申', '亥'],
  ['酉', '戌'],
];

/** 地支三刑 */
const ZHI_XING: Array<[string, string, string, string]> = [
  ['寅', '巳', '申', '无恩之刑'],
  ['丑', '戌', '未', '恃势之刑'],
  ['子', '卯', '无', '无礼之刑'],
];

/** 地支自刑 */
const ZI_XING = ['辰', '午', '酉', '亥'];

/** 地支三合局 */
const ZHI_SANHE: Array<[string, string, string, string]> = [
  ['申', '子', '辰', '水局'],
  ['寅', '午', '戌', '火局'],
  ['巳', '酉', '丑', '金局'],
  ['亥', '卯', '未', '木局'],
];

/** 地支三会方 */
const ZHI_SANHUI: Array<[string, string, string, string]> = [
  ['寅', '卯', '辰', '东方木'],
  ['巳', '午', '未', '南方火'],
  ['申', '酉', '戌', '西方金'],
  ['亥', '子', '丑', '北方水'],
];

function findPair(
  a: string,
  b: string,
  table:
    | Array<[string, string]>
    | Array<[string, string, string]>
    | Array<[string, string, string, string]>,
): boolean {
  const has = (x: string): boolean => x !== '无' && (x === a || x === b);
  return table.some((row) => (row[0] === a && has(row[1])) || (row[0] === b && has(row[1])));
}

function pairHua(a: string, b: string, table: Array<[string, string, string]>): string | null {
  for (const [x, y, hua] of table) {
    if ((a === x && b === y) || (a === y && b === x)) return hua;
  }
  return null;
}

function describe(pos: string, desc: string): string {
  const extra = POS_DESC[pos] ? `（${POS_DESC[pos]}）` : '';
  return `${desc}${extra}`;
}

export function buildXingChong(bazi: BaziResult): XingChongData {
  const gan: string[] = ['year', 'month', 'day', 'time'].map(
    (k) => bazi.pillars[k as keyof typeof bazi.pillars].gan,
  );
  const zhi: string[] = ['year', 'month', 'day', 'time'].map(
    (k) => bazi.pillars[k as keyof typeof bazi.pillars].zhi,
  );

  const ganHe: GanHeRelation[] = [];
  const zhiHe: ZhiHeRelation[] = [];
  const zhiChong: XingChongRelation[] = [];
  const zhiHai: XingChongRelation[] = [];
  const zhiXing: XingRelation[] = [];

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const pos = `${POS[i]}${POS[j]}`;
      const base = describe(pos, '');

      const gh = pairHua(gan[i], gan[j], GAN_HE);
      if (gh) {
        ganHe.push({
          a: gan[i],
          b: gan[j],
          pos,
          hua: gh,
          desc: `${gan[i]}${gan[j]}相合，合化五行${gh}，两干之气相吸凝聚（${base}）。`,
        });
      }

      const zh = pairHua(zhi[i], zhi[j], ZHI_LIUHE);
      if (zh) {
        zhiHe.push({
          a: zhi[i],
          b: zhi[j],
          pos,
          hua: zh,
          desc: `${zhi[i]}${zhi[j]}六合，合化五行${zh}，支气相合而汇聚（${base}）。`,
        });
      }

      if (findPair(zhi[i], zhi[j], ZHI_CHONG)) {
        zhiChong.push({
          a: zhi[i],
          b: zhi[j],
          pos,
          desc: `${zhi[i]}${zhi[j]}相冲，两股力量相对，主变动、搬迁与转折的潜在张力（${base}）。`,
        });
      }

      if (findPair(zhi[i], zhi[j], ZHI_HAI)) {
        zhiHai.push({
          a: zhi[i],
          b: zhi[j],
          pos,
          desc: `${zhi[i]}${zhi[j]}相害，两股力量暗中互损，多体现为隐形的摩擦（${base}）。`,
        });
      }

      for (const [x, y, z, kind] of ZHI_XING) {
        const set = [x, y, z].filter((v) => v !== '无');
        if (set.includes(zhi[i]) && set.includes(zhi[j])) {
          zhiXing.push({
            a: zhi[i],
            b: zhi[j],
            pos,
            kind,
            desc: `${zhi[i]}${zhi[j]}相刑（${kind}），因循束缚之象，易生内耗与反复（${base}）。`,
          });
        }
      }

      if (zhi[i] === zhi[j] && ZI_XING.includes(zhi[i])) {
        zhiXing.push({
          a: zhi[i],
          b: zhi[i],
          pos,
          kind: '自刑',
          desc: `${zhi[i]}${zhi[i]}自刑，自我设限、反复内耗之象（${base}）。`,
        });
      }
    }
  }

  // 三合局 / 三会方：四支中凑齐三者即成立
  const sanHe: SanJuRelation[] = [];
  const sanHui: SanJuRelation[] = [];
  const zhiSet = new Set(zhi);
  for (const [a, b, c, name] of ZHI_SANHE) {
    if ([a, b, c].every((v) => zhiSet.has(v))) {
      sanHe.push({
        zhis: [a, b, c],
        pos: '四柱地支',
        name,
        desc: `${a}${b}${c}三合成${name}，三方之气汇成一局，气势集中。`,
      });
    }
  }
  for (const [a, b, c, fang] of ZHI_SANHUI) {
    if ([a, b, c].every((v) => zhiSet.has(v))) {
      sanHui.push({
        zhis: [a, b, c],
        pos: '四柱地支',
        name: fang,
        desc: `${a}${b}${c}三会${fang}，一方之气齐汇，气势纯而专。`,
      });
    }
  }

  // 当前大运与四柱地支互动
  const daYunJiao: DaYunRelation[] = [];
  const dy = bazi.currentDaYun;
  if (dy) {
    const dyGan = dy.ganzhi.slice(0, 1);
    const dyZhi = dy.ganzhi.slice(1);
    for (let i = 0; i < 4; i++) {
      const pos = POS[i];
      const desc = describe(pos, '');
      const zh = pairHua(dyZhi, zhi[i], ZHI_LIUHE);
      if (zh) {
        daYunJiao.push({
          dir: '大运',
          ganzhi: dy.ganzhi,
          kind: '六合',
          desc: `大运${dy.ganzhi}之${dyZhi}与${pos}柱${zhi[i]}六合（合化${zh}），行运间此支被合而牵动（${desc}）。`,
        });
      }
      if (findPair(dyZhi, zhi[i], ZHI_CHONG)) {
        daYunJiao.push({
          dir: '大运',
          ganzhi: dy.ganzhi,
          kind: '相冲',
          desc: `大运${dy.ganzhi}之${dyZhi}冲${pos}柱${zhi[i]}，此步行运易带动${POS_DESC[pos] ?? '相应宫位'}的变动。`,
        });
      }
      if (findPair(dyZhi, zhi[i], ZHI_HAI)) {
        daYunJiao.push({
          dir: '大运',
          ganzhi: dy.ganzhi,
          kind: '相害',
          desc: `大运${dy.ganzhi}之${dyZhi}害${pos}柱${zhi[i]}，此步行运在${POS_DESC[pos] ?? '相应宫位'}易生隐形摩擦。`,
        });
      }
      for (const [x, y, z] of ZHI_XING) {
        const set = [x, y, z].filter((v) => v !== '无');
        if (set.includes(dyZhi) && set.includes(zhi[i])) {
          daYunJiao.push({
            dir: '大运',
            ganzhi: dy.ganzhi,
            kind: '相刑',
            desc: `大运${dy.ganzhi}之${dyZhi}与${pos}柱${zhi[i]}相刑，此步行运在${POS_DESC[pos] ?? '相应宫位'}易感束缚反复。`,
          });
        }
      }
      if (dyGan && pairHua(dyGan, gan[i], GAN_HE)) {
        daYunJiao.push({
          dir: '大运',
          ganzhi: dy.ganzhi,
          kind: '天干五合',
          desc: `大运${dy.ganzhi}之${dyGan}与${pos}柱${gan[i]}天干相合，此步易与${POS_DESC[pos] ?? '相应宫位'}之力相吸互动。`,
        });
      }
    }
  }

  const summaryParts: string[] = [];
  if (ganHe.length > 0)
    summaryParts.push(
      `天干五合${ganHe.length}处（${ganHe.map((g) => `${g.a}${g.b}`).join('、')}）`,
    );
  if (zhiHe.length > 0)
    summaryParts.push(
      `地支六合${zhiHe.length}处（${zhiHe.map((z) => `${z.a}${z.b}`).join('、')}）`,
    );
  if (zhiChong.length > 0)
    summaryParts.push(
      `六冲${zhiChong.length}处（${zhiChong.map((z) => `${z.a}${z.b}`).join('、')}）`,
    );
  if (zhiHai.length > 0)
    summaryParts.push(`六害${zhiHai.length}处（${zhiHai.map((z) => `${z.a}${z.b}`).join('、')}）`);
  if (zhiXing.length > 0)
    summaryParts.push(
      `三刑/自刑${zhiXing.length}处（${zhiXing.map((z) => `${z.a}${z.b}`).join('、')}）`,
    );
  if (sanHe.length > 0)
    summaryParts.push(`三合局${sanHe.length}（${sanHe.map((s) => s.name).join('、')}）`);
  if (sanHui.length > 0)
    summaryParts.push(`三会方${sanHui.length}（${sanHui.map((s) => s.name).join('、')}）`);
  const summary =
    summaryParts.length > 0
      ? `本命干支关系：${summaryParts.join('；')}。合主凝聚亲和，冲主变动张力，害主隐形损耗，刑主束缚反复；多组关系并存时以日柱相关者为观察重心，具体应事需结合大运流年。`
      : '四柱干支间无明显合冲刑害组合，干支关系结构偏于静态，行运变化时再观其互动。';

  return {
    ganHe,
    zhiHe,
    zhiChong,
    zhiHai,
    zhiXing,
    sanHe,
    sanHui,
    daYunJiao,
    summary,
    note: '刑冲合害属传统技法（天干五合/地支六合/六冲/六害/三刑/三合三会），本层以结构分析视角呈现，不作吉凶宿命判断；与旺衰喜忌、调候用神并行参照，各司其职。',
  };
}
