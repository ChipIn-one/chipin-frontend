# Process

How the design system changes: adding or changing a component, what a UI PR checks, how a rule
changes, and the plan for when a designer joins. Read [README.md](README.md) first.

## Adding or changing a component

1. **Search [components.md](components.md) first.** If a component does the job, use it; if it
   almost does, extend its props instead of creating a near copy.
2. **A configured Radix primitive needs no wrapper.** Use `Button`, `Card`, `Dialog`, `Text` and
   the rest directly with their props; a wrapper that only renames props is not added.
3. **A ChipIn-specific component goes to `basics` or `components`.** `apps/app/src/basics` holds
   presentational components without a store; `apps/app/src/components` holds compositions that
   may read stores, hooks and entities (layer rules: [components.md](components.md#basics-and-components)).
   Styles go to a CSS Module (`Component.module.css`) with `var(--cp-*)` only; Radix `color`
   props take `PROP_COLOR` (not linted yet, [tokens.md](tokens.md)). A new styled-components file is a lint error.
4. **Card and registry row in the same PR.** A new ChipIn-specific component gets a card in
   [`components/`](components/) (purpose, when to use, props, states, accessibility and i18n,
   example) and a row in [components.md](components.md). A changed component updates its card.
   There is no gallery section: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
5. **A new token lands in `tokens.css` first.** Add it to
   [`packages/tokens/tokens.css`](../../packages/tokens/tokens.css) in the same PR that uses it,
   then run `npx vitest run packages/tokens/tokens.test.ts` from the repository root ([tokens.md §How to add a token](tokens.md#how-to-add-a-token)).
   There is no `tokens.json` and no generator (D31).

## UI PR checklist

The author checks this before review; the reviewer checks the same list (`AGENTS.md` §Review).

- [ ] Existing components reused; nothing in [components.md](components.md) already did the job.
- [ ] A new ChipIn-specific component has a card and a registry row; a changed one has its card
      updated.
- [ ] Colors only through `var(--cp-*)` and `PROP_COLOR`; no raw colors, palette variables or new
      `themeColor()` calls.
- [ ] A styled-components file touched as defined in tokens.md moved to a CSS Module and left the allowlist
      ([tokens.md](tokens.md#styled-components-frozen-then-gone)).
- [ ] A screen has one primary action and a title that says what the screen is for
      ([patterns/hierarchy.md](patterns/hierarchy.md)).
- [ ] Amounts, loading, empty, error and form states follow their pattern
      ([money](patterns/money.md), [states](patterns/states.md), [forms](patterns/forms.md)).
- [ ] User-facing text and `aria-*` go through i18n in every locale.

## Changing a rule

A rule lands in the docs and, where possible, in lint or CI in the same PR. A rule that exists only
as text is a recommendation, not a law: reviewers may point to it, but it fails nothing.

- The design system owns patterns and tokens; `docs/engineering/rules/30-ui.md` links here and never
  repeats a rule, so a rule has one place to change.
- A rule with a check names that check next to it (as in
  [tokens.md §What is forbidden](tokens.md#what-is-forbidden)). Removing a check removes or
  downgrades the rule in the same PR.
- Existing violations of a new lint rule go to `eslint-suppressions.json`; that baseline only
  shrinks.
- A rule that contradicts a recorded owner decision (`DECISIONS.md` in
  `docs/superpowers/specs/2026-10-28-frontend-refactor/`) is not changed in a task: ask the owner.

## Mockups and design review

Code is the source of truth. Mockups (Pencil `.pen` files, Claude Design) are for discussion before
a screen changes and are disposable; they never become a token source (D17, D33). Design review of
a component happens in Claude Design; there is no gallery in the repository.

Two Claude Design artifacts hold the review material:

- [ChipIn design system](https://claude.ai/artifact/AtzC72Gji4PkXbfpt8Qwov): the `--cp-*` tokens in
  light and dark, spacing, radius, type, shadows, the component cards from
  [`components/`](components/) with previews, the [patterns](patterns/), logos and icons.
- [ChipIn screens](https://claude.ai/artifact/WNBRd6Z4QhcDoatv97mYSB): screenshots of the key
  screens (dashboard, group, add expense, settle up, friends, activity, settings, invite join) in
  light and dark, desktop and phone, taken from a `master` Preview with staging data. Sign-in is not
  there yet: it needs a signed-out browser.

Both are refreshed from code (each names the `master` commit it was made from) and never lead it:
when they disagree with the code, the code wins and the artifact is refreshed. They are private to
the owner until the owner shares them.

The design system artifact was refreshed from `master` commit `aeb838eb` with the card fixes of
ChipIn-one/chipin-frontend#996 (2026-11-28) and shows every component card with its variants, sizes
and states in light and dark.

## Designer onboarding plan

Future work, recorded here and not executed in v1. Each step is a separate owner decision.

1. **Choose the exchange format.** Export `tokens.css` to a DTCG file for Figma Variables; this
   brings back a token file, which D31 postponed.
2. **Import the tokens into Figma Variables** (native DTCG import or a community plugin).
3. **Attach the official Radix Themes Figma kit** and bind it to the ChipIn variables.
4. **Draw the ChipIn-specific components** from their cards in [`components/`](components/) and
   the running app.
5. **Authorize the Figma MCP** so agents can read mockups, and decide whether code or Figma is the
   token master. Until that decision code stays the master, and a change from Figma reaches code
   only as a PR into `tokens.css` that passes the same checks.
