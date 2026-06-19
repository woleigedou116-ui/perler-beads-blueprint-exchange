# Frontend Architecture Source of Truth

Date: 2026-06-19

Status: Draft for the desktop workbench rebuild

## Purpose

This document is the source of truth for rebuilding the web frontend toward a future desktop-software interface. The current MVP workbench remains available while the new shell, design system, and module boundaries are introduced incrementally.

## Product Direction

The application is a local production tool for converting and reviewing perler bead blueprints. The interface should feel like a focused desktop utility rather than a marketing website or generic admin dashboard.

Design keywords:

- Local-first
- Quiet
- Dense but readable
- Tool-like
- Stable for repeated work
- Low distraction

Primary layout:

- Top command bar for project-level commands.
- Left project rail for import, project metadata, and workflow progress.
- Center work area for source and target previews.
- Right review rail for correction queue and selected-cell properties.
- Bottom status bar for recognition, service, selection, and persistence state.

## Technology Stack

Keep the existing base:

- React
- Vite
- TypeScript
- Vitest
- Testing Library

Add lightweight UI foundations:

- Radix UI primitives for accessible low-level behavior.
- lucide-react for icons.
- class-variance-authority for typed component variants.
- clsx for class composition.

Do not adopt Ant Design, Material UI, or a full admin template. Those libraries would impose a visual language that does not match the intended desktop-tool feel.

## Visual Language

The visual system should use restrained colors, compact spacing, and clear panel boundaries.

Rules:

- Keep the preview area visually dominant.
- Prefer full-height work surfaces over marketing sections.
- Avoid decorative gradients, floating cards, and landing-page composition.
- Use panels for tool surfaces and repeated items only.
- Use icon buttons for frequent commands once icons are introduced.
- Keep card radius at 8px or less.
- Optimize for scanning, comparison, and repeated action.

## Design Guardrails

These rules protect the desktop-tool direction during future AI-assisted edits.

Do:

- Start new workbench screens from the desktop shell: command bar, left rail, center work area, right rail, and status bar.
- Keep the source/target preview area as the first visual priority after a project is loaded.
- Use compact controls, clear grouping, and stable dimensions so repeated review work feels predictable.
- Prefer familiar icons for tool actions such as open, save, export, zoom, reset, hide, and selection.
- Keep panels visually flat and functional. A panel should represent a real tool area, queue, inspector, or repeated item.
- Use visible status and progress surfaces for long-running local work such as recognition and export.

Do not:

- Turn the product into a landing page, hero page, or marketing-style layout.
- Add decorative gradient blobs, oversized illustrations, floating decorative cards, or one-off visual effects.
- Nest cards inside cards unless the inner surface is a true repeated item or modal content.
- Use a full admin template or generic dashboard visual language.
- Let sidebars visually compete with the preview workspace.
- Introduce broad palette changes without updating tokens and checking the prototype route.
- Hide important review actions behind menus before the workflow is stable.

## Token System

Design tokens are CSS custom properties. They are the styling source of truth and should live under `src/shared/tokens/`.

Token groups:

- Color: background, surface, border, text, muted text, accent, warning, danger.
- Spacing: fixed scale for gaps and panel padding.
- Radius: compact component radius, panel radius, round control radius.
- Typography: body, small text, compact heading sizes.
- Shadow: low-elevation surface shadows only.
- Layout: top bar height, status bar height, rail widths.
- Interaction: focus ring, selected border, disabled opacity.

CSS modules are not required for the first skeleton. Use scoped class names and token variables. Avoid component-local ad hoc colors except for preview mock cells and swatches.

## Theme Design

Initial implementation:

- `light`: default and fully supported.
- `dark`: provider and token hooks are prepared, but full color polish can happen later.

Reserved:

- `high-contrast`: future accessibility mode.

Theme state should be exposed through a provider in `src/shared/theme/`. The first implementation may default to `light` and persist the selected theme later.

## Internationalization Design

Initial implementation:

- `zh-CN`: default.
- `en-US`: reserved.

Text should gradually move out of large components and into message dictionaries under `src/shared/i18n/`. Do not block visual skeleton work by translating every existing MVP string at once.

## Directory Structure

Target structure:

