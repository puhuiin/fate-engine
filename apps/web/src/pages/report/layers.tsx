import { memo } from 'react';
import type {
  L1Result,
  L2Result,
  L3Result,
  L4Result,
  L5Result,
  L6Result,
  L7Result,
  L8Result,
  L9Result,
} from '../../api/client';
import type { PlanItem, RiskItem, DeepL2 } from '../../api/client';
import { GLOSSARY_L1, GLOSSARY_L2, PlainGlossary, TermPlain } from './plain';
import { fmtHour } from './exportText';
import { deriveShishen, deriveXiJi, rankDimensions } from './derive';

export { buildExportText } from './exportText';

function Layer1Raw({ l1 }: { l1: L1Result }) {
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
                  <TermPlain term="平太阳时" plain="不修正经度、直接用标准时区的钟表时间" />{' '}
                  {fmtHour(t.meanSolarHours)} ·{' '}
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
                年 {l1.lunar.yearGanZhi} · 月 {l1.lunar.monthGanZhi} · 日 {l1.lunar.dayGanZhi} · 时{' '}
                {l1.lunar.timeGanZhi}
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
          <strong>
            误差等级 {l1.rating.grade} · 置信度 {l1.rating.confidence}%
          </strong>
          <p>{l1.rating.message}</p>
          {l1.rating.suggest.length > 0 && (
            <ul>
              {l1.rating.suggest.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {l1.boundaryRisk && (
            <p className="warn">
              本次校正检测到交节/换日边界风险，时辰与日柱结论请以多版本比对为准。
            </p>
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

function Layer2Raw({ l2 }: { l2: L2Result }) {
  const bazi = l2.bazi;
  const xi = deriveXiJi(bazi);
  const shishenInsight = deriveShishen(bazi);
  const baziSchool = l2.schools.find((s) => s.school === '八字命理');
  const pillars = (baziSchool?.data as { pillars: PillarRow[] } | undefined)?.pillars;
  const deep = (baziSchool?.data as { deep?: DeepL2 }).deep;
  const nayinSchool = l2.schools.find((s) => s.school === '纳音五行论命');
  const nayinData = nayinSchool?.data as
    { yearNaYin: string; dayNaYin: string; dayNaYinWuXing: string; profile: string } | undefined;

  const shenshaData = l2.schools.find((s) => s.school === '神煞格局')?.data as
    | {
        groups: Array<{
          group: string;
          stars: Array<{ name: string; pillar: string; at: string; note: string }>;
          interpretation: string;
        }>;
        note: string;
      }
    | undefined;

  const wuyunData = l2.schools.find((s) => s.school === '五运六气')?.data as
    | {
        zhongYun: { name: string; phase: string; qi: string; note: string };
        siTian: { qi: string; note: string };
        zaiQuan: { qi: string; note: string };
        keQi: Array<{ step: string; qi: string }>;
        zhuQi: Array<{ step: string; qi: string }>;
        xiangHe: { name: string; note: string };
        note: string;
      }
    | undefined;

  const liuqinData = l2.schools.find((s) => s.school === '十神六亲')?.data as
    | {
        relatives: Array<{
          name: string;
          category: string;
          count: number;
          level: string;
          note: string;
        }>;
        summary: string;
        note: string;
      }
    | undefined;

  const tiaohouData = l2.schools.find((s) => s.school === '调候用神')?.data as
    | {
        day: string;
        month: string;
        season: string;
        use: string[];
        usePresent: string[];
        useMissing: string[];
        balanced: boolean;
        principle: string;
        summary: string;
        note: string;
      }
    | undefined;

  const bingyaoData = l2.schools.find((s) => s.school === '病药论')?.data as
    | {
        bings: Array<{ wx: string; count: number; type: string; desc: string }>;
        yaos: Array<{ wx: string; role: string; desc: string }>;
        summary: string;
        note: string;
      }
    | undefined;

  const xingchongData = l2.schools.find((s) => s.school === '刑冲合害')?.data as
    | {
        ganHe: Array<{ a: string; b: string; pos: string; hua: string; desc: string }>;
        zhiHe: Array<{ a: string; b: string; pos: string; hua: string; desc: string }>;
        zhiChong: Array<{ a: string; b: string; pos: string; desc: string }>;
        zhiHai: Array<{ a: string; b: string; pos: string; desc: string }>;
        zhiXing: Array<{ a: string; b: string; pos: string; kind: string; desc: string }>;
        sanHe: Array<{ zhis: string[]; pos: string; name: string; desc: string }>;
        sanHui: Array<{ zhis: string[]; pos: string; name: string; desc: string }>;
        daYunJiao: Array<{ dir: string; ganzhi: string; kind: string; desc: string }>;
        summary: string;
        note: string;
      }
    | undefined;

  return (
    <div className="l2-report">
      <p className="hint">{l2.schoolNote}</p>
      {bazi.sectNote && <p className="dim">{bazi.sectNote}</p>}

      <section>
        <h3>八字命理（{l2.schools.find((s) => s.school === '八字命理')?.version ?? 'V1'}）</h3>
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
                  <td>
                    {p.position === 'year'
                      ? '年'
                      : p.position === 'month'
                        ? '月'
                        : p.position === 'day'
                          ? '日'
                          : '时'}
                  </td>
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
                <td colSpan={8} className="dim">
                  暂无四柱数据
                </td>
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
            {bazi.shenGong && (
              <tr>
                <td>
                  <TermPlain term="身宫 / 胎息" plain="传统推演的身心主位坐标" />
                </td>
                <td>
                  {bazi.shenGong} / {bazi.taiXi}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <section className="xiji-section">
          <h3>
            <TermPlain term="五行喜忌" plain="日主旺衰对应的宜用与忌避五行" />
            分析
          </h3>
          <div className="weights">
            <span className="weight-chip">喜用 {xi.xi.join('、')}</span>
            <span className="weight-chip">忌用 {xi.ji.join('、') || '无'}</span>
          </div>
          <p className="dim">
            偏强 {xi.strongest[0]}（{xi.strongest[1]} 处） · 偏弱/缺失 {xi.weakest[0]}（
            {xi.weakest[1]} 处）{xi.missing.length ? `；五行缺 ${xi.missing.join('、')}` : ''}
          </p>
          <p className="xiji-note">{xi.note}</p>
        </section>
        <section className="shishen-section">
          <h3>
            <TermPlain term="十神性格" plain="由十神结构推导的性格倾向，仅供参考" />
            解读
          </h3>
          <ul className="plain-points">
            {shishenInsight.map((t, i) => (
              <li key={i}>
                <div>
                  <p>{t}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <div>
          <p className="sub-title">
            <TermPlain term="大运" plain="传统认为约每 10 年进入一个新阶段，仅作节奏参考" />
            走势（前 5 步）
          </p>
          <div className="dayun-list">
            {bazi.daYun.map((d) => (
              <span
                key={d.index}
                className={`dayun-item ${d.index === bazi.currentDaYun?.index ? 'active' : ''}`}
              >
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

      {deep && (
        <section className="deep-l2">
          <h3>深度术数维度（V2）</h3>
          <table className="kv">
            <tbody>
              <tr>
                <td>
                  <TermPlain term="格局" plain="传统命理以月令定格局，作为命局层次的文化参考" />
                </td>
                <td>
                  {deep.geju.name}
                  {deep.geju.transGan ? `（${deep.geju.mainShiShen}透${deep.geju.transGan}）` : ''}
                </td>
              </tr>
              <tr>
                <td>
                  <TermPlain term="用神喜忌" plain="传统为平衡命局所选的关键五行，象征性提示" />
                </td>
                <td>
                  用 {deep.yongShen.yong} · 喜 {deep.yongShen.xi} · 忌 {deep.yongShen.ji}
                </td>
              </tr>
              <tr>
                <td>调候</td>
                <td>{deep.yongShen.tiaoHou}</td>
              </tr>
              <tr>
                <td>
                  <TermPlain term="神煞" plain="桃花、驿马等传统星曜称谓，仅作文化标签" />
                </td>
                <td>
                  {deep.shenSha.length
                    ? deep.shenSha.map((s) => `${s.name}（${s.position}${s.zi}）`).join(' · ')
                    : '四柱无神煞落宫'}
                </td>
              </tr>
              <tr>
                <td>
                  <TermPlain term="刑冲合害" plain="地支之间的传统互动关系，张力符号" />
                </td>
                <td>
                  {deep.xingChong.length
                    ? deep.xingChong
                        .map((x) => `${x.type} ${x.a}${x.b ? `/${x.b}` : ''}`)
                        .join('；')
                    : '四柱地支无明显冲合刑害'}
                </td>
              </tr>
              <tr>
                <td>
                  <TermPlain term="十二长生" plain="五行生长到消亡的十二阶段比喻" />
                </td>
                <td>
                  {deep.shiErChangSheng.positions
                    .map((p) => `${p.position}${p.zhi}${p.stage}`)
                    .join(' · ')}
                </td>
              </tr>
              <tr>
                <td>藏干透干</td>
                <td>
                  {deep.touGan
                    .map(
                      (t) =>
                        `${t.position}${t.hideGan.join('')}${
                          t.tou.length ? `（透${t.tou.join('、')}）` : ''
                        }`,
                    )
                    .join(' · ')}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="dim">{deep.geju.note}</p>
          <p className="dim">{deep.yongShen.note}</p>
        </section>
      )}

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

      <section>
        <h3>神煞格局（V1）</h3>
        {shenshaData ? (
          <>
            {shenshaData.groups.map((g) => (
              <div key={g.group} className="shensha-group">
                <p className="sub-title">{g.group}</p>
                {g.stars.length > 0 ? (
                  <ul>
                    {g.stars.map((s, i) => (
                      <li key={i}>
                        <strong>
                          {s.name}（{s.pillar}
                          {s.at}）
                        </strong>
                        {s.note && <span className="dim"> {s.note}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dim">该组未见显著命中。</p>
                )}
                <p className="dim">{g.interpretation}</p>
              </div>
            ))}
            <p className="hint">{shenshaData.note}</p>
          </>
        ) : (
          <p className="dim">暂无神煞数据。</p>
        )}
      </section>

      <section>
        <h3>五运六气（V1）</h3>
        {wuyunData ? (
          <>
            <table className="kv">
              <tbody>
                <tr>
                  <td>
                    <TermPlain term="中运" plain="出生年五运六气的大气候底色" />
                  </td>
                  <td>
                    {wuyunData.zhongYun.name}（{wuyunData.zhongYun.phase}）
                  </td>
                </tr>
                <tr>
                  <td>司天</td>
                  <td>{wuyunData.siTian.qi}</td>
                </tr>
                <tr>
                  <td>在泉</td>
                  <td>{wuyunData.zaiQuan.qi}</td>
                </tr>
                <tr>
                  <td>
                    <TermPlain term="运气相合" plain="岁运与司天五行关系" />
                  </td>
                  <td>
                    <strong>{wuyunData.xiangHe.name}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="sub-title">客气六步（三之气即司天，终之气即在泉）</p>
            <div className="qi-grid">
              {wuyunData.keQi.map((k, i) => (
                <span key={i} className={`qi-item ${i === 2 ? 'active' : ''}`}>
                  {k.step}：{k.qi}
                </span>
              ))}
            </div>
            <p className="sub-title">主气六步（每年固定）</p>
            <div className="qi-grid">
              {wuyunData.zhuQi.map((k, i) => (
                <span key={i} className="qi-item">
                  {k.step}：{k.qi}
                </span>
              ))}
            </div>
            <p className="dim">{wuyunData.zhongYun.note}</p>
            <p className="dim">{wuyunData.xiangHe.note}</p>
            <p className="dim">{wuyunData.siTian.note}</p>
            <p className="dim">{wuyunData.zaiQuan.note}</p>
            <p className="hint">{wuyunData.note}</p>
          </>
        ) : (
          <p className="dim">暂无五运六气数据。</p>
        )}
      </section>

      <section>
        <h3>十神六亲（V1）</h3>
        {liuqinData ? (
          <>
            <table className="kv">
              <tbody>
                {liuqinData.relatives.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>
                      <strong>
                        {r.level}（{r.count}）
                      </strong>
                      <span className="dim"> {r.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="summary">{liuqinData.summary}</p>
            <p className="hint">{liuqinData.note}</p>
          </>
        ) : (
          <p className="dim">暂无十神六亲数据。</p>
        )}
      </section>

      <section>
        <h3>
          调候用神（
          <TermPlain term="穷通宝鉴" plain="子平派四大分支之一的调候派典籍" />
          V1）
        </h3>
        {tiaohouData ? (
          <>
            <table className="kv">
              <tbody>
                <tr>
                  <td>
                    <TermPlain term="调候用神" plain="按出生月份寒暖定制的五行处方" />
                  </td>
                  <td className="strong">{tiaohouData.use.join('、') || '—'}</td>
                </tr>
                <tr>
                  <td>坐标</td>
                  <td>
                    {tiaohouData.day}日主 × {tiaohouData.month}月（{tiaohouData.season}季）
                  </td>
                </tr>
                <tr>
                  <td>命局已现</td>
                  <td>{tiaohouData.usePresent.join('、') || '无'}</td>
                </tr>
                <tr>
                  <td>命局未现</td>
                  <td>{tiaohouData.useMissing.join('、') || '无'}</td>
                </tr>
                <tr>
                  <td>调候是否到位</td>
                  <td>
                    {tiaohouData.balanced ? (
                      <span className="strong">到位（气候调和）</span>
                    ) : (
                      <span className="dim">有所欠缺</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="dim">{tiaohouData.principle}</p>
            <p className="summary">{tiaohouData.summary}</p>
            <p className="hint">{tiaohouData.note}</p>
          </>
        ) : (
          <p className="dim">暂无调候用神数据。</p>
        )}
      </section>

      <section>
        <h3>
          病药论（
          <TermPlain term="神峰通考" plain="明代「寻病定药」的命理方法" />
          V1）
        </h3>
        {bingyaoData ? (
          <>
            <table className="kv">
              <thead>
                <tr>
                  <th>病（失衡）</th>
                  <th>处数</th>
                  <th>状态</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {bingyaoData.bings.map((b) => (
                  <tr key={b.wx}>
                    <td className="strong">{b.wx}</td>
                    <td>{b.count}</td>
                    <td>{b.type === '太过' || b.type === '偏旺' ? '过旺' : '不及'}</td>
                    <td>{b.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="kv">
              <thead>
                <tr>
                  <th>药（补益）</th>
                  <th>作用</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {bingyaoData.yaos.map((y) => (
                  <tr key={y.wx + y.role}>
                    <td className="strong">{y.wx}</td>
                    <td>{y.role}</td>
                    <td>{y.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="summary">{bingyaoData.summary}</p>
            <p className="hint">{bingyaoData.note}</p>
          </>
        ) : (
          <p className="dim">暂无病药论数据。</p>
        )}
      </section>

      <section>
        <h3>
          刑冲合害（
          <TermPlain term="干支关系" plain="天干五合、地支六合/六冲/六害/三刑/三合三会" />
          V1）
        </h3>
        {xingchongData ? (
          <>
            {xingchongData.ganHe.length > 0 && (
              <table className="kv">
                <thead>
                  <tr>
                    <th>天干五合</th>
                    <th>位置</th>
                    <th>合化</th>
                  </tr>
                </thead>
                <tbody>
                  {xingchongData.ganHe.map((g) => (
                    <tr key={g.a + g.b + g.pos}>
                      <td className="strong">{g.a + g.b}</td>
                      <td>{g.pos}</td>
                      <td>
                        {g.hua} <span className="dim">{g.desc}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {xingchongData.zhiHe.length > 0 && (
              <table className="kv">
                <thead>
                  <tr>
                    <th>地支六合</th>
                    <th>位置</th>
                    <th>合化</th>
                  </tr>
                </thead>
                <tbody>
                  {xingchongData.zhiHe.map((z) => (
                    <tr key={z.a + z.b + z.pos}>
                      <td className="strong">{z.a + z.b}</td>
                      <td>{z.pos}</td>
                      <td>
                        {z.hua} <span className="dim">{z.desc}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {xingchongData.zhiChong.length > 0 && (
              <table className="kv">
                <thead>
                  <tr>
                    <th>六冲</th>
                    <th>位置</th>
                  </tr>
                </thead>
                <tbody>
                  {xingchongData.zhiChong.map((z) => (
                    <tr key={z.a + z.b + z.pos}>
                      <td className="strong">{z.a + z.b}</td>
                      <td>
                        {z.pos} <span className="dim">{z.desc}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {xingchongData.zhiHai.length > 0 && (
              <table className="kv">
                <thead>
                  <tr>
                    <th>六害</th>
                    <th>位置</th>
                  </tr>
                </thead>
                <tbody>
                  {xingchongData.zhiHai.map((z) => (
                    <tr key={z.a + z.b + z.pos}>
                      <td className="strong">{z.a + z.b}</td>
                      <td>
                        {z.pos} <span className="dim">{z.desc}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {xingchongData.zhiXing.length > 0 && (
              <table className="kv">
                <thead>
                  <tr>
                    <th>三刑/自刑</th>
                    <th>位置</th>
                    <th>刑名</th>
                  </tr>
                </thead>
                <tbody>
                  {xingchongData.zhiXing.map((z) => (
                    <tr key={z.a + z.b + z.pos + z.kind}>
                      <td className="strong">{z.a + z.b}</td>
                      <td>{z.pos}</td>
                      <td>
                        {z.kind} <span className="dim">{z.desc}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {xingchongData.sanHe.length > 0 &&
              xingchongData.sanHe.map((s) => (
                <p key={s.name} className="summary">
                  {s.zhis.join('')}三合成{s.name}：{s.desc}
                </p>
              ))}
            {xingchongData.sanHui.length > 0 &&
              xingchongData.sanHui.map((s) => (
                <p key={s.name} className="summary">
                  {s.zhis.join('')}三会{s.name}：{s.desc}
                </p>
              ))}
            {xingchongData.daYunJiao.length > 0 && (
              <table className="kv">
                <thead>
                  <tr>
                    <th>大运互动</th>
                    <th>干支</th>
                    <th>关系</th>
                  </tr>
                </thead>
                <tbody>
                  {xingchongData.daYunJiao.map((x, i) => (
                    <tr key={i}>
                      <td className="strong">{x.dir}</td>
                      <td>{x.ganzhi}</td>
                      <td>
                        {x.kind} <span className="dim">{x.desc}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="summary">{xingchongData.summary}</p>
            <p className="hint">{xingchongData.note}</p>
          </>
        ) : (
          <p className="dim">暂无刑冲合害数据。</p>
        )}
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

function Layer3Raw({ l3 }: { l3: L3Result }) {
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

function Layer4Raw({ l4 }: { l4: L4Result }) {
  const w = l4.weightModel;
  const { sorted, max, min } = rankDimensions(l4);
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
        <h3>六维总览（按综合分排序）</h3>
        <table className="kv">
          <thead>
            <tr>
              <th>维度</th>
              <th>先天</th>
              <th>流年</th>
              <th>人为</th>
              <th>加权总分</th>
              <th>强弱</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr key={d.key}>
                <td className="strong">{d.name}</td>
                <td>{d.xiantian}</td>
                <td>{d.liunian}</td>
                <td className="renwei">{d.renwei}</td>
                <td className="strong">{d.total}</td>
                <td className={i === 0 ? 'strong' : ''}>
                  {i === 0 ? '优势' : i === sorted.length - 1 ? '最需提升' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="dim">
          最强 {max.name}（{max.total} 分）· 最需提升 {min.name}（{min.total} 分）
        </p>
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

function Layer5Raw({ l5 }: { l5: L5Result }) {
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

function Layer7Raw({ l7 }: { l7: L7Result }) {
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

function Layer8Raw({
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
                <span
                  className="bar-fill"
                  style={{ width: `${(doneCount / plans.length) * 100}%` }}
                />
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

function Layer6Raw({ l6, risks }: { l6: L6Result; risks: RiskItem[] }) {
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
          <p className="dim">
            源自卡点溯源（L5）与分叉点（L6）的落库风险项，按风险级别从高到低排列。
          </p>
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

function Layer9Raw({ l9 }: { l9: L9Result }) {
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

/** 层组件为纯展示且数据引用稳定（报告加载后不变），memo 避免父级 state 变化（如切换支付渠道）触发 9 层全部重渲染 */
export const Layer1 = memo(Layer1Raw);
export const Layer2 = memo(Layer2Raw);
export const Layer3 = memo(Layer3Raw);
export const Layer4 = memo(Layer4Raw);
export const Layer5 = memo(Layer5Raw);
export const Layer6 = memo(Layer6Raw);
export const Layer7 = memo(Layer7Raw);
export const Layer8 = memo(Layer8Raw);
export const Layer9 = memo(Layer9Raw);
