# Phase 3: Mixer - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Phase 2 dev test UI (Play/Stop buttons) with a real mixer. Each catalog sound gets a toggle (on/off) and an independent volume slider. A master volume slider controls overall output. All controls wire directly into the live audio graph via `soundManager.js`. No export controls — that's Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Sound list layout
- Vertical list of rows, one per catalog entry — same order as catalog (noise types first, then weather)
- No grouping headers — 7 sounds is short enough to scan without categories
- Each row contains: sound label + toggle control + volume slider
- No cards, no grid — single-column list is sufficient for a local tool

### Toggle interaction
- Each row has a dedicated toggle button (not click-on-label) — clearer affordance than an implicit click target
- Active state: row visually distinct (brighter/highlighted) vs inactive (dimmed)
- Toggling off calls `stopSound(id)`; toggling on calls `startSound(id)`
- Volume slider is disabled and visually greyed when the sound is inactive

### Volume slider behavior
- Slider range: 0.0 to 1.0
- Default value on first enable: use existing defaults from soundManager (`DEFAULT_GAIN_NOISE = 0.15`, `DEFAULT_GAIN_SAMPLE = 0.8`)
- Volume is remembered per sound — toggling off and back on restores the last-set value (hold in a JS state map, don't reset to default on re-enable)
- Slider calls `setGain(id, value)` on `input` event (live update while dragging)

### Master volume
- Placed below the sound list, separated by a visible divider
- Same slider style as per-sound sliders but labeled "Master Volume"
- Default: 1.0 (full)
- Wired to a single master GainNode inserted between all sound gains and `ctx.destination`
- Range: 0.0 to 1.0

### Claude's Discretion
- Exact CSS styling (colors, spacing, slider appearance) — keep it functional and consistent with existing dark theme (`#1e1e1e` bg, `#ffffff` text)
- How the master GainNode is introduced into the audio graph (likely in AudioEngine.js or a new master gain helper)
- State management for per-sound volume memory (simple JS Map in main.js or a new mixer module)
- Whether to inline styles or introduce a CSS file — either is fine; no design system required

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audio layer (already built)
- `noise-loop-generator/src/audio/soundManager.js` — `startSound(id)`, `stopSound(id)`, `setGain(id, value)`, `isPlaying(id)` — these are the only audio calls the mixer UI needs
- `noise-loop-generator/src/audio/AudioEngine.js` — `getContext()` / `ensureRunning()` — needed to create the master GainNode
- `noise-loop-generator/src/data/catalog.js` — 7 entries `{ id, label, type }` — drives the sound list render

### Phase 2 UI to replace
- `noise-loop-generator/src/main.js` — `renderDevTestUI()` function is the thing being replaced; the Start overlay wiring stays

### Prior context
- `.planning/phases/02-sound-generation/02-CONTEXT.md` — established patterns and audio graph decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### What the mixer replaces
`renderDevTestUI()` in `src/main.js` (lines 26–85) creates the current per-sound Play/Stop rows. Phase 3 deletes this function and replaces it with a real mixer render call.

### Audio API surface
The mixer only needs these four calls:
```js
await startSound(id)       // toggle on
stopSound(id)              // toggle off
setGain(id, value)         // slider input
isPlaying(id)              // read state for initial render
```

### Master GainNode
Does not exist yet. Phase 3 must introduce it. Pattern: create once after `ensureRunning()`, store in AudioEngine or a new mixer module, insert between per-sound gain nodes and `ctx.destination`. All `gainNode.connect(ctx.destination)` calls in `soundManager.js` must route through the master gain instead.

### Existing dark theme tokens
From `index.html`:
- Background: `#1e1e1e` (body), `#111111` (overlay)
- Text: `#ffffff`
- Border: `#444` / `#2a2a2a`
- Active/positive accent: `#4caf50` (used on active Play button in dev UI)

</code_context>

<deferred>
## Deferred Ideas

None raised during discussion.

</deferred>

---

*Phase: 03-mixer*
*Context gathered: 2026-03-19*
