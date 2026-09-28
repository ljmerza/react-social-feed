import { useId, useState, type ComponentPropsWithoutRef, type FormEvent, type ReactNode } from 'react';
import { usePostContext } from '../context/PostContext';
import { usePostIcons } from '../context/PostIconsContext';
import type { SocialComment } from '../types';
import { cx, threadRootId, toDate } from '../utils';

export interface PostCaptionProps extends Omit<ComponentPropsWithoutRef<'p'>, 'children'> {
  /** Prefix the caption with the author's name. Default false. */
  showAuthor?: boolean;
  children?: ReactNode;
}

export function PostCaption({ showAuthor = false, children, className, ...props }: PostCaptionProps) {
  const { post } = usePostContext('PostCaption');
  const content = children ?? post.caption;
  if (!content) return null;

  return (
    <p className={cx('rsf-post__caption', className)} {...props}>
      {showAuthor && post.author && <span className="rsf-post__author">{post.author.name}</span>} {content}
    </p>
  );
}

export interface PostCommentProps extends Omit<ComponentPropsWithoutRef<'li'>, 'children'> {
  comment: SocialComment;
  formatTimestamp?: (date: Date) => ReactNode;
  /** Label for the reply button, shown when the root has `onCommentSubmit`. Default "Reply". */
  replyLabel?: ReactNode;
  /** Accessible label for the icon-only delete button. Default "Delete comment". */
  deleteLabel?: string;
  /** Rendered after the comment inside its row, e.g. its replies. */
  children?: ReactNode;
}

export function PostComment({
  comment,
  formatTimestamp,
  replyLabel = 'Reply',
  deleteLabel = 'Delete comment',
  children,
  className,
  ...props
}: PostCommentProps) {
  const { canComment, startReply, canDeleteComment, deleteComment } = usePostContext('PostComment');
  const icons = usePostIcons();
  const date = formatTimestamp ? toDate(comment.createdAt) : null;

  return (
    <li className={cx('rsf-post__comment', className)} {...props}>
      <div className="rsf-post__comment-row">
        <div className="rsf-post__comment-body">
          <span className="rsf-post__author">{comment.author.name}</span> {comment.text}
          {date && (
            <time className="rsf-post__comment-timestamp" dateTime={date.toISOString()}>
              {formatTimestamp?.(date)}
            </time>
          )}
          {canComment && (
            <button type="button" className="rsf-post__comment-reply" onClick={() => startReply(comment)}>
              {replyLabel}
            </button>
          )}
        </div>
        {canDeleteComment(comment) && (
          <button
            type="button"
            className="rsf-post__comment-delete"
            aria-label={deleteLabel}
            onClick={() => deleteComment(comment)}
          >
            {icons.remove}
          </button>
        )}
      </div>
      {children}
    </li>
  );
}

interface CommentThread {
  comment: SocialComment;
  replies: SocialComment[];
}

/**
 * Group `visible` comments into one level of threads. A reply whose top-level
 * comment isn't visible (e.g. in a collapsed preview) is shown on its own.
 */
function groupThreads(visible: SocialComment[], all: SocialComment[]): CommentThread[] {
  const byId = new Map(all.map((comment) => [comment.id, comment]));
  const visibleIds = new Set(visible.map((comment) => comment.id));
  const rootOf = (comment: SocialComment) => {
    const rootId = threadRootId(comment, byId);
    return visibleIds.has(rootId) ? rootId : comment.id;
  };

  const threads = new Map<string, CommentThread>();
  for (const comment of visible) {
    if (rootOf(comment) === comment.id) threads.set(comment.id, { comment, replies: [] });
  }
  for (const comment of visible) {
    const rootId = rootOf(comment);
    if (rootId !== comment.id) threads.get(rootId)?.replies.push(comment);
  }
  return [...threads.values()];
}

/**
 * Every loaded comment, grouped into whole threads (a top-level comment plus
 * its replies; replies whose top-level comment isn't loaded share a group) and
 * ordered by each thread's newest comment, newest first. Reveals take whole
 * groups so a thread is never split.
 */
function revealUnits(comments: SocialComment[]): SocialComment[][] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const units = new Map<string, SocialComment[]>();
  for (const comment of comments) {
    const rootId = threadRootId(comment, byId);
    units.set(rootId, [...(units.get(rootId) ?? []), comment]);
  }
  const order: SocialComment[][] = [];
  const seen = new Set<string>();
  for (let index = comments.length - 1; index >= 0; index--) {
    const rootId = threadRootId(comments[index]!, byId);
    if (!seen.has(rootId)) {
      seen.add(rootId);
      order.push(units.get(rootId)!);
    }
  }
  return order;
}

