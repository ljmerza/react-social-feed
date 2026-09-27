import { useRef, type ComponentPropsWithoutRef, type PointerEvent, type ReactNode } from 'react';
import { usePostContext } from '../context/PostContext';
import { usePostIcons } from '../context/PostIconsContext';
import type { SocialMedia } from '../types';
import type { PostState } from '../usePostState';
import { cx } from '../utils';

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 24;

const aspectRatioOf = (media: SocialMedia | undefined) =>
  media?.width && media?.height ? `${media.width} / ${media.height}` : undefined;

export interface PostMediaProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Box aspect ratio when the first media item has no width/height, e.g. `1`
   * or `'4 / 5'`. The whole carousel takes the first item's ratio.
   */
  aspectRatio?: number | string;
  /** Double-tap/double-click the media to like (never unlikes). Default true. */
  likeOnDoubleTap?: boolean;
  loading?: 'lazy' | 'eager';
  renderItem?: (media: SocialMedia, index: number, state: PostState) => ReactNode;
  /** Overlays rendered above the slides. Defaults to prev/next buttons and a position counter. */
  children?: ReactNode;
}

export function PostMedia({
  aspectRatio,
  likeOnDoubleTap = true,
  loading = 'lazy',
  renderItem,
  children,
  className,
  style,
  onPointerUp,
  ...props
}: PostMediaProps) {
  const state = usePostContext('PostMedia');
  const icons = usePostIcons();
  const { post, mediaCount, mediaScrollerRef, syncActiveMediaIndex, likeFromMedia, likeBurstKey } = state;
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  if (mediaCount === 0) return null;

  const ratio = aspectRatioOf(post.media[0]) ?? (aspectRatio === undefined ? undefined : String(aspectRatio));

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    onPointerUp?.(event);
    if (!likeOnDoubleTap || (event.target as Element).closest('button, a, video')) return;

    const now = event.timeStamp;
    const last = lastTapRef.current;
    const isDoubleTap =
      last &&
      now - last.time < DOUBLE_TAP_MS &&
      Math.abs(event.clientX - last.x) < DOUBLE_TAP_SLOP_PX &&
      Math.abs(event.clientY - last.y) < DOUBLE_TAP_SLOP_PX;

    if (isDoubleTap) {
      lastTapRef.current = null;
      likeFromMedia();
    } else {
      lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
    }
  };

  return (
    <div
      className={cx('rsf-post__media', ratio && 'rsf-post__media--fixed-ratio', className)}
      style={{ aspectRatio: ratio, ...style }}
      onPointerUp={handlePointerUp}
      {...props}
    >
      <div
        ref={mediaScrollerRef}
        className="rsf-post__media-track"
        aria-roledescription={mediaCount > 1 ? 'carousel' : undefined}
        onScroll={(event) => {
          const el = event.currentTarget;
          if (el.clientWidth > 0) syncActiveMediaIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {post.media.map((media, index) => (
          <div
            key={media.id ?? `${index}-${media.src}`}
            className="rsf-post__media-slide"
            role={mediaCount > 1 ? 'group' : undefined}
            aria-roledescription={mediaCount > 1 ? 'slide' : undefined}
            aria-label={mediaCount > 1 ? `${index + 1} of ${mediaCount}` : undefined}
          >
            {renderItem ? renderItem(media, index, state) : <PostMediaItem media={media} loading={loading} />}
          </div>
        ))}
      </div>

      {likeBurstKey > 0 && (
        <span key={likeBurstKey} className="rsf-post__like-burst" aria-hidden="true">
          {icons.burst}
        </span>
      )}

      {children ??
        (mediaCount > 1 && (
          <>
            <PostMediaPrevButton />
            <PostMediaNextButton />
            <PostMediaCounter />
          </>
        ))}
    </div>
  );
}

export interface PostMediaItemProps {
  media: SocialMedia;
  loading?: 'lazy' | 'eager';
  className?: string;
}

export function PostMediaItem({ media, loading = 'lazy', className }: PostMediaItemProps) {
  if (media.type === 'video') {
    return (
      <video
        className={cx('rsf-post__media-item', className)}
        src={media.src}
        poster={media.poster}
        width={media.width}
        height={media.height}
        controls
        playsInline
        preload="metadata"
        aria-label={media.alt}
      />
    );
  }

  return (
    <img
      className={cx('rsf-post__media-item', className)}
      src={media.src}
      alt={media.alt ?? ''}
      width={media.width}
      height={media.height}
      loading={loading}
      decoding="async"
      draggable={false}
    />
  );
}

type NavButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'onClick'> & { children?: ReactNode };

export function PostMediaPrevButton({ children, className, ...props }: NavButtonProps) {
  const { activeMediaIndex, goToMedia } = usePostContext('PostMediaPrevButton');
  const icons = usePostIcons();
  if (activeMediaIndex <= 0) return null;

  return (
    <button
      type="button"
      className={cx('rsf-post__media-nav rsf-post__media-nav--prev', className)}
      aria-label="Previous"
      onClick={() => goToMedia(activeMediaIndex - 1)}
      {...props}
    >
      {children ?? icons.previous}
    </button>
  );
}

export function PostMediaNextButton({ children, className, ...props }: NavButtonProps) {
  const { activeMediaIndex, mediaCount, goToMedia } = usePostContext('PostMediaNextButton');
  const icons = usePostIcons();
  if (activeMediaIndex >= mediaCount - 1) return null;

  return (
    <button
      type="button"
      className={cx('rsf-post__media-nav rsf-post__media-nav--next', className)}
      aria-label="Next"
      onClick={() => goToMedia(activeMediaIndex + 1)}
      {...props}
    >
      {children ?? icons.next}
    </button>
  );
}

export interface PostMediaIndicatorsProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {}

/** Decorative position dots; slides carry their own "n of m" labels. */
export function PostMediaIndicators({ className, ...props }: PostMediaIndicatorsProps) {
  const { activeMediaIndex, mediaCount } = usePostContext('PostMediaIndicators');
  if (mediaCount < 2) return null;

  return (
    <div className={cx('rsf-post__media-dots', className)} aria-hidden="true" {...props}>
      {Array.from({ length: mediaCount }, (_, index) => (
        <span
          key={index}
          className={cx('rsf-post__media-dot', index === activeMediaIndex && 'rsf-post__media-dot--active')}
        />
      ))}
    </div>
  );
}

export interface PostMediaCounterProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  format?: (position: number, total: number) => ReactNode;
}

/** "2 / 5" badge over the media. Decorative: slides carry their own labels. */
export function PostMediaCounter({ format, className, ...props }: PostMediaCounterProps) {
  const { activeMediaIndex, mediaCount } = usePostContext('PostMediaCounter');
  if (mediaCount < 2) return null;

  return (
    <span className={cx('rsf-post__media-counter', className)} aria-hidden="true" {...props}>
      {format ? format(activeMediaIndex + 1, mediaCount) : `${activeMediaIndex + 1} / ${mediaCount}`}
    </span>
  );
}
