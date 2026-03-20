# Feature Research

**Domain:** Browser-based ambient noise / sound mixer (local web app, audio export focus)
**Researched:** 2026-03-18
**Confidence:** HIGH — based on direct analysis of Noisli, myNoise, A Soft Murmur, Ambient Mixer, Moodist, and Web Audio API documentation

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Individual volume slider per sound | Every ambient mixer (Noisli, myNoise, A Soft Murmur) does this — it IS the core interaction | LOW | Range 0–100, default ~50, persists during session |
| Master volume control | Universal pattern — users need global loudness control without rebalancing individual sounds | LOW | Moves all sliders proportionally or applies gain at output node |
| Play / pause per sound | Users expect to toggle sounds on/off without losing their volume setting | LOW | Toggle state; mute vs. stop — stop and resume is better UX than mute |
| Sound catalog with labeled categories | Users browse by category (noise types, weather, indoor) — no catalog = no product | LOW | v1 catalog: white/pink/brown/grey noise, rain, wind, thunder, fan, ventilation, fireplace |
| Seamless looping in preview | Loops that click or pop are unusable — the seamless loop IS the product's core promise | MEDIUM | AudioBuffer loop flag for synthesized noise; crossfade for sample-based sounds (3–5s crossfade recommended for ambient) |
| Global play / pause | Stop everything at once — universal expectation | LOW | Single button halts all active AudioBufferSourceNodes |
| Visual feedback on active sounds | Users need to know which sounds are playing — animated icon, glow, highlighted card | LOW | CSS animation on active cards; no audio visualizer required for table stakes |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Audio export (WAV) — seamlessly loopable file | No competing browser mixer offers this as primary feature — this is the entire reason this tool exists vs. just using Noisli | HIGH | OfflineAudioContext renders the mix; loop seam must be gapless; WAV preferred over MP3 for video editor import quality |
| Algorithmically synthesized noise (white/pink/brown/grey) | Zero copyright risk, infinite variation, no file to load — other tools use samples for noise types too | MEDIUM | AudioBuffer filled with random samples; pink/brown via BiquadFilterNode or IIR filter; grey noise = white + perceptual weighting |
| Export duration selector (30s / 1min / 2min) | Users need different loop lengths for different use cases — unique to this tool | LOW | Drives OfflineAudioContext buffer length; expose as radio/select |
| Per-sound animation (subtle volume drift) | myNoise's killer feature — keeps soundscape from feeling static and mechanical | MEDIUM | LFO-style gain node that slowly modulates each sound's volume within a narrow range (±15%); randomized phase per sound |
| Exported file is gapless-loop-ready | A normal export just cuts audio; gapless means end-of-file connects to start-of-file without click — video editors loop these perfectly | HIGH | For synthesized noise: trivial (noise is stateless). For samples: requires crossfade-rendered seam baked into the exported buffer |
| Noise color preview label ("Brown noise is deeper, more calming than white") | Users don't know what "brown noise" means — contextual descriptions reduce decision friction | LOW | Static copy on hover / tooltip |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| MP3 export | Smaller file size, familiar format | MP3 encoding in-browser requires a JS encoder (lamejs) adding complexity; MP3 compression can introduce artifacts at loop points that break gapless looping in video editors | WAV export only — uncompressed, universally supported by video editors, no loop-point artifacts |
| 1-hour rendered file | YouTube ambient video is typically 1–3 hours of looped audio | Rendering 1 hour of audio in OfflineAudioContext takes substantial time and produces files of 600MB+ (WAV, stereo, 44.1kHz); unnecessary since video editors loop natively | Export short seamless loops (30s–2min); user loops the file in their video editor |
| Preset save / recall across sessions | Power users want to return to saved mixes | Requires localStorage schema, versioning, import/export UI — scope creep for v1 | In-session state only for v1; URL-encoded state (like myNoise) is the v1.x path |
| Real-time audio visualizer (waveform / spectrum) | Looks impressive, common in audio apps | Web Audio API AnalyserNode adds CPU overhead; visualizer doesn't add functional value for ambient noise use case | Simple CSS animation on active sound cards provides adequate visual feedback |
| Sound recording / custom sample upload | Power users want their own sounds | Copyright verification impossible for user uploads; adds file handling complexity, storage concerns | Curated CC0 catalog only — solves the copyright problem the tool exists to solve |
| Cross-fading between presets | Smooth transitions between saved scenes | Complex audio scheduling; not needed for a mixing/export tool | Manual slider adjustment is sufficient |
| Beat sync / tempo matching | Found in music production tools | Ambient noise has no tempo — feature is a category error | Not applicable |
| Video export (MP4) | "Complete" YouTube workflow | Requires video encoder (ffmpeg.wasm = large WASM binary), adds image/background management scope | Audio file only; user handles video wrap in their editor |

