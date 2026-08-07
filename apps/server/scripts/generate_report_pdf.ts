/**
 * 全量推演报告 PDF 生成（测试案例专用）。
 * 以 verify_all.ts 主用例（2002-11-29 20:40 北京 男 certificate）跑通 L1-L9，
 * 用 pdfkit（全局安装）渲染为排版完整的中文 PDF。
 *
 * 运行：npx tsx scripts/generate_report_pdf.ts
 * 依赖：全局 npm 包 pdfkit；系统字体 /usr/share/fonts/truetype/wqy/wqy-zenhei-ext.ttf
 *       （由 wqy-zenhei.ttc 用 fontTools 提取的 ttf，含 ASCII + 全量 CJK，避免缺字乱码）
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runL1, type L1Output } from '../src/modules/l1/l1.js';
import { runL2, type L2Output } from '../src/modules/l2/l2.js';
import { runL3, type L3Output } from '../src/modules/l3/l3.js';
import { runL4, type L4Output } from '../src/modules/l4/l4.js';
import { runL5, type L5Output } from '../src/modules/l5/l5.js';
import { runL6, type L6Output } from '../src/modules/l6/l6.js';
import { runL7, type L7Output } from '../src/modules/l7/l7.js';
import { runL8, type L8Output } from '../src/modules/l8/l8.js';
import { runL9, type L9Output } from '../src/modules/l9/l9.js';
import type { BaziResult } from '../src/modules/l2/bazi.js';
import { buildNineLayerReport, type NineLayerReportItem } from '../src/report.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const globalRoot = execSync('npm root -g').toString().trim();
const PDFDocument = require(path.join(globalRoot, 'pdfkit'));

const FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei-ext.ttf';
const FONT_BOLD = FONT;

const GOLD = '#b8860b';
const GOLD_LIGHT = '#f7f3e7';
const DARK = '#1a1a1a';
const MID = '#333333';
const GRAY = '#888888';

const SOURCE_LABEL: Record<string, string> = {
  certificate: '证件',
  family: '家人转述',
  estimate: '估算',
  unknown: '未知',
};

/** L2 次级流派 data 字段的中文标签 */
const SCHOOL_KEY_LABEL: Record<string, string> = {
  yearNaYin: '年柱纳音',
  dayNaYin: '日柱纳音',
  dayNaYinWuXing: '日柱纳音五行',
  profile: '性格画像',
};

const CASE = {
  solarDate: '2002-11-29',
  solarTime: '20:40',
  timePrecision: 'minute' as const,
  sourceReliability: 'certificate' as const,
  cityName: '北京',
  timezoneOffset: 8,
  gender: 'male' as const,
  currentYear: 2026,
};

const availWidth = (doc: PDFKit.PDFDocument): number =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;

// ---------------- 五行喜忌分析（纯渲染推导，不改变模块输出） ----------------

const WX_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' } as const; // 我生（食伤）
const WX_SHENGME = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' } as const; // 生我（印）
const WX_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' } as const; // 我克（财）
const WX_KEME = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' } as const; // 克我（官杀）

interface XiJiAnalysis {
  strength: string;
  day: string;
  xi: string[];
  ji: string[];
  missing: string[];
  weakest: [string, number];
  strongest: [string, number];
  note: string;
}

/** 依据日主旺衰推导喜忌：偏旺宜克泄耗、偏弱宜生扶、中和补最弱 */
function analyzeXiJi(bazi: BaziResult): XiJiAnalysis {
  const day = bazi.dayMaster.wuxing;
  const wc = bazi.wuxingCount;
  const sorted = Object.entries(wc).sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0] as [string, number];
  const strongest = sorted[sorted.length - 1] as [string, number];
  const missing = Object.keys(wc).filter((k) => wc[k] === 0);

  if (bazi.strength === '偏旺') {
    const xi = [WX_KEME[day], WX_SHENG[day], WX_KE[day]]; // 克我/我生/我克 → 克泄耗
    const ji = [WX_SHENGME[day], day]; // 生我/同我 → 生扶
    const hit = missing.filter((m) => xi.includes(m));
    return {
      strength: bazi.strength,
      day,
      xi,
      ji,
      missing,
      weakest,
      strongest,
      note: `日主${day}偏旺，宜「克泄耗」求平衡：喜用 ${xi.join('、')}；忌「生扶」助长：忌 ${ji.join('、')}。${
        hit.length ? `其中所缺「${hit.join('、')}」恰为喜用，缺而无碍，主动补足更利格局。` : ''
      }`,
    };
  }
  if (bazi.strength === '偏弱') {
    const xi = [WX_SHENGME[day], day]; // 生我/同我
    const ji = [WX_KEME[day], WX_SHENG[day], WX_KE[day]];
    const hit = missing.filter((m) => ji.includes(m));
    return {
      strength: bazi.strength,
      day,
      xi,
      ji,
      missing,
      weakest,
      strongest,
      note: `日主${day}偏弱，宜「生扶」补力：喜用 ${xi.join('、')}；忌「克泄耗」损耗：忌 ${ji.join('、')}。${
        hit.length ? `所缺「${hit.join('、')}」为忌神，缺失反而减少耗损。` : ''
      }`,
    };
  }
  return {
    strength: '中和',
    day,
    xi: [weakest[0]],
    ji: [],
    missing,
    weakest,
    strongest,
    note: `五行${bazi.strength}、分布相对均衡，无需强行偏向；宜略补相对最弱之「${weakest[0]}」（${weakest[1]} 处），并在行动上保持多方兼顾。`,
  };
}

