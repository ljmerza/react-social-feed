import { useId, useState, type ComponentPropsWithoutRef, type FormEvent, type ReactNode } from 'react';
import { usePostContext } from '../context/PostContext';
import { usePostIcons } from '../context/PostIconsContext';
import type { SocialComment } from '../types';
import { cx, toDate } from '../utils';

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
}

export function PostComment({ comment, formatTimestamp, className, ...props }: PostCommentProps) {
  const date = formatTimestamp ? toDate(comment.createdAt) : null;

  return (
    <li className={cx('rsf-post__comment', className)} {...props}>
      <span className="rsf-post__author">{comment.author.name}</span> {comment.text}
      {date && (
        <time className="rsf-post__comment-timestamp" dateTime={date.toISOString()}>
          {formatTimestamp?.(date)}
        </time>
      )}
    </li>
  );
}

const defaultViewAllLabel = (count: number) => (count === 1 ? 'View 1 comment' : `View all ${count} comments`);

export interface PostCommentsProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** Comments shown while collapsed. Default 2; the newest ones are shown. */
  previewCount?: number;
  renderComment?: (comment: SocialComment) => ReactNode;
  viewAllLabel?: (count: number) => ReactNode;
  hideLabel?: ReactNode;
}

export function PostComments({
  previewCount = 2,
  renderComment,
  viewAllLabel = defaultViewAllLabel,
  hideLabel = 'Hide comments',
  className,
  ...props
}: PostCommentsProps) {
  const { post, commentCount, commentsExpanded, setCommentsExpanded } = usePostContext('PostComments');
  const comments = post.comments ?? [];
  const visible = commentsExpanded ? comments : comments.slice(Math.max(0, comments.length - previewCount));
  const hasHidden = commentCount > visible.length;

  if (commentCount === 0 && comments.length === 0) return null;

  return (
    <div className={cx('rsf-post__comments', className)} {...props}>
      {!commentsExpanded && hasHidden && (
        <button type="button" className="rsf-post__comments-toggle" onClick={() => setCommentsExpanded(true)}>
          {viewAllLabel(commentCount)}
        </button>
      )}
      {visible.length > 0 && (
        <ul className="rsf-post__comment-list">
          {visible.map((comment) =>
            renderComment ? (
              <li key={comment.id} className="rsf-post__comment">
                {renderComment(comment)}
              </li>
            ) : (
              <PostComment key={comment.id} comment={comment} />
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
}

/** Renders nothing unless the root was given `onCommentSubmit`. */
export function PostCommentForm({
  placeholder = 'Add a comment…',
  submitLabel = 'Post',
  inputLabel = 'Add a comment',
  className,
  ...props
}: PostCommentFormProps) {
  const { canComment, isCommentPending, submitComment, commentInputRef } = usePostContext('PostCommentForm');
  const icons = usePostIcons();
  const [draft, setDraft] = useState('');
  const inputId = useId();

  if (!canComment) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accepted = await submitComment(draft);
    if (accepted) setDraft('');
  };

  return (
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
  );
}
