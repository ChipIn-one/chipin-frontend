# ModeLogotype

`import { ModeLogotype } from 'components/mode-logotype';` (named export).

## Purpose

The ChipIn logo with the product name and a group/solo mode badge, colored by mode.

## When to use

- The app header and the desktop sidebar (today: `Header`, `DesktopSidebar`).
- The plain logo on public pages (footer, landing) does not need the mode: use the logo asset
  `@chipin/tokens/assets/logo.svg` as there.
- Switching mode: `ViewModeSwitch`; this component only shows it.

## Props

Source: [`components/mode-logotype/ModeLogotype.tsx`](../../../apps/app/src/components/mode-logotype/ModeLogotype.tsx).

| Prop                 | Type      | Default  | Description                          |
| -------------------- | --------- | -------- | ------------------------------------ |
| `isSoloMode`         | `boolean` | required | Solo (violet) or group (green) mode  |
| `isModeBadgeVisible` | `boolean` | `true`   | Show the mode badge next to the name |

Colors: the name and badge use Radix `color` `violet` (solo) or `green` (group). In solo mode the
logo SVG gets `--cp-logo-mode-primary` and `--cp-logo-mode-secondary` through `data-mode="solo"`
in `ModeLogotype.module.css`; in group mode it keeps its built-in brand colors.

## States

- Default: mandatory; group or solo.
- Loading, empty, error, disabled: n/a.

## Accessibility and i18n

- The logo SVG has no title or `aria-label`. The name (`PROJECT_NAME`) is hidden below the `sm`
  breakpoint (the mode badge stays), so on mobile the logo has no accessible name of its own: the
  link or button around it must have an `aria-label` (`Header` passes `aria-label={PROJECT_NAME}`).
- i18n: namespace `common`, keys `modes.solo`, `modes.group`. `PROJECT_NAME` is a constant, not
  translated.

## Example

```tsx
import { ModeLogotype } from 'components/mode-logotype';

<ModeLogotype isSoloMode={isSoloMode} isModeBadgeVisible={isLoggedIn} />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
