import type { ComponentPropsWithoutRef } from 'react';
import { PostContextProvider } from '../context/PostContext';
import { PostIconsProvider, type PostIcons } from '../context/PostIconsContext';
import { usePostState, type PostState, type UsePostStateOptions } from '../usePostState';
import { cx, renderChildren, type RenderableChildren } from '../utils';

export interface PostRootProps
  extends UsePostStateOptions,
    Omit<ComponentPropsWithoutRef<'article'>, 'children'> {
  /** Replace any of the built-in icons for this post. */
  icons?: Partial<PostIcons>;
  children?: RenderableChildren<PostState>;
}

export function PostRoot({
  post,
  onLikeChange,
  onShare,
  onCommentSubmit,
  onCommentClick,
  onCommentDelete,
  onCommentsExpandedChange,
  defaultCommentsExpanded,
  commentPage,
  defaultCommentPage,
  onCommentPageChange,
  onLikeLongPress,
  likersOpen,
  defaultLikersOpen,
  onLikersOpenChange,
  shareStatusResetMs,
  icons,
  children,
  className,
  ...articleProps
}: PostRootProps) {
  const state = usePostState({
    post,
    onLikeChange,
    onShare,
    onCommentSubmit,
    onCommentClick,
    onCommentDelete,
    onCommentsExpandedChange,
    defaultCommentsExpanded,
    commentPage,
    defaultCommentPage,
    onCommentPageChange,
    onLikeLongPress,
    likersOpen,
    defaultLikersOpen,
    onLikersOpenChange,
    shareStatusResetMs
  });

  return (
    <PostContextProvider value={state}>
      <PostIconsProvider icons={icons}>
        <article
          className={cx('rsf-post', className)}
          data-liked={state.liked || undefined}
          {...articleProps}
        >
          {renderChildren(children, state, null)}
        </article>
      </PostIconsProvider>
    </PostContextProvider>
  );
}
