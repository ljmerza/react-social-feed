import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedPost, PostMedia, PostRoot, usePauseWhenHidden, type SocialPost } from './index';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly targets: Element[] = [];
  disconnected = false;

  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit
  ) {
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
  disconnect() {
    this.disconnected = true;
  }

  /** Report the target as `ratio` visible (0 = fully out of view). */
  fire(ratio: number) {
    const entry = { target: this.targets[0], isIntersecting: ratio > 0, intersectionRatio: ratio };
    act(() => this.callback([entry as any], this as any));
  }
}

const observerFor = (el: Element) => {
  const observer = MockIntersectionObserver.instances.find((io) => io.targets.includes(el));
  if (!observer) throw new Error('element is not observed');
  return observer;
};

/** Gives a jsdom video a controllable `paused` and spy-able play/pause. */
function fakePlayback(video: HTMLVideoElement, { playing }: { playing: boolean }) {
  let paused = !playing;
  Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
  const pause = vi.fn(() => {
    paused = true;
  });
  const play = vi.fn(() => {
    paused = false;
    return Promise.resolve();
  });
  video.pause = pause;
  video.play = play;
  return { pause, play };
}

const makePost = (overrides: Partial<SocialPost> = {}): SocialPost => ({
  id: 'p1',
  author: { name: 'Ada Lovelace' },
  media: [{ type: 'video', src: 'https://example.com/a.mp4', alt: 'First steps', width: 800, height: 1000 }],
  likeCount: 0,
  liked: false,
  ...overrides
});

const videos = (container: HTMLElement) => Array.from(container.querySelectorAll('video'));
const videoAt = (container: HTMLElement, index = 0) => {
  const video = videos(container)[index];
  if (!video) throw new Error(`no video at ${index}`);
  return video;
};

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pausing hidden videos', () => {
  it('pauses a playing video once it scrolls out of view', () => {
    const { container } = render(<FeedPost post={makePost()} />);
    const video = videoAt(container);
    const { pause } = fakePlayback(video, { playing: true });
    const observer = observerFor(video);

    expect(observer.options?.threshold).toBe(0.25);
    observer.fire(1);
    expect(pause).not.toHaveBeenCalled();

    observer.fire(0);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('pauses when less than the threshold is still visible', () => {
    const { container } = render(<FeedPost post={makePost()} />);
    const video = videoAt(container);
    const { pause } = fakePlayback(video, { playing: true });

    observerFor(video).fire(0.3);
    expect(pause).not.toHaveBeenCalled();
    observerFor(video).fire(0.1);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('leaves an already paused video alone', () => {
    const { container } = render(<FeedPost post={makePost()} />);
    const video = videoAt(container);
    const { pause } = fakePlayback(video, { playing: false });

    observerFor(video).fire(0);
    expect(pause).not.toHaveBeenCalled();
  });

  it('does not resume when the video comes back into view', () => {
    const { container } = render(<FeedPost post={makePost()} />);
    const video = videoAt(container);
    const { pause, play } = fakePlayback(video, { playing: true });
    const observer = observerFor(video);

    observer.fire(0);
    observer.fire(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
    expect(video.paused).toBe(true);
  });

  it('pauses only the video whose carousel slide was swiped away', () => {
    const post = makePost({
      media: [
        { type: 'video', src: 'https://example.com/a.mp4' },
        { type: 'image', src: 'https://example.com/b.jpg', alt: 'Photo' },
        { type: 'video', src: 'https://example.com/c.mp4' }
      ]
    });
    const { container } = render(<FeedPost post={post} />);
    const first = videoAt(container, 0);
    const last = videoAt(container, 1);
    const firstPlayback = fakePlayback(first, { playing: true });
    const lastPlayback = fakePlayback(last, { playing: true });

    // Each video gets its own observer; images are not observed.
    expect(MockIntersectionObserver.instances).toHaveLength(2);

    // Swiping to the next slide clips the first video out of view.
    observerFor(first).fire(0);
    expect(firstPlayback.pause).toHaveBeenCalledTimes(1);
    expect(lastPlayback.pause).not.toHaveBeenCalled();
  });

  it('keeps playing while the video is fullscreen', () => {
    const { container } = render(<FeedPost post={makePost()} />);
    const video = videoAt(container);
    const { pause } = fakePlayback(video, { playing: true });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => video });

    try {
      observerFor(video).fire(0);
      expect(pause).not.toHaveBeenCalled();
    } finally {
      delete (document as any).fullscreenElement;
    }

    observerFor(video).fire(0);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('keeps playing in the iOS native fullscreen player', () => {
    const { container } = render(<FeedPost post={makePost()} />);
    const video = videoAt(container);
    const { pause } = fakePlayback(video, { playing: true });
    Object.defineProperty(video, 'webkitDisplayingFullscreen', { configurable: true, value: true });

    observerFor(video).fire(0);
    expect(pause).not.toHaveBeenCalled();
  });

  it('can be turned off', () => {
    render(<FeedPost post={makePost()} pauseVideosWhenHidden={false} />);
    render(
      <PostRoot post={makePost({ id: 'p2' })}>
        <PostMedia pauseWhenHidden={false} />
      </PostRoot>
    );
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it('disconnects the observer on unmount', () => {
    const { container, unmount } = render(<FeedPost post={makePost()} />);
    const observer = observerFor(videoAt(container));

    expect(observer.disconnected).toBe(false);
    unmount();
    expect(observer.disconnected).toBe(true);
  });

  it('does nothing without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(<FeedPost post={makePost()} />);
    expect(videos(container)).toHaveLength(1);
  });
});

describe('usePauseWhenHidden', () => {
  function CustomVideo({ enabled, threshold }: { enabled?: boolean; threshold?: number }) {
    const ref = useRef<HTMLVideoElement>(null);
    usePauseWhenHidden(ref, { enabled, threshold });
    return <video ref={ref} src="https://example.com/a.mp4" />;
  }

  it('works on a video rendered through renderItem', () => {
    const { container } = render(
      <PostRoot post={makePost()}>
        <PostMedia renderItem={() => <CustomVideo threshold={0.5} />} />
      </PostRoot>
    );
    const video = videoAt(container);
    const { pause } = fakePlayback(video, { playing: true });
    const observer = observerFor(video);

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(observer.options?.threshold).toBe(0.5);
    observer.fire(0.4);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('respects enabled: false', () => {
    render(<CustomVideo enabled={false} />);
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });
});
