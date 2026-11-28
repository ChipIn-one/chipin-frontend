# ChipIn design system

One code-first system for every UI change in this repository (the PWA in `apps/app` and the site
in `apps/site`). Code is the source of truth (for tokens and built components; an owner-approved
mockup is the spec for screen layout, content and states, D35); these docs explain how to use it.
Read this file first, then only the files your task needs.

## Three layers

```
tokens      packages/tokens (tokens.css, src/theme.ts)
   -> components   apps/app/src/basics, apps/app/src/components
      -> docs      docs/design-system/**
```

Each layer uses only the layer below it. Docs never name a value that is not in
`packages/tokens/tokens.css`; new component code uses colors only as `var(--cp-*)`, and Radix `color` props only through
`PROP_COLOR` (see [tokens.md](tokens.md)).

## Files

| File                                           | What it holds                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| [principles.md](principles.md)                 | The seven product principles                                          |
| [patterns/hierarchy.md](patterns/hierarchy.md) | Visibility scale, one screen = one task, navigation, audit list       |
| [patterns/money.md](patterns/money.md)         | Amounts, debt colors and direction, one key amount, amount input      |
| [patterns/groups.md](patterns/groups.md)       | Avatars, `UsersRow`, role badge, group card order, interactive cards  |
| [patterns/states.md](patterns/states.md)       | Loading, empty, error and offline states; when to toast               |
| [patterns/forms.md](patterns/forms.md)         | Field set, labels and errors, buttons, modals, destructive confirms   |
| [tokens.md](tokens.md)                         | How to read and add tokens, what is forbidden and which check bans it |
| [components.md](components.md)                 | Registry of every basic and ChipIn component                          |
| [components/](components/)                     | Cards for ChipIn-specific components (props, states, a11y, example)   |
| [process.md](process.md)                       | Adding or changing a component, UI PR checklist, rule changes         |
| [screens.md](screens.md)                       | Every screen, modal and state, how to reach it, user flows (manifest) |

## Design artifacts

Mockups are built in Claude Design on the
[ChipIn design system artifact v5](https://claude.ai/artifact/JqkfMT6zk9RvEBKVMGG6qw). Its
_Design artifacts_ section lists every design artifact and which one is current; the
[v4 artifact](https://claude.ai/artifact/AtzC72Gji4PkXbfpt8Qwov) is superseded. The flow is in
[process.md §Mockups and design review](process.md#mockups-and-design-review).

## If you do X, read Y

- Any UI task: [principles.md](principles.md).
- A new screen, or buttons and navigation on a screen: [patterns/hierarchy.md](patterns/hierarchy.md).
- Showing or entering an amount, a balance or a debt: [patterns/money.md](patterns/money.md).
- Members, avatars, roles, group cards or any clickable card: [patterns/groups.md](patterns/groups.md).
- A screen or block that loads data, or a toast: [patterns/states.md](patterns/states.md).
- A form, a modal or a destructive action: [patterns/forms.md](patterns/forms.md).
- A color, spacing, radius, font, shadow or z-index: [tokens.md](tokens.md).
- A new component, or you need one: [components.md](components.md) first; reuse before you create.
- A new route, page, modal or reachable state: add its rows to [screens.md](screens.md) and
  [screens.manifest.json](screens.manifest.json).
- Styling a component (Radix props, CSS Modules, styled-components): [tokens.md](tokens.md#what-is-forbidden).
