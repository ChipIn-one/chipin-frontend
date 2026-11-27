# TextInput and TextArea

`import { TextArea, TextInput } from 'basics';` (named exports; types `TextInputValueState`,
`TextAreaValueState`).

## Purpose

A labeled Radix `TextField` (one line) or `TextArea` (several lines) that owns its value, checks
required and length, and shows a validation message below the field.

## When to use

- Every free-text field in a form (display name, group name, notes).
- Not for money: use [AmountInput](amount-input.md).
- Not for a search box: Radix `TextField.Root` with an `aria-label` ([forms.md](../patterns/forms.md#field-set)).

## Props

Source: [`basics/text-input/TextInput.tsx`](../../../apps/app/src/basics/text-input/TextInput.tsx),
[`basics/text-area/TextArea.tsx`](../../../apps/app/src/basics/text-area/TextArea.tsx). Plus Radix
root props except `aria-describedby`, `aria-invalid`, `defaultValue`, `id`, `onChange` and `value`.

| Prop                | Type                                  | Default  | Description                                                                           |
| ------------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `label`             | `ReactNode`                           | required | Visible `<label htmlFor>` above the field; always shown                               |
| `id`                | `string`                              | `useId`  | Field id; also the base of the description and error ids                              |
| `description`       | `ReactNode`                           | —        | Help text: under the label (`TextInput`), beside it (`TextArea`); `${id}-description` |
| `initialValue`      | `string`                              | `''`     | Starting value; the component owns the value after that                               |
| `isRequired`        | `boolean`                             | `false`  | Sets `required`; a blank (whitespace) value is invalid                                |
| `maxLength`         | `number`                              | —        | Limit; shows a `n / max` counter in the label row                                     |
| `validationMessage` | `ReactNode`                           | —        | Shown below the field when the built-in check fails                                   |
| `onValueChange`     | `(state: { value, isValid }) => void` | —        | Every change, with its validity                                                       |
| `onValueCommit`     | `(value: string) => void`             | —        | On blur, only when the value is valid                                                 |

## States

- Default: mandatory.
- Error: `aria-invalid` follows validity from the first render. `validationMessage` shows only
  when the built-in check (`isRequired` or `maxLength`) fails, after the field is first blurred:
  below the field (`${id}-error`, `size="2"`, `PROP_COLOR.danger`, `role="alert"`); it goes away
  once the value is valid. There is no prop for an outside error.
- Disabled: through Radix `disabled`; optional.
- Loading, empty: n/a.

## Accessibility and i18n

- The label is never replaced by the error.
- `aria-describedby` lists the description id and the error id, only those shown; none: no
  attribute.
- i18n: none in the component; pass translated `label`, `description` and `validationMessage`.

## Example

```tsx
import { TextInput } from 'basics';

<TextInput
    label={t('common:fields.displayName')}
    initialValue={user?.displayName ?? ''}
    isRequired
    maxLength={DISPLAY_NAME_MAX_LENGTH}
    validationMessage={t('account.displayNameRequired')}
    onValueCommit={onDisplayNameCommit}
/>;
```
