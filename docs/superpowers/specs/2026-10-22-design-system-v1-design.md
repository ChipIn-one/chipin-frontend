# ChipIn Design System v1 Design

## Goal

Give ChipIn one structured, code-first design system that every agent (and later a human designer)
follows when building UI in `ChipIn-one/chipin-frontend`: a single token source, a documented
component library with a live gallery, ChipIn-specific UX patterns, and automated checks that
make violations fail a PR instead of waiting for a human reviewer.

The system must directly address the current user complaint "it is unclear where to tap and what
is responsible for what": explicit action hierarchy, fast debt entry, and onboarding built into
empty states.

## Owner decisions (2026-10-22, do not reopen)

1. Source of truth is code. Figma is not used now; the token format must allow a designer to be
   onboarded later with no rework. The owner acts as designer until then.
2. Scope covers the PWA and the landing (public routes) inside `chipin-frontend`. No separate
   design-system package or repository; tokens live in a platform-neutral JSON so they can be
   extracted later.
3. Keep the current visual language (Radix Themes, accent `grass`, gray `olive`, radius `large`,
   system font, lucide icons). Invest in domain patterns, not rebranding. Changing the brand later
   must be a change in one token file, so no palette name may be hardcoded in product code.
4. Enforcement = documentation + ESLint + checks inside the existing `frontend-ci` run. No new CI
   workflows, no paid services, no cloud visual-regression tools. All added checks are scripts
   that run in seconds, locally (husky) and as extra steps of the existing CI job.
5. Rules apply strictly from the start: the migration task fixes existing violations, then any
   violation is a red PR. No "warning period".
6. Documentation lives only in the repository, in English, as short files.
7. Debt colors stay: "you are owed" = green, "you owe" = red, settled = gray. They become tokens
   so they can be changed in one place.
8. The screen audit (task 8) produces a report for the owner first; Issues are created only after
   the owner approves it.
9. The owner reads only `principles.md` and `patterns/hierarchy.md`; everything else is reviewed by
   the independent Reviewer agent.
10. Figma export is a follow-up, not part of v1. The gallery stays local (no deployment).
11. Approach: tokens-core (DTCG JSON + generated code + short docs + lint), not a single
    `DESIGN.md` and not Storybook. `ds-gallery` remains the showcase.

## Product principles (content of `docs/design-system/principles.md`)

1. Mobile first. Design for one-handed phone use; tablet and desktop adapt through Radix responsive
   props and must stay comfortable, but never drive simplifications.
2. Fast debt entry. The path "open, enter amount, pick people, save" has the minimum number of
   taps. Any new step in that flow needs a justification in the PR.
3. Explicit action hierarchy. One primary action per screen (`Button variant="solid"`, accent
   color). Everything else is secondary (`soft`/`outline`) or tertiary (`ghost`). The floating
   "add expense" button is the only global primary. Two solid buttons on one screen is a review
   blocker.
4. Clarity. Interactive things look interactive: buttons are buttons, cards use
   `interactiveCardStyles` with hover and press states, no clickable `div`/`span`. Icon-only
   controls only for universally known actions (close, back, add). Action labels are verbs
   ("Add expense", not "Expense").
5. Onboarding lives in empty states. A screen without data explains what it is and offers one
   action. `dashboard-onboarding` and `invite-onboarding` are the reference implementations.
6. Radix first, invent nothing. Use Radix Themes primitives and props before any custom styling.
7. Accessibility and i18n by default. Native semantics, visible focus, translated names, money
   through `Amount`.

## Architecture: three layers

```
tokens (design-system/tokens.json)
   -> components (src/basics, src/components, ds-gallery)
      -> patterns and rules (docs/design-system/**)
```

Each layer references only the layer below it. Documentation never contains a value that is not
in the token file; components never contain a color that is not a token role.

## Layer 1: tokens

### Files

```
design-system/
  tokens.json              # source of truth, DTCG 2025.10 format ($type, $value, aliases, modes)
  build-tokens.mjs         # generator: tokens.json -> src/design-system/generated/*
src/design-system/
  generated/tokens.ts      # typed constants and union types (do not edit)
  generated/tokens.css     # CSS custom properties --cp-* for light and dark
  theme.ts                 # Radix <Theme> props (accentColor, grayColor, radius, panelBackground)
  index.ts                 # public entry: themeColor(), space(), tokens, types
docs/design-system/        # layer 3
ds-gallery/                # showcase, extended, built by npm run build:ds-gallery, not deployed
```

