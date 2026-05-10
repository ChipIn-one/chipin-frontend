# AGENTS.md

## Project Snapshot

- Stack: `React 19` + `TypeScript` + `Vite` (`@vitejs/plugin-react-swc`).
- Routing: `react-router-dom` with route guards in `src/features`.
- State: `zustand` stores in `src/store`.
- API: centralized `axios` client in `src/api/chipin.ts`.
- Persistence: `Dexie` (`src/store/IDB`) for auth token and offline-first local data.
- UI: `@radix-ui/themes` as primary UI system.
- i18n: `i18next` (`en`, `ru`) in `src/i18n`.
- PWA: `vite-plugin-pwa`.

## Directory Roles

- `src/root.tsx`: app bootstrap (Sentry, ThemeProvider, analytics, global CSS).
- `src/main.tsx`: app shell composition (router, layout, toaster, global hooks).
- `src/basics/*`: **atomic primitives** — single-responsibility, no store access, no API calls; reusable across any domain.
- `src/components/*`: **composite UI blocks** — may read from stores or combine multiple `basics`; domain-adjacent but not tied to one feature.
- `src/features/*`: **self-contained domain modules** — routing guards, domain-specific sub-components, and feature-scoped hooks; not reusable outside their domain.
- `src/pages/*`: **route-level screens** — assemble components and features; contain minimal logic; delegate to stores and hooks.
- `src/hooks/*`: cross-page side effects and app lifecycle hooks.
- `src/store/*`: global client state + async actions.
- `src/api/*`: HTTP transport and backend contracts.
- `src/helpers/*`: pure utilities (env/url/errors/time/...).
- `src/constants/*`: app constants, route map, messages, env config.
- `src/types/*`: global TypeScript ambient declarations and module augmentations (`global.d.ts`, `styled.d.ts`, etc.).

## UI System Rules

