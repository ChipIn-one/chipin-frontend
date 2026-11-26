# AmountInput

`import { AmountInput } from 'basics';` (named export).

## Purpose

A Radix `TextField` for a money amount that accepts only valid decimal input and limits fraction
digits.

## When to use

- Every money input (expense amount, split rows, settle up).
- Not for non-money numbers: use [`TextInput`](../components.md) from `basics`.
- Not for display: use [Amount](amount.md).

## Props

Source: [`basics/AmountInput.tsx`](../../../apps/app/src/basics/AmountInput.tsx). Plus Radix
`TextField.Root` props except `onChange`, `type` and `inputMode` (the component sets
`type="text"` and `inputMode="decimal"`).

| Prop                | Type                      | Default  | Description                                                                       |
| ------------------- | ------------------------- | -------- | --------------------------------------------------------------------------------- |
| `onChange`          | `(value: string) => void` | required | Called with the parsed string; invalid keystrokes are dropped (no call)           |
| `value`             | `TextField.Root` `value`  | —        | Current string; non-string values are treated as `''` when parsing the next input |
| `maxFractionDigits` | `number \| null`          | `2`      | Fraction digits allowed, passed to `parseAmountInput`                             |
| `placeholder`       | `string`                  | `'0.00'` | Placeholder text                                                                  |
| `className`         | `string`                  | —        | Class on the root                                                                 |

## States

- Default: mandatory.
- Disabled: through Radix `disabled`; optional. Offline blocking goes on the submit button
  (`OnlineOnly`), not on the field.
- Error: n/a inside the component; the form shows the validation message below the field.
- Loading, empty: n/a. An empty value shows the placeholder.

## Accessibility and i18n

- Renders a native `<input type="text" inputmode="decimal">`; mobile keyboards show digits.
- No label of its own: give it a visible `<Text as="label" htmlFor={id}>` and pass the same `id`
  (as `ExpenseAmountFields` does with `common:fields.amount`), or pass `aria-label`.
- i18n: none in the component. The default placeholder `0.00` is a literal; pass a translated
  `placeholder` where the format differs.

Money rules: input only through `AmountInput`; show the currency code next to the field; split
rows keep a fixed control width. Screen rules: patterns/money.md (ChipIn-one/chipin-frontend#490).

## Example

```tsx
import { Text } from '@radix-ui/themes';
import { useId } from 'react';

import { AmountInput } from 'basics';

const id = useId(); // inside the component body

<>
    <Text as="label" htmlFor={id} size="2" weight="bold">
        {t('common:fields.amount')}
    </Text>
    <AmountInput id={id} value={amount} onChange={setAmount} maxFractionDigits={2} />
</>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