/** 十神结构解读：按旺衰阈值输出性格倾向（纯渲染推导） */
function analyzeShishen(bazi: BaziResult): string[] {
  const countOf = (n: string) => bazi.shishenStats.find((s) => s.name === n)?.count ?? 0;
  const biJie = countOf('比肩') + countOf('劫财');
  const guanSha = countOf('正官') + countOf('七杀');
  const yin = countOf('正印') + countOf('偏印');
  const shiShang = countOf('食神') + countOf('伤官');
  const cai = countOf('正财') + countOf('偏财');
  const out: string[] = [];
  if (biJie >= 3)
    out.push(`比劫偏旺（${biJie} 处）：独立自主、重情讲义、执行力强，但需留意固执与竞争心。`);
  if (guanSha >= 3)
    out.push(`官杀偏旺（${guanSha} 处）：自律、有目标感与责任心，但易自我加压，需学会放松。`);
  if (yin >= 3)
    out.push(`印星偏旺（${yin} 处）：学习吸收能力强、做事有规划，但需避免想得多、动得少。`);
  if (shiShang >= 3)
    out.push(`食伤偏旺（${shiShang} 处）：表达与创造力突出，善于破局，但需避免心高气浮。`);
  if (cai >= 3)
    out.push(`财星偏旺（${cai} 处）：重实际、有经营意识，行动讲回报，但需避免过于精打细算。`);
  if (out.length === 0) out.push('十神分布较为均衡，性格偏综合性，无明显单一主导。');
  return out;
}

// ---------------- 通用排版工具 ----------------

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const pageBottom = doc.page.height - doc.page.margins.bottom - 40;
  if (doc.y + needed > pageBottom) doc.addPage();
}

function drawPageHeader(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 70);
  doc
    .fillColor(DARK)
    .fontSize(16)
    .font(FONT_BOLD)
    .text(title, doc.page.margins.left, doc.y, {
      width: availWidth(doc),
    });
  doc.moveDown(0.4);
  doc
    .strokeColor(GOLD)
    .lineWidth(1.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.8);
}

/** 小节标题：金色竖条 + 标题文字 */
function section(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 40);
  doc
    .fillColor(GOLD)
    .rect(doc.page.margins.left, doc.y + 2, 3.5, 14)
    .fill();
  doc
    .fillColor(DARK)
    .fontSize(12.5)
    .font(FONT_BOLD)
    .text(title, doc.page.margins.left + 10, doc.y, { width: availWidth(doc) - 10 });
  doc.moveDown(0.6);
}

/** 键值行：金色标签 + 值 */
function kv(doc: PDFKit.PDFDocument, label: string, value: string): void {
  ensureSpace(doc, 20);
  doc.font(FONT).fontSize(10);
  const labelWidth = doc.widthOfString(label, { features: ['kern'] }) + 8;
  doc.fillColor(GOLD).text(label, doc.page.margins.left + 14, doc.y, { width: labelWidth });
  doc.fillColor(MID).text(value, doc.page.margins.left + 14 + labelWidth, doc.y, {
    width: availWidth(doc) - 14 - labelWidth,
  });
  doc.moveDown(0.3);
}

/** 正文段落 */
function para(doc: PDFKit.PDFDocument, text: string, indent = 14): void {
  ensureSpace(doc, 20);
  doc
    .fillColor(MID)
    .fontSize(10)
    .font(FONT)
    .text(text, doc.page.margins.left + indent, doc.y, {
      width: availWidth(doc) - indent,
    });
  doc.moveDown(0.5);
}

