# Implementation status — Pennsylvania sample

Plan: `docs/superpowers/plans/2026-10-26-pennsylvania.md`

2026-10-26: Empty repository verified; no pre-existing source or user changes. Working in the new Cannonball checkout on `codex/pennsylvania-prototype`. Velvet Cruise is read-only reference.

Contracts: `src/model.ts`. Root owns scaffolding/data/main/persistence integration; workers own simulation, renderer and UI separately. New snapshots use `cannonball.pa.save.v1`.

Ruling: service menus freeze real time; explicit operations charge fixed virtual time. Repeated save does not restore fatigue.
Ruling: County event outcomes are generated once from seed and saved. County transitions do not escape pursuit; only stage/state border does.
Ruling: playability is limited to Pennsylvania; a PA finish never grants full-campaign family unlocks.

## Completed: first prototype (0.1, historical)

- Contracts/data/counties: RED→GREEN content tests.
- Deterministic journey, traffic/rivals, transmissions, branch, pursuit, services and strict snapshots: RED→GREEN behavioral tests.
- Read-only dual-view renderer, three native resolutions, real mirror, map and original period art; browser invariant checks passed.
- Local-font roadbook UI, all12crew, two playable cars, planned catalog, keyboard/gamepad and procedural audio.
- Independent behavioral review: two gamepad issues reproduced in browser, fixed and rechecked.
- Visual QA aligned lane centers and found unfair rear-rival start collisions. New RED regression then GREEN passing-lane fix.
- Final tests53/53; TypeScript/Vite build passed. Genuine controller journey875.68real simulated seconds with two services.
- Final browser UI/render/controller checks and hidden native Windows start/render smoke passed. See`reports/verification.md`.

No commits, push or publication were requested/performed. Branch:`codex/pennsylvania-prototype`. Physical gamepad, mobile and continuous human audiovisual/game-feel acceptance remain open.

## First human playtest / prototype 0.2

User retained own speed and selected automatic physical parking stops, right map including4rivals/services, discreet RPM bands/lamp with fewer overlays, visible30–60real-second police/stop-or-flee plus future-check escalation after escapes. Only640×360/1280×720. Start onepager stays.

Shared model version2 and `src/layout.ts` define physical right fork, road offsets, paved service apron, marked bay and solid building bounds. Root integrated model/layout/settings/main and QA/docs. Workers completed simulation/road/comments, render/art and ui/style. Legacy V1 release fixture is preserved in `tests/fixtures/service-v1.json`; migration restores resources/clock/RNG/outcomes and relocates to the same new bay.

Independent review findings were reproduced and fixed with regressions: premature return from overtaking, remote lateral tickets, hidden low-priority comments, and pursuit stranded on the detour. Render inspection additionally removed ramp-obstructing decorations and moved the fork-sign pole off the pavement. Racing rivals retain racing highway speeds; ordinary cars/trucks use calmer speeds and all respect town caps.

Root verification:81/81 tests plus TypeScript/Vite build passed. Full360km controller run758.48s, two physical stops, zero tickets, one collision. Actual browser input drive reached Sundown automatically at106.03s without E. Browser UI/save/driver-swap, four view/resolution cases, true front/rear entities and injected gamepad modal checks passed. See `reports/playtest-02.md` and `output/qa/*-v02.*`.

Current working server127.0.0.1:5173. Final0.2 Windows native smoke passed; image inspected. `output/windows/latest.json` now references build `20261026T182449730Z-4bec4b94`. Portable ZIP90entries/118467955bytes passed full CRC and SHA-256 in `output/qa/delivery.json`. Old0.1 outputs preserved. Eight additional police/truck captures verified with immutable rendering atbothresolutions. Plan:`docs/superpowers/plans/2026-10-26-first-playtest.md` complete.

## Completed: reliable foundation0.3 after second human playtest (human acceptance pending)

User chose reliable traffic/police/fork tests first; own cinematic escalation follows. Explicit steering: use Velvet Cruise experience, research Test Drive II police, credit escalation to user. Original manual research and direct read-only Velvet track/race/Plus QA inspection recorded in `docs/TEST-DRIVE-II-RESEARCH.md`. User's7images preserved in docs/references/2026-10-26; cockpitprofiles/graphics/fullDE-EN tracked in docs/BACKLOG.md. Newtesttargets docs/TESTPLAN-03.md.

Implemented: newtrafficmodule with commonshapeauthority src/vehicle-shapes.ts, immutable/swept/stablecontacts, postpolicecollisionpass, braking/horns, explicitrivalstylesandpenalties. Policeusesrealactor+audio, movingpatrol vsparkedradar, reachablemeetingarea fornormal/blockedshoulderstops and finitepatrollifetime. ShortYfork/sharedvisiblebendcues/behindarcadecamera/atlasmap. Rootmainwired5testlaunchers withsession-saveisolation. Format2 optionalnewfields validated; oldV1fixture retained. No changes to Velvet.

Independentreview reproduced4P2s afterinitialgreentests: completedrivalsinvalidatedsaves; wide/narrowshoulderattendancecoulddeadlock; runawaywatchingpatrolblockedlaterchecks+saves. Allfixed withregressions. Freshindependentrecheck:21naturalpulloverseach1ticket/samesafe60mactor/sirenoff; twofulllegalslowstageswithall5physicalservices,20savechecks+10exactrestorespassed. ReviewerfoundnoremainingP1/P2inrequestedfixscope.

After additionalusersteering, directVelvetCruise Race.yieldSafe adapted into active src/driving.ts withcompletecorridorreservation/1.8secprediction+unitconversion. KeepCannonballapprovedownpace. Freshroot136/136tests, TypeScript/Vite passed; fullstage786.78s,2physicalstops,0collisions/0tickets. Actualbrowserinput5launcherchecks passed: police8.68s/1ticket/gap60/siren0; fork24.35s; autoSundown18.92s; traffic25s; normalSavebyteequal. BrowserUI/render/injectedcontrollerchecks passed. Nativefinalbuild20261026T204741407Z-64a6515d passed/screenshotinspected. ZIP90entries/118474359bytes CRC/SHA-256passed. Currentlatest+deliverypointstofinal0.3; olderpackagespreserved. See reports/playtest-03.md forfreshproof. At the26October handoff no commits/push/publication had been requested. Humanplay/audio/deviceacceptancepending.

## Repository synchronization authorized2026-10-27

User requested committing and pushing the current version. Fresh136/136tests and TypeScript/Vite build passed. Origin was verified as the empty GitHub repository michaelingokahler-mordor/Cannonball; the existing branch is codex/pennsylvania-prototype. Commit scope is the complete0.3source, local assets/licenses, tests, build/QA tools and project documentation. Generated dist/output/native packages and dependencies remain ignored. This request does not publish a web build or create a GitHub Release.
