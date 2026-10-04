import { useEffect, type RefObject } from 'react';

export interface UsePauseWhenHiddenOptions {
  /** Turns the observer off. Default true. */
  enabled?: boolean;
  /**
   * Pause once less than this fraction of the element is visible, from 0 to 1.
   * Default 0.25. Kept low on purpose: the media box has no max height, so a
   * tall video on a short (e.g. landscape phone) viewport may never be more
   * than half visible, and a higher threshold could pause it as soon as it
   * was scrolled at all.
   */
  threshold?: number;
}

type PresentableMedia = HTMLMediaElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitPresentationMode?: string;
};

/**
 * True while the browser shows the media outside its inline box: fullscreen
 * (standard or the iOS native player) or picture-in-picture. Its inline box can
 * look hidden then (e.g. after rotating into landscape), but the user is
 * still watching.
 */
export function isPresentedOutsidePage(media: HTMLMediaElement) {
  const doc = media.ownerDocument as Document & { webkitFullscreenElement?: Element | null };
  const fullscreen = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  if (fullscreen && (fullscreen === media || fullscreen.contains(media))) return true;
  if (doc.pictureInPictureElement === media) return true;

  const presentable = media as PresentableMedia;
  return (
    presentable.webkitDisplayingFullscreen === true ||
    (presentable.webkitPresentationMode !== undefined && presentable.webkitPresentationMode !== 'inline')
  );
}

/**
 * Pauses a playing `<video>`/`<audio>` when it scrolls out of view or is
 * clipped away by a scrolling ancestor, such as a carousel slide being swiped
 * off. It never resumes or autoplays: the viewer presses play again. Does
 * nothing where IntersectionObserver is missing (SSR, very old browsers).
 *
 * The element is read when the effect runs, so keep the same element for the
 * component's lifetime (key the component if the element type can change).
 */
export function usePauseWhenHidden(
  ref: RefObject<HTMLMediaElement | null>,
  { enabled = true, threshold = 0.25 }: UsePauseWhenHiddenOptions = {}
) {
  useEffect(() => {
    const media = ref.current;
    if (!enabled || !media || typeof IntersectionObserver === 'undefined') return;

    const minVisible = Math.min(Math.max(threshold, 0), 1);
    const observer = new IntersectionObserver(
      (entries) => {
        // Several entries can queue up between callbacks; the last is current.
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const hidden = !entry.isIntersecting || entry.intersectionRatio < minVisible;
        if (hidden && !media.paused && !isPresentedOutsidePage(media)) media.pause();
      },
      { threshold: minVisible }
    );
    observer.observe(media);
    return () => observer.disconnect();
  }, [ref, enabled, threshold]);
}
