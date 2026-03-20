---
phase: 02-sound-generation
plan: 01
subsystem: audio
tags: [web-audio-api, audioworklet, webaudio, noise-synthesis, iir-filter]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: AudioContext singleton (getContext/ensureRunning) and public/worklets/ directory
provides:
  - 4 AudioWorklet noise processors (white, pink, brown, grey) in public/worklets/
  - Populated catalog.js with 7 entries (4 noise + 3 sample)
  - soundManager.js with startSound/stopSound/setGain/isPlaying API
  - Dev test UI in main.js rendering 7 Play/Stop rows after Start overlay dismissed
affects:
  - 02-02 (sample acquisition — soundManager sample path used by startSample)
  - 03-mixer-ui (replaces dev test UI; reads catalog; calls startSound/stopSound/setGain)
  - 04-export (reuses soundManager factories with OfflineAudioContext)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AudioWorkletNode creation pattern with once-per-id addModule() registration
    - IIR filter chain for grey noise A-weighting (createIIRFilter between source and gain)
    - AudioBufferSourceNode with loop=true for gapless sample playback
    - DEFAULT_GAIN constant (0.8) at node creation, adjustable via setGain()

key-files:
  created:
    - noise-loop-generator/public/worklets/white-noise-processor.js
    - noise-loop-generator/public/worklets/pink-noise-processor.js
    - noise-loop-generator/public/worklets/brown-noise-processor.js
    - noise-loop-generator/public/worklets/grey-noise-processor.js
    - noise-loop-generator/src/audio/soundManager.js
  modified:
    - noise-loop-generator/src/data/catalog.js
    - noise-loop-generator/src/main.js

key-decisions:
  - "Paul Kellett 7-element filter bank used for pink noise (coefficients from plan spec)"
  - "Grey noise = white noise source + A-weighting IIR filter on main thread (feedforward/feedback coefficients from plan spec)"
  - "Brown noise = leaky integrator on white noise (lastOut * 0.998 + white * 0.02, output * 3.5)"
  - "workletReady Map prevents duplicate addModule() calls across multiple startSound() invocations"
  - "sampleBuffers Map caches decoded AudioBuffers after first fetch to avoid re-downloading"
  - "Sample sounds fail gracefully with console error when WAV files not present (Plan 02 provides them)"

patterns-established:
  - "Noise worklet URL convention: /worklets/{id}-noise-processor.js (derived from catalog id)"
  - "Sample URL convention: /samples/{id}.wav (derived from catalog id)"
  - "Sound node lifecycle: startSound creates gainNode + source, stopSound disconnects all and deletes from activeNodes"
  - "Dev test UI renders from catalog array — 7 rows in fixed order (4 noise, 3 sample)"

requirements-completed: [ENG-02, ENG-03, ENG-04, ENG-05, ENG-09, ENG-10]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 2 Plan 01: Sound Generation Engine Summary

**Four AudioWorklet noise processors, soundManager start/stop/gain API, and 7-row dev test UI — core synthesis engine ready for Phase 3 mixer**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-19T22:36:24Z
- **Completed:** 2026-03-19T22:37:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created 4 AudioWorklet processor files in public/worklets/ with correct noise algorithms (white: PRNG, pink: Paul Kellett 7-element filter, brown: leaky integrator, grey: white noise source for IIR)
- Populated catalog.js with 7 entries (white/pink/brown/grey noise + rain/wind/thunder samples) using convention-based path derivation
- Built soundManager.js managing AudioWorkletNode and AudioBufferSourceNode lifecycles, with grey noise A-weighting IIR filter, gain control, and caching strategies
- Updated main.js to render 7 Play/Stop rows after Start overlay dismissed, per UI-SPEC (colors, typography, button states)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AudioWorklet processors and populate catalog** - `1042058` (feat)
2. **Task 2: Create soundManager.js and wire dev test UI in main.js** - `0c900fd` (feat)

## Files Created/Modified

- `noise-loop-generator/public/worklets/white-noise-processor.js` - White noise PRNG AudioWorklet processor
- `noise-loop-generator/public/worklets/pink-noise-processor.js` - Pink noise Paul Kellett 7-element filter bank processor
- `noise-loop-generator/public/worklets/brown-noise-processor.js` - Brown noise leaky integrator processor
- `noise-loop-generator/public/worklets/grey-noise-processor.js` - Grey noise white noise source (IIR applied main-thread)
- `noise-loop-generator/src/audio/soundManager.js` - Full sound lifecycle API (startSound/stopSound/setGain/isPlaying)
- `noise-loop-generator/src/data/catalog.js` - Populated with 7 entries (was empty stub)
- `noise-loop-generator/src/main.js` - Replaced Phase 1 bootstrap with Phase 2 dev test UI rendering

## Decisions Made

- Grey noise IIR filter applied on main thread via `createIIRFilter` rather than inside the worklet — keeps worklet simple and allows Phase 4 to reuse the same pattern with OfflineAudioContext
- `workletReady` map tracks per-id addModule() completion, preventing duplicate registration errors on stop/restart
- `sampleBuffers` map caches AudioBuffers after first fetch/decode — samples are only fetched once per session
- DEFAULT_GAIN of 0.8 matches CONTEXT.md spec ("hardcoded to 0.8 or similar")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Noise sounds (white, pink, brown, grey) fully playable — AudioWorklet processors and soundManager wired end-to-end
- Sample sounds (rain, wind, thunder) show in dev UI but throw fetch errors — Plan 02 provides CC0 WAV files to public/samples/
- Phase 3 mixer UI can import `startSound`, `stopSound`, `setGain`, `isPlaying` from soundManager.js and `catalog` from catalog.js directly
- Phase 4 export can reuse soundManager factory pattern with OfflineAudioContext (same addModule/connect pattern)

---
*Phase: 02-sound-generation*
*Completed: 2026-03-19*
