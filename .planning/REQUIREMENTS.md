# Requirements: Noise Loop Generator

**Defined:** 2026-03-18
**Core Value:** Generate a seamlessly-looping WAV file from a mix of calming sounds that can be dropped straight into a video editor.

## v1 Requirements

### Audio Engine

- [x] **ENG-01**: App initializes AudioContext on first user gesture (no silent autoplay failure)
- [x] **ENG-02**: White noise is synthesized in real-time via AudioWorklet
- [x] **ENG-03**: Pink noise is synthesized in real-time via AudioWorklet
- [x] **ENG-04**: Brown noise is synthesized in real-time via AudioWorklet
- [x] **ENG-05**: Grey noise is synthesized in real-time via AudioWorklet
- [x] **ENG-06**: Rain sound plays from a CC0 WAV sample with seamless looping
- [x] **ENG-07**: Wind sound plays from a CC0 WAV sample with seamless looping
- [x] **ENG-08**: Thunder sound plays from a CC0 WAV sample with seamless looping
- [x] **ENG-09**: Each sound has an independently adjustable gain (volume)
- [x] **ENG-10**: Multiple sounds can play simultaneously

### Mixer UI

- [x] **UI-01**: User sees a catalog of all available sounds with labels
- [x] **UI-02**: User can toggle each sound on/off with a play/pause control
- [x] **UI-03**: User can adjust each sound's volume with a slider
- [x] **UI-04**: User can control master output volume
- [x] **UI-05**: Active sounds are visually distinct from inactive sounds

### Export

- [x] **EXP-01**: User can export the current mix as a WAV file
- [x] **EXP-02**: User can select export duration before downloading (30s / 1min / 2min)
- [x] **EXP-03**: Exported WAV file loops gaplessly when imported into a video editor
- [x] **EXP-04**: Export uses the same sample rate as the live AudioContext (no resampling artifacts)

## v2 Requirements

### Audio Engine

- **ENG-V2-01**: Indoor ambient sounds (fan, ventilation, fireplace) via CC0 samples
- **ENG-V2-02**: LFO volume drift per sound (gentle natural oscillation)

### Mixer UI

- **UI-V2-01**: User can save and reload named presets
- **UI-V2-02**: Mix state is encoded in URL for sharing

### Export

- **EXP-V2-01**: MP3 export option (with gapless header support, if verified)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 1-hour rendered exports | ~600MB WAV, long render time — video editor looping is the correct approach |
| River / ocean / water sounds | Not selected for v1 — defer to v2 |
| Backend / server | Local-only tool, no server needed |
| User accounts | No multi-user requirement |
| Mobile-optimized UI | Desktop use case (video production workflow) |
| Real-time collaboration | Out of scope for personal tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 1 | Complete |
| ENG-02 | Phase 2 | Complete |
| ENG-03 | Phase 2 | Complete |
| ENG-04 | Phase 2 | Complete |
| ENG-05 | Phase 2 | Complete |
| ENG-06 | Phase 2 | Complete |
| ENG-07 | Phase 2 | Complete |
| ENG-08 | Phase 2 | Complete |
| ENG-09 | Phase 2 | Complete |
| ENG-10 | Phase 3 | Complete |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 3 | Complete |
| UI-04 | Phase 3 | Complete |
| UI-05 | Phase 3 | Complete |
| EXP-01 | Phase 4 | Complete |
| EXP-02 | Phase 4 | Complete |
| EXP-03 | Phase 4 | Complete |
| EXP-04 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*
