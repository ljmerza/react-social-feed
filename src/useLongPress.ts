import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent
} from 'react';

export type LongPressEvent = PointerEvent<Element> | KeyboardEvent<Element>;

export interface UseLongPressOptions {
  /** Fired once the pointer has been held for `delay`, or on `keyShortcut`. */
  onLongPress: (event: LongPressEvent) => void;
  /** A normal click that didn't end a long press. */
  onPress?: (event: MouseEvent<Element>) => void;
  /** How long to hold, in ms. Default 500. */
  delay?: number;
  /** How far (px) the pointer may drift before the press is cancelled. Default 10. */
  moveTolerance?: number;
  /**
   * Keyboard alternative, in `aria-keyshortcuts` syntax (e.g. `'Shift+Enter'`,
   * `'Alt+L'`), so the action isn't pointer-only. Default `'Shift+Enter'`;
   * `false` turns it off.
   */
  keyShortcut?: string | false;
  /** Turns the whole thing off; clicks still reach `onPress`. */
  disabled?: boolean;
}

/** Spread onto the element; compose with your own handlers if you have any. */
export interface LongPressProps {
  onPointerDown: (event: PointerEvent<Element>) => void;
  onPointerMove: (event: PointerEvent<Element>) => void;
  onPointerUp: (event: PointerEvent<Element>) => void;
  onPointerLeave: (event: PointerEvent<Element>) => void;
  onPointerCancel: (event: PointerEvent<Element>) => void;
  onClick: (event: MouseEvent<Element>) => void;
  onContextMenu: (event: MouseEvent<Element>) => void;
  onKeyDown: (event: KeyboardEvent<Element>) => void;
  'aria-keyshortcuts'?: string;
}

export interface UseLongPressResult {
  longPressProps: LongPressProps;
  /** True while a press is being held and hasn't fired or been cancelled yet. */
  isPressing: boolean;
}

const MODIFIERS = { shift: 'shiftKey', alt: 'altKey', control: 'ctrlKey', meta: 'metaKey' } as const;

/** Whether `event` matches one `aria-keyshortcuts` combination like "Shift+Enter". */
function matchesShortcut(event: KeyboardEvent<Element>, shortcut: string) {
  const parts = shortcut.split('+').map((part) => part.trim().toLowerCase());
  const key = parts.pop();
  if (!key) return false;
  const eventKey = event.key === ' ' ? 'space' : event.key.toLowerCase();
  if (eventKey !== key) return false;
  return (Object.keys(MODIFIERS) as Array<keyof typeof MODIFIERS>).every(
    (modifier) => event[MODIFIERS[modifier]] === parts.includes(modifier)
  );
}

/**
 * Long-press detection for any element, via Pointer Events (mouse, touch and
 * pen). The click that ends a long press is swallowed, so the element's normal
 * click action (`onPress`) doesn't also run. Moving past `moveTolerance`,
 * leaving the element, or scrolling cancels the press. While a press is held
 * the context menu is suppressed; add the `rsf-long-press` class (or
 * `-webkit-touch-callout: none; user-select: none`) to stop the iOS callout
 * and text selection.
 */
export function useLongPress({
  onLongPress,
  onPress,
  delay = 500,
  moveTolerance = 10,
  keyShortcut = 'Shift+Enter',
  disabled = false
}: UseLongPressOptions): UseLongPressResult {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // Set when a long press fired, so the click that follows is swallowed.
  const firedRef = useRef(false);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const cancel = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
    setIsPressing(false);
  }, []);

  useEffect(() => cancel, [cancel]);
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled, cancel]);

  // Scrolling (wheel, or the page moving under a held pointer) cancels.
  useEffect(() => {
    if (!isPressing) return;
    window.addEventListener('scroll', cancel, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', cancel, { capture: true });
  }, [isPressing, cancel]);

  const onPointerDown = useCallback(
    (event: PointerEvent<Element>) => {
      firedRef.current = false;
      // Primary button only. `button` is missing where PointerEvent isn't implemented (older jsdom).
      if (disabled || (event.button ?? 0) !== 0) return;
      cancel();
      startRef.current = { x: event.clientX, y: event.clientY };
      setIsPressing(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        startRef.current = null;
        firedRef.current = true;
        setIsPressing(false);
        onLongPressRef.current(event);
      }, delay);
    },
    [cancel, delay, disabled]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<Element>) => {
      const start = startRef.current;
      if (!start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > moveTolerance) cancel();
    },
    [cancel, moveTolerance]
  );

  const onClick = useCallback(
    (event: MouseEvent<Element>) => {
      if (firedRef.current) {
        firedRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onPress?.(event);
    },
    [onPress]
  );

  const onContextMenu = useCallback((event: MouseEvent<Element>) => {
    // Touch browsers open the context menu on a long press; keep it for normal right-clicks.
    if (timerRef.current !== null || firedRef.current) event.preventDefault();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<Element>) => {
      if (disabled || !keyShortcut || event.repeat) return;
      if (!keyShortcut.split(' ').some((shortcut) => matchesShortcut(event, shortcut))) return;
      // Stops Enter from also activating (clicking) a button.
      event.preventDefault();
      onLongPressRef.current(event);
    },
    [disabled, keyShortcut]
  );

  return {
    isPressing,
    longPressProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onClick,
      onContextMenu,
      onKeyDown,
      'aria-keyshortcuts': !disabled && keyShortcut ? keyShortcut : undefined
    }
  };
}
