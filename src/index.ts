import './styles.css';

export type { ShareStatus, SocialAuthor, SocialComment, SocialMedia, SocialPost } from './types';
export {
  usePostState,
  type CommentSubmitOptions,
  type PostState,
  type ReplyTarget,
  type UsePostStateOptions
} from './usePostState';
export { usePostContext, PostContextProvider, type PostContextProviderProps } from './context/PostContext';
export {
  usePostIcons,
  PostIconsProvider,
  defaultPostIcons,
  type PostIcons,
  type PostIconsProviderProps
} from './context/PostIconsContext';
export { PostRoot, type PostRootProps } from './primitives/PostRoot';
export {
  PostHeader,
  PostAvatar,
  PostAuthor,
  PostTimestamp,
  PostTitle,
  type PostHeaderProps,
  type PostAvatarProps,
  type PostAuthorProps,
  type PostTimestampProps,
  type PostTitleProps
} from './primitives/PostHeader';
export {
  PostMedia,
  PostMediaItem,
  PostMediaPrevButton,
  PostMediaNextButton,
  PostMediaIndicators,
  PostMediaCounter,
  type PostMediaProps,
  type PostMediaItemProps,
  type PostMediaIndicatorsProps,
  type PostMediaCounterProps
} from './primitives/PostMedia';
export {
  PostActions,
  PostAction,
  PostActionSpacer,
  PostLikeButton,
  PostCommentButton,
  PostShareButton,
  PostLikeCount,
  type PostActionsProps,
  type PostActionProps,
  type PostLikeButtonProps,
  type PostCommentButtonProps,
  type PostShareButtonProps,
  type PostLikeCountProps
} from './primitives/PostActions';
export {
  PostCaption,
  PostComment,
  PostComments,
  PostCommentForm,
  type PostCaptionProps,
  type PostCommentProps,
  type PostCommentsProps,
  type PostCommentFormProps
} from './primitives/PostComments';
export { FeedPost, type FeedPostProps } from './FeedPost';
export { StarIcon, MessageIcon, ShareIcon, SendIcon, ChevronIcon } from './icons';
