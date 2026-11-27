# ChipInLoader

`import { ChipInLoader, PageLoader } from 'basics';` (both are named exports of their files,
re-exported from `basics`).

## Purpose

The animated brand loader (SVG circle) with a translated status text; `PageLoader` centers it on
a full-height page.

## When to use

- `PageLoader`: while a whole route or the app shell loads (lazy routes, auth bootstrap).
- `ChipInLoader`: a brand loader inside a larger block when no layout is known yet.
- Not for lists, cards or data that has a known shape: use a skeleton ([skeletons.md](skeletons.md)).
- Not inside buttons: use the Radix `Button` `loading` prop.

## Props

Source: [`basics/ChipInLoader.tsx`](../../../apps/app/src/basics/ChipInLoader.tsx) and
[`basics/PageLoader.tsx`](../../../apps/app/src/basics/PageLoader.tsx).

`ChipInLoader`:

| Prop          | Type      | Default | Description                                                         |
| ------------- | --------- | ------- | ------------------------------------------------------------------- |
| `size`        | `number`  | `64`    | SVG width and height, in pixels                                     |
| `strokeWidth` | `number`  | `2`     | Stroke width in SVG units                                           |
| `announce`    | `boolean` | `true`  | `false` hides the loader from assistive tech (a status line nearby) |

`PageLoader`: optional `children`, shown under the loader (e.g. a `role="status"` line that says
what is loading; then the loader passes `announce={false}`, so the children must carry the
status announcement). Renders `ChipInLoader` at default
size in a `Container size="4"` and a `Flex` with `minHeight="100vh"`.

## States

- Loading: this is the loading state.
- Default, empty, error, disabled: n/a.

## Accessibility and i18n

- The stroke is `var(--cp-brand-loader)` (a D23 raw-color exception).
- The loader is one `role="status"` region: the SVG is `aria-hidden`, and a `VisuallyHidden`
  text (`common:loader.label`, "Loading…") is what a screen reader announces. Do not wrap it in
  another `role="status"` or `aria-live` region, and do not add a second loading text next to
  it. When a status line next to it already says what is loading, pass `announce={false}`: the
  loader is then `aria-hidden` with no status text. `PageLoader` does this when it gets children
  (e.g. "Signing you in…" on the login and OAuth callback pages); `GuardLoader` adds no text.
- The animation is SVG SMIL (`<animate>`, `<animateTransform>`), which CSS media queries and the
  `--cp-duration-*` tokens do not reach. The component reads
  `matchMedia('(prefers-reduced-motion: reduce)')` (and follows its changes): under reduce it
  renders a static arc without the animate elements. Without `matchMedia` (SSR, the prerender) it
  renders the animated loader.
- i18n: `common:loader.label` in every locale.

## Example

```tsx
import { Suspense } from 'react';

import { PageLoader } from 'basics';

<Suspense fallback={<PageLoader />}>
    <GroupPage />
</Suspense>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
