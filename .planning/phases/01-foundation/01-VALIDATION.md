---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — browser-native API, not unit-testable in Node |
| **Config file** | none — Wave 0 installs placeholder files only |
| **Quick run command** | `npm run dev` (verify app loads without console errors) |
| **Full suite command** | Manual browser check (Start button → console log → no 404s) |
| **Estimated runtime** | ~30 seconds manual check |

---

## Sampling Rate

- **After every task commit:** Run `npm run dev` — verify app loads without console errors
- **After every plan wave:** Manual browser check (Start button, console log, no 404s)
- **Before `/gsd:verify-work`:** All four success criteria visible in browser
- **Max feedback latency:** ~30 seconds (manual browser check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | ENG-01 | manual | n/a | ❌ Wave 0 creates | ⬜ pending |
| 1-01-02 | 01 | 1 | ENG-01 | manual | `npm run dev` (no errors) | ✅ after scaffold | ⬜ pending |
| 1-01-03 | 01 | 1 | ENG-01 | manual | browser: AudioContext state = running | ✅ after scaffold | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `public/worklets/.gitkeep` — placeholder preventing Phase 2 AudioWorklet 404
- [ ] `public/samples/.gitkeep` — placeholder for CC0 sample files
- [ ] Node 20.19+ confirmed — `node --version` output checked before scaffold

*No test framework installation needed — automated tests are not applicable to browser-native AudioContext behavior.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AudioContext transitions suspended → running on first click | ENG-01 | `AudioContext` is browser-native; no Node.js equivalent; mocking tests the mock, not the behavior | 1. `npm run dev` 2. Open http://localhost:5173 3. Click "▶ Start" 4. Console shows `[AudioEngine] state: running` 5. No 404s in Network tab 6. DevTools Web Audio Inspector shows active context |
| No 404 on AudioWorklet path | ENG-01 | Static file serving requires browser request | Open DevTools Network tab; no requests to `/worklets/` should 404 (directory exists but no worklet files yet) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
