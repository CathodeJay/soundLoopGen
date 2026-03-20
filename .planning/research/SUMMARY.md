# Project Research Summary

**Project:** Browser-based noise loop generator
**Domain:** Browser-based audio synthesis and ambient sound mixer with WAV export
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

This is a local-only browser app that lets users mix ambient sounds (synthesized noise + CC0 sample-based sounds) and export seamlessly-loopable WAV files for use in video editors. The recommended approach uses Vite 8 + Vanilla JS with the browser-native Web Audio API as the sole audio engine — no frameworks, no heavy WASM bundles. The architecture is clean: a plain-JS pub/sub state layer drives an `AudioContext`-based graph for live preview, and a separate `OfflineAudioContext` reconstructs the same graph faster-than-realtime for export. The only non-trivial library dependency for v1 is `audiobuffer-to-wav` (1 package, 30 lines of code equivalent).

The key insight from research is that WAV export — not feature breadth — is the entire reason this tool exists over competitors like Noisli or myNoise. None of the major ambient sound tools offer audio export. This is the single differentiator and must be treated as a first-class P1 feature, not an afterthought. WAV is strictly superior to MP3 for this use case: MP3 encoding adds silent padding at file boundaries that breaks seamless looping in video editors — defer MP3 to v2 at the earliest.

The primary risks are all Web Audio API mechanics rather than product risks: `AudioContext` autoplay policy must be handled explicitly from day one; `AudioWorkletProcessor.process()` must return `true` to keep noise generators alive; and `OfflineAudioContext` must match the live context's sample rate exactly or exports will play at wrong speed or with artifacts. All of these are well-documented, easy to prevent with correct patterns, and catastrophic to retrofit if ignored.

## Key Findings

### Recommended Stack

The stack is deliberately minimal. Vite 8 (Rolldown-based, 10-30x faster builds than Webpack, Node 20.19+ required) provides the dev server and build tool. The audio engine is 100% browser-native Web Audio API — `AudioWorklet` for noise synthesis on the audio rendering thread, `AudioBufferSourceNode` with `loop: true` for sample playback, and `OfflineAudioContext` for export. The only library dependency for v1 is `audiobuffer-to-wav@1.0.0` (stable for 10 years, WAV format is frozen). MP3 export, if added in v2, should use `@breezystack/lamejs` (ESM fork — the original `lamejs` npm package has a known `MPEGMode` ReferenceError bug and must never be used).

**Core technologies:**
- **Vite 8**: Dev server + build tool — framework-agnostic, first-class vanilla template, Node 20.19+ required
- **Vanilla JS / TypeScript (ES2022+)**: Application language — no framework overhead needed; Web Audio nodes map cleanly to plain JS objects
- **Web Audio API (browser-native)**: Audio synthesis, routing, mixing, gapless looping — the only viable in-browser audio graph API
- **AudioWorklet (browser-native)**: Noise generation on dedicated audio thread — mandatory replacement for deprecated `ScriptProcessorNode`
- **OfflineAudioContext (browser-native)**: WAV export rendering faster-than-realtime — standard pattern, no library needed
- **`audiobuffer-to-wav@1.0.0`**: WAV encoding from `AudioBuffer` — zero dependencies, format is stable; alternatively inline 30 lines

**What not to use:**
- `ScriptProcessorNode` — deprecated, main-thread, causes glitches under any UI activity
- `<audio loop>` element — 15-year-old unfixed browser gap at loop boundary
- `MediaRecorder` — outputs WebM/Ogg, non-deterministic timing, real-time recording only
- `ffmpeg.js` / Tone.js — massive overkill for this scope
- Original `lamejs` npm package — known ReferenceError bug, no ESM

### Expected Features

Audio export to seamlessly loopable WAV is the entire value proposition of this tool. Without it, the product is just a worse Noisli. Every other feature exists to enable and frame the export workflow.

**Must have (table stakes):**
- Sound catalog: 4 noise types (white, pink, brown, grey) + rain, wind, thunder, fan, ventilation, fireplace — 10 sounds minimum
- Per-sound volume slider — the core mixing interaction; without it there is no "mixer"
- Master volume control — basic usability
- Play/pause per sound — users need to audition sounds in isolation
- Global play/pause — "stop everything" is a universal expectation
- Seamless loop preview — the product's core promise; non-seamless = broken
- Audio export to WAV (30s / 1min / 2min) — the reason this tool exists
- Export duration selector — different loop lengths for different use cases

**Should have (differentiators):**
- Per-sound volume animation (LFO drift, ±15%) — myNoise's killer feature, prevents static-feeling soundscapes
- Noise color descriptions/tooltips — users do not know what "brown noise" means
- URL-encoded state / shareable mix — lets users return to a mix without reconfiguring