- Prefer `@radix-ui/themes` components for all layout and UI composition by default.
- If a layout, spacing, color, size, alignment, or variant can be expressed via native Radix props, always use the Radix API first.
- For spacing and layout parameters such as `gap`, `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, `mt`, `mb`, `align`, `justify`, `width`, `height`, and similar props, use the native Radix API on `Box`, `Flex`, `Grid`, `Container`, `Text`, and related primitives whenever possible.
- For page/content width constraints, prefer Radix `Container` with appropriate size props over hardcoded fixed dimensions like `maxWidth="900px"` on layout primitives (for example on `Flex`).
- Do **not** introduce routine CSS classes such as `.this_block`, `.header_row`, `.content_wrapper`, etc. for standard component layout.
- `styled-components` is allowed only in exceptional cases:
    - when the requested UI cannot be implemented cleanly with Radix primitives and props alone;
    - when a narrowly scoped override is required by a hard UI/product requirement.
- Do **not** override Radix styles or introduce custom CSS/styled wrappers unless there is a strict necessity that cannot be solved by Radix composition/props.
- Do **not** create routine wrappers such as `styled(Flex)`, `styled(Box)`, `styled(Grid)`, `styled(Text)`, etc. for standard layout or spacing; use the Radix primitives directly in JSX.
- When `styled-components` are necessary, use clear, semantic component naming and keep the styling narrowly scoped.
- Text content that needs truncation should be rendered with the Radix `Text` component using the `truncate` prop instead of custom CSS truncation wrappers.
- Do not introduce custom styled wrappers if the same result is possible with Radix props/composition.
- Do **not** use inline styles (`style={...}`) on any React component — no exceptions. If no Radix prop covers the required CSS property, create a narrowly scoped `styled-component` instead.
- Prefer Radix props, theme tokens, and narrowly scoped styled overrides instead of inline styles.
- `flexShrink`, `flexGrow`, `flexBasis` are available as direct Radix props on all layout components (`Box`, `Flex`, `Grid`, `Container`, `Section`); use them in JSX instead of CSS.
- `overflow`, `overflowX`, `overflowY` are Radix props on all layout components; use them as JSX props instead of CSS overflow rules.
- `position`, `top`, `right`, `bottom`, `left`, `inset` are Radix props on all layout components; use them as JSX props instead of CSS.
- Grid child placement props (`gridArea`, `gridColumn`, `gridColumnStart`, `gridColumnEnd`, `gridRow`, `gridRowStart`, `gridRowEnd`) are Radix props available on all layout components when placed inside a `Grid`.
- Width/height string values such as `"100%"`, `"max-content"`, `"var(--space-8)"` are accepted directly by `width`, `minWidth`, `maxWidth`, `height`, `minHeight`, `maxHeight` props on `Box`, `Flex`, `Grid`, `Container`, `Section`; prefer them over styled wrappers.
- For interactive components that lack a `width` prop (e.g. `Button`, `IconButton`), wrap them in `<Box width="...">` rather than creating `styled(Button)` solely for width.
- Use `asChild` when a Radix component needs to render as a different HTML element while keeping Radix styles and behavior (e.g. `<Flex asChild><label>`). Do not add a wrapper element; merge via `asChild` instead.
- For hyperlinks, always use the Radix `Link` component instead of a bare `<a>` tag or a custom `styled.a` wrapper. Use its `color`, `size`, `weight`, `underline`, and `highContrast` props to control appearance. Only fall back to a custom styled wrapper when Radix `Link` props cannot express the required style.
- When building typed wrapper components around Radix components, use `ComponentProps<typeof RadixComponent>['propName']` to extract prop types instead of re-declaring them manually.

## Layering and z-index Rules

- Treat Radix portal stacking as the default layering system for dialogs, popovers, dropdowns, tooltips, sheets, and other floating UI.
- Do **not** introduce custom `z-index` scales or arbitrary high values. Avoid `z-index` values other than `auto`, `0`, or in rare cases `-1`.
- If elements must stack above each other, render them through portals instead of trying to force order with `z-index`.
- A non-default `z-index` is allowed only as a documented exception when portal composition cannot solve the issue; keep it narrowly scoped and explain the reason in code.

## Radix Color Scale Semantics

Radix Colors uses a 12-step scale per hue. Each step has a defined semantic purpose — always pick the step that matches the use case, not just the shade you like visually.

| Step | Use case                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 1    | App background                                                                                             |
| 2    | Subtle background (cards, code blocks, sidebars, canvas)                                                   |
| 3    | UI element background — normal state                                                                       |
| 4    | UI element background — hover state                                                                        |
| 5    | UI element background — active/selected state                                                              |
| 6    | Subtle border on **non-interactive** components (headers, cards, separators, sidebars, alerts)             |
| 7    | Border on **interactive** components (inputs, buttons) — normal state                                      |
| 8    | Border on **interactive** components — hover state; focus rings                                            |
| 9    | Solid background — normal state (highest chroma; also used for overlays, accent borders, coloured shadows) |
| 10   | Solid background — hover state                                                                             |
| 11   | Low-contrast text                                                                                          |
| 12   | High-contrast text                                                                                         |

**Rules derived from the scale:**

- Never use a **background step (1–5)** for a border CSS property. Borders must use steps 6–8.
- Never use a **border step (6–8)** for a background or text CSS property.
- Never use a **text step (11–12)** for a background or border CSS property.
- Static non-interactive containers (headers, sidebars, cards) → border step **6**.
- Interactive components (inputs, buttons) → border step **7** (normal) / **8** (hover/focus).
- Solid-fill backgrounds for components, overlays, badges → steps **9–10**.
- Most step 9 colors use white foreground text; `Sky`, `Mint`, `Lime`, `Yellow`, `Amber` need **dark** foreground text on steps 9–10.

**Semantic scale pairings (Western conventions):**

- Error: `red`, `ruby`, `tomato`, `crimson`
- Success: `green`, `teal`, `jade`, `grass`, `mint`
- Warning: `yellow`, `amber`, `orange`
- Info: `blue`, `indigo`, `sky`, `cyan`

## styled-components Color and Spacing Rules

> These rules apply only when `styled-components` usage has already been justified as an exception.

- **Colors** must use theme tokens and a single selector helper: `themeColor('indigo2')`.
    - Never use raw hex colors (`#...`) inside `styled-components` templates.
    - Never access Radix color tokens via CSS variables (`var(--indigo-2)`) inside styled-components templates.
    - All color palette entries are available in both light and dark variants via `ThemeProvider` (see `src/constants/styled-themes.ts`).
    - Use `themeColor('token')` from `src/helpers/colors.ts` in styled templates for consistency and readability.
    - If a needed color token does not exist yet, extend the theme mapping/helper instead of hardcoding a hex fallback.
    - In components, reference palette token names directly (`green8`, `gray11`, etc.); light/dark switching is handled by `lightThemeStyled`/`darkThemeStyled` automatically.
    - Always choose the token step that matches its semantic role per the **Radix Color Scale Semantics** table above (e.g. `gray6` for a subtle non-interactive border, `gray7` for an interactive input border, `gray11` for low-contrast text).
