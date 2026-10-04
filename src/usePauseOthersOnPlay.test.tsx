import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedPost, PostMedia, PostRoot, usePauseOthersOnPlay, type SocialPost } from './index';

/**
 * jsdom doesn't implement playback: give a video a controllable `paused` and a
 * spy-able pause/play. `start` mimics the browser starting playback (the
 * viewer pressing play), which flips `paused` and fires `play`.
 */
function fakePlayback(video: HTMLVideoElement, { playing }: { playing: boolean }) {
  let paused = !playing;
  Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
  const pause = vi.fn(() => {
    paused = true;
  });
  const play = vi.fn(() => Promise.resolve());
  video.pause = pause;
  video.play = play;
  const start = () => {
    paused = false;
    act(() => {
      video.dispatchEvent(new Event('play'));
    });
  };
  return { pause, play, start };
}

const makePost = (overrides: Partial<SocialPost> = {}): SocialPost => ({
  id: 'p1',
  author: { name: 'Ada Lovelace' },
  media: [{ type: 'video', src: 'https://example.com/a.mp4', alt: 'First steps', width: 800, height: 1000 }],
  likeCount: 0,
  liked: false,
  ...overrides
});

const twoVideoPost = makePost({
  media: [
    { type: 'video', src: 'https://example.com/a.mp4' },
    { type: 'image', src: 'https://example.com/b.jpg', alt: 'Photo' },
    { type: 'video', src: 'https://example.com/c.mp4' }
  ]
});

const videoAt = (container: HTMLElement, index = 0) => {
  const video = container.querySelectorAll('video')[index];
  if (!video) throw new Error(`no video at ${index}`);
  return video;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('one video at a time', () => {
  it('pauses the playing video when another starts in the same post', () => {
    const { container } = render(<FeedPost post={twoVideoPost} pauseVideosWhenHidden={false} />);
    const a = fakePlayback(videoAt(container, 0), { playing: true });
    const b = fakePlayback(videoAt(container, 1), { playing: false });

    b.start();
    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(b.pause).not.toHaveBeenCalled();
    expect(a.play).not.toHaveBeenCalled();
    expect(b.play).not.toHaveBeenCalled();
  });

  it('works across separate posts', () => {
    const first = render(<FeedPost post={makePost({ id: 'p1' })} />);
    const second = render(<FeedPost post={makePost({ id: 'p2' })} />);
    const a = fakePlayback(videoAt(first.container), { playing: true });
    const b = fakePlayback(videoAt(second.container), { playing: false });

    b.start();
    expect(a.pause).toHaveBeenCalledTimes(1);

    a.start();
    expect(b.pause).toHaveBeenCalledTimes(1);
  });

  it('leaves already paused videos alone', () => {
    const { container } = render(<FeedPost post={twoVideoPost} />);
    const a = fakePlayback(videoAt(container, 0), { playing: false });
    const b = fakePlayback(videoAt(container, 1), { playing: false });

    b.start();
    expect(a.pause).not.toHaveBeenCalled();
  });

  it('leaves out an opted-out video both ways', () => {
    const optedIn = render(<FeedPost post={makePost({ id: 'p1' })} />);
    const optedOut = render(<FeedPost post={makePost({ id: 'p2' })} pauseOtherVideosOnPlay={false} />);
    const inVideo = fakePlayback(videoAt(optedIn.container), { playing: false });
    const outVideo = fakePlayback(videoAt(optedOut.container), { playing: false });

    // The opted-out video starting doesn't pause the opted-in one...
    inVideo.start();
    outVideo.start();
    expect(inVideo.pause).not.toHaveBeenCalled();

    // ...and the opted-in one starting doesn't pause it.
    inVideo.start();
    expect(outVideo.pause).not.toHaveBeenCalled();
  });

  it('can be turned off on PostMedia', () => {
    const { container } = render(
      <PostRoot post={twoVideoPost}>
        <PostMedia pauseOthersOnPlay={false} />
      </PostRoot>
    );
    const a = fakePlayback(videoAt(container, 0), { playing: true });
    const b = fakePlayback(videoAt(container, 1), { playing: false });

    b.start();
    expect(a.pause).not.toHaveBeenCalled();
  });

  it('unregisters on unmount', () => {
    const first = render(<FeedPost post={makePost({ id: 'p1' })} />);
    const second = render(<FeedPost post={makePost({ id: 'p2' })} />);
    const a = fakePlayback(videoAt(first.container), { playing: true });
    const b = fakePlayback(videoAt(second.container), { playing: false });

    first.unmount();
    // Gone from the group: starting another video doesn't reach it...
    b.start();
    expect(a.pause).not.toHaveBeenCalled();

    // ...and its play listener is gone, so it can't pause the others either.
    a.start();
    expect(b.pause).not.toHaveBeenCalled();
  });

  it('keeps a fullscreen video playing when another starts', () => {
    const { container } = render(<FeedPost post={twoVideoPost} />);
    const aVideo = videoAt(container, 0);
    const a = fakePlayback(aVideo, { playing: true });
    const b = fakePlayback(videoAt(container, 1), { playing: false });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => aVideo });

    try {
      b.start();
      expect(a.pause).not.toHaveBeenCalled();
    } finally {
      delete (document as any).fullscreenElement;
    }
  });

  it('keeps a picture-in-picture video playing when another starts', () => {
    const { container } = render(<FeedPost post={twoVideoPost} />);
    const aVideo = videoAt(container, 0);
    const a = fakePlayback(aVideo, { playing: true });
    const b = fakePlayback(videoAt(container, 1), { playing: false });
    Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => aVideo });

    try {
      b.start();
      expect(a.pause).not.toHaveBeenCalled();
    } finally {
      delete (document as any).pictureInPictureElement;
    }
  });

  it('pauses the others when the video starting is fullscreen', () => {
    const { container } = render(<FeedPost post={twoVideoPost} />);
    const a = fakePlayback(videoAt(container, 0), { playing: true });
    const bVideo = videoAt(container, 1);
    const b = fakePlayback(bVideo, { playing: false });
    Object.defineProperty(bVideo, 'webkitDisplayingFullscreen', { configurable: true, value: true });

    b.start();
    expect(a.pause).toHaveBeenCalledTimes(1);
  });
});

describe('usePauseOthersOnPlay', () => {
  function CustomVideo({ enabled }: { enabled?: boolean }) {
    const ref = useRef<HTMLVideoElement>(null);
    usePauseOthersOnPlay(ref, { enabled });
    return <video ref={ref} src="https://example.com/custom.mp4" />;
  }

  it('groups a renderItem video with the built-in ones', () => {
    const builtIn = render(<FeedPost post={makePost({ id: 'p1' })} />);
    const custom = render(
      <PostRoot post={makePost({ id: 'p2' })}>
        <PostMedia renderItem={() => <CustomVideo />} />
      </PostRoot>
    );
    const a = fakePlayback(videoAt(builtIn.container), { playing: true });
    const b = fakePlayback(videoAt(custom.container), { playing: false });

    b.start();
    expect(a.pause).toHaveBeenCalledTimes(1);

    a.start();
    expect(b.pause).toHaveBeenCalledTimes(1);
  });

  it('respects enabled: false', () => {
    const builtIn = render(<FeedPost post={makePost()} />);
    const custom = render(<CustomVideo enabled={false} />);
    const a = fakePlayback(videoAt(builtIn.container), { playing: true });
    const b = fakePlayback(videoAt(custom.container), { playing: false });

    b.start();
    expect(a.pause).not.toHaveBeenCalled();
  });
});
