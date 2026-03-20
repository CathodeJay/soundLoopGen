---
phase: 03-mixer
plan: 01
subsystem: audio
tags: [web-audio-api, audio-graph, gain-node, master-volume]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: AudioEngine.js with getContext/ensureRunning lazy singleton pattern
  - phase: 02-sound-generation
    provides: soundManager.js with startSound/stopSound/setGain wired to catalog
provides:
  - getMasterGain() lazy GainNode singleton exported from AudioEngine.js
  - All per-sound gains routed through masterGain bus instead of ctx.destination
  - setGain uses 15ms setTargetAtTime smoothing to eliminate zipper noise
  - #app CSS constrained to max-width 480px
affects: [03-mixer-plan-02, phase-04-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Master GainNode bus: all per-sound gains connect to masterGain, not ctx.destination"
    - "setTargetAtTime(value, ctx.currentTime, 0.015) for zipper-noise-free gain transitions"

key-files:
  created: []
  modified:
    - noise-loop-generator/src/audio/AudioEngine.js
    - noise-loop-generator/src/audio/soundManager.js
    - noise-loop-generator/index.html

key-decisions:
  - "masterGain lazy singleton follows identical pattern to getContext() — only created on first call after ensureRunning()"
  - "15ms setTargetAtTime time constant chosen: imperceptibly fast to human ear but prevents zipper noise from rapid slider input events"
  - "Per-sound GainNodes connect to getMasterGain() not ctx.destination — single insertion point for global volume"

patterns-established:
  - "Audio bus pattern: insert GainNode between per-sound output and ctx.destination for any global control (volume, mute, etc.)"
  - "Smoothed gain changes: always use setTargetAtTime with 0.015 time constant instead of direct .value assignment"

requirements-completed: [ENG-10, UI-04]

# Metrics
duration: 1min
completed: 2026-03-20
---

# Phase 3 Plan 01: Master Gain Bus and Smoothed Gain Summary

**Master GainNode inserted between all per-sound gains and ctx.destination, enabling global volume control; setGain switched to 15ms setTargetAtTime to eliminate zipper noise**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-20T00:00:42Z
- **Completed:** 2026-03-20T00:01:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- AudioEngine.js now exports getMasterGain() as a lazy singleton — creates a GainNode at gain 1.0 connected to ctx.destination on first call
- All per-sound GainNodes in soundManager.js now connect to getMasterGain() instead of ctx.destination, enabling a global master volume bus
- setGain() switched from direct gain.value assignment to setTargetAtTime(value, ctx.currentTime, 0.015), eliminating zipper noise from rapid slider input events
- index.html #app constrained to max-width 480px per mixer layout spec

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getMasterGain() to AudioEngine.js and add max-width to #app** - `28a3397` (feat)
2. **Task 2: Route per-sound gains through masterGain and add setGain smoothing** - `99cb5b8` (feat)

## Files Created/Modified
- `noise-loop-generator/src/audio/AudioEngine.js` - Added masterGain null variable and exported getMasterGain() lazy singleton
- `noise-loop-generator/src/audio/soundManager.js` - Updated import to include getContext/getMasterGain, routed gainNode through getMasterGain(), replaced direct gain.value with setTargetAtTime smoothing
- `noise-loop-generator/index.html` - Added max-width: 480px to #app CSS rule

## Decisions Made
- getMasterGain() follows the same lazy singleton pattern as getContext() — no initialization at module load, created on first use after ensureRunning()
- 15ms time constant (0.015s) for setTargetAtTime: fast enough to feel instantaneous but eliminates the audible click/zipper from abrupt value jumps
- Single insertion point: only one gainNode.connect() call in startSound() needed changing — centralized routing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Master gain bus is wired and transparent at gain 1.0 — existing audio behavior unchanged
- getMasterGain() is ready for Phase 3 Plan 02 to connect the mixer UI master volume slider
- setGain smoothing is in place for per-sound sliders as well

---
*Phase: 03-mixer*
*Completed: 2026-03-20*