## Feature Dependencies

```
Sound Catalog
    └──requires──> Audio Engine (Web Audio API context, AudioBufferSourceNode per sound)
                       └──requires──> Browser AudioContext initialized on user gesture

Per-Sound Volume Slider
    └──requires──> Audio Engine
    └──requires──> GainNode per sound

Seamless Loop Preview
    └──requires──> Audio Engine
    └──requires──> Loop-safe audio buffers (synthesized noise: trivial; samples: crossfade baked in)

Audio Export
    └──requires──> Audio Engine (same graph, replayed in OfflineAudioContext)
    └──requires──> Seamless Loop Preview (loop seam logic must be shared)
    └──requires──> Export Duration Selector

Per-Sound Animation (volume drift)
    └──requires──> Per-Sound Volume Slider (enhances, uses same GainNode)
    └──enhances──> Seamless Loop Preview (makes the preview feel alive)

Master Volume
    └──requires──> Audio Engine
    └──enhances──> Per-Sound Volume Slider (operates on output GainNode, not individual ones)
```

### Dependency Notes

- **Audio Export requires Seamless Loop Preview:** The loop-seam logic (crossfade for samples, stateless buffer for noise) must work correctly in the preview before it can be trusted in export. Build and validate preview loop quality before wiring the OfflineAudioContext export path.
- **Audio Engine requires user gesture:** Web Audio API's AudioContext will be in `suspended` state until a user interaction (click/tap). This is a browser security constraint, not a bug. The first Play button click must call `audioCtx.resume()`.
- **Per-Sound Animation enhances Per-Sound Volume Slider:** Animation modulates the same GainNode as the volume slider — they share state. The animation's range must be relative to the slider's current value, not absolute, or the user's mix balance will be disrupted.
- **Export depends on the same synthesis graph as preview:** Use the same node configuration in both `AudioContext` (preview) and `OfflineAudioContext` (export). Avoid any preview-only nodes (e.g., analyser) that could affect the exported signal.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Sound catalog: 4 noise types (white, pink, brown, grey) + 3 weather (rain, wind, thunder) + 3 indoor (fan, ventilation, fireplace) — why essential: covers the stated requirement with enough variety to be useful
- [ ] Per-sound volume slider — why essential: core mixing interaction; without it there is no "mixer"
- [ ] Master volume control — why essential: basic usability; users need global loudness control
- [ ] Play/pause per sound — why essential: users need to audition sounds in isolation
- [ ] Global play/pause — why essential: "stop everything" is a basic control expectation
- [ ] Seamless loop preview — why essential: the product's core promise; non-seamless = broken
- [ ] Audio export to WAV (30s / 1min / 2min) — why essential: this is the entire reason the tool exists over Noisli

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Per-sound volume animation (LFO drift) — add when the static mixer feels mechanical after daily use
- [ ] URL-encoded state / shareable mix — add when user wants to return to a previous mix without reconfiguring
- [ ] Noise color descriptions / tooltips — add if user testing shows confusion about noise type differences

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] River / water sounds — explicitly deferred per PROJECT.md
- [ ] Session presets with localStorage persistence — adds schema/versioning complexity; URL encoding covers v1.x
- [ ] Additional sound categories (café, city, office) — expand catalog after v1 sounds are validated as high quality
- [ ] MP3 export option — only if WAV file sizes are a pain point in practice

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sound catalog (11 sounds) | HIGH | MEDIUM (hybrid: synthesize noise, source CC0 samples) | P1 |
| Per-sound volume slider | HIGH | LOW | P1 |
| Seamless loop preview | HIGH | MEDIUM | P1 |
| Global play/pause | HIGH | LOW | P1 |
| Audio export to WAV | HIGH | HIGH | P1 |
| Export duration selector | HIGH | LOW | P1 |
| Master volume | MEDIUM | LOW | P1 |
| Play/pause per sound | MEDIUM | LOW | P1 |
| Visual feedback (active state) | MEDIUM | LOW | P2 |
| Per-sound animation (LFO) | MEDIUM | MEDIUM | P2 |
| Noise color descriptions | LOW | LOW | P2 |
| URL-encoded state | MEDIUM | MEDIUM | P3 |
| Preset save (localStorage) | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | myNoise | Noisli | A Soft Murmur | Our Approach |
|---------|---------|--------|---------------|--------------|
| Individual volume sliders | Yes (10-band EQ per generator) | Yes (simple) | Yes | Yes — per-sound gain slider |
| Master volume | Yes | Yes | Yes | Yes |
| Sound catalog size | Hundreds of generators | ~26 sounds | 12+ sounds | 11 sounds (depth over breadth) |
| Algorithmically synthesized noise | Partial | Yes (white/pink/brown) | No | Yes — all 4 noise types synthesized |
| Seamless loop preview | Yes | Yes | Yes | Yes |
| Audio export | No | No | No | Yes — key differentiator |
| Export duration control | N/A | N/A | N/A | Yes (30s / 1min / 2min) |
| Slider animation | Yes (sophisticated LFO system) | No | No | v1.x — simplified LFO drift |
| Timer / sleep fade | Yes | Yes | No | No — not needed for export use case |
| Preset save | Yes (URL encoding) | Yes (account) | Yes (account) | v1.x — URL encoding |
| Text editor | No | Yes | No | No — out of scope |
| Mobile app | Yes (iOS/Android) | Yes | No | No — desktop-only local tool |
| Copyright safety | High (self-recorded) | Unknown | Unknown | Hard constraint — CC0 only |

## Sources

- [myNoise.net Quick Manual](https://mynoise.net/NoiseMachines/help.php) — per-slider EQ, animation, timer features (MEDIUM confidence: official source)
- [Noisli](https://www.noisli.com/) — feature set, pricing, sound library size (HIGH confidence: official source)
- [A Soft Murmur](https://asoftmurmur.com/) — minimal mixer pattern, individual sliders (HIGH confidence: direct product)
- [Ambient-Mixer.com](https://www.ambient-mixer.com/) — community mixing, crossfade approach (MEDIUM confidence: direct product)
- [Moodist](https://moodist.mvze.net/) — open-source, 84 sounds (MEDIUM confidence: direct product)
- [MDN Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — AudioWorklet, OfflineAudioContext, loop techniques (HIGH confidence: official MDN)
- [Noisli Alternatives Comparison — Gridfiti](https://gridfiti.com/noisli-alternatives/) — competitive feature comparison (MEDIUM confidence: secondary source, cross-verified)
- [Brad Traversy Ambient Sound Mixer (GitHub)](https://github.com/bradtraversy/ambient-sound-mixer) — open-source reference implementation patterns (MEDIUM confidence)

---
*Feature research for: Browser-based noise loop generator*
*Researched: 2026-03-18*
