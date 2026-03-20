# Phase 1: Foundation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the Vite project scaffold and ensure AudioContext initializes correctly on first user gesture — no sound, no audio nodes, no UI beyond what's needed to trigger the context. This phase validates the project runs locally and the audio pipeline can start.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User expressed no preference on any implementation area — Claude has full flexibility on:

- **Bootstrap trigger**: Recommended approach is a persistent "▶ Start" button overlaying the UI on first load. The button dismisses after click, AudioContext transitions from suspended → running. This is the cleanest pattern for the autoplay constraint (MDN recommended approach).
- **Project structure**: Standard Vite vanilla JS layout:
  - `src/` — main app JS
  - `src/audio/` — AudioEngine, noise node factories
  - `public/worklets/` — AudioWorklet processor files (must be served as static assets, not bundled)
  - `src/data/catalog.js` — sound catalog definition (array of sound descriptors)
- **Package manager**: npm (default, no preference expressed)
- **Node version**: Whatever is current on user's macOS — no hard constraint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and the planning files below.

### Project planning
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — ENG-01 (the only requirement for this phase)
- `.planning/research/STACK.md` — Vite 8 setup, AudioWorklet loading pattern, why worklets must live in public/
- `.planning/research/PITFALLS.md` — AudioContext autoplay trap, AudioWorklet process() return value, OfflineAudioContext sample rate

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None yet — this phase establishes the patterns

### Integration Points
- Phase 1 output (AudioContext instance + initialized state) is the foundation every subsequent phase builds on
- The `AudioEngine` module initialized here will be imported by Phase 2 (sound nodes), Phase 3 (mixer UI), and Phase 4 (export)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint from research: AudioWorklet processor files MUST be served as static assets (in `public/worklets/`), not processed by Vite's bundler, because `audioContext.audioWorklet.addModule()` fetches them via URL.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-18*
