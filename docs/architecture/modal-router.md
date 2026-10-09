# Modal Router — frontend architecture

Issue: ChipIn-one/chipin-frontend#314. Integration target: `dev`.

## Ownership

- `BaseModal` owns one Radix Dialog.Root, content, overlay, close and the optional Back control immediately before Dialog.Title.
- `ModalRouter` provides a typed, local route registry and `push`, `replace`, `back`, `close` navigation. It is not an app-global Zustand store and is independent of React Router URLs.
- Every step renders **content** within a stable BaseModal. A step never returns a second BaseModal or Dialog.Root.
- Feature components own domain selection and form drafts; the router only owns step identity and navigation history.

## Lifecycle and accessibility

- Back appears only if history is non-empty, and returns to the previous step without closing the dialog.
- Close, X, outside interaction (where permitted) and Escape close the complete flow and reset history.
- The active route supplies a translated title and accessible description; after a route change, focus moves synchronously to the new title before paint.
- No CSS hiding tricks, timers, multiple overlapping Dialog.Root instances, custom global z-index scales or global scroll-lock state.
- A single-step BaseModal remains supported unchanged. Standalone Friend Settle Up uses a BaseModal wrapping SettlementFormContent.

## First adoption: group settlements

- Route `choose` renders the debt selection; `payment` renders the selected settlement form.
- Selecting a debt navigates forward without closing the Dialog.Root. Back returns to `choose` and leaves the dialog open.
- On successful settlement, the whole flow closes. API errors retain the payment step and its editable state, with a toast.
- The selected debt is kept temporarily if the balance list refreshes and removes that entry while the settlement completes. A new opening resets selection.

## Validation gate

- Run co-located ModalRouter tests, SettleUpModal group and friend tests, BaseModal tests, then `npm run verify:full`.
- Visually verify DOM node identity, focus, Escape, overlay, scroll lock and mobile `100dvh` behavior in a real browser before merge.
- Domain contracts such as `SET-003` remain unchanged; this is a frontend navigation and presentation refactor.