**Defer (v2+):**
- MP3 export — only add if WAV file size is a real pain point; MP3 breaks seamless loops
- Session presets with localStorage — adds schema/versioning complexity
- Additional sound categories (café, city, office)
- River/water sounds (explicitly deferred per project constraints)

### Architecture Approach

The architecture has three layers: a UI layer of plain DOM components, a plain-JS pub/sub AppState as the single source of truth, and an Audio Engine that owns the `AudioContext` and keeps the node graph in sync with state changes. Export is intentionally isolated in a separate `ExportService` that reconstructs the graph in `OfflineAudioContext` with no side effects on live playback. The audio graph separates noise channels (AudioWorkletNode + IIRFilterNode + GainNode) from sample channels (AudioBufferSourceNode + GainNode), both feeding a master GainNode and optional DynamicsCompressor before `AudioContext.destination`. Sample files live in `public/samples/` and worklet scripts in `public/worklets/` — both served as Vite static assets.

**Major components:**
1. **AppState** — plain JS pub/sub object; single source of truth for channels, volumes, mute states, master volume
2. **AudioEngine** — owns `AudioContext`; creates/destroys node chains; syncs graph to state via `gainNode.gain.setTargetAtTime()` for click-free transitions
3. **WorkletLoader + NoiseNode** — registers AudioWorklet module; creates noise source → IIR color filter → per-channel gain chains
4. **SampleLoader + SampleNode** — fetches + decodes `.wav` files at startup; creates `AudioBufferSourceNode` with `loop: true`
5. **ExportService** — reconstructs full graph in `OfflineAudioContext`; encodes to WAV; triggers download
6. **UI Layer (CatalogPanel, ChannelStrip, ExportPanel)** — DOM components that subscribe to AppState and manage their own subtrees only

**Key data flow:**
- User action → UI dispatches to AppState → AppState notifies AudioEngine → AudioEngine syncs live graph
- Export: ExportService reads AppState + SampleLoader cache → reconstructs OfflineAudioContext graph → renders → WAV download

### Critical Pitfalls

1. **AudioContext autoplay / suspended state** — `AudioContext` created before a user gesture starts in `"suspended"` state. App loads, play is clicked, nothing happens. Fix: always guard playback with `if (ctx.state === 'suspended') await ctx.resume()`. Must be in audio engine bootstrap from day one — retrofitting is painful.

2. **`AudioWorkletProcessor.process()` not returning `true`** — noise generators silently stop after a few seconds with no console error. The return value of `process()` controls the node's active source flag. Every noise processor must unconditionally `return true`. Catch this in the AudioWorklet phase before wiring to the full graph.

3. **`<audio loop>` element for preview** — produces a 50–200ms audible gap at the loop boundary on all browsers (15-year-old unfixed bug). Use `AudioBufferSourceNode` with `loop: true` exclusively. This is a foundational architectural choice — wrong from day one means a full rewrite.

4. **OfflineAudioContext sample rate mismatch** — if `OfflineAudioContext` is created with a hardcoded rate different from the live `AudioContext` (which defaults to system rate, often 48000 Hz), exports play at wrong speed with resampling artifacts. Always use `audioCtx.sampleRate` dynamically; pin the live context to an explicit rate at startup.

5. **AudioNode memory leak (no disconnect)** — `AudioBufferSourceNode` is one-use; stopping it without calling `.disconnect()` leaves it in the graph. Over many toggle cycles, AudioNode count and CPU grow. Every `.stop()` must be paired with `.disconnect()`. One line of code, never skip it.

6. **CC0 sample licensing** — some Freesound samples labeled CC0 have been re-uploaded to commercial libraries and registered with YouTube Content ID. Verify per-file license at download time; prefer algorithmic synthesis over samples where possible.

## Implications for Roadmap

The architecture research provides an explicit build order with clear dependency rationale. The recommended phase structure follows that dependency chain exactly, front-loading audio correctness before any UI work.

### Phase 1: Project Scaffolding and Audio Bootstrap

**Rationale:** Everything depends on the dev environment being correct and `AudioContext` being properly initialized. The AudioWorklet file placement in `public/worklets/` (not `src/`) must be established before any audio code is written. Autoplay handling must be built first — retrofitting it later affects every playback path.

**Delivers:** Vite 8 project scaffold; `AudioContext` initialized on user gesture with correct `sampleRate: 44100` pinned; AudioWorklet module loaded and verified; no 404 on worklet file; `audioCtx.state` transitions logged.

**Addresses features:** Audio engine prerequisite for all sound features.

**Avoids pitfalls:** AudioContext suspended state (Pitfall 1), AudioWorklet 404 in Vite (integration gotcha), sample rate mismatch foundation (Pitfall 5).

### Phase 2: Noise Synthesis (AudioWorklet)

