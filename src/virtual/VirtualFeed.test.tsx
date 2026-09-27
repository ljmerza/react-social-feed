import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualFeed } from './index';

const items = Array.from({ length: 50 }, (_, i) => ({ id: `item-${i}`, label: `Post ${i}` }));

// jsdom has no layout, and the virtualizer measures rows via offsetHeight.
// Give rows a real height so the visible range is meaningful.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('rsf-virtual-feed__item') ? 500 : 0;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VirtualFeed', () => {
  it('renders only a window of rows against the window scroller', () => {
    render(
      <VirtualFeed
        items={items}
        getItemKey={(item) => item.id}
        estimateSize={500}
        overscan={1}
        renderItem={(item) => <div>{item.label}</div>}
        aria-label="Photos"
      />
    );

    expect(screen.getByRole('feed', { name: 'Photos' })).toBeTruthy();
    expect(screen.getByText('Post 0')).toBeTruthy();
    expect(screen.queryByText('Post 49')).toBeNull();
  });

  it('asks for more when the end of the list is in range', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <VirtualFeed
        items={items.slice(0, 2)}
        hasMore
        onLoadMore={onLoadMore}
        renderItem={(item) => <div>{item.label}</div>}
      />
    );
    expect(onLoadMore).toHaveBeenCalled();
    expect(screen.getByText('Loading…')).toBeTruthy();

    onLoadMore.mockClear();
    rerender(
      <VirtualFeed
        items={items.slice(0, 2)}
        hasMore
        isLoadingMore
        onLoadMore={onLoadMore}
        renderItem={(item) => <div>{item.label}</div>}
      />
    );
    expect(onLoadMore).not.toHaveBeenCalled();
    expect(screen.getByRole('feed').getAttribute('aria-busy')).toBe('true');
  });

  it('renders the end and empty states', () => {
    const { rerender } = render(
      <VirtualFeed
        items={items.slice(0, 1)}
        renderItem={(item) => <div>{item.label}</div>}
        renderEnd={() => <p>You're all caught up</p>}
      />
    );
    expect(screen.getByText("You're all caught up")).toBeTruthy();

    rerender(<VirtualFeed items={[]} renderItem={() => null} renderEmpty={() => <p>No posts yet</p>} />);
    expect(screen.getByText('No posts yet')).toBeTruthy();
    expect(screen.queryByRole('feed')).toBeNull();
  });

  it('virtualizes inside a scroll container when given one', () => {
    function ContainerFeed() {
      const ref = useRef<HTMLDivElement>(null);
      return (
        <div ref={ref} style={{ height: 400, overflow: 'auto' }}>
          <VirtualFeed items={items} getScrollElement={() => ref.current} renderItem={(item) => <div>{item.label}</div>} />
        </div>
      );
    }
    render(<ContainerFeed />);
    expect(screen.getByRole('feed')).toBeTruthy();
    expect(screen.queryByText('Post 49')).toBeNull();
  });
});
