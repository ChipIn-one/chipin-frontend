# InAppBrowserNotice

`import { InAppBrowserNotice } from 'components/in-app-browser-notice/InAppBrowserNotice';` (named
export).

## Purpose

AUTH-078: Google sign-in fails inside in-app browsers (Instagram, Facebook, Messenger, Telegram,
Threads, LINE, TikTok, LinkedIn, other Android WebViews) with `403 disallowed_useragent`. This
warning callout, shown above the Google button, tells the person why and sends them to a normal
browser: "Open in Chrome" where it works, the app-menu steps and "Copy link".

## When to use

- Only inside `AuthButtons`. `AuthButtons` does the detection (`detectInAppBrowser` from
  `helpers/inAppBrowser` with `navigator.userAgent` and the `window.TelegramWebviewProxy` hint) and
  skips it in an installed PWA (`checkIsPwaInstalled`); it renders the notice only for a detected
  in-app browser and keeps the Google button below it in case the detection was wrong.
- Not for other "open elsewhere" messages: use a Radix `Callout` directly.

## Props

Source: [`components/in-app-browser-notice/InAppBrowserNotice.tsx`](../../../apps/app/src/components/in-app-browser-notice/InAppBrowserNotice.tsx).

| Prop           | Type           | Default  | Description                                                                         |
| -------------- | -------------- | -------- | ----------------------------------------------------------------------------------- |
| `inAppBrowser` | `InAppBrowser` | required | `{ kind, platform }` from `detectInAppBrowser`; picks the button and the menu steps |

Renders a Radix `Callout` with `PROP_COLOR.warning`. The page URL is read once from
`window.location.href`; the manual-copy address uses `InAppBrowserNotice.module.css` (no colors).

## States

- Android, Instagram, Facebook or Telegram (`canOpenInChrome`): the notice, the Android menu steps,
  a solid "Open in Chrome" link (an `intent://` URL of the current page, see
  `buildAndroidChromeIntentUrl`) and an outline "Copy link". The host app resolves the intent;
  without Chrome it reopens the same page in the in-app browser.
- Steps only: a generic Android WebView or another app (`other-app`) on Android gets the Android
  menu steps; iOS and other platforms get the iOS menu steps. Each has a solid "Copy link" and no
  "Open in Chrome".
- Copied: "Link copied" below the buttons.
- Copy failed (clipboard unsupported or denied): the failure text and the whole URL as wrapping
  text that a long-press selects as a whole (`user-select: all`), so it can be copied by hand in iOS WKWebView.
- Each copy attempt first clears the result, so a repeated identical result is usually announced again.
- Loading, empty, disabled: n/a.

## Accessibility and i18n

- The copy result sits in a `role="status"` live region (`aria-live="polite"`).
- The globe and copy icons are decorative (`aria-hidden="true"`); the buttons have visible text.
- The manual-copy address is a `role="group"` labelled by the visible "Link to this page" text.
- The URL carries the invite token: it goes only to the clipboard, the intent and the screen,
  never to logs.
- i18n: namespace `auth`, keys `inAppBrowser.notice`, `inAppBrowser.openInChrome`,
  `inAppBrowser.instructions` (iOS and other), `inAppBrowser.instructionsAndroid`,
  `inAppBrowser.copyLink`, `inAppBrowser.copied`, `inAppBrowser.copyFailed`,
  `inAppBrowser.linkLabel`.

## Example

```tsx
import { InAppBrowserNotice } from './in-app-browser-notice/InAppBrowserNotice';

// Inside AuthButtons: `inAppBrowser` is null in a normal browser and in an installed PWA.
<Flex direction="column" gap="4">
    {inAppBrowser ? <InAppBrowserNotice inAppBrowser={inAppBrowser} /> : null}
    <Button size="4" variant="soft" onClick={handleGoogleSignIn}>
        {t('button.google')}
    </Button>
</Flex>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
