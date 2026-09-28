import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ShareStatus, SocialAuthor, SocialComment, SocialPost } from './types';
import { threadRootId } from './utils';

export interface CommentSubmitOptions {
  /** Top-level comment this is a reply to; absent for a new top-level comment. */
  parentId?: string;
}

/** The comment the viewer is replying to. */
export interface ReplyTarget {
  /** Top-level comment the reply is filed under. */
  parentId: string;
  /** Author being replied to; the form starts the draft by tagging them. */
  author: SocialAuthor;
}

export interface UsePostStateOptions {
  post: SocialPost;
  /**
   * Called when the viewer likes/unlikes. The UI updates optimistically; if the
   * returned promise rejects, the like state rolls back.
   */
  onLikeChange?: (liked: boolean, post: SocialPost) => void | Promise<unknown>;
  /**
   * Custom share handler. Without it, the share button uses the Web Share API
   * with `post.shareUrl`, falling back to copying the URL to the clipboard.
   */
  onShare?: (post: SocialPost) => void | Promise<unknown>;
  /**
   * Enables the comment form and reply buttons. Resolve to keep, reject to
   * restore the draft. Replies carry `options.parentId`.
   */
  onCommentSubmit?: (text: string, post: SocialPost, options: CommentSubmitOptions) => void | Promise<unknown>;
  /**
   * Shows a delete button on comments with `canDelete`. Called on click; confirm
   * and remove the comment yourself, then update `post.comments`.
   */
  onCommentDelete?: (comment: SocialComment, post: SocialPost) => void;
  /** Replaces the comment button's default behaviour (expand + focus the form). */
  onCommentClick?: (post: SocialPost) => void;
  /** Fired when the comment list expands/collapses, e.g. to fetch the full thread. */
  onCommentsExpandedChange?: (expanded: boolean, post: SocialPost) => void;
  defaultCommentsExpanded?: boolean;
  /** How long a share status ('copied', 'shared', 'error') lingers before resetting. */
  shareStatusResetMs?: number;
}

export interface PostState {
  post: SocialPost;

  liked: boolean;
  likeCount: number;
  toggleLike: () => void;
  /** Sets an explicit like state; a no-op if it already matches. */
  setLiked: (liked: boolean) => void;
  /** Increments every time a like is triggered from the media (double-tap). */
  likeBurstKey: number;
  likeFromMedia: () => void;

  mediaCount: number;
  activeMediaIndex: number;
  goToMedia: (index: number) => void;
  /** Used by PostMedia to keep the index in sync with swipe scrolling. */
  syncActiveMediaIndex: (index: number) => void;
  mediaScrollerRef: RefObject<HTMLDivElement | null>;

  commentCount: number;
  commentsExpanded: boolean;
  setCommentsExpanded: (expanded: boolean) => void;
  canComment: boolean;
  isCommentPending: boolean;
  /** Resolves true when the comment was accepted. */
  submitComment: (text: string) => Promise<boolean>;
  commentInputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  openComments: () => void;
  /** Set while the form is composing a reply rather than a top-level comment. */
  replyTo: ReplyTarget | null;
  /** Reply to `comment`; a reply to a reply joins the same top-level thread. */
  startReply: (comment: SocialComment) => void;
  cancelReply: () => void;
  /** Whether `comment` shows a delete button. */
  canDeleteComment: (comment: SocialComment) => boolean;
  deleteComment: (comment: SocialComment) => void;

  canShare: boolean;
  shareStatus: ShareStatus;
  share: () => Promise<void>;
}

interface LikeSnapshot {
  liked: boolean;
  likeCount: number;
}

const isAbortError = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';

