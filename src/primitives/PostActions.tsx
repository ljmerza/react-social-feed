import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react';
import { usePostContext } from '../context/PostContext';
import { usePostIcons } from '../context/PostIconsContext';
import type { ShareStatus } from '../types';
import { useLongPress, type UseLongPressOptions } from '../useLongPress';
import { cx, renderChildren, type RenderableChildren } from '../utils';
import type { PostState } from '../usePostState';

export interface PostActionsProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  children?: RenderableChildren<PostState>;
}

/** Row of action buttons. Defaults to like, comment and (pushed right) share. */
export function PostActions({ children, className, ...props }: PostActionsProps) {
  const state = usePostContext('PostActions');

  return (
    <div className={cx('rsf-post__actions', className)} {...props}>
      {renderChildren(
        children,
        state,
        <>
          <PostLikeButton />
          <PostCommentButton />
          <PostActionSpacer />
          <PostShareButton />
        </>
      )}
    </div>
  );
}

/** Pushes the actions after it to the far end of the row. */
export function PostActionSpacer() {
  return <span className="rsf-post__action-spacer" aria-hidden="true" />;
}

export interface PostActionProps extends ComponentPropsWithoutRef<'button'> {
  icon?: ReactNode;
  /** Marks a toggled-on action (styling hook: `data-active`). */
  active?: boolean;
}

/**
 * The building block every built-in action uses. Use it for your own actions
 * (bookmark, download, report…) so they match the others. Give it an
 * `aria-label` when it only shows an icon.
 */
export function PostAction({ icon, active, children, className, type = 'button', ...props }: PostActionProps) {
  const hasLabel = children !== undefined && children !== null && children !== false;

  return (
    <button
      type={type}
      className={cx('rsf-post__action', hasLabel && 'rsf-post__action--labelled', className)}
      data-active={active || undefined}
      {...props}
    >
      {icon}
      {hasLabel && <span className="rsf-post__action-label">{children}</span>}
    </button>
  );
}

type ActionButtonProps<State> = Omit<PostActionProps, 'children' | 'icon'> & {
  /** Replaces the icon and count entirely. */
  children?: RenderableChildren<State>;
};

const renderCount = (count: number) => (count > 0 ? count.toLocaleString() : undefined);

export type LikeLongPressOptions = Pick<UseLongPressOptions, 'delay' | 'moveTolerance' | 'keyShortcut'>;

export type PostLikeButtonProps = ActionButtonProps<{ liked: boolean; likeCount: number }> & {
  /** Accessible label; defaults to "Like"/"Unlike". */
  label?: (liked: boolean) => string;
  /** Show the like count next to the icon. Default true. */
  showCount?: boolean;
  /**
   * Long-press (or `keyShortcut`, default Shift+Enter) to open the likers list.
   * On by default when the root has `onLikeLongPress` or `onLikersOpenChange`;
   * `true` forces it on, `false` off, and an object tunes it.
   */
  longPress?: boolean | LikeLongPressOptions;
  /**
   * Screen-reader hint (`aria-description`) while long-press is on. Default
   * "Long press or press Shift+Enter to see who liked this"; `false` omits it.
   */
  likersHint?: string | false;
};

const defaultLikersHint = (keyShortcut: string | false) =>
  keyShortcut ? `Long press or press ${keyShortcut} to see who liked this` : 'Long press to see who liked this';

