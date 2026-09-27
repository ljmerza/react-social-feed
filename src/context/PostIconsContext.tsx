import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ChevronIcon, MessageIcon, SendIcon, ShareIcon, StarIcon } from '../icons';

/** Every icon the built-in primitives draw. Override any subset via `icons`. */
export interface PostIcons {
  like: ReactNode;
  /** Shown on the like button while liked. */
  liked: ReactNode;
  comment: ReactNode;
  share: ReactNode;
  send: ReactNode;
  previous: ReactNode;
  next: ReactNode;
  /** Pops over the media on a double-tap like. */
  burst: ReactNode;
}

export const defaultPostIcons: PostIcons = {
  like: <StarIcon />,
  liked: <StarIcon filled />,
  comment: <MessageIcon />,
  share: <ShareIcon />,
  send: <SendIcon />,
  previous: <ChevronIcon direction="left" />,
  next: <ChevronIcon direction="right" />,
  burst: <StarIcon filled />
};

const PostIconsContext = createContext<PostIcons>(defaultPostIcons);

export interface PostIconsProviderProps {
  icons?: Partial<PostIcons>;
  children: ReactNode;
}

/**
 * Swap icons for everything below it. PostRoot wraps this, so passing `icons`
 * there is usually enough; put it higher up to theme a whole feed at once.
 */
export function PostIconsProvider({ icons, children }: PostIconsProviderProps) {
  const inherited = useContext(PostIconsContext);
  const value = useMemo(() => ({ ...inherited, ...icons }), [inherited, icons]);
  return <PostIconsContext.Provider value={value}>{children}</PostIconsContext.Provider>;
}

export function usePostIcons(): PostIcons {
  return useContext(PostIconsContext);
}
