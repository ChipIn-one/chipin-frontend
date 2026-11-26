# Groups: avatars, members, roles and group cards

How people and groups look on every screen. Paths are inside `apps/app/src`; check
[components.md](../components.md) for the full registry.

## Avatars

| What                  | Component                                | Fallback                                                 |
| --------------------- | ---------------------------------------- | -------------------------------------------------------- |
| One user              | `UserAvatar` (`basics`)                  | First letter, else a user icon; a skeleton while loading |
| One group             | `GroupAvatar` (`components/GroupAvatar`) | The group cover, else a users icon                       |
| Several group members | `UsersRow` (`components/UsersRow`)       | Overlapping avatars, then `+N`                           |

- Never draw an avatar with a raw `<img>` or a hand-made circle; a picture goes through these
  components (Radix `Avatar` inside), and other images through `basics/Image`.
- Sizes are the Radix `Avatar` `size` prop. In use today: `1`-`2` in rows and `UsersRow`, `3` in
  debt and member lists, `4` on cards (`GroupCard`, `EmptyState`) and the friend header. There
  are no avatar component tokens yet; pick the size of the same place on another screen.
- `UsersRow` shows at most `max` avatars (default `5`, all callers pass `5`) and one `+N` avatar
  for the rest. Do not list members as a wrapped avatar grid on cards.
- `GroupAvatar` and `UsersRow` pass the name as `alt`. `UserAvatar` takes `alt` from its caller
  (it spreads Radix `Avatar` props); pass the display name.

## Roles

- `GroupRoleBadge` (`basics`) is the only role badge: an amber soft "Owner" badge for the owner,
  nothing for other members. Do not add a "Member" badge.
- The badge sits right after the display name in member rows (members, balances and settings tabs
  of the group page). It only labels; it is not a permission check.

## Group card: fixed order

`GroupCard` ([`components/group-card`](../../../apps/app/src/components/group-card/GroupCard.tsx))
shows one group in this order, left to right, on every screen:

1. Cover: `GroupAvatar`, size `4`.
2. Name (size `3`, bold, truncated) with the member count below it (size `1`, gray).
3. Balance, right-aligned: the net amount through `Amount` with its currency and debt color, a
   `~` prefix when converted, and the direction in words for screen readers
   ([money.md](money.md#direction-in-words-and-color-together)). Settled groups show a gray
   "Settled" badge instead. A second gray badge gives the source currency amount or the number of
   currencies.

Rules:

- Lists of groups render `GroupCard` (through `GroupsCards`, with its loading skeleton
  `GroupsCardsSkeleton`); do not compose a new group row.
- New data on the card goes into the existing slots; do not reorder or add a fourth column.
- The selected group (desktop sidebar) is marked with `aria-current="page"` and
  `data-selected`, not a different card.

## Interactive cards

A card that opens something is a link wrapped around a Radix `Card`:

- Use `InteractiveCard` from `components/interactive-card/InteractiveCard`. It is an unstyled
  `NavButton` (a real link with `to`) with a CSS Module that draws hover, pressed and focus on the
  inner `Card`, which carries `data-interactive-card` (and `data-selected` when selected).
- `InteractiveCard` lands with batch C (ChipIn-one/chipin-frontend#896, PR
  ChipIn-one/chipin-frontend#917) and replaces `interactiveCardLinkStyles` from
  `helpers/interactiveCardStyles.ts`. Until it is on `master`, the code still uses
  `interactiveCardLinkStyles`; do not add new callers of it.
- A whole card is one link. No nested buttons or links inside it; a secondary action goes next
  to the card, not on it.
- Never make a card clickable with `onClick` on a `div` or a `Card` (see
  [principles.md](../principles.md) 4).

## Forbidden

- A member list or avatar stack outside `UsersRow`, or an avatar outside `UserAvatar` /
  `GroupAvatar`.
- A role badge other than `GroupRoleBadge`.
- A group row that is not `GroupCard`, or a `GroupCard` with its slots reordered.
- A clickable card that is not `InteractiveCard` (or, until it lands, `interactiveCardLinkStyles`).