**Rationale:** Synthesized noise (white/pink/brown/grey) has no external asset dependencies and fully exercises the AudioWorklet pipeline. Build and validate this in isolation before adding sample complexity. The `process()` return value pitfall must be caught here, not discovered after wiring the full graph.

**Delivers:** All 4 noise types generating correctly; `AudioWorkletProcessor` returning `true`; IIR/Biquad color filters producing audibly distinct noise characters; noise playing continuously for 60+ seconds without stopping.

**Implements:** WorkletLoader, NoiseNode, noise-processor.js worklet.

**Avoids pitfalls:** AudioWorklet `process()` not returning `true` (Pitfall 3), `ScriptProcessorNode` usage (Pitfall 7).

### Phase 3: Sample Playback and Asset Acquisition

**Rationale:** CC0 sample sourcing (Freesound.org) must be done before coding sample playback, as license verification takes time and wrong samples cannot be shipped. SampleLoader is independent of the noise system and can be built once samples are on hand.

**Delivers:** CC0-verified WAV samples for rain, wind, thunder, fan, ventilation, fireplace in `public/samples/`; per-file license documentation; SampleLoader decoding all samples at startup; `AudioBufferSourceNode` with `loop: true` playing gaplessly.

**Implements:** SampleLoader, SampleNode.

**Avoids pitfalls:** `<audio loop>` element gap (Pitfall 2), CC0 licensing and Content ID risks (integration gotcha).

### Phase 4: Audio Engine and Live Mixing

**Rationale:** With both noise nodes and sample nodes working independently, wire them into a unified `AudioContext` graph with per-channel `GainNode`s and master gain. AppState pub/sub connects UI events to audio graph changes. This phase produces the first fully-working mix.

**Delivers:** All 10 sounds playing simultaneously; per-channel volume sliders controlling `GainNode` gain with smooth ramps; global mute/unmute; master volume; sound add/remove with correct node creation and cleanup (stop + disconnect).

**Implements:** AudioEngine, AppState, initial Channel Strip UI.

**Avoids pitfalls:** AudioNode memory leak (Pitfall 6), recreating AudioContext on state change (Anti-Pattern 2).

### Phase 5: UI Layer

**Rationale:** Build UI after the audio engine is verified working. UI should subscribe to AppState and never touch `AudioContext` directly. This phase adds the full sound catalog browser, per-channel controls, and visual feedback.

**Delivers:** Sound Catalog panel with all 10 sounds; per-channel strip (slider, play/pause, active state animation); global play/pause; master volume control; visual feedback (active card state, animated icons); noise color tooltips/descriptions.

**Implements:** CatalogPanel, ChannelStrip, ExportPanel shell.

**Addresses features:** All P1 table stakes features; P2 visual feedback; noise color descriptions.

### Phase 6: WAV Export

**Rationale:** Export is the final integration step. It depends on AppState (reads current mix), SampleLoader cache (AudioBuffer objects), and WorkletLoader (re-registers worklet in OfflineAudioContext). Build last because it reuses all prior pieces in a new context, and the loop seam logic must be validated in preview before it can be trusted in export.

**Delivers:** WAV export at 30s / 1min / 2min; `OfflineAudioContext` graph reconstruction matching live mix exactly; `audiobuffer-to-wav` encoding; file download trigger; progress indication; non-silent export validation (peak check before download).

**Implements:** ExportService, ExportPanel controls.

**Avoids pitfalls:** OfflineAudioContext sample rate mismatch (Pitfall 5), MP3 silent padding (Pitfall 4), export produces silent output (UX pitfall), MediaRecorder for export (Anti-Pattern 4).

### Phase 7: Polish and v1.x Features

**Rationale:** Once the core export workflow is validated end-to-end, layer in the differentiator features that make the experience feel premium rather than functional.

**Delivers:** Per-sound LFO volume drift (±15%, randomized phase per sound); URL-encoded state for shareable/restorable mixes; export UX refinements (waveform/peak indicator, clearer progress).

**Addresses features:** P2 and P3 features; the myNoise-style "living soundscape" feel.

### Phase Ordering Rationale

- Audio correctness before UI correctness — it is easier to build UI on top of a working audio engine than to debug audio through a UI layer.
- Synthesized noise before sample playback — no asset dependencies, exercises the entire AudioWorklet pipeline in isolation.
- Assets before asset-dependent code — CC0 verification takes human time; start it in parallel with Phase 2.
- Export last — it is a read of the complete system state; all prior phases must be correct for export to be trustworthy.
- This order matches the dependency chain from ARCHITECTURE.md exactly: AppState → WorkletLoader → SampleLoader → AudioEngine → UI → ExportService.

### Research Flags

