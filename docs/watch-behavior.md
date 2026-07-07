# Watch Page — Behavior Snapshot

Captured before Split 4 (watch page file split). Verify all items still hold after each Step C file move.

---

## Join Screen

- [ ] On first load, the join screen overlay covers the full viewport (z-50)
- [ ] Wordmark "Versespan" and "Live Translation" label are visible
- [ ] Language badge shows correct target language (English / Español)
- [ ] "Tap to enable audio" button is present and styled in gold
- [ ] Tapping anywhere on the page OR the button dismisses the join screen and starts TTS
- [ ] After dismissal, join screen never reappears (audioUnlocked stays true)

---

## Connection & Status

- [ ] Status dot shows yellow + "Connecting…" while WebSocket is establishing
- [ ] Status dot turns green + "Live" once WebSocket connects
- [ ] Status dot shows yellow + "Reconnecting…" on disconnect
- [ ] On disconnect, WebSocket reconnects automatically within ~1 second
- [ ] On clean close (code 1000), reconnect fires immediately (delay = 0)
- [ ] Heartbeat ping fires every 20 seconds when connected

---

## Translations

- [ ] Historical translations load on connect and display in reverse-chronological order (newest at top)
- [ ] New translations appear at the top of the list in real time
- [ ] List is capped at 50 items (older entries drop off)
- [ ] Latest translation is always pinned in the gold-bordered box above the list
- [ ] Empty state shows spinner + "Connecting to translation stream…" while no translations yet

---

## TTS

- [ ] TTS plays automatically after audio is unlocked and a translation arrives
- [ ] If audio was not unlocked yet, the last translation text queues and plays on unlock
- [ ] TTS is gapless: while item N plays, item N+1 is pre-fetched in parallel
- [ ] "Audio On" toggle (🔊) stops current playback and clears queue immediately
- [ ] "Audio Off" toggle (🔇) re-enables TTS on next translation
- [ ] TTS does NOT fire during song mode (activeSong is set)

---

## Song Mode (ProPresenter)

- [ ] `presenting` message with `content_type: "song"` switches to song overlay
- [ ] Song overlay shows: title (target lang), source title below if different, all sections
- [ ] Sections display section name + lyrics text in target lang (source lang in gold italic if different)
- [ ] Song mode stops and clears TTS queue on entry
- [ ] `presenting_cleared` or `song_ended` message hides song overlay and returns to translation feed

---

## Scripture Overlay (ProPresenter)

- [ ] `presenting` message with `content_type: "scripture"` shows scripture panel at bottom
- [ ] Panel shows: verse reference (gold), target text (large serif), source text italic below if different
- [ ] Scripture overlay coexists with translation feed (feed is still visible above it)
- [ ] `presenting_cleared` hides the scripture overlay

---

## Font Size

- [ ] Three size buttons (A, A+, A++) visible in header
- [ ] Tapping each changes translation and song text size immediately
- [ ] Active size button highlighted in gold

---

## Session Ended Flow

- [ ] `error: "Session has ended"` message from server transitions to ended screen
- [ ] Ended screen shows Versespan wordmark, "Service has ended" message, "Share Feedback" button
- [ ] "Share Feedback" opens the feedback form
- [ ] "Skip" dismisses directly to thank-you screen without submitting
- [ ] Feedback form: all 4 star ratings + bug yes/no required before Submit enables
- [ ] Bug description textarea appears only when "Yes" is selected for hadBugs
- [ ] Submit sends POST to /api/feedback and shows thank-you screen
- [ ] After submit, localStorage metrics key for this session is removed

---

## Metrics Persistence

- [ ] On first load (no saved metrics), `watchStartTime` is set to `Date.now()` and saved
- [ ] On page reload mid-session, metrics are restored from `versespan-metrics-{sessionId}` key
- [ ] `connectionDrops` increments on each non-clean disconnect
- [ ] `totalTranslations` increments on each translation message received
- [ ] `firstTranslationTime` is set on the first translation and never overwritten
- [ ] Metrics are included in the feedback payload on submit
- [ ] localStorage key is removed after successful feedback submission
