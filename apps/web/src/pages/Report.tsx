import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getRecord,
  getPlans,
  getRisks,
  createUnlockOrder,
  payOrder,
  patchPlan,
  type L1Result,
  type L2Result,
  type L3Result,
  type L4Result,
  type L5Result,
  type L6Result,
  type L7Result,
  type L8Result,
  type L9Result,
  type PlanItem,
  type RiskItem,
} from '../api/client';
import { LAYER_NAMES, MODULE_HINT } from '../layers';

function fmtHour(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** 导出完整报告为纯文本（仅已解锁层） */
function buildExportText(
  r: {
    l1: L1Result | null;
    l2: L2Result | null;
    l3: L3Result | null;
    l4: L4Result | null;
    l5: L5Result | null;
    l6: L6Result | null;
    l7: L7Result | null;
    l8: L8Result | null;
    l9: L9Result | null;
    risks: RiskItem[];
  },
): string {
  const lines: string[] = [];
  lines.push('全域超验 · 命运演算 报告', '='.repeat(30));

  if (r.l1) {
    const t = r.l1.timeCorrection;
    lines.push('【L1 时空校正】', `城市：${r.l1.location?.cityName ?? '未提供'}（经度 ${r.l1.location?.longitude ?? '-'}°）`);
    lines.push(`钟表时间：${r.l1.normalized.solarDate} ${r.l1.normalized.solarTime}`);
    lines.push(`真太阳时：${fmtHour(t.trueSolarHours)}（总校正 ${(t.totalOffsetMinutes ?? t.offsetMinutes)} 分钟）`);
    lines.push(`时辰：${r.l1.shichen.name}`, `农历：${r.l1.lunar.lunarDate}`, `四柱：${r.l1.lunar.yearGanZhi} ${r.l1.lunar.monthGanZhi} ${r.l1.lunar.dayGanZhi} ${r.l1.lunar.timeGanZhi}`);
    lines.push(`误差等级：${r.l1.rating.grade}（置信度 ${r.l1.rating.confidence}%）`, '');
  }
  if (r.l2) {
    lines.push('【L2 术数算力】');
    for (const s of r.l2.schools) lines.push(`- ${s.school}（${s.version}）：${s.note}`);
    const b = r.l2.bazi;
    lines.push(`日主：${b.dayMaster.gan}（${b.dayMaster.wuxing}）· ${b.strength}`, `五行：${Object.entries(b.wuxingCount).map(([k, v]) => `${k}${v}`).join(' ')}`, '');
  }
  if (r.l3) {
    lines.push('【L3 科学祛魅】', r.l3.disenchantNote);
    lines.push(`人格维度：${r.l3.personality.map((p) => `${p.dimension}${p.score}`).join(' ')}`);
    lines.push(`天赋：${r.l3.strengths.join('、')}`, `可发展：${r.l3.growth.join('、')}`, '');
  }
  if (r.l4) {
    lines.push('【L4 六维落地】', `权重：先天${r.l4.weightModel.xiantian * 100}% / 流年${r.l4.weightModel.liunian * 100}% / 人为${r.l4.weightModel.renwei * 100}%`);
    for (const d of r.l4.dimensions) lines.push(`- ${d.name}：${d.total}（${d.advice}）`);
    lines.push('', r.l4.summary, '');
  }
  if (r.l5) {
    lines.push('【L5 因果溯源】', `主卡点：${r.l5.mainKnot}`);
    for (const k of r.l5.karmaPatterns) lines.push(`- ${k.name}：${k.root}`);
    lines.push('', `化解：${r.l5.resolutionPath.join('；')}`, '');
  }
  if (r.l6) {
    lines.push('【L6 量子多线】');
    for (const ln of r.l6.lines) lines.push(`- ${ln.name}（契合 ${ln.fit}）：${ln.strategy}`);
    for (const bp of r.l6.branchPoints) lines.push(`分叉点 ${bp.year}：A=${bp.decisionA}→${bp.pathA} / B=${bp.decisionB}→${bp.pathB}`);
    if (r.risks.length > 0) {
      lines.push('风险提示：');
      for (const rk of r.risks) lines.push(`- Lv${rk.risk_level}/5${rk.year ? `（${rk.year}）` : ''}：${rk.trigger_condition}｜应对：${rk.mitigation}`);
    }
    lines.push('', r.l6.note, '');
  }
  if (r.l7) {
    lines.push('【L7 元规则内核】');
    for (const s of r.l7.synthesis) lines.push(`- ${s}`);
    lines.push('', r.l7.coreNote, '');
  }
  if (r.l8) {
    lines.push('【L8 七级改运】');
    for (const lv of r.l8.levels) {
      lines.push(`L${lv.level} ${lv.name}`);
      for (const it of lv.items) lines.push(`  - ${it.title}（${it.execCycle}）：${it.content}`);
    }
    lines.push('', r.l8.note, '');
  }
  if (r.l9) {
    lines.push('【L9 实相兜底】');
    for (const l of r.l9.lifeLessons) lines.push(`- ${l.title}：${l.content}`);
    lines.push('', `核心要义：${r.l9.essence}`, `箴言：${r.l9.mantra}`, '', r.l9.finalNote);
  }
  lines.push('', '='.repeat(30), '仅供文化娱乐与自我观察参考。');
  return lines.join('\n');
}

function Layer1({ l1 }: { l1: L1Result }) {
  const t = l1.timeCorrection;
  return (
    <div className="l1-report">
      <section>
        <h3>校正结果</h3>
        <table className="kv">
          <tbody>
            <tr>
              <td>出生城市</td>
              <td>
                {l1.location ? `${l1.location.cityName}（${l1.location.province}）` : '未提供城市'}
                {l1.location && (
                  <span className="dim">
                    {' '}
                    经度 {l1.location.longitude}° / 纬度 {l1.location.latitude}°
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td>钟表时间</td>
              <td>
                {l1.normalized.solarDate} {l1.normalized.solarTime}
              </td>
            </tr>
            <tr>
              <td>真太阳时</td>
              <td>
                <strong>{fmtHour(t.trueSolarHours)}</strong>
                <span className="dim">
                  {' '}
                  （平太阳时 {fmtHour(t.meanSolarHours)} · 均时差{' '}
                  {t.equationOfTimeMinutes.toFixed(1)} 分钟 · 总校正{' '}
                  {(t.totalOffsetMinutes ?? t.offsetMinutes) > 0 ? '+' : ''}
                  {t.totalOffsetMinutes ?? t.offsetMinutes} 分钟）
                </span>
              </td>
            </tr>
            <tr>
              <td>十二时辰</td>
              <td>
                {l1.shichen.name}（{l1.shichen.branch}时）
                {t.crossDay && <span className="warn"> · 跨日边界，日柱归属需多版本比对</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

          {l1.dstAdjustment?.applied && (
            <section>
              <h3>夏令时校正（1986-1991）</h3>
              <div className="grade grade-b">
                <p>{l1.dstAdjustment.note}</p>
              </div>
            </section>
          )}

      <section>
        <h3>农历与干支</h3>
        <table className="kv">
          <tbody>
            <tr>
              <td>农历</td>
              <td>{l1.lunar.lunarDate}</td>
            </tr>
            <tr>
              <td>四柱</td>
              <td>
                年 {l1.lunar.yearGanZhi} · 月 {l1.lunar.monthGanZhi} · 日 {l1.lunar.dayGanZhi} ·
                时 {l1.lunar.timeGanZhi}
              </td>
            </tr>
            <tr>
              <td>生肖</td>
              <td>{l1.lunar.yearAnimal}</td>
            </tr>
            <tr>
              <td>节气归属</td>
              <td>{l1.lunar.jieQiNote}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3>误差公示</h3>
        <div className={`grade grade-${l1.rating.grade.toLowerCase()}`}>
          <strong>误差等级 {l1.rating.grade} · 置信度 {l1.rating.confidence}%</strong>
          <p>{l1.rating.message}</p>
          {l1.rating.suggest.length > 0 && (
            <ul>
              {l1.rating.suggest.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {l1.boundaryRisk && (
            <p className="warn">本次校正检测到交节/换日边界风险，时辰与日柱结论请以多版本比对为准。</p>
          )}
        </div>
      </section>
    </div>
  );
}

type PillarRow = {
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
};

function Layer2({ l2 }: { l2: L2Result }) {
  const bazi = l2.bazi;
  const pillars = (l2.schools.find((s) => s.school === '八字命理')?.data as { pillars: PillarRow[] })
    .pillars;
  const nayinSchool = l2.schools.find((s) => s.school === '纳音五行论命');
  const nayinData = nayinSchool?.data as {
    yearNaYin: string;
    dayNaYin: string;
    dayNaYinWuXing: string;
    profile: string;
  };

  return (
    <div className="l2-report">
      <p className="hint">{l2.schoolNote}</p>
      {bazi.sectNote && <p className="dim">{bazi.sectNote}</p>}

      <section>
        <h3>八字命理（V1）</h3>
        <table className="pillars">
          <thead>
            <tr>
              <th>柱</th>
              <th>干支</th>
              <th>五行</th>
              <th>纳音</th>
              <th>十神(干)</th>
              <th>十神(支)</th>
              <th>藏干</th>
              <th>长生</th>
            </tr>
          </thead>
          <tbody>
            {pillars.map((p) => (
              <tr key={p.position}>
                <td>{p.position === 'year' ? '年' : p.position === 'month' ? '月' : p.position === 'day' ? '日' : '时'}</td>
                <td className="strong">{p.ganzhi}</td>
                <td>{p.wuxing}</td>
                <td>{p.nayin}</td>
                <td>{p.shishenGan}</td>
                <td>{p.shishenZhi}</td>
                <td>{p.hideGan}</td>
                <td>{p.dishi}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="kv">
          <tbody>
            <tr>
              <td>日主</td>
              <td>
                {bazi.dayMaster.gan}（{bazi.dayMaster.wuxing}） · 旺衰 {bazi.strength}
              </td>
            </tr>
            <tr>
              <td>五行分布</td>
              <td>
                {Object.entries(bazi.wuxingCount)
                  .map(([wx, n]) => `${wx}${n}`)
                  .join(' · ')}
              </td>
            </tr>
            <tr>
              <td>十神结构</td>
              <td>{bazi.shishenStats.map((s) => `${s.name}×${s.count}`).join(' · ')}</td>
            </tr>
            <tr>
              <td>旬空</td>
              <td>
                {bazi.xunKong.xun}旬 · 空{bazi.xunKong.kong}
              </td>
            </tr>
            <tr>
              <td>胎元 / 命宫</td>
              <td>
                {bazi.taiYuan} / {bazi.mingGong}
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <p className="sub-title">大运走势（前 5 步）</p>
          <div className="dayun-list">
            {bazi.daYun.map((d) => (
              <span key={d.index} className={`dayun-item ${d.index === bazi.currentDaYun?.index ? 'active' : ''}`}>
                {d.ganzhi}（{d.startAge}岁 · {d.startYear}-{d.endYear}）
              </span>
            ))}
          </div>
          {bazi.currentDaYun && (
            <p className="dim">
              当前大运 {bazi.currentDaYun.ganzhi}（{bazi.currentDaYun.startYear}-
              {bazi.currentDaYun.endYear}，{bazi.currentDaYun.startAge}岁起）
            </p>
          )}
        </div>
      </section>

      <section>
        <h3>纳音五行论命（V1）</h3>
        <table className="kv">
          <tbody>
            <tr>
              <td>年柱纳音</td>
              <td>{nayinData.yearNaYin}</td>
            </tr>
            <tr>
              <td>日柱纳音</td>
              <td>
                {nayinData.dayNaYin}（五行{nayinData.dayNaYinWuXing}）
              </td>
            </tr>
            <tr>
              <td>文化取象</td>
              <td>{nayinData.profile}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {l2.conflicts.length > 0 && (
        <section>
          <h3>多流派冲突溯源</h3>
          {l2.conflicts.map((c, i) => (
            <p key={i} className="warn">
              {c}
            </p>
          ))}
          <p className="dim">冲突项将由 L7 元规则内核统一，不在此层直接下结论。</p>
        </section>
      )}
    </div>
  );
}

function Layer3({ l3 }: { l3: L3Result }) {
  return (
    <div className="l3-report">
      <div className="disenchant">
        <strong>祛魅声明</strong>
        <p>{l3.disenchantNote}</p>
      </div>

      <section>
        <h3>人格维度参考（0-100）</h3>
        <table className="kv">
          <tbody>
            {l3.personality.map((p) => (
              <tr key={p.dimension}>
                <td>{p.dimension}</td>
                <td>
                  <div className="bar-row">
                    <span className="bar-track">
                      <span className="bar-fill" style={{ width: `${p.score}%` }} />
                    </span>
                    <span className="bar-score">{p.score}</span>
                  </div>
                  <span className="dim">{p.desc}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>天赋优势</h3>
        <ul className="tag-list">
          {l3.strengths.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>可发展项（人格可塑，非标签）</h3>
        <ul className="tag-list">
          {l3.growth.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>行为逻辑解析</h3>
        <p>{l3.behaviorLogic}</p>
      </section>
    </div>
  );
}

function Layer4({ l4 }: { l4: L4Result }) {
  const w = l4.weightModel;
  return (
    <div className="l4-report">
      <section>
        <h3>权重模型（后台可动态浮动）</h3>
        <div className="weights">
          <span className="weight-chip">先天结构 {w.xiantian * 100}%</span>
          <span className="weight-chip">流年行运 {w.liunian * 100}%</span>
          <span className="weight-chip renwei">人为主动 {w.renwei * 100}%</span>
        </div>
        <p className="dim">{w.note}</p>
      </section>

      <section>
        <h3>六维落地评分</h3>
        <table className="kv">
          <thead>
            <tr>
              <th>维度</th>
              <th>先天</th>
              <th>流年</th>
              <th>人为</th>
              <th>加权总分</th>
            </tr>
          </thead>
          <tbody>
            {l4.dimensions.map((d) => (
              <tr key={d.key}>
                <td className="strong">{d.name}</td>
                <td>{d.xiantian}</td>
                <td>{d.liunian}</td>
                <td className="renwei">{d.renwei}</td>
                <td className="strong">{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="advice-list">
          {l4.dimensions.map((d) => (
            <p key={d.key}>
              <strong>{d.name}：</strong>
              {d.advice}
            </p>
          ))}
        </div>
      </section>

      <section>
        <div className="summary">
          <strong>结论</strong>
          <p>{l4.summary}</p>
        </div>
      </section>
    </div>
  );
}

function Layer5({ l5 }: { l5: L5Result }) {
  return (
    <div className="l5-report">
      <p className="hint">{l5.note}</p>
      {l5.karmaPatterns.map((p, i) => (
        <section key={i}>
          <h3>{p.name}</h3>
          <table className="kv">
            <tbody>
              <tr>
                <td>结构成因</td>
                <td>{p.cause}</td>
              </tr>
              <tr>
                <td>日常表现</td>
                <td>{p.manifestation}</td>
              </tr>
              <tr>
                <td>根源分析</td>
                <td>{p.root}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
      <section>
        <h3>主卡点：{l5.mainKnot}</h3>
        <ol className="path-list">
          {l5.resolutionPath.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Layer7({ l7 }: { l7: L7Result }) {
  return (
    <div className="l7-report">
      <section>
        <h3>元规则裁定</h3>
        <ol className="path-list">
          {l7.metaRules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      </section>
      {l7.conflictResolution.length > 0 && (
        <section>
          <h3>冲突裁定记录</h3>
          {l7.conflictResolution.map((c, i) => (
            <div key={i} className="conflict-item">
              <p className="warn">{c.conflict}</p>
              <p>
                <strong>裁定：</strong>
                {c.ruling}
              </p>
              <p className="dim">
                <strong>依据：</strong>
                {c.basis}
              </p>
            </div>
          ))}
        </section>
      )}
      <section>
        <h3>综合结论</h3>
        {l7.synthesis.map((s, i) => (
          <p key={i} className="synth-item">
            {s}
          </p>
        ))}
      </section>
      <div className="summary">
        <strong>内核声明</strong>
        <p>{l7.coreNote}</p>
      </div>
    </div>
  );
}

function Layer8({
  l8,
  plans,
  onToggle,
}: {
  l8: L8Result;
  plans: PlanItem[];
  onToggle: (plan: PlanItem) => void;
}) {
  const doneCount = plans.filter((p) => p.status === 'done').length;
  return (
    <div className="l8-report">
      <p className="hint">{l8.note}</p>
      {l8.levels.map((lv) => (
        <section key={lv.level}>
          <h3>
            L{lv.level} {lv.name}
          </h3>
          <ul className="plan-list">
            {lv.items.map((it, i) => (
              <li key={i}>
                <strong>{it.title}</strong>
                <span className="cycle">{it.execCycle}</span>
                <p>{it.content}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h3>执行打卡</h3>
        {plans.length === 0 ? (
          <p className="dim">暂无已落库的执行计划。</p>
        ) : (
          <>
            <div className="checkin-progress">
              <div className="bar-track">
                <span className="bar-fill" style={{ width: `${(doneCount / plans.length) * 100}%` }} />
              </div>
              <span className="dim">
                已完成 {doneCount}/{plans.length}
              </span>
            </div>
            <ul className="checkin-list">
              {plans.map((p) => (
                <li key={p.id} className={p.status === 'done' ? 'done' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={p.status === 'done'}
                      onChange={() => onToggle(p)}
                    />
                    <span>
                      <strong>
                        L{p.level} · {p.title}
                      </strong>
                      <span className="dim">{p.content}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Layer6({ l6, risks }: { l6: L6Result; risks: RiskItem[] }) {
  return (
    <div className="l6-report">
      <p className="hint">{l6.note}</p>
      <section>
        <h3>四条平行命运线</h3>
        <div className="line-grid">
          {l6.lines.map((ln) => (
            <div key={ln.key} className={`line-card ${ln.fit >= 70 ? 'top' : ''}`}>
              <div className="line-head">
                <strong>{ln.name}</strong>
                <span className="line-fit">契合 {ln.fit}</span>
              </div>
              <div className="bar-track">
                <span className="bar-fill" style={{ width: `${ln.fit}%` }} />
              </div>
              <p className="dim">{ln.strategy}</p>
              <p>
                <strong>进入条件：</strong>
                {ln.trigger}
              </p>
              <p>
                <strong>注意：</strong>
                {ln.risk}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>关键分叉点</h3>
        <table className="kv">
          <thead>
            <tr>
              <th>时间</th>
              <th>行运背景</th>
              <th>选择 A</th>
              <th>进入线</th>
              <th>选择 B</th>
              <th>进入线</th>
            </tr>
          </thead>
          <tbody>
            {l6.branchPoints.map((b, i) => (
              <tr key={i}>
                <td>
                  {b.year}（{b.age}岁）
                </td>
                <td>{b.context}</td>
                <td>{b.decisionA}</td>
                <td className="strong">{b.pathA}</td>
                <td>{b.decisionB}</td>
                <td className="strong">{b.pathB}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {risks.length > 0 && (
        <section>
          <h3>已知风险提示</h3>
          <p className="dim">源自卡点溯源（L5）与分叉点（L6）的落库风险项，按风险级别从高到低排列。</p>
          <ul className="risk-list">
            {risks.map((r) => (
              <li key={r.id} className={`risk-item risk-lv${r.risk_level}`}>
                <div className="risk-head">
                  <span className="risk-level">风险 Lv{r.risk_level}/5</span>
                  {r.year && <span className="dim">{r.year} 年关注</span>}
                </div>
                <p className="risk-trigger">{r.trigger_condition}</p>
                <p className="dim">应对：{r.mitigation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Layer9({ l9 }: { l9: L9Result }) {
  return (
    <div className="l9-report">
      <section>
        <h3>人生课题</h3>
        {l9.lifeLessons.map((l, i) => (
          <div key={i} className="lesson-item">
            <strong>{l.title}</strong>
            <p>{l.content}</p>
          </div>
        ))}
      </section>
      <div className="essence">
        <strong>核心要义</strong>
        <p>{l9.essence}</p>
      </div>
      <blockquote className="mantra">{l9.mantra}</blockquote>
      <div className="final-note">
        <strong>声明</strong>
        <p>{l9.finalNote}</p>
      </div>
    </div>
  );
}

export default function Report() {
  const { id } = useParams();
  const recordId = Number(id);
  const [l1, setL1] = useState<L1Result | null>(null);
  const [l2, setL2] = useState<L2Result | null>(null);
  const [l3, setL3] = useState<L3Result | null>(null);
  const [l4, setL4] = useState<L4Result | null>(null);
  const [l5, setL5] = useState<L5Result | null>(null);
  const [l6, setL6] = useState<L6Result | null>(null);
  const [l7, setL7] = useState<L7Result | null>(null);
  const [l8, setL8] = useState<L8Result | null>(null);
  const [l9, setL9] = useState<L9Result | null>(null);
  const [paidStatus, setPaidStatus] = useState(0);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    const res = await getRecord(recordId);
    if (res.data?.dataError) throw new Error('该记录报告数据异常，请返回记录列表重新测算');
    const r = res.data?.report;
    setL1(r?.l1 ?? null);
    setL2(r?.l2 ?? null);
    setL3(r?.l3 ?? null);
    setL4(r?.l4 ?? null);
    setL5(r?.l5 ?? null);
    setL6(r?.l6 ?? null);
    setL7(r?.l7 ?? null);
    setL8(r?.l8 ?? null);
    setL9(r?.l9 ?? null);
    setPaidStatus(res.data.paidStatus ?? 0);
    setLoadError('');
    return res;
  }, [recordId]);

  useEffect(() => {
    (async () => {
      try {
        await reload();
        const [pl, rk] = await Promise.all([getPlans(recordId), getRisks(recordId)]);
        if (pl.data) setPlans(pl.data.plans);
        if (rk.data) setRisks(rk.data.risks);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : '报告加载失败，请刷新重试');
      } finally {
        setLoading(false);
      }
    })();
  }, [reload, recordId]);

  const unlock = async () => {
    setUnlocking(true);
    setUnlockError('');
    try {
      const o = await createUnlockOrder(recordId);
      if (!o.data.alreadyUnlocked) {
        await payOrder(o.data.order.id, 'mock');
      }
      await reload();
      const [pl, rk] = await Promise.all([getPlans(recordId), getRisks(recordId)]);
      if (pl.data) setPlans(pl.data.plans);
      if (rk.data) setRisks(rk.data.risks);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : '解锁失败，请稍后重试');
    } finally {
      setUnlocking(false);
    }
  };

  const togglePlan = async (plan: PlanItem) => {
    const next: 'done' | 'pending' = plan.status === 'done' ? 'pending' : 'done';
    const before = plans.map((p) => (p.id === plan.id ? { ...p, status: next } : p));
    setPlans(before);
    try {
      const res = await patchPlan(plan.id, { status: next });
      if (res.data) {
        setPlans((cur) => cur.map((p) => (p.id === plan.id ? res.data : p)));
      }
    } catch {
      setPlans((cur) => cur.map((p) => (p.id === plan.id ? { ...p, status: plan.status } : p)));
    }
  };

  if (loading) return <div className="card">读取报告中…</div>;
  if (loadError) {
    return (
      <div className="card">
        <p className="error">{loadError}</p>
        <p className="dim">请检查网络后 <Link to={`/history`}>返回记录列表</Link> 重试。</p>
      </div>
    );
  }

  const layers: Array<{ layer: number; name: string; ready: boolean; locked: boolean; el?: ReactNode }> = [
    { layer: 1, name: LAYER_NAMES[0], ready: !!l1, locked: false, el: l1 ? <Layer1 l1={l1} /> : undefined },
    { layer: 2, name: LAYER_NAMES[1], ready: !!l2, locked: false, el: l2 ? <Layer2 l2={l2} /> : undefined },
    { layer: 3, name: LAYER_NAMES[2], ready: !!l3, locked: false, el: l3 ? <Layer3 l3={l3} /> : undefined },
    { layer: 4, name: LAYER_NAMES[3], ready: !!l4, locked: paidStatus !== 1, el: l4 ? <Layer4 l4={l4} /> : undefined },
    { layer: 5, name: LAYER_NAMES[4], ready: !!l5, locked: paidStatus !== 1, el: l5 ? <Layer5 l5={l5} /> : undefined },
    { layer: 6, name: LAYER_NAMES[5], ready: !!l6, locked: paidStatus !== 1, el: l6 ? <Layer6 l6={l6} risks={risks} /> : undefined },
    { layer: 7, name: LAYER_NAMES[6], ready: !!l7, locked: paidStatus !== 1, el: l7 ? <Layer7 l7={l7} /> : undefined },
    { layer: 8, name: LAYER_NAMES[7], ready: !!l8, locked: paidStatus !== 1, el: l8 ? <Layer8 l8={l8} plans={plans} onToggle={togglePlan} /> : undefined },
    { layer: 9, name: LAYER_NAMES[8], ready: !!l9, locked: paidStatus !== 1, el: l9 ? <Layer9 l9={l9} /> : undefined },
  ];

  const scrollToLayer = (layer: number) => {
    document.getElementById(`layer-${layer}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportText = async () => {
    const text = buildExportText({ l1, l2, l3, l4, l5, l6, l7, l8, l9, risks });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fate-report-${recordId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="report">
      <div className="card">
        <h2>测算报告</h2>
        <p className="hint">
          九层输出结构（PRD 规格）。基础层免费，深度层（L4-L9）付费解锁
          {paidStatus === 1 ? '，当前已解锁全量报告。' : '。'}
        </p>
        <button type="button" className="ghost export-btn" onClick={exportText}>
          {copied ? '已复制报告 ✓' : '复制报告文本'}
        </button>
        {paidStatus !== 1 && (
          <div className="lock-banner">
            <strong>深度报告解锁 ¥99</strong>
            <p>解锁 L4 六维落地、L5 卡点溯源、L6 命运线、L7 综合结论、L8 改运方案、L9 课题总结。</p>
            {unlockError && <p className="error">{unlockError}</p>}
            <button className="unlock-btn" onClick={unlock} disabled={unlocking}>
              {unlocking ? '支付处理中…' : '立即解锁'}
            </button>
          </div>
        )}

        <nav className="layer-nav">
          {layers.map((l) => (
            <button
              key={l.layer}
              type="button"
              onClick={() => scrollToLayer(l.layer)}
              className={`layer-nav-btn ${l.locked && !l.ready ? 'locked' : ''}`}
            >
              L{l.layer}
              {l.locked && !l.ready ? ' 🔒' : ''}
            </button>
          ))}
        </nav>
      </div>

      {layers.map((l) => (
        <div key={l.layer} id={`layer-${l.layer}`} className={`card layer-card ${l.ready ? 'ready' : 'pending'}`}>
          <div className="layer-head">
            <span className="layer-badge">L{l.layer}</span>
            <h3>{l.name}</h3>
            <span className={`pill ${l.ready ? 'pill-ready' : 'pill-pending'}`}>
              {l.ready ? '已上线' : '待上线'}
            </span>
          </div>
          {l.locked && !l.ready ? (
            <div className="lock-card">
              <strong>深度测算层已锁定</strong>
              <p>该层为付费深度内容，解锁后可查看完整解析与行动方案。</p>
              {unlockError && <p className="error">{unlockError}</p>}
              <button className="unlock-btn" onClick={unlock} disabled={unlocking}>
                {unlocking ? '处理中…' : '解锁该层'}
              </button>
            </div>
          ) : (
            l.el
          )}
          {!l.ready && <p className="dim">该层属于「{MODULE_HINT[l.layer]}」模块，将在后续阶段接入。</p>}
        </div>
      ))}

      <div className="card report-foot">
        <Link to="/">再测一次</Link> · <Link to="/history">查看历史记录</Link>
        <button className="ghost float-right" type="button" onClick={scrollTop}>
          回到顶部 ↑
        </button>
      </div>
    </div>
  );
}
