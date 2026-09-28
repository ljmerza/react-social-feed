import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { PostState } from '../usePostState';

const PostContext = createContext<PostState | null>(null);

export interface PostContextProviderProps {
  value: PostState;
  children: ReactNode;
}

export function PostContextProvider({ value, children }: PostContextProviderProps) {
  return <PostContext.Provider value={value}>{children}</PostContext.Provider>;
}

export function usePostContext(componentName = 'usePostContext'): PostState {
  const context = useContext(PostContext);

  if (!context) {
    throw new Error(`${componentName} must be used within a <PostRoot> or <PostContextProvider>.`);
  }

  return context;
}

/** The nearest post state, or null outside a root (for primitives that also work standalone). */
export function useOptionalPostContext(): PostState | null {
  return useContext(PostContext);
}
