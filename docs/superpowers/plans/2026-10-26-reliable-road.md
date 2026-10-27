# Reliable road implementation plan

> **For agentic workers:** Use focused implementation and independent review for the separate modules. Preserve other workers' files.

**Goal:** Make normal traffic, police arrival and route choice understandable and reproducible before expanding the cinematic chase.

**Architecture:** Separate traffic/contact resolution from the police controller. Both use physical actor poses; audio and renderer consume those poses. Shared route geometry and bend descriptors supply rendering and navigation.

**Tech Stack:** Existing TypeScript, Canvas2D, Vite, Node tests, Playwright CLI and local Electron runtime. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-26-reliable-road-design.md`.

## Global constraints

- Keep player speed, TIME_SCALE8, STAGE_LENGTH360000, 640×360/1280×720 and both views.
- Preserve old service snapshots and resources/clock/seed/outcomes; validate optional new actor/rival fields.
- No commits, push or publication requested. Preserve prior native packages and Velvet Cruise reference files.
- Movie reinforcements, forced overtaking, spikes and roadblocks remain a separate next stage.

## Review focus

- Natural braking and pulling right from a real pursuit, not a positioned stopped fixture.
- Adjacent-lane visual contact and three-car queues; fault decisions must use original poses.
- Near-front actor visibility in Arcade and audible police without a real nearby actor.
- Police, service navigation and saved positions across the new fork and rejoin.
- Rival consequences and time skips, save/load and UI readability in both resolutions.

## Tasks

- [x] RED reproductions from seeds42/1976 shoulder stops and seed99 multi-car/lane-change traces.
- [x] `src/traffic.ts`: `rememberTrafficPlayerPose(state)` before player integration; `updateRoadTraffic(state,dt,{log,say})` for shared sizes, swept/stable contacts, braking, passing and short horns. Test in `tests/traffic-v03.test.ts`.
- [x] `src/simulation.ts` police helpers, `src/police-presentation.ts` and `src/audio.ts`: physically reachable stop, moving patrol/parked check, actual actor siren and basic rival tickets. Test in `tests/police-v03.test.ts`.
- [x] `src/layout.ts`, `src/road.ts`, BRANCH data and renderer: short clear fork, route-specific visible bends and camera/body alignment. Pure bend descriptor links commentary. Test geometry, image sequences and both views/resolutions.
- [x] Root integration: replace old traffic function, bind reachable service/bend cues, validate/save optional horn/siren/rival penalty fields and account for penalties during time skips.
- [x] Atlas-plus-list map and honest rival style information; cockpit/language/graphics backlog and explicit human test sheet.
- [x] Full tests and production build, independent review of natural scenarios, browser input driving, native smoke and fresh CRC-verified Windows ZIP.

Final evidence:136/136tests; direct adapted Velvet Cruise yieldSafe in src/driving.ts; source-verified TestDriveII original manual; actual browser testlaunchers/input path; full stage13:06.78 withoutcollision; native20261026T204741407Z-64a6515d andverifiedZIP. Human testgoals in docs/TESTPLAN-03.md.
