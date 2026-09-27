import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Key,
  type ReactNode,
  type RefObject
} from 'react';
import { useVirtualizer, useWindowVirtualizer, type Virtualizer } from '@tanstack/react-virtual';

const LOADER_KEY = '__rsf-loader__';

export interface VirtualFeedProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Stable key per item. Strongly recommended so measured heights survive prepends. */
  getItemKey?: (item: T, index: number) => Key;
  /** Estimated row height in px before it is measured. Default 600. */
  estimateSize?: number | ((index: number) => number);
  /** Rows rendered beyond the viewport on each side. Default 3. */
  overscan?: number;
  /** Space between rows in px. */
  gap?: number;
  /**
   * Scroll container. Omit to virtualize against the window (the usual feed
   * layout); pass a getter to scroll inside an overflow element instead.
   */
  getScrollElement?: () => HTMLElement | null;
  /**
   * Distance from the top of the scroll content to the list, in px. Measured
   * automatically in window mode; set it for container mode if the list is not
   * the container's first child.
   */
  scrollMargin?: number;

  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Start loading when this many unrendered items remain. Default 3. */
  loadMoreThreshold?: number;
  renderLoader?: () => ReactNode;
  renderEnd?: () => ReactNode;
  renderEmpty?: () => ReactNode;

  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

const defaultLoader = () => <div className="rsf-virtual-feed__loader">Loading…</div>;

export function VirtualFeed<T>(props: VirtualFeedProps<T>) {
  // The two virtualizer hooks can't be swapped at runtime, so pick a component.
  return props.getScrollElement ? <ElementVirtualFeed {...props} /> : <WindowVirtualFeed {...props} />;
}

function useSharedOptions<T>({
  items,
  getItemKey,
  estimateSize = 600,
  overscan = 3,
  gap,
  hasMore = false,
  renderEnd
}: VirtualFeedProps<T>) {
  const showTrailingRow = hasMore || Boolean(renderEnd);
  return {
    count: items.length + (showTrailingRow ? 1 : 0),
    estimateSize: typeof estimateSize === 'function' ? estimateSize : () => estimateSize,
    overscan,
    gap,
    getItemKey: (index: number): Key =>
      index >= items.length ? LOADER_KEY : (getItemKey?.(items[index] as T, index) ?? index)
  };
}

function WindowVirtualFeed<T>(props: VirtualFeedProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [measuredMargin, setMeasuredMargin] = useState(0);
  const scrollMargin = props.scrollMargin ?? measuredMargin;

  useLayoutEffect(() => {
    if (props.scrollMargin !== undefined) return;
    const update = () => {
      const el = listRef.current;
      if (el) setMeasuredMargin(el.getBoundingClientRect().top + window.scrollY);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [props.scrollMargin]);

  const virtualizer = useWindowVirtualizer({ ...useSharedOptions(props), scrollMargin });
  return <VirtualFeedBody {...props} virtualizer={virtualizer} listRef={listRef} scrollMargin={scrollMargin} />;
}

function ElementVirtualFeed<T>(props: VirtualFeedProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const scrollMargin = props.scrollMargin ?? 0;
  const virtualizer = useVirtualizer({
    ...useSharedOptions(props),
    getScrollElement: props.getScrollElement as () => HTMLElement | null,
    scrollMargin
  });
  return <VirtualFeedBody {...props} virtualizer={virtualizer} listRef={listRef} scrollMargin={scrollMargin} />;
}

interface VirtualFeedBodyProps<T> extends VirtualFeedProps<T> {
  virtualizer: Virtualizer<Window, Element> | Virtualizer<HTMLElement, Element>;
  listRef: RefObject<HTMLDivElement | null>;
  scrollMargin: number;
}

function VirtualFeedBody<T>({
  items,
  renderItem,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  loadMoreThreshold = 3,
  renderLoader = defaultLoader,
  renderEnd,
  renderEmpty,
  className,
  style,
  'aria-label': ariaLabel,
  virtualizer,
  listRef,
  scrollMargin
}: VirtualFeedBodyProps<T>) {
  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1]!.index : -1;

  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore || lastIndex < 0) return;
    if (lastIndex >= items.length - 1 - loadMoreThreshold) onLoadMore();
  }, [hasMore, isLoadingMore, items.length, lastIndex, loadMoreThreshold, onLoadMore]);

  if (items.length === 0 && !hasMore && renderEmpty) {
    return <>{renderEmpty()}</>;
  }

  return (
    <div
      ref={listRef}
      role="feed"
      aria-busy={isLoadingMore}
      aria-label={ariaLabel}
      className={['rsf-virtual-feed', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', width: '100%', height: virtualizer.getTotalSize(), ...style }}
    >
      {virtualItems.map((virtualItem) => {
        const isTrailingRow = virtualItem.index >= items.length;
        return (
          <div
            key={virtualItem.key}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            className="rsf-virtual-feed__item"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start - scrollMargin}px)`
            }}
          >
            {isTrailingRow
              ? hasMore
                ? renderLoader()
                : renderEnd?.()
              : renderItem(items[virtualItem.index] as T, virtualItem.index)}
          </div>
        );
      })}
    </div>
  );
}