Phases with well-documented patterns (skip deeper research):
- **Phase 1 (Scaffolding):** Vite 8 vanilla template setup is fully documented; AudioContext bootstrap is MDN-official.
- **Phase 2 (Noise synthesis):** AudioWorklet pattern is well-documented in MDN and Chrome Labs samples; IIR pinking filter coefficients are available in existing implementations.
- **Phase 4 (Audio Engine):** Web Audio graph patterns are spec-documented and heavily used; GainNode pub/sub sync is a standard pattern.
- **Phase 6 (WAV Export):** OfflineAudioContext + audiobuffer-to-wav pipeline is straightforward; pattern is documented.

Phases that may need additional research during planning:
- **Phase 3 (Asset acquisition):** Freesound CC0 sample quality varies significantly; finding high-quality, verified-CC0 samples for all 6 sound types may require iterative search. Content ID risk requires cross-referencing across sources.
- **Phase 7 (LFO drift):** The exact LFO implementation (rate range, depth, randomization approach) that produces a pleasant vs. distracting result needs experimentation; myNoise does not document its approach.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies are browser-native APIs with MDN-official documentation; only MP3 encoder library choice is MEDIUM (WebSearch only for `@mediabunny/mp3-encoder`) |
| Features | HIGH | Based on direct analysis of 5+ competitor products plus official MDN best practices; feature set is well-scoped |
| Architecture | HIGH | Web Audio API architecture verified against MDN official docs and W3C spec; patterns confirmed through multiple independent sources |
| Pitfalls | HIGH | Web Audio API mechanics from MDN official + spec issues (HIGH); CC0 licensing nuances from Freesound forums (MEDIUM) |

**Overall confidence:** HIGH

### Gaps to Address

- **MP3 encoder library selection (v2):** `@mediabunny/mp3-encoder` is LOW confidence (WebSearch only, no Context7 verification). If MP3 export is prioritized in v2, verify the API against its current npm page before committing to it. `@breezystack/lamejs` is MEDIUM confidence and the safer default.

- **CC0 sample availability:** Research confirmed CC0 samples exist on Freesound for all required sound types, but individual sample quality and authentic CC0 status (vs. re-uploaded commercial samples) must be verified manually during Phase 3. Budget time for this — Content ID disputes take weeks to resolve.

- **OfflineAudioContext worklet re-registration:** The pattern of re-registering an AudioWorklet module in a new `OfflineAudioContext` is documented but the behavior if the module is already registered in a prior offline context (across multiple exports in one session) should be tested empirically. The spec implies `addModule` is idempotent per context, not globally.

- **Pink/grey noise filter coefficients:** STACK.md cites a MEDIUM-confidence source for pink noise IIR filter coefficients. The exact 7-coefficient approximation should be validated aurally during Phase 2. Grey noise (equal-loudness inverse filter) has less documentation — may need to derive from A-weighting curves.

## Sources

### Primary (HIGH confidence)
- MDN Web Audio API — AudioContext, OfflineAudioContext, AudioWorklet capabilities
- MDN AudioWorkletProcessor `process()` — active source flag, return value, keepAlive behavior
- MDN AudioBufferSourceNode — gapless looping, `loop`/`loopStart`/`loopEnd`
- MDN Autoplay Guide for Web Audio APIs — AudioContext autoplay policy, `resume()` pattern
- MDN AudioNode `disconnect()` — disconnect pattern, memory management
- W3C Web Audio API 1.1 spec — authoritative node graph, summing junctions, modular routing
- Vite 8 announcement — current version, Node requirements
- Chrome Autoplay Policy (Chrome Developers Blog) — user activation model
- Freesound CC0 library — CC0 ambient sound availability

### Secondary (MEDIUM confidence)
- Daniel Barta, "Creating Audio on the Web Is Easy—Until It's Time to Export" — OfflineAudioContext limitations, createMediaElementSource removal
- codestudy.net, "How to Seamlessly Loop Sound with Web Audio API" — AudioBufferSourceNode gapless loop pattern
- Ryosuke, "Generating Pink Noise for Audio Worklets" (2025) — pink noise IIR filter pattern
- `audiobuffer-to-wav@1.0.0` npm — version 1.0.0 stable
- `@breezystack/lamejs` npm — ESM fork of lamejs
- WebAudio/web-audio-api-v2 Issue #69 — AudioWorkletProcessor active source flag behavior
- WebAudio/web-audio-api Issue #904 — memory leak from undisconnected nodes
- Freesound CC0 Attribution FAQ + YouTube monetization forum — Content ID risk
- Noisli, myNoise, A Soft Murmur, Moodist — direct product feature analysis

### Tertiary (LOW confidence)
- `@mediabunny/mp3-encoder` npm — WASM MP3 encoder, active maintenance (WebSearch only; verify before v2 use)

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
