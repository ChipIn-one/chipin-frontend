# ProgressBar

`import { ProgressBar } from 'basics/progress-bar/ProgressBar';` (named export).

## Purpose

A Radix `Progress` with the value clamped to `0..max`.

## When to use

- Progress toward a known total (a goal, steps of a flow).
- Unknown duration: a skeleton ([skeletons.md](skeletons.md)) or the Radix `Button` `loading`
  prop. Whole page loading: [ChipInLoader / PageLoader](chipin-loader.md).

## Props

Source: [`basics/progress-bar/ProgressBar.tsx`](../../../apps/app/src/basics/progress-bar/ProgressBar.tsx).
Plus Radix `Progress` props (`color`, `variant`, `duration`, …).

| Prop     | Type                      | Default                | Description         |
| -------- | ------------------------- | ---------------------- | ------------------- |
| `value`  | `number`                  | required               | Clamped to `0..max` |
| `max`    | `number`                  | `100` (`PROGRESS_MAX`) | Upper bound         |
| `size`   | Radix `Progress` `size`   | `'1'`                  | Bar height          |
| `radius` | Radix `Progress` `radius` | `'full'`               | Bar radius          |

## States

- Default: mandatory.
- Loading: n/a (`value` is always set; omit the bar for indeterminate waits).
- Empty: `value` `0` shows an empty bar.
- Error, disabled: n/a.

## Accessibility and i18n

- Radix `Progress` gives the progressbar role and value. Pass `aria-label` through the props when
  no visible text says what progresses.
- i18n: none.

## Example

```tsx
import { ProgressBar } from 'basics/progress-bar/ProgressBar';

<ProgressBar value={paid} max={total} aria-label={progressLabel} />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