### Token levels inside `tokens.json`

1. Primitive: references to Radix scales (`grass.1..12`, `olive.1..12`, alpha scales), spacing
   scale `space.1..9` matching Radix, radius, typography (sizes 1..9, weights, line heights),
   shadows, durations. Nothing invented; this records what Radix already provides.
2. Semantic: named roles with `light` and `dark` modes. Groups:
   `color.accent.*`, `color.surface.*`, `color.text.{primary,secondary,muted,inverse}`,
   `color.border.*`, `color.status.{success,warning,danger,info}`,
   `color.debt.{owed,owing,settled}`. Only semantic tokens alias primitives.
3. Component: only where a component owns numbers: `avatar.size.{sm,md,lg}`, `amount.weight`,
   `group-card.cover-ratio`. Kept deliberately small.

### Integration with existing code

- `themeColor()` (`src/helpers/colors.ts`) moves to `src/design-system` and accepts semantic keys
  (`themeColor('text.secondary')`). Palette keys (`grass9`, `olive6`) remain available during the
  migration task only; afterwards they are a lint error.
- `src/constants/styled-themes.ts` is replaced by generated `DefaultTheme.colors` built from the
  semantic layer. `src/types/styled.d.ts` is regenerated from the token types.
- `src/main.tsx` `<Theme>` reads `accentColor`, `grayColor`, `radius`, `panelBackground` from
  `src/design-system/theme.ts`. Changing the brand = editing one field in `tokens.json`.
- `generated/tokens.css` serves non-React surfaces (landing SSG output,
  `global-error-boundary/styles.css`).
- Generator: a project script (about 80-120 lines, no new dependency), run by `npm run tokens:build`
  and by `prebuild`. Style Dictionary is an acceptable later replacement because the input format is
  the same; it is not used in v1 to avoid a dependency with major-version churn.
- Spacing stays in Radix props (`gap="3"`, `p="4"`); they are already tokens. No duplication.

### Known violations to migrate (task 2)

Palette names hardcoded in `src/main.tsx`, `src/basics/Checkbox.tsx`,
`src/components/AddExpenseButton.tsx`, `src/components/GroupsCards.tsx`,
`src/components/nav-bars/styled.ts`, `src/components/dashboard-summary/internal/useConnect.ts`,
`src/features/activity/components/activity-event/styled.ts`,
`src/features/landing/showcase-sections/components/group-page-preview/styled.ts`, plus literal
`color="green"|"red"` in `OwedStatusText`, `DebtAmount`, `BalanceBadges` and other money basics.
The migration task re-greps for `grass|olive|color="green"|color="red"` and fixes every hit in
`src/`.

## Layer 2: components and gallery

- `src/basics`: presentational, no store access. `src/components`: may read stores. This is the
  existing split; it is documented, not changed.
- Radix primitives are used directly and are not wrapped or documented; `components.md` links to
  radix-ui.com.
- ChipIn-specific components (about 15) get a card each (see layer 3). Candidates: `Amount`,
  `AmountInput`, `DebtAmount`, `OwedStatusText`, `BalanceBadges`, `BalanceSummaryText`,
  `UserAvatar`, `GroupAvatar`, `UsersRow`, `GroupRoleBadge`, `LedgerScopeBadge`, `EmptyState`
  (with its variants), `ChipInLoader`, skeletons, `SegmentedControl`, `Select`, `Dropdown`,
  `ProgressBar`, `ModeLogotype`. The documentation task finalizes the list.
- `ds-gallery` is the official specification surface. Every component card links to its gallery
  section and every gallery section links back to the card. The gallery gets a `patterns` section
  that demonstrates the money and hierarchy rules (one primary action, debt colors, amount
  hierarchy).

## Layer 3: documentation for agents

### Files (`docs/design-system/`)

