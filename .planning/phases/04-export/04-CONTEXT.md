# Phase 4: Export - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

User configures an export duration, triggers rendering via OfflineAudioContext, and downloads a seamlessly-looping WAV file. The exported file must loop gaplessly when imported into a video editor. No new sounds, no new mixer features — export only.

</domain>

<decisions>
## Implementation Decisions

### Export section placement
- Sits below the master volume section, separated by a second divider
- Layout: "Export" label row, then a single row with the duration dropdown + "Export WAV" button side-by-side
- Consistent with the mixer: label on the left, control on the right

### Duration selection
- `<select>` dropdown with three options: 30 seconds / 1 minute / 2 minutes
- Default pre-selected value: 30 seconds
- Dropdown sits to the left of the Export WAV button on the same row

### Gapless looping technique
- OfflineAudioContext renders the same audio graph as the live context (same worklets, same samples, same gains)
- For noise types: statistically gapless by nature — no waveform phase at cut point
- For sample sounds: **tail crossfade** — render `duration + overlap`, then crossfade the tail back onto the head before writing the WAV
- Crossfade duration: **Claude's discretion** — pick empirically what sounds seamless (likely 1-2 seconds)
- The exported file's nominal length matches the selected duration (30s / 60s / 120s)

### Export button states
- **Default (sounds playing):** `[ Export WAV ]` — enabled, normal style
- **No sounds playing:** `[ Export WAV ]` — disabled (greyed), with inline hint text below: "⚠️ Turn on at least one sound to export"
- **Rendering:** `[ Rendering... ]` — disabled while OfflineAudioContext processes
- **Done:** Button resets silently to default; file download triggers automatically (no success message)

### Claude's Discretion
- Exact crossfade duration (pick empirically — try 1-2 seconds)
- WAV encoding implementation (Float32 → 16-bit PCM interleave, or keep as Float32 WAV — whichever is more compatible with video editors)
- Filename format for the download (e.g. `noise-mix-30s.wav`)
- Whether the OfflineAudioContext worklet re-registration across multiple exports in one session needs special handling (noted as a known unknown — test empirically)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audio layer (already built)
- `noise-loop-generator/src/audio/AudioEngine.js` — `getContext()` / `ensureRunning()` / `getMasterGain()` — export must match same sample rate (44100 Hz pinned here)
- `noise-loop-generator/src/audio/soundManager.js` — `startSound(id)`, `stopSound(id)`, `setGain(id, value)`, `isPlaying(id)` — export needs to replicate this graph in OfflineAudioContext; review worklet/sample setup patterns here
- `noise-loop-generator/src/data/catalog.js` — 7 entries `{ id, label, type }` — drives which sounds to render in export

### Mixer UI (already built — export section appends to it)
- `noise-loop-generator/src/main.js` — `renderMixer()` function; export section is appended after master volume section in the same DOM flow

### Prior context
- `.planning/phases/03-mixer/03-CONTEXT.md` — established layout patterns and audio graph decisions (master GainNode, setTargetAtTime smoothing, volumeMap)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getMasterGain()` in AudioEngine.js — the master GainNode all per-sound gains route through. Export must insert its OfflineAudioContext equivalent at the same position in the graph.
- `volumeMap` in main.js — Map of `id -> number` holding the current per-sound volume. Export reads these values to match the live mix.
- `sampleBuffers` Map in soundManager.js — cached AudioBuffers from first fetch. OfflineAudioContext needs its own `ctx.decodeAudioData()` call (buffers are context-specific and cannot be shared across AudioContext instances).

### Established Patterns
- Lazy singleton pattern: `getContext()` / `getMasterGain()` — export should follow the same pattern for the OfflineAudioContext (create once per export call, not cached)
- AudioWorklet registration: `workletReady` Map prevents duplicate `addModule()` — OfflineAudioContext is a separate context; worklets must be re-registered for it. Test empirically whether multiple exports in one session cause issues.
- Convention-based paths: `/worklets/{id}-noise-processor.js` for noise, `/samples/{id}.wav` for samples — same URLs work for OfflineAudioContext fetch

### Integration Points
- Export section renders into `#app` div, appended after `#master-volume` — same DOM pattern as `renderMixer()`
- Export reads `volumeMap` (currently local to main.js) — may need to export it or pass it in
- Export reads `isPlaying(id)` to know which sounds to include in the render
- Export calls `getMasterGain().gain.value` to replicate master volume level in the OfflineAudioContext

</code_context>

<specifics>
## Specific Ideas

- Layout confirmed visually:
  ```
  [ Sound list ]
  ─────── divider ───────
  Master Volume  [====]
  ─────── divider ───────
  Export  ┌───────────────┐  [ Export WAV ]
          | 30 seconds  ▾ |
          └───────────────┘
  ⚠️ Turn on at least one sound to export  ← only when no sounds active
  ```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-export*
*Context gathered: 2026-03-20*
