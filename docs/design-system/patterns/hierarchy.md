# Hierarchy: where to tap and what is responsible for what

Applies [principles.md](../principles.md) 3 and 4 to a whole screen.

## Visibility scale

From most to least visible:

1. Primary action
2. Screen title
3. Key amount
4. List content
5. Secondary actions
6. Utility

Typography size and weight per level come from the token scale (`--cp-font-size-*`,
`--cp-font-weight-*`, see [tokens.md](../tokens.md)) through Radix `size`/`weight` props, not
chosen per screen.

## One screen = one task

Every screen does one job. Its title answers "what am I doing here".

## Navigation

- Mobile: a bottom bar for 3-5 sections. Today it is
  [`MobileNavBar`](../../../apps/app/src/components/nav-bars/MobileNavBar.tsx) (four sections from
  `getNavElements` in `nav-bars/constants.ts`, with the add-expense button in the middle). Desktop:
  `DesktopSidebar` and `HeaderNav` from the same folder.
- Back is always top-left: `BackButton` from `basics` (goes back in history) or
  [`PageBreadcrumb`](../../../apps/app/src/components/page-breadcrumb/PageBreadcrumb.tsx) (a link
  to the parent page).
- Modals close with the close button in their header (`BaseModal`, `OverlayHeader`), which also
  holds the back control of multi-step modals.

## Button -> outcome map

| Outcome                          | Looks like                                                          |
| -------------------------------- | ------------------------------------------------------------------- |
| Destructive (delete, remove)     | Red action inside an `AlertDialog` (`BaseAlertDialog`)              |
| Navigation (opens a page)        | A link or a card ([interactive cards](groups.md#interactive-cards)) |
| Mutation (creates, saves, sends) | A button                                                            |

`BaseAlertDialog` ([`components/modals/base-alert-dialog`](../../../apps/app/src/components/modals/base-alert-dialog/BaseAlertDialog.tsx))
is the confirmation for every destructive action: the remove/delete dialogs pass
`actionColor="red"`. Leave-group and kick-member dialogs use `orange` today.

## Audit checklist

Used by the screen audit. A screen fails if it has any of these:

- [ ] two primary actions
- [ ] clickable non-buttons
- [ ] unlabeled icons
- [ ] screens without a title
- [ ] actions named with nouns
- [ ] empty screens without an action
