import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FeedPost,
  PostAction,
  PostActions,
  PostAvatar,
  PostCaption,
  PostCommentButton,
  PostCommentForm,
  PostComments,
  PostLikeButton,
  PostLikeCount,
  PostMedia,
  PostRoot,
  PostShareButton,
  PostTimestamp,
  type SocialPost
} from './index';

const makePost = (overrides: Partial<SocialPost> = {}): SocialPost => ({
  id: 'p1',
  author: { name: 'Ada Lovelace' },
  title: 'First steps',
  caption: 'Look at her go',
  media: [{ src: 'https://example.com/a.jpg', alt: 'Baby walking', width: 800, height: 1000 }],
  createdAt: '2026-05-04T12:00:00Z',
  likeCount: 2,
  liked: false,
  ...overrides
});

const likeButton = () => screen.getByRole('button', { name: /^(like|unlike)$/i });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('FeedPost', () => {
  it('renders the default layout with counts on the action buttons', () => {
    render(<FeedPost post={makePost({ commentCount: 4 })} />);

    expect(screen.getByRole('article')).toBeTruthy();
    // Author appears once, in the header; the caption is not prefixed with it.
    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'First steps' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Baby walking' })).toBeTruthy();
    expect(likeButton().textContent).toBe('2');
    expect(screen.getByRole('button', { name: 'Comment' }).textContent).toBe('4');
    expect(screen.getByText('Look at her go')).toBeTruthy();
    expect(screen.queryByText(/likes/)).toBeNull();
    // No comment handler: no form.
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('likes', () => {
  it('toggles optimistically and reports the new state', () => {
    const onLikeChange = vi.fn();
    const post = makePost();
    render(
      <PostRoot post={post} onLikeChange={onLikeChange}>
        <PostLikeButton />
        <PostLikeCount />
      </PostRoot>
    );

    fireEvent.click(likeButton());
    expect(onLikeChange).toHaveBeenCalledWith(true, post);
    expect(likeButton().getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('3 likes')).toBeTruthy();

    fireEvent.click(likeButton());
    expect(onLikeChange).toHaveBeenLastCalledWith(false, post);
    expect(screen.getByText('2 likes')).toBeTruthy();
  });

  it('rolls back when the handler rejects', async () => {
    let reject!: (error: Error) => void;
    const onLikeChange = vi.fn(() => new Promise((_, r) => (reject = r)));
    render(
      <PostRoot post={makePost()} onLikeChange={onLikeChange}>
        <PostLikeButton />
        <PostLikeCount />
      </PostRoot>
    );

    fireEvent.click(likeButton());
    expect(screen.getByText('3 likes')).toBeTruthy();

    await act(async () => reject(new Error('offline')));
    expect(likeButton().getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('2 likes')).toBeTruthy();
  });

  it('resyncs from props when the post changes underneath it', () => {
    const { rerender } = render(
      <PostRoot post={makePost()}>
        <PostLikeButton />
        <PostLikeCount />
      </PostRoot>
    );
    fireEvent.click(likeButton());
    expect(screen.getByText('3 likes')).toBeTruthy();

    rerender(
      <PostRoot post={makePost({ liked: true, likeCount: 10 })}>
        <PostLikeButton />
        <PostLikeCount />
      </PostRoot>
    );
    expect(screen.getByText('10 likes')).toBeTruthy();
  });

  it('hides a zero like count by default and accepts a custom format', () => {
    const { rerender } = render(
      <PostRoot post={makePost({ likeCount: 0 })}>
        <PostLikeCount />
      </PostRoot>
    );
    expect(screen.queryByText(/like/)).toBeNull();

    rerender(
      <PostRoot post={makePost({ likeCount: 0 })}>
        <PostLikeCount format={(count) => `${count} hearts`} />
      </PostRoot>
    );
    expect(screen.getByText('0 hearts')).toBeTruthy();
  });

  it('likes (but never unlikes) on a double tap of the media', () => {
    const onLikeChange = vi.fn();
    const { container } = render(
      <PostRoot post={makePost()} onLikeChange={onLikeChange}>
        <PostMedia />
        <PostLikeButton />
      </PostRoot>
    );
    const media = container.querySelector('.rsf-post__media') as HTMLElement;
    const doubleTap = () => {
      fireEvent.pointerUp(media, { clientX: 10, clientY: 10 });
      fireEvent.pointerUp(media, { clientX: 12, clientY: 11 });
    };

    doubleTap();
    expect(onLikeChange).toHaveBeenCalledTimes(1);
    expect(onLikeChange).toHaveBeenCalledWith(true, expect.anything());
    expect(container.querySelector('.rsf-post__like-burst')).toBeTruthy();

    doubleTap();
    expect(onLikeChange).toHaveBeenCalledTimes(1);
    expect(likeButton().getAttribute('aria-pressed')).toBe('true');
  });
});

describe('media', () => {
  it('reserves the first item aspect ratio and hides nav for a single item', () => {
    const { container } = render(
      <PostRoot post={makePost()}>
        <PostMedia />
      </PostRoot>
    );
    const media = container.querySelector('.rsf-post__media') as HTMLElement;
    expect(media.style.aspectRatio).toBe('800 / 1000');
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('pages through multiple items', () => {
    const post = makePost({
      media: [
        { src: 'https://example.com/1.jpg', alt: 'one' },
        { src: 'https://example.com/2.jpg', alt: 'two' },
        { src: 'https://example.com/3.jpg', alt: 'three', type: 'video' }
      ]
    });
    const { container } = render(
      <PostRoot post={post}>
        <PostMedia aspectRatio="4 / 5" />
      </PostRoot>
    );
    const counter = () => container.querySelector('.rsf-post__media-counter')?.textContent;

    expect((container.querySelector('.rsf-post__media') as HTMLElement).style.aspectRatio).toBe('4 / 5');
    expect(screen.getAllByRole('group').map((slide) => slide.getAttribute('aria-label'))).toEqual([
      '1 of 3',
      '2 of 3',
      '3 of 3'
    ]);
    expect(container.querySelector('video')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
    expect(counter()).toBe('1 / 3');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(counter()).toBe('3 / 3');
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(counter()).toBe('2 / 3');
  });

  it('supports a custom item renderer', () => {
    render(
      <PostRoot post={makePost()}>
        <PostMedia renderItem={(media, index) => <span>custom {index} {media.alt}</span>} />
      </PostRoot>
    );
    expect(screen.getByText('custom 0 Baby walking')).toBeTruthy();
  });
});

describe('share', () => {
  const renderShare = (props: Partial<Parameters<typeof PostRoot>[0]> = {}) =>
    render(
      <PostRoot post={makePost({ shareUrl: 'https://example.com/p/1' })} {...props}>
        <PostShareButton />
      </PostRoot>
    );
  const shareButton = () => screen.getByRole('button', { name: 'Share' });

  it('prefers a custom handler', async () => {
    const onShare = vi.fn();
    renderShare({ onShare });
    await act(async () => fireEvent.click(shareButton()));
    expect(onShare).toHaveBeenCalledOnce();
    expect(shareButton().dataset.status).toBe('shared');
  });

  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    renderShare();
    await act(async () => fireEvent.click(shareButton()));
    expect(share).toHaveBeenCalledWith({ title: 'First steps', text: 'Look at her go', url: 'https://example.com/p/1' });
  });

  it('treats a dismissed share sheet as a no-op', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')) });
    renderShare();
    await act(async () => fireEvent.click(shareButton()));
    expect(shareButton().dataset.status).toBeUndefined();
  });

  it('falls back to copying the link, then resets the status', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderShare({ shareStatusResetMs: 500 });
    await act(async () => fireEvent.click(shareButton()));
    expect(writeText).toHaveBeenCalledWith('https://example.com/p/1');
    expect(shareButton().dataset.status).toBe('copied');

    act(() => vi.advanceTimersByTime(500));
    expect(shareButton().dataset.status).toBeUndefined();
    vi.useRealTimers();
  });

  it('is disabled with neither a URL nor a handler', () => {
    render(
      <PostRoot post={makePost()}>
        <PostShareButton />
      </PostRoot>
    );
    expect((shareButton() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('comments', () => {
  const comments = [1, 2, 3, 4].map((n) => ({ id: `c${n}`, author: { name: `User ${n}` }, text: `comment ${n}` }));

  it('previews the newest comments and expands to the full list', () => {
    const onCommentsExpandedChange = vi.fn();
    render(
      <PostRoot post={makePost({ comments, commentCount: 9 })} onCommentsExpandedChange={onCommentsExpandedChange}>
        <PostComments />
      </PostRoot>
    );

    expect(screen.queryByText('comment 2')).toBeNull();
    expect(screen.getByText('comment 3')).toBeTruthy();
    expect(screen.getByText('comment 4')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View all 9 comments' }));
    expect(onCommentsExpandedChange).toHaveBeenCalledWith(true, expect.anything());
    expect(screen.getByText('comment 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide comments' }));
    expect(screen.queryByText('comment 1')).toBeNull();
  });

  it('renders nothing when there are no comments', () => {
    const { container } = render(
      <PostRoot post={makePost()}>
        <PostComments />
      </PostRoot>
    );
    expect(container.querySelector('.rsf-post__comments')).toBeNull();
  });

  it('submits trimmed text and clears the draft on success', async () => {
    const onCommentSubmit = vi.fn().mockResolvedValue(undefined);
    const post = makePost();
    render(
      <PostRoot post={post} onCommentSubmit={onCommentSubmit}>
        <PostCommentForm />
      </PostRoot>
    );
    const input = screen.getByRole('textbox', { name: 'Add a comment' }) as HTMLInputElement;
    const submit = screen.getByRole('button', { name: 'Post' }) as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '  so cute  ' } });
    await act(async () => fireEvent.click(submit));

    expect(onCommentSubmit).toHaveBeenCalledWith('so cute', post);
    expect(input.value).toBe('');
  });

  it('keeps the draft when submission fails', async () => {
    const onCommentSubmit = vi.fn().mockRejectedValue(new Error('nope'));
    render(
      <PostRoot post={makePost()} onCommentSubmit={onCommentSubmit}>
        <PostCommentForm />
      </PostRoot>
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Post' })));
    expect(input.value).toBe('hello');
  });

  it('comment button focuses the form, or defers to onCommentClick', () => {
    const { rerender } = render(
      <PostRoot post={makePost()} onCommentSubmit={vi.fn()}>
        <PostCommentButton />
        <PostCommentForm />
      </PostRoot>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));

    const onCommentClick = vi.fn();
    rerender(
      <PostRoot post={makePost()} onCommentClick={onCommentClick}>
        <PostCommentButton />
      </PostRoot>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(onCommentClick).toHaveBeenCalledOnce();
  });
});

describe('composition', () => {
  it('lets consumers replace default children and read state via render props', () => {
    render(
      <PostRoot post={makePost()}>
        <PostActions>
          {({ liked }) => (
            <>
              <PostLikeButton>{({ likeCount }) => `♥ ${likeCount}`}</PostLikeButton>
              <span>{liked ? 'yes' : 'no'}</span>
            </>
          )}
        </PostActions>
      </PostRoot>
    );

    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    fireEvent.click(likeButton());
    expect(likeButton().textContent).toBe('♥ 3');
    expect(screen.getByText('yes')).toBeTruthy();
  });

  it('swaps icons from the root without re-composing the buttons', () => {
    render(
      <PostRoot post={makePost()} icons={{ like: <span>+1</span>, liked: <span>✓</span> }}>
        <PostActions />
      </PostRoot>
    );

    expect(likeButton().textContent).toBe('+12');
    fireEvent.click(likeButton());
    expect(likeButton().textContent).toBe('✓3');
    // Icons not overridden keep their defaults.
    expect(screen.getByRole('button', { name: 'Share' }).querySelector('svg')).toBeTruthy();
  });

  it('lets consumers add their own actions that read post state', () => {
    const onSave = vi.fn();
    function SaveAction() {
      return (
        <PostAction aria-label="Save" icon={<span>S</span>} onClick={onSave}>
          save
        </PostAction>
      );
    }
    const { container } = render(
      <PostRoot post={makePost()}>
        <PostActions>
          <PostLikeButton showCount={false} />
          <SaveAction />
        </PostActions>
      </PostRoot>
    );

    expect(likeButton().textContent).toBe('');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.className).toContain('rsf-post__action');
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledOnce();
    expect(container.querySelector('.rsf-post__action-spacer')).toBeNull();
  });

  it('only prefixes the caption with the author when asked', () => {
    const { container, rerender } = render(
      <PostRoot post={makePost()}>
        <PostCaption />
      </PostRoot>
    );
    expect(container.querySelector('.rsf-post__caption')?.textContent?.trim()).toBe('Look at her go');

    rerender(
      <PostRoot post={makePost()}>
        <PostCaption showAuthor />
      </PostRoot>
    );
    expect(container.querySelector('.rsf-post__caption')?.textContent).toBe('Ada Lovelace Look at her go');
  });

  it('renders initials without an avatar image and a machine-readable timestamp', () => {
    const { container } = render(
      <PostRoot post={makePost()}>
        <PostAvatar />
        <PostTimestamp format={() => 'May 4'} />
      </PostRoot>
    );
    expect(container.querySelector('.rsf-post__avatar')?.textContent).toBe('AL');
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe('2026-05-04T12:00:00.000Z');
  });

  it('throws a helpful error outside a root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<PostLikeButton />)).toThrow(/PostLikeButton must be used within a <PostRoot>/);
  });
});
