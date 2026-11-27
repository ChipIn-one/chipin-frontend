# Forms: fields, buttons, modals and confirmations

How ChipIn takes input. Paths are inside `apps/app/src`; money fields follow
[money.md](money.md#input-goes-through-amountinput). Component cards: [TextInput](../components/text-input.md), [AmountInput](../components/amount-input.md), [Select](../components/select.md), [SegmentedControl](../components/segmented-control.md), [Dropdown](../components/dropdown.md).

## Field set

Use these; a new field type is added here first:

| Input                 | Component                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Text, one line        | `TextInput` (`basics`)                                                                                                              |
| Text, several lines   | `TextArea` (`basics`)                                                                                                               |
| Money                 | `AmountInput` (`basics`)                                                                                                            |
| One of a short list   | `SegmentedControl` (`basics/SegmentedControl`)                                                                                      |
| One of a few, rich    | `RadioCards` (`basics`), options with a title and a description                                                                     |
| One of a long list    | `Select` (`basics/Select`); searchable: `SearchSelect` (`components/search-select`), `CurrencySelect` (`components/CurrencySelect`) |
| Search box            | Radix `TextField.Root` with a search icon slot and a translated `aria-label` (`GroupsCards`, `SearchSelect`)                        |
| Date                  | Radix `TextField.Root` with a visible label (`ExpenseDateField`)                                                                    |
| Yes/no, several picks | Radix `Checkbox` (as in the expense participants list)                                                                              |
| On/off setting        | Radix `Switch` (settings page, group settings)                                                                                      |

- A field that none of these covers: extend the nearest basic, then add it to
  [components.md](../components.md).

## Label above, error below

- Every field has a visible label above it, tied to the control (`TextInput`/`TextArea` render a
  `<label htmlFor>` from their `label` prop). A placeholder is never the label. A search box is
  the one exception: its icon and `aria-label` name it.
- Help text goes in `description` (under the label in `TextInput`, beside it in `TextArea`); it is
  linked by `aria-describedby`.
- The control's `aria-invalid` follows its validity from the first render. The validation text
  (only when `validationMessage` is passed) shows after the field is touched (on blur), below the
  field, in `PROP_COLOR.danger` with `role="alert"`. It comes from i18n.
- The label stays; the message never replaces it. `aria-describedby` lists the description and the
  message ids, only those shown (`TextInput`, `TextArea`, `SettlementAmountField`,
  `ExpenseAmountFields`).
- `ExpenseAmountFields` shows the expense's "amount greater than zero" blocker below the amount
  field from the first render, as the form-level blocker message did (KB EXP-064: one visible
  explanation while save is disabled); `ExpenseButtons` leaves that blocker out of its form-level
  status, which keeps every other blocker.
- `SettlementAmountField` passes the literal `red` and has no `role="alert"`; fix when touched.

- Required fields pass `isRequired` to the basic, which sets `required` and checks for an empty
  value.

Today the expense description field (`expense-amount-fields`) has only a placeholder and an
`aria-label`, no visible label, and `FriendsSearchBar` (`pages/friends-page`) has no `aria-label`,
only a placeholder; fix them when touched.

## Buttons

- One primary button per form: Radix `Button` `variant="solid"`, the verb of the result
  ("Create group", "Save", "Settle up"). Cancel is `variant="soft"` with
  `color={PROP_COLOR.neutral}` (code today passes the literal `"gray"`).
  [principles.md](../principles.md) 3 applies inside modals too.
- The primary button shows progress with `loading` and is `disabled` while the form is invalid or
  saving. Do not hide it.
- Online-only submits are wrapped in `OnlineOnly` ([states.md](states.md#offline)).
- After a failed submit the form stays open with the user's input; the result goes to a toast
  ([states.md](states.md#toasts)).

## Modals

- A form in a dialog is `BaseModal` with `OverlayBody` for the fields and `OverlayFooter` for the
  buttons (`components/modals`). `OverlayFooter` takes `cancelAction` and `primaryAction`.
- A flow of several steps uses `ModalRouter` inside one `BaseModal`: each step is content, never a
  second dialog. Rules: [`docs/architecture/modal-router.md`](../../architecture/modal-router.md).
- Every dialog has a translated title and description: `BaseModal` requires `accessibleDescription`
  and renders `Dialog.Title`/`Dialog.Description`.
- Close is the header close button, Escape or an outside click (where permitted); back inside a
  flow is the header back control (see [hierarchy.md](hierarchy.md#navigation)).

## Destructive actions: `AlertDialog`

- Delete, remove, leave and kick are confirmed in `BaseAlertDialog` (Radix `AlertDialog`), never
  done straight from a button and never in a plain `Dialog`.
- Use a ready one (`RemoveGroupAlertDialog`, `RemoveFriendAlertDialog`,
  `RemoveLedgerEntryAlertDialog`, `LeaveGroupAlertDialog`, `KickGroupMemberAlertDialog`) or add a
  new one on `BaseAlertDialog`. Most live in `components/modals`; `useSignOutConfirm`,
  `AccountSwitchDialog` (`pages/oauth-callback-page`) and `OutboxItemRow` (`features/offline-queue`)
  use it in place.
- The action button says what happens ("Remove group"), with `actionColor={PROP_COLOR.danger}`
  (code today passes the literal `"red"`; leave and kick use `orange`, which has no role yet, see
  [hierarchy.md](hierarchy.md#button---outcome-map)). Radix
  `AlertDialog` focuses Cancel on open; keep it that way.

## Mobile first

- One column. Fields stack full width; two fields side by side only from `sm` up, through Radix
  responsive props (`{ initial, sm }`). The one pair allowed side by side on phones is an amount
  and its currency ([money.md](money.md#input-goes-through-amountinput)).
- On phones (below `sm`) `BaseModal` fills the screen, the header and footer are sticky, and
  `OverlayFooter` puts the buttons at the bottom in a `1fr 2fr` grid (cancel, then the wider
  primary) above the safe area. A single button takes the full width.
- Controls use Radix `size="3"` in modal forms, so the tap target stays large.
- The keyboard type matches the data: `inputMode="decimal"` for money comes from `AmountInput`.

## Forbidden

- A raw `<input>`, `<select>` or `<textarea>` in product UI, or a Radix `TextField` without a
  visible label (search boxes aside).
- Two solid buttons in one form, or a primary button named with a noun.
- A second `BaseModal` or `Dialog.Root` opened from inside a modal step.
- A destructive action without `AlertDialog`.
- Side-by-side fields on phones (amount + currency aside).
