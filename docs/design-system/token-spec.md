# RemiDe Foundations Spec

> Status: prose-only guidance  
> Canonical values: `public/design-system/foundation.registry.json`  
> Live editor/viewer: `/ui/foundations`

## What Is Canonical

All foundation values and foundation-level rules now live in one machine-readable registry:

- `public/design-system/foundation.registry.json`

This file is the only source of truth for:

- color tokens
- typography scale
- font roles
- spacing
- radii
- shadows
- typography rules and other foundation-level contracts

Runtime CSS is generated from that registry into:

- `src/styles/tokens.css`

The `/ui/foundations` page reads the same registry and exposes:

- `View` mode for inspection
- `Edit` mode for local authoring
- `Save` for direct local persistence

## Editing Model

Foundations are edited only in `/ui/foundations`.

Key behavior:

- draft changes exist only inside `Foundations`
- `Components`, `Composition`, and `Templates` continue using the last saved state
- pressing `Save` writes the current draft to the local canonical registry
- after `Save`, the saved foundation state becomes active across the whole `/ui` shell

This keeps the design-system workflow close to Figma Variables:

- collections
- modes
- inspector-driven editing
- live preview
- explicit save point

## Collections

The registry is organized into two top-level buckets:

### `collections`

Variable-like data:

- `colors`
- `typography-scale`
- `fonts`
- `spacing`
- `radii`
- `shadows`

Each collection can expose one or more modes:

- themes: `beige`, `darkgray`, `nearblack`
- base collections: `base`

### `rules`

Behavior-like data that should not be hidden as CSS side effects:

- typography role mapping
- uppercase policy
- letter-spacing policy
- font-role mapping
- other foundation-level presentation rules

Rules are editable in the same surface, but they remain conceptually separate from token values.

## Consumption Contract

Consumers must read generated CSS variables and foundation rules only.

This means:

- `src/styles/app.css` is no longer a token source of truth
- design-system pages must not hardcode parallel token arrays
- `/ui/components`, `/ui/composition`, and `/ui/templates` are read-only consumers of the saved foundation state

## Naming and Authoring Guidelines

- Use human-readable labels for designer-facing names.
- Keep token names stable once introduced.
- Add descriptions and usage notes for every editable token and rule.
- Prefer role-based fonts (`body`, `heading`, `mono`) over raw font names in rules.
- Keep semantic colors meaningful: success, warning, danger, info, neutral.
- Do not encode page-level one-off styling in foundations.

## What Stays Out of Foundations

These do not belong in the canonical token registry:

- component-specific layout hacks
- one-off page overrides
- implementation notes for a single screen
- route-specific visual exceptions

Those stay in component/page styling, not in foundation data.

## Operational Rule

If a token value or foundation rule changes, the change must be made in one place only:

- `public/design-system/foundation.registry.json`

Everything else is derived from it.
