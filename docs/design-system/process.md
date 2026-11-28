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
- [ ] The PR body has the `Design:` line copied from the Issue (the Issue has `design-approved`; CI
      checks the Issue, the reviewer checks the PR line), or the PR has the owner's
      `no-design-needed` label.
- [ ] Before/after screenshots match the approved mockup (after only for a new screen; none with
      `no-design-needed`).

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

UI work is design-first (D35, `AGENTS.md` rule 21). An Issue that adds or changes UI follows this
flow:

1. **Design.** The screen is designed in Claude Design on the
   [ChipIn design system](https://claude.ai/artifact/AtzC72Gji4PkXbfpt8Qwov), with its `--cp-*`
   tokens and component cards. Pencil is no longer the mockup tool.
2. **Approval.** The owner reviews the mockup and approves it by adding the label `design-approved`
   to the Issue and a line `Design: <https link to the approved artifact>` to the Issue body. Only
   then does implementation start.
3. **Implementation** follows the mockup.
4. **PR.** The PR body has the `Design:` line copied from the Issue and before/after screenshots
   (desktop and phone, light and dark where relevant; after only for a new screen; none with
   `no-design-needed`); the reviewer checks that they match the mockup.
5. **After merge** the ChipIn screens artifact is refreshed.

For an approved design the mockup is the spec for screen layout, content and states. For token
values, and for already-built screens without a newer approved design, code wins and the artifacts
are refreshed from code. A mockup never becomes a token source: a new token lands in
[`tokens.css`](../../packages/tokens/tokens.css) first and is then shown in the design system (D17,
D35).

The CI check `design-gate` ([`scripts/design-gate.mjs`](../../scripts/design-gate.mjs)) fails a PR
that changes UI files (`apps/app/src/**/*.tsx`, CSS and `styled.ts` files, `apps/site/src/**`,
locale files in `apps/*/src/i18n` and `packages/i18n-content`) when its Task identity Issue lacks
`design-approved` or the `Design:` line. A change that touches UI files but changes nothing visible
gets the PR label `no-design-needed`. Only the owner adds or removes `design-approved` and
`no-design-needed`. An Issue change does not retrigger the check: re-run it or push a commit.

Two Claude Design artifacts hold the review material:

- [ChipIn design system](https://claude.ai/artifact/AtzC72Gji4PkXbfpt8Qwov): the `--cp-*` tokens in
  light and dark, spacing, radius, type, shadows, the component cards from
  [`components/`](components/) with previews, the [patterns](patterns/), logos and icons.
- [ChipIn screens](https://claude.ai/artifact/WNBRd6Z4QhcDoatv97mYSB): screenshots of the key
  screens (dashboard, group, add expense, settle up, friends, activity, settings, invite join) in
  light and dark, desktop and phone, taken from a `master` Preview with staging data. Sign-in is not
  there yet: it needs a signed-out browser.

Both name the `master` commit they were refreshed from. They are private to the owner until the
owner shares them.

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