/** 编号/圆点列表项 */
function listItem(doc: PDFKit.PDFDocument, idx: number | null, text: string): void {
  ensureSpace(doc, 20);
  doc.font(FONT).fontSize(10);
  const mark = idx === null ? '•' : `${idx}.`;
  const markW = doc.widthOfString(mark) + 6;
  doc.fillColor(GOLD).text(mark, doc.page.margins.left + 14, doc.y, { width: markW });
  doc.fillColor(MID).text(text, doc.page.margins.left + 14 + markW, doc.y, {
    width: availWidth(doc) - 14 - markW,
  });
  doc.moveDown(0.3);
}

/** 说明块：浅金底 + 左边框，整块输出 */
function noteBlock(doc: PDFKit.PDFDocument, text: string, title?: string): void {
  const h = doc.heightOfString(text, { width: availWidth(doc) - 40 }) + (title ? 26 : 12);
  ensureSpace(doc, h);
  const y0 = doc.y;
  doc
    .save()
    .fillColor(GOLD_LIGHT)
    .rect(doc.page.margins.left, y0, availWidth(doc), h)
    .fill()
    .restore();
  doc.fillColor(GOLD).rect(doc.page.margins.left, y0, 3, h).fill();
  doc.font(FONT).fontSize(9.5);
  if (title) {
    doc
      .fillColor(DARK)
      .font(FONT_BOLD)
      .text(title, doc.page.margins.left + 14, y0 + 7, {
        width: availWidth(doc) - 28,
      });
    doc
      .font(FONT)
      .fillColor(MID)
      .text(text, doc.page.margins.left + 14, y0 + 7 + 18, {
        width: availWidth(doc) - 28,
      });
  } else {
    doc.fillColor(MID).text(text, doc.page.margins.left + 14, y0 + 6, {
      width: availWidth(doc) - 28,
    });
  }
  doc.y = y0 + h + 4;
}

/** 简易表格：headers/rows 等长，colWeights 和为 1；markRow 高亮行号（1 起） */
function table(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  colWeights: number[],
  highlightRows: Set<number> = new Set(),
): void {
  const x0 = doc.page.margins.left;
  const widths = colWeights.map((w) => availWidth(doc) * w);
  const pad = 4;
  const cellW = (c: number): number => widths[c] - pad * 2;
  const measure = (t: string, w: number): number => doc.heightOfString(t, { width: w }) + pad * 2;

  const computeRowH = (r: string[]): number => {
    let h = 0;
    r.forEach((c, i) => {
      h = Math.max(h, measure(c, cellW(i)));
    });
    return h;
  };

  const headerH = computeRowH(headers);
  const rowHeights = rows.map(computeRowH);

  const drawRow = (cells: string[], y: number, header: boolean, highlight: boolean): number => {
    const h = header ? headerH : rowHeights[0];
    if (header) {
      doc.fillColor(GOLD_LIGHT).rect(x0, y, availWidth(doc), h).fill();
    } else if (highlight) {
      doc.fillColor('#fbf6ea').rect(x0, y, availWidth(doc), h).fill();
    }
    cells.forEach((c, i) => {
      const tx = x0 + widths.slice(0, i).reduce((a, b) => a + b, 0);
      doc
        .font(FONT)
        .fontSize(9.5)
        .fillColor(header ? DARK : MID)
        .text(c, tx + pad, y + pad, { width: cellW(i) });
    });
    return h;
  };

  // 表头
  ensureSpace(doc, headerH + 20);
  const startY = doc.y;
  doc
    .fillColor(GOLD)
    .rect(x0, startY - 3, availWidth(doc), 1.2)
    .fill();
  doc.y = startY;
  drawRow(headers, doc.y, true, false);
  doc.y += headerH;
  doc
    .fillColor(GOLD)
    .rect(x0, doc.y - 1.5, availWidth(doc), 0.6)
    .fill();

  rows.forEach((row, ri) => {
    const h = rowHeights[ri];
    ensureSpace(doc, h + 10);
    drawRow(row, doc.y, false, highlightRows.has(ri + 1));
    doc.y += h;
    doc
      .fillColor('#d8d3c5')
      .rect(x0, doc.y - 0.6, availWidth(doc), 0.4)
      .fill();
  });
  doc.moveDown(0.8);
}

// ---------------- 各层渲染 ----------------

