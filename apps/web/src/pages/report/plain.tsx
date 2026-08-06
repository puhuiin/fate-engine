/**
 * 白话解读辅助组件：把报告里的专业名词翻译成客户能直接看懂的日常用语。
 * 原则：不删术语原文（保留文化感），在术语旁边/折叠块中给出大白话解释。
 */

export interface PlainItem {
  term: string;
  plain: string;
}

/** 行内白话提示：术语后跟一个小字括号解释（<TermPlain term="真太阳时" plain="按地球自转修正后的真实钟点" />） */
export function TermPlain({ term, plain }: PlainItem) {
  return (
    <abbr className="term-plain" title={plain}>
      {term}
    </abbr>
  );
}

/** 折叠式「名词白话对照」表，放在术语密集的层内，默认收起不打断阅读 */
export function PlainGlossary({
  items,
  title = '这些词是什么意思？',
}: {
  items: PlainItem[];
  title?: string;
}) {
  return (
    <details className="plain-glossary">
      <summary>{title}</summary>
      <table className="kv plain-table">
        <tbody>
          {items.map((it) => (
            <tr key={it.term}>
              <td>{it.term}</td>
              <td>{it.plain}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** 通用术语对照表（L1/L2 等专业层共用） */
export const GLOSSARY_L1: PlainItem[] = [
  { term: '钟表时间', plain: '你记录的出生时间（墙上的时钟）' },
  { term: '真太阳时', plain: '按出生地经度修正后的真实天文时间，比钟表时间更贴近太阳位置' },
  { term: '平太阳时', plain: '不修正经度、直接用标准时区的钟表时间' },
  { term: '均时差', plain: '地球公转轨道不圆导致的「时钟与太阳」每天几十秒的日常偏差' },
  { term: '时辰', plain: '古代把一天分成 12 段，每段约 2 小时，与你出生的时间区间对应' },
  { term: '四柱', plain: '年、月、日、时四组干支，传统命理据此排盘，视为「出生时刻的四个坐标」' },
  { term: '干支', plain: '由天干（甲乙丙丁…）与地支（子丑寅卯…）组合成的 60 个循环代号' },
  { term: '藏干', plain: '地支里「藏着」的五行，传统认为它们会影响性格与运势' },
];

export const GLOSSARY_L2: PlainItem[] = [
  { term: '日主', plain: '出生那天的天干，传统认为代表「你自己」，是全盘的中心' },
  { term: '十神', plain: '把其他天干与日主的关系分成十种称谓，用于描述「性格角色」' },
  { term: '纳音', plain: '古代把干支配成的 30 种声音取象，属于文化意象，不参与科学结论' },
  { term: '长生（十二宫）', plain: '描述五行「生长到消亡」的十二个阶段，是传统的状态比喻' },
  { term: '旬空', plain: '六旬中某两个地支「轮空」的日期标记，民间多用于择日，仅供参考' },
  { term: '胎元 / 命宫', plain: '传统推演出的两个辅助坐标，用于补充解读，不影响主结论' },
  { term: '大运', plain: '传统认为人每约 10 年进入一个新的「运程阶段」，此处仅作阶段节奏参考' },
  { term: '五行', plain: '金木水火土，传统用其生克关系描述性格与行事的文化隐喻' },
];

/** 白话导读：把各层的关键结论汇总成客户看得懂的条目 */
export interface PlainPoint {
  tag: string;
  title: string;
  text: string;
}

export function buildPlainGuide(p: {
  trueSolar?: string;
  personality?: Array<{ dimension: string; score: number; desc: string }>;
  strengths?: string[];
  growth?: string[];
  lines?: Array<{ name: string; fit: number; strategy: string }>;
  mainKnot?: string;
  synthesis?: string[];
  essence?: string;
  risk?: string;
}): PlainPoint[] {
  const points: PlainPoint[] = [];

  if (p.trueSolar) {
    points.push({
      tag: '基础',
      title: '你的出生时间已校正',
      text: `按出生地修正后的真实钟点为 ${p.trueSolar}，后续结论均以此为准。`,
    });
  }

  if (p.personality && p.personality.length > 0) {
    const top = [...p.personality].sort((a, b) => b.score - a.score)[0];
    points.push({
      tag: '性格',
      title: `最突出的特质：${top.dimension}`,
      text: top.desc,
    });
  }

  if (p.strengths && p.strengths.length > 0) {
    points.push({
      tag: '天赋',
      title: '天生优势',
      text: p.strengths.slice(0, 3).join('；'),
    });
  }

  if (p.growth && p.growth.length > 0) {
    points.push({
      tag: '成长',
      title: '值得主动培养的方向',
      text: p.growth.slice(0, 3).join('；'),
    });
  }

  if (p.lines && p.lines.length > 0) {
    const byFit = [...p.lines].sort((a, b) => b.fit - a.fit);
    points.push({
      tag: '多线',
      title: '四条命运线的契合参考',
      text: byFit
        .slice(0, 4)
        .map((l) => `${l.name}（契合 ${l.fit}）：${l.strategy}`)
        .join('；'),
    });
  }

  if (p.mainKnot) {
    points.push({
      tag: '卡点',
      title: '当下最该留意的内在卡点',
      text: p.mainKnot,
    });
  }

  if (p.synthesis && p.synthesis.length > 0) {
    points.push({
      tag: '结论',
      title: '综合结论（一句话）',
      text: p.synthesis[0],
    });
  }

  if (p.essence) {
    points.push({
      tag: '要义',
      title: '这一生的核心课题',
      text: p.essence,
    });
  }

  if (p.risk) {
    points.push({
      tag: '提醒',
      title: '需留意的提醒',
      text: p.risk,
    });
  }

  return points;
}
