# Frontend Skeleton Acceptance

Date: 2026-06-19

Status: Ready for MVP UI skeleton signoff

## Scope

This acceptance note covers the desktop-style frontend skeleton for the current
browser-based MVP. It does not claim that the future standalone desktop wrapper
or the full feature-folder migration is complete.

## Completed

- The default workbench renders through `DesktopShellLayout`.
- The main work area uses the reusable `ThreePaneWorkspace` layout.
- The visual prototype remains available at `?prototype=desktop-ui`.
- Theme, i18n, token, shared style, and shared UI foundations are wired into the app.
- The default workbench command bar uses shared UI buttons.
- Upload, review, preview, palette reference, and legacy export actions use shared UI buttons.
- Recognition progress, review queue, selected-cell editing, non-bead region selection, exports, and palette reference behavior remain covered by frontend tests.
- The README links to the frontend source-of-truth document so future UI changes have a clear reference.

## Deferred

- Moving `features/workbench/*` into the full target folder structure remains a later migration phase.
- Shared `Input`, `Select`, checkbox, segmented-control, and icon-button primitives can be added when their behavior is migrated deliberately.
- Dark theme polish is reserved; the provider and token hooks exist, but light theme is the supported MVP theme.
- The standalone desktop wrapper is not part of this browser MVP skeleton.

## Signoff Checks

Before signing off this skeleton, run:

```powershell
cd apps\web
npm test -- --run
npm run build
```

Visual check:

- Open the default workbench at a normal desktop viewport such as `1280 x 720`.
- Open the prototype route with `?prototype=desktop-ui`.
- Confirm there is no incoherent overlap or horizontal overflow.

