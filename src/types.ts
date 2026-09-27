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
  /** Total comments, which may exceed `comments.length` when only a preview is loaded. */
  commentCount?: number;
  comments?: SocialComment[];
  /** Absolute URL used by the default share behaviour. */
  shareUrl?: string;
}

export type ShareStatus = 'idle' | 'shared' | 'copied' | 'error';
