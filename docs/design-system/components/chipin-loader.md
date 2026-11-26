# ChipInLoader

`import { ChipInLoader, PageLoader } from 'basics';` (`ChipInLoader` named export;
`PageLoader` default export of `basics/PageLoader.tsx`, re-exported by name).

## Purpose

The animated brand loader (SVG circle); `PageLoader` centers it on a full-height page.

## When to use

- `PageLoader`: while a whole route or the app shell loads (lazy routes, auth bootstrap).
- `ChipInLoader`: a brand loader inside a larger block when no layout is known yet.
- Not for lists, cards or data that has a known shape: use a skeleton ([skeletons.md](skeletons.md)).
- Not inside buttons: use the Radix `Button` `loading` prop.

## Props

Source: [`basics/ChipInLoader.tsx`](../../../apps/app/src/basics/ChipInLoader.tsx) and
[`basics/PageLoader.tsx`](../../../apps/app/src/basics/PageLoader.tsx).

`ChipInLoader`:

| Prop          | Type     | Default | Description                     |
| ------------- | -------- | ------- | ------------------------------- |
| `size`        | `number` | `64`    | SVG width and height, in pixels |
| `strokeWidth` | `number` | `2`     | Stroke width in SVG units       |

`PageLoader`: no props. Renders `ChipInLoader` at default size in a `Container size="4"` and a
`Flex` with `minHeight="100vh"`.

## States

- Loading: this is the loading state.
- Default, empty, error, disabled: n/a.

## Accessibility and i18n

- The stroke is `var(--cp-brand-loader)` (a D23 raw-color exception).
- The SVG has no `role`, `aria-label` or title, so screen readers get nothing. Where the wait
  matters, put a `VisuallyHidden` status text next to it.
- The animation is SVG `<animate>` with fixed durations; it does not follow
  `prefers-reduced-motion` (the `--cp-duration-*` tokens do not reach it).
- i18n: none.

## Example

```tsx
import { Suspense } from 'react';

import { PageLoader } from 'basics';

<Suspense fallback={<PageLoader />}>
    <GroupPage />
</Suspense>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