```
README.md              # ~30 lines: what this is, the three layers, file map, "if you do X read Y"
principles.md          # the seven principles above
tokens.md              # how to read tokens.json, table of semantic roles and their purpose,
                       # how to add a token, what is forbidden
components.md          # registry: table of every basics/components export, one-line purpose,
                       # gallery anchor; rule "search here before creating anything"
components/<name>.md   # cards for ChipIn-specific components only
patterns/hierarchy.md  # visibility scale, one screen one task, navigation, "button -> outcome" map
patterns/money.md      # amounts, debts, balances, currencies, input
patterns/groups.md     # groups, members, avatars, roles, group card order
patterns/states.md     # loading, empty, error, offline, toasts
patterns/forms.md      # fields, validation, modals, confirmations, mobile layout
process.md             # how to add or change a component, PR checklist, designer onboarding plan
```

No file longer than about 150 lines. English only.

### Component card template

1. Purpose, one sentence.
2. When to use / when not to use (with the alternative named).
3. Props table with types and defaults, link to the file.
4. States: default, loading, empty, error, disabled; which are mandatory.
5. Accessibility and i18n: aria names, i18n namespaces and keys.
6. Code example and gallery anchor.

### Routing (how agents are made to read it)

- `docs/engineering/rules/30-ui.md` gets one new section "Design system": before any UI task read
  `docs/design-system/README.md`, then only the relevant files. Existing prohibitions stay in
  30-ui; money UI rules that are patterns move to `patterns/money.md` with a pointer left behind.
  30-ui links to design-system, never the reverse, so rules are not duplicated.
- `AGENTS.md`: one line in the pre-code reading list next to `00-foundation.md`, and one new
  Reviewer checklist item: "a new UI component has a card, a registry row and a gallery section;
  a screen has one primary action".
- `.ai/context.md`: one invariant line: UI follows `docs/design-system/`; colors and sizes only
  through `src/design-system`.

## Domain patterns (content summary)

### `patterns/hierarchy.md`

- Visibility scale: primary action > screen title > key amount > list content > secondary actions >
  utility. Typography size and weight per level come from tokens, not chosen per screen.
- One screen = one task; the title answers "what am I doing here".
- Navigation: bottom bar on mobile for 3-5 sections (existing `nav-bars`), back always top-left,
  modals close by swipe or close button.
- "Button -> outcome" map: destructive = red + `AlertDialog`; navigation looks like a link or card;
  mutation looks like a button.
- Audit checklist (used by task 8): two primary actions, clickable non-buttons, unlabeled icons,
  screens without a title, actions named with nouns, empty screens without an action.

### `patterns/money.md`

- Debt colors only through `color.debt.*` tokens; no `color="green"|"red"` literals in money
  components.
- Direction is always expressed in words and color together ("You owe", "You are owed"), never by
  sign or color alone (`OwedStatusText` is the reference).
- One large amount per screen (`Amount` size 6-7, bold); other amounts size 2-3. Currency code
  always next to the number.
- Input only through `AmountInput`; split rows keep fixed control width (moved from 30-ui).
- Forbidden: formatting money outside `Amount`, a balance without currency, changing amount color
  per screen.

### `patterns/groups.md`

- `UserAvatar`, `GroupAvatar`, `UsersRow` (overflow "+N"), `GroupRoleBadge`; avatar sizes are
  component tokens.
- Group card: cover, name, members, balance in one fixed order; interactive cards use
  `interactiveCardStyles`.

### `patterns/states.md`

- Every list or data screen has four states: loading (skeleton, not spinner), empty (`EmptyState`
  with icon, title, one action), error (inline with retry), offline (badge, not a blocking modal).
- New empty screen = new `EmptyState` variant, never new markup.
- Toasts (sonner) only for the result of a user action, never for load errors.

### `patterns/forms.md`

- `TextInput`, `TextArea`, `Select`, `Checkbox`, `RadioGroup`/`RadioCards`, `SegmentedControl`.
  Label above, error below, one primary button per form.
- Modals through the modal router (`docs/architecture/modal-router.md`); destructive actions only
  through `AlertDialog`.
- Mobile first: single column, action buttons at the bottom, full-width controls.

Out of scope for v1: motion, illustrations, landing marketing tone.

## Automation

### ESLint (custom rules in `eslint-rules/`, registered in `eslint.config.js`)

1. `no-raw-colors`: hex/rgb/hsl and `var(--<palette>-N)` in styled template literals and inline
   `style` are errors. Path exceptions: PWA manifest/icon generation, QR, canvas, external formats.