export function PostLikeButton({
  children,
  className,
  label,
  showCount = true,
  longPress,
  likersHint,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onContextMenu,
  onKeyDown,
  ...props
}: PostLikeButtonProps) {
  const { liked, likeCount, toggleLike, canShowLikers, openLikers } = usePostContext('PostLikeButton');
  const icons = usePostIcons();
  const custom = children !== undefined;
  const longPressOn = longPress === undefined ? canShowLikers : longPress !== false;
  const longPressOptions = typeof longPress === 'object' ? longPress : {};
  const keyShortcut = longPressOptions.keyShortcut ?? 'Shift+Enter';

  const { longPressProps: lp, isPressing } = useLongPress({
    ...longPressOptions,
    keyShortcut,
    disabled: !longPressOn,
    onLongPress: openLikers,
    onPress: (event) => {
      onClick?.(event as MouseEvent<HTMLButtonElement>);
      if (!event.defaultPrevented) toggleLike();
    }
  });
  const hint = likersHint ?? defaultLikersHint(keyShortcut);

  return (
    <PostAction
      className={cx(
        'rsf-post__like-button',
        liked && 'rsf-post__like-button--active',
        longPressOn && 'rsf-long-press',
        className
      )}
      active={liked}
      aria-pressed={liked}
      aria-label={label ? label(liked) : liked ? 'Unlike' : 'Like'}
      aria-keyshortcuts={lp['aria-keyshortcuts']}
      aria-description={longPressOn && hint ? hint : undefined}
      data-pressing={isPressing || undefined}
      icon={custom ? undefined : liked ? icons.liked : icons.like}
      onClick={lp.onClick}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        lp.onPointerDown(event);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        lp.onPointerMove(event);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        lp.onPointerUp(event);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        lp.onPointerLeave(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        lp.onPointerCancel(event);
      }}
      onContextMenu={(event) => {
        onContextMenu?.(event);
        lp.onContextMenu(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented) lp.onKeyDown(event);
      }}
      {...props}
    >
      {custom ? renderChildren(children, { liked, likeCount }, null) : showCount ? renderCount(likeCount) : undefined}
    </PostAction>
  );
}

export type PostCommentButtonProps = ActionButtonProps<{ commentCount: number }> & {
  /** Show the comment count next to the icon. Default true. */
  showCount?: boolean;
};

export function PostCommentButton({ children, className, showCount = true, onClick, ...props }: PostCommentButtonProps) {
  const { commentCount, openComments } = usePostContext('PostCommentButton');
  const icons = usePostIcons();
  const custom = children !== undefined;

  return (
    <PostAction
      className={cx('rsf-post__comment-button', className)}
      aria-label="Comment"
      icon={custom ? undefined : icons.comment}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openComments();
      }}
      {...props}
    >
      {custom ? renderChildren(children, { commentCount }, null) : showCount ? renderCount(commentCount) : undefined}
    </PostAction>
  );
}

export type PostShareButtonProps = ActionButtonProps<{ status: ShareStatus }>;

export function PostShareButton({ children, className, onClick, disabled, ...props }: PostShareButtonProps) {
  const { canShare, share, shareStatus } = usePostContext('PostShareButton');
  const icons = usePostIcons();
  const custom = children !== undefined;

  return (
    <PostAction
      className={cx('rsf-post__share-button', className)}
      aria-label="Share"
      data-status={shareStatus === 'idle' ? undefined : shareStatus}
      disabled={disabled ?? !canShare}
      icon={custom ? undefined : icons.share}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) void share();
      }}
      {...props}
    >
      {custom ? renderChildren(children, { status: shareStatus }, null) : undefined}
    </PostAction>
  );
}

const defaultLikeCountFormat = (count: number): ReactNode =>
  count === 0 ? null : `${count.toLocaleString()} ${count === 1 ? 'like' : 'likes'}`;

export interface PostLikeCountProps extends Omit<ComponentPropsWithoutRef<'p'>, 'children'> {
  /** Return null to render nothing (the default for zero likes). */
  format?: (count: number, liked: boolean) => ReactNode;
}

/** A standalone like-count line, for layouts that hide the count on the button. */
export function PostLikeCount({ format = defaultLikeCountFormat, className, ...props }: PostLikeCountProps) {
  const { likeCount, liked } = usePostContext('PostLikeCount');
  const content = format(likeCount, liked);
  if (content === null || content === undefined || content === false) return null;

  return (
    <p className={cx('rsf-post__like-count', className)} aria-live="polite" {...props}>
      {content}
    </p>
  );
}