/** 卷首推演摘要：跨层收敛，一张图看懂全局（纯渲染推导，不改模块输出） */
function renderSummary(
  doc: PDFKit.PDFDocument,
  l2: L2Output,
  l4: L4Output,
  l5: L5Output,
  l6: L6Output,
  l9: L9Output,
): void {
  drawPageHeader(doc, '推演摘要 · 一张图看懂全局');
  const bazi = l2.bazi;
  const xi = analyzeXiJi(bazi);

  section(doc, '命盘基本盘');
  kv(
    doc,
    '四柱',
    `${bazi.pillars.year.ganzhi}  ${bazi.pillars.month.ganzhi}  ${bazi.pillars.day.ganzhi}  ${bazi.pillars.time.ganzhi}`,
  );
  kv(doc, '日主', `${bazi.dayMaster.gan}（五行${bazi.dayMaster.wuxing}）`);
  kv(doc, '旺衰', bazi.strength);
  kv(
    doc,
    '五行分布',
    Object.entries(bazi.wuxingCount)
      .map(([k, v]) => `${k}${v}`)
      .join('　'),
  );

  section(doc, '五行喜忌');
  kv(doc, '喜用', xi.xi.join('、'));
  kv(doc, '忌用', xi.ji.length ? xi.ji.join('、') : '无明显忌');
  kv(doc, '偏强', `${xi.strongest[0]}（${xi.strongest[1]} 处）`);
  kv(
    doc,
    '偏弱/缺失',
    `${xi.weakest[0]}（${xi.weakest[1]} 处）${xi.missing.length ? `；五行缺：${xi.missing.join('、')}` : ''}`,
  );
  noteBlock(doc, xi.note, '喜忌分析');

  const top = [...l6.lines].sort((a, b) => b.fit - a.fit)[0];
  if (top) {
    section(doc, '命运主线');
    kv(doc, '最契合路径', `${top.name}（契合度 ${top.fit}）`);
    para(doc, top.strategy, 14);
    if (top.risk) para(doc, `风险提示：${top.risk}`, 14);
  }

  const maxDim = [...l4.dimensions].sort((a, b) => b.total - a.total)[0];
  const minDim = [...l4.dimensions].sort((a, b) => a.total - b.total)[0];
  if (maxDim && minDim) {
    section(doc, '六维强弱');
    kv(doc, '优势维度', `${maxDim.name}（${maxDim.total} 分）`);
    kv(doc, '最需提升', `${minDim.name}（${minDim.total} 分）`);
    para(doc, minDim.advice, 14);
  }

  section(doc, '卡点与行运');
  kv(doc, '核心卡点', l5.mainKnot);
  const cur = bazi.currentDaYun;
  if (cur) {
    kv(
      doc,
      '当前大运',
      `${cur.ganzhi}（${cur.startYear}-${cur.endYear}，${cur.startAge}-${cur.endAge} 岁）`,
    );
  }

  if (l9.essence) noteBlock(doc, l9.essence, '一句话本质');
  if (l9.mantra) {
    ensureSpace(doc, 50);
    doc.moveDown(0.8);
    doc
      .fillColor(GOLD)
      .fontSize(13)
      .font(FONT_BOLD)
      .text(`「${l9.mantra}」`, doc.page.margins.left + 14, doc.y, {
        width: availWidth(doc) - 28,
        align: 'center',
      });
    doc.moveDown(0.8);
  }
  doc.addPage();
}

