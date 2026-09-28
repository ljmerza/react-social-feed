# react-social-feed

[![npm](https://img.shields.io/npm/v/react-social-feed.svg)](https://www.npmjs.com/package/react-social-feed)
[![CI](https://github.com/ljmerza/react-social-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/ljmerza/react-social-feed/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/react-social-feed.svg)](LICENSE)

Composable React pieces for social feed posts: header, media carousel, like,
comment and share actions, caption and comments. Use the ready-made `FeedPost`
as-is, or assemble the primitives into whatever layout your app needs. Every
icon can be swapped and you can add your own actions next to the built-in ones.

An optional `react-social-feed/virtual` entry adds `VirtualFeed`, a virtualized
infinite list for long feeds.

No runtime dependencies. React 18.2+ or 19 as a peer. `VirtualFeed` needs
`@tanstack/react-virtual` as well.

<details>
<summary><strong>Screenshots</strong></summary>

<br>

The default `FeedPost`: author, inset photo, action pills with their counts, title, caption, and the comment thread with its input.

![Default post](docs/media/default.jpg)

Several photos become a swipeable carousel with arrows and a position counter. The whole carousel takes the first photo's aspect ratio.

![Carousel post](docs/media/carousel.jpg)

The bundled dark theme, switched on with a `dark` class on an ancestor.

![Dark theme post](docs/media/dark-theme.jpg)

Icons swapped through the `icons` prop, plus a custom "Save" action built with `PostAction`.

![Custom icons and actions](docs/media/custom-icons.jpg)

The same primitives rearranged: title in the header, a text like button, and no comments.

![Custom composition](docs/media/custom-composition.jpg)

`VirtualFeed` against the window scroll, loading ten posts per page. Photo boxes hold their size before the images arrive, so rows don't jump.

![Virtualized feed](docs/media/virtual-feed.jpg)

</details>

## Installation

```bash
npm install react-social-feed
# only if you use VirtualFeed
npm install @tanstack/react-virtual
```

The package does not import its own CSS. Import the stylesheet once, or skip it
and style the class names yourself:

```tsx
import 'react-social-feed/styles.css';
```

## Quick start

```tsx
import { FeedPost, type SocialPost } from 'react-social-feed';

function Post({ post }: { post: SocialPost }) {
  return (
    <FeedPost
      post={post}
      onLikeChange={(liked) => api.setLiked(post.id, liked)}
      onCommentSubmit={(text) => api.addComment(post.id, text)}
    />
  );
}
```

## Data

Map your API into one `SocialPost` per item:

```ts
interface SocialPost {
  id: string;
  author?: { name: string; avatarUrl?: string; href?: string };
  title?: string;
  caption?: string;
  media: Array<{
    src: string;
    type?: 'image' | 'video';
    alt?: string;
    poster?: string;
    width?: number;   // width + height reserve the box before the file loads
    height?: number;
  }>;
  createdAt?: string | Date;
  likeCount: number;
  liked: boolean;       // has the current viewer liked it
  commentCount?: number; // may exceed comments.length when only a preview is loaded
  comments?: Array<{
    id: string;
    author: { name: string };
    text: string;
    createdAt?: string | Date;
    parentId?: string; // replies render one level under their top-level comment
    canDelete?: boolean; // the viewer may delete it (shows the delete button)
  }>;
  shareUrl?: string;
}
```

Pass `width` and `height` for media whenever you have them. In a virtualized
list, that decides whether rows stay put or jump as images load.

## Behaviour

Every handler is optional. The state lives in `PostRoot` (which `FeedPost` wraps).

| Prop | What it does |
|---|---|
| `onLikeChange(liked, post)` | The heart updates immediately. Return a promise and a rejection rolls the like back. When the `post` prop changes (a refetch or cache update), local state resyncs from it. |
| `onCommentSubmit(text, post, { parentId })` | Turns on the comment form and each comment's Reply button. Text arrives trimmed. Resolve to clear the input; reject to keep the draft. Replies carry the top-level comment's `parentId`; a reply to a reply joins that same thread. The form starts a reply by tagging the author (`@Name `). |
| `onCommentDelete(comment, post)` | Shows a delete button on comments with `canDelete: true`. Fires on click; confirm, delete, and update `post.comments` yourself. |
| `onCommentClick(post)` | Replaces the comment button's default of expanding the comments and focusing the input, e.g. to open a modal. |
| `onCommentsExpandedChange(expanded, post)` | Fires when "View all N comments" is toggled, so you can fetch the full thread. |
| `onShare(post)` | Custom share. Without it the button uses the Web Share API with `post.shareUrl`, falls back to copying the link, and is disabled when there is no URL. |
| `defaultCommentsExpanded` | Start with the full comment list open. |
| `shareStatusResetMs` | How long `'shared'`/`'copied'`/`'error'` stays before resetting. Default 2000. |

Double-tapping or double-clicking the media likes the post and plays a short
burst animation. It never unlikes. Turn it off with `<PostMedia likeOnDoubleTap={false} />`.

## Icons and custom actions

Every built-in icon comes from one table. Override any subset on `PostRoot` (or
`FeedPost`), or wrap a whole feed in `PostIconsProvider` to theme every post at
once:

```tsx
import { FeedPost, PostIconsProvider } from 'react-social-feed';
import { Heart, MessageCircle, Send } from 'lucide-react';

<FeedPost post={post} icons={{ like: <Heart />, liked: <Heart fill="currentColor" /> }} />

<PostIconsProvider icons={{ comment: <MessageCircle />, share: <Send /> }}>
  {posts.map((post) => <FeedPost key={post.id} post={post} />)}
</PostIconsProvider>
```

Keys: `like`, `liked`, `comment`, `share`, `send`, `previous`, `next`, `burst`, `remove`.

`PostAction` is the button every built-in action is made of. Use it for your
own actions so they match, and read post state with `usePostContext()`:

```tsx
import { PostAction, PostActions, PostActionSpacer, PostLikeButton, PostShareButton, usePostContext } from 'react-social-feed';

function DownloadAction() {
  const { post } = usePostContext();
  return (
    <PostAction aria-label="Download" icon={<DownloadIcon />} onClick={() => download(post.media)}>
      Save
    </PostAction>
  );
}

<PostActions>
  <PostLikeButton />
  <DownloadAction />
  <PostActionSpacer />
  <PostShareButton />
</PostActions>
```

## Composing your own layout

Every piece reads from the nearest `PostRoot`, so you can reorder, drop or
replace any of them:

```tsx
import {
  PostRoot, PostHeader, PostAvatar, PostAuthor, PostTimestamp, PostTitle,
  PostMedia, PostActions, PostLikeButton, PostShareButton, PostCaption
} from 'react-social-feed';

<PostRoot post={post} onLikeChange={setLiked}>
  <PostHeader>
    <PostAvatar />
    <div>
      <PostTitle as="h2" />
      <PostAuthor /> · <PostTimestamp format={(d) => d.toLocaleDateString()} />
    </div>
  </PostHeader>
  <PostMedia aspectRatio="16 / 9" />
  <PostActions>
    <PostLikeButton>{({ liked, likeCount }) => `${liked ? 'Liked' : 'Like'} · ${likeCount}`}</PostLikeButton>
    <PostShareButton>{({ status }) => (status === 'copied' ? 'Link copied' : 'Share')}</PostShareButton>
  </PostActions>
  <PostCaption />
</PostRoot>
```

| Primitive | Renders |
|---|---|
| `PostRoot` | `<article>` plus the context. Takes `icons`. Children may be a function of the post state. |
| `PostHeader` | Avatar, author and timestamp by default. |
| `PostAvatar`, `PostAuthor`, `PostTimestamp`, `PostTitle` | The individual header parts. `PostTitle` accepts `as`. |
| `PostMedia` | Scroll-snap carousel. Props: `aspectRatio`, `renderItem`, `likeOnDoubleTap`, `loading`. |
| `PostMediaItem`, `PostMediaPrevButton`, `PostMediaNextButton`, `PostMediaCounter`, `PostMediaIndicators` | Carousel parts. The default overlay is arrows plus a "2 / 5" counter; `PostMediaIndicators` draws dots instead. Pass children to `PostMedia` to replace the overlay. |
| `PostActions` | Like, comment and (pushed to the end) share by default. |
| `PostAction`, `PostActionSpacer` | The shared action button, and a spacer that pushes later actions to the end. |
| `PostLikeButton`, `PostCommentButton` | Icon plus count (`showCount={false}` hides it). Render-prop children replace both. |
| `PostShareButton` | Icon only. Render-prop children get the share status. |
| `PostLikeCount` | A separate "N likes" line for layouts that hide the count on the button. `format(count, liked)`; return `null` to hide. |
| `PostCaption` | Caption. `showAuthor` puts the author's name in front. |
| `PostComments` | The newest `previewCount` comments plus a "View all" toggle, with replies nested one level under their top-level comment. `renderComment` and label props (`replyLabel`, …) are available. |
| `PostComment` | A single comment row, with a Reply button when commenting is on and a delete button when the comment is deletable. |
| `PostCommentForm` | Input and send button, plus a "Replying to Name · Cancel" line while replying (Escape also cancels). Renders nothing without `onCommentSubmit`. |

To drop the `<article>` wrapper, call `usePostState(options)` yourself and pass
the result to `PostContextProvider`. `usePostContext()` gives any custom
component the same state the primitives use.

Visible and accessible strings (`"Like"`, `"View all N comments"`,
`"Add a comment…"`) can be replaced through props (`label`, `viewAllLabel`,
`placeholder`, `submitLabel`, `format`, `aria-label`, …), which is how you plug
in i18n.

## Virtualized feed

```tsx
import { FeedPost } from 'react-social-feed';
import { VirtualFeed } from 'react-social-feed/virtual';

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(/* … */);
const posts = data?.pages.flatMap((page) => page.results) ?? [];

<VirtualFeed
  items={posts}
  getItemKey={(post) => post.id}
  renderItem={(post) => <FeedPost post={post} />}
  hasMore={hasNextPage}
  isLoadingMore={isFetchingNextPage}
  onLoadMore={fetchNextPage}
  renderEnd={() => <p>You're all caught up</p>}
  renderEmpty={() => <p>No posts yet</p>}
  aria-label="Photo feed"
/>;
```

Rows are measured after they render, so posts can be any height. `estimateSize`
(default 600px) only affects the first frame. By default the list follows the
window scroll. Pass `getScrollElement={() => ref.current}` to scroll inside an
overflow container instead. Other props: `overscan` (default 3), `gap`,
`loadMoreThreshold` (how many items from the end to start loading, default 3),
`renderLoader` and `scrollMargin`.

`VirtualFeed` renders anything, not just posts. `renderItem` can return any node.

## Styling

`styles.css` is plain CSS driven by custom properties. Override tokens instead
of rewriting rules:

```css
:root {
  --rsf-color-like: #e11d48;
  --rsf-post-max-width: 600px;
  --rsf-media-inset: 0;   /* edge-to-edge photos */
  --rsf-media-fit: contain;
  --rsf-comment-gap: 1rem; /* space between comments and replies */
}
```

A `.dark` block ships with the stylesheet and re-points those tokens. It keys off
a `dark` class on an ancestor, so the consuming app decides when to switch.
Every element uses a `rsf-` BEM class, and every primitive accepts `className`.

## Development

```bash
npm install
npm run storybook   # http://localhost:6006
```

| Script | Purpose |
|---|---|
| `npm test` | Vitest suite |
| `npm run test:coverage` | Tests with coverage |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | ESM + CJS bundles for both entries, plus declarations |

## Releasing

CI runs tests on every PR. To release: bump `version` in `package.json`, merge,
then tag.

```bash
git tag v1.2.3 && git push origin v1.2.3
```

The tag publishes to npm via [trusted publishing](https://docs.npmjs.com/trusted-publishers/)
(OIDC, no stored token) and creates a GitHub release. The build fails if the tag
and `package.json` version disagree.

## License

MIT
