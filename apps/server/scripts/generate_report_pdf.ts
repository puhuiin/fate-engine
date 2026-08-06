/**
 * 全量推演报告 PDF 生成（测试案例专用）。
 * 以 verify_all.ts 主用例（2002-11-29 20:40 北京 男 certificate）跑通 L1-L9，
 * 用 pdfkit（全局安装）渲染为排版完整的中文 PDF。
 *
 * 运行：npx tsx scripts/generate_report_pdf.ts
 * 依赖：全局 npm 包 pdfkit；系统字体 /usr/share/fonts/truetype/wqy/wqy-zenhei.ttc
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runL1 } from '../src/modules/l1/l1.js';
import { runL2 } from '../src/modules/l2/l2.js';
import { runL3 } from '../src/modules/l3/l3.js';
import { runL4 } from '../src/modules/l4/l4.js';
import { runL5 } from '../src/modules/l5/l5.js';
import { runL6 } from '../src/modules/l6/l6.js';
import { runL7 } from '../src/modules/l7/l7.js';
import { runL8 } from '../src/modules/l8/l8.js';
import { runL9 } from '../src/modules/l9/l9.js';
import { buildNineLayerReport, type NineLayerReportItem } from '../src/report.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// pdfkit 不在项目依赖中，按「全局安装」约定从全局 node_modules 加载
const require = createRequire(import.meta.url);
const globalRoot = execSync('npm root -g').toString().trim();
const PDFDocument = require(path.join(globalRoot, 'pdfkit'));

const FONT = '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf';
const FONT_BOLD = FONT;

/** 测试案例（与 verify_all.ts 主用例一致） */
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

/** 常见英文 key → 中文，让报告更易读 */
const KEY_LABEL: Record<string, string> = {
  normalized: '归一化输入',
  location: '出生地点',
  timeCorrection: '真太阳时校正',
  shichen: '时辰归属',
  lunar: '农历换算',
  boundaryRisk: '边界风险',
  dstAdjustment: '夏令时校正',
  rating: '可信度评级',
  schools: '流派测算结果',
  conflicts: '流派冲突',
  schoolNote: '流派口径说明',
  dayPrecisionOnly: '仅日级精度',
  bazi: '四柱八字',
  disenchantNote: '祛魅声明',
  personality: '人格画像',
  strengths: '天赋优势',
  growth: '成长方向',
  behaviorLogic: '行为逻辑',
  weightModel: '权重模型',
  dimensions: '六维落地',
  summary: '总结',
  karmaPatterns: '执念模式',
  mainKnot: '主卡点',
  resolutionPath: '化解路径',
  note: '说明',
  lines: '平行命运线',
  branchPoints: '分叉点',
  depthWindows: '深度窗口',
  metaRules: '元规则',
  conflictResolution: '冲突裁定',
  synthesis: '综合结论',
  coreNote: '核心说明',
  levels: '七级方案',
  lifeLessons: '人生课题',
  essence: '心性本质',
  mantra: '正念箴言',
  finalNote: '最终声明',
  pillars: '四柱',
  year: '年柱',
  month: '月柱',
  day: '日柱',
  time: '时柱',
  dayMaster: '日主',
  ganzhi: '干支',
  element: '五行',
  daYun: '大运',
};

const labelOf = (key: string): string => KEY_LABEL[key] ?? key;

/** 这些字段的取值自带完整句读（如 L9 finalNote 以「声明：」开头），直接整行输出，避免「最终声明：声明：…」重复 */
const RAW_LINE_KEYS = new Set(['finalNote']);

/** 递归扁平化对象 → 行文本 */
function flatten(obj: unknown, prefix: string, out: string[]): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      if (obj.length === 0) return;
      obj.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out));
      return;
    }
    const entries = Object.entries(obj as Record<string, unknown>).filter(
      ([, v]) => v !== null && v !== undefined,
    );
    if (entries.length === 0) return;
    for (const [k, v] of entries) {
      const key = prefix ? `${prefix} · ${labelOf(k)}` : labelOf(k);
      if (RAW_LINE_KEYS.has(k)) {
        out.push(String(v));
        continue;
      }
      if (typeof v === 'object') {
        if (Object.keys(v as object).length === 0) continue;
        flatten(v, key, out);
      } else {
        out.push(`${key}：${formatLeaf(v)}`);
      }
    }
    return;
  }
  out.push(`${prefix}：${formatLeaf(obj)}`);
}

function formatLeaf(v: unknown): string {
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (typeof v === 'string') return v;
  return String(v);
}

/** 绘制带页码的分页头部 */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const y = doc.y;
  const pageBottom = doc.page.height - doc.page.margins.bottom - 40;
  if (y + needed > pageBottom) doc.addPage();
}

function drawPageHeader(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 60);
  doc
    .fillColor('#1a1a1a')
    .fontSize(16)
    .font(FONT_BOLD)
    .text(title, doc.page.margins.left, doc.y, {
      width: doc.page.width - doc.page.margins.left * 2,
    });
  doc.moveDown(0.4);
  doc
    .strokeColor('#c8a04a')
    .lineWidth(1.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.6);
}

function drawSection(doc: PDFKit.PDFDocument, item: NineLayerReportItem): void {
  if (!item.data) {
    doc
      .fillColor('#999')
      .fontSize(11)
      .font(FONT)
      .text(`${item.note ?? '暂无内容'}`);
    doc.moveDown(1);
    return;
  }
  const lines: string[] = [];
  flatten(item.data, '', lines);
  for (const line of lines) {
    ensureSpace(doc, 20);
    doc
      .fillColor('#333')
      .fontSize(10)
      .font(FONT)
      .text(line, doc.page.margins.left + 14, doc.y, {
        width: doc.page.width - doc.page.margins.left * 2 - 14,
      });
  }
  doc.moveDown(1);
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
    .fillColor('#1a1a1a')
    .fontSize(28)
    .font(FONT_BOLD)
    .text('全域超验无限命运演算系统', { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor('#c8a04a').fontSize(18).font(FONT_BOLD).text('全量推演报告', { align: 'center' });
  doc.moveDown(2);
  doc.font(FONT).fontSize(12).fillColor('#333');
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
    .fillColor('#c8a04a')
    .fontSize(11)
    .text('本报告仅供文化娱乐与自我探索参考，不构成任何专业建议。', { align: 'center' });
  doc.addPage();

  // ---------- 九层正文 ----------
  for (const item of report) {
    drawPageHeader(doc, `L${item.layer} · ${item.name}  （V${item.version}）`);
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
      .fillColor('#999')
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
