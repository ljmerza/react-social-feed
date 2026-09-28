import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  PostFavoriteButton,
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
const favoriteButton = () => screen.getByRole('button', { name: /favorites$/i });

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

describe('favorites', () => {
  it('toggles optimistically and reports the new state', () => {
    const onFavoriteChange = vi.fn();
    const post = makePost();
    const { container } = render(
      <PostRoot post={post} onFavoriteChange={onFavoriteChange}>
        <PostFavoriteButton />
      </PostRoot>
    );

    expect(favoriteButton().getAttribute('aria-label')).toBe('Add to favorites');
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(favoriteButton());
    expect(onFavoriteChange).toHaveBeenCalledWith(true, post);
    expect(favoriteButton().getAttribute('aria-label')).toBe('Remove from favorites');
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('article')?.hasAttribute('data-favorited')).toBe(true);

    fireEvent.click(favoriteButton());
    expect(onFavoriteChange).toHaveBeenLastCalledWith(false, post);
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('false');
  });

  it('rolls back when the handler rejects', async () => {
    let reject!: (error: Error) => void;
    const onFavoriteChange = vi.fn(() => new Promise((_, r) => (reject = r)));
    render(
      <PostRoot post={makePost()} onFavoriteChange={onFavoriteChange}>
        <PostFavoriteButton />
      </PostRoot>
    );

    fireEvent.click(favoriteButton());
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');

    await act(async () => reject(new Error('offline')));
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('false');
  });

  it('resyncs from props when the post changes underneath it', () => {
    const { rerender } = render(
      <PostRoot post={makePost({ favorited: true })}>
        <PostFavoriteButton />
      </PostRoot>
    );
    fireEvent.click(favoriteButton());
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('false');

    rerender(
      <PostRoot post={makePost({ favorited: false })}>
        <PostFavoriteButton />
      </PostRoot>
    );
    rerender(
      <PostRoot post={makePost({ favorited: true })}>
        <PostFavoriteButton />
      </PostRoot>
    );
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');
  });

  it('joins the default action row only with a handler', () => {
    const { rerender } = render(
      <PostRoot post={makePost()}>
        <PostActions />
      </PostRoot>
    );
    expect(screen.queryByRole('button', { name: /favorites$/i })).toBeNull();

    rerender(
      <PostRoot post={makePost()} onFavoriteChange={() => {}}>
        <PostActions />
      </PostRoot>
    );
    const buttons = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
    // Pushed right with share, ahead of it.
    expect(buttons.slice(-2)).toEqual(['Add to favorites', 'Share']);
  });

  it('accepts custom labels, icons and render props', () => {
    const { rerender } = render(
      <PostRoot post={makePost()} icons={{ favorite: <span>☆</span>, favorited: <span>★</span> }}>
        <PostFavoriteButton label={(on) => (on ? 'Unsave' : 'Save')} />
      </PostRoot>
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.textContent).toBe('☆');
    fireEvent.click(save);
    expect(screen.getByRole('button', { name: 'Unsave' }).textContent).toBe('★');

    rerender(
      <PostRoot post={makePost({ favorited: true })}>
        <PostFavoriteButton aria-label="Saved">{({ favorited }) => (favorited ? 'saved' : 'save')}</PostFavoriteButton>
      </PostRoot>
    );
    expect(screen.getByRole('button', { name: 'Saved' }).textContent).toBe('saved');
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

    expect(onCommentSubmit).toHaveBeenCalledWith('so cute', post, {});
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

describe('showing more comments', () => {
  const numbered = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({
      id: `c${from + i}`,
      author: { name: `User ${from + i}` },
      text: `comment ${from + i}`
    }));
  const shown = () =>
    [...document.querySelectorAll('.rsf-post__comment-body')].flatMap(
      (body) => body.textContent?.match(/comment \d+$/) ?? []
    );
  const showMore = () => screen.getByRole('button', { name: /^View / });

  it('shows the preview count, then reveals a page of earlier comments per click', () => {
    const onCommentsExpandedChange = vi.fn();
    render(
      <PostRoot post={makePost({ comments: numbered(1, 12) })} onCommentsExpandedChange={onCommentsExpandedChange}>
        <PostComments previewCount={3} pageSize={5} />
      </PostRoot>
    );
    expect(shown()).toEqual(['comment 10', 'comment 11', 'comment 12']);
    expect(showMore().textContent).toBe('View more comments (9)');

    fireEvent.click(showMore());
    expect(shown()).toHaveLength(8);
    expect(shown()[0]).toBe('comment 5');
    expect(onCommentsExpandedChange).toHaveBeenCalledOnce();
    expect(onCommentsExpandedChange).toHaveBeenCalledWith(true, expect.anything());

    fireEvent.click(showMore());
    expect(shown()).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /^View / })).toBeNull();
    expect(onCommentsExpandedChange).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Hide comments' }));
    expect(shown()).toEqual(['comment 10', 'comment 11', 'comment 12']);
    expect(onCommentsExpandedChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it('reveals everything on the first click without a page size', () => {
    render(
      <PostRoot post={makePost({ comments: numbered(1, 12) })}>
        <PostComments previewCount={3} />
      </PostRoot>
    );
    fireEvent.click(screen.getByRole('button', { name: 'View all 12 comments' }));
    expect(shown()).toHaveLength(12);
  });

  it('finishes a thread rather than splitting it across pages', () => {
    const comments = [
      ...numbered(1, 2),
      { id: 'r1', author: { name: 'A' }, text: 'reply one', parentId: 'c2' },
      { id: 'r2', author: { name: 'B' }, text: 'reply two', parentId: 'c2' },
      ...numbered(3, 4)
    ];
    render(
      <PostRoot post={makePost({ comments })}>
        <PostComments previewCount={1} pageSize={2} />
      </PostRoot>
    );
    expect(shown()).toEqual(['comment 4']);

    // Two more asked for, but comment 2's thread comes whole.
    fireEvent.click(showMore());
    expect(shown()).toEqual(['comment 2', 'comment 3', 'comment 4']);
    expect(screen.getByText('reply one')).toBeTruthy();
    expect(screen.getByText('reply two')).toBeTruthy();
    expect(screen.queryByText('comment 1')).toBeNull();
  });

  it('brings an older thread along when its newest reply is in view', () => {
    const comments = [
      ...numbered(1, 3),
      { id: 'r1', author: { name: 'A' }, text: 'late reply', parentId: 'c1' }
    ];
    render(
      <PostRoot post={makePost({ comments })}>
        <PostComments previewCount={1} pageSize={1} />
      </PostRoot>
    );
    expect(shown()).toEqual(['comment 1']);
    expect(screen.getByText('late reply')).toBeTruthy();
    fireEvent.click(showMore());
    expect(shown()).toEqual(['comment 1', 'comment 3']);
  });

  it('asks for the full thread when only a preview is loaded, then keeps paging once it arrives', () => {
    const onCommentsExpandedChange = vi.fn();
    const preview = makePost({ comments: numbered(18, 20), commentCount: 20 });
    const { rerender } = render(
      <PostRoot post={preview} onCommentsExpandedChange={onCommentsExpandedChange}>
        <PostComments previewCount={3} pageSize={5} loadingLabel="Loading…" />
      </PostRoot>
    );
    expect(showMore().textContent).toBe('View more comments (17)');

    fireEvent.click(showMore());
    expect(onCommentsExpandedChange).toHaveBeenCalledWith(true, expect.anything());
    // Nothing more to show until the thread loads: no dead button.
    expect(screen.queryByRole('button', { name: /^View / })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    expect(screen.queryByRole('button', { name: 'Hide comments' })).toBeNull();

    rerender(
      <PostRoot post={{ ...preview, comments: numbered(1, 20) }} onCommentsExpandedChange={onCommentsExpandedChange}>
        <PostComments previewCount={3} pageSize={5} loadingLabel="Loading…" />
      </PostRoot>
    );
    expect(shown()).toHaveLength(8);
    expect(shown()[0]).toBe('comment 13');
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(showMore());
    expect(shown()[0]).toBe('comment 8');
    expect(onCommentsExpandedChange).toHaveBeenCalledOnce();
  });

  it('hides the control while loading when no loading label is given', () => {
    render(
      <PostRoot post={makePost({ comments: numbered(1, 2), commentCount: 5 })}>
        <PostComments pageSize={2} />
      </PostRoot>
    );
    fireEvent.click(showMore());
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('accepts custom labels, a position and render props for the controls', () => {
    const { rerender } = render(
      <PostRoot post={makePost({ comments: numbered(1, 6) })}>
        <PostComments
          previewCount={2}
          pageSize={2}
          showMorePosition="end"
          showMoreLabel={(remaining, total) => `Earlier (${remaining} of ${total})`}
          hideLabel="Fewer"
        />
      </PostRoot>
    );
    const button = screen.getByRole('button', { name: 'Earlier (4 of 6)' });
    expect(button.previousElementSibling?.tagName).toBe('UL');
    expect(button.className).toContain('rsf-post__comments-toggle--more');
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Fewer' }).className).toContain('rsf-post__comments-toggle--hide');

    rerender(
      <PostRoot post={makePost({ comments: numbered(1, 6) })}>
        <PostComments
          previewCount={2}
          pageSize={2}
          renderShowMore={({ visibleCount, totalCount, showMore: more }) => (
            <a href="#more" onClick={more}>
              {visibleCount}/{totalCount}
            </a>
          )}
          renderHide={({ collapse }) => (
            <a href="#less" onClick={collapse}>
              less
            </a>
          )}
        />
      </PostRoot>
    );
    // The reveal state lives on the root, so the page carried over.
    fireEvent.click(screen.getByText('4/6'));
    expect(shown()).toHaveLength(6);
    expect(screen.queryByText(/\/6$/)).toBeNull();
    fireEvent.click(screen.getByText('less'));
    expect(shown()).toHaveLength(2);
  });

  it('exposes the reveal state and supports a controlled page', () => {
    const onCommentPageChange = vi.fn();
    const { rerender } = render(
      <PostRoot post={makePost({ comments: numbered(1, 10) })} commentPage={1} onCommentPageChange={onCommentPageChange}>
        {(state) => (
          <>
            <span data-testid="page">{state.commentPage}</span>
            <PostComments previewCount={2} pageSize={3} />
          </>
        )}
      </PostRoot>
    );
    expect(shown()).toHaveLength(5);
    fireEvent.click(showMore());
    expect(onCommentPageChange).toHaveBeenCalledWith(2, expect.anything());
    // Controlled: nothing moves until the parent passes the new page.
    expect(shown()).toHaveLength(5);

    rerender(
      <PostRoot post={makePost({ comments: numbered(1, 10) })} commentPage={Infinity}>
        <PostComments previewCount={2} pageSize={3} />
      </PostRoot>
    );
    expect(shown()).toHaveLength(10);
  });

  it('starts one page in with defaultCommentsExpanded', () => {
    render(
      <PostRoot post={makePost({ comments: numbered(1, 10) })} defaultCommentsExpanded>
        <PostComments previewCount={2} pageSize={3} />
      </PostRoot>
    );
    expect(shown()).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Hide comments' })).toBeTruthy();
  });
});

describe('replies', () => {
  const thread = [
    { id: 'c1', author: { name: 'Grandma' }, text: 'So sweet' },
    { id: 'c2', author: { name: 'Uncle Bob' }, text: '@Grandma agreed', parentId: 'c1' },
    { id: 'c3', author: { name: 'Aunt May' }, text: 'Top level' },
    { id: 'c4', author: { name: 'Grandpa' }, text: '@Uncle Bob me too', parentId: 'c2' }
  ];

  const renderThread = (onCommentSubmit = vi.fn().mockResolvedValue(undefined)) => {
    const post = makePost({ comments: thread });
    render(
      <PostRoot post={post} onCommentSubmit={onCommentSubmit} defaultCommentsExpanded>
        <PostComments />
        <PostCommentForm />
      </PostRoot>
    );
    return { post, onCommentSubmit };
  };

  const row = (text: string) => screen.getByText(text).closest('li')!;
  const replyTo = (text: string) =>
    fireEvent.click(within(row(text)).getAllByRole('button', { name: 'Reply' })[0]!);

  it('nests replies one level deep, including replies to replies', () => {
    renderThread();
    const replies = within(row('So sweet')).getByRole('list');

    expect(within(replies).getByText('@Grandma agreed')).toBeTruthy();
    expect(within(replies).getByText('@Uncle Bob me too')).toBeTruthy();
    // The reply to a reply sits beside it, not inside it.
    expect(within(row('@Uncle Bob me too')).queryByRole('list')).toBeNull();
    expect(within(row('@Grandma agreed')).queryByRole('list')).toBeNull();
    expect(within(row('Top level')).queryByRole('list')).toBeNull();
  });

  it('shows a reply on its own when its top-level comment is not loaded', () => {
    // A preview holding only the newest two comments.
    render(
      <PostRoot post={makePost({ comments: thread.slice(2), commentCount: 4 })}>
        <PostComments />
      </PostRoot>
    );
    expect(screen.getByText('@Uncle Bob me too')).toBeTruthy();
    expect(screen.queryByText('So sweet')).toBeNull();
  });

  it('never splits a thread from its top-level comment in the preview', () => {
    render(
      <PostRoot post={makePost({ comments: thread, commentCount: 4 })}>
        <PostComments previewCount={1} />
      </PostRoot>
    );
    const replies = within(row('So sweet')).getByRole('list');
    expect(within(replies).getByText('@Uncle Bob me too')).toBeTruthy();
    expect(within(replies).getByText('@Grandma agreed')).toBeTruthy();
    expect(screen.queryByText('Top level')).toBeNull();
  });

  it('tags the author and files the reply under the top-level comment', async () => {
    const { post, onCommentSubmit } = renderThread();
    const input = screen.getByRole('textbox', { name: 'Add a comment' }) as HTMLInputElement;

    replyTo('@Grandma agreed');
    expect(input.value).toBe('@Uncle Bob ');
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('Replying to Uncle Bob')).toBeTruthy();

    fireEvent.change(input, { target: { value: '@Uncle Bob same' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Post' })));

    expect(onCommentSubmit).toHaveBeenCalledWith('@Uncle Bob same', post, { parentId: 'c1' });
    expect(input.value).toBe('');
    expect(screen.queryByText('Replying to Uncle Bob')).toBeNull();
  });

  it('replies to a top-level comment under that comment', async () => {
    const { post, onCommentSubmit } = renderThread();
    replyTo('Top level');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('@Aunt May ');

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Post' })));
    expect(onCommentSubmit).toHaveBeenCalledWith('@Aunt May', post, { parentId: 'c3' });
  });

  it('keeps the reply open when submission fails', async () => {
    renderThread(vi.fn().mockRejectedValue(new Error('nope')));
    replyTo('So sweet');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Post' })));

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('@Grandma ');
    expect(screen.getByText('Replying to Grandma')).toBeTruthy();
  });

  it('cancels a reply with the button or Escape', () => {
    renderThread();
    const input = screen.getByRole('textbox') as HTMLInputElement;

    replyTo('So sweet');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(input.value).toBe('');
    expect(screen.queryByText('Replying to Grandma')).toBeNull();

    replyTo('So sweet');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  it('hides reply buttons when commenting is off', () => {
    render(
      <PostRoot post={makePost({ comments: thread })} defaultCommentsExpanded>
        <PostComments />
      </PostRoot>
    );
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
  });
});

describe('deleting comments', () => {
  const comments = [
    { id: 'c1', author: { name: 'Grandma' }, text: 'So sweet', canDelete: true },
    { id: 'c2', author: { name: 'Uncle Bob' }, text: 'Cute' }
  ];

  it('shows delete only on deletable comments and hands the comment over', () => {
    const onCommentDelete = vi.fn();
    const post = makePost({ comments });
    render(
      <PostRoot post={post} onCommentDelete={onCommentDelete}>
        <PostComments />
      </PostRoot>
    );

    const buttons = screen.getAllByRole('button', { name: 'Delete comment' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(onCommentDelete).toHaveBeenCalledWith(comments[0], post);
  });

  it('hides delete without onCommentDelete', () => {
    render(
      <PostRoot post={makePost({ comments })}>
        <PostComments />
      </PostRoot>
    );
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
  });

  it('accepts a custom delete label', () => {
    render(
      <PostRoot post={makePost({ comments })} onCommentDelete={vi.fn()}>
        <PostComments deleteLabel="Remove" />
      </PostRoot>
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
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
