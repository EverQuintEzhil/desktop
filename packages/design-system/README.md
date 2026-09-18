# @thefluentmind/design-system

Pre-styled shadcn primitives for FluentMind hosts and GenUI apps. Components are
copied verbatim from the host product's `src/components/ui` so a GenUI mini-app
renders identically to the host.

Requires React 19 (components use ref-as-prop, not `forwardRef`).

## Exports

- `@thefluentmind/design-system` — the React components + `cn`.
- `@thefluentmind/design-system/tailwind.css` — **Tailwind source partial** for
  hosts that run their own Tailwind v4 build (same pattern as
  `shadcn/tailwind.css`). Registers the component sources via `@source`, maps
  the theme via `@theme inline`, ships the non-utility component rules, and
  declares the class-based `dark` variant.
- `@thefluentmind/design-system/index.css` — **precompiled** component CSS for
  surfaces with **no** Tailwind build (standalone dev harness, MCP iframe).
  Layered (`@layer theme/components/utilities`), no token value definitions, no
  global preflight — safe alongside other stylesheets.
- `@thefluentmind/design-system/tokens.css` — the literal token values
  (`--primary`, `--background`, …). Load **only** where there is no host to
  provide them (dev harness / iframe). The host app already defines these.

## Usage

Host app with its own Tailwind v4 build (e.g. `@tailwindcss/vite`) — import the
source partial **in the app's Tailwind CSS entry**, never the precompiled CSS
(a Tailwind build discards precompiled Tailwind stylesheets):

```css
/* src/index.css */
@import 'tailwindcss';
@import '@thefluentmind/design-system/tailwind.css';
```

Surfaces without a Tailwind build (dev harness, iframe):

```ts
import '@thefluentmind/design-system/tokens.css';
import '@thefluentmind/design-system/index.css';
import { Button, Card, cn } from '@thefluentmind/design-system';
```

## Layout

- `src/` — component sources (published; scanned by the consumer's Tailwind via
  the partial's `@source "../src"`).
- `styles/theme.css` — single source of truth: `@theme inline` mapping +
  non-utility component rules. Imported by both entries below.
- `styles/tailwind.css` — the source partial for Tailwind hosts.
- `styles/index.css` — build input for the precompiled `dist/index.css`.
- `styles/tokens.css` — token values, copied to `dist/tokens.css`.

## Included components

button, card, badge, input, label, checkbox, separator, skeleton, table, tabs,
progress, tooltip, textarea, plus the `cn` class-merge helper.

## Scripts

- `npm run build` — emit `dist/index.js`, `dist/index.d.ts`, `dist/index.css`, `dist/tokens.css`.
- `npm run typecheck` — type-check without emit.
- `npm run lint` — lint `src`.
