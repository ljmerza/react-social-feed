import { useCallback, useState } from 'react';
import {
  FeedPost,
  PostAction,
  PostActionSpacer,
  PostActions,
  PostAvatar,
  PostAuthor,
  PostCaption,
  PostCommentForm,
  PostComments,
  PostHeader,
  PostLikeButton,
  PostLikeCount,
  PostMedia,
  PostRoot,
  PostShareButton,
  PostTimestamp,
  PostTitle,
  type CommentSubmitOptions,
  type SocialPost
} from '../index';
import { VirtualFeed } from '../virtual';
import { makePost, makePosts } from './fixtures';

export default {
  title: 'Social Feed/FeedPost'
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Keeps comments locally so the stories feel live. */
function useLocalPost(initial: SocialPost) {
  const [post, setPost] = useState(initial);
  const addComment = useCallback(async (text: string, _post: SocialPost, { parentId }: CommentSubmitOptions) => {
    await pause(300);
    setPost((current) => ({
      ...current,
      commentCount: (current.commentCount ?? 0) + 1,
      comments: [...(current.comments ?? []), { id: `${Date.now()}`, author: { name: 'You' }, text, parentId }]
    }));
  }, []);
  return { post, addComment };
}

export const Default = () => {
  const { post, addComment } = useLocalPost(makePost(0));
  return <FeedPost post={post} onCommentSubmit={addComment} />;
};

export const Carousel = () => {
  const { post, addComment } = useLocalPost(makePost(1));
  return <FeedPost post={post} onCommentSubmit={addComment} />;
};

export const DarkTheme = () => {
  const { post, addComment } = useLocalPost(makePost(4));
  return (
    <div className="dark" style={{ background: '#09090b', padding: 24 }}>
      <FeedPost post={post} onCommentSubmit={addComment} />
    </div>
  );
};

/** Swap icons in one place, and add your own action next to the built-in ones. */
export const CustomIconsAndActions = () => {
  const [saved, setSaved] = useState(false);
  return (
    <PostRoot
      post={makePost(5)}
      icons={{ like: <span aria-hidden="true">👏</span>, liked: <span aria-hidden="true">🙌</span> }}
    >
      <PostHeader />
      <PostMedia />
      <div className="rsf-post__body">
        <PostActions>
          <PostLikeButton />
          <PostAction
            aria-label={saved ? 'Remove from album' : 'Save to album'}
            active={saved}
            icon={<span aria-hidden="true">{saved ? '📌' : '📍'}</span>}
            onClick={() => setSaved((value) => !value)}
          >
            {saved ? 'Saved' : 'Save'}
          </PostAction>
          <PostActionSpacer />
          <PostShareButton />
        </PostActions>
        <PostTitle />
        <PostCaption />
      </div>
    </PostRoot>
  );
};

/** Mix and match: title in the header, a text like button, no comments. */
export const CustomComposition = () => {
  const post = makePost(2);
  return (
    <PostRoot post={post} className="custom-post">
      <PostHeader>
        <PostAvatar />
        <div className="rsf-post__byline">
          <PostTitle as="h2" style={{ margin: 0 }} />
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            <PostAuthor /> · <PostTimestamp />
          </span>
        </div>
      </PostHeader>
      <PostMedia aspectRatio="16 / 9" />
      <div className="rsf-post__body">
        <PostActions>
          <PostLikeButton>{({ liked, likeCount }) => `${liked ? 'Liked' : 'Like'} · ${likeCount}`}</PostLikeButton>
          <PostShareButton>{({ status }) => (status === 'copied' ? 'Link copied' : 'Share')}</PostShareButton>
        </PostActions>
        <PostCaption showAuthor={false} />
      </div>
    </PostRoot>
  );
};

export const MinimalCard = () => (
  <PostRoot post={makePost(3)} style={{ maxWidth: 320 }}>
    <PostMedia />
    <div className="rsf-post__body">
      <PostLikeCount />
      <PostCaption />
      <PostComments previewCount={1} />
      <PostCommentForm />
    </div>
  </PostRoot>
);

export const InfiniteVirtualFeed = () => {
  const [posts, setPosts] = useState(() => makePosts(10));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const hasMore = posts.length < 200;

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    await pause(600);
    setPosts((current) => [...current, ...makePosts(10, current.length)]);
    setIsLoadingMore(false);
  }, []);

  return (
    <div style={{ padding: '16px 0' }}>
      <p style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
        {posts.length} posts loaded — only the visible ones are in the DOM.
      </p>
      <VirtualFeed
        items={posts}
        getItemKey={(post) => post.id}
        renderItem={(post) => <FeedPost post={post} />}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        renderEnd={() => <p style={{ textAlign: 'center' }}>You're all caught up</p>}
        aria-label="Photo feed"
      />
    </div>
  );
};
