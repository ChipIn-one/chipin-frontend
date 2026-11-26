# Forms: fields, buttons, modals and confirmations

How ChipIn takes input. Paths are inside `apps/app/src`; money fields follow
[money.md](money.md#input-goes-through-amountinput).

## Field set

Use these and nothing hand-made:

| Input                 | Component                                                                |
| --------------------- | ------------------------------------------------------------------------ |
| Text, one line        | `TextInput` (`basics`)                                                   |
| Text, several lines   | `TextArea` (`basics`)                                                    |
| Money                 | `AmountInput` (`basics`)                                                 |
| One of a short list   | `SegmentedControl` (`basics/SegmentedControl`), 2-4 options              |
| One of a few, rich    | `RadioCards` (`basics`), options with a title and a description          |
| One of a long list    | `Select` (`basics/Select`); searchable: `SearchSelect`, `CurrencySelect` |
| Yes/no, several picks | Radix `Checkbox` (as in the expense participants list)                   |
| On/off setting        | Radix `Switch` (settings page, group settings)                           |

- Radix `RadioGroup` is allowed for a plain vertical choice; there is no wrapper yet.
- A field that none of these covers: extend the nearest basic, then add it to
  [components.md](../components.md).

## Label above, error below

- Every field has a visible label above it, tied to the control (`TextInput`/`TextArea` render a
  `<label htmlFor>` from their `label` prop). A placeholder is never the label.
- Help text goes in `description`, under the label; it is linked by `aria-describedby`.
- Validation text is shown after the field is touched (on blur), in red with `role="alert"`, and
  the control gets `aria-invalid`. It comes from i18n.
- Target position: the message sits below the field. Today `TextInput` and `TextArea` show it in
  the label row, in place of the label; moving it is a change to those two basics, not to each
  form. Forms never draw their own error line.
- Required fields pass `isRequired` to the basic, which sets `required` and checks for an empty
  value.

## Buttons

- One primary button per form: Radix `Button` `variant="solid"`, the verb of the result
  ("Create group", "Save", "Settle up"). Cancel is `variant="soft"` `color="gray"`.
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
  new one next to them in `components/modals`.
- The action button says what happens ("Remove group"), with `actionColor="red"`
  (leave and kick use `orange` today, [hierarchy.md](hierarchy.md#button---outcome-map)). Radix
  `AlertDialog` focuses Cancel on open; keep it that way.

## Mobile first

- One column. Fields stack full width; two fields side by side only from `sm` up, through Radix
  responsive props (`{ initial, sm }`).
- On phones (below `sm`) `BaseModal` fills the screen, the header and footer are sticky, and
  `OverlayFooter` puts the buttons at the bottom in a `1fr 2fr` grid (cancel, then the wider
  primary) above the safe area. A single button takes the full width.
- Controls use Radix `size="3"` in modal forms, so the tap target stays large.
- The keyboard type matches the data: `inputMode="decimal"` for money comes from `AmountInput`.

## Forbidden

- A raw `<input>`, `<select>`, `<textarea>` or an unlabeled Radix `TextField` in product UI.
- Two solid buttons in one form, or a primary button named with a noun.
- A second `BaseModal` or `Dialog.Root` opened from inside a modal step.
- A destructive action without `AlertDialog`.
- Side-by-side fields on phones.
