export interface SocialAuthor {
  id?: string;
  name: string;
  avatarUrl?: string;
  /** Optional link for the author's name/avatar. */
  href?: string;
}

export interface SocialMedia {
  id?: string;
  src: string;
  type?: 'image' | 'video';
  alt?: string;
  /** Poster frame for videos. */
  poster?: string;
  /**
   * Intrinsic dimensions. When both are present the media box reserves its
   * aspect ratio before the file loads, which keeps virtualized rows from
   * jumping as images arrive.
   */
  width?: number;
  height?: number;
}

export interface SocialComment {
  id: string;
  author: SocialAuthor;
  text: string;
  createdAt?: string | Date;
  /**
   * Id of the comment this one replies to. Replies render one level deep under
   * their top-level comment; a reply to a reply joins the same thread.
   */
  parentId?: string;
  /** Whether the viewer may delete this comment; shows its delete button when the root has `onCommentDelete`. */
  canDelete?: boolean;
}

export interface SocialPost {
  id: string;
  author?: SocialAuthor;
  title?: string;
  caption?: string;
  media: SocialMedia[];
  createdAt?: string | Date;
  likeCount: number;
  /** Whether the current viewer has liked the post. */
  liked: boolean;
  /** Whether the current viewer has favorited the post. Private to the viewer, so there is no count. */
  favorited?: boolean;
  /** Total comments, which may exceed `comments.length` when only a preview is loaded. */
  commentCount?: number;
  comments?: SocialComment[];
  /** Absolute URL used by the default share behaviour. */
  shareUrl?: string;
}

export type ShareStatus = 'idle' | 'shared' | 'copied' | 'error';