- **Spacing props** (`padding`, `margin` and their directional variants): prefer native Radix props (`p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, etc.) passed directly in JSX.
    - Do **not** hardcode `padding: var(--space-4)` in the CSS template when a `p="4"` JSX prop achieves the same result.
    - `var(--space-*)` is only acceptable for CSS properties that have **no** Radix prop equivalent — such as `inset-inline`, `inset-block`, `transform`, `translate`, `clip-path`, `gap` on non-layout elements, and similar CSS properties without a direct Radix layout prop.
    - Note: `position`, `top`, `right`, `bottom`, `left`, `inset`, `overflow`, `overflowX`, `overflowY` **are** Radix props on all layout components (`Box`, `Flex`, `Grid`, `Container`, `Section`); always use them as JSX props instead of CSS rules in styled templates.
- **Radix primitives**: do not wrap `Box`, `Flex`, `Grid`, `Text`, and similar primitives in `styled(...)` for routine presentation.
    - Compose them directly and pass Radix props in JSX.
    - Only introduce a styled wrapper when Radix props/composition cannot express the required UI.
- **Compound component parts**: do not use `styled(Compound.Part)` such as `styled(TextField.Root)`, `styled(IconButton)`, `styled(Select.Trigger)`. This breaks TypeScript types. Instead, wrap the compound component in a `styled.div` or `<Box>` and apply layout there.
- **Specificity hacks**: never use `&&` selector blocks (`&& { ... }`) inside `styled-components` templates to override Radix styles. `&&` indicates a CSS specificity war — refactor to avoid the conflict entirely.
- **Size values** (`width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`): do not hardcode `rem` values in `styled-components` for routine layout sizing.
    - Prefer Radix size/spacing tokens and `var(--space-*)` values for component dimensions when possible.
    - If a size does not map cleanly to the spacing scale, justify the exception in code or keep it tightly scoped.
- Pattern summary:

    ```ts
    // ✅ colors — use the selector helper
    color: ${themeColor('gray11')};
    background-color: ${themeColor('indigo2')};

    // ✅ padding/margin — use Radix props on the component in JSX
    // <Box p="4">...</Box> instead of padding: var(--space-4) in CSS

    // ✅ use Radix primitives directly for layout
    // <Flex align="center" justify="between" gap="3">...</Flex>

    // ✅ truncate text with Radix instead of custom CSS wrappers
    // <Text truncate>Very long content...</Text>

    // ✅ CSS properties with no Radix prop equivalent — var() is acceptable
    inset-inline: var(--space-4);
    transform: translateY(var(--space-1));

    // ❌ don't use var() in CSS for props that have Radix JSX equivalents
    top: var(--space-3);    // → use <Box top="3"> instead
    bottom: var(--space-6); // → use <Box bottom="6"> instead
    inset: var(--space-4);  // → use <Box inset="4"> instead

    // ❌ never mix — don't use hex or var() for colors in styled templates
    color: #0d1511;
    color: var(--indigo-2);

    // ❌ don't create routine styled wrappers around Radix primitives
    const HeaderRow = styled(Flex)`...`;

    // ❌ don't use var() for padding/margin when Radix prop works
    padding: var(--space-4);

    // ❌ never use inline styles — use styled-component for CSS without a Radix prop
    style={{ height: '240px' }}

    // ❌ never use && to override Radix styles
    && { background: red; }

    // ❌ never wrap compound parts in styled()
    const Field = styled(TextField.Root)`width: 100%;`;
    ```

## Radix Token Reference

### Space Scale

Spacing props (`p`, `px`, `m`, `gap`, etc.) accept numeric steps `"1"`–`"9"`. The `scaling` prop on `<Theme>` multiplies all values uniformly.

| Step | Value | CSS variable     |
| ---- | ----- | ---------------- |
| 1    | 4px   | `var(--space-1)` |
| 2    | 8px   | `var(--space-2)` |
| 3    | 12px  | `var(--space-3)` |
| 4    | 16px  | `var(--space-4)` |
| 5    | 24px  | `var(--space-5)` |
| 6    | 32px  | `var(--space-6)` |
| 7    | 40px  | `var(--space-7)` |
| 8    | 48px  | `var(--space-8)` |
| 9    | 64px  | `var(--space-9)` |

Use `var(--space-N)` in `styled-components` only for CSS properties that have no Radix JSX prop equivalent (see **styled-components Color and Spacing Rules**).

### Typography Scale

`Text` and `Heading` `size` prop maps to the following values. Font size, letter spacing, and line height are always set together — never override them individually with custom CSS.

| Size | Font size | Line height |
| ---- | --------- | ----------- |
| 1    | 12px      | 16px        |
| 2    | 14px      | 20px        |
| 3    | 16px      | 24px        |
| 4    | 18px      | 26px        |
| 5    | 20px      | 28px        |
| 6    | 24px      | 30px        |
| 7    | 28px      | 36px        |
| 8    | 35px      | 40px        |
| 9    | 60px      | 60px        |

Font weight values: `light` = 300 · `regular` = 400 · `medium` = 500 · `bold` = 700.

### Breakpoints

All responsive props accept an object keyed by breakpoint name. Values are `min-width` based.

| Key       | Min-width | Typical target      |
| --------- | --------- | ------------------- |
| `initial` | 0px       | Phones (portrait)   |
| `xs`      | 520px     | Phones (landscape)  |
| `sm`      | 768px     | Tablets (portrait)  |
| `md`      | 1024px    | Tablets (landscape) |
| `lg`      | 1280px    | Laptops             |
| `xl`      | 1640px    | Desktops            |

Always start from `initial` (mobile-first). Example: `size={{ initial: '3', md: '5', xl: '7' }}`.

## Radix Compound Component API Rules

Radix Themes uses compound component patterns. Always use the correct composition; incorrect nesting causes broken accessibility and visual bugs.

### Layout Primitives (Box · Flex · Grid · Container · Section)

All five layout components share a common set of props — see the table below. Every prop accepts a responsive object (`p={{ initial: '3', sm: '5' }}`).

| Group       | Props                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Padding     | `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`                                                               |
| Width       | `width`, `minWidth`, `maxWidth`                                                                       |
| Height      | `height`, `minHeight`, `maxHeight`                                                                    |
| Positioning | `position`, `inset`, `top`, `right`, `bottom`, `left`                                                 |
| Overflow    | `overflow`, `overflowX`, `overflowY`                                                                  |
| Flex child  | `flexBasis`, `flexShrink`, `flexGrow`                                                                 |
| Grid child  | `gridArea`, `gridColumn`, `gridColumnStart`, `gridColumnEnd`, `gridRow`, `gridRowStart`, `gridRowEnd` |

Margin props (`m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml`) are available on most Radix components, not just layout ones.

**Box** — fundamental layout building block; based on `div`.

- `as` prop: `"div"` (default) | `"span"`.
- `display` unique values: `"none" | "inline" | "inline-block" | "block" | "flex" | "inline-flex" | "grid" | "inline-grid"`.
- Use `display={{ initial: 'none', sm: 'block' }}` to show/hide content at breakpoints.

**Flex** — extends Box with flex-specific props.

- Additional props: `direction`, `align`, `justify`, `wrap`, `gap`, `gapX`, `gapY`.
- `as` prop: `"div"` (default) | `"span"`.
- Use `gapX`/`gapY` when column and row gaps differ.

**Grid** — extends Box with grid-specific props.

- Additional props: `columns`, `rows`, `areas`, `flow`, `align`, `justify`, `gap`, `gapX`, `gapY`.
- `columns` and `rows` accept enum steps or any valid CSS grid template string (e.g. `"repeat(2, 64px)"`).
- Place child `gridArea`, `gridColumn`, etc. props on child layout components for grid placement.

**Container** — constrains content to a consistent `max-width`; based on `div`.

- `size` prop: `"1"` → 448px · `"2"` → 688px · `"3"` → 880px · `"4"` → 1136px (default).
- `align` prop (`"left"` | `"center"` | `"right"`) sets horizontal alignment within the viewport.
- Always prefer `Container size="N"` over hardcoded `maxWidth` on `Flex` or `Box`.

**Section** — semantic `<section>` element providing consistent vertical padding between page-level blocks.

- `size` prop: `"1"` – `"4"` (default `"3"`); each step maps to a preset `py` value.
- Use `Section` instead of a bare `Box` when wrapping a full-width page content block that needs vertical breathing room.
- Do not set manual `py` on a `Section` unless you need to override the size-based default.

### Text

- Renders as `<span>` by default. Use the `as` prop to render as `"p"`, `"label"`, `"div"`, or `"span"` — this is purely semantic and does **not** alter visual appearance.
- Use `as` to pick the correct HTML element instead of wrapping `Text` in a bare HTML tag (`<p>`, `<label>`, `<div>`).
- `size` controls font size, line height, and letter spacing together. Range `"1"`–`"9"`:
    - Sizes **1–3**: designed for UI labels and compact interface text.
    - Sizes **2–4**: designed for long-form body copy.
- Use `weight` (`"light"` | `"regular"` | `"medium"` | `"bold"`) instead of custom CSS `font-weight`. Numerical values: 300 / 400 / 500 / 700.
- Use `align` (`"left"` | `"center"` | `"right"`) instead of CSS `text-align`.
- Use `trim` (`"start"` | `"end"` | `"both"`) to remove leading whitespace from the text box edge — useful for precise vertical spacing inside cards and boxes. Do **not** use custom negative-margin CSS for leading trimming.
- Use `truncate` to clip overflowing text with an ellipsis — do **not** apply custom CSS `text-overflow: ellipsis` on text nodes.
- Use `wrap` (`"wrap"` | `"nowrap"` | `"pretty"` | `"balance"`) instead of CSS `text-wrap`. Prefer `"balance"` for headings and short decorative text; `"pretty"` is a progressive enhancement (not universally supported).
- Use `color` for semantic text color (Radix color name); Radix text colors guarantee at least Lc 60 APCA contrast over common backgrounds.
- Use `highContrast` to increase color contrast with the background — especially useful combined with `color="gray"`.
- Compose inline formatting components (`Link`, `Em`, `Strong`, `Code`, `Kbd`, `Quote`) directly inside `Text` children rather than wrapping in custom styled spans.
- To label a form control, use `<Text as="label">` wrapping the control — Radix automatically aligns the control baseline with the first line of text, even for multi-line labels.

### Heading

- Use `Heading` for page titles and section headings — shares `size` (`"1"`–`"9"`) and `weight` props with `Text`, mapping to the same type scale.
- Use the `as` prop (`"h1"` – `"h6"`) to match the document outline; default is `"h2"`.
- Do **not** nest a `<Heading>` inside `Dialog.Title` — `Dialog.Title` is already based on `Heading`; pass text children directly.
- Never use a raw `<h1>`–`<h6>` HTML tag where `<Heading>` would suffice; use `Heading` with the correct `as` value instead.

### Dialog

- Structure: `Dialog.Root > Dialog.Trigger > Dialog.Content > [Dialog.Title, Dialog.Description?, Dialog.Close]`.
- `Dialog.Title` is based on `Heading` — do **not** nest a `<Heading>` inside it.
- `Dialog.Description` is based on `Text` — do **not** nest a `<Text>` inside it; pass content directly as children.
- `modal` prop is **unavailable** — Dialog is always modal.
- `Dialog.Close` must live inside `Dialog.Content`.
- Control width of the dialog via `maxWidth` on `Dialog.Content`, not via wrappers.

### Select

- `size` prop belongs on `Select.Root`, not on Trigger or Content.
- `variant`, `color`, `radius` belong on `Select.Trigger`.
- `Select.Content` accepts `variant` (`"solid"` | `"soft"`), `color`, `highContrast`.
- For grouping items use `Select.Group` + `Select.Label` together.
- For custom trigger display (icon + text) pass children to `Select.Trigger` directly.
- Reuse the shared app wrapper in `src/components/Select.tsx` for standard dropdown selects instead of composing Radix `Select.Root/Trigger/Content/Item` inline in feature code.

### SegmentedControl

- Use `SegmentedControl` for switching between a small set of mutually exclusive views or filters (e.g. All / Expenses / Settlements, 12h / 24h, Dark / Light / System).
- API: `SegmentedControl.Root` wraps one or more `SegmentedControl.Item` elements.
- `SegmentedControl.Root` props: `size` (`"1"` | `"2"` | `"3"`, default `"2"`), `variant` (`"surface"` | `"classic"`, default `"surface"`), `radius` (`"none"` | `"small"` | `"medium"` | `"large"` | `"full"`), `disabled`.
- Use `value` + `onValueChange` for controlled mode; use `defaultValue` for uncontrolled.
- `Item` children accept `ReactNode` — include icons by wrapping in `<Flex align="center" gap="1">`.
- **Always** use the shared wrapper in `src/components/SegmentedControl.tsx` instead of composing `SegmentedControl.Root/Item` inline. Pass items as `items: { value: string; label: ReactNode }[]` and spread any additional Radix root props.
- Do **not** use raw `SegmentedControl.Root/Item` directly in feature/page code.

### RadioGroup

- Use `RadioGroup.Root` + `RadioGroup.Item` when the UI is choosing a single visible option from a short list, instead of building that interaction as a dropdown select.
- For the "paid by" / payer chooser in expense flows, use Radix `RadioGroup` with `color="jade"`.
- When composing richer row content around `RadioGroup.Item`, wrap the row in a semantic `<label>` and place the radio control inside that label.

### TextField

- Structure: `TextField.Root > TextField.Slot? > (input is implicit)`.
- `TextField.Slot` requires `side="left"` or `side="right"` — there is no default position.
- Do **not** use `size="1"` with interactive elements inside a Slot (no room).
- `TextField.Root` is a `div` and accepts margin props (`mt`, `mb`, etc.) directly.

### Popover

- Structure: `Popover.Root > Popover.Trigger > Popover.Content > Popover.Close?`.
- `Popover.Content` inherits Radix primitive props: `sideOffset`, `align`, `side`.
- To match trigger width: `width="var(--radix-popover-trigger-width)"` on `Popover.Content`.

### ScrollArea

- Use `ScrollArea` for any container where content may overflow vertically (long lists, message feeds, dropdowns with many items).
- Always set a concrete `height` on `ScrollArea` (e.g. via `styled(ScrollArea)` or `style`), **not** `max-height`. Radix uses the height to size its internal viewport; `max-height` does not propagate correctly.
- Use `scrollbars="vertical"` for lists; use `scrollbars="horizontal"` for wide content; use `scrollbars="both"` only when both axes are needed.
- Add `pr` on the direct content child to leave space for the scrollbar (e.g. `pr="4"`).
- **Width constraint caveat**: Radix `ScrollArea`'s internal viewport wraps children in a `display: table; min-width: 100%` div. This means `width: 100%` on child elements resolves to the *table's* auto width (min-content), not the viewport width — causing items to overflow horizontally. To fix this, target the inner div via a CSS attribute selector in `styled(ScrollArea)`:
  ```ts
  const ListScrollArea = styled(ScrollArea)`
      height: 240px;

      & [data-radix-scroll-area-viewport] > div {
          min-width: 0;
          width: 100%;
      }
  `;
  ```
  This is a known Radix limitation, not a specificity hack — the selector is the only way to constrain the internal table div.
- `styled(ScrollArea)` is acceptable (it is not a compound part); do not use `styled(ScrollArea.Viewport)` etc.

### Callout

- Structure: `Callout.Root > Callout.Icon > Callout.Text`.
- Always include `Callout.Icon` — it is required for correct layout and accessibility.

### Skeleton

- `loading` prop controls display; default is `true`.
- `Skeleton` renders as `<span>`. Do **not** wrap multiple block-level siblings in one Skeleton.
- For text: wrap the text node itself — `<Text><Skeleton>content</Skeleton></Text>`.
- For components: `<Skeleton loading={bool}><Component /></Skeleton>` — one Skeleton per logical element.

### Avatar

- `fallback` is **required** — always provide it (initials string or ReactNode icon).
- `size` range is `"1"` – `"8"`.
- `variant`: `"solid"` | `"soft"` (default `"soft"`).

### Responsive Props

- Most size and layout props accept a responsive object: `size={{ initial: '1', sm: '2', md: '3' }}`.
- Breakpoint names and min-widths are defined in **Radix Token Reference → Breakpoints** above.
- Always start from `initial` when overriding — it is the mobile-first baseline.

### Dark Mode Integration

- `src/main.tsx` intentionally passes `appearance={resolvedTheme}` to `<Theme>` to keep Radix appearance in sync with the `styled-components` ThemeProvider. Do **not** remove this — it is a deliberate project decision.
- The official Radix recommendation (rely solely on class switching from `next-themes`) would not sync the `styled-components` palette. This dual approach is the accepted trade-off.
- Do **not** add a second `<Theme>` wrapper to change appearance elsewhere in the tree; use `accentColor`/`radius` overrides on a nested `<Theme>` if a subtree needs a different accent.

## Numbers and Amount Formatting

- Use `Amount` from `src/basics/numbers` as the default renderer for UI numbers related to money, balances, debts, totals, and formatted numeric values.
- Do not render currency/amount values as raw JSX strings or via ad-hoc `toFixed`/manual concatenation in components.
- Import from `basics/numbers` (public entry), not from deep internal paths, unless extending the number system itself.
- Keep formatting logic inside `basics/numbers` and `helpers/numbers`; UI layers should only pass value/format props.

## bignumber.js Rules

All financial arithmetic must go through `bignumber.js` (`Big`). Native JS numbers are IEEE 754 float64 and accumulate rounding errors in sums, splits, and currency conversions.

**Arithmetic — always `Big()`:**

- Never use `+`, `-`, `*`, `/` on financial values. Use `.plus()`, `.minus()`, `.multipliedBy()`, `.dividedBy()`.
- Exception: threshold/guard comparisons like `value >= 1000` that do not affect stored or transmitted amounts are acceptable with native numbers.

**Parsing API values — always `tryToBig()`:**

- Use `tryToBig()` from `helpers/numbers` to convert any value coming from the API or external input.
- Never use `Number()`, `parseFloat()`, or unary `+` on financial strings from the backend — they silently lose precision.
- `Amount` (via `constructNumberComponent`) already calls `tryToBig()` internally, so pass the raw API string or a `Big` instance directly; wrapping in `Number()` beforehand is redundant and unsafe.

**Comparison — always Big methods:**

- Use `.eq()`, `.lt()`, `.gt()`, `.lte()`, `.gte()` to compare `Big` instances.
- Never use `===`, `>`, `<`, `>=`, `<=` directly on `Big` objects.

**Sending to API — always a string:**

- Serialize with `.toFixed(precision)` before sending. JSON numbers are float64 and lose precision silently.
- Never call `.toNumber()` before putting a value into a request payload.

**Rounding — always `Big.ROUND_HALF_UP`:**

- Use `.decimalPlaces(n, Big.ROUND_HALF_UP)` for any rounding.
- Never use `Math.round()`, `Math.floor()`, `Math.ceil()`, or native `.toFixed()` on financial values.

**`.toNumber()` usage:**

- Allowed only as the final step for non-financial consumption: DOM props, percentage-bar widths, chart libraries, or legacy component props that require `number` (e.g. `OwedStatusText.amount`).
- Never feed a `.toNumber()` result back into arithmetic or back to the API.

## Custom Hooks

- Before writing a custom hook, check if `@uidotdev/usehooks` already provides it — prefer the library over reinventing the wheel.
- Custom hooks in `src/hooks/*` should only exist for app-specific logic that has no equivalent in `@uidotdev/usehooks`.

## React Memoization & Performance Guidelines

**Core principle:** memoization is opt-in, not default. Apply only when there is a measurable or likely performance issue. Profile first with React DevTools Profiler.

**`React.memo`** — wrap a component only when it:

- re-renders frequently with identical props, or
- is expensive to render.

Uses shallow comparison — inline objects/arrays/functions as props break it silently.

```tsx
// ✅ stable props — memo is effective
const UserCard = React.memo(({ userId, name }: Props) => <.../>);

// ❌ breaks memo — new object reference on every parent render
<UserCard style={{ color: 'red' }} />
```

**`useMemo`** — use only for:

- computationally expensive derivations, or
- stabilizing object/array references passed to memoized children or hook deps.

```tsx
// ✅ stabilize reference for memoized child
const filters = useMemo(() => ({ status, page }), [status, page]);

// ❌ unnecessary — cheap computation, no reference stability needed
const label = useMemo(() => `Hello ${name}`, [name]);
```

**`useCallback`** — use only when:

- the function is passed to a `React.memo` child, or
- the function appears in a `useEffect`/`useMemo` dependency array.

```tsx
// ✅ passed to memoized child
const handleRemove = useCallback((id: string) => removeItem(id), [removeItem]);
```

**Anti-patterns:**

- Blanket `React.memo` / `useMemo` / `useCallback` on everything.
- Inline `{}` or `[]` props on memoized components.
- `JSON.stringify(value)` in dependency arrays.
- Optimizing without profiling first.

**Practical order:**

1. Write simple, readable code first.
2. Profile if sluggishness appears.
3. Apply `React.memo` at component boundaries before reaching for `useMemo`/`useCallback`.
4. Keep memoization surgical and documented with a comment explaining why.

## Dependency Rules (Current Architecture)

- Pages/components/hooks/features can read from stores.
- `basics/` must **not** access stores or call the API — pure rendering and logic only.
- Stores are the main place for async data fetching and call `src/api/*`.
- Components/pages should not call API directly.
- `src/api/chipin.ts` is the single HTTP gateway (axios instance + interceptors).
- Auth token is read/written only via `src/store/IDB/auth.ts`.
- Use TS path aliases from `tsconfig.app.json` (`api/*`, `store/*`, `components/*`, etc.).
- Route paths come from `ROUTES` (`src/constants/routes.ts`), not hardcoded strings.

## Offline-First and Dexie

- `Dexie` is the local persistence layer for PWA/offline data.
- Current usage includes auth persistence; future usage must also cover offline domain data and sync metadata.
- New offline-capable features should persist local changes in Dexie first, then sync with server when online.
- Keep server sync logic explicit and predictable (retry-safe, conflict-aware where needed).

## Auth & Session Flow

- Login token may come from query params (`jwtAuthToken`) in `useCheckSignIn`.
- Token is persisted to IndexedDB and validated client-side (JWT exp check).
- Auth status is resolved through `useAuthStore` (`unknown` | `authenticated` | `unauthenticated`).
- Protected pages must be wrapped by `ProtectedRoute`.

## Error Handling & Notifications

- API errors are normalized through `resolveApiErrorMessage` and shown via `sonner`.
- Offline/network/backend errors are handled in axios response interceptor.
- UI-level actions may show toasts from hooks/components/stores.

## i18n and UI Text

- New UI text should go through i18n (`react-i18next`) or centralized message constants.
- Keep translation keys in `src/i18n/locales/*`.
- For every new page/section, add locale keys immediately in both `src/i18n/locales/en/*` and `src/i18n/locales/ru/*` within the same task.
- Do not leave raw user-facing string literals in JSX; use `t('...')` keys instead.
- Existing hardcoded strings exist; do not add new hardcoded user-facing strings in JSX.
- If a translation text is used in more than one namespace file, move it to `common.json` and reference via `common:` prefix. Do not duplicate the same translation across multiple locale files.
- Phrases of **3 words or fewer** (e.g. "Save", "Cancel", "Add expense") must always live in `common.json` and be referenced via the `common:` prefix — never declared in a feature-specific namespace file.

## Global Constants Pattern

- Time constants are defined in `src/constants/time.ts`.
- Always import `SECOND`, `MINUTE`, `HOUR`, `DAY` explicitly from `constants/time` where needed.
- Do not rely on implicit globals for time constants.

## Code Quality

- Run: `npm run lint` before finalizing changes.
- Follow import sorting and unused-import rules from `eslint.config.js`.
- Keep strict TS compatibility (`strict: true`).
- Use `export default` for most React components (pages, features, reusable components).
- Exception: components that live inside a barrel-exported group directory (e.g. `modals/`, `navs/`) should use named `const` exports to support clean re-export from the barrel `index.ts`.
- **Never write single-line `return` statements without braces.** Always use a block body `{ return ...; }` or an early-return guard with a full block:

    ```ts
    // ✅ block body
    if (!value) {
        return;
    }

    // ✅ block body with value
    if (isLoading) {
        return <Spinner />;
    }

    // ❌ single-line return — never do this
    if (!value) return;
    if (isLoading) return <Spinner />;
    ```

- When a boolean expression has **3 or more operands** (`&&` / `||`), extract it into a named `const` before the JSX return (or before the statement that uses it). The name must describe the _intent_, not repeat the conditions:

    ```tsx
    // ✅ three conditions → named const
    const isEndOfFeed = !isNextPageLoading && !hasMore && items.length > 0;
    // ...
    {
        isEndOfFeed && <Text>{t('endOfFeed')}</Text>;
    }

    // ❌ inline expression with 3+ parts
    {
        !isNextPageLoading && !hasMore && items.length > 0 && <Text>{t('endOfFeed')}</Text>;
    }
    ```

## Boolean Naming Convention

- Boolean variables, state, and props must be prefixed with `is` or `has`.
- Use `is` as the default prefix: `isLoading`, `isOpen`, `isVisible`, `isButtonShown`, `isWorking`.
- Use `has` only when `is` reads unnaturally and `has` better describes possession or presence: `hasError`, `hasPermission`, `hasChildren`.
- Never name booleans without a prefix (e.g. `loading`, `open`, `visible`, `shown` are not allowed as standalone boolean names).
- This applies to: local variables, state hooks, store fields, component props, and function return values that represent a boolean flag.

## Variable Naming Convention

**Event handlers** — prefix `handle`:

- `handleSubmit`, `handleAvatarClick`, `handleMenuClose`.
- Never name handlers without a prefix (`submit`, `avatarClick` are not allowed).

**Callback props** — prefix `on`:

- `onSubmit`, `onChange`, `onClose`, `onAvatarClick`.
- Never pass callbacks as props without the `on` prefix.

**Async data-fetching functions** — prefix `fetch`:

- `fetchGroups()`, `fetchDashboard()`, `fetchUserById(id)`.
- Use `fetch` for all store actions and helpers that call the API and return data.

**Arrays and collections** — always use plural names:

- `users`, `groupIds`, `expenseItems`.
- Never name an array with a singular noun (`user = []`, `groupId = []` are not allowed).

**Array iteration variables** — use short readable names, never single letters:

- `users.map((user) => ...)`, `groups.forEach((group) => ...)`, `items.map((item, index) => ...)`.
- Never use single-letter iteration variables (`i`, `r`, `o`, `x`, `e` are not allowed).
- Use the singular form of the array name as the item name: `users` → `user`, `groups` → `group`, `expenseItems` → `expenseItem`.
- For index, always use the full word `index`, never `i` or `idx`.

**Module-level constants** — `SCREAMING_SNAKE_CASE`:

- `MAX_RETRY_COUNT`, `DEFAULT_CURRENCY`, `BASE_URL`.
- Applies to exported constants in `src/constants/*` and top-level module constants elsewhere.

**Types and interfaces** — PascalCase, no `I`-prefix:

- `type GroupMember = {}`, `interface AuthState {}`.
- Never use `IAuthState`, `TGroupMember`, or lowercase type names.

**Component props type/interface names** — use `Props`:

- In React component files, name component props type/interface as `Props`.
- Prefer `interface Props { ... }` or `type Props = { ... }` instead of `EventUnknownProps` / `ComponentNameProps`.

**Custom hooks** — prefix `use`:

- `useAuth`, `useGroups`, `useModalState`.
- Never name hooks without the `use` prefix (`authHook`, `getGroups` are not allowed).

**React components** — PascalCase:

- `GroupCard`, `ExpenseItem`, `UserAvatar`.
- Never use camelCase or lowercase for component names (`groupCard`, `expenseitem` are not allowed).

**Ref variables** — suffix `Ref`:

- `buttonRef`, `containerRef`, `inputRef`.
- Always use `useRef` results with the `Ref` suffix.

**Zustand stores** — suffix `Store`:

- `useAuthStore`, `useDashboardStore`, `useGroupsStore`.
- All zustand store hooks must end with `Store`.

**Utility functions** — camelCase verb-first:

- `formatDate()`, `parseUrl()`, `resolveError()`, `buildQueryString()`.
- Name utilities as concise verb phrases; never use noun-based names (`dateFormatter`, `urlParser` are not allowed).

**File naming**:

- React components: `PascalCase.tsx` — `GroupCard.tsx`, `ExpenseItem.tsx`.
- Custom hooks: `camelCase.ts` — `useAuth.ts`, `useGroups.ts`.
- Utilities and helpers: `camelCase.ts` — `numbers.ts`, `url.ts`.
- Constants: `camelCase.ts` — `routes.ts`, `time.ts`.

**Folder naming**:

- All directories use `kebab-case` — `base-modal/`, `user-friends/`, `self-settings/`.
- Never use `PascalCase` or `camelCase` for directory names.

## Component Layer Placement

Choose the layer by complexity and reusability:

| Layer             | Lives in      | Criteria                                                                                                                                                                           |
| ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primitive**     | `basics/`     | Single-responsibility; no store access; no API calls; reusable across any domain. Examples: `UserAvatar`, `RelativeTime`, `ChipInLoader`, `Amount`.                                |
| **Composite**     | `components/` | Combines multiple primitives or reads from a store selector; domain-adjacent but not tied to one feature. Examples: `Header`, `GroupsCards`, `SummaryDebtCards`, modal components. |
| **Domain module** | `features/`   | Self-contained domain slice — includes routing guards, feature-scoped hooks, and composed sub-components. Not reusable outside its domain. Examples: `activity/`, `routing/`.      |
| **Screen**        | `pages/`      | Route-level container. Assembles features and components; contains minimal logic — delegates to stores and hooks.                                                                  |

**Promotion rules:**

- Promote from `basics/` to `components/` when the component imports from a store, combines 3+ other primitives, or carries domain-specific display logic.
- Promote from `components/` to `features/` when the component introduces its own routing, access guards, or encapsulates a complete product domain.
- Never import from `pages/*` in `basics/`, `components/`, `features/`, or `store/` — pages are leaf nodes in the import tree.
- Allowed import direction: `pages` → `features` → `components` → `basics`. No reverse imports.

## Component Grouping

- When two or more components share closely related logic, domain, or visual purpose within the same layer, group them into a dedicated subdirectory using `kebab-case` (e.g. `components/modals/`, `components/navs/`).
- Every such directory must have an `index.ts` barrel file that re-exports all public components using named exports.
- The barrel file must only contain `import` / `export` statements — no logic, no JSX.
- Consumers must import from the directory barrel (`components/modals`) rather than from deep internal paths (`components/modal/AddExpenseModal`).
- A single standalone component does not need its own folder; only group when there are two or more related components.
- Do not mix components from different layers in the same subdirectory — a `basics/` subdirectory must only contain primitives, a `components/` subdirectory only composites, and so on.

**Co-location of private sub-components:**

- Sub-components that belong exclusively to one parent component and are not reused anywhere else must live in a `components/` subdirectory next to their parent, not in the shared layer directory.
- Do **not** create a barrel `index.ts` for a co-located `components/` folder — import the files directly from their paths within the same feature/component scope.
- Example: `features/activity/components/EventJoinGroup.tsx`, `features/activity/components/EventUnknown.tsx` — private to `activity/`, never exported outside it.
- If a sub-component is later needed by a second feature or page, move it up to the appropriate shared layer (`components/` or `basics/`) at that point.

## Practical Do/Don't

- Do: fetch dashboard/groups/users through zustand store actions.
- Do: add routes in `ROUTES` + `AppRouter` together.
- Do: use aliases (`store/...`) instead of deep relative imports.
- Do: use Radix components first; justify any `styled-components` usage.
- Don't: call backend directly from page/component.
- Don't: bypass token/helpers or offline persistence flows with ad-hoc storage access.
- Don't: hardcode route strings when `ROUTES.*` exists.

## Agent Workflow

- Before edits: inspect `AGENTS.md` and touched module boundaries.
- Preserve layer responsibilities listed above.
- If a task requires architecture change (e.g., moving async logic out of stores), explicitly call it out before implementing.
- If rules conflict, this file has priority for this repository.