export function usePostState({
  post,
  onLikeChange,
  onShare,
  onCommentSubmit,
  onCommentClick,
  onCommentDelete,
  onCommentsExpandedChange,
  defaultCommentsExpanded = false,
  shareStatusResetMs = 2000
}: UsePostStateOptions): PostState {
  // --- Likes: optimistic overlay on top of the post props -------------------
  const [optimistic, setOptimistic] = useState<LikeSnapshot | null>(null);
  const [synced, setSynced] = useState<LikeSnapshot>({ liked: post.liked, likeCount: post.likeCount });
  if (synced.liked !== post.liked || synced.likeCount !== post.likeCount) {
    // The source of truth moved (refetch, cache update): drop the overlay.
    setSynced({ liked: post.liked, likeCount: post.likeCount });
    setOptimistic(null);
  }
  const liked = optimistic?.liked ?? post.liked;
  const likeCount = optimistic?.likeCount ?? post.likeCount;
  const likeRequestRef = useRef(0);

  const setLiked = useCallback(
    (nextLiked: boolean) => {
      if (nextLiked === liked) return;
      const previous = { liked, likeCount };
      const next = { liked: nextLiked, likeCount: Math.max(0, likeCount + (nextLiked ? 1 : -1)) };
      const requestId = ++likeRequestRef.current;
      setOptimistic(next);

      const result = onLikeChange?.(nextLiked, post);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).catch(() => {
          // Only roll back if nothing newer has been issued since.
          if (likeRequestRef.current === requestId) setOptimistic(previous);
        });
      }
    },
    [liked, likeCount, onLikeChange, post]
  );

  const toggleLike = useCallback(() => setLiked(!liked), [liked, setLiked]);

  const [likeBurstKey, setLikeBurstKey] = useState(0);
  const likeFromMedia = useCallback(() => {
    setLikeBurstKey((key) => key + 1);
    setLiked(true);
  }, [setLiked]);

  // --- Media carousel --------------------------------------------------------
  const mediaCount = post.media.length;
  const [rawMediaIndex, setRawMediaIndex] = useState(0);
  const activeMediaIndex = Math.min(rawMediaIndex, Math.max(0, mediaCount - 1));
  const mediaScrollerRef = useRef<HTMLDivElement | null>(null);

  const syncActiveMediaIndex = useCallback(
    (index: number) => setRawMediaIndex(Math.min(Math.max(0, index), Math.max(0, mediaCount - 1))),
    [mediaCount]
  );

  const goToMedia = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(0, index), Math.max(0, mediaCount - 1));
      setRawMediaIndex(clamped);
      const scroller = mediaScrollerRef.current;
      if (scroller && typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ left: clamped * scroller.clientWidth, behavior: 'smooth' });
      }
    },
    [mediaCount]
  );

  // --- Comments --------------------------------------------------------------
  const commentCount = post.commentCount ?? post.comments?.length ?? 0;
  const [commentsExpanded, setCommentsExpandedState] = useState(defaultCommentsExpanded);
  const setCommentsExpanded = useCallback(
    (expanded: boolean) => {
      setCommentsExpandedState(expanded);
      onCommentsExpandedChange?.(expanded, post);
    },
    [onCommentsExpandedChange, post]
  );

  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const commentInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const startReply = useCallback(
    (comment: SocialComment) => {
      const byId = new Map((post.comments ?? []).map((c) => [c.id, c]));
      setReplyTo({ parentId: threadRootId(comment, byId), author: comment.author });
      commentInputRef.current?.focus();
    },
    [post.comments]
  );
  const cancelReply = useCallback(() => setReplyTo(null), []);

  const canDeleteComment = useCallback(
    (comment: SocialComment) => Boolean(onCommentDelete && comment.canDelete),
    [onCommentDelete]
  );
  const deleteComment = useCallback(
    (comment: SocialComment) => {
      if (canDeleteComment(comment)) onCommentDelete?.(comment, post);
    },
    [canDeleteComment, onCommentDelete, post]
  );

  const [isCommentPending, setIsCommentPending] = useState(false);
  const submitComment = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!onCommentSubmit || !trimmed) return false;
      setIsCommentPending(true);
      try {
        await onCommentSubmit(trimmed, post, replyTo ? { parentId: replyTo.parentId } : {});
        setReplyTo(null);
        return true;
      } catch {
        return false;
      } finally {
        setIsCommentPending(false);
      }
    },
    [onCommentSubmit, post, replyTo]
  );

  const openComments = useCallback(() => {
    if (onCommentClick) {
      onCommentClick(post);
      return;
    }
    if (!commentsExpanded) setCommentsExpanded(true);
    setReplyTo(null);
    commentInputRef.current?.focus();
  }, [commentsExpanded, onCommentClick, post, setCommentsExpanded]);

  // --- Share -----------------------------------------------------------------
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const canShare = Boolean(onShare || post.shareUrl);

  useEffect(() => {
    if (shareStatus === 'idle') return;
    const timer = setTimeout(() => setShareStatus('idle'), shareStatusResetMs);
    return () => clearTimeout(timer);
  }, [shareStatus, shareStatusResetMs]);

  const share = useCallback(async () => {
    try {
      if (onShare) {
        await onShare(post);
        setShareStatus('shared');
        return;
      }
      if (!post.shareUrl) {
        setShareStatus('error');
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: post.title, text: post.caption, url: post.shareUrl });
        setShareStatus('shared');
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(post.shareUrl);
        setShareStatus('copied');
        return;
      }
      setShareStatus('error');
    } catch (error) {
      // The user dismissing the native share sheet is not a failure.
      if (isAbortError(error)) return;
      setShareStatus('error');
    }
  }, [onShare, post]);

  return {
    post,
    liked,
    likeCount,
    toggleLike,
    setLiked,
    likeBurstKey,
    likeFromMedia,
    mediaCount,
    activeMediaIndex,
    goToMedia,
    syncActiveMediaIndex,
    mediaScrollerRef,
    commentCount,
    commentsExpanded,
    setCommentsExpanded,
    canComment: Boolean(onCommentSubmit),
    isCommentPending,
    submitComment,
    commentInputRef,
    openComments,
    replyTo,
    startReply,
    cancelReply,
    canDeleteComment,
    deleteComment,
    canShare,
    shareStatus,
    share
  };
}