function renderL1(doc: PDFKit.PDFDocument, d: L1Output): void {
  section(doc, '归一化输入');
  kv(doc, '公历生日', d.normalized.solarDate);
  kv(doc, '出生时刻', d.normalized.solarTime);
  kv(doc, '精度', d.normalized.timeKnown ? '分钟级' : '仅日级');
  kv(doc, '来源', SOURCE_LABEL[d.normalized.sourceReliability] ?? d.normalized.sourceReliability);

  section(doc, '出生地点');
  kv(doc, '城市', `${d.location.cityName}（${d.location.province}）`);
  kv(doc, '坐标', `东经 ${d.location.longitude}°，北纬 ${d.location.latitude}°`);
  kv(doc, '时区', `UTC+${d.location.timezoneOffset}`);
  if (d.location.resolvedFromCity) kv(doc, '解析方式', '按城市解析');
  if (d.location.isDaylightSavingApplied) kv(doc, '夏令时', '已应用');

  section(doc, '真太阳时校正');
  const iso = (dt: Date): string => dt.toISOString().replace('T', ' ').slice(0, 19);
  kv(doc, '钟表时间', iso(d.timeCorrection.clockTime));
  kv(doc, 'UTC 时间', iso(d.timeCorrection.utcTime));
  kv(doc, '平均太阳时', `${d.timeCorrection.meanSolarHours.toFixed(2)} 时`);
  kv(doc, '经度修正', `${((d.location.longitude - 120) * 4).toFixed(1)} 分`);
  kv(doc, '均时差', `${d.timeCorrection.equationOfTimeMinutes.toFixed(2)} 分`);
  kv(doc, '真太阳时', `${d.timeCorrection.trueSolarHours.toFixed(2)} 时`);
  kv(doc, '综合偏移', `${d.timeCorrection.totalOffsetMinutes} 分`);
  kv(doc, '校正后时刻', iso(d.timeCorrection.trueSolarClockTime));
  kv(doc, '是否跨日', d.timeCorrection.crossDay ? '是' : '否');
  noteBlock(
    doc,
    `时差推导：真太阳时 = 钟表时 + 经度修正（(东经${d.location.longitude}° - 120°)×4 ≈ ${((d.location.longitude - 120) * 4).toFixed(1)} 分）+ 均时差（${d.timeCorrection.equationOfTimeMinutes.toFixed(1)} 分）≈ ${d.timeCorrection.totalOffsetMinutes} 分综合偏移。经度修正来自出生地相对东经 120° 标准子午线的经度差，均时差来自地球公转轨道偏心率与黄赤交角。`,
    '校正推导',
  );

  section(doc, '时辰归属');
  kv(doc, '时辰', `${d.shichen.name}（${d.shichen.start}-${d.shichen.end} 点）`);

  section(doc, '农历换算');
  kv(doc, '农历日期', d.lunar.lunarDate);
  kv(
    doc,
    '四柱干支',
    `${d.lunar.yearGanZhi}年 ${d.lunar.monthGanZhi}月 ${d.lunar.dayGanZhi}日 ${d.lunar.timeGanZhi}时`,
  );
  kv(doc, '生肖', `属${d.lunar.yearAnimal}`);
  kv(doc, '节气', d.lunar.currentJieQi || '（两节之间）');
  table(
    doc,
    ['近期节气', '名称', '时间'],
    [
      ['上一个', d.lunar.prevJieQi.name, d.lunar.prevJieQi.time],
      ['下一个', d.lunar.nextJieQi.name, d.lunar.nextJieQi.time],
    ],
    [0.18, 0.25, 0.57],
  );
  para(doc, d.lunar.jieQiNote, 14);

  if (d.boundaryRisk) {
    noteBlock(doc, '本案例处于时辰边界，精度已按保守口径处理。', '边界风险');
  }
  section(doc, '夏令时校正');
  kv(doc, '是否校正', d.dstAdjustment.applied ? '是' : '否');
  if (d.dstAdjustment.original !== d.dstAdjustment.adjusted) {
    kv(doc, '校正前后', `${d.dstAdjustment.original} → ${d.dstAdjustment.adjusted}`);
  }
  para(doc, d.dstAdjustment.note, 14);

  section(doc, '置信度评级');
  kv(doc, '等级', d.rating.grade);
  kv(doc, '置信度', `${d.rating.confidence}%`);
  noteBlock(doc, d.rating.message, '评级说明');
}

