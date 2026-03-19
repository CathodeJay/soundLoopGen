# Roadmap: Noise Loop Generator

## Overview

Four phases that build the tool from the audio foundation up to export. Phase 1 bootstraps the project and audio context correctly — the most dangerous phase to get wrong. Phase 2 makes all sounds actually work in isolation. Phase 3 wires them into a full mixer with UI. Phase 4 delivers the entire reason this tool exists: seamlessly-loopable WAV export.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Project scaffold + AudioContext bootstrap with correct sample rate and autoplay handling (completed 2026-03-19)
- [ ] **Phase 2: Sound Generation** - All noise types synthesized via AudioWorklet; all CC0 samples loaded and looping gaplessly
- [ ] **Phase 3: Mixer** - Full mixing UI with per-sound controls, master volume, and live audio graph wired to state
- [ ] **Phase 4: Export** - WAV export at 30s/1min/2min via OfflineAudioContext; file loops gaplessly in video editors

## Phase Details

### Phase 1: Foundation
**Goal**: The project runs locally and the AudioContext initializes correctly on first user gesture with no silent-failure risk
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01
**Success Criteria** (what must be TRUE):
  1. Opening the app in a browser shows a UI that responds to a user click
  2. After the first user gesture, AudioContext state transitions from suspended to running (visible in console or DevTools)
  3. No 404 errors on AudioWorklet module load
  4. App runs from `npm run dev` on macOS without Docker or complex setup
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md — Scaffold Vite project and implement AudioContext bootstrap (ENG-01)

### Phase 2: Sound Generation
**Goal**: Every sound in the catalog plays correctly in isolation — synthesized noise runs continuously, samples loop without audible gaps
**Depends on**: Phase 1
**Requirements**: ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07, ENG-08, ENG-09, ENG-10
**Success Criteria** (what must be TRUE):
  1. All four noise types (white, pink, brown, grey) play and sound audibly distinct from each other
  2. Noise generators run continuously for 60+ seconds without stopping
  3. Rain, wind, and thunder samples play with no audible gap at the loop boundary
  4. All CC0 sample files have verified license documentation
  5. Per-sound volume control works (adjusting gain produces audible change)
**Plans**: TBD

### Phase 3: Mixer
**Goal**: User can build a mix by layering any combination of sounds with individual volume controls and a master volume, all wired to the live audio graph
**Depends on**: Phase 2
**Requirements**: ENG-10, UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. User sees all available sounds in a catalog with labels and can toggle any sound on or off
  2. User can adjust each active sound's volume independently with a slider
  3. User can control master output volume
  4. Active sounds are visually distinct from inactive sounds in the UI
  5. Toggling a sound off stops it cleanly with no audio glitch; toggling it on resumes it
**Plans**: TBD

### Phase 4: Export
**Goal**: User can export the current mix as a WAV file that loops gaplessly when dropped into a video editor
**Depends on**: Phase 3
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
**Success Criteria** (what must be TRUE):
  1. User can choose export duration (30s, 1min, or 2min) before downloading
  2. Clicking export triggers a WAV file download
  3. The exported WAV file, when imported into a video editor and looped, plays without an audible gap at the loop boundary
  4. Exported audio matches the live mix (same sounds, same relative volumes)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete   | 2026-03-19 |
| 2. Sound Generation | 0/TBD | Not started | - |
| 3. Mixer | 0/TBD | Not started | - |
| 4. Export | 0/TBD | Not started | - |
