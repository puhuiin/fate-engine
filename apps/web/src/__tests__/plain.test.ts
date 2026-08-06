import { describe, expect, it } from 'vitest';
import { buildPlainGuide } from '../pages/report/plain';

describe('buildPlainGuide 白话导读构建', () => {
  it('空输入返回空列表', () => {
    expect(buildPlainGuide({})).toEqual([]);
  });

  it('校正时间映射为「基础」条目', () => {
    const points = buildPlainGuide({ trueSolar: '20:36' });
    expect(points).toHaveLength(1);
    expect(points[0].tag).toBe('基础');
    expect(points[0].text).toContain('20:36');
  });

  it('人格维度取分数最高项为首条性格结论', () => {
    const personality = [
      { dimension: '逻辑', score: 70, desc: '理性分析强' },
      { dimension: '共情', score: 90, desc: '感受力突出' },
    ];
    const points = buildPlainGuide({ personality });
    const top = points.find((p) => p.tag === '性格');
    expect(top?.title).toContain('共情');
  });

  it('天赋/成长各截取前 3 项', () => {
    const strengths = ['a', 'b', 'c', 'd'];
    const growth = ['x', 'y'];
    const points = buildPlainGuide({ strengths, growth });
    const s = points.find((p) => p.tag === '天赋');
    const g = points.find((p) => p.tag === '成长');
    expect(s?.text).toBe('a；b；c');
    expect(g?.text).toBe('x；y');
  });

  it('解锁内容（卡点/结论/要义）仅在提供时输出', () => {
    const points = buildPlainGuide({ mainKnot: '卡点A', synthesis: ['结论一'], essence: '要义' });
    const tags = points.map((p) => p.tag);
    expect(tags).toEqual(['卡点', '结论', '要义']);
  });

  it('风险条目含触发条件与应对', () => {
    const points = buildPlainGuide({ risk: '2028 关注（应对：提前规划）' });
    expect(points[0].tag).toBe('提醒');
    expect(points[0].text).toContain('提前规划');
  });

  it('多线概览按契合度降序输出策略', () => {
    const lines = [
      { name: '事业', fit: 61, strategy: '稳扎稳打' },
      { name: '修行', fit: 100, strategy: '向内求索' },
      { name: '家庭', fit: 61, strategy: '多沟通' },
      { name: '健康', fit: 85, strategy: '规律作息' },
    ];
    const points = buildPlainGuide({ lines });
    const multi = points.find((p) => p.tag === '多线');
    expect(multi).toBeDefined();
    expect(multi?.title).toContain('命运线');
    expect((multi?.text.indexOf('修行') ?? 0)).toBeLessThan(multi?.text.indexOf('事业') ?? 0);
    expect(multi?.text).toContain('向内求索');
  });
});
