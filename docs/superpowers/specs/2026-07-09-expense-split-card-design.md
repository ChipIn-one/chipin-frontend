# Expense Split Card Design

## Context

The add expense modal is a core user flow. Split modes currently render their rows, totals, and footers independently, which makes the UI feel inconsistent and allows content height and controls to shift between modes. The new design should make every split mode feel like the same tool with different value semantics.

## Goals

- Give all split modes a shared card structure, row rhythm, and footer.
- Let every participant be included or excluded from the debt, including the payer.
- Keep rows and footer height stable so content does not jump when values change.
- Support direct input and stepper controls for editable split modes.
- Make split validity visible through the total summary and progress bar.
- Preserve the backend sharing mode contracts already used by the modal.

## Non-Goals

- Do not redesign the whole add expense modal.
- Do not change backend API contracts.
- Do not introduce new UI libraries or production dependencies.
- Do not migrate money handling away from frontend `Number` values.

## Chosen Approach

Use shared layout components for the split card while keeping mode-specific calculations in the add expense modal or small mode adapters.

This is preferred over patching each mode separately because it avoids divergent UX and duplicated row/footer styling. It is also safer than a full split-state rewrite because the existing modal state and API payload logic can evolve incrementally.

## Split Card Layout

The split card contains:

1. Header row:
   - left: `How to split`
   - right: `Total: assigned / total`
2. Full-width segmented control:
   - `Equal`
   - `Percent`
   - `Amounts`
   - `Shares`
3. Progress bar:
   - always visible
   - stable height
   - based on active mode progress
4. Participant rows:
   - shared row layout for all modes
   - stable minimum height
   - include toggle, avatar, display name, and right-side value area
5. Footer:
   - divider above footer
   - always shows `Your share` on the left
   - amount on the right

## Total Summary And Progress

The total summary and progress bar show whether the split is complete.

- `Equal`: assigned is the full expense amount when at least one participant is included, otherwise `0`.
- `Percent`: assigned is `amount * totalPercent / 100`.
- `Amounts`: assigned is the sum of included custom amounts.
- `Shares`: assigned is the full expense amount when included share weight total is greater than zero.

Color rules:

- exact or complete: assigned amount and progress use a calm success accent.
- under target: assigned amount and progress use red.
- over target: assigned amount and progress use amber.
- target total remains neutral so the header does not look noisy.
- `Your share` remains neutral because it is informational, not an error state.

## Participant Inclusion

Each participant row has an include toggle. Toggling a participant off keeps the row visible but muted:

- value is treated as zero.
- controls are disabled.
- the participant is excluded from `participantIds`.

The payer can be excluded from the debt. This supports the valid case where a user paid for others but did not participate in the expense.

At least one participant must remain included to submit the expense.

## Mode Behavior

### Equal

- Included participants divide the total equally.
- Toggling participants on or off immediately redistributes the split among included participants.
- The right-side row value is readonly.

### Percent

- Each row has decrement, input, percent suffix, and increment controls.
- Before any manual percent edit, toggling participants redistributes 100% across included participants using integer percentages. The base value is `Math.floor(100 / includedCount)`, and the remainder goes to the first included participant in display order.
- After a manual percent edit, toggling a participant off sets that participant to `0` and leaves other percentages unchanged.
- Re-enabling a participant after manual editing keeps that participant at `0` so the user can set the intended value.
- Submit is valid only when included percentages total 100.

### Amounts

- Each row has decrement, amount input, and increment controls.
- The dollar sign before the input is removed.
- Toggling a participant off sets that participant amount to `0` and leaves other amounts unchanged.
- Re-enabling a participant keeps that participant amount at `0`.
- Submit is valid only when included amounts equal the total expense amount within the existing small money tolerance.

### Shares

- Each row has decrement, numeric input, and increment controls.
- Toggling a participant off sets that participant share weight to `0` and leaves other share weights unchanged.
- Re-enabling a participant defaults that participant share weight to `1`.
- Submit is valid when included share weight total is greater than zero.

## Shared Components

Add or evolve these components near the existing add expense modal components:

- `ExpenseSplitModeControl`
  - owns title, total summary, segmented control, and progress bar.
- `SplitParticipantRow`
  - owns stable row layout, include toggle, avatar/name, disabled styling, and right-side control slot.
- `SplitValueStepperInput`
  - owns the common decrement/input/increment shell for percent, amounts, and shares.
- `SplitSummaryFooter`
  - owns divider plus `Your share` label and amount.

Mode sections should pass values and handlers into these shared components instead of hand-rolling row layout.

## Data Flow

The add expense modal remains responsible for:

- selected split mode.
- included participant IDs.
- percent values.
- amount values.
- share weights.
- dirty state for percent manual edits.
- derived totals, progress, and submit validity.
- API payload creation.

The UI components remain presentational and call handlers from the modal.

## API Payload

`participantIds` includes only participants whose include toggle is on.

Sharing modes:

- `Equal`: `{ type: 'AUTO' }`
- `Percent`: `{ type: 'PERCENTAGE', percentageShares }`
- `Amounts`: `{ type: 'EXACT', customShares }`
- `Shares`: `{ type: 'SHARES', shares }`

Payload share maps should include included participants. Excluded participants should not affect backend calculation.

## Accessibility And UX Details

- Include toggles need accessible labels that identify the participant.
- Stepper buttons need labels that include the amount of change or unit.
- Inputs need stable widths so values do not resize rows.
- Disabled rows should remain readable but visually muted.
- The layout should handle mobile width without text or controls overlapping.

## Verification Plan

Run focused checks after implementation:

- TypeScript: `npx tsc -b`
- ESLint on changed files.
- JSON parse for changed locale files.

Manual QA in the modal:

- Equal redistributes when participants are toggled.
- Percent auto redistributes before manual edits and preserves manual values after edits.
- Amounts starts at `0 / total` and accepts both stepper and input changes.
- Shares accepts both stepper and input changes and produces `SHARES` payload.
- Payer can be excluded while remaining the payer.
- Footer always shows `Your share`.
- Rows do not change height between modes or value edits.
- Progress bar and header summary colors match valid, under, and over states.
