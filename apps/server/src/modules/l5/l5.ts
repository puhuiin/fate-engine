/**
 * L5 因果溯源（V4）
 * 内在卡点与执念溯源：从五行偏枯、十神过旺、旬空落宫识别行为模式，
 * 将「卡点」表述为结构倾向而非宿命，并提供可执行的化解路径。
 * 红线约定：不输出宿命式断言，全部指向「可解、可控、可成长」。
 */
import type { BaziResult } from '../l2/bazi.js';
import { runDeepAnalysis } from '../l2/deep.js';

export interface KarmaPattern {
  name: string;
  cause: string; // 结构成因（基于四柱五行/十神）
  manifestation: string; // 日常表现
  root: string; // 根源分析
}

export interface L5Output {
  karmaPatterns: KarmaPattern[];
  mainKnot: string;
  resolutionPath: string[];
  note: string;
}

/** 十神过旺模式 */
const SHISHEN_KNOTS: Array<{
  name: string;
  keys: string[];
  threshold: number;
  manifestation: string;
  root: string;
}> = [
  {
    name: '求认可与自我证明',
    keys: ['伤官'],
    threshold: 2,
    manifestation: '对反馈敏感，容易把外界的评价内化为自我价值，思虑细腻但偶尔想得太多。',
    root: '伤官结构偏旺时，表达欲与标准感同时被放大，指向「被看见、被认可」的需求，这一需求本身无害，过度则消耗精力。',
  },
  {
    name: '内在高压与紧绷',
    keys: ['七杀'],
    threshold: 2,
    manifestation: '自我要求偏高，习惯把压力扛在肩上，节奏容易偏紧、放松较难。',
    root: '七杀旺常伴随对「失控」的警惕，属于对责任的高度敏感，根源于把自我价值与表现结果过度绑定。',
  },
  {
    name: '规则依赖与框架感',
    keys: ['正官'],
    threshold: 2,
    manifestation: '守规则、重秩序，但面对模糊或非常规情境时容易缺乏安全感。',
    root: '正官旺意味着对外部框架有较高依赖，安全感来自「清晰的规则」，一旦规则缺席，容易踌躇。',
  },
  {
    name: '惯性依赖与行动迟滞',
    keys: ['正印', '偏印'],
    threshold: 2,
    manifestation: '擅长思考与酝酿，但启动与执行有时会被「再等等、再想想」拖住。',
    root: '印星旺提供安全感与思考养分，但过度会形成「想清楚再行动」的惯性，把思考当作行动的替代。',
  },
  {
    name: '边界与较劲心态',
    keys: ['比肩', '劫财'],
    threshold: 3,
    manifestation: '自主性强、不服输，但在协作中偶尔把竞争感带进来。',
    root: '比劫旺强化自我主张与领地意识，根源于对「被分走资源」的警惕，易把同行者当成参照系。',
  },
  {
    name: '能力与欲望落差',
    keys: ['正财', '偏财'],
    threshold: 2,
    manifestation: '目标感与物质期待清晰，但阶段性会感到「想要的与现有的」存在距离。',
    root: '财星旺放大了对成果的期待，落差的根源往往在节奏匹配——需要把大目标拆成可迭代的小步。',
  },
  {
    name: '舒适区依赖',
    keys: ['食神'],
    threshold: 2,
    manifestation: '追求安逸与品味，动力曲线偏平缓，突破舒适区需要外部推动。',
    root: '食神旺带来享受与创造的天赋，同时强化对「舒服状态」的黏性，根源于变化带来的不确定感。',
  },
];

