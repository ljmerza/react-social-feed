import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PostLikeButton,
  PostLikers,
  PostMedia,
  PostRoot,
  useLongPress,
  type SocialAuthor,
  type SocialPost
} from './index';

const makePost = (overrides: Partial<SocialPost> = {}): SocialPost => ({
  id: 'p1',
  author: { name: 'Ada Lovelace' },
  media: [{ src: 'https://example.com/a.jpg', alt: 'Baby walking', width: 800, height: 1000 }],
  likeCount: 2,
  liked: false,
  ...overrides
});

const likers: SocialAuthor[] = [
  { id: 'u1', name: 'Grandma June', avatarUrl: 'https://example.com/june.jpg' },
  { id: 'u2', name: 'Leo Park', href: '/people/leo' }
];

const likeButton = () => screen.getByRole('button', { name: /^(like|unlike)$/i });

/** Press, hold for `ms`, release and click, the way a browser sequences a tap. */
function press(element: Element, ms: number, { x = 10, y = 10 } = {}) {
  fireEvent.pointerDown(element, { clientX: x, clientY: y, button: 0 });
  act(() => vi.advanceTimersByTime(ms));
  fireEvent.pointerUp(element, { clientX: x, clientY: y });
  fireEvent.click(element);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('long-pressing the like button', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('opens the likers instead of toggling the like', () => {
    const onLikeChange = vi.fn();
    const onLikeLongPress = vi.fn();
    const post = makePost();
    render(
      <PostRoot post={post} onLikeChange={onLikeChange} onLikeLongPress={onLikeLongPress}>
        {({ likersOpen }) => (
          <>
            <PostLikeButton />
            {likersOpen && <p>likers open</p>}
          </>
        )}
      </PostRoot>
    );

    press(likeButton(), 500);

    expect(onLikeLongPress).toHaveBeenCalledWith(post);
    expect(screen.getByText('likers open')).toBeTruthy();
    expect(onLikeChange).not.toHaveBeenCalled();
    expect(likeButton().getAttribute('aria-pressed')).toBe('false');
  });

  it('still likes on a short tap, and the next tap after a long press', () => {
    const onLikeChange = vi.fn();
    const onLikeLongPress = vi.fn();
    render(
      <PostRoot post={makePost()} onLikeChange={onLikeChange} onLikeLongPress={onLikeLongPress}>
        <PostLikeButton />
      </PostRoot>
    );

    press(likeButton(), 100);
    expect(onLikeChange).toHaveBeenCalledWith(true, expect.anything());
    expect(onLikeLongPress).not.toHaveBeenCalled();

    press(likeButton(), 600);
    expect(onLikeLongPress).toHaveBeenCalledTimes(1);
    press(likeButton(), 50);
    expect(onLikeChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it('is cancelled by moving, leaving or scrolling', () => {
    const onLikeLongPress = vi.fn();
    render(
      <PostRoot post={makePost()} onLikeLongPress={onLikeLongPress}>
        <PostLikeButton />
      </PostRoot>
    );
    const button = likeButton();

    // A small wobble is fine.
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(button, { clientX: 14, clientY: 13 });
    expect(button.hasAttribute('data-pressing')).toBe(true);
    fireEvent.pointerMove(button, { clientX: 40, clientY: 10 });
    expect(button.hasAttribute('data-pressing')).toBe(false);
    act(() => vi.advanceTimersByTime(1000));

    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerLeave(button);
    act(() => vi.advanceTimersByTime(1000));

    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.scroll(window);
    act(() => vi.advanceTimersByTime(1000));

    expect(onLikeLongPress).not.toHaveBeenCalled();
  });

  it('suppresses the context menu only while pressing', () => {
    render(
      <PostRoot post={makePost()} onLikeLongPress={vi.fn()}>
        <PostLikeButton />
      </PostRoot>
    );
    const button = likeButton();

    expect(fireEvent.contextMenu(button)).toBe(true);
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 0 });
    expect(fireEvent.contextMenu(button)).toBe(false);
    expect(button.classList.contains('rsf-long-press')).toBe(true);
  });

  it('ignores non-primary buttons', () => {
    const onLikeLongPress = vi.fn();
    render(
      <PostRoot post={makePost()} onLikeLongPress={onLikeLongPress}>
        <PostLikeButton />
      </PostRoot>
    );
    fireEvent.pointerDown(likeButton(), { clientX: 10, clientY: 10, button: 2 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onLikeLongPress).not.toHaveBeenCalled();
  });

  it('is off without a likers handler, so holding just likes', () => {
    const onLikeChange = vi.fn();
    render(
      <PostRoot post={makePost()} onLikeChange={onLikeChange}>
        <PostLikeButton />
      </PostRoot>
    );

    press(likeButton(), 800);
    expect(onLikeChange).toHaveBeenCalledWith(true, expect.anything());
    expect(likeButton().hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(likeButton().hasAttribute('aria-description')).toBe(false);
  });

  it('takes a custom delay, can be forced on, and can be turned off', () => {
    const onLikeLongPress = vi.fn();
    const { rerender } = render(
      <PostRoot post={makePost()} onLikeLongPress={onLikeLongPress}>
        <PostLikeButton longPress={{ delay: 1000 }} />
      </PostRoot>
    );
    press(likeButton(), 600);
    expect(onLikeLongPress).not.toHaveBeenCalled();
    press(likeButton(), 1000);
    expect(onLikeLongPress).toHaveBeenCalledTimes(1);

    rerender(
      <PostRoot post={makePost()} onLikeLongPress={onLikeLongPress}>
        <PostLikeButton longPress={false} />
      </PostRoot>
    );
    press(likeButton(), 1000);
    expect(onLikeLongPress).toHaveBeenCalledTimes(1);

    // Forced on with no root handler: the uncontrolled likersOpen state still opens.
    rerender(
      <PostRoot post={makePost()}>
        {({ likersOpen }) => (
          <>
            <PostLikeButton longPress />
            {likersOpen && <p>likers open</p>}
          </>
        )}
      </PostRoot>
    );
    press(likeButton(), 500);
    expect(screen.getByText('likers open')).toBeTruthy();
  });

  it('supports a controlled open state', () => {
    const onLikersOpenChange = vi.fn();
    const post = makePost();
    render(
      <PostRoot post={post} likersOpen={false} onLikersOpenChange={onLikersOpenChange}>
        {({ likersOpen }) => (
          <>
            <PostLikeButton />
            {likersOpen && <p>likers open</p>}
          </>
        )}
      </PostRoot>
    );

    press(likeButton(), 500);
    expect(onLikersOpenChange).toHaveBeenCalledWith(true, post);
    // Controlled: stays closed until the parent says otherwise.
    expect(screen.queryByText('likers open')).toBeNull();
  });

  it('leaves double-tap-to-like on the media alone', () => {
    const onLikeChange = vi.fn();
    const onLikeLongPress = vi.fn();
    const { container } = render(
      <PostRoot post={makePost()} onLikeChange={onLikeChange} onLikeLongPress={onLikeLongPress}>
        <PostMedia />
        <PostLikeButton />
      </PostRoot>
    );
    const media = container.querySelector('.rsf-post__media') as HTMLElement;
    fireEvent.pointerUp(media, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(media, { clientX: 12, clientY: 11 });

    expect(onLikeChange).toHaveBeenCalledWith(true, expect.anything());
    expect(onLikeLongPress).not.toHaveBeenCalled();
  });
});

describe('keyboard access to the likers', () => {
  it('opens them with Shift+Enter and describes the gesture', () => {
    const onLikeChange = vi.fn();
    const onLikeLongPress = vi.fn();
    render(
      <PostRoot post={makePost()} onLikeChange={onLikeChange} onLikeLongPress={onLikeLongPress}>
        <PostLikeButton />
      </PostRoot>
    );
    const button = likeButton();

    expect(button.getAttribute('aria-keyshortcuts')).toBe('Shift+Enter');
    expect(button.getAttribute('aria-description')).toBe('Long press or press Shift+Enter to see who liked this');

    // A plain Enter is left to the button (it clicks and likes).
    expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(true);
    expect(onLikeLongPress).not.toHaveBeenCalled();

    // Shift+Enter is prevented so the button doesn't also click.
    expect(fireEvent.keyDown(button, { key: 'Enter', shiftKey: true })).toBe(false);
    expect(onLikeLongPress).toHaveBeenCalledTimes(1);
    expect(onLikeChange).not.toHaveBeenCalled();
  });

  it('takes a custom shortcut and hint', () => {
    const onLikeLongPress = vi.fn();
    render(
      <PostRoot post={makePost()} onLikeLongPress={onLikeLongPress}>
        <PostLikeButton longPress={{ keyShortcut: 'Alt+L' }} likersHint="Hold to see who starred it" />
      </PostRoot>
    );
    const button = likeButton();

    expect(button.getAttribute('aria-keyshortcuts')).toBe('Alt+L');
    expect(button.getAttribute('aria-description')).toBe('Hold to see who starred it');
    fireEvent.keyDown(button, { key: 'Enter', shiftKey: true });
    expect(onLikeLongPress).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: 'l', altKey: true });
    expect(onLikeLongPress).toHaveBeenCalledTimes(1);
  });
});

describe('useLongPress', () => {
  function Card({ onLongPress, onPress }: { onLongPress: () => void; onPress: () => void }) {
    const { longPressProps } = useLongPress({ onLongPress, onPress, delay: 300, moveTolerance: 4 });
    return (
      <div role="button" tabIndex={0} {...longPressProps}>
        Card
      </div>
    );
  }

  it('attaches to any element', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    render(<Card onLongPress={onLongPress} onPress={onPress} />);
    const card = screen.getByRole('button', { name: 'Card' });

    press(card, 300);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    press(card, 100);
    expect(onPress).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(card, { clientX: 5, clientY: 0 });
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: 'Enter', shiftKey: true });
    expect(onLongPress).toHaveBeenCalledTimes(2);
  });
});

