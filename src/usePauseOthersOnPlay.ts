import { useEffect, type RefObject } from 'react';
import { isPresentedOutsidePage } from './usePauseWhenHidden';

export interface UsePauseOthersOnPlayOptions {
  /** Leaves the element out entirely: it neither pauses others nor is paused by them. Default true. */
  enabled?: boolean;
}

/**
 * Every mounted media element that takes part. Module level, so videos in
 * separate posts (separate PostRoots) see each other without a provider. Only
 * touched from effects, so nothing runs during SSR.
 */
const registered = new Set<HTMLMediaElement>();

function pauseOthers(playing: HTMLMediaElement) {
  // Iterate a copy so the set can't change under the loop.
  for (const media of Array.from(registered)) {
    if (media === playing || media.paused || isPresentedOutsidePage(media)) continue;
    media.pause();
  }
}

/**
 * Keeps one video playing at a time: when this `<video>`/`<audio>` starts
 * playing, every other element using this hook that is still playing gets
 * paused. Others shown fullscreen or in picture-in-picture keep playing. It
 * never calls `play()`.
 *
 * The element is read when the effect runs, so keep the same element for the
 * component's lifetime (key the component if the element type can change).
 */
export function usePauseOthersOnPlay(
  ref: RefObject<HTMLMediaElement | null>,
  { enabled = true }: UsePauseOthersOnPlayOptions = {}
) {
  useEffect(() => {
    const media = ref.current;
    if (!enabled || !media) return;

    const handlePlay = () => pauseOthers(media);
    registered.add(media);
    media.addEventListener('play', handlePlay);
    return () => {
      media.removeEventListener('play', handlePlay);
      registered.delete(media);
    };
  }, [ref, enabled]);
}
