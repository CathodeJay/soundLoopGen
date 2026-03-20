# Phase 2: Sound Generation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement all catalog sounds and verify each plays correctly in isolation. Four noise types (white, pink, brown, grey) are synthesized algorithmically via AudioWorklet. Three weather sounds (rain, wind, thunder) play from public domain WAV samples with seamless looping. Each sound has an independently adjustable GainNode. Multiple sounds can play simultaneously. No mixer UI — a temporary dev interface (Play/Stop buttons per sound) is the only visual output; Phase 3 replaces it entirely.

</domain>

<decisions>
## Implementation Decisions

### Sample sourcing strategy
- **Noise types (white, pink, brown, grey):** algorithmic generation via AudioWorklet — no samples needed, zero copyright risk
- **Weather sounds (rain, wind, thunder):** public domain WAV files sourced by Claude from CC0/public domain archives
- Claude researches and identifies specific files with license documentation; user reviews, approves, and downloads them manually
- Plan includes a `checkpoint:human-verify` task where user approves the specific files before coding continues
- Files land in `public/samples/` (the placeholder directory created in Phase 1)

### Catalog entry schema
- Minimal shape: `{ id: string, label: string, type: 'noise' | 'sample' }`
- No paths in catalog — derived by convention (noise worklet: `/worklets/{id}-processor.js`, sample: `/samples/{id}.wav`)
- No default volume in catalog — hardcoded to 0.8 or similar in the audio node factory
- **Order:** noise types first (White, Pink, Brown, Grey), then weather (Rain, Wind, Thunder) — 7 entries total
- v1 sounds only — no indoor ambient stubs (fan, ventilation, fireplace added when actually implemented)

### Phase 2 test interface
- After Start overlay is dismissed, `#app` shows one row per catalog sound: `[Sound Name]  [▶ Play]  [■ Stop]`
- Play/Stop only — no volume slider; volume control (ENG-09) is verified via code path, not test UI
- This is a temporary dev scaffold — Phase 3 replaces it entirely with the real mixer UI
- Layout is purely functional: unstyled or minimal inline styles; no design investment needed

### Claude's Discretion
- AudioWorklet processor implementations for each noise type (pink/grey IIR filter coefficients)
- GainNode wiring and audio graph structure per sound
- How Play/Stop button state is managed (disabled states, active sound tracking)
- Sample format requirements (mono vs stereo, sample rate, bit depth) — recommend 44100Hz mono WAV to match AudioContext

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Core value, constraints, copyright safety constraint (hard requirement)
- `.planning/REQUIREMENTS.md` — ENG-02 through ENG-10 definitions
- `.planning/research/STACK.md` — AudioWorklet loading pattern, why files must live in public/worklets/
- `.planning/research/PITFALLS.md` — AudioWorklet process() return value pitfall, OfflineAudioContext sample rate, CC0 Content ID risk

### Phase 1 foundation
- `noise-loop-generator/src/audio/AudioEngine.js` — getContext() / ensureRunning() pattern; all Phase 2 audio nodes connect through this
- `.planning/phases/01-foundation/01-CONTEXT.md` — Established patterns (worklet directory, sampleRate constant)
- `.planning/phases/01-foundation/01-RESEARCH.md` — AudioWorklet architectural decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `noise-loop-generator/src/audio/AudioEngine.js` — `getContext()` and `ensureRunning()` are the entry points for all audio work in Phase 2. Every noise generator and sample player calls `ensureRunning()` before creating nodes.
- `noise-loop-generator/public/worklets/` — Empty directory (with .gitkeep) ready for AudioWorklet processor files
- `noise-loop-generator/public/samples/` — Empty directory (with .gitkeep) ready for CC0 WAV files
- `noise-loop-generator/src/data/catalog.js` — Empty array stub (`export const catalog = []`) ready to be populated

### Established Patterns
- AudioContext singleton: `getContext()` creates lazily, `ensureRunning()` resumes if suspended — all Phase 2 node factories follow this
- `sampleRate: 44100` is pinned — samples must match this rate (or be resampled); OfflineAudioContext in Phase 4 reads `audioCtx.sampleRate`
- AudioWorklet files in `public/worklets/` (static assets, not bundled) — reference via absolute URL `/worklets/filename.js`

### Integration Points
- Phase 2 populates `catalog.js` (7 entries); Phase 3 reads it to render mixer controls
- Phase 2 exports sound node factories from `src/audio/` (e.g., `createNoiseNode(id)`, `createSampleNode(id)`); Phase 3 calls these when toggling sounds
- The temporary dev test buttons live in `src/main.js` or a new `src/devUI.js`; Phase 3 replaces this section entirely
- Phase 4 (export) will re-use the same audio node factories — they must work both with the live AudioContext and OfflineAudioContext

</code_context>

<specifics>
## Specific Ideas

No specific references or UI inspirations discussed — approach is fully technical and open to standard Web Audio API patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Indoor ambient sounds (fan, ventilation, fireplace) are out of scope for Phase 2 and will be added in a future phase.

</deferred>

---

*Phase: 02-sound-generation*
*Context gathered: 2026-03-18*
