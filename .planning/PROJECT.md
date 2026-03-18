# Noise Loop Generator

## What This Is

A local web app for generating, mixing, and exporting calming synthetic noise loops. Users layer multiple sound sources (noise types, weather, indoor ambient) with individual volume controls, preview seamless looping in-browser, and export short perfectly-looping audio files for use in YouTube ambient videos.

## Core Value

Generate a seamlessly-looping audio file from a mix of calming sounds that can be dropped straight into a video editor.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can play and preview individual sounds from the catalog
- [ ] User can layer multiple sounds simultaneously with per-sound volume sliders
- [ ] Sounds loop seamlessly in the browser preview
- [ ] User can export the mix as a short, seamlessly-loopable audio file (WAV/MP3)
- [ ] Noise types are algorithmically synthesized (white, pink, brown, grey)
- [ ] Weather and indoor ambient sounds use royalty-free / copyright-safe samples
- [ ] Sound catalog covers: noise types (white, pink, brown, grey), weather (rain, wind, thunder), indoor ambient (fan, ventilation, fireplace)

### Out of Scope

- River / water sounds — deferred to v2 (not selected for v1)
- Video export (MP4) — audio file is sufficient, YouTube upload handled by video editor
- Cloud deployment / multi-user — local use only
- Beat-matching or tempo sync — not needed for ambient noise
- User accounts / saved presets persistence beyond session — v2

## Context

- Personal tool, runs locally on user's machine (localhost)
- Target output: short seamless loops (30s–2min) exported as audio files, looped in video editing software for YouTube ambient videos
- Hybrid generation approach: pure Web Audio API synthesis for noise types (no copyright concerns), royalty-free samples for nature/ambient sounds
- Copyright safety is a hard constraint for samples — must be CC0, public domain, or self-generated
- No backend required for MVP — all synthesis happens client-side in the browser

## Constraints

- **Runtime**: Browser-only (no server needed) — must run from localhost or file:// without a build step, OR with a minimal dev server
- **Copyright**: All audio samples must be CC0/public domain or procedurally generated — no licensed samples
- **Portability**: Should run on macOS without Docker or complex setup
- **Export**: Audio export must produce a file that loops gaplessly when imported into video editors

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|------------|
| Web Audio API for synthesis | No copyright risk, real-time generation, runs in-browser | — Pending |
| Hybrid approach (synth + samples) | Noise types are trivially synthesizable; rain/fire realism benefits from samples | — Pending |
| Short loop export (30s–2min) | User loops in video editor — simpler than rendering 1-hour files | — Pending |
| Local-only, no backend | Personal tool, no deployment complexity needed | — Pending |

---
*Last updated: 2026-03-18 after initialization*
