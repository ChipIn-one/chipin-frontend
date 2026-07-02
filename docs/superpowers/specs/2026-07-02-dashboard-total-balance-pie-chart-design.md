# Dashboard Total Balance Pie Chart Design

## Goal

Add a compact native SVG pie/donut chart to the right side of the dashboard total balance card.
The chart visualizes the existing dashboard balance entries without replacing the current
`Owed to you` and `You owe` cards below it.

## Scope

- Update the dashboard total balance card only.
- Preserve the existing summary debt cards below the total balance card.
- Use native SVG and styled-components for chart rendering and initial animation.
- Use Radix Themes `Tooltip` to show each segment amount.
- Do not add new dependencies.
- Do not change API contracts, stores, routing, or financial calculations.

## Architecture

`DashboardSummary` already reads `owedEntries` and `oweEntries` from `useDashboardStore`.
It will pass those arrays to `TotalBalanceCard`.

`TotalBalanceCard` will remain responsible for the card layout. It will render the current
total balance copy on the left and a new local chart component on the right when non-loading
entries exist.

A new component near the existing summary cards, `DebtPieChart.tsx`, will own the SVG geometry,
segment color assignment, tooltip wrapping, and init animation. Keeping the chart separate
prevents SVG math and animation details from bloating `TotalBalanceCard`.

## Data Flow

Input entries:

- `owedEntries`: positive `BalanceEntry.netBalance` values, displayed as green segments.
- `oweEntries`: negative `BalanceEntry.netBalance` values, displayed by absolute value as
  orange/red segments.

The chart will derive display segments from the existing frontend values only. It will not
convert currencies or compute totals beyond summing absolute segment sizes for proportions.
Backend/store totals remain the source of truth for the total balance text.

## UI Behavior

The total balance card layout becomes a responsive horizontal layout:

- Left: existing title, `DebtAmount`, and subtitle.
- Right: compact donut SVG.

The chart has no right-side text legend. Segment amounts appear only via Radix tooltip. Tooltip
content uses the existing `Amount` component so formatting stays consistent with the rest of the
app.

If there are no owed or owe entries, the chart is omitted. While loading, the card keeps its
existing skeleton behavior and avoids rendering misleading chart values.

## Visual Details

The chart uses a donut style, matching the reference more closely than a solid pie while keeping
the requested native SVG implementation. Green segments represent `owedToYou`; orange/tomato/red
segments represent `youOwe`.

Segments animate on initial mount with SVG stroke dash animation and a small stagger. The
animation is decorative only; the final geometry is deterministic from the balance entries.

## Accessibility And Interaction

Each segment will be wrapped in a Radix `Tooltip` trigger. The SVG will expose a concise label for
the chart, and each segment will have an accessible label that includes the balance direction,
currency, and amount.

## Testing And Verification

Relevant verification after implementation:

- Run `npm run typecheck`.
- Run `npm run lint` if style or import ordering changes are non-trivial.
- Run `npm run verify` if the implementation touches broader behavior than the planned dashboard
  card/chart changes.

Manual review should confirm:

- The chart appears on the dashboard total balance card, aligned to the right.
- Existing `Owed to you` and `You owe` cards remain visible below.
- Green segments correspond to `owedEntries`; orange/red segments correspond to `oweEntries`.
- Tooltips show correctly formatted amounts.
- No legend or right-side text appears next to the chart.
