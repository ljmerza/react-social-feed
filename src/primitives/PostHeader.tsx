import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { usePostContext } from '../context/PostContext';
import type { SocialAuthor } from '../types';
import { cx, renderChildren, toDate, type RenderableChildren } from '../utils';
import type { PostState } from '../usePostState';

export interface PostHeaderProps extends Omit<ComponentPropsWithoutRef<'header'>, 'children'> {
  children?: RenderableChildren<PostState>;
}

export function PostHeader({ children, className, ...props }: PostHeaderProps) {
  const state = usePostContext('PostHeader');

  return (
    <header className={cx('rsf-post__header', className)} {...props}>
      {renderChildren(
        children,
        state,
        <>
          <PostAvatar />
          <div className="rsf-post__byline">
            <PostAuthor />
            <PostTimestamp />
          </div>
        </>
      )}
    </header>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export interface PostAvatarProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  /** Defaults to the post author. */
  author?: SocialAuthor;
}

/** Author image, or their initials when there is no image. */
export function PostAvatar({ author: authorProp, className, ...props }: PostAvatarProps) {
  const { post } = usePostContext('PostAvatar');
  const author = authorProp ?? post.author;
  if (!author) return null;

  return (
    <span className={cx('rsf-post__avatar', className)} aria-hidden="true" {...props}>
      {author.avatarUrl ? (
        <img src={author.avatarUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        initialsOf(author.name)
      )}
    </span>
  );
}

export interface PostAuthorProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  children?: ReactNode;
}

export function PostAuthor({ children, className, ...props }: PostAuthorProps) {
  const { post } = usePostContext('PostAuthor');
  if (!post.author && !children) return null;
  const content = children ?? post.author?.name;

  return (
    <span className={cx('rsf-post__author', className)} {...props}>
      {post.author?.href ? <a href={post.author.href}>{content}</a> : content}
    </span>
  );
}

const defaultDateFormatter = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);

export interface PostTimestampProps extends Omit<ComponentPropsWithoutRef<'time'>, 'children' | 'dateTime'> {
  format?: (date: Date) => ReactNode;
}

export function PostTimestamp({ format = defaultDateFormatter, className, ...props }: PostTimestampProps) {
  const { post } = usePostContext('PostTimestamp');
  const date = toDate(post.createdAt);
  if (!date) return null;

  return (
    <time className={cx('rsf-post__timestamp', className)} dateTime={date.toISOString()} {...props}>
      {format(date)}
    </time>
  );
}

export type PostTitleProps<T extends ElementType = 'h3'> = {
  as?: T;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

export function PostTitle<T extends ElementType = 'h3'>({ as, children, className, ...props }: PostTitleProps<T>) {
  const { post } = usePostContext('PostTitle');
  const content = children ?? post.title;
  if (!content) return null;
  const Component: ElementType = as ?? 'h3';

  return (
    <Component className={cx('rsf-post__title', className)} {...props}>
      {content}
    </Component>
  );
}