function renderL2(doc: PDFKit.PDFDocument, d: L2Output): void {
  const primary = d.schools.find((s) => s.data && 'pillars' in s.data);
  if (primary) {
    const data = primary.data as {
      pillars: Array<{
        position: string;
        ganzhi: string;
        gan: string;
        zhi: string;
        wuxing: string;
        nayin: string;
        shishenGan: string;
        shishenZhi: string;
        hideGan: string;
        dishi: string;
      }>;
      dayMaster: { gan: string; wuxing: string };
      strength: string;
      wuxingCount: Record<string, number>;
      shishenStats: Array<{ name: string; count: number }>;
      xunKong?: { xun: string; kong: string };
      taiYuan?: string;
      mingGong?: string;
      daYun?: Array<{
        index: number;
        ganzhi: string;
        startAge: number;
        endAge: number;
        startYear: number;
        endYear: number;
      }>;
      currentDaYun?: {
        index: number;
        ganzhi: string;
        startAge: number;
        endAge: number;
        startYear: number;
        endYear: number;
      };
    };
    section(doc, '四柱排盘');
    table(
      doc,
      ['柱位', '干支', '五行', '纳音', '十神', '藏干', '帝旺'],
      data.pillars.map((p) => [
        p.position === 'year'
          ? '年柱'
          : p.position === 'month'
            ? '月柱'
            : p.position === 'day'
              ? '日柱'
              : '时柱',
        p.ganzhi,
        p.wuxing,
        p.nayin,
        `${p.shishenGan} / ${p.shishenZhi}`,
        p.hideGan,
        p.dishi,
      ]),
      [0.11, 0.13, 0.1, 0.13, 0.22, 0.13, 0.18],
    );
    kv(doc, '日主', `${data.dayMaster.gan}（五行${data.dayMaster.wuxing}）`);
    kv(doc, '旺衰', data.strength);
    if (data.xunKong) kv(doc, '旬空', `${data.xunKong.xun}旬，空 ${data.xunKong.kong}`);
    if (data.taiYuan) kv(doc, '胎元', data.taiYuan);
    if (data.mingGong) kv(doc, '命宫', data.mingGong);

    section(doc, '五行统计');
    for (const [wuxing, count] of Object.entries(data.wuxingCount)) {
      kv(doc, `五${wuxing}`, `${count} 处`);
    }

    const xi = analyzeXiJi(d.bazi);
    section(doc, '五行喜忌分析');
    kv(doc, '喜用', xi.xi.join('、'));
    kv(doc, '忌用', xi.ji.length ? xi.ji.join('、') : '无明显忌');
    kv(doc, '偏强', `${xi.strongest[0]}（${xi.strongest[1]} 处）`);
    kv(
      doc,
      '偏弱/缺失',
      `${xi.weakest[0]}（${xi.weakest[1]} 处）${xi.missing.length ? `；五行缺：${xi.missing.join('、')}` : ''}`,
    );
    noteBlock(doc, xi.note, '喜忌分析');

    section(doc, '十神结构');
    table(
      doc,
      ['十神', '数量'],
      data.shishenStats.map((s) => [s.name, String(s.count)]),
      [0.5, 0.2],
    );

    section(doc, '十神性格解读');
    analyzeShishen(d.bazi).forEach((t, i) => listItem(doc, i + 1, t));

    if (data.daYun && data.daYun.length > 0) {
      section(doc, '大运走势');
      const cur = data.currentDaYun;
      table(
        doc,
        ['大运', '干支', '年龄段', '年份段', '备注'],
        data.daYun.map((y) => [
          String(y.index),
          y.ganzhi,
          `${y.startAge}-${y.endAge} 岁`,
          `${y.startYear}-${y.endYear}`,
          cur && cur.index === y.index ? '当前大运' : '',
        ]),
        [0.12, 0.15, 0.22, 0.26, 0.25],
        cur ? new Set([cur.index]) : new Set(),
      );
    }
  }

  for (const s of d.schools) {
    if (primary && s === primary) continue;
    section(doc, `${s.school}（${s.version}）`);
    if (s.note) para(doc, s.note, 14);
    if (s.data) {
      for (const [k, v] of Object.entries(s.data as Record<string, unknown>)) {
        const label = SCHOOL_KEY_LABEL[k] ?? k;
        if (typeof v === 'string') kv(doc, label, v);
        else if (typeof v === 'number') kv(doc, label, String(v));
      }
    }
  }

  if (d.conflicts && d.conflicts.length > 0) {
    section(doc, '流派冲突');
    d.conflicts.forEach((c, i) => listItem(doc, i + 1, c));
  }
  if (d.schoolNote) noteBlock(doc, d.schoolNote, '流派口径说明');
  if (d.dayPrecisionOnly) noteBlock(doc, '本案例仅日级精度，时辰信息未参与排盘。', '精度提示');
}

function renderL3(doc: PDFKit.PDFDocument, d: L3Output): void {
  if (d.disenchantNote) noteBlock(doc, d.disenchantNote, '科学祛魅说明');

  section(doc, '人格画像');
  table(
    doc,
    ['维度', '评分', '解读'],
    d.personality.map((p) => [p.dimension, `${p.score}`, p.desc]),
    [0.3, 0.1, 0.6],
  );

  section(doc, '天赋优势');
  d.strengths.forEach((s, i) => listItem(doc, i + 1, s));

  section(doc, '成长方向');
  d.growth.forEach((g, i) => listItem(doc, i + 1, g));

  if (d.behaviorLogic) {
    section(doc, '行为逻辑');
    para(doc, d.behaviorLogic, 14);
  }
}

function renderL4(doc: PDFKit.PDFDocument, d: L4Output): void {
  section(doc, '权重模型');
  kv(doc, '先天结构', `${Math.round(d.weightModel.xiantian * 100)}%`);
  kv(doc, '流年行运', `${Math.round(d.weightModel.liunian * 100)}%`);
  kv(doc, '人为主动', `${Math.round(d.weightModel.renwei * 100)}%`);
  if (d.weightModel.note) noteBlock(doc, d.weightModel.note, '模型说明');

  const sortedDims = [...d.dimensions].sort((a, b) => b.total - a.total);
  section(doc, '六维总览（按综合分排序）');
  table(
    doc,
    ['排名', '维度', '先天', '流年', '人为', '总分', '强弱'],
    sortedDims.map((dim, i) => [
      String(i + 1),
      dim.name,
      String(dim.xiantian),
      String(dim.liunian),
      String(dim.renwei),
      String(dim.total),
      i === 0 ? '优势' : i === sortedDims.length - 1 ? '最需提升' : '',
    ]),
    [0.06, 0.24, 0.11, 0.11, 0.11, 0.11, 0.26],
  );

  section(doc, '六维落地');
  for (const dim of d.dimensions) {
    const title = `${dim.name}（综合分 ${dim.total}）`;
    section(doc, title);
    kv(doc, '先天基础', `${dim.xiantian} 分`);
    kv(doc, '流年助推', `${dim.liunian} 分`);
    kv(doc, '人为空间', `${dim.renwei} 分`);
    if (dim.advice) para(doc, `建议：${dim.advice}`, 14);
  }

  if (d.summary) noteBlock(doc, d.summary, '本层总结');
}