/** Ids of the comments visible after `page` "Show more" steps. */
function revealedIds(comments: SocialComment[], previewCount: number, pageSize: number | undefined, page: number) {
  const units = revealUnits(comments);
  let taken = 0;
  let shown = 0;
  const take = (target: number) => {
    while (taken < units.length && shown < target) shown += units[taken++]!.length;
  };

  take(previewCount);
  for (let step = 0; step < page && taken < units.length; step++) {
    take(pageSize === undefined ? Infinity : shown + Math.max(1, pageSize));
  }
  return new Set(units.slice(0, taken).flatMap((unit) => unit.map((comment) => comment.id)));
}

export interface PostCommentRevealOptions {
  /** Comments shown before any "Show more" step (and after collapsing). Default 2. */
  previewCount?: number;
  /**
   * Comments each "Show more" step reveals. Omit to reveal everything on the
   * first step. A step may reveal a few more than this to finish a thread.
   */
  pageSize?: number;
}

export interface PostCommentReveal {
  /** Visible comments, oldest first. */
  comments: SocialComment[];
  visibleCount: number;
  /** `post.commentCount`, or the number loaded if that's higher. */
  totalCount: number;
  /** Comments not shown yet, loaded or not. */
  remainingCount: number;
  loadedCount: number;
  /** "Show more" steps taken since the list was last collapsed. */
  page: number;
  /** A "Show more" step would reveal loaded comments or ask for more. */
  canShowMore: boolean;
  /** Expanded with every loaded comment shown, waiting for `post.comments` to grow to `commentCount`. */
  isLoadingMore: boolean;
  /** Collapsing would hide something. */
  canCollapse: boolean;
  /** Take one step. The first fires `onCommentsExpandedChange(true)` so the app can load the full thread. */
  showMore: () => void;
  /** Back to the preview (page 0). */
  collapse: () => void;
}

/**
 * The comment list's reveal state: which comments are visible and how to show
 * more. `PostComments` renders from this; use it directly for a custom list.
 * Must be called inside a `PostRoot` or `PostContextProvider`.
 */
export function usePostCommentReveal({ previewCount = 2, pageSize }: PostCommentRevealOptions = {}): PostCommentReveal {
  const { post, commentCount, commentPage, showMoreComments, setCommentsExpanded } =
    usePostContext('usePostCommentReveal');
  const loaded = post.comments ?? [];
  const ids = revealedIds(loaded, previewCount, pageSize, commentPage);
  const comments = loaded.filter((comment) => ids.has(comment.id));
  const totalCount = Math.max(commentCount, loaded.length);
  const remainingCount = totalCount - comments.length;
  const isLoadingMore = commentPage > 0 && comments.length === loaded.length && remainingCount > 0;
  const collapsedCount = commentPage > 0 ? revealedIds(loaded, previewCount, pageSize, 0).size : comments.length;

  return {
    comments,
    visibleCount: comments.length,
    totalCount,
    remainingCount,
    loadedCount: loaded.length,
    page: commentPage,
    canShowMore: remainingCount > 0 && !isLoadingMore,
    isLoadingMore,
    canCollapse: commentPage > 0 && comments.length > collapsedCount,
    showMore: () => {
      if (remainingCount > 0 && !isLoadingMore) showMoreComments();
    },
    collapse: () => setCommentsExpanded(false)
  };
}

const defaultViewAllLabel = (count: number) => (count === 1 ? 'View 1 comment' : `View all ${count} comments`);
const defaultShowMoreLabel = (remaining: number) =>
  remaining === 1 ? 'View 1 more comment' : `View more comments (${remaining})`;

export interface PostCommentsProps extends PostCommentRevealOptions, Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  renderComment?: (comment: SocialComment) => ReactNode;
  /** "Show more" label when `pageSize` is not set. Default "View all N comments". */
  viewAllLabel?: (count: number) => ReactNode;
  /**
   * "Show more" label. Defaults to `viewAllLabel` without `pageSize`, else
   * "View more comments (N)". `remaining` counts unloaded comments too.
   */
  showMoreLabel?: (remaining: number, total: number) => ReactNode;
  /** Shown in place of "Show more" while waiting for more comments to load. Default: nothing. */
  loadingLabel?: ReactNode;
  hideLabel?: ReactNode;
  /** Where the "Show more" control sits: above the list (default) or below it. */
  showMorePosition?: 'start' | 'end';
  /** Replaces the "Show more" control. Called whenever comments remain hidden, including while loading. */
  renderShowMore?: (reveal: PostCommentReveal) => ReactNode;
  /** Replaces the "Hide comments" control. Called whenever collapsing would hide something. */
  renderHide?: (reveal: PostCommentReveal) => ReactNode;
  /** Label for each comment's reply button (default rows only). */
  replyLabel?: ReactNode;
  /** Accessible label for each comment's delete button (default rows only). */
  deleteLabel?: string;
}