/** 五行缺失模式 */
const WUXING_GAPS: Array<{ wx: string; name: string; manifestation: string }> = [
  { wx: '土', name: '落地与稳定感', manifestation: '想法活跃但落地执行、长期坚持需要刻意练习。' },
  { wx: '金', name: '规则与边界意识', manifestation: '随性灵活，但边界与流程感需要主动建立。' },
  {
    wx: '水',
    name: '洞察与应变深度',
    manifestation: '直来直往，对他人情绪与局势变化的捕捉需要补课。',
  },
  {
    wx: '木',
    name: '成长方向与破局',
    manifestation: '稳定性强，但主动探索与开辟新方向需要外力助推。',
  },
  {
    wx: '火',
    name: '表达与行动力度',
    manifestation: '内心戏多于行动展示，主动表达与即时行动需要刻意练习。',
  },
];

export function runL5(bazi: BaziResult): L5Output {
  const patterns: KarmaPattern[] = [];

  const countOf = (name: string) => bazi.shishenStats.find((s) => s.name === name)?.count ?? 0;

  // 十神过旺模式
  for (const knot of SHISHEN_KNOTS) {
    const total = knot.keys.reduce((s, k) => s + countOf(k), 0);
    if (total >= knot.threshold) {
      patterns.push({
        name: knot.name,
        cause: `${knot.keys.join('、')}在四柱中偏旺（合计${total}处）。`,
        manifestation: knot.manifestation,
        root: knot.root,
      });
    }
  }

  // 五行缺失模式
  for (const gap of WUXING_GAPS) {
    if ((bazi.wuxingCount[gap.wx] ?? 0) === 0) {
      patterns.push({
        name: gap.name,
        cause: `四柱五行缺「${gap.wx}」。`,
        manifestation: gap.manifestation,
        root: `「${gap.wx}」类功能在结构中缺席，会在相关情境中需要额外能量补齐；这种短板完全可以通过后天练习与环境补足。`,
      });
    }
  }

  // 旬空落宫提示
  if (bazi.xunKong.kong) {
    patterns.push({
      name: '宫位留白感',
      cause: `日柱落「${bazi.xunKong.xun}」旬，空亡${bazi.xunKong.kong}。`,
      manifestation: '在对应宫位所代表的领域（如感情、内心世界）有时会出现「意犹未尽」的留白感。',
      root: '旬空在传统体系中指该宫位气机偏虚，实践中常见为「关注度不足」；主动在该领域投入注意力即可显著改善。',
    });
  }

  // 地支互动（刑冲合害）：传统认为关系张力的提示，倾向性表述
  const xc = runDeepAnalysis(bazi).xingChong;
  const jie = xc.filter((x) => x.type === '六冲' || x.type === '六害' || x.type === '相刑');
  if (jie.length > 0) {
    const desc = jie.map((x) => `${x.a}${x.b ? `/${x.b}` : ''}`).join('；');
    patterns.push({
      name: '地支互动张力',
      cause: `四柱地支间存在${jie.map((x) => x.type).join('、')}（${desc}）。`,
      manifestation: '传统体系将地支冲刑害视为「内外张力的符号化提示」，常见表现为相关领域需要更高的沟通与调和技巧。',
      root: '冲刑害描述的是一种「关系张力」，张力本身中性的——它既是摩擦点，也是突破点。练习在有张力的关系中先表达、再倾听，可显著化解。',
    });
  }

  // 主卡点：取第一个（优先级最高）
  const mainKnot =
    patterns[0]?.name ?? '当前四柱结构相对均衡，无明显偏枯，卡点多来自环境与认知习惯。';

  const resolutionPath = [
    `直面「${mainKnot}」：把它当作可训练的课题，而不是不可更改的属性。`,
    '用「记录-归因-行动」三步法：每次触发时记录场景，客观归因，做一个小行动。',
    '设定一个月的刻意练习窗口，每周复盘一次，给变化留出时间。',
    '必要时借助他人视角（信任的伙伴或专业支持），避免长期自我循环。',
  ];

  return {
    karmaPatterns: patterns,
    mainKnot,
    resolutionPath,
    note: '本层属于启发式自我观察，识别的是「行为倾向」而非「命运结论」。卡点源于结构倾向、成长环境与认知模式的叠加，全部可以通过认知升级与行为训练改变。',
  };
}
