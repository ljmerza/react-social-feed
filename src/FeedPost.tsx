import { PostActions } from './primitives/PostActions';
import { PostCaption, PostCommentForm, PostComments } from './primitives/PostComments';
import { PostHeader, PostTitle } from './primitives/PostHeader';
import { PostMedia } from './primitives/PostMedia';
import { PostRoot, type PostRootProps } from './primitives/PostRoot';

export interface FeedPostProps extends Omit<PostRootProps, 'children'> {
  /** Fallback media aspect ratio when the first item has no dimensions. */
  mediaAspectRatio?: number | string;
  /** Pause a playing video once it scrolls or is swiped out of view. Default true. */
  pauseVideosWhenHidden?: boolean;
}

/**
 * The default post layout: header, inset media, action pills with counts,
 * title and caption, then the comment thread. Compose the primitives yourself
 * when you need a different arrangement.
 */
export function FeedPost({ mediaAspectRatio, pauseVideosWhenHidden = true, ...rootProps }: FeedPostProps) {
  return (
    <PostRoot {...rootProps}>
      <PostHeader />
      <PostMedia aspectRatio={mediaAspectRatio} pauseWhenHidden={pauseVideosWhenHidden} />
      <div className="rsf-post__body">
        <PostActions />
        <PostTitle />
        <PostCaption />
        <div className="rsf-post__discussion">
          <PostComments />
          <PostCommentForm />
        </div>
      </div>
    </PostRoot>
  );
}
