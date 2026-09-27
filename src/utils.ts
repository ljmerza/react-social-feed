import type { ReactNode } from 'react';

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