function renderL5(doc: PDFKit.PDFDocument, d: L5Output): void {
  section(doc, '执念模式');
  for (const p of d.karmaPatterns) {
    section(doc, p.name);
    if (p.cause) para(doc, `成因：${p.cause}`, 14);
    if (p.manifestation) para(doc, `表现：${p.manifestation}`, 14);
    if (p.root) para(doc, `根源：${p.root}`, 14);
  }

  if (d.mainKnot) {
    noteBlock(doc, `主卡点：${d.mainKnot}`, '核心卡点');
  }

  section(doc, '化解路径');
  d.resolutionPath.forEach((r, i) => listItem(doc, i + 1, r));

  if (d.note) noteBlock(doc, d.note, '本层说明');
}

function renderL6(doc: PDFKit.PDFDocument, d: L6Output): void {
  section(doc, '四条平行命运线');
  for (const line of d.lines) {
    section(doc, `${line.name}（契合度 ${line.fit}）`);
    if (line.strategy) para(doc, `策略：${line.strategy}`, 14);
    if (line.trigger) para(doc, `触发：${line.trigger}`, 14);
    if (line.risk) para(doc, `风险：${line.risk}`, 14);
  }

  section(doc, '关键分叉点');
  table(
    doc,
    ['年龄', '年份', '背景', '决策 A → 路径', '决策 B → 路径'],
    d.branchPoints.map((b) => [
      `${b.age} 岁`,
      `${b.year}`,
      b.context,
      `${b.decisionA}\n→ ${b.pathA}`,
      `${b.decisionB}\n→ ${b.pathB}`,
    ]),
    [0.09, 0.1, 0.31, 0.25, 0.25],
  );

  if (d.note) noteBlock(doc, d.note, '本层说明');
}

function renderL7(doc: PDFKit.PDFDocument, d: L7Output): void {
  section(doc, '元规则');
  d.metaRules.forEach((r, i) => listItem(doc, i + 1, r));

  section(doc, '冲突裁定');
  for (const c of d.conflictResolution) {
    para(doc, `冲突：${c.conflict}`, 14);
    noteBlock(doc, `裁定：${c.ruling}`, '裁定结果');
    if (c.basis) para(doc, `依据：${c.basis}`, 14);
  }

  section(doc, '综合结论');
  d.synthesis.forEach((s, i) => listItem(doc, i + 1, s));

  if (d.coreNote) noteBlock(doc, d.coreNote, '内核声明');
}

function renderL8(doc: PDFKit.PDFDocument, d: L8Output): void {
  for (const lv of d.levels) {
    section(doc, `第 ${lv.level} 级 · ${lv.name}`);
    for (const item of lv.items) {
      ensureSpace(doc, 30);
      doc
        .fillColor(DARK)
        .fontSize(10.5)
        .font(FONT_BOLD)
        .text(`● ${item.title}`, doc.page.margins.left + 14, doc.y, {
          width: availWidth(doc) - 14,
        });
      doc.moveDown(0.2);
      para(doc, item.content, 28);
      kv(doc, '执行周期', item.execCycle);
    }
  }
  if (d.note) noteBlock(doc, d.note, '本层说明');
}

function renderL9(doc: PDFKit.PDFDocument, d: L9Output): void {
  section(doc, '人生课题');
  for (const l of d.lifeLessons) {
    section(doc, l.title);
    para(doc, l.content, 14);
  }

  if (d.essence) noteBlock(doc, d.essence, '心性本质');

  if (d.mantra) {
    ensureSpace(doc, 60);
    doc.moveDown(1);
    doc
      .fillColor(GOLD)
      .fontSize(14)
      .font(FONT_BOLD)
      .text(`「${d.mantra}」`, doc.page.margins.left + 14, doc.y, {
        width: availWidth(doc) - 28,
        align: 'center',
      });
    doc.moveDown(1);
  }

  if (d.finalNote) noteBlock(doc, d.finalNote, '最终声明');
}

