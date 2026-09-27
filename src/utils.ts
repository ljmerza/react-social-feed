import type { ReactNode } from 'react';
import type { SocialComment } from './types';

export const cx = (...classNames: Array<string | false | null | undefined>) => classNames.filter(Boolean).join(' ');

/** Children may be plain nodes or a render function over some state. */
export type RenderableChildren<State> = ReactNode | ((state: State) => ReactNode);

export function renderChildren<State>(
  children: RenderableChildren<State> | undefined,
  state: State,
  fallback: ReactNode
): ReactNode {
  if (typeof children === 'function') return children(state);
  return children ?? fallback;
}

export const toDate = (value: string | Date | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Id of the top-level comment `comment` belongs to, following `parentId` links
 * through the comments in `byId`. When a parent isn't loaded, the chain stops
 * at that parent's id.
 */
export function threadRootId(comment: SocialComment, byId: ReadonlyMap<string, SocialComment>): string {
  let current = comment;
  const seen = new Set<string>();
  while (current.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) return current.parentId;
    current = parent;
  }
  return current.id;
}
