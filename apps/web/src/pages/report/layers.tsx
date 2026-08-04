import type { L1Result, L2Result, L3Result, L4Result, L5Result, L6Result, L7Result, L8Result, L9Result } from '../../api/client';
import type { PlanItem, RiskItem } from '../../api/client';
import { GLOSSARY_L1, GLOSSARY_L2, PlainGlossary, TermPlain } from './plain';
import { fmtHour } from './exportText';

export { buildExportText } from './exportText';

export function Layer1({ l1 }: { l1: L1Result }) {
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
              <td>
                <TermPlain term="真太阳时" plain="按出生地经度修正后的真实天文时间" />
              </td>
              <td>
                <strong>{fmtHour(t.trueSolarHours)}</strong>
                <span className="dim">
                  {' '}
                  （
                  <TermPlain term="平太阳时" plain="不修正经度、直接用标准时区的钟表时间" /> {fmtHour(t.meanSolarHours)} ·{' '}
                  <TermPlain term="均时差" plain="地球公转轨道不圆导致的日常钟表偏差" />{' '}
                  {t.equationOfTimeMinutes.toFixed(1)} 分钟 · 总校正{' '}
                  {(t.totalOffsetMinutes ?? t.offsetMinutes) > 0 ? '+' : ''}
                  {t.totalOffsetMinutes ?? t.offsetMinutes} 分钟）
                </span>
              </td>
            </tr>
            <tr>
              <td>
                <TermPlain term="十二时辰" plain="古代把一天分成 12 段，每段约 2 小时" />
              </td>
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
              <td>
                <TermPlain term="四柱" plain="年、月、日、时四组干支坐标" />
              </td>
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

      <PlainGlossary items={GLOSSARY_L1} />
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

export function Layer2({ l2 }: { l2: L2Result }) {
  const bazi = l2.bazi;
  const pillars = (l2.schools.find((s) => s.school === '八字命理')?.data as
    | { pillars: PillarRow[] }
    | undefined)?.pillars;
  const nayinSchool = l2.schools.find((s) => s.school === '纳音五行论命');
  const nayinData = nayinSchool?.data as
    | { yearNaYin: string; dayNaYin: string; dayNaYinWuXing: string; profile: string }
    | undefined;

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
              <th>
                <TermPlain term="十神" plain="与日主的关系称谓，描述性格角色" />
                (干)
              </th>
              <th>十神(支)</th>
              <th>
                <TermPlain term="藏干" plain="地支里「藏着」的五行" />
              </th>
              <th>
                <TermPlain term="长生" plain="五行生长到消亡的状态比喻" />
              </th>
            </tr>
          </thead>
          <tbody>
            {pillars ? (
              pillars.map((p) => (
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
              ))
            ) : (
              <tr>
                <td colSpan={8} className="dim">暂无四柱数据</td>
              </tr>
            )}
          </tbody>
        </table>
        <table className="kv">
          <tbody>
            <tr>
              <td>
                <TermPlain term="日主" plain="代表「你自己」的中心" />
              </td>
              <td>
                {bazi.dayMaster.gan}（{bazi.dayMaster.wuxing}） · 旺衰 {bazi.strength}
              </td>
            </tr>
            <tr>
              <td>
                <TermPlain term="五行" plain="金木水火土的文化隐喻" />
                分布
              </td>
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
              <td>
                <TermPlain term="旬空" plain="六旬中轮空的两个地支标记，民间择日用" />
              </td>
              <td>
                {bazi.xunKong.xun}旬 · 空{bazi.xunKong.kong}
              </td>
            </tr>
            <tr>
              <td>
                <TermPlain term="胎元 / 命宫" plain="传统推演的辅助坐标" />
              </td>
              <td>
                {bazi.taiYuan} / {bazi.mingGong}
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <p className="sub-title">
            <TermPlain term="大运" plain="传统认为约每 10 年进入一个新阶段，仅作节奏参考" />
            走势（前 5 步）
          </p>
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
              <td>{nayinData?.yearNaYin ?? '—'}</td>
            </tr>
            <tr>
              <td>日柱纳音</td>
              <td>
                {nayinData ? `${nayinData.dayNaYin}（五行${nayinData.dayNaYinWuXing}）` : '—'}
              </td>
            </tr>
            <tr>
              <td>文化取象</td>
              <td>{nayinData?.profile ?? '—'}</td>
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

      <PlainGlossary items={GLOSSARY_L2} />
    </div>
  );
}

export function Layer3({ l3 }: { l3: L3Result }) {
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

export function Layer4({ l4 }: { l4: L4Result }) {
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

export function Layer5({ l5 }: { l5: L5Result }) {
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

export function Layer7({ l7 }: { l7: L7Result }) {
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

export function Layer8({
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

export function Layer6({ l6, risks }: { l6: L6Result; risks: RiskItem[] }) {
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
      {l6.depthWindows && l6.depthWindows.length > 0 && (
        <section>
          <h3>各线行运窗口（深度模式）</h3>
          <p className="dim">把后续大运转换年份映射到四条线的节奏参考，用于长期规划。</p>
          <ul className="risk-list">
            {l6.depthWindows.map((w, i) => (
              <li key={i} className="risk-item">
                <div className="risk-head">
                  <span className="risk-level">{w.line}</span>
                </div>
                <p className="risk-trigger">{w.windows.join(' → ')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
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

export function Layer9({ l9 }: { l9: L9Result }) {
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
