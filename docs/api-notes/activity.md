# Activity API client notes

Last reviewed: 2026-09

The ChipIn knowledge base is the authority for activity semantics. This page records only
frontend/API-boundary handling needed to implement those requirements without copying the
specification. Resolve the canonical sources from:

- `ChipIn-one/chipin-knowledge-base@main/common/glossary.md`
- `ChipIn-one/chipin-knowledge-base@main/common/specs/activity.md`
- `ChipIn-one/chipin-knowledge-base@main/common/specs/api/README.md`

## Client boundary rules

- **ACT-004 / ACT-008 — decimal money:** activity money fields such as `amount` and
  `shareAmount` are decimal strings at the HTTP boundary. Preserve the decimal representation
  and route it through the frontend money helpers; do not coerce wire amounts with `Number()`
  or `parseFloat()`.
- **ACT-002 — event ordering and time:** `createdAt` is Unix seconds. `seq` is the backend
  Long ordering key; preserve exact integer/order semantics rather than deriving it from a
  timestamp or passing it through a lossy numeric conversion.
- **ACT-007 — missing metadata:** `metadata` may be `null`. Render the event from `action`
  when metadata is unavailable instead of dropping the event or throwing.
- **ACT-004 / ACT-007 — metadata narrowing:** when metadata exists, narrow by
  `metadata.type` before reading variant fields. Do not rely on an unchecked action-based cast.
- **ACT-021 — preview identity:** preview items are `{ parent, lastEvent }`. Use `parent`
  for list identity/key and ordering, and use `lastEvent` for current display values.
- **ACT-008 — split representation:** `sharingMode` and calculated `shares` are independent
  snapshot data. Do not infer one from the other.
- **ACT-023 — cursor ownership:** keep continuation state isolated per activity feed. Dashboard
  preview requests omit a cursor, and continuation must pass only the cursor owned by the
  corresponding user-preview feed. ACT-023 remains the canonical source for feed semantics.
- **ACT-022 — preview filtering:** treat preview responses as authoritative. Client-side merge
  or fallback logic must not synthesize transfer chains or reversed chains that the backend
  omitted. ACT-022 remains the canonical source for filtering semantics.

## Current implementation deviation

As of 2026-09, existing activity types still model `seq` and activity money fields as JavaScript
`number`, and existing pagination coverage accepts cursor `0`. Do not copy those shapes into
new activity code. Reconcile them in a separate behavior/API task against ACT-002, ACT-004,
ACT-008 and ACT-024; issue #189 intentionally does not change runtime behavior or public/store
types.
