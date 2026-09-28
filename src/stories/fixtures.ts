import type { SocialComment, SocialPost } from '../index';

const names = ['Maya Chen', 'Leo Park', 'Grandma June', 'Sam Rivera', 'Aunt Priya', 'Noah Kim'];
const captions = [
  'First trip to the beach 🌊',
  'She finally figured out the stairs.',
  'Sunday pancakes, extra syrup.',
  'Snow day! Nobody wanted to come inside.',
  'Six months old today 🎉',
  'Garden helper reporting for duty.'
];
const titles = ['Beach day', 'Big steps', 'Pancake Sunday', 'Snow day', 'Half birthday', 'Garden time'];
const ratios: Array<[number, number]> = [
  [1080, 1350],
  [1080, 1080],
  [1080, 720]
];

const photo = (seed: string, [width, height]: [number, number]) => ({
  src: `https://picsum.photos/seed/${seed}/${width}/${height}`,
  alt: `Photo ${seed}`,
  width,
  height
});

const commentsFor = (index: number): SocialComment[] =>
  Array.from({ length: (index % 4) + 1 }, (_, n) => ({
    id: `c-${index}-${n}`,
    author: { name: names[(index + n + 1) % names.length]! },
    text: ['So cute!! ❤️', 'Look at that smile', 'Growing up so fast', 'Love this one'][n % 4]!,
    // The third comment on a post replies to the first.
    parentId: n === 2 ? `c-${index}-0` : undefined,
    // The viewer wrote the first comment on each post.
    canDelete: n === 0
  }));

export const makePost = (index: number): SocialPost => {
  const ratio = ratios[index % ratios.length]!;
  const mediaCount = index % 3 === 1 ? 3 : 1;
  const comments = commentsFor(index);

  return {
    id: `post-${index}`,
    author: { name: names[index % names.length]!, avatarUrl: `https://i.pravatar.cc/64?u=${index % names.length}` },
    title: titles[index % titles.length],
    caption: captions[index % captions.length],
    media: Array.from({ length: mediaCount }, (_, n) => photo(`rsf-${index}-${n}`, ratio)),
    createdAt: new Date(Date.UTC(2026, 8, 20 - index, 15)).toISOString(),
    likeCount: ((index * 7) % 23) + 3,
    liked: index % 4 === 0,
    commentCount: comments.length + (index % 2 === 0 ? 5 : 0),
    comments,
    shareUrl: `https://example.com/posts/${index}`
  };
};

export const makePosts = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => makePost(offset + i));