export function PostComments({
  previewCount,
  pageSize,
  renderComment,
  viewAllLabel = defaultViewAllLabel,
  showMoreLabel,
  loadingLabel,
  hideLabel = 'Hide comments',
  showMorePosition = 'start',
  renderShowMore,
  renderHide,
  replyLabel,
  deleteLabel,
  className,
  ...props
}: PostCommentsProps) {
  const { post } = usePostContext('PostComments');
  const reveal = usePostCommentReveal({ previewCount, pageSize });
  const comments = post.comments ?? [];
  const visible = reveal.comments;

  if (reveal.totalCount === 0) return null;

  const renderRow = (comment: SocialComment, replies?: ReactNode) =>
    renderComment ? (
      <li key={comment.id} className="rsf-post__comment">
        {renderComment(comment)}
        {replies}
      </li>
    ) : (
      <PostComment key={comment.id} comment={comment} replyLabel={replyLabel} deleteLabel={deleteLabel}>
        {replies}
      </PostComment>
    );

  const label = showMoreLabel
    ? showMoreLabel(reveal.remainingCount, reveal.totalCount)
    : pageSize === undefined
      ? viewAllLabel(reveal.totalCount)
      : defaultShowMoreLabel(reveal.remainingCount);

  const showMore =
    reveal.remainingCount > 0 &&
    (renderShowMore ? (
      renderShowMore(reveal)
    ) : reveal.isLoadingMore ? (
      loadingLabel != null && (
        <span className="rsf-post__comments-loading" role="status">
          {loadingLabel}
        </span>
      )
    ) : (
      <button
        type="button"
        className="rsf-post__comments-toggle rsf-post__comments-toggle--more"
        onClick={reveal.showMore}
      >
        {label}
      </button>
    ));

  return (
    <div className={cx('rsf-post__comments', className)} {...props}>
      {showMorePosition === 'start' && showMore}
      {visible.length > 0 && (
        <ul className="rsf-post__comment-list">
          {groupThreads(visible, comments).map(({ comment, replies }) =>
            renderRow(
              comment,
              replies.length > 0 && (
                <ul className="rsf-post__comment-replies">{replies.map((reply) => renderRow(reply))}</ul>
              )
            )
          )}
        </ul>
      )}
      {showMorePosition === 'end' && showMore}
      {reveal.canCollapse &&
        (renderHide ? (
          renderHide(reveal)
        ) : (
          <button
            type="button"
            className="rsf-post__comments-toggle rsf-post__comments-toggle--hide"
            onClick={reveal.collapse}
          >
            {hideLabel}
          </button>
        ))}
    </div>
  );
}

export interface PostCommentFormProps extends Omit<ComponentPropsWithoutRef<'form'>, 'children' | 'onSubmit'> {
  placeholder?: string;
  /** Accessible label for the icon-only submit button. */
  submitLabel?: string;
  inputLabel?: string;
  /** Shown above the input while replying. Default "Replying to {name}". */
  replyingToLabel?: (name: string) => ReactNode;
  cancelReplyLabel?: ReactNode;
}

const defaultReplyingToLabel = (name: string) => `Replying to ${name}`;
const replyTag = (name: string) => `@${name} `;

/** Renders nothing unless the root was given `onCommentSubmit`. */
export function PostCommentForm({
  placeholder = 'Add a comment…',
  submitLabel = 'Post',
  inputLabel = 'Add a comment',
  replyingToLabel = defaultReplyingToLabel,
  cancelReplyLabel = 'Cancel',
  className,
  ...props
}: PostCommentFormProps) {
  const { canComment, isCommentPending, submitComment, commentInputRef, replyTo, cancelReply } =
    usePostContext('PostCommentForm');
  const icons = usePostIcons();
  const [draft, setDraft] = useState('');
  const inputId = useId();

  // Starting a reply tags its author; finishing or cancelling one clears the draft.
  const [draftReplyTo, setDraftReplyTo] = useState(replyTo);
  if (draftReplyTo !== replyTo) {
    setDraftReplyTo(replyTo);
    setDraft(replyTo ? replyTag(replyTo.author.name) : '');
  }

  if (!canComment) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accepted = await submitComment(draft);
    if (accepted) setDraft('');
  };

  return (
    <>
      {replyTo && (
        <div className="rsf-post__replying">
          <span>{replyingToLabel(replyTo.author.name)}</span>
          <button type="button" className="rsf-post__replying-cancel" onClick={cancelReply}>
            {cancelReplyLabel}
          </button>
        </div>
      )}
      <form className={cx('rsf-post__comment-form', className)} onSubmit={handleSubmit} {...props}>
        <label htmlFor={inputId} className="rsf-visually-hidden">
          {inputLabel}
        </label>
        <input
          id={inputId}
          ref={(el) => {
            commentInputRef.current = el;
          }}
          className="rsf-post__comment-input"
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          disabled={isCommentPending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && replyTo) cancelReply();
          }}
        />
        <button
          type="submit"
          className="rsf-post__comment-submit"
          aria-label={submitLabel}
          disabled={isCommentPending || draft.trim().length === 0}
        >
          {icons.send}
        </button>
      </form>
    </>
  );
}