```text
apps/web/src/
  app/
    App.tsx
    providers/
    routes/
  pages/
    workbench/
  widgets/
    app-shell/
    workspace-layout/
    preview-stage/
    review-sidebar/
  features/
    import-project/
    review-corrections/
    mark-unwanted-region/
    export-project/
    palette-reference/
  entities/
    project/
    cell/
    palette/
  shared/
    api/
    i18n/
    icons/
    lib/
    styles/
    theme/
    tokens/
    ui/
```

The current MVP files under `features/workbench/` stay in place until their behavior is migrated and verified.

## Module Boundaries

- `app`: application bootstrapping, providers, and route selection.
- `pages`: route-level composition. Pages should assemble widgets and features, not own low-level UI primitives.
- `widgets`: large layout regions that combine features and entities.
- `features`: user actions and workflows such as import, review, mark unwanted, and export.
- `entities`: domain-shaped UI and helpers for project, cell, and palette concepts.
- `shared`: reusable UI, tokens, theme, i18n, low-level utilities, and API adapters.

Import direction:

```text
app -> pages -> widgets -> features -> entities -> shared
```

Lower layers must not import higher layers.

## Reuse Rules

- Shared UI components should be small, typed, and visually token-driven.
- Do not add abstractions for one-off prototype elements.
- Promote a component to `shared/ui` only when it is reused or clearly part of the base design system.
- Domain-specific components belong in `features`, `entities`, or `widgets`, not `shared/ui`.
- Existing business API clients remain in `src/api/` during the first migration. They can move into `shared/api/` only when the migration is deliberate.

## Implementation Rules

Use these rules as the default checklist for frontend changes:

- Keep the existing MVP workbench as the default route until a replacement page has equivalent behavior and tests.
- Keep experimental visual work behind explicit routing such as `?prototype=desktop-ui`.
- Build route-level pages by composing `app`, `pages`, `widgets`, `features`, `entities`, and `shared` in the documented import direction.
- Use `DesktopShellLayout` for desktop-shell screens and `ThreePaneWorkspace` for the standard workbench body before creating another layout primitive.
- Use `shared/ui` primitives for repeated controls before adding local button styles.
- Add new design constants to `shared/tokens/tokens.css` before scattering new colors, radii, shadows, or layout sizes.
- Keep domain-specific behavior near the feature that owns it. Do not move code into `shared` only because two nearby files can import it.
- Add or update focused tests when route behavior, shared UI behavior, or migration boundaries change.
- Keep each migration step reviewable: move one workflow or surface at a time, verify it, then remove obsolete code.
- Do not let prototype CSS become permanent production CSS without moving reusable rules into tokens, shared styles, or widget styles.

## Prototype Strategy

The visual prototype is available behind a query parameter:

```text
?prototype=desktop-ui
```

Default application behavior must continue to open the existing MVP workbench. The prototype should not call production APIs until the visual direction is approved.

## Migration Plan

Phase 1: Foundation

- Add providers for theme and i18n.
- Add token files and base UI primitives.
- Keep the existing MVP workbench as the default route.
- Keep the desktop visual prototype behind a query parameter.

Phase 2: Layout Shell

- Convert the prototype into reusable shell and layout widgets.
- Define stable slots for left rail, work area, right rail, command bar, and status bar.
- Keep mocked content until shell behavior is approved.

Phase 3: Feature Migration

- Move import controls into `features/import-project`.
- Move review queue into `features/review-corrections`.
- Move non-bead tools into `features/mark-unwanted-region`.
- Move export controls into `features/export-project`.
- Keep focused tests for each migrated behavior.

Phase 4: Cleanup

- Remove obsolete CSS and old layout code after equivalent behavior is verified.
- Keep source-control diffs surgical and reviewable.

## Verification Standards

Every frontend architecture change must pass:

```powershell
cd apps\web
npm test -- --run
npm run build
```

Visual skeleton changes should also be checked at `1280 x 720` and a narrower desktop width to ensure no incoherent overlap or horizontal overflow.

## Current Decisions

- Use `React + Vite + TypeScript`.
- Add `@radix-ui/react-slot`, `lucide-react`, `class-variance-authority`, and `clsx`.
- Use CSS custom properties for tokens.
- Use a provider structure for theme and i18n.
- Keep current MVP route untouched while the new skeleton matures.
- Use `DesktopShellLayout` and `ThreePaneWorkspace` as the first reusable desktop layout primitives.
- Keep `?prototype=desktop-ui` as the visual model route until the real workbench migration catches up.