function drawSection(doc: PDFKit.PDFDocument, item: NineLayerReportItem): void {
  if (!item.data) {
    noteBlock(doc, item.note ?? '该层尚未上线。', '内容暂未开放');
    return;
  }
  switch (item.layer) {
    case 1:
      renderL1(doc, item.data as L1Output);
      break;
    case 2:
      renderL2(doc, item.data as L2Output);
      break;
    case 3:
      renderL3(doc, item.data as L3Output);
      break;
    case 4:
      renderL4(doc, item.data as L4Output);
      break;
    case 5:
      renderL5(doc, item.data as L5Output);
      break;
    case 6:
      renderL6(doc, item.data as L6Output);
      break;
    case 7:
      renderL7(doc, item.data as L7Output);
      break;
    case 8:
      renderL8(doc, item.data as L8Output);
      break;
    case 9:
      renderL9(doc, item.data as L9Output);
      break;
    default:
      para(doc, '未知层。');
  }
}

function main(): void {
  const l1 = runL1({
    solarDate: CASE.solarDate,
    solarTime: CASE.solarTime,
    timePrecision: CASE.timePrecision,
    sourceReliability: CASE.sourceReliability,
    cityName: CASE.cityName,
    timezoneOffset: CASE.timezoneOffset,
  });
  const l2 = runL2(
    l1.timeCorrection.trueSolarClockTime,
    CASE.gender,
    l1.normalized.timeKnown,
    CASE.currentYear,
  );
  const l3 = runL3(l2.bazi);
  const l4 = runL4(l2.bazi);
  const l5 = runL5(l2.bazi);
  const l6 = runL6(l2.bazi, l4, l5);
  const l7 = runL7(l1, l2, l4, l5);
  const l8 = runL8(l4, l5, l2.bazi);
  const l9 = runL9(l2.bazi, l4, l5, l7);
  const report = buildNineLayerReport(l1, l2, l3, l4, l5, l6, l7, l8, l9);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 56, right: 56 },
    info: {
      Title: '命运演算全量推演报告（测试案例）',
      Author: 'fate-engine',
      Producer: 'fate-engine pdf generator',
    },
  });

  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../fate-report-test.pdf',
  );
  doc.pipe(fs.createWriteStream(outPath));

  // ---------- 封面 ----------
  doc
    .fillColor(DARK)
    .fontSize(28)
    .font(FONT_BOLD)
    .text('全域超验无限命运演算系统', { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor(GOLD).fontSize(18).font(FONT_BOLD).text('全量推演报告', { align: 'center' });
  doc.moveDown(2);
  doc.font(FONT).fontSize(12).fillColor(MID);
  const coverRows: Array<[string, string]> = [
    ['测试案例', 'verify_all.ts 主用例'],
    ['公历生日', '2002-11-29（周五）'],
    ['出生时刻', '20:40'],
    ['精度', '分钟级 / 来源可信：证件'],
    ['出生地点', '北京（东经116.4°，东八区）'],
    ['性别', '男'],
    ['推演口径', 'L1–L9 九层全量（付费解锁后完整版）'],
    ['生成时间', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })],
  ];
  for (const [k, v] of coverRows) {
    doc.text(`${k}：${v}`, { align: 'center' });
    doc.moveDown(0.6);
  }
  doc.moveDown(2);
  doc
    .fillColor(GOLD)
    .fontSize(11)
    .text('本报告仅供文化娱乐与自我探索参考，不构成任何专业建议。', { align: 'center' });
  doc.addPage();

  // ---------- 卷首推演摘要 ----------
  renderSummary(doc, l2, l4, l5, l6, l9);

  // ---------- 九层正文 ----------
  for (const item of report) {
    drawPageHeader(doc, `L${item.layer} · ${item.name}  （${item.version}）`);
    drawSection(doc, item);
  }

  // 页脚页码
  const pageCount = doc.bufferedPageRange
    ? (doc as unknown as { bufferedPageRange: () => { count: number } }).bufferedPageRange().count
    : 0;
  doc.on('pageAdded', (page: { width: number; height: number; margins: { bottom: number } }) => {
    const n = (doc as unknown as { _pageNumber: number })._pageNumber ?? 0;
    doc
      .font(FONT)
      .fontSize(9)
      .fillColor(GRAY)
      .text(
        `第 ${n} 页 / 共 ${pageCount} 页`,
        page.width / 2 - 40,
        page.height - page.margins.bottom - 16,
        { width: 80, align: 'center' },
      );
  });

  doc.end();
  console.log(`PDF 已生成：${outPath}`);
}

main();