2. `no-palette-theme-keys`: `themeColor('<palette><N>')` is an error with the semantic key
   suggested in the message. Enabled as error immediately after task 2 lands.
3. `no-status-color-literals`: `color="green"|"red"|"gray"` on Radix components inside
   `src/basics/**` money and status components is an error; use `color.debt.*` / `color.status.*`.
4. Restricted imports: native `img` (use `basics/Image`), and any UI library other than Radix
   Themes, styled-components, lucide-react, sonner.
5. Not linted (Reviewer checklist instead): single primary action, title clarity, verb labels.

### Checks inside the existing `frontend-ci` job and `npm run verify:full`

- `tokens:check`: run the generator and fail if `src/design-system/generated/*` differs.
- `tokens:validate`: `tokens.json` parses, every `$type` is known, every alias resolves, no
  unused semantic token.
- `ds:check`: every `docs/design-system/components/*.md` has a matching gallery anchor; every
  export in `src/basics/index.ts` has a row in `components.md`.
- `build:ds-gallery` stays in `verify:full` as today.

Constraint: no new workflow files, no new jobs, no external services. Total added CI time must stay
under about 30 seconds.

## Process (`process.md`)

Adding or changing a component:

1. Search `components.md` first; reuse if anything fits.
2. A configured Radix primitive needs no wrapper; use it directly.
3. ChipIn-specific: `src/basics` (no store) or `src/components` (store allowed); colors only via
   token roles.
4. Add a gallery section, a card, and a registry row in the same PR (CI enforces).
5. A new token is added to `tokens.json` first, then generated, then used.

Changing a rule: a rule lands in the docs and, where possible, in lint in one PR. A rule that exists
only as text is a recommendation, not a law.

Designer onboarding plan (future, recorded here, not executed in v1):

1. Import `tokens.json` into Figma Variables (native DTCG import or a community plugin).
2. Attach the official Radix Themes Figma kit and bind it to ChipIn variables.
3. Redraw ChipIn-specific components from the gallery.
4. Authorize the Figma MCP so agents can read mockups.
5. Decide whether code or Figma is the token master; the format is identical either way.

## Epic: "Design system v1", 8 tasks, one PR each

| # | Task | Outcome | Depends on |
| --- | --- | --- | --- |
| 1 | Tokens: `tokens.json`, generator, `src/design-system`, `tokens:check` and `tokens:validate` | One source for colors and sizes | none |
| 2 | Migrate `themeColor()` to roles, fix hardcoded palette names and status literals, debt colors from tokens, enable rules 2 and 3 as errors | Brand change in one place | 1 |
| 3 | Docs: README, principles, hierarchy, tokens, registry | Agents know what to read | 1 |
| 4 | Patterns: money, groups, states, forms; move money UI rules out of 30-ui | ChipIn-specific rules | 3 |
| 5 | Component cards (~15) with gallery anchors, gallery `patterns` section | Spec for agents and designer | 3 |
| 6 | ESLint rules 1 and 4, `ds:check`, wired into `verify:full` and existing CI | Enforcement | 2, 5 |
| 7 | Routing: AGENTS.md, 30-ui.md, `.ai/context.md`, Reviewer checklist, `process.md` | Agents must read it | 3, 4 |
| 8 | Screen audit against the hierarchy checklist; report for owner approval, then Issues | Answer to "where do I tap" | 3 |

Order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7; task 8 can run in parallel any time after 3. Writers of the
same files never run in parallel.

Follow-ups after the epic (separate Issues, not v1): Figma token export and a trial import,
visual-regression screenshots, motion tokens, Storybook if a designer needs it.

## Testing

- Generator and validators have unit tests (vitest) with a small fixture token file.
- ESLint rules have rule tests (ESLint `RuleTester`) with valid and invalid cases.
- `ds:check` has a test with a fixture docs tree.
- Existing component tests keep passing after the migration; the gallery build stays green.
- Manual check by the owner: only `principles.md` and `patterns/hierarchy.md`.

## Version impact

Tasks 1-7: `none` for user-facing behavior unless the migration changes visible colors (it must
not; debt tokens alias the same Radix scales). Task 8 produces Issues whose fixes carry their own
version impact.
