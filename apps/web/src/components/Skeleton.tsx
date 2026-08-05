import type { CSSProperties, ReactNode } from 'react';

/** 骨架占位块：shimmer 渐变加载动画，替代纯文本 loading 提示 */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** 表格/列表型骨架：按行列生成占位块 */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-row" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 卡片容器骨架：撑起与真实卡片一致的高度，减少布局跳动 */
export function SkeletonCard({ children }: { children: ReactNode }) {
  return <div className="card skeleton-block">{children}</div>;
}
