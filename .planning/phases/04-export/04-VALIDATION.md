---
phase: 4
slug: export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — browser-only audio API (no Node.js test runner) |
| **Config file** | none |
| **Quick run command** | Manual: open browser, click Export WAV, verify download |
| **Full suite command** | Manual: import WAV into video editor, verify seamless loop |
| **Estimated runtime** | ~5 minutes per full check |

---

## Sampling Rate

- **After every task commit:** Open browser (`npm run dev`), click Export WAV, verify file downloads correctly
- **After every plan wave:** Full manual check — import WAV into video editor, verify seamless loop at boundary
- **Before `/gsd:verify-work`:** All four EXP requirements verified manually in browser
- **Max feedback latency:** ~5 minutes (manual browser test)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | EXP-01, EXP-02, EXP-03, EXP-04 | manual | — | N/A | ⬜ pending |
| 4-01-02 | 01 | 1 | EXP-01, EXP-02 | manual | — | N/A | ⬜ pending |
| 4-02-01 | 02 | 2 | EXP-03 | manual | — | N/A | ⬜ pending |
| 4-02-02 | 02 | 2 | EXP-01, EXP-02, EXP-03, EXP-04 | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test infrastructure to create. All validation is manual browser testing.

*No automated framework is installed. Adding Vitest + jsdom or Playwright for browser audio testing would be out of scope for Phase 4. All EXP requirements involve browser APIs and user interaction that cannot be headlessly tested without significant setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WAV file downloads on button click | EXP-01 | Requires browser + URL.createObjectURL + user gesture | Click Export WAV button; verify browser download dialog / download bar appears |
| Duration dropdown changes export file length | EXP-02 | Requires rendering and checking file duration in audio player | Export 30s, 1min, 2min; open each WAV in audio player or video editor; verify durations |
| Exported WAV loops gaplessly | EXP-03 | Requires video editor loop test — no automated audio comparison tool installed | Import WAV into video editor; set to loop; listen for click/silence at boundary |
| WAV sample rate = 44100 Hz | EXP-04 | Requires checking WAV header or audio player metadata | Open WAV in audio player (VLC, Audacity); verify sample rate shown as 44100 Hz |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 minutes (manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
