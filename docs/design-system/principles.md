# Product principles

The seven principles every ChipIn screen follows. The rest of `docs/design-system/` applies them.

1. **Mobile first.** Design for one-handed phone use. Tablet and desktop adapt through Radix
   responsive props (`{ initial, sm, md }`) and must stay comfortable, but they never drive
   simplifications.

2. **Fast debt entry.** The path "open, enter amount, pick people, save" has the minimum number
   of taps. Any new step in that flow needs a justification in the PR.

3. **Explicit action hierarchy.** One primary action per screen: a Radix `Button` with
   `variant="solid"` (the Radix default) in the accent color. Everything else is secondary
   (`soft`/`outline`) or tertiary (`ghost`). The floating "add expense" button
   ([`AddExpenseButton`](../../apps/app/src/components/AddExpenseButton.tsx)) is the only global
   primary. Two solid buttons on one screen is a review blocker.

4. **Clarity.** Interactive things look interactive: buttons are buttons; cards that open
   something use `interactiveCardLinkStyles` from
   [`helpers/interactiveCardStyles.ts`](../../apps/app/src/helpers/interactiveCardStyles.ts) with
   hover and focus states; no clickable `div`/`span`. Icon-only controls only for universally known
   actions (close, back, add), and they still get an `aria-label`. Action labels are verbs
   ("Add expense", not "Expense").

5. **Onboarding lives in empty states.** A screen without data explains what it is and offers
   one action. [`DashboardOnboarding`](../../apps/app/src/components/dashboard-onboarding/DashboardOnboarding.tsx)
   and [`InviteOnboarding`](../../apps/app/src/components/invite-onboarding/InviteOnboarding.tsx)
   are the reference implementations; `EmptyState` in `basics` is the building block.

6. **Radix first, invent nothing.** Use Radix Themes primitives and props before any custom
   styling. Search [components.md](components.md) before creating a component.

7. **Accessibility and i18n by default.** Native semantics, visible focus, translated names,
   money through `Amount` (`basics/numbers`).