describe('PostLikers', () => {
  it('loads the likers, showing a loading state first', async () => {
    let resolve!: (value: SocialAuthor[]) => void;
    const loadLikers = vi.fn(() => new Promise<SocialAuthor[]>((r) => (resolve = r)));
    const post = makePost();
    const { container } = render(
      <PostRoot post={post}>
        <PostLikers loadLikers={loadLikers} />
      </PostRoot>
    );

    expect(loadLikers).toHaveBeenCalledWith(post);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    expect(container.querySelector('.rsf-likers')?.getAttribute('aria-busy')).toBe('true');

    await act(async () => resolve(likers));
    const list = screen.getByRole('list', { name: 'Liked by' });
    expect(list.textContent).toContain('Grandma June');
    expect(screen.getByRole('link', { name: 'Leo Park' }).getAttribute('href')).toBe('/people/leo');
    // Initials when there is no avatar image.
    expect(container.querySelectorAll('.rsf-likers__avatar')[1]?.textContent).toBe('LP');
    expect(container.querySelector('.rsf-likers')?.getAttribute('data-status')).toBe('ready');
    expect(loadLikers).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state, with a custom label or renderer', async () => {
    const loadLikers = () => Promise.resolve([]);
    const { rerender } = render(
      <PostRoot post={makePost()}>
        <PostLikers loadLikers={loadLikers} emptyLabel="Nobody yet" />
      </PostRoot>
    );
    expect(await screen.findByText('Nobody yet')).toBeTruthy();

    rerender(
      <PostRoot post={makePost()}>
        <PostLikers likers={[]} renderEmpty={() => <em>Be the first</em>} />
      </PostRoot>
    );
    expect(screen.getByText('Be the first')).toBeTruthy();
  });

  it('shows an error and retries the loader', async () => {
    const loadLikers = vi
      .fn<(post: SocialPost) => Promise<SocialAuthor[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(likers);
    render(
      <PostRoot post={makePost()}>
        <PostLikers loadLikers={loadLikers} errorLabel="Oops" retryLabel="Again" />
      </PostRoot>
    );

    expect((await screen.findByRole('alert')).textContent).toContain('Oops');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Again' })));
    expect(screen.getByText('Grandma June')).toBeTruthy();
    expect(loadLikers).toHaveBeenCalledTimes(2);
  });

  it('renders data you fetched yourself, with every state overridable', () => {
    const onRetry = vi.fn();
    const renderError = vi.fn((_error: unknown, retry: () => void) => (
      <button type="button" onClick={retry}>
        Reload
      </button>
    ));
    const { rerender } = render(
      <PostLikers post={makePost()} loading renderLoading={() => <p>Fetching…</p>} />
    );
    expect(screen.getByText('Fetching…')).toBeTruthy();

    rerender(<PostLikers post={makePost()} error={new Error('nope')} onRetry={onRetry} renderError={renderError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(renderError.mock.calls[0]?.[0]).toBeInstanceOf(Error);

    rerender(
      <PostLikers
        likers={likers}
        className="my-likers"
        listLabel="Starred by"
        renderLiker={(liker, index) => `${index + 1}. ${liker.name}`}
      />
    );
    expect(screen.getByRole('list', { name: 'Starred by' }).textContent).toBe('1. Grandma June2. Leo Park');
    expect(document.querySelector('.rsf-likers.my-likers')).toBeTruthy();
  });

  it('hands the whole state to a render function', () => {
    render(
      <PostLikers likers={likers}>
        {({ status, likers: list }) => <p>{`${status}: ${list.map((liker) => liker.name).join(', ')}`}</p>}
      </PostLikers>
    );
    expect(screen.getByText('ready: Grandma June, Leo Park')).toBeTruthy();
  });
});
