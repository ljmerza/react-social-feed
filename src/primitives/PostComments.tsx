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

const defaultViewAllLabel = (count: number) => (count === 1 ? 'View 1 comment' : `View all ${count} comments`);

export interface PostCommentsProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** Comments shown while collapsed. Default 2; the newest ones are shown. */
  previewCount?: number;
  renderComment?: (comment: SocialComment) => ReactNode;
  viewAllLabel?: (count: number) => ReactNode;
  hideLabel?: ReactNode;
  /** Label for each comment's reply button (default rows only). */
  replyLabel?: ReactNode;
  /** Accessible label for each comment's delete button (default rows only). */
  deleteLabel?: string;
}

export function PostComments({
  previewCount = 2,
  renderComment,
  viewAllLabel = defaultViewAllLabel,
  hideLabel = 'Hide comments',
  replyLabel,
  deleteLabel,
  className,
  ...props
}: PostCommentsProps) {
  const { post, commentCount, commentsExpanded, setCommentsExpanded } = usePostContext('PostComments');
  const comments = post.comments ?? [];
  const visible = commentsExpanded ? comments : comments.slice(Math.max(0, comments.length - previewCount));
  const hasHidden = commentCount > visible.length;

  if (commentCount === 0 && comments.length === 0) return null;

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

  return (
    <div className={cx('rsf-post__comments', className)} {...props}>
      {!commentsExpanded && hasHidden && (
        <button type="button" className="rsf-post__comments-toggle" onClick={() => setCommentsExpanded(true)}>
          {viewAllLabel(commentCount)}
        </button>
      )}
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
      {commentsExpanded && comments.length > previewCount && (
        <button type="button" className="rsf-post__comments-toggle" onClick={() => setCommentsExpanded(false)}>
          {hideLabel}
        </button>
      )}
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
