import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useOptionalPostContext } from '../context/PostContext';
import type { SocialAuthor, SocialPost } from '../types';
import { cx, initialsOf } from '../utils';

export type PostLikersStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface UsePostLikersOptions {
  /** Post whose likers to load. Defaults to the nearest `PostRoot`'s post. */
  post?: SocialPost;
  /** The likers, when you fetch them yourself. Takes precedence over `loadLikers`. */
  likers?: SocialAuthor[];
  /** Fetches the likers on mount (and when the post changes). Resolve newest first. */
  loadLikers?: (post: SocialPost) => Promise<SocialAuthor[]>;
  /** Shows the loading state while `likers` isn't there yet. */
  loading?: boolean;
  /** Shows the error state. Any value other than null/undefined counts. */
  error?: unknown;
  /** Replaces the retry after an error, e.g. your query's refetch. Default: call `loadLikers` again. */
  onRetry?: () => void;
}

export interface PostLikersState {
  likers: SocialAuthor[];
  status: PostLikersStatus;
  error: unknown;
  retry: () => void;
}

interface LoadedLikers {
  likers?: SocialAuthor[];
  failed?: boolean;
  error?: unknown;
}

/** The loading logic behind `PostLikers`, for rendering the list entirely yourself. */
export function usePostLikers({
  post: postProp,
  likers: likersProp,
  loadLikers,
  loading = false,
  error: errorProp,
  onRetry
}: UsePostLikersOptions = {}): PostLikersState {
  const context = useOptionalPostContext();
  const post = postProp ?? context?.post;
  const postRef = useRef(post);
  postRef.current = post;
  const loadRef = useRef(loadLikers);
  loadRef.current = loadLikers;

  const usesLoader = Boolean(loadLikers) && likersProp === undefined;
  const postId = post?.id;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedLikers>({});

  useEffect(() => {
    const load = loadRef.current;
    const current = postRef.current;
    if (!usesLoader || !load || !current) return;
    let cancelled = false;
    setLoaded({});
    load(current).then(
      (likers) => {
        if (!cancelled) setLoaded({ likers });
      },
      (error: unknown) => {
        if (!cancelled) setLoaded({ failed: true, error });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [usesLoader, postId, attempt]);

  const retry = useCallback(() => {
    if (onRetry) onRetry();
    else setAttempt((n) => n + 1);
  }, [onRetry]);

  const likers = likersProp ?? (usesLoader ? loaded.likers : undefined);
  const failed = (errorProp !== undefined && errorProp !== null) || (usesLoader && Boolean(loaded.failed));
  const pending = likers === undefined && (loading || (usesLoader && !loaded.failed));

  const status: PostLikersStatus = failed
    ? 'error'
    : pending
      ? 'loading'
      : likers && likers.length > 0
        ? 'ready'
        : 'empty';

  return { likers: likers ?? [], status, error: errorProp ?? loaded.error, retry };
}

export interface PostLikerProps extends Omit<ComponentPropsWithoutRef<'li'>, 'children'> {
  liker: SocialAuthor;
}

/** One row of the likers list: avatar (or initials) and name, linked when `href` is set. */
export function PostLiker({ liker, className, ...props }: PostLikerProps) {
  return (
    <li className={cx('rsf-likers__item', className)} {...props}>
      <span className="rsf-post__avatar rsf-likers__avatar" aria-hidden="true">
        {liker.avatarUrl ? (
          <img src={liker.avatarUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          initialsOf(liker.name)
        )}
      </span>
      <span className="rsf-likers__name">{liker.href ? <a href={liker.href}>{liker.name}</a> : liker.name}</span>
    </li>
  );
}

export interface PostLikersProps extends UsePostLikersOptions, Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** Replaces each row's content (it is still wrapped in an `<li>`). */
  renderLiker?: (liker: SocialAuthor, index: number) => ReactNode;
  renderLoading?: () => ReactNode;
  renderEmpty?: () => ReactNode;
  renderError?: (error: unknown, retry: () => void) => ReactNode;
  /** Default "Loading…". */
  loadingLabel?: ReactNode;
  /** Default "No likes yet". */
  emptyLabel?: ReactNode;
  /** Default "Couldn't load likes". */
  errorLabel?: ReactNode;
  /** Default "Try again". */
  retryLabel?: ReactNode;
  /** Accessible name of the list. Default "Liked by". */
  listLabel?: string;
  /** Replaces everything inside the wrapper; the loading logic still runs. */
  children?: (state: PostLikersState) => ReactNode;
}

/**
 * Who liked a post. Renders a plain list, so put it wherever suits: a dialog,
 * a popover, a sheet, or inline. Give it `loadLikers` to fetch on mount, or
 * `likers` (plus `loading`/`error`) when you fetch yourself. Works inside a
 * `PostRoot` or standalone with `post`.
 */
export function PostLikers({
  post,
  likers,
  loadLikers,
  loading,
  error,
  onRetry,
  renderLiker,
  renderLoading,
  renderEmpty,
  renderError,
  loadingLabel = 'Loading…',
  emptyLabel = 'No likes yet',
  errorLabel = "Couldn't load likes",
  retryLabel = 'Try again',
  listLabel = 'Liked by',
  children,
  className,
  ...props
}: PostLikersProps) {
  const state = usePostLikers({ post, likers, loadLikers, loading, error, onRetry });
  const { status } = state;

  const content = (() => {
    if (children) return children(state);
    switch (status) {
      case 'loading':
        return renderLoading ? (
          renderLoading()
        ) : (
          <p className="rsf-likers__status rsf-likers__status--loading" role="status">
            {loadingLabel}
          </p>
        );
      case 'error':
        return renderError ? (
          renderError(state.error, state.retry)
        ) : (
          <div className="rsf-likers__status rsf-likers__status--error" role="alert">
            <span>{errorLabel}</span>
            <button type="button" className="rsf-likers__retry" onClick={state.retry}>
              {retryLabel}
            </button>
          </div>
        );
      case 'empty':
        return renderEmpty ? (
          renderEmpty()
        ) : (
          <p className="rsf-likers__status rsf-likers__status--empty">{emptyLabel}</p>
        );
      default:
        return (
          <ul className="rsf-likers__list" aria-label={listLabel}>
            {state.likers.map((liker, index) => {
              const key = liker.id ?? `${index}-${liker.name}`;
              return renderLiker ? (
                <li key={key} className="rsf-likers__item">
                  {renderLiker(liker, index)}
                </li>
              ) : (
                <PostLiker key={key} liker={liker} />
              );
            })}
          </ul>
        );
    }
  })();

  return (
    <div
      className={cx('rsf-likers', className)}
      data-status={status}
      aria-busy={status === 'loading' || undefined}
      {...props}
    >
      {content}
    </div>
  );
}
