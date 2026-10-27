# First playtest iteration

**Goal:** Make the actions advertised by the sample stage physically understandable and fair.
**Spec:** User playtest and five answers on2026-10-26. Own speed unchanged; automatic service at a marked bay; map right with services/rivals; discreet RPM bands+lamp, fewer overlays; visible police with a30–60real-second escape/yield flow and deterministic heat escalation after escapes. Only640×360/1280×720.

Shared layout is in `src/layout.ts`. Four-lane road spans lateral-1..1. Service parking bays and building bounds must match drawing and simulation. The detour leaves to the right; at the fork x>1.05 selects it, with a continuous coordinate transform using detourOffset. Its road returns smoothly to main at156km.

Save format2 adds escapes, serviceExitBlock, police pursuitTime and canonical candidate/roll percounty. Migrate previous service snapshots without dropping fuel, fatigue, clock or existing county outcomes. Keep current storage key to find old saves. Old960 settings map to1280.

- [x] Shared geometry/contracts and resolution migration tests.
- [x] Simulation: physical fork/service/building contact, calmer traffic with braking/separation, visible police and real-time response/escalation, save migration.
- [x] Renderer: matching fork/aprons/bays/solid buildings, truck silhouettes, vehicle eye height, readable gauges, right map/mirror, event-based signs, quiet HUD.
- [x] UI/input: remove redundant branch/service banners, two resolutions, contextual stop help, updated controls; preserve one-page startmenu.
- [x] Integrate tests and actual browser scenarios for entry, route, traffic and police; review regression/compatibility.
- [x] Rebuild portable Windows sample and verify actual native start and ZIP integrity.

Evidence: `reports/playtest-02.md`, 81/81 tests, actual browser first-service entry without E, full12m38s simulated stage, native build20261026T182449730Z-4bec4b94 and CRC-verified portable ZIP. Human follow-up playtest and graphical detail work remain separate next steps.
