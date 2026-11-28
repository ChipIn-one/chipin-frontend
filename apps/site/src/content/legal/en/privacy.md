---
title: "ChipIn — Privacy"
description: "Learn how ChipIn uses information to operate the service"
locale: en
translationKey: privacy
updatedAt: 2026-11-28
---

# Privacy

ChipIn uses the information you provide to operate shared-expense and balance tracking features.

Effective date: November 28, 2026

## Account information

We use the account and profile details you provide, such as your display name and email address, to identify your account and show your profile where the product does so.

## Google Sign-In

When you sign in with Google, ChipIn receives your Google account ID, email address, name, and profile picture URL (scopes: openid, email, profile). We use this data only to create and identify your ChipIn account and to show your name, email address, and profile picture to members of the groups you share. We do not sell Google user data or use it for advertising. ChipIn's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.

## Groups and expenses

The groups, expenses, settlements, and balances you add are used to provide shared-expense tracking and calculate what the app displays.

## Authentication and sessions

Authentication and session information is used to sign you in and help keep your account secure.

## Cookies and local storage

ChipIn uses two cookies, both needed to sign you in: `__Host-chipin_refresh` keeps you signed in (a sign-in token that scripts on the page cannot read; it is renewed while you use ChipIn and expires 30 days after the last renewal), and `__Host-chipin_oauth_tx` links a Google sign-in to the browser that started it (kept for about 10 minutes). In browser local storage and session storage, ChipIn keeps a sign-in hint, your user ID, account role and app settings (such as language, theme and default currency), the timing of app update prompts, the accounts whose unsent changes are kept on this device, an expense draft while the app reloads, and short flags for the current visit, such as whether a language suggestion was shown. IndexedDB keeps a copy of your data so the app can open offline, and the changes made offline that are not sent yet. The app also saves its own files so it can start offline. We do not use advertising or cross-site tracking cookies. When you sign out, ChipIn deletes the offline data and the expense draft on this device; when you are online, it also ends the session and deletes the sign-in cookie. App settings stay. To remove everything, clear the site data for ChipIn in your browser settings. We do not show a cookie banner because ChipIn uses only storage that is strictly necessary for the service you ask for.

## Sharing

We do not sell your personal data. Your name, email address, profile picture, and the expenses you add are visible to members of the groups you share. We share data with service providers only as needed to host, store, and monitor ChipIn, such as hosting, file storage, analytics, and error monitoring providers. For usage and performance statistics that do not identify you, we use Vercel Web Analytics and Speed Insights; they set no cookies and use no persistent identifier. For error monitoring we use Sentry: it receives error reports and app stability data, with no session replay and no account details, and links are cleaned of tokens before they are sent.

## Operating the service

Operational and error telemetry helps us operate, secure, and improve ChipIn. Production observability is designed not to intentionally expose sensitive authentication details or sensitive request and response bodies.

## Data retention and deletion

We keep your data while your account is active. To request deletion of your account and associated personal data, contact us at the address below.

## Updates

This information may be updated as the product evolves.

## Contact

Questions about this policy or your data: [privacy@chipin.one](mailto:privacy@chipin.one)
