# Pennsylvania Prototype Implementation Plan

> **For agentic workers:** Use shared, fixed interfaces in `src/model.ts`; implement tests before the behavioral modules. Independent file ownership permits simulation, renderer and UI implementation in parallel.

**Goal:** A playable 70s-era Pennsylvania journey with real resource, pursuit, service and save decisions.

**Architecture:** A deterministic TypeScript simulation is independent of Canvas2D presentation. A fixed 60 Hz game loop renders either camera at any of three native resolutions. DOM menus control the same world and persist only service snapshots.

**Tech Stack:** TypeScript 5.9, Vite 7, Canvas2D, Web Audio, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-26-cannonball-design.md`

## Constraints and rulings

- Existing repository is empty/unborn: use this checkout on `codex/pennsylvania-prototype`; a linked worktree cannot start from a missing commit.
- The user explicitly authorized implementation; no additional plan approval is required.
- Core contracts are in `src/model.ts`; no remote publishing or commits are part of this request.
- Scope is the approved sample stage, with future campaign catalog clearly separated from playable content.

## Review focus

- Reload, camera and resolution toggles must not reroll county events or alter fuel, fatigue, traffic or clock.
- Menu dwell must not incur time; service charges and healing cannot be repeated by saving.
- Failure on the third confirmed violation takes precedence over border escape.
- Corrupt snapshots, nonfinite values and blocked storage must fail safely.
- Detours and optional service stops must remain understandable while driving.

## Tasks

- [x] 1. Establish project/contracts; add data and road/county tests, watch them fail, implement deterministic content.
- [x] 2. Simulation: manual/automatic transmissions, fuel/fatigue/damage, traffic/rivals, pursuit, branches, services and strict snapshots. RED→GREEN behavioral tests.
- [x] 3. Renderer: Pennsylvania pseudo-3D road, original period scenery/cars, reverse-world mirror, cockpit/arcade HUD, paper map and three resolutions. Read-only simulation contract.
- [x] 4. UI: branded 70s roadbook, real car/crew selection, settings, service actions, pause, failure and finish screens, keyboard/gamepad input and sound.
- [x] 5. Integrate fixed-step loop, persistence and playable browser build. Run unit/type/build checks, browser flow and real full-stage simulation.
- [x] 6. Independent review; fix material findings; document real verification and remaining human/device boundaries.
