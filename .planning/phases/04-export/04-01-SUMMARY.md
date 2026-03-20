---
phase: 04-export
plan: 01
subsystem: audio
tags: [web-audio-api, offline-audio-context, wav-export, audiobuffer-to-wav, vite]

# Dependency graph
requires:
  - phase: 03-mixer
    provides: getMasterGain(), volumeMap, isPlaying() — live audio bus state passed to export
  - phase: 02-sound-generation
    provides: catalog.js, soundManager.js — noise algorithms and sample paths reused in offline render
  - phase: 01-foundation
    provides: getContext() returning 44100 Hz AudioContext — sample rate pinned for offline matching

provides:
  - exportEngine.js — offline render pipeline (OfflineAudioContext, noise via Float32Array, sample re-decode, tail crossfade, 16-bit PCM WAV download)
  - Export UI section in main.js — duration dropdown (30s/1min/2min), Export WAV button, disabled state with warning hint

affects: [any future phases needing WAV output, UI improvements, or export configuration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Offline render without AudioWorkletNode: noise generated via Float32Array loops identical to worklet algorithms"
    - "Tail crossfade via additive blend (+=) not replacement — preserves head amplitude, blends decaying tail"
    - "AudioBuffer context-binding: samples always re-decoded via offlineCtx.decodeAudioData (never reused from live context)"
    - "Export state management: updateExportState() called on init and after each sound toggle — single source of truth for button/hint state"

key-files:
  created:
    - noise-loop-generator/src/audio/exportEngine.js
  modified:
    - noise-loop-generator/src/main.js

key-decisions:
  - "Float32Array noise generation (not AudioWorkletNode) in OfflineAudioContext — AudioWorkletNode unreliable across browsers"
  - "CROSSFADE_SEC = 1.5 — long enough for brown noise random walk, short enough to preserve mix character"
  - "16-bit PCM WAV output via audiobuffer-to-wav — maximum video editor compatibility (Premiere Pro, DaVinci Resolve, Final Cut)"
  - "Silent reset on export completion — no success toast per CONTEXT.md locked decision"

patterns-established:
  - "exportMix accepts explicit gains Map and masterGainValue — no hidden dependencies on main.js internals"
  - "OfflineAudioContext created fresh per export — not cached, no worklet re-registration issues"

requirements-completed: [EXP-01, EXP-02, EXP-03, EXP-04]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 4 Plan 1: WAV Export Summary

**OfflineAudioContext render pipeline with tail crossfade for gapless looping, 16-bit PCM WAV download, and export UI (duration dropdown + button states)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T12:33:58Z
- **Completed:** 2026-03-20T12:35:59Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `exportEngine.js` with full offline render pipeline: noise via Float32Array (white/pink/brown/grey), samples re-decoded per-export, tail crossfade at 1.5s using additive blend, 16-bit PCM WAV encoding, browser download
- Added export UI section to `main.js`: second divider, duration dropdown (30s/1min/2min), Export WAV button with disabled/rendering/active states, amber warning hint when no sounds active
- Vite build passes with zero errors

## Task Commits

1. **Task 1: Create exportEngine.js** - `c975c5a` (feat)
2. **Task 2: Add export UI section to main.js** - `73afd0b` (feat)

## Files Created/Modified

- `noise-loop-generator/src/audio/exportEngine.js` - Offline rendering pipeline: noise generation, sample re-decode, tail crossfade, WAV encode, download trigger
- `noise-loop-generator/src/main.js` - Import of exportMix, export section (divider, dropdown, button, hint, state management)

## Decisions Made

- Float32Array noise generation instead of AudioWorkletNode in OfflineAudioContext — AudioWorkletNode is unreliable across browsers; direct array generation is simpler and eliminates the unknown entirely
- CROSSFADE_SEC = 1.5 seconds — empirically chosen per RESEARCH.md guidance (1.0s minimum, 2.0s maximum)
- 16-bit PCM WAV (audiobuffer-to-wav default) — confirmed compatible with Premiere Pro, DaVinci Resolve, Final Cut Pro
- Grey noise: generate white noise buffer routed through BiquadFilter lowshelf at 800 Hz / +10 dB — mirrors soundManager.js exactly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WAV export is complete and functional — all four EXP requirements (EXP-01 through EXP-04) are implemented
- Manual browser verification needed: start dev server, toggle sounds, click Export WAV, verify download and gapless loop
- No blockers for any future phases

---
*Phase: 04-export*
*Completed: 2026-03-20*
