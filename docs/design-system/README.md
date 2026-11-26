# ChipIn design system

One code-first system for every UI change in this repository (the PWA in `apps/app` and the site
in `apps/site`). Code is the source of truth; these docs explain how to use it. Read this file
first, then only the files your task needs.

## Three layers

```
tokens      packages/tokens (tokens.css, src/theme.ts)
   -> components   apps/app/src/basics, apps/app/src/components
      -> docs      docs/design-system/**
```

Each layer uses only the layer below it. Docs never name a value that is not in
`packages/tokens/tokens.css`; new component code uses colors only as `var(--cp-*)`, and Radix `color` props only through
`PROP_COLOR` (legacy
`themeColor()` callers are migrated file by file, see [tokens.md](tokens.md)).

## Files

| File                                           | What it holds                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| [principles.md](principles.md)                 | The seven product principles                                          |
| [patterns/hierarchy.md](patterns/hierarchy.md) | Visibility scale, one screen = one task, navigation, audit list       |
| [tokens.md](tokens.md)                         | How to read and add tokens, what is forbidden and which check bans it |
| [components.md](components.md)                 | Registry of every basic and ChipIn component                          |

Coming later: patterns for money, groups, states and forms (ChipIn-one/chipin-frontend#490) and
cards for ChipIn-specific components (ChipIn-one/chipin-frontend#491).

## If you do X, read Y

- Any UI task: [principles.md](principles.md).
- A new screen, or buttons and navigation on a screen: [patterns/hierarchy.md](patterns/hierarchy.md).
- A color, spacing, radius, font, shadow or z-index: [tokens.md](tokens.md).
- A new component, or you need one: [components.md](components.md) first; reuse before you create.
- Styling a component (Radix props, CSS Modules, styled-components): [tokens.md](tokens.md#what-is-forbidden).
