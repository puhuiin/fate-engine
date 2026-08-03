/** L1 误差评级：根据输入完整度评估本次测算置信度（PRD L1「信息残缺自动误差评级」）。 */

export type TimePrecision = 'minute' | 'hour' | 'day' | 'fuzzy';
export type SourceReliability = 'certificate' | 'family' | 'estimate' | 'unknown';

export type ErrorGrade = 'A' | 'B' | 'C' | 'D';

export interface RatingInput {
  timePrecision: TimePrecision;
  sourceReliability: SourceReliability;
  hasCity: boolean; // 是否解析到经纬度
  nearBoundary: boolean; // 是否接近交节/换日边界
}

export interface RatingResult {
  grade: ErrorGrade;
  confidence: number; // 0-100
  message: string;
  suggest: string[]; // 建议补录项
}

const SOURCE_SCORE: Record<SourceReliability, number> = {
  certificate: 1.0,
  family: 0.8,
  estimate: 0.55,
  unknown: 0.35,
};

const PRECISION_SCORE: Record<TimePrecision, number> = {
  minute: 1.0,
  hour: 0.7,
  day: 0.4,
  fuzzy: 0.2,
};

export function rateInput(input: RatingInput): RatingResult {
  let base = SOURCE_SCORE[input.sourceReliability] * PRECISION_SCORE[input.timePrecision];

  if (!input.hasCity) base *= 0.8;
  if (input.nearBoundary) base *= 0.6;

  const confidence = Math.round(Math.max(0.05, Math.min(1, base)) * 100);

  let grade: ErrorGrade;
  if (confidence >= 85) grade = 'A';
  else if (confidence >= 60) grade = 'B';
  else if (confidence >= 35) grade = 'C';
  else grade = 'D';

  const suggest: string[] = [];
  if (input.timePrecision !== 'minute') suggest.push('尽量补充精确到分钟的出生时间（可询问医院出生记录）');
  if (input.sourceReliability !== 'certificate') suggest.push('确认时间来源，优先采用出生证明/医院记录');
  if (!input.hasCity) suggest.push('补充出生城市，用于经纬度与时区校正');
  if (input.nearBoundary) suggest.push('出生时间接近交节/换日边界，建议按前后两版时辰多版本比对');

  const message = `本次测算整体置信度为 ${confidence}%（误差等级 ${grade}）。${
    grade === 'A'
      ? '时间信息精确，校正结论可靠。'
      : grade === 'B'
        ? '时间存在分钟级或来源级误差，时辰结论基本可靠，细节结论请留意误差。'
        : grade === 'C'
          ? '仅能确定到日/模糊时辰，干支与宫位存在版本差异，建议补录后重算。'
          : '信息残缺严重，结论仅作方向性参考，强烈建议补录准确出生信息。'
  }`;

  return { grade, confidence, message, suggest };
}
