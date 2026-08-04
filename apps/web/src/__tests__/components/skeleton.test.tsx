// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonCard, SkeletonRows } from '../../components/Skeleton';

describe('Skeleton 骨架屏', () => {
  it('SkeletonRows 生成指定行列数的占位块', () => {
    const { container } = render(<SkeletonRows rows={3} cols={4} />);
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(3);
    expect(container.querySelectorAll('.skeleton-row .skeleton')).toHaveLength(12);
  });

  it('Skeleton 占位块应用 className 与内联样式', () => {
    const { container } = render(<Skeleton className="custom" style={{ width: 100 }} />);
    const el = container.querySelector('.skeleton');
    expect(el).not.toBeNull();
    expect(el).toHaveClass('custom');
    expect(el).toHaveStyle({ width: '100px' });
  });

  it('SkeletonCard 提供卡片容器', () => {
    const { container } = render(
      <SkeletonCard>
        <Skeleton />
      </SkeletonCard>,
    );
    expect(container.querySelector('.card.skeleton-block')).not.toBeNull();
    expect(container.querySelector('.skeleton')).not.toBeNull();
  });
});
